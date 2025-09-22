# BrightBonds

A web platform connecting high school volunteers with seniors through shared interests and meaningful interactions.

## Overview

BrightBonds facilitates intergenerational connections by matching teenagers with seniors based on common hobbies and interests. The platform enables regular visits and messaging between matched pairs, fostering meaningful relationships across age groups.

## How It Works

1. **Senior Profiles**: Seniors create profiles highlighting their hobbies, interests, and preferred ways to connect
2. **Teen Volunteers**: High school students create similar interest-based profiles
3. **Smart Matching**: An algorithm matches teens and seniors based on shared interests from their profile responses
4. **Connection**: Matched pairs engage through regular visits and messaging

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (vanilla)
- **Backend**: AWS Lambda functions
- **Authentication**: AWS Cognito
- **Database**: DynamoDB
- **Infrastructure**: AWS Amplify

## Current Status

✅ **Completed**
- User authentication system
- Complete frontend interface with responsive design
- Consent form system (`submitConsentForm`)
- Interest form submission (`submitUserForm-dev`)
- Maximum Weight Bipartite Matching algorithm (`matchingTrigger`)
- Matches display page with working navbar
- AWS Amplify deployment

🚧 **In Development**
- Message storage and retrieval
- Real-time messaging interface

## Development

This project is deployed using AWS Amplify but not yet released to end users.