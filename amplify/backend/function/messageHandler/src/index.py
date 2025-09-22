import json
import boto3
import datetime
import base64

# Initialize DynamoDB and Cognito clients
dynamodb = boto3.resource('dynamodb')
messages_table = dynamodb.Table('messages-dev')
matches_table = dynamodb.Table('dev-matches')
cognito_client = boto3.client('cognito-idp')

def handler(event, context):
    """Lambda function handler for messaging functionality."""
    print(f"Event: {json.dumps(event)}")
    
    # Handle CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': ''
        }
    
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
    
    # Extract user ID from JWT token
    user_id = extract_user_id(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Unauthorized'})
        }
    
    if http_method == 'GET':
        return get_messages(event, user_id)
    elif http_method == 'POST':
        return send_message(event, user_id)
    
    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Not found'})
    }

def extract_user_id(event):
    """Extract user ID from JWT token"""
    try:
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
        claims = json.loads(decoded_payload)
        
        return claims.get('sub')
    except Exception as e:
        print(f"Token validation error: {e}")
        return None

def get_messages(event, user_id):
    """Get message history for user's matches"""
    try:
        # Get user's matches first
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid)',
            ExpressionAttributeValues={':uid': user_id}
        )
        
        matches = matches_response['Items']
        conversations = []
        
        for match in matches:
            # Get the other user in the match
            other_user_id = match['seniorUserId'] if match['studentUserId'] == user_id else match['studentUserId']
            
            # Get messages for this conversation
            messages_response = messages_table.scan(
                FilterExpression='(senderId = :uid1 AND receiverId = :uid2) OR (senderId = :uid2 AND receiverId = :uid1)',
                ExpressionAttributeValues={
                    ':uid1': user_id,
                    ':uid2': other_user_id
                }
            )
            
            messages = sorted(messages_response['Items'], key=lambda x: x['timestamp'])
            
            # Get other user's name from Cognito
            other_user_name = get_user_name(other_user_id)
            
            conversations.append({
                'matchId': match['matchId'],
                'otherUserId': other_user_id,
                'otherUserName': other_user_name,
                'messages': messages
            })
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(conversations, default=str)
        }
        
    except Exception as e:
        print(f"Error getting messages: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def send_message(event, user_id):
    """Send a message to matched user"""
    try:
        body = json.loads(event.get('body', '{}'))
        receiver_id = body.get('receiverId')
        message_text = body.get('message')
        
        if not receiver_id or not message_text:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'receiverId and message are required'})
            }
        
        # Verify users are matched
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid1 AND seniorUserId = :uid2) OR (studentUserId = :uid2 AND seniorUserId = :uid1)',
            ExpressionAttributeValues={
                ':uid1': user_id,
                ':uid2': receiver_id
            }
        )
        
        if not matches_response['Items']:
            return {
                'statusCode': 403,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Users are not matched'})
            }
        
        # Create message
        message_id = f"{user_id}_{receiver_id}_{int(datetime.datetime.utcnow().timestamp() * 1000)}"
        message_item = {
            'messageId': message_id,
            'senderId': user_id,
            'receiverId': receiver_id,
            'message': message_text,
            'timestamp': datetime.datetime.utcnow().isoformat()
        }
        
        messages_table.put_item(Item=message_item)
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Message sent successfully'})
        }
        
    except Exception as e:
        print(f"Error sending message: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def get_user_name(user_id):
    """Get user's first name from Cognito"""
    try:
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'given_name':
                return attr['Value']
        
        return 'Unknown'
    except Exception as e:
        print(f"Error getting user name: {e}")
        return 'Unknown'