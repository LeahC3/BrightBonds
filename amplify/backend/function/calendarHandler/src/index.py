import json
import boto3
import base64
import datetime

dynamodb = boto3.resource('dynamodb')
meeting_slots_table = dynamodb.Table('meetingSlots-dev')
user_availability_table = dynamodb.Table('userAvailability-dev')
matches_table = dynamodb.Table('dev-matches')
cognito_client = boto3.client('cognito-idp')
ssm = boto3.client('ssm')
USER_POOL_ID = 'us-east-2_AxTL9MRLy'

def is_admin_user(user_id):
    try:
        user_response = cognito_client.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        
        user_email = None
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'email':
                user_email = attr['Value'].lower()
                break
        
        if not user_email:
            return False
        
        response = ssm.get_parameter(
            Name='/brightbonds/admin-emails',
            WithDecryption=True
        )
        admin_emails = {email.strip().lower() for email in response['Parameter']['Value'].split(',')}
        
        return user_email in admin_emails
        
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False

def get_authenticated_user_id(event):
    try:
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        user_id = claims.get('sub') or claims.get('cognito:username')
        if user_id:
            return user_id
        
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

def handler(event, context):
    print(f"Event: {json.dumps(event)}")
    
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
            },
            'body': ''
        }
    
    user_id = get_authenticated_user_id(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Unauthorized'})
        }
    
    http_method = event.get('httpMethod')
    raw_path = event.get('rawPath', '') or event.get('path', '')
    
    if '/calendar/slots' in raw_path:
        if http_method == 'GET':
            return get_meeting_slots(user_id)
        elif http_method == 'POST':
            if not is_admin_user(user_id):
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
            return create_meeting_slot(event)
        elif http_method == 'DELETE':
            if not is_admin_user(user_id):
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
            return delete_meeting_slot(event)
    
    elif '/calendar/availability' in raw_path:
        if http_method == 'GET':
            # Check if admin is requesting all availability
            if '/calendar/availability/all' in raw_path:
                if not is_admin_user(user_id):
                    return {
                        'statusCode': 403,
                        'headers': {'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Admin access required'})
                    }
                return get_all_availability()
            else:
                return get_availability(user_id)
        elif http_method == 'POST':
            return set_availability(event, user_id)
    
    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Not found'})
    }

def get_meeting_slots(user_id):
    try:
        response = meeting_slots_table.scan()
        slots = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(slots, default=str)
        }
    except Exception as e:
        print(f"Error getting meeting slots: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def create_meeting_slot(event):
    try:
        body = json.loads(event.get('body', '{}'))
        date = body.get('date')
        
        if not date:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'date is required'})
            }
        
        slot_id = f"slot_{date}_{int(datetime.datetime.utcnow().timestamp() * 1000)}"
        
        meeting_slots_table.put_item(Item={
            'slotId': slot_id,
            'date': date,
            'createdAt': datetime.datetime.utcnow().isoformat()
        })
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Meeting slot created', 'slotId': slot_id})
        }
    except Exception as e:
        print(f"Error creating meeting slot: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def delete_meeting_slot(event):
    try:
        body = json.loads(event.get('body', '{}'))
        slot_id = body.get('slotId')
        
        if not slot_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'slotId is required'})
            }
        
        meeting_slots_table.delete_item(Key={'slotId': slot_id})
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Meeting slot deleted'})
        }
    except Exception as e:
        print(f"Error deleting meeting slot: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def get_availability(user_id):
    try:
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid)',
            ExpressionAttributeValues={':uid': user_id}
        )
        
        matches = matches_response.get('Items', [])
        if not matches:
            return {
                'statusCode': 200,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'userAvailability': [], 'partnerAvailability': []})
            }
        
        partner_id = None
        for match in matches:
            partner_id = match['seniorUserId'] if match['studentUserId'] == user_id else match['studentUserId']
            break
        
        user_response = user_availability_table.scan(
            FilterExpression='userId = :uid',
            ExpressionAttributeValues={':uid': user_id}
        )
        user_availability = [item['date'] for item in user_response.get('Items', [])]
        
        partner_availability = []
        if partner_id:
            partner_response = user_availability_table.scan(
                FilterExpression='userId = :uid',
                ExpressionAttributeValues={':uid': partner_id}
            )
            partner_availability = [item['date'] for item in partner_response.get('Items', [])]
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'userAvailability': user_availability,
                'partnerAvailability': partner_availability
            })
        }
    except Exception as e:
        print(f"Error getting availability: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def set_availability(event, user_id):
    try:
        body = json.loads(event.get('body', '{}'))
        date = body.get('date')
        available = body.get('available', False)
        
        if not date:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'date is required'})
            }
        
        slots_response = meeting_slots_table.scan(
            FilterExpression='#d = :date',
            ExpressionAttributeNames={'#d': 'date'},
            ExpressionAttributeValues={':date': date}
        )
        
        if not slots_response.get('Items'):
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'No meeting slot exists for this date'})
            }
        
        availability_id = f"{user_id}_{date}"
        
        if available:
            user_availability_table.put_item(Item={
                'availabilityId': availability_id,
                'userId': user_id,
                'date': date,
                'createdAt': datetime.datetime.utcnow().isoformat()
            })
        else:
            user_availability_table.delete_item(Key={'availabilityId': availability_id})
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Availability updated'})
        }
    except Exception as e:
        print(f"Error setting availability: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }