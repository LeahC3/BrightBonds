import json
import boto3
import datetime
import base64

# Initialize DynamoDB, Cognito, and SES clients
dynamodb = boto3.resource('dynamodb')
messages_table = dynamodb.Table('messages-dev')
matches_table = dynamodb.Table('dev-matches')
cognito_client = boto3.client('cognito-idp')
ses_client = boto3.client('ses', region_name='us-east-2')
ssm = boto3.client('ssm')

def is_admin_user(user_id):
    """Check if user is an admin by comparing email to admin list in Parameter Store"""
    try:
        # Get user's email from Cognito
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        user_email = None
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'email':
                user_email = attr['Value'].lower()
                break
        
        if not user_email:
            return False
        
        # Get admin emails from Parameter Store
        response = ssm.get_parameter(
            Name='/brightbonds/admin-emails',
            WithDecryption=True
        )
        admin_emails = {email.strip().lower() for email in response['Parameter']['Value'].split(',')}
        
        return user_email in admin_emails
        
    except Exception as e:
        print(f"Error checking admin status: {e}")
        return False

def handler(event, context):
    """Lambda function handler for messaging functionality."""
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
    
    http_method = event.get('httpMethod') or event.get('requestContext', {}).get('http', {}).get('method')
    
    # Extract user ID from Cognito authentication
    user_id = get_authenticated_user_id(event)
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Unauthorized'})
        }
    
    if http_method == 'GET':
        # Check if this is admin request for all conversations
        raw_path = event.get('rawPath', '') or event.get('path', '')
        if raw_path == '/messages/all' or '/messages/all' in raw_path:
            if not is_admin_user(user_id):
                return {
                    'statusCode': 403,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Admin access required'})
                }
            return get_all_messages(event, user_id)
        elif '/messages/unread' in raw_path:
            return check_unread_messages(event, user_id)
        else:
            return get_messages(event, user_id)
    elif http_method == 'POST':
        raw_path = event.get('rawPath', '') or event.get('path', '')
        if '/messages/report' in raw_path:
            return report_message(event, user_id)
        elif '/messages/unreport' in raw_path:
            return unreport_message(event, user_id)
        elif '/messages/markread' in raw_path:
            return mark_messages_read(event, user_id)
        else:
            return send_message(event, user_id)
    
    return {
        'statusCode': 404,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'message': 'Not found'})
    }

def get_authenticated_user_id(event):
    """Extract user ID from Cognito authentication context or JWT token"""
    try:
        # Try API Gateway authorizer context first
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        user_id = claims.get('sub') or claims.get('cognito:username')
        if user_id:
            return user_id
        
        # Fallback to manual JWT parsing
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

def get_messages(event, user_id):
    """Get message history for user's matches"""
    try:
        # Check pagination parameters
        query_params = event.get('queryStringParameters') or {}
        offset = int(query_params.get('offset', 0))
        limit = int(query_params.get('limit', 50))
        # Get user's matches first
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid)',
            ExpressionAttributeValues={':uid': user_id}
        )
        
        matches = matches_response['Items']
        conversations = []
        
        for match in matches:
            # Get the other user in the match
            other_user_id = match['seniorUserId'] if match['studentUserId'] == user_id else match['studentUserId']
            
            # Get messages for this conversation
            messages_response = messages_table.scan(
                FilterExpression='(senderId = :uid1 AND receiverId = :uid2) OR (senderId = :uid2 AND receiverId = :uid1)',
                ExpressionAttributeValues={
                    ':uid1': user_id,
                    ':uid2': other_user_id
                }
            )
            
            all_messages = sorted(messages_response['Items'], key=lambda x: x['timestamp'])
            total_messages = len(all_messages)
            
            # Calculate slice for pagination
            start_index = max(0, total_messages - limit - offset)
            end_index = total_messages - offset
            
            messages = all_messages[start_index:end_index] if start_index < end_index else []
            has_more = start_index > 0
            
            # Get other user's name from Cognito
            other_user_name = get_user_name(other_user_id)
            
            conversations.append({
                'matchId': match['matchId'],
                'otherUserId': other_user_id,
                'otherUserName': other_user_name,
                'messages': messages,
                'hasMore': has_more,
                'totalMessages': len(all_messages)
            })
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(conversations, default=str)
        }
        
    except Exception as e:
        print(f"Error getting messages: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def send_message(event, user_id):
    """Send a message to matched user"""
    try:
        body = json.loads(event.get('body', '{}'))
        receiver_id = body.get('receiverId')
        message_text = body.get('message')
        
        if not receiver_id or not message_text:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'receiverId and message are required'})
            }
        
        # Verify users are matched
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid1 AND seniorUserId = :uid2) OR (studentUserId = :uid2 AND seniorUserId = :uid1)',
            ExpressionAttributeValues={
                ':uid1': user_id,
                ':uid2': receiver_id
            }
        )
        
        if not matches_response['Items']:
            return {
                'statusCode': 403,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Users are not matched'})
            }
        
        # Create message
        message_id = f"{user_id}_{receiver_id}_{int(datetime.datetime.utcnow().timestamp() * 1000)}"
        message_item = {
            'messageId': message_id,
            'senderId': user_id,
            'receiverId': receiver_id,
            'message': message_text,
            'timestamp': datetime.datetime.utcnow().isoformat(),
            'read': False
        }
        
        messages_table.put_item(Item=message_item)
        
        # Send email notification to receiver
        print(f"Attempting to send email notification to {receiver_id}")
        try:
            send_email_notification(receiver_id, user_id, message_text)
            print(f"Email notification sent successfully")
        except Exception as e:
            print(f"Email notification failed: {e}")
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Message sent successfully'})
        }
        
    except Exception as e:
        print(f"Error sending message: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def get_all_messages(event, admin_user_id):
    """Get all conversations for admin monitoring"""
    try:
        # Check if we should load all messages
        query_params = event.get('queryStringParameters') or {}
        load_all = query_params.get('loadAll') == 'true'
        # Get all matches
        matches_response = matches_table.scan()
        matches = matches_response['Items']
        
        conversations = []
        processed_pairs = set()
        
        for match in matches:
            student_id = match['studentUserId']
            senior_id = match['seniorUserId']
            
            # Create a unique identifier for this pair to avoid duplicates
            pair_id = tuple(sorted([student_id, senior_id]))
            if pair_id in processed_pairs:
                continue
            processed_pairs.add(pair_id)
            
            # Get messages for this conversation
            messages_response = messages_table.scan(
                FilterExpression='(senderId = :uid1 AND receiverId = :uid2) OR (senderId = :uid2 AND receiverId = :uid1)',
                ExpressionAttributeValues={
                    ':uid1': student_id,
                    ':uid2': senior_id
                }
            )
            
            all_messages = sorted(messages_response['Items'], key=lambda x: x['timestamp'])
            # Load only last 50 messages initially unless loadAll is requested
            if load_all:
                messages = all_messages
                has_more = False
            else:
                messages = all_messages[-50:] if len(all_messages) > 50 else all_messages
                has_more = len(all_messages) > 50
            
            # Get both users' names
            student_name = get_full_user_name(student_id)
            senior_name = get_full_user_name(senior_id)
            
            conversations.append({
                'matchId': match['matchId'],
                'otherUserId': f"{student_id}_{senior_id}",  # Combined ID for admin view
                'otherUserName': f"{student_name} ↔ {senior_name}",  # Show both names
                'messages': messages,
                'studentId': student_id,
                'seniorId': senior_id,
                'studentName': student_name,
                'seniorName': senior_name,
                'hasMore': has_more,
                'totalMessages': len(all_messages)
            })
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(conversations, default=str)
        }
        
    except Exception as e:
        print(f"Error getting all messages: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def get_full_user_name(user_id):
    """Get user's full name from Cognito"""
    try:
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        given_name = 'Unknown'
        family_name = ''
        
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'given_name':
                given_name = attr['Value']
            elif attr['Name'] == 'family_name':
                family_name = attr['Value']
        
        return f"{given_name} {family_name}".strip()
    except Exception as e:
        print(f"Error getting user name: {e}")
        return 'Unknown'

def report_message(event, reporter_id):
    """Report a message as inappropriate"""
    try:
        body = json.loads(event.get('body', '{}'))
        message_id = body.get('messageId')
        
        if not message_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'messageId is required'})
            }
        
        # Update the message to mark it as reported
        messages_table.update_item(
            Key={'messageId': message_id},
            UpdateExpression='SET reported = :reported, reporterId = :reporterId, reportedAt = :reportedAt',
            ExpressionAttributeValues={
                ':reported': True,
                ':reporterId': reporter_id,
                ':reportedAt': datetime.datetime.utcnow().isoformat()
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Message reported successfully'})
        }
        
    except Exception as e:
        print(f"Error reporting message: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def unreport_message(event, user_id):
    """Remove report from a message"""
    try:
        body = json.loads(event.get('body', '{}'))
        message_id = body.get('messageId')
        
        if not message_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'messageId is required'})
            }
        
        # Update the message to remove the report
        messages_table.update_item(
            Key={'messageId': message_id},
            UpdateExpression='REMOVE reported, reporterId, reportedAt'
        )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': 'Report removed successfully'})
        }
        
    except Exception as e:
        print(f"Error removing report: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def get_user_name(user_id):
    """Get user's first name from Cognito"""
    try:
        user_response = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=user_id
        )
        
        for attr in user_response.get('UserAttributes', []):
            if attr['Name'] == 'given_name':
                return attr['Value']
        
        return 'Unknown'
    except Exception as e:
        print(f"Error getting user name: {e}")
        return 'Unknown'

def check_unread_messages(event, user_id):
    """Check if user has unread messages"""
    try:
        # Get user's matches
        matches_response = matches_table.scan(
            FilterExpression='(studentUserId = :uid OR seniorUserId = :uid)',
            ExpressionAttributeValues={':uid': user_id}
        )
        
        unread_count = 0
        
        for match in matches_response['Items']:
            other_user_id = match['seniorUserId'] if match['studentUserId'] == user_id else match['studentUserId']
            
            # Count unread messages from other user
            messages_response = messages_table.scan(
                FilterExpression='senderId = :sender AND receiverId = :receiver AND (#r = :false OR attribute_not_exists(#r))',
                ExpressionAttributeNames={'#r': 'read'},
                ExpressionAttributeValues={
                    ':sender': other_user_id,
                    ':receiver': user_id,
                    ':false': False
                }
            )
            
            unread_count += len(messages_response['Items'])
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'unreadCount': unread_count})
        }
        
    except Exception as e:
        print(f"Error checking unread messages: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def mark_messages_read(event, user_id):
    """Mark messages as read when user views conversation"""
    try:
        body = json.loads(event.get('body', '{}'))
        other_user_id = body.get('otherUserId')
        
        if not other_user_id:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'otherUserId is required'})
            }
        
        # Get all unread messages from other user to current user
        messages_response = messages_table.scan(
            FilterExpression='senderId = :sender AND receiverId = :receiver AND (#r = :false OR attribute_not_exists(#r))',
            ExpressionAttributeNames={'#r': 'read'},
            ExpressionAttributeValues={
                ':sender': other_user_id,
                ':receiver': user_id,
                ':false': False
            }
        )
        
        # Mark each message as read
        for message in messages_response['Items']:
            messages_table.update_item(
                Key={'messageId': message['messageId']},
                UpdateExpression='SET #r = :true',
                ExpressionAttributeNames={'#r': 'read'},
                ExpressionAttributeValues={':true': True}
            )
        
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'message': f'Marked {len(messages_response["Items"])} messages as read'})
        }
        
    except Exception as e:
        print(f"Error marking messages as read: {e}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def send_email_notification(receiver_id, sender_id, message_text):
    """Send email notification for new message"""
    try:
        print(f"Attempting to send email notification to {receiver_id}")
        
        # Get receiver's email and notification preferences
        receiver_info = cognito_client.admin_get_user(
            UserPoolId='us-east-2_AxTL9MRLy',
            Username=receiver_id
        )
        
        receiver_email = None
        receiver_name = 'User'
        email_notifications = True
        
        for attr in receiver_info.get('UserAttributes', []):
            if attr['Name'] == 'email':
                receiver_email = attr['Value']
            elif attr['Name'] == 'given_name':
                receiver_name = attr['Value']
            elif attr['Name'] == 'custom:email_notifications':
                email_notifications = attr['Value'] == '1'
        
        if not receiver_email:
            print(f"No email address found for user {receiver_id}")
            return
            
        if not email_notifications:
            print(f"Email notifications disabled for user {receiver_id}")
            return
        
        # Get sender's name
        sender_name = get_user_name(sender_id)
        
        # Send email
        ses_client.send_email(
            Source='noreply@brightbonds.org',
            Destination={'ToAddresses': [receiver_email]},
            Message={
                'Subject': {'Data': 'New Message on BrightBonds'},
                'Body': {
                    'Text': {
                        'Data': f'Hi {receiver_name},\n\nYou have a new message from {sender_name} on BrightBonds:\n\n"{message_text[:100]}..."\n\nLog in to view and reply: https://brightbonds.org/messages\n\nBest regards,\nThe BrightBonds Team'
                    }
                }
            }
        )
        print(f"Email notification sent successfully to {receiver_email}")
        
    except Exception as e:
        print(f"Error sending email notification: {e}")
        # Don't re-raise the exception to avoid breaking message sending