import json
import boto3
import datetime
import base64

# Consent forms table
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('dev-consent-forms')

def get_authenticated_user_id(event):
    """Extract user ID from Cognito authentication context"""
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        return claims.get('sub') or claims.get('cognito:username')
    except Exception as e:
        print(f"Error extracting user ID: {e}")
        return None

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    # Handle CORS preflight requests (handled by Lambda Function URL)
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'body': ''
        }
    
    # CORS is handled by Lambda Function URL configuration
    
    # Handle GET requests to check if consent exists
    if event.get('httpMethod') == 'GET' or 'check' in event.get('rawPath', ''):
        return handle_get_request(event)
    
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))

        # Get authenticated user ID
        user_id = get_authenticated_user_id(event)
        if not user_id:
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

def handle_get_request(event):
    try:
        path = event.get('rawPath', '')
        if '/check/' in path:
            user_id = path.split('/check/')[-1]
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Invalid request'})
            }
        
        response = table.get_item(Key={'userId': user_id})
        
        if 'Item' in response:
            return {
                'statusCode': 200,
                'body': json.dumps({'hasConsent': True})
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'hasConsent': False})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }