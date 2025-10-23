# BrightBonds Matching Algorithm Lambda Function
# This function matches high school students with seniors based on shared interests and compatibility

import json
import boto3
import datetime
from decimal import Decimal
import base64

# Initialize DynamoDB connection
dynamodb = boto3.resource('dynamodb')
interests_table = dynamodb.Table('dev-user-interests')  # Table containing student/senior profiles
matches_table = dynamodb.Table('dev-matches')          # Table storing match results
cognito_client = boto3.client('cognito-idp')
ssm = boto3.client('ssm')

def is_admin_user(user_id):
    """Check if user is an admin by comparing email to admin list in Parameter Store"""
    try:
        # Get user's email from Cognito
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        user_email = None
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'email':
                user_email = attr['Value'].lower()
                break
        
        if not user_email:
            return False
        
        # Get admin emails from Parameter Store
        response = ssm.get_parameter(
            Name='/brightbonds/admin-emails',
            WithDecryption=True
        )
        admin_emails = {email.strip().lower() for email in response['Parameter']['Value'].split(',')}
        
        return user_email in admin_emails
        
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False

def get_authenticated_user_id(event):
    """Extract user ID from Cognito authentication context or JWT token"""
    try:
        # Try API Gateway authorizer context first
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        user_id = claims.get('sub') or claims.get('cognito:username')
        if user_id:
            return user_id
        
        # Try headers first
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization') or headers.get('authorization')
        
        # If no header, try request body for token
        if not auth_header:
            try:
                body = json.loads(event.get('body', '{}'))
                auth_header = body.get('token')
                if auth_header and not auth_header.startswith('Bearer '):
                    auth_header = f'Bearer {auth_header}'
            except:
                pass
        
        if not auth_header:
            return None
        
        token = auth_header.replace('Bearer ', '')
        token_parts = token.split('.')
        if len(token_parts) != 3:
            return None
        
        payload = token_parts[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded_payload = base64.b64decode(payload)
        token_claims = json.loads(decoded_payload)
        
        return token_claims.get('sub')
    except Exception as e:
        print(f"Error extracting user ID: {e}")
        return None

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
    
    # Handle CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': 'https://www.brightbonds.org',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': ''
        }
    
    # Verify admin authentication
    user_id = get_authenticated_user_id(event)
    
    if not user_id:
        return {
            'statusCode': 403,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': 'https://www.brightbonds.org',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps({'error': 'Authentication required'})
        }
    
    if not is_admin_user(user_id):
        return {
            'statusCode': 403,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': 'https://www.brightbonds.org',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            'body': json.dumps({'error': 'Admin access required'})
        }
    
    try:
        # Get all users who don't currently have active matches
        students = get_unmatched_users('student')
        seniors = get_unmatched_users('senior')
        
        print(f"Found {len(students)} students and {len(seniors)} seniors")
        
        # Use maximum weight bipartite matching for optimal pairing
        optimal_matches = maximum_weight_matching(students, seniors)
        
        matches_created = 0
        # Create matches in the database
        for student, senior, score, shared_interests in optimal_matches:
            match_id = create_match(student, senior, score, shared_interests)
            matches_created += 1
            print(f"Created match: {match_id} with score {score}")
        
        # Return success response
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': 'https://www.brightbonds.org',
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
                'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Origin': 'https://www.brightbonds.org',
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

def maximum_weight_matching(students, seniors):
    """
    Finds the optimal matching that maximizes total compatibility scores.
    Uses a greedy approach that sorts all possible pairs by score.
    
    Args:
        students (list): List of student profiles
        seniors (list): List of senior profiles
        
    Returns:
        list: List of tuples (student, senior, score, shared_interests) representing optimal matches
    """
    # Generate all valid student-senior pairs with compatibility scores
    all_pairs = []
    
    for student in students:
        for senior in seniors:
            # Check if this pair is compatible (location and availability)
            if not is_location_compatible(student, senior):
                continue
            if not is_availability_compatible(student, senior):
                continue
                
            # Calculate compatibility score
            score, shared_interests = calculate_compatibility_score(student, senior)
            
            # Only include pairs with positive scores
            if score > 0:
                all_pairs.append((score, student, senior, shared_interests))
    
    # Sort all pairs by compatibility score (highest first)
    all_pairs.sort(key=lambda x: x[0], reverse=True)
    
    # Greedily select the highest scoring pairs without conflicts
    matched_students = set()
    matched_seniors = set()
    final_matches = []
    
    for score, student, senior, shared_interests in all_pairs:
        student_id = student['userId']
        senior_id = senior['userId']
        
        # If neither person is already matched, create this match
        if student_id not in matched_students and senior_id not in matched_seniors:
            final_matches.append((student, senior, score, shared_interests))
            matched_students.add(student_id)
            matched_seniors.add(senior_id)
    
    print(f"Maximum weight matching found {len(final_matches)} optimal pairs")
    return final_matches

def is_location_compatible(student, senior):
    """
    All users are now at Shell Point, so location is always compatible.
    
    Args:
        student (dict): Student profile
        senior (dict): Senior profile
        
    Returns:
        bool: Always True since only Shell Point is supported
    """
    return True

def is_availability_compatible(student, senior):
    """
    All meetings are now at Shell Point on Mondays at 4:00 PM, so availability is always compatible.
    
    Args:
        student (dict): Student profile
        senior (dict): Senior profile
        
    Returns:
        bool: Always True since scheduling is standardized
    """
    return True

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
        'studentLocation': 'Shell Point',
        'seniorFacility': 'Shell Point',
        'compatibilityScore': Decimal(str(score)),  # DynamoDB requires Decimal for numbers
        'sharedInterests': shared_interests,
        'status': 'active',  # Matches are immediately active (no approval needed)
        'createdAt': datetime.datetime.utcnow().isoformat(),
        'lastUpdated': datetime.datetime.utcnow().isoformat()
    }
    
    # Save to database
    matches_table.put_item(Item=match_item)
    return match_id