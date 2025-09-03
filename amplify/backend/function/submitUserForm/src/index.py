import json
import boto3
import datetime
import base64
from boto3.dynamodb.conditions import Key

# Use Document Client for automatic data type conversion
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dev-user-interests')

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    print(f"Context: {context}")
    
    # Handle CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'body': ''
        }
    
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))

        # For testing with open API, use a default user ID or extract from JWT if available
        user_id = 'test-user'
        
        # Get user ID from JWT token - now required
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
        if not auth_header:
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Authorization header required'})
            }
        
        try:
            # Remove 'Bearer ' prefix if present
            token = auth_header.replace('Bearer ', '')
            # JWT tokens have 3 parts separated by dots
            token_parts = token.split('.')
            if len(token_parts) != 3:
                raise ValueError('Invalid token format')
            
            # Decode the payload (second part)
            payload = token_parts[1]
            # Add padding if needed
            payload += '=' * (4 - len(payload) % 4)
            decoded_payload = base64.b64decode(payload)
            claims = json.loads(decoded_payload)
            user_id = claims.get('sub')
            
            if not user_id:
                raise ValueError('No user ID in token')
                
        except Exception as e:
            print(f"Token validation error: {e}")
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Invalid or expired token'})
            }

        # Compose item - DynamoDB Document Client handles arrays automatically
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            **body
        }
        
        print(f"Storing item: {json.dumps(item, default=str)}")

        # Put item in DynamoDB using Document Client
        response = table.put_item(Item=item)
        print(f"DynamoDB response: {response}")

        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Form submitted successfully'})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error submitting form', 'error': str(e)})
        }
