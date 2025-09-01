import json
import boto3
import datetime
import base64

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
        
        # Try to get user ID from JWT token if provided
        auth_header = event.get('headers', {}).get('Authorization')
        if auth_header:
            try:
                # Remove 'Bearer ' prefix if present
                token = auth_header.replace('Bearer ', '')
                # JWT tokens have 3 parts separated by dots
                token_parts = token.split('.')
                if len(token_parts) == 3:
                    # Decode the payload (second part)
                    payload = token_parts[1]
                    # Add padding if needed
                    payload += '=' * (4 - len(payload) % 4)
                    decoded_payload = base64.b64decode(payload)
                    claims = json.loads(decoded_payload)
                    user_id = claims.get('sub', 'test-user')
            except Exception:
                pass

        # Compose item
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            **body  # spread form data directly into item
        }

        # Put item in DynamoDB
        table.put_item(Item=item)

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
