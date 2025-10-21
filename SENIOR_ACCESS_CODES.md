# Senior Access Code Management

## Overview
Senior users (born before 1995) require a valid access code during signup. Codes are stored securely in AWS Systems Manager Parameter Store.

## Current Implementation
- **Location**: `amplify/backend/function/validateSeniorCode/src/index.py`
- **Storage**: AWS Systems Manager Parameter Store
- **Parameter Name**: `/brightbonds/senior-access-codes`
- **Format**: Comma-separated string (e.g., "CODE1,CODE2,CODE3")

## Managing Access Codes

### View Current Codes
```bash
aws ssm get-parameter --name "/brightbonds/senior-access-codes" --with-decryption
```

### Update Codes
```bash
aws ssm put-parameter --name "/brightbonds/senior-access-codes" --value "NEWCODE1,NEWCODE2,FACILITY1" --type "SecureString" --overwrite
```

### Add New Code
1. Get current codes
2. Add new code to the list
3. Update parameter with complete list

## Security Features
- **Encrypted storage** using AWS KMS
- **IAM access control** - only Lambda can read
- **Audit trail** - all changes logged in CloudTrail
- **No source code exposure** - codes not in Git

## Validation Rules
- Codes are case-insensitive
- Must be exactly 6 characters
- Required only for users born before 1995
- Validated during Cognito PreSignUp trigger

## Deployment
After code changes, run:
```bash
amplify push
```

## Troubleshooting
- Check CloudWatch logs for validation errors
- Verify Parameter Store permissions in IAM
- Ensure parameter exists in correct AWS region