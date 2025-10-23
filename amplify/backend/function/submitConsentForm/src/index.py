import json
import boto3
import datetime
import base64

# Consent forms table
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dev-consent-forms')

def get_authenticated_user_id(event):
    """Extract user ID from JWT token in Authorization header"""
    try:
        # Get Authorization header
        headers = event.get('headers', {})
        auth_header = headers.get('Authorization') or headers.get('authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
            
        # Extract JWT token
        token = auth_header.replace('Bearer ', '')
        
        # Decode JWT payload (without verification for simplicity)
        # In production, you should verify the token signature
        parts = token.split('.')
        if len(parts) != 3:
            return None
            
        payload = parts[1]
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        
        decoded = base64.b64decode(payload)
        claims = json.loads(decoded)
        
        return claims.get('sub') or claims.get('cognito:username')
        
    except Exception as e:
        print(f"Error extracting user ID: {e}")
        return None

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))
        
        # Extract user ID from JWT token
        user_id = get_authenticated_user_id(event)
        if not user_id:
            print("No valid user ID found in JWT token")
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Unauthorized'})
            }

        # Store consent form
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            **body
        }
        
        print(f"Storing consent: {json.dumps(item, default=str)}")
        response = table.put_item(Item=item)
        print(f"DynamoDB response: {response}")

        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Consent form submitted successfully'})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error submitting consent form', 'error': str(e)})
        }