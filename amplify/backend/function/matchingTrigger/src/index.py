# BrightBonds Matching Algorithm Lambda Function
# This function matches high school students with seniors based on shared interests and compatibility

import json
import boto3
import datetime
from decimal import Decimal

# Initialize DynamoDB connection
dynamodb = boto3.resource('dynamodb')
interests_table = dynamodb.Table('dev-user-interests')  # Table containing student/senior profiles
matches_table = dynamodb.Table('dev-matches')          # Table storing match results

def handler(event, context):
    """
    Main Lambda handler for the matching algorithm.
    
    This function:
    1. Retrieves all unmatched students and seniors from the database
    2. Matches each student with their most compatible senior
    3. Ensures each person gets only one match (one-to-one pairing)
    4. Creates match records in the database
    
    Returns:
        HTTP response with match results and count
    """
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Get all users who don't currently have active matches
        students = get_unmatched_users('student')
        seniors = get_unmatched_users('senior')
        
        print(f"Found {len(students)} students and {len(seniors)} seniors")
        
        matches_created = 0
        matched_seniors = set()  # Track seniors matched in this run to prevent duplicates
        
        # Process each student to find their best match
        for student in students:
            # Filter out seniors already matched in this run
            available_seniors = [s for s in seniors if s['userId'] not in matched_seniors]
            best_match = find_best_match(student, available_seniors)
            
            if best_match:
                # Create the match in the database
                match_id = create_match(student, best_match['senior'], best_match['score'], best_match['shared_interests'])
                matched_seniors.add(best_match['senior']['userId'])  # Mark senior as matched
                matches_created += 1
                print(f"Created match: {match_id}")
        
        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps({
                'message': f'Matching complete. Created {matches_created} matches.',
                'matches_created': matches_created
            })
        }
        
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps({'error': str(e)})
        }

def get_unmatched_users(user_type):
    """
    Retrieves all users of a specific type (student/senior) who don't have active matches.
    
    Args:
        user_type (str): Either 'student' or 'senior'
        
    Returns:
        list: List of user profiles without active matches
    """
    try:
        # Get all users of the specified type from the interests table
        response = interests_table.scan(
            FilterExpression='userType = :type',
            ExpressionAttributeValues={':type': user_type}
        )
        
        users = response['Items']
        unmatched_users = []
        
        # Filter out users who already have active matches
        for user in users:
            if not has_active_match(user['userId']):
                unmatched_users.append(user)
        
        return unmatched_users
    except Exception as e:
        print(f"Error getting unmatched users: {e}")
        return []

def has_active_match(user_id):
    """
    Checks if a user already has an active match.
    
    Args:
        user_id (str): The user's unique identifier
        
    Returns:
        bool: True if user has an active match, False otherwise
    """
    try:
        # Search matches table for any active matches involving this user
        response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid) AND #status = :status',
            ExpressionAttributeValues={':uid': user_id, ':status': 'active'},
            ExpressionAttributeNames={'#status': 'status'}  # 'status' is a reserved word
        )
        return len(response['Items']) > 0
    except:
        return False

def find_best_match(student, available_seniors):
    """
    Finds the best senior match for a student based on compatibility scoring.
    
    Args:
        student (dict): Student profile data
        available_seniors (list): List of senior profiles not yet matched
        
    Returns:
        dict: Best match with senior profile, score, and shared interests, or None
    """
    best_match = None
    best_score = 0
    
    # Evaluate each available senior for compatibility
    for senior in available_seniors:
        # Primary filter: Location compatibility (must match)
        if not is_location_compatible(student, senior):
            continue
            
        # Secondary filter: Availability compatibility (for St. John residents)
        if not is_availability_compatible(student, senior):
            continue
            
        # Calculate compatibility score based on shared interests and preferences
        score, shared_interests = calculate_compatibility_score(student, senior)
        
        # Keep track of the highest scoring match
        if score > best_score:
            best_score = score
            best_match = {'senior': senior, 'score': score, 'shared_interests': shared_interests}
    
    return best_match

def is_location_compatible(student, senior):
    """
    Checks if student and senior location preferences are compatible.
    
    Args:
        student (dict): Student profile with locationPreference
        senior (dict): Senior profile with facility
        
    Returns:
        bool: True if locations are compatible, False otherwise
    """
    student_pref = student.get('locationPreference', '')
    senior_facility = senior.get('facility', '')
    
    # Compatible if: exact match OR student has no preference
    if student_pref == senior_facility or student_pref == 'No preference':
        return True
    return False

def is_availability_compatible(student, senior):
    """
    Checks availability compatibility between student and senior.
    Only applies to St. John XXIII Villas residents (Shell Point residents are always compatible).
    
    Args:
        student (dict): Student profile with availability and times
        senior (dict): Senior profile with facility, availability, and times
        
    Returns:
        bool: True if availability is compatible, False otherwise
    """
    senior_facility = senior.get('facility', '')
    
    # Shell Point residents don't have availability restrictions
    if senior_facility != 'St. John XXIII Villas':
        return True
        
    # For St. John residents, check for overlapping availability
    student_days = student.get('availability', [])
    senior_days = senior.get('availability', [])
    student_times = student.get('times', [])
    senior_times = senior.get('times', [])
    
    # Convert single values to lists for consistent processing
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
    
    # Both days and times must overlap
    return days_overlap and times_overlap

def calculate_compatibility_score(student, senior):
    """
    Calculates compatibility score between student and senior based on shared interests and preferences.
    
    Scoring system:
    - Shared interests: 2 points each
    - Matching reading preference: 3 points
    - Matching talk style: 3 points
    - Matching conversation preference: 3 points
    - Matching personality: 2 points
    - Matching humor preference: 2 points
    - Matching pace preference: 2 points
    
    Args:
        student (dict): Student profile data
        senior (dict): Senior profile data
        
    Returns:
        tuple: (total_score, list_of_shared_interests)
    """
    score = 0
    shared_interests = []
    
    # Interest categories to compare
    categories = ['hobbies', 'games', 'music', 'freeTime', 'topics', 'sports']
    
    # Calculate points for shared interests
    for category in categories:
        student_interests = student.get(category, [])
        senior_interests = senior.get(category, [])
        
        # Convert single values to lists for consistent processing
        if isinstance(student_interests, str):
            student_interests = [student_interests]
        if isinstance(senior_interests, str):
            senior_interests = [senior_interests]
            
        # Find shared interests in this category
        shared = list(set(student_interests) & set(senior_interests))
        if shared:
            shared_interests.extend(shared)
            score += len(shared) * 2  # 2 points per shared interest
    
    # Bonus points for personality and communication compatibility
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
    """
    Creates a match record in the database.
    
    Args:
        student (dict): Student profile data
        senior (dict): Senior profile data
        score (int): Compatibility score
        shared_interests (list): List of shared interests
        
    Returns:
        str: The created match ID
    """
    # Generate unique match ID using user IDs and timestamp
    match_id = f"match_{student['userId'][:8]}_{senior['userId'][:8]}_{int(datetime.datetime.now().timestamp())}"
    
    # Create match record with all relevant information
    match_item = {
        'matchId': match_id,
        'studentUserId': student['userId'],
        'seniorUserId': senior['userId'],
        'studentLocation': student.get('locationPreference', ''),
        'seniorFacility': senior.get('facility', ''),
        'compatibilityScore': Decimal(str(score)),  # DynamoDB requires Decimal for numbers
        'sharedInterests': shared_interests,
        'status': 'active',  # Matches are immediately active (no approval needed)
        'createdAt': datetime.datetime.utcnow().isoformat(),
        'lastUpdated': datetime.datetime.utcnow().isoformat()
    }
    
    # Save to database
    matches_table.put_item(Item=match_item)
    return match_id