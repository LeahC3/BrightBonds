import json
import boto3
import base64

cognito_client = boto3.client('cognito-idp')

def handler(event, context):
    """Lambda function handler for user settings management."""
    
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
    
    # Extract user ID from Cognito authentication
    user_id = get_authenticated_user_id(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Unauthorized'})
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        if action == 'getSettings':
            return get_user_settings(user_id)
        elif action == 'saveSettings':
            return save_user_settings(user_id, body.get('settings'))
        else:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Invalid action'})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

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

def get_user_settings(user_id):
    """Get user settings from Cognito"""
    try:
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        email_notifications = True  # Default
        
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'custom:email_notifications':
                email_notifications = attr['Value'] == '1'
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'emailNotifications': email_notifications,
                'matchNotifications': True,
                'profileVisibility': True,
                'language': 'en',
                'theme': 'light'
            })
        }
    except Exception as e:
        print(f"Error getting settings: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def save_user_settings(user_id, settings):
    """Save user settings to Cognito custom attributes"""
    try:
        cognito_client.admin_update_user_attributes(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id,
            UserAttributes=[
                {
                    'Name': 'custom:email_notifications',
                    'Value': '1' if settings.get('emailNotifications', True) else '0'
                }
            ]
        )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Settings saved successfully'})
        }
    except Exception as e:
        print(f"Error saving settings: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }