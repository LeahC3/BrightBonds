import json
from datetime import datetime

# Valid senior access codes - store these securely
VALID_SENIOR_CODES = {
    'SENIOR',  # Example codes - replace with your actual codes
    'ACCESS',
    'BRIGHT',
    'BONDS1',
    'CARE01'
}

def handler(event, context):
    print('Pre Sign-up trigger received:', json.dumps(event))
    
    # Get user attributes
    user_attributes = event['request']['userAttributes']
    birthdate = user_attributes.get('birthdate')
    senior_code = user_attributes.get('address', '')
    
    # Check if user is a senior (born before 1995)
    if birthdate:
        birth_year = datetime.fromisoformat(birthdate).year
        if birth_year < 1995:
            # Senior user - validate access code
            if not senior_code or senior_code.upper() not in VALID_SENIOR_CODES:
                raise Exception('Invalid senior access code')
    
    # Allow signup to proceed
    return event