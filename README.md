# Helm. — AI Learning App for Delivery Leaders

Personalized AI-literacy learning PWA for Program Managers, Delivery Managers,
Platform Leads, and Release Train Engineers. Tester phase: 15-25 invited users.

## Current Status (July 2026)

**App URL:** https://staging.d2kbjleppi9cxx.amplifyapp.com (pending Git deploy fix)
**Local dev:** http://localhost:5173

### What's Working
- Sign-up with allow-list check
- Sign-in with password (OTP deferred — Cognito email delivery unreliable in ap-south-1)
- 4-step onboarding wizard (role, responsibilities, goals, schedule)
- Plan generation (46 modules, deterministic sequencing — zero Bedrock cost)
- Daily module delivery with AI-generated content (Stage 1 complete, Stages 2-5 pending)
- Mark as Done with streak tracking
- Progress roadmap with stage-specific colors and expandable module lists
- Weekly recap screen
- Profile with pause/resume and notification opt-out
- Admin interface (content library + allow-list management)
- Post-onboarding topic request (Bedrock-dependent — pending payment fix)
- PWA manifest and service worker for offline support
- Bottom navigation bar with Helm branding

### Known Issues / Blockers
- **Bedrock API access:** INVALID_PAYMENT_INSTRUMENT error. RBI regulation requires
  pay-per-use contact setup for international card transactions on AWS Marketplace.
  Playground works but CLI/SDK/Lambda calls fail. Impacts: content generation for
  Stages 2-5, topic request feature, personalized plan ordering.
- **Amplify Hosting:** Git-based deploy configured but static asset MIME types
  not resolving correctly. S3 hosting works as fallback.
- **Content:** 9/46 modules have full AI-generated lessons (Stage 1). Remaining 37
  have placeholder text pending Bedrock access resolution.

### Next Steps
1. Resolve Bedrock payment (RBI pay-per-use setup with bank)
2. Generate remaining 37 module lessons
3. Complete Amplify Git-based deployment
4. Invite 10 testers
5. Set up WhatsApp notifications (Meta Business account)
6. 3-panel responsive desktop layout

## Quick Start

### Prerequisites
- Node.js 22+
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
    cdk deploy --all --require-approval never

### Environment Variables
See frontend/.env.example for required values after CDK deploy.

## Project Structure
    frontend/       React 18 PWA (Vite + Tailwind + Amplify JS)
    backend/        AWS CDK stacks + Lambda functions (Node.js 22)
    requirements.md What to build
    design.md       How to build it (architecture, schemas, API)
    tasks.md        Step-by-step implementation checklist (106 tasks)

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Zustand, Amplify JS v6
- Backend: AWS Lambda (Node.js 22), API Gateway HTTP API, DynamoDB, Cognito
- AI: Amazon Bedrock (Claude Haiku 4.5) — pending payment resolution
- Notifications: Meta WhatsApp Cloud API (pending setup)
- Hosting: AWS Amplify Hosting (HTTPS + CloudFront CDN)
- IaC: AWS CDK v2

## AWS Region
Primary: ap-south-1 (Mumbai). Bedrock: us-east-1.

## Deployed Infrastructure
- Cognito User Pool: ap-south-1_qBgP9WmPn
- API Gateway: https://gkeekgdutk.execute-api.ap-south-1.amazonaws.com
- DynamoDB: 5 tables (users, plans, content, allowlist, deeplink-tokens)
- Lambda: 12 functions (Node.js 22, esbuild bundled)
- EventBridge: Daily + weekly notification schedules
- Amplify Hosting: d2kbjleppi9cxx.amplifyapp.com
