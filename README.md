# BrightBonds

A web platform connecting high school volunteers with seniors through shared interests and meaningful interactions.

## Overview

BrightBonds facilitates intergenerational connections by matching teenagers with seniors based on common hobbies and interests. The platform enables regular visits and messaging between matched pairs, fostering meaningful relationships across age groups.

## How It Works

1. **Registration**: Users sign up with AWS Cognito authentication
   - Students: Complete interest forms (and consent forms if under 18)
   - Seniors: Require valid access code and complete interest forms

2. **Matching**: Admin-triggered algorithm creates optimal pairings
   - Compatibility scoring based on shared interests and preferences
   - Location and availability compatibility checks
   - Maximum weight bipartite matching for optimal results

3. **Communication**: Matched pairs connect through secure messaging
   - Real-time message updates with email notifications
   - Message reporting and monitoring system
   - Admin oversight for safety and compliance

4. **Resources**: Comprehensive support materials
   - Volunteer handbook with guidelines and best practices
   - Activity library with conversation starters and engagement ideas
   - Downloadable PDF resources for offline access

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: AWS Lambda functions
- **Authentication**: AWS Cognito
- **Database**: DynamoDB
- **Infrastructure**: AWS Amplify

## Current Status

✅ **Completed**
- User authentication system with AWS Cognito
- Complete frontend interface with responsive design
- Mobile-optimized navigation with Safari compatibility
- Consent form system (`submitConsentForm`)
- Interest form submission (`submitUserForm`)
- Maximum Weight Bipartite Matching algorithm (`matchingTrigger`)
- Match retrieval with user names (`getMatches` via API Gateway)
- Complete messaging system with real-time updates
- Message reporting and monitoring capabilities
- Resources page with volunteer handbook and activity library
- Password reset functionality
- Form validation and success messaging
- Secure admin authentication system
- Settings page with user preferences
- AWS Amplify deployment

✅ **Security Features**
- JWT token authentication for all protected endpoints
- Admin access control via AWS Parameter Store
- Senior access code validation during signup
- Message monitoring and reporting system
- CORS-compliant API with proper authentication handling

## Access Code Management

### Senior Access Codes
Senior users (born before 1995) require a 6-letter access code during signup. Codes are stored securely in AWS Parameter Store.

**Update Senior Codes**:
```bash
aws ssm put-parameter --name "/brightbonds/senior-access-codes" --value "CODE1,CODE2,CODE3" --type "SecureString" --overwrite
```

### Admin Email Management
Admin users are identified by email addresses stored in AWS Parameter Store. Admins can access the matching algorithm, monitor messages, and view all user matches.

**Update Admin Emails**:
```bash
aws ssm put-parameter --name "/brightbonds/admin-emails" --value "admin1@example.com,admin2@example.com" --type "SecureString" --overwrite
```

## Architecture

### Frontend
- **Pages**: Home, Matches, Messages, Resources, Settings
- **Authentication**: AWS Cognito with form validation
- **Mobile Support**: Responsive design with Safari safe area handling
- **Real-time Features**: Auto-refreshing messages every 5 seconds

### Backend
- **API Gateway**: REST API with CORS support
- **Lambda Functions**: 
  - `getMatches`: Retrieve user matches with Cognito name lookup
  - `messageHandler`: Complete messaging system with email notifications
  - `matchingTrigger`: Admin-only matching algorithm execution
  - `submitUserForm`: Interest form processing with authentication
  - `submitConsentForm`: Parental consent form handling
  - `userSettings`: User preference management
  - `validateSeniorCode`: Pre-signup senior code validation
- **Database**: DynamoDB tables for matches, messages, user interests, and consent forms
- **Security**: Parameter Store for access codes and admin emails

### Authentication Flow
1. User signs up with AWS Cognito
2. Seniors require valid access code validation
3. JWT tokens authenticate all API requests
4. Admin status verified server-side via email lookup

## Development Status

This project is fully functional and deployed using AWS Amplify. All core features are complete and secure.