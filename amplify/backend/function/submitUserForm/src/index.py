import json
import boto3
import datetime
import base64

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dev-user-interests')

def lambda_handler(event, context):
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))

        # Get JWT token from Authorization header
        auth_header = event.get('headers', {}).get('Authorization')
        if not auth_header:
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Error submitting form', 'error': 'JWT claims not found in event[\'requestContext\'][\'authorizer\']'})
            }

        # Decode JWT token to get user ID
        try:
            # JWT tokens have 3 parts separated by dots
            token_parts = auth_header.split('.')
            if len(token_parts) != 3:
                raise ValueError('Invalid JWT format')
            
            # Decode the payload (second part)
            payload = token_parts[1]
            # Add padding if needed
            payload += '=' * (4 - len(payload) % 4)
            decoded_payload = base64.b64decode(payload)
            claims = json.loads(decoded_payload)
            user_id = claims.get('sub')
            
            if not user_id:
                raise ValueError('No sub claim found')
                
        except Exception as decode_error:
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Error submitting form', 'error': 'JWT claims not found in event[\'requestContext\'][\'authorizer\']'})
            }

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
            'body': json.dumps({'message': 'Error submitting form', 'error': 'JWT claims not found in event[\'requestContext\'][\'authorizer\']'})
        }
