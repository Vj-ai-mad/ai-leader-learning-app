# AI Learning App for Delivery Leaders

Personalized AI-literacy learning PWA for Program Managers, Delivery Managers,
Platform Leads, and Release Train Engineers. Tester phase: 15-25 invited users.

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- AWS CLI configured with ap-south-1 credentials
- AWS CDK CLI: npm install -g aws-cdk

### Frontend

    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

### Backend (CDK Deploy)

    cd backend
    npm install
    cdk bootstrap   # first time only
    cdk deploy --all

After deploy, copy the outputs (UserPoolId, UserPoolClientId, API endpoint)
into frontend/.env.local.

### Environment Variables

See frontend/.env.example for required values.

## Project Structure

    frontend/       React 18 PWA (Vite + Tailwind + Amplify JS)
    backend/        AWS CDK stacks + Lambda functions
    requirements.md What to build
    design.md       How to build it (architecture, schemas, API)
    tasks.md        Step-by-step implementation checklist (106 tasks)

## Tech Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand, Amplify JS v6
- Backend: AWS Lambda (Node.js 20), API Gateway HTTP API, DynamoDB, Cognito
- AI: Amazon Bedrock (Claude 3 Haiku)
- Notifications: Meta WhatsApp Cloud API
- Hosting: AWS Amplify Hosting (CloudFront)
- IaC: AWS CDK v2

## AWS Region

Primary: ap-south-1 (Mumbai). Bedrock: us-east-1 (or whichever has Claude access).
