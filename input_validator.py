import re
import json
from typing import Any, Dict, List

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_user_id(user_id: str) -> bool:
    """Validate AWS Cognito user ID format"""
    pattern = r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    return bool(re.match(pattern, user_id))

def sanitize_string(value: str, max_length: int = 500) -> str:
    """Sanitize string input"""
    if not isinstance(value, str):
        return ""
    
    # Remove null bytes and control characters
    value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)
    
    # Limit length
    return value[:max_length].strip()

def validate_message_content(message: str) -> bool:
    """Validate message content"""
    if not message or len(message.strip()) == 0:
        return False
    
    if len(message) > 500:
        return False
    
    # Check for suspicious patterns
    suspicious_patterns = [
        r'<script',
        r'javascript:',
        r'on\w+\s*=',
        r'data:text/html'
    ]
    
    for pattern in suspicious_patterns:
        if re.search(pattern, message, re.IGNORECASE):
            return False
    
    return True

def validate_form_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate and sanitize form data"""
    validated = {}
    
    for key, value in data.items():
        if isinstance(value, str):
            validated[key] = sanitize_string(value)
        elif isinstance(value, (int, float, bool)):
            validated[key] = value
        elif isinstance(value, list):
            validated[key] = [sanitize_string(str(item)) for item in value]
    
    return validated