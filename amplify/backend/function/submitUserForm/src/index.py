import json
import boto3
import datetime
import base64
from boto3.dynamodb.conditions import Key

# Initialize DynamoDB resource for database operations
# Using Document Client for automatic data type conversion (strings, numbers, etc.)
dynamodb = boto3.resource('dynamodb')
interests_table = dynamodb.Table('dev-user-interests')  # Table for student/senior interest forms
consent_table = dynamodb.Table('dev-consent-forms')    # Table for parental consent forms
matches_table = dynamodb.Table('dev-matches')          # Table for matches
cognito_client = boto3.client('cognito-idp')

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
    """Main Lambda function handler for form submissions and user checks.
    
    This function handles:
    1. CORS preflight requests (OPTIONS)
    2. GET requests to check if user has completed forms
    3. POST requests to submit interest forms (NOT consent forms)
    
    Note: This function was modified to ONLY handle interest forms.
    Consent forms are rejected and should use a separate handler.
    """
    print(f"Event: {json.dumps(event)}")
    print(f"Context: {context}")
    print(f"HTTP Method: {event.get('httpMethod')}")
    print(f"Raw Path: {event.get('rawPath', '')}")
    print(f"Request Context HTTP Method: {event.get('requestContext', {}).get('http', {}).get('method')}")
    
    # Handle CORS preflight requests from browsers
    # These are sent automatically before actual requests to check permissions
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'body': ''
        }
    
    # Handle GET requests for checking form completion
    # Check both httpMethod and requestContext.http.method for Lambda Function URLs
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
    raw_path = event.get('rawPath', '')
    
    print(f"Processing request: Method={http_method}, Path={raw_path}")
    
    if http_method == 'GET' and '/check/' in raw_path:
        print(f"Routing to handle_get_request for path: {raw_path}")
        return handle_get_request(event)
    
    # Handle POST request to run matching algorithm (temporary solution)
    if http_method == 'POST' and raw_path == '/run-matching':
        return handle_run_matching(event)
    

    
    # All other requests are form submissions
    
    try:
        # Parse the JSON form data from the request body
        raw_body = event.get('body', '{}')
        print(f"Raw request body: {raw_body}")
        body = json.loads(raw_body)
        
        # Handle check requests sent as POST with action=check
        if body.get('action') == 'check' and body.get('userId'):
            print(f"Handling check request for user: {body.get('userId')}")
            return handle_check_via_post(body.get('userId'))
        

        
        # Skip processing if body is completely empty
        if not body:
            print("Skipping completely empty request body")
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'No form data provided'})
            }

        # Default user ID for testing (will be overridden by JWT token)
        user_id = 'test-user'
        
        # AUTHENTICATION: Extract user ID from Cognito authentication context
        user_id = get_authenticated_user_id(event)
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Unauthorized'})
            }

        # This function handles interest forms (student/senior forms)
        
        # Create the database item with user ID, timestamp, and all form data
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            **body  # Spread operator - includes all form fields
        }
        
        # Log what we're storing for debugging
        print(f"Raw body received: {json.dumps(body)}")
        print(f"Storing interest form: {json.dumps(item, default=str)}")
        
        # Save to DynamoDB interests table
        response = interests_table.put_item(Item=item)
        print(f"Stored in interests table: {response}")

        # Return success response with CORS headers
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Interest form submitted successfully'})
        }

    except Exception as e:
        # Log any errors and return 500 status
        print("Error:", str(e))
        return {
            'statusCode': 500,
            'body': json.dumps({'message': 'Error submitting form', 'error': str(e)})
        }

def handle_get_request(event):
    """Handle GET requests to check if a user has completed their forms.
    
    URL pattern: /check/{userId}
    
    Returns:
    - 200: User found with form completion status
    - 404: User not found in either table
    - 400: Invalid request format
    - 500: Server error
    """
    try:
        # Extract user ID from the URL path
        # Expected format: /check/81bb55e0-2041-70ce-cba1-d3954e14a09a
        path = event.get('rawPath', '')
        if '/check/' in path:
            user_id = path.split('/check/')[-1]  # Get everything after '/check/'
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'message': 'Invalid request'})
            }
        
        # Check both consent and interest tables to see what the user has completed
        # This allows the frontend to determine what forms still need to be filled out
        
        # Check consent forms table
        try:
            consent_response = consent_table.get_item(Key={'userId': user_id})
            has_consent = 'Item' in consent_response  # True if user has a consent form
        except Exception as e:
            print(f"Error checking consent table: {e}")
            has_consent = False
            
        # Check interest forms table
        try:
            interest_response = interests_table.get_item(Key={'userId': user_id})
            has_interest = 'Item' in interest_response  # True if user has an interest form
        except Exception as e:
            print(f"Error checking interests table: {e}")
            has_interest = False
        
        # Return form completion status
        # Frontend uses this to show appropriate notifications and redirect users
        if has_consent or has_interest:
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'exists': True,
                    'hasConsent': has_consent,    # Boolean: user completed consent form
                    'hasInterest': has_interest   # Boolean: user completed interest form
                })
            }
        else:
            # User hasn't completed any forms yet
            return {
                'statusCode': 404,
                'body': json.dumps({'exists': False})
            }
            
    except Exception as e:
        # Log error and return 500 status
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }



def handle_check_via_post(user_id):
    """Handle check requests sent via POST method"""
    try:
        # Check consent forms table
        try:
            consent_response = consent_table.get_item(Key={'userId': user_id})
            has_consent = 'Item' in consent_response
        except Exception as e:
            print(f"Error checking consent table: {e}")
            has_consent = False
            
        # Check interest forms table
        try:
            interest_response = interests_table.get_item(Key={'userId': user_id})
            has_interest = 'Item' in interest_response
        except Exception as e:
            print(f"Error checking interests table: {e}")
            has_interest = False
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'exists': has_consent or has_interest,
                'hasConsent': has_consent,
                'hasInterest': has_interest
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }





def handle_run_matching(event):
    """Handle POST requests to run the matching algorithm"""
    try:
        import boto3
        lambda_client = boto3.client('lambda')
        
        # Invoke the matching algorithm function
        response = lambda_client.invoke(
            FunctionName='matchingAlgorithm-dev',
            InvocationType='RequestResponse',
            Payload=json.dumps({})
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps({'message': 'Matching algorithm executed successfully'})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
