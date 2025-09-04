import json
import boto3
import datetime
import base64

# Consent forms table
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dev-consent-forms')

def handler(event, context):
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
    
    # Handle GET requests to check if consent exists
    if event.get('httpMethod') == 'GET' or 'check' in event.get('rawPath', ''):
        return handle_get_request(event)
    
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))

        # Get user ID from JWT token
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization')
        if not auth_header:
            return {
                'statusCode': 401,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Authorization header required'})
            }
        
        try:
            token = auth_header.replace('Bearer ', '')
            token_parts = token.split('.')
            if len(token_parts) != 3:
                raise ValueError('Invalid token format')
            
            payload = token_parts[1]
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
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Invalid or expired token'})
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
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Consent form submitted successfully'})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Error submitting consent form', 'error': str(e)})
        }

def handle_get_request(event):
    try:
        path = event.get('rawPath', '')
        if '/check/' in path:
            user_id = path.split('/check/')[-1]
        else:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Invalid request'})
            }
        
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'hasConsent': True})
            }
        else:
            return {
                'statusCode': 404,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'hasConsent': False})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }