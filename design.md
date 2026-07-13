# Design: AI Learning App for Delivery Leaders - Tester Phase

**Owner:** Vijayakumar J
**Version:** 0.2 (Updated July 2026 — reflects deployed state)
**Date:** July 2026
**Derives from:** requirements.md v0.3

---

## 1. Architecture Overview

Serverless PWA. All AWS resources in ap-south-1 (Mumbai) except Bedrock,
which is called cross-region in whichever region has Claude model access.

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
    DynamoDB (ap-south-1)            Amazon Bedrock (us-east-1)
    Users | Plans | Content          Claude 3 Haiku
    AllowList | DeepLinkTokens
                                     AWS Secrets Manager
                                     (WhatsApp System User token)

Key design decisions:
- All compute is Lambda - zero idle cost
- API Gateway HTTP API (not REST API) - lower per-request cost
- DynamoDB on-demand mode - no provisioned capacity charges
- Amplify Hosting - CDN-backed, HTTPS, Git-based CI/CD
- Bedrock called only at plan generation and admin summarisation
- WhatsApp: EventBridge Scheduler -> Lambda -> Meta Graph API

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
| Backend runtime | Node.js 20 on Lambda | Fast cold starts; native fetch built-in |
| IaC | AWS CDK v2 (TypeScript) | Type-safe infra co-located with app code |
| Auth | Amazon Cognito User Pool | Built-in email + phone OTP; no custom auth code |
| Database | DynamoDB on-demand | Zero idle cost; free tier covers tester scale |
| AI | Bedrock - Claude 3 Haiku | Low latency and cost; Sonnet as quality fallback |
| Notifications | Meta WhatsApp Cloud API v19+ | Direct; no BSP subscription fees |
| Hosting | AWS Amplify Hosting | CloudFront CDN + HTTPS + Git CI/CD |
| Secrets | AWS Secrets Manager | WhatsApp token retrieved at Lambda runtime |
| Scheduling | Amazon EventBridge Scheduler | Cron-triggered Lambdas for notifications |
| Logging | CloudWatch Logs (structured JSON) | All Lambda stdout |

---

## 3. Repository Structure
    ai-leader-learning-app/
    frontend/
      public/icons/               PWA icons 192px 512px maskable
      src/
        App.tsx                   Router root + auth gate
        components/
          auth/                   SignUp OtpVerify SignIn
          onboarding/             Multi-step onboarding form
          home/                   TodayModule StreakBadge
          module/                 ModuleScreen MarkDoneButton
          roadmap/                RoadmapView StageCard ModuleRow
          recap/                  WeeklyRecap
          profile/                PauseToggle NotifOptOut
          admin/                  ContentForm AllowListEditor guarded
        hooks/                    useAuth usePlan useModule useProgress
        store/                    Zustand slices auth plan progress ui
        api/                      Typed Amplify API call wrappers
        offline/
          db.ts                   idb schema
          sync.ts                 Flush queue on reconnect
        sw/sw.ts                  Custom SW Workbox base
    backend/
      cdk/stacks/
        AuthStack.ts
        DatabaseStack.ts
        ApiStack.ts
        NotificationStack.ts
        HostingStack.ts
      functions/
        auth/preSignUp.ts
        auth/deepLinkExchange.ts
        onboarding/submitOnboarding.ts
        plan/generatePlan.ts
        module/getModule.ts
        module/completeModule.ts
        progress/getProgress.ts
        progress/setPauseState.ts
        notifications/sendDaily.ts
        notifications/sendWeeklyRecap.ts
        admin/upsertContent.ts
        admin/generateSummary.ts
        admin/updateAllowList.ts
        shared/dynamodb.ts
        shared/bedrock.ts
        shared/whatsapp.ts
        shared/token.ts



---

## 4. Data Model (DynamoDB)

Five tables. All on-demand billing. AWS-managed encryption at rest.

### 4.1 Table: Users

Stores auth profile, onboarding data, plan state, and notification preferences.

**Primary key:** `userId` (String) — Cognito `sub`

| Attribute | Type | Description |
|---|---|---|
| userId | String (PK) | Cognito sub UUID |
| name | String | Full name from sign-up |
| email | String | Verified email address |
| phone | String | E.164 format e.g. +919876543210 |
| role | String | PM / Delivery Manager / Platform Lead / RTE / Other |
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
| notifOptOut | Boolean | true = no WhatsApp messages |
| createdAt | String | ISO 8601 timestamp |
| updatedAt | String | ISO 8601 timestamp |

**GSIs:**

| GSI Name | PK | Purpose |
|---|---|---|
| EmailIndex | email | Look up user by email at sign-in |
| PhoneIndex | phone | Look up user by phone at sign-in and notification dispatch |

---

### 4.2 Table: Plans

Stores the full generated day-by-day plan. Kept separate from Users to avoid
inflating every Users read with the large days array.

**Primary key:** `planId` (String) — UUID

| Attribute | Type | Description |
|---|---|---|
| planId | String (PK) | UUID |
| userId | String | Owner - FK to Users.userId |
| generatedAt | String | ISO 8601 timestamp |
| totalDays | Number | Total days in plan (42-56) |
| days | List of DayEntry | Ordered array; index = day number 0-based |

**DayEntry object:**

| Field | Type | Description |
|---|---|---|
| dayIndex | Number | 0-based position in plan |
| stageNumber | Number | 1-5 |
| contentId | String | FK to Content.contentId |
| aiSummary | String | 300-400 word summary from Bedrock |
| completedAt | String or null | ISO 8601 timestamp when marked done; null if not done |

**GSI:**

| GSI Name | PK | SK | Purpose |
|---|---|---|---|
| UserIdIndex | userId | generatedAt | Fetch active plan for a given user |

---

### 4.3 Table: Content

The curated resource library. Source of truth for plan generation.

**Primary key:** `contentId` (String) — UUID

| Attribute | Type | Description |
|---|---|---|
| contentId | String (PK) | UUID |
| title | String | Resource title |
| url | String | External resource URL |
| format | String | article / video / podcast / exercise / template |
| stage | Number | 1-5 maps to the five roadmap stages |
| roleRelevance | String Set | PM / Delivery Manager / Platform Lead / RTE / General |
| tags | String Set | Free-form descriptive tags |
| aiSummary | String | AI-generated summary text |
| estimatedMinutes | Number | Estimated read/watch time |
| active | Boolean | true = eligible for plan generation |
| reviewedByAdmin | Boolean | Must be true before item appears in plans |
| createdAt | String | ISO 8601 |
| updatedAt | String | ISO 8601 |

**GSI:**

| GSI Name | PK | SK | Purpose |
|---|---|---|---|
| StageActiveIndex | stage | active | Fetch all active items for a given stage |

---

### 4.4 Table: AllowList

Controls which emails and phone numbers may complete sign-up.

**Primary key:** `value` (String) — email address or E.164 phone number

| Attribute | Type | Description |
|---|---|---|
| value | String (PK) | Email or phone being allowed |
| type | String | email or phone |
| note | String | Optional admin note e.g. tester name |
| addedAt | String | ISO 8601 timestamp |
| addedBy | String | Admin identifier |

No GSIs needed — lookups are always by exact value.

---

### 4.5 Table: DeepLinkTokens

Short-lived single-use tokens for pre-authenticated WhatsApp deep links.

**Primary key:** `token` (String)

| Attribute | Type | Description |
|---|---|---|
| token | String (PK) | Cryptographically random UUID |
| userId | String | The user this token authenticates |
| dayIndex | Number | Plan day index this link navigates to |
| expiresAt | Number | Unix epoch seconds — DynamoDB TTL attribute |
| used | Boolean | Set to true on first exchange; rejects subsequent use |

DynamoDB TTL enabled on `expiresAt`. Tokens auto-deleted after 24 hours.

---

## 5. API Design

**Base URL:** `https://api.<domain>/v1`

All routes except `/auth/*` and `/deeplink/exchange` require
`Authorization: Bearer <CognitoJWT>` header.

### 5.1 Auth Routes (unauthenticated)

| Method | Path | Lambda | Description |
|---|---|---|---|
| POST | /auth/check-allowlist | preSignUp | Frontend calls this before Cognito sign-up to surface a friendly error early. Cognito Pre Sign-up trigger enforces the same check server-side. |
| POST | /auth/deeplink/exchange | deepLinkExchange | Accepts { token }, validates it, marks it used, returns Cognito tokens to establish a session. Navigates user to the module at dayIndex. |

### 5.2 Onboarding

| Method | Path | Lambda | Description |
|---|---|---|---|
| POST | /onboarding | submitOnboarding | Saves role, responsibilities, careerGoal, dailyMinutes, activeDays to Users table. Sets onboardingComplete: false, then invokes generatePlan asynchronously. Returns { planStatus: "generating" }. |

### 5.3 Plan

| Method | Path | Lambda | Description |
|---|---|---|---|
| POST | /plan/generate | generatePlan | Invoked internally by submitOnboarding. Reads user profile and full Content table, calls Bedrock, writes Plan record, updates Users.planId and planStatus: "active". |
| GET | /plan/status | generatePlan | Returns { planStatus, currentDayIndex, totalDays }. Client polls every 2s while planStatus is "generating". |

### 5.4 Modules

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /module/today | getModule | Returns the DayEntry at currentDayIndex joined with the full Content item and aiSummary. |
| GET | /module/:dayIndex | getModule | Returns any specific DayEntry by index for roadmap navigation. |
| POST | /module/:dayIndex/complete | completeModule | Sets days[dayIndex].completedAt timestamp. Recalculates streakCount and lastCompletionDate. Advances currentDayIndex. Returns { streakCount, currentDayIndex }. |

### 5.5 Progress

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /progress | getProgress | Returns full plan summary: all days with completedAt status grouped by stage, streakCount, planStatus, currentDayIndex. Used by roadmap and weekly recap screens. |
| PATCH | /progress/pause | setPauseState | Body: { paused: true or false }. Sets planStatus to paused or active. |

### 5.6 Profile

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /profile | getProgress (shared) | Returns name, role, dailyMinutes, activeDays, notifOptOut. |
| PATCH | /profile/notifications | setPauseState (shared) | Body: { notifOptOut: true or false }. Updates Users record. |

### 5.7 Admin Routes (Cognito admin group required)

Returns 403 if JWT does not belong to the admin Cognito group.

| Method | Path | Lambda | Description |
|---|---|---|---|
| GET | /admin/content | upsertContent | Returns all Content items active and inactive. |
| PUT | /admin/content/:contentId | upsertContent | Create or update a Content item. |
| POST | /admin/content/:contentId/summarise | generateSummary | Calls Bedrock with title, URL, tags to generate aiSummary. Returns text for review; admin must call PUT to persist. |
| GET | /admin/allowlist | updateAllowList | Returns all AllowList entries. |
| POST | /admin/allowlist | updateAllowList | Body: { value, type, note }. Adds an entry. |
| DELETE | /admin/allowlist/:value | updateAllowList | Removes an entry. URL-encode the value. |

### 5.8 Notification Lambdas (EventBridge — not HTTP routes)

| Lambda | Schedule (cron UTC) | Description |
|---|---|---|
| sendDaily | cron(30 2 * * ? *) — 08:00 IST daily | Scans active non-paused users. For each: fetches today's module, mints a DeepLinkToken, sends WhatsApp template message via Meta Graph API. |
| sendWeeklyRecap | cron(30 2 ? * SUN *) — 08:00 IST Sunday | Scans active users. Computes last-7-days completions and next-week preview. Sends WhatsApp recap message. |

---

## 6. Frontend Design

### 6.1 Routing Structure
    /                        redirects to /home if authenticated, /signin if not
    /signup                  SignUp screen: name, email, phone
    /verify                  OTP verification screen
    /signin                  Sign-in screen: email or phone + OTP
    /onboarding              Multi-step onboarding form (auth but no plan yet)
    /onboarding/generating   Loading screen while plan is being generated
    /home                    Today's module + streak (auth + plan required)
    /module/:dayIndex        Individual module screen
    /roadmap                 Visual progress roadmap
    /recap                   Weekly recap screen
    /profile                 Profile, pause, notification settings
    /admin                   Admin content and allow-list (admin group only)
    /deeplink                Token exchange then redirect to /module/:dayIndex


### 6.2 Auth Gate Logic

On every app load:
1. Check Amplify Auth session — if no valid session, redirect to /signin
2. If session valid, fetch /profile
3. If onboardingComplete is false, redirect to /onboarding
4. If planStatus is "generating", redirect to /onboarding/generating
5. Otherwise render the requested route

### 6.3 Key Screens

**Home screen**
- Today's module card: stage label, day number, title, estimated time
- Streak counter (e.g. "7-day streak") in understated text, not a badge
- Quick links: View Roadmap, Weekly Recap

**Module screen**
- Stage name and day number header
- Module title
- AI-generated summary in readable formatted text
- "Read / Watch Original" button — opens external URL in new tab
- "Mark as Done" button — triggers POST /module/:dayIndex/complete
- Back arrow to Home or Roadmap

**Roadmap screen**
- Five stage sections, each collapsible
- Each stage shows progress e.g. "3 of 8 complete"
- Each module row shows: title, format icon, completion tick or lock
- Current module highlighted

**Onboarding flow (4 steps)**
- Step 1: Role selection
- Step 2: Current responsibilities (textarea)
- Step 3: Five-year career goal (textarea)
- Step 4: Daily time availability + active days selector
- Submit triggers POST /onboarding then polls GET /plan/status

**Admin screen**
- Content library table with edit button per row
- "Add New" opens a form: title, URL, format, stage, roleRelevance, tags, estimatedMinutes
- "Generate Summary" button calls POST /admin/content/:id/summarise
- Allow-list table with add/remove controls

---

## 7. Authentication Flow

### 7.1 Sign-up Flow
    1. User submits name, email, phone on /signup
    2. Frontend calls POST /auth/check-allowlist
       - Not on allow-list: show invite-only message, stop
       - On allow-list: proceed
    3. Frontend calls Amplify Auth.signUp with email + phone attributes
    4. Cognito fires Pre Sign-up Lambda trigger
       - Lambda re-checks allow-list in DynamoDB
       - If not allowed: throws error, Cognito rejects sign-up
    5. Cognito sends OTP to phone via SMS
    6. User enters OTP on /verify screen
    7. Amplify Auth.confirmSignUp — Cognito marks phone verified
    8. Cognito sends email verification link separately
    9. Both verified: user directed to /onboarding


### 7.2 Sign-in Flow (returning user)
    1. User enters email or phone on /signin
    2. Amplify Auth.signIn initiates OTP auth challenge
    3. Cognito sends OTP to registered phone or email
    4. User enters OTP
    5. Amplify Auth.confirmSignIn — Cognito issues JWT tokens
    6. Auth gate logic runs — routes user to /home or /onboarding


### 7.3 Deep-link Pre-auth Flow
    1. sendDaily Lambda mints a DeepLinkToken (UUID, userId, dayIndex, TTL 24h)
       and writes it to DeepLinkTokens table
    2. Token embedded in WhatsApp message URL:
       https://<domain>/deeplink?token=<uuid>
    3. User taps link — PWA loads /deeplink route
    4. Frontend calls POST /auth/deeplink/exchange with { token }
    5. Lambda validates: exists, not used, not expired
    6. Lambda sets used=true, calls Cognito AdminInitiateAuth for userId
    7. Returns Cognito JWT tokens to client
    8. Amplify Auth stores tokens — user is signed in
    9. Frontend redirects to /module/:dayIndex


---

## 8. Plan Generation Design

### 8.1 Flow
    1. submitOnboarding Lambda saves user profile to Users table
    2. Asynchronously invokes generatePlan Lambda (InvocationType: Event)
    3. generatePlan Lambda:
       a. Reads user profile from Users table
       b. Scans Content table: active=true AND reviewedByAdmin=true
       c. Groups content items by stage
       d. Builds Bedrock prompt (see 8.2)
       e. Calls Bedrock InvokeModel with Claude 3 Haiku
       f. Parses JSON response — ordered list of dayIndex/stageNumber/contentId/aiSummary
       g. Writes Plan record to Plans table
       h. Updates Users: planId, planStatus=active, currentDayIndex=0
    4. Client polls GET /plan/status every 2s until planStatus != generating

### 8.2 Bedrock Prompt Structure

    System:
      You are a learning plan designer for delivery leaders.
      You create day-by-day AI literacy learning plans using
      a curated content library. Each plan covers 6-8 weeks.
      Respond only with valid JSON matching the schema provided.

    User:
      Learner profile:
      - Role: {role}
      - Responsibilities: {responsibilities or "Not specified"}
      - 5-year goal: {careerGoal or "Not specified"}
      - Daily time available: {dailyMinutes} minutes

      Content library (JSON array):
      [{ contentId, title, stage, roleRelevance, format, estimatedMinutes, tags }, ...]

      Instructions:
      1. Select and sequence content items across all 5 stages in order
      2. Prioritise items where roleRelevance includes the learner role or General
      3. Each day gets exactly one item whose estimatedMinutes <= dailyMinutes
      4. Progress through stages in order 1 then 2 then 3 then 4 then 5
      5. For each selected item write an original aiSummary of 300-400 words
         that orients the learner without reproducing the source text
      6. Return JSON array:
         [{ "dayIndex": 0, "stageNumber": 1, "contentId": "...", "aiSummary": "..." }, ...]


### 8.3 Error Handling

- If Bedrock times out or throttles: Lambda catches error, sets planStatus="error" in Users table
- Client polling detects "error" status and shows retry button
- Retry calls POST /plan/generate directly
- No partial plan is written on failure

---

## 9. Notification Design

### 9.1 Daily Notification Lambda

Triggered by EventBridge cron at 08:00 IST (02:30 UTC) every day.
    1. Scan Users table: planStatus=active AND notifOptOut=false
    2. For each user:
       a. Get today's module: days[currentDayIndex] from Plans table
       b. Check if today is in user's activeDays list — skip if not
       c. Mint DeepLinkToken (TTL 24h) and write to DeepLinkTokens table
       d. Build deep link: https://<domain>/deeplink?token=<uuid>
       e. Send WhatsApp template message via Meta Graph API:
          Template: daily_module_reminder
          Params: [user.name, module.title, deepLinkUrl]
       f. On API error: log to CloudWatch, retry once after 5 min
          via EventBridge one-time schedule


### 9.2 Weekly Recap Lambda

Triggered by EventBridge cron at 08:00 IST every Sunday.
    1. Scan Users for planStatus=active AND notifOptOut=false
    2. For each user:
       a. Count days[].completedAt entries in the last 7 days
       b. Get next 5 upcoming module titles from plan
       c. Send WhatsApp template message:
          Template: weekly_recap
          Params: [user.name, completedCount, streakCount, nextModulePreview]


### 9.3 WhatsApp Template Messages

Two Meta-approved templates required before launch:

| Template name | Type | Usage |
|---|---|---|
| daily_module_reminder | Utility | Daily deep-link notification |
| weekly_recap | Utility | Sunday summary |

Utility templates require Meta Business account approval.
The WhatsApp System User access token is stored in Secrets Manager
and fetched by the Lambda at runtime — never hardcoded.

---

## 10. Offline and PWA Design

### 10.1 Web App Manifest

```json
{
  "name": "AI Learning for Delivery Leaders",
  "short_name": "AI Leader",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### 10.2 Service Worker Caching Strategy

| Asset type | Strategy | Detail |
|---|---|---|
| App shell HTML CSS JS | Cache First | Precached at install by Workbox |
| /module/:dayIndex responses | Stale While Revalidate | Cached on first fetch; serves cache offline |
| /progress responses | Network First | Always tries network; falls back to cache |
| External resource URLs | No cache | Links open in browser; outside SW scope |

### 10.3 Offline Mark-as-Done Queue

1. User taps Mark as Done while offline
2. completeModule handler detects navigator.onLine === false
3. Action written to IndexedDB store pendingCompletions: { dayIndex, timestamp, userId }
4. UI optimistically updates — module shown as complete, streak +1
5. On connectivity restored (online event):
   sync.ts reads all pendingCompletions from IndexedDB
   For each: calls POST /module/:dayIndex/complete
   On success: removes entry from IndexedDB
   On failure: retries up to 3 times then surfaces error toast
---

## 11. Admin Interface Design

For the tester phase the admin interface is a route-guarded section of the
same PWA at /admin. It is not a separate application.

### 11.1 Access Control

- Admin users are placed in a Cognito User Pool Group named "admin"
- The /admin route checks for the "admin" group claim in the JWT on the client
- All /admin/* API routes validate the same claim server-side — return 403 otherwise

### 11.2 Content Library Management

- Table view: title, stage, format, active, reviewedByAdmin columns
- Click row to edit in a slide-over form
- Form fields: title, URL, format, stage, roleRelevance (multi-select),
  tags (comma-separated), estimatedMinutes, active toggle, reviewedByAdmin toggle
- Generate AI Summary button: calls POST /admin/content/:id/summarise,
  shows result in preview pane — admin must save manually
- Save calls PUT /admin/content/:contentId

### 11.3 Allow-List Management

- Table: value, type, note, addedAt columns
- Add Entry form: value (email or phone), type, note
- Delete button per row with confirmation prompt

---

## 12. Security Design

| Concern | Approach |
|---|---|
| API authentication | All routes require Cognito JWT via API GW HTTP API JWT Authorizer |
| Admin route protection | Cognito User Pool Group "admin" claim checked in Lambda and UI |
| Allow-list enforcement | Cognito Pre Sign-up Lambda (server-side) + frontend pre-check |
| Deep-link tokens | UUID in DynamoDB with 24h TTL; single-use flag; server validated |
| WhatsApp access token | Stored in Secrets Manager; fetched at Lambda runtime; never logged |
| PII in logs | No name email or phone in CloudWatch; only userId (Cognito sub) |
| DynamoDB encryption | AWS-managed key at rest on all tables |
| CORS | API GW CORS restricted to PWA canonical domain only |
| HTTPS | Enforced by Amplify Hosting / CloudFront; HTTP redirects to HTTPS |
| Token storage | Amplify Auth stores Cognito tokens in memory and secure cookie; not localStorage |

---

## 13. Deployment and Infrastructure

### 13.1 CDK Stack Layout

| Stack | Resources |
|---|---|
| AuthStack | Cognito User Pool, User Pool Client, admin group, Pre Sign-up Lambda trigger |
| DatabaseStack | Users, Plans, Content, AllowList, DeepLinkTokens tables (TTL on last) |
| ApiStack | API Gateway HTTP API, Cognito JWT Authorizer, all Lambda functions with IAM roles |
| NotificationStack | EventBridge Scheduler rules for daily and weekly Lambdas, Secrets Manager ref |
| HostingStack | Amplify Hosting app, CloudFront distribution, custom domain optional |

### 13.2 Lambda IAM Permissions (least-privilege)

| Lambda | DynamoDB | Other permissions |
|---|---|---|
| preSignUp | AllowList: GetItem | None |
| deepLinkExchange | DeepLinkTokens: GetItem UpdateItem; Users: GetItem | Cognito: AdminInitiateAuth |
| submitOnboarding | Users: PutItem UpdateItem | Lambda: InvokeFunction (generatePlan) |
| generatePlan | Users: UpdateItem; Plans: PutItem; Content: Scan | Bedrock: InvokeModel |
| getModule | Users: GetItem; Plans: GetItem; Content: GetItem | None |
| completeModule | Users: UpdateItem; Plans: UpdateItem | None |
| getProgress | Users: GetItem; Plans: GetItem | None |
| setPauseState | Users: UpdateItem | None |
| sendDaily | Users: Scan; Plans: GetItem; DeepLinkTokens: PutItem | Secrets Manager: GetSecretValue |
| sendWeeklyRecap | Users: Scan; Plans: GetItem | Secrets Manager: GetSecretValue |
| upsertContent | Content: PutItem UpdateItem Scan | None |
| generateSummary | Content: GetItem | Bedrock: InvokeModel |
| updateAllowList | AllowList: PutItem DeleteItem Scan | None |

### 13.3 Environment Variables per Lambda

All Lambdas receive via CDK environment injection:
- USERS_TABLE — DynamoDB Users table name
- PLANS_TABLE — DynamoDB Plans table name
- CONTENT_TABLE — DynamoDB Content table name
- ALLOWLIST_TABLE — DynamoDB AllowList table name
- DEEPLINK_TOKENS_TABLE — DynamoDB DeepLinkTokens table name
- BEDROCK_REGION — AWS region for Bedrock calls e.g. us-east-1
- BEDROCK_MODEL_ID — e.g. anthropic.claude-3-haiku-20240307-v1:0
- WHATSAPP_SECRET_NAME — Secrets Manager secret name for WhatsApp token
- WHATSAPP_PHONE_NUMBER_ID — Meta WhatsApp Business phone number ID
- APP_BASE_URL — PWA canonical URL for deep link construction
- COGNITO_USER_POOL_ID — for deepLinkExchange AdminInitiateAuth call

### 13.4 CI/CD

- Source: GitHub repository connected to Amplify Hosting
- On push to main: Amplify builds frontend (npm run build) and deploys to CloudFront
- Backend: CDK deployed manually via cdk deploy --all for tester phase
- Separate dev and prod Amplify apps recommended once out of tester phase
