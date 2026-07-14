# Design: Helm. — AI Learning App for Delivery Leaders (Tester Phase)

**Owner:** Vijayakumar J
**Version:** 0.3 (Updated July 2026 — reflects fully deployed state)
**Date:** July 2026
**Derives from:** requirements.md v0.4

---

## 1. Architecture Overview

Serverless PWA. All AWS resources in ap-south-1 (Mumbai).
AI content generation uses Anthropic API directly (not AWS Bedrock) due to
AWS Marketplace/AISPL payment restrictions in India.

    CLIENT (React PWA - Amplify Hosting / CloudFront)
    Service Worker | IndexedDB | Web App Manifest
           |
           | HTTPS + Cognito JWT
           v
    API GATEWAY HTTP API (ap-south-1)
    Cognito JWT Authorizer on all protected routes
      |          |           |              |
    Auth L    Plan L     Module L    Notification Scheduler L
      |          |           |              |
    DynamoDB (ap-south-1)            Anthropic API (external)
    Users | Plans | Content          Claude claude-haiku-4-5-20251001
    AllowList | DeepLinkTokens
                                     AWS Secrets Manager
                                     (Anthropic API key + WhatsApp token)

Key design decisions:
- All compute is Lambda (Node.js 22) — zero idle cost
- API Gateway HTTP API (not REST API) — lower per-request cost
- DynamoDB on-demand mode — no provisioned capacity charges
- Amplify Hosting — CDN-backed, HTTPS, Git-based CI/CD from GitHub
- Anthropic API called at plan generation and topic request only
- Anthropic API key stored in AWS Secrets Manager (`anthropic/api-key`)
- Password-based auth (not OTP) — Cognito email delivery unreliable in ap-south-1
- WhatsApp: EventBridge Scheduler -> Lambda -> Meta Graph API (not yet active)

---

## 2. Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast builds; Amplify JS v6 support |
| PWA tooling | vite-plugin-pwa + Workbox | Generates SW and manifest; handles caching |
| Styling | Tailwind CSS + Headless UI | No heavy component library at tester scale |
| State | Zustand | Lightweight; no Redux boilerplate |
| AWS client | AWS Amplify JS v6 | First-class Cognito + API GW; auto token refresh |
| Offline queue | idb (IndexedDB wrapper) | Queues Mark-as-Done when offline |
| Backend runtime | Node.js 22 on Lambda | Fast cold starts; native fetch built-in |
| IaC | AWS CDK v2 (TypeScript) | Type-safe infra co-located with app code |
| Auth | Amazon Cognito User Pool | Password-based auth with email sign-in |
| Database | DynamoDB on-demand | Zero idle cost; free tier covers tester scale |
| AI | Anthropic API — claude-haiku-4-5-20251001 | Direct HTTP; cheapest model; Bedrock blocked by AISPL payment restriction |
| Notifications | Meta WhatsApp Cloud API v19+ | Direct; no BSP subscription fees (not yet active) |
| Hosting | AWS Amplify Hosting (Git-based) | CloudFront CDN + HTTPS + Git CI/CD from GitHub |
| Secrets | AWS Secrets Manager | Anthropic API key + WhatsApp token at Lambda runtime |
| Scheduling | Amazon EventBridge Scheduler | Cron-triggered Lambdas for notifications |
| Logging | CloudWatch Logs (structured JSON) | All Lambda stdout |

---

## 3. Deployed Infrastructure

### 3.1 Live URLs and Resources

| Resource | Value |
|---|---|
| App URL | https://master.d1domee0zrh3fl.amplifyapp.com |
| API Endpoint | https://gkeekgdutk.execute-api.ap-south-1.amazonaws.com |
| GitHub Repo | https://github.com/Vj-ai-mad/ai-leader-learning-app |
| Cognito User Pool | ap-south-1_qBgP9WmPn |
| Cognito Client ID | 6hko3pfkpj2kn8069kkmr5n0l8 |
| Region | ap-south-1 (Mumbai) |
| Amplify Branch | master (auto-deploy on push) |

### 3.2 DynamoDB Tables

| Table | Key |
|---|---|
| ai-leader-users | PK: userId |
| ai-leader-plans | PK: planId |
| ai-leader-content | PK: contentId |
| ai-leader-allowlist | PK: email |
| ai-leader-deeplink-tokens | PK: token |

### 3.3 Lambda Functions (12 total)

All Node.js 22, bundled with esbuild via CDK NodejsFunction.

---

## 4. Repository Structure

    ai-leader-learning-app/
    frontend/
      public/icons/               PWA icons 192px 512px maskable
      src/
        App.tsx                   Router root + auth gate
        components/
          auth/                   SignIn SignUp (password-based)
          onboarding/             Multi-step onboarding form + PlanGenerating
          home/                   TodayModule StreakBadge HomeScreen
          module/                 ModuleScreen MarkDoneButton
          roadmap/                RoadmapView StageCard ModuleRow
          recap/                  WeeklyRecap
          profile/                ProfileScreen PauseToggle NotifOptOut
          admin/                  AdminScreen ContentTable AllowListTable
          topic/                  TopicRequestForm
        hooks/                    useAuth usePlan useModule useProgress
        store/                    Zustand slices auth plan progress ui
        api/                      Typed API call wrappers
        offline/
          db.ts                   idb schema
          sync.ts                 Flush queue on reconnect
      postcss.config.cjs          PostCSS config (CommonJS for Amplify compat)
      tailwind.config.cjs         Tailwind config (CommonJS for Amplify compat)
    backend/
      cdk/stacks/
        AuthStack.ts
        DatabaseStack.ts
        ApiStack.ts
        NotificationStack.ts
        HostingStack.ts
      functions/
        auth/preSignUp.ts         Cognito Pre Sign-up trigger (AllowList check)
        auth/checkAllowList.ts    Frontend pre-check endpoint
        auth/deepLinkExchange.ts  Token exchange for WhatsApp deep links
        onboarding/submitOnboarding.ts
        plan/generatePlan.ts      Anthropic-powered plan generation
        plan/requestTopic.ts      User topic request (max 5, Anthropic splits)
        module/getModule.ts
        module/completeModule.ts
        progress/getProgress.ts
        progress/setPauseState.ts
        notifications/sendDaily.ts
        notifications/sendWeeklyRecap.ts
        admin/upsertContent.ts
        admin/generateSummary.ts
        admin/updateAllowList.ts
        shared/dynamodb.ts        Singleton DynamoDB DocumentClient
        shared/anthropic.ts       Anthropic API client (Secrets Manager key)
        shared/bedrock.ts         Legacy — not used in production
        shared/whatsapp.ts        Meta Graph API client
        shared/token.ts           Deep-link token utilities
    scripts/
      create-test-users.ps1       Batch create Cognito + AllowList users
      reset-user.ps1              Reset specific user(s) for E2E re-testing

---

## 5. Content Library — 55 Modules

The content library contains **55 seeded modules**:
- **46 generic modules** (applicable to all roles, across all 5 stages)
- **9 role-specific modules** (3 each for Test Manager, DevOps Engineer, SRE)

### 5.1 Plan Generation Logic

Every user's plan includes **ALL 46 generic modules** — nothing is dropped or
replaced. Role-specific modules are **additional** days appended on top of the
generic baseline. A Test Manager gets 46 + 3 = 49 days; a generic role gets 46.

Anthropic personalizes the **ordering** of generic modules based on role,
responsibilities, and career goal. If Anthropic fails, a deterministic
stage-sequential fallback is used.

### 5.2 Five Learning Stages

| # | Stage Name | Generic Modules | 
|---|---|---|
| 1 | AI Literacy Foundations | mod-01 to mod-09 |
| 2 | AI in Delivery & Program Management | mod-10 to mod-18 |
| 3 | Leading AI-enabled Initiatives | mod-19 to mod-27 |
| 4 | Governance, Risk & Responsible AI | mod-28 to mod-36 |
| 5 | Becoming the AI-fluent Leader | mod-37 to mod-46 |

### 5.3 Role-Specific Modules

| Role | Module IDs |
|---|---|
| Test Manager / QA Manager | mod-47, mod-48, mod-49 |
| DevOps Engineer | mod-50, mod-51, mod-52 |
| SRE | mod-53, mod-54, mod-55 |

---

## 6. Supported Roles (10 + Other)

| Role |
|---|
| Program Manager |
| Delivery Manager |
| Platform Lead |
| RTE / RTM (Release Train Engineer/Manager) |
| Production Manager |
| Test Manager / QA Manager |
| SDM (Service Delivery Manager) |
| DevOps Engineer |
| SRE (Site Reliability Engineer) |
| Other (please specify) |

When "Other" is selected, a free-text field captures the custom role title.
The custom role is used in the Anthropic prompt for personalization.

---

## 7. Data Model (DynamoDB)

Five tables. All on-demand billing. AWS-managed encryption at rest.

### 7.1 Table: Users

**Primary key:** `userId` (String) — Cognito `sub`

| Attribute | Type | Description |
|---|---|---|
| userId | String (PK) | Cognito sub UUID |
| email | String | Verified email address |
| role | String | One of the 10 supported roles or custom text |
| responsibilities | String | Free-text, up to 500 chars |
| careerGoal | String | Free-text, up to 500 chars |
| dailyMinutes | Number | 10 / 15 / 20 / 25 / 30 |
| activeDays | List | e.g. ["Mon","Tue","Wed","Thu","Fri"] |
| onboardingComplete | Boolean | false until onboarding submitted |
| planId | String | FK to Plans.planId |
| planStatus | String | generating / active / paused / completed |
| currentDayIndex | Number | 0-based index into plan days array |
| streakCount | Number | Current consecutive active-day streak |
| lastCompletionDate | String | ISO 8601 date of last module completion |
| topicRequestCount | Number | Number of topic requests made (max 5) |
| notifOptOut | Boolean | true = no WhatsApp messages |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

### 7.2 Table: Plans

**Primary key:** `planId` (String) — UUID

| Attribute | Type | Description |
|---|---|---|
| planId | String (PK) | UUID |
| userId | String | Owner - FK to Users.userId |
| generatedAt | String | ISO 8601 timestamp |
| totalDays | Number | Total days in plan (46-55 depending on role) |
| days | List of DayEntry | Ordered array; index = day number 0-based |

**DayEntry object:**

| Field | Type | Description |
|---|---|---|
| dayIndex | Number | 0-based position in plan |
| stageNumber | Number | 1-5 |
| contentId | String | FK to Content.contentId |
| aiSummary | String | 300-400 word summary from Anthropic |
| completedAt | String or null | ISO 8601 timestamp when done; null if not |

### 7.3 Table: Content

**Primary key:** `contentId` (String) — e.g. "mod-01"

| Attribute | Type | Description |
|---|---|---|
| contentId | String (PK) | Module identifier |
| title | String | Resource title |
| url | String | External resource URL |
| format | String | article / video / podcast / exercise / template |
| stage | Number | 1-5 maps to the five roadmap stages |
| roleRelevance | String Set | Role names or "General" |
| tags | String Set | Free-form descriptive tags |
| aiSummary | String | AI-generated summary text |
| estimatedMinutes | Number | Estimated read/watch time |
| active | Boolean | Eligible for plan generation if true |
| createdAt | String | ISO 8601 |
| updatedAt | String | ISO 8601 |

### 7.4 Table: AllowList

**Primary key:** `email` (String)

| Attribute | Type | Description |
|---|---|---|
| email | String (PK) | Email address allowed to sign up |
| name | String | Tester name |
| addedAt | String | ISO 8601 timestamp |

### 7.5 Table: DeepLinkTokens

**Primary key:** `token` (String)

| Attribute | Type | Description |
|---|---|---|
| token | String (PK) | Cryptographically random UUID |
| userId | String | The user this token authenticates |
| dayIndex | Number | Plan day index this link navigates to |
| expiresAt | Number | Unix epoch seconds — DynamoDB TTL attribute |
| used | Boolean | Set to true on first exchange |

---

## 8. API Design

**Base URL:** `https://gkeekgdutk.execute-api.ap-south-1.amazonaws.com/v1`

All routes except `/auth/*` require `Authorization: Bearer <CognitoJWT>`.

### 8.1 Auth Routes (unauthenticated)

| Method | Path | Lambda | Description |
|---|---|---|---|
| POST | /auth/check-allowlist | checkAllowList | Checks email against AllowList before sign-up |
| POST | /auth/deeplink/exchange | deepLinkExchange | Exchanges deep-link token for Cognito session |

### 8.2 Onboarding

| Method | Path | Lambda | Description |
|---|---|---|---|
| POST | /onboarding | submitOnboarding | Saves profile + triggers plan generation |

### 8.3 Plan

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /plan/status | generatePlan | Returns planStatus, currentDayIndex, totalDays |
| POST | /plan/generate | generatePlan | Generates personalized plan via Anthropic |
| POST | /plan/request-topic | requestTopic | User requests up to 5 custom topics |

### 8.4 Modules

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /module/today | getModule | Returns current day's module |
| GET | /module/:dayIndex | getModule | Returns specific module by index |
| POST | /module/:dayIndex/complete | completeModule | Marks module complete, updates streak |

### 8.5 Progress

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /progress | getProgress | Full plan progress summary |
| PATCH | /progress/pause | setPauseState | Pause or resume the plan |

### 8.6 Admin Routes (admin group required)

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /admin/content | upsertContent | List all content |
| PUT | /admin/content/:contentId | upsertContent | Create/update content |
| POST | /admin/content/:contentId/summarise | generateSummary | AI summary generation |
| GET | /admin/allowlist | updateAllowList | List allow-list entries |
| POST | /admin/allowlist | updateAllowList | Add entry |
| DELETE | /admin/allowlist/:value | updateAllowList | Remove entry |

---

## 9. Authentication Flow (Password-Based)

### 9.1 Sign-up Flow
    1. User enters email on /signup
    2. Frontend calls POST /auth/check-allowlist
       - Not on allow-list: show invite-only message, stop
       - On allow-list: proceed
    3. Frontend calls Amplify Auth.signUp with email + password
    4. Cognito fires Pre Sign-up Lambda trigger
       - Lambda re-checks allow-list in DynamoDB
       - If not allowed: throws error, Cognito rejects sign-up
    5. Cognito auto-confirms user (PreSignUp trigger sets autoConfirmUser=true)
    6. User directed to /onboarding

### 9.2 Sign-in Flow
    1. User enters email + password on /signin
    2. Amplify Auth.signIn with USER_PASSWORD_AUTH flow
    3. Cognito validates and issues JWT tokens
    4. Auth gate logic routes user to /home or /onboarding

**Note:** OTP/email verification was abandoned because Cognito email delivery
is unreliable in ap-south-1. Password auth is simpler and works immediately.
Passwords are set by admin during tester account creation.

---

## 10. Plan Generation Design

### 10.1 Flow
    1. submitOnboarding Lambda saves user profile to Users table
    2. Invokes generatePlan Lambda
    3. generatePlan Lambda:
       a. Reads user profile from Users table
       b. Scans Content table for all active modules
       c. Separates generic (46) and role-specific modules
       d. Builds Anthropic prompt with user context
       e. Calls Anthropic API (claude-haiku-4-5-20251001)
       f. Anthropic returns personalized ordering of generic modules
       g. Appends role-specific modules as extra days at the end
       h. For each module: generates 300-400 word AI summary
       i. Writes Plan record to Plans table
       j. Updates Users: planId, planStatus=active, currentDayIndex=0
    4. Client polls GET /plan/status every 2s until planStatus != generating

### 10.2 Guarantees
- ALL 46 generic modules always included for every user
- Role-specific modules are ADDITIONAL (never replace generic ones)
- If Anthropic fails: deterministic fallback (stage-sequential ordering)
- No partial plan written on failure

### 10.3 Anthropic Integration
- Model: `claude-haiku-4-5-20251001` (cheapest available as of July 2026)
- API key stored in Secrets Manager: `anthropic/api-key`
- Direct HTTPS call to `api.anthropic.com` from Lambda
- NOT using AWS Bedrock (blocked by AISPL/RBI payment restriction)

---

## 11. Topic Request Feature

Users can request up to **5 custom topics** to be added to their learning plan.

### 11.1 Flow
    1. User submits topic request via POST /plan/request-topic
    2. Lambda validates: topicRequestCount < 5
    3. Anthropic splits multi-topic inputs into individual topics
    4. Anthropic generates clean title for each topic
    5. New module(s) created in Content table
    6. Module(s) appended to user's plan as additional days
    7. Users.topicRequestCount incremented

### 11.2 Constraints
- Maximum 5 requests per user (each request may yield multiple topics)
- Topics must be AI/leadership related (Anthropic validates relevance)
- Generated modules get the same AI summary treatment as seeded modules

---

## 12. Frontend Design

### 12.1 Branding
- **App name:** Helm.
- **Primary color (navy):** #1a1a2e
- **Accent color:** Amber
- **WhatsApp green:** Reserved exclusively for WhatsApp reminder banner
- **Font:** Inter (system-ui fallback)
- **Layout:** Responsive centered-column, max-w-md mx-auto

### 12.2 Routing Structure
    /                        redirects to /home if authenticated, /signin if not
    /signup                  Email + password sign-up
    /signin                  Email + password sign-in
    /onboarding              Multi-step onboarding form (auth but no plan yet)
    /onboarding/generating   Loading screen while plan is being generated
    /home                    Today's module + streak
    /module/:dayIndex        Individual module screen
    /roadmap                 Visual progress roadmap
    /recap                   Weekly recap screen
    /profile                 Profile, pause, notification settings
    /admin                   Admin content and allow-list (admin group only)
    /deeplink                Token exchange then redirect to module

### 12.3 Onboarding Form (4 steps)
- Step 1: Role selection (10 roles + Other with free-text)
- Step 2: Current responsibilities (textarea, max 500 chars)
- Step 3: Five-year career goal (textarea, max 500 chars)
- Step 4: Daily time (10/15/20/25/30 min) + active days checkboxes

---

## 13. Security Design

| Concern | Approach |
|---|---|
| API authentication | All routes require Cognito JWT via API GW JWT Authorizer |
| Admin protection | Cognito Group "admin" claim checked in Lambda and UI |
| Allow-list enforcement | PreSignUp Lambda + frontend pre-check |
| Anthropic API key | Stored in Secrets Manager; fetched at Lambda runtime; never logged |
| Deep-link tokens | UUID in DynamoDB with 24h TTL; single-use; server validated |
| WhatsApp token | Stored in Secrets Manager; never hardcoded |
| PII in logs | No name/email/phone in CloudWatch; only userId |
| DynamoDB encryption | AWS-managed key at rest on all tables |
| CORS | API GW restricted to PWA domain |
| HTTPS | Enforced by Amplify Hosting / CloudFront |

---

## 14. Deployment

### 14.1 CDK Stacks

| Stack | Resources |
|---|---|
| AuthStack | Cognito User Pool, Client, admin group, PreSignUp trigger |
| DatabaseStack | 5 DynamoDB tables with TTL on DeepLinkTokens |
| ApiStack | API Gateway HTTP API, JWT Authorizer, 12 Lambda functions |
| NotificationStack | EventBridge Scheduler rules, Secrets Manager ref |
| HostingStack | Amplify Hosting app definition |

### 14.2 CI/CD
- Source: GitHub `Vj-ai-mad/ai-leader-learning-app`, master branch
- On push to master: Amplify auto-builds frontend (`npm ci` + `vite build`)
- Backend: CDK deployed manually via `cdk deploy --all` for tester phase
- Build config: `appRoot: frontend`, output `dist/`

### 14.3 Operational Scripts
- `scripts/create-test-users.ps1` — Batch create Cognito users + AllowList
- `scripts/reset-user.ps1` — Reset specific user(s) for E2E testing

---

## 15. Known Limitations (Tester Phase)

- WhatsApp notifications not yet active (requires Meta Business account approval)
- Icon files are placeholder solid-color PNGs
- No OTP/email verification (using password auth)
- No self-service profile editing post-onboarding
- Some modules have fallback summaries ("[Content generation failed]") from initial seeding — will be regenerated
- Bedrock integration code exists but is not used (kept as fallback)
