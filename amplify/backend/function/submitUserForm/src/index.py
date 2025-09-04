import json
import boto3
import datetime
import base64
from boto3.dynamodb.conditions import Key

# Use Document Client for automatic data type conversion
dynamodb = boto3.resource('dynamodb')
interests_table = dynamodb.Table('dev-user-interests')
consent_table = dynamodb.Table('dev-consent-forms')

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    print(f"Context: {context}")
    
    # Handle CORS preflight requests
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'body': ''
        }
    
    # Handle GET requests to check if user exists
    if event.get('httpMethod') == 'GET' or 'check' in event.get('rawPath', ''):
        return handle_get_request(event)
    
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

        # Determine if this is a consent form or interest form
        form_type_field = body.get('formType')
        has_parent_name = 'parentName' in body
        has_guardian_name = 'guardianName' in body
        is_consent_form = form_type_field == 'consent' or has_parent_name or has_guardian_name
        
        print(f"Form detection - formType: {form_type_field}, parentName: {has_parent_name}, guardianName: {has_guardian_name}, is_consent: {is_consent_form}")
        
        # Compose item
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            **body
        }
        
        print(f"Storing {'consent' if is_consent_form else 'interest'} form: {json.dumps(item, default=str)}")

        # Put item in appropriate table
        if is_consent_form:
            try:
                response = consent_table.put_item(Item=item)
                print(f"Successfully stored in consent table: {response}")
            except Exception as consent_error:
                print(f"Error storing in consent table: {consent_error}")
                # Fallback to interests table if consent table fails
                response = interests_table.put_item(Item=item)
                print(f"Fallback: stored in interests table: {response}")
        else:
            response = interests_table.put_item(Item=item)
            print(f"Stored in interests table: {response}")

        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
            },
            'body': json.dumps({'message': 'Form submitted successfully', 'formType': 'consent' if is_consent_form else 'interest'})
        }

    except Exception as e:
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error submitting form', 'error': str(e)})
        }

def handle_get_request(event):
    try:
        # Extract user ID from path
        path = event.get('rawPath', '')
        if '/check/' in path:
            user_id = path.split('/check/')[-1]
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Invalid request'})
            }
        
        # Check both tables
        try:
            consent_response = consent_table.get_item(Key={'userId': user_id})
            has_consent = 'Item' in consent_response
        except Exception as e:
            print(f"Error checking consent table: {e}")
            has_consent = False
            
        try:
            interest_response = interests_table.get_item(Key={'userId': user_id})
            has_interest = 'Item' in interest_response
        except Exception as e:
            print(f"Error checking interests table: {e}")
            has_interest = False
        
        if has_consent or has_interest:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'exists': True,
                    'hasConsent': has_consent,
                    'hasInterest': has_interest
                })
            }
        else:
            return {
                'statusCode': 404,
                'body': json.dumps({'exists': False})
            }
            
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
