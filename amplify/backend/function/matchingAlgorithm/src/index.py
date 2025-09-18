import json
import boto3
import datetime
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
interests_table = dynamodb.Table('dev-user-interests')
matches_table = dynamodb.Table('dev-matches')

def handler(event, context):
    """
    Matching Algorithm Lambda Function
    
    Matches students with seniors based on:
    1. Location preference (primary filter)
    2. Shared interests (scoring)
    3. Availability for St. John residents only
    """
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Get all unmatched users
        students = get_unmatched_users('student')
        seniors = get_unmatched_users('senior')
        
        print(f"Found {len(students)} students and {len(seniors)} seniors")
        
        matches_created = 0
        
        for student in students:
            best_match = find_best_match(student, seniors)
            if best_match:
                match_id = create_match(student, best_match['senior'], best_match['score'], best_match['shared_interests'])
                matches_created += 1
                print(f"Created match: {match_id}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': f'Matching complete. Created {matches_created} matches.',
                'matches_created': matches_created
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }

def get_unmatched_users(user_type):
    """Get all users of specified type who don't have active matches"""
    try:
        # Scan interests table for users of specified type
        response = interests_table.scan(
            FilterExpression='userType = :type',
            ExpressionAttributeValues={':type': user_type}
        )
        
        users = response['Items']
        
        # Filter out users who already have active matches
        unmatched_users = []
        for user in users:
            if not has_active_match(user['userId']):
                unmatched_users.append(user)
        
        return unmatched_users
        
    except Exception as e:
        print(f"Error getting unmatched users: {e}")
        return []

def has_active_match(user_id):
    """Check if user already has an active match"""
    try:
        response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid) AND #status = :status',
            ExpressionAttributeValues={
                ':uid': user_id,
                ':status': 'active'
            },
            ExpressionAttributeNames={'#status': 'status'}
        )
        return len(response['Items']) > 0
    except:
        return False

def find_best_match(student, seniors):
    """Find the best senior match for a student"""
    best_match = None
    best_score = 0
    
    for senior in seniors:
        # Primary filter: Location compatibility
        if not is_location_compatible(student, senior):
            continue
            
        # Secondary filter: Availability (only for St. John)
        if not is_availability_compatible(student, senior):
            continue
            
        # Calculate compatibility score
        score, shared_interests = calculate_compatibility_score(student, senior)
        
        if score > best_score:
            best_score = score
            best_match = {
                'senior': senior,
                'score': score,
                'shared_interests': shared_interests
            }
    
    return best_match

def is_location_compatible(student, senior):
    """Check if student and senior location preferences are compatible"""
    student_pref = student.get('locationPreference', '')
    senior_facility = senior.get('facility', '')
    
    # Direct match
    if student_pref == senior_facility:
        return True
        
    # Student has no preference - can match with anyone
    if student_pref == 'No preference':
        return True
        
    return False

def is_availability_compatible(student, senior):
    """Check availability compatibility (only for St. John residents)"""
    senior_facility = senior.get('facility', '')
    
    # Only check availability for St. John residents
    if senior_facility != 'St. John XXIII Villas':
        return True
        
    # For St. John, check if they have overlapping availability
    student_days = student.get('availability', [])
    senior_days = senior.get('availability', [])
    
    student_times = student.get('times', [])
    senior_times = senior.get('times', [])
    
    # Convert to lists if single values
    if isinstance(student_days, str):
        student_days = [student_days]
    if isinstance(senior_days, str):
        senior_days = [senior_days]
    if isinstance(student_times, str):
        student_times = [student_times]
    if isinstance(senior_times, str):
        senior_times = [senior_times]
    
    # Check for overlapping days and times
    days_overlap = bool(set(student_days) & set(senior_days))
    times_overlap = bool(set(student_times) & set(senior_times))
    
    return days_overlap and times_overlap

def calculate_compatibility_score(student, senior):
    """Calculate compatibility score based on shared interests"""
    score = 0
    shared_interests = []
    
    # Interest categories to compare
    categories = ['hobbies', 'games', 'music', 'freeTime', 'topics', 'sports']
    
    for category in categories:
        student_interests = student.get(category, [])
        senior_interests = senior.get(category, [])
        
        # Convert to lists if single values
        if isinstance(student_interests, str):
            student_interests = [student_interests]
        if isinstance(senior_interests, str):
            senior_interests = [senior_interests]
            
        # Find shared interests in this category
        shared = list(set(student_interests) & set(senior_interests))
        if shared:
            shared_interests.extend(shared)
            score += len(shared) * 2  # 2 points per shared interest
    
    # Bonus points for personality compatibility
    if student.get('reading') == senior.get('reading'):
        score += 3
        
    if student.get('talkStyle') == senior.get('talkStyle'):
        score += 3
        
    if student.get('personality') == senior.get('personality'):
        score += 2
        
    if student.get('jokes') == senior.get('jokes'):
        score += 2
        
    if student.get('convoPreference') == senior.get('convoPreference'):
        score += 3
        
    if student.get('pace') == senior.get('pace'):
        score += 2
    
    return score, shared_interests

def create_match(student, senior, score, shared_interests):
    """Create a new match record"""
    match_id = f"match_{student['userId'][:8]}_{senior['userId'][:8]}_{int(datetime.datetime.now().timestamp())}"
    
    match_item = {
        'matchId': match_id,
        'studentUserId': student['userId'],
        'seniorUserId': senior['userId'],
        'studentLocation': student.get('locationPreference', ''),
        'seniorFacility': senior.get('facility', ''),
        'compatibilityScore': Decimal(str(score)),
        'sharedInterests': shared_interests,
        'status': 'pending',
        'createdAt': datetime.datetime.utcnow().isoformat(),
        'lastUpdated': datetime.datetime.utcnow().isoformat()
    }
    
    matches_table.put_item(Item=match_item)
    return match_id