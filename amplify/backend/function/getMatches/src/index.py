import json
import boto3
import base64

# Initialize DynamoDB and Cognito clients
dynamodb = boto3.resource('dynamodb')
matches_table = dynamodb.Table('dev-matches')
consent_table = dynamodb.Table('dev-consent-forms')
interests_table = dynamodb.Table('dev-user-interests')
cognito_client = boto3.client('cognito-idp')
ssm = boto3.client('ssm')
USER_POOL_ID = 'us-east-2_AxTL9MRLy'

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
        
        # Fallback to manual JWT parsing
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
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

def check_consent_form(user_id):
    try:
        response = consent_table.get_item(Key={'userId': user_id})
        return 'Item' in response
    except:
        return False

def check_interest_form(user_id):
    try:
        response = interests_table.get_item(Key={'userId': user_id})
        return 'Item' in response
    except:
        return False

def check_admin_status(email):
    try:
        response = ssm.get_parameter(Name='/brightbonds/admin-emails', WithDecryption=True)
        admin_emails = {e.strip().lower() for e in response['Parameter']['Value'].split(',')}
        return email.lower() in admin_emails
    except:
        return False

def handle_all_users_request():
    """Admin endpoint to list all Cognito users"""
    try:
        users = []
        pagination_token = None
        
        while True:
            if pagination_token:
                response = cognito_client.list_users(UserPoolId=USER_POOL_ID, PaginationToken=pagination_token)
            else:
                response = cognito_client.list_users(UserPoolId=USER_POOL_ID)
            
            for user in response.get('Users', []):
                user_id = user['Username']
                email = ''
                given_name = ''
                family_name = ''
                birthdate = ''
                
                for attr in user.get('Attributes', []):
                    if attr['Name'] == 'email':
                        email = attr['Value']
                    elif attr['Name'] == 'given_name':
                        given_name = attr['Value']
                    elif attr['Name'] == 'family_name':
                        family_name = attr['Value']
                    elif attr['Name'] == 'birthdate':
                        birthdate = attr['Value']
                
                user_type = 'Student'
                if birthdate:
                    birth_year = int(birthdate.split('-')[0])
                    if birth_year < 1995:
                        user_type = 'Resident'
                
                users.append({
                    'userId': user_id,
                    'name': f"{given_name} {family_name}".strip(),
                    'email': email,
                    'type': user_type,
                    'hasConsent': check_consent_form(user_id),
                    'hasInterest': check_interest_form(user_id),
                    'isAdmin': check_admin_status(email)
                })
            
            pagination_token = response.get('PaginationToken')
            if not pagination_token:
                break
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(users, default=str)
        }
    except Exception as e:
        print(f"Error listing users: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def handler(event, context):
    """Lambda function handler for match-related requests."""
    print(f"Event: {json.dumps(event)}")
    
    # Handle CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,OPTIONS'
            },
            'body': ''
        }
    
    # Verify authentication
    user_id = get_authenticated_user_id(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
    raw_path = event.get('rawPath', '')
    
    # Handle GET requests for matches
    if http_method == 'GET':
        # Check if this is a request for all users (admin)
        if raw_path == '/users/all' or event.get('path', '') == '/users/all':
            if not is_admin_user(user_id):
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
            return handle_all_users_request()
        # Check if this is a request for all matches (admin)
        elif raw_path == '/matches/all' or event.get('path', '') == '/matches/all':
            if not is_admin_user(user_id):
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
            return handle_all_matches_request(event)
        else:
            return handle_matches_request(event)
    
    return {
        'statusCode': 404,
        'headers': {
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'message': 'Not found'})
    }

def handle_matches_request(event):
    """Handle GET requests for user matches"""
    try:
        # Get authenticated user ID
        user_id = get_authenticated_user_id(event)
        if not user_id:
            raise Exception('User not authenticated')
        
        # Get matches for this user
        response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid)',
            ExpressionAttributeValues={':uid': user_id}
        )
        
        matches = response['Items']
        
        if not matches:
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps([])
            }
        
        # Enrich matches with matched user's first name from Cognito
        for match in matches:
            # Determine which user is the match (not the current user)
            matched_user_id = match['seniorUserId'] if match['studentUserId'] == user_id else match['studentUserId']
            
            # Get the matched user's first name from Cognito
            try:
                user_response = cognito_client.admin_get_user(
                    UserPoolId='us-east-2_AxTL9MRLy',
                    Username=matched_user_id
                )
                
                # Extract first name from user attributes
                first_name = 'Unknown'
                for attr in user_response.get('UserAttributes', []):
                    if attr['Name'] == 'given_name':
                        first_name = attr['Value']
                        break
                
                match['matchedUserFirstName'] = first_name
                
            except Exception as e:
                print(f"Error getting matched user name from Cognito: {e}")
                match['matchedUserFirstName'] = 'Unknown'
            
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(matches, default=str)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }

def handle_all_matches_request(event):
    """Handle GET requests for all matches (admin only)"""
    try:
        # Get all matches from the matches table
        response = matches_table.scan()
        matches = response.get('Items', [])
        
        # Enrich matches with user names from Cognito
        for match in matches:
            try:
                # Get student name
                student_response = cognito_client.admin_get_user(
                    UserPoolId='us-east-2_AxTL9MRLy',
                    Username=match['studentUserId']
                )
                student_given = 'Unknown'
                student_family = ''
                for attr in student_response.get('UserAttributes', []):
                    if attr['Name'] == 'given_name':
                        student_given = attr['Value']
                    elif attr['Name'] == 'family_name':
                        student_family = attr['Value']
                match['studentName'] = f"{student_given} {student_family}".strip()
                
                # Get senior name
                senior_response = cognito_client.admin_get_user(
                    UserPoolId='us-east-2_AxTL9MRLy',
                    Username=match['seniorUserId']
                )
                senior_given = 'Unknown'
                senior_family = ''
                for attr in senior_response.get('UserAttributes', []):
                    if attr['Name'] == 'given_name':
                        senior_given = attr['Value']
                    elif attr['Name'] == 'family_name':
                        senior_family = attr['Value']
                match['seniorName'] = f"{senior_given} {senior_family}".strip()
                
            except Exception as e:
                print(f"Error getting user names from Cognito: {e}")
                match['studentName'] = match.get('studentName', 'Unknown')
                match['seniorName'] = match.get('seniorName', 'Unknown')
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(matches, default=str)
        }
        
    except Exception as e:
        print(f"Error getting all matches: {e}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)})
        }
