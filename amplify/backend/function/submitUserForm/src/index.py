import json
import boto3
import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('UserProfiles')

def lambda_handler(event, context):
    try:
        # Parse form data from request body
        body = json.loads(event.get('body', '{}'))

        # Get Cognito User ID (from the authorizer claims)
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("claims", {}).get("sub")
        if not user_id:
            return {
                'statusCode': 401,
                'body': json.dumps({'message': 'Unauthorized – no user ID found'})
            }

        # Compose item
        item = {
            'userId': user_id,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            'formData': body  # store entire form as JSON
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
            'body': json.dumps({'message': 'Internal server error', 'error': str(e)})
        }
