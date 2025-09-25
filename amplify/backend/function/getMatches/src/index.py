import json
import boto3

# Initialize DynamoDB and Cognito clients
dynamodb = boto3.resource('dynamodb')
matches_table = dynamodb.Table('dev-matches')
cognito_client = boto3.client('cognito-idp')

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
    
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
    raw_path = event.get('rawPath', '')
    
    # Handle GET requests for matches
    if http_method == 'GET':
        # Check if this is a request for all matches (admin)
        if raw_path == '/matches/all' or event.get('path', '') == '/matches/all':
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
        # Get user ID from path parameters or path
        path_params = event.get('pathParameters', {})
        if path_params and 'proxy' in path_params:
            user_id = path_params['proxy']
        else:
            path = event.get('rawPath', '') or event.get('path', '')
            if '/matches/' in path:
                user_id = path.split('/matches/')[-1]
            else:
                user_id = path.split('/')[-1]
        
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