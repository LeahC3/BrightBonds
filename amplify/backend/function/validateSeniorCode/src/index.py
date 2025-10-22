import json
import boto3
from datetime import datetime

ssm = boto3.client('ssm')
cognito_client = boto3.client('cognito-idp')

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

def get_valid_codes():
    """Retrieve valid senior codes from Parameter Store"""
    try:
        response = ssm.get_parameter(
            Name='/brightbonds/senior-access-codes',
            WithDecryption=True
        )
        # Codes stored as comma-separated string
        codes = response['Parameter']['Value'].split(',')
        return {code.strip().upper() for code in codes}
    except Exception as e:
        print(f"Error retrieving codes: {e}")
        # Fallback codes (remove in production)
        # return {'SENIOR', 'ACCESS', 'BRIGHT'}

def handler(event, context):
    print('Pre Sign-up trigger received')
    
    # Get user attributes
    user_attributes = event['request']['userAttributes']
    birthdate = user_attributes.get('birthdate')
    senior_code = user_attributes.get('address', '')
    
    # Check if user is a senior (born before 1995)
    if birthdate:
        birth_year = datetime.fromisoformat(birthdate).year
        if birth_year < 1995:
            # Senior user - validate access code
            valid_codes = get_valid_codes()
            if not senior_code or senior_code.upper() not in valid_codes:
                raise Exception('Invalid senior access code')
    
    # Allow signup to proceed
    return event