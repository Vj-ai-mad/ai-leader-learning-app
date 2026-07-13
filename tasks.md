# Tasks: AI Learning App for Delivery Leaders - Tester Phase

**Owner:** Vijayakumar J
**Version:** 0.2 (Updated July 2026 — reflects implementation progress)
**Date:** July 2026
**Derives from:** design.md v0.2

Each task has a status: [ ] not started, [x] complete, [~] in progress.
Tasks are grouped by build phase. Complete phases in order.

---

## Phase 0 - Project Scaffolding and Repo Setup

- [ ] T01 Create GitHub repository: ai-leader-learning-app
- [ ] T02 Initialise monorepo structure: frontend/ and backend/ folders at root
- [ ] T03 Initialise frontend: npm create vite@latest frontend -- --template react-ts
- [ ] T04 Install frontend deps: tailwindcss, @headlessui/react, zustand, aws-amplify, idb, react-router-dom
- [ ] T05 Configure Tailwind CSS (tailwind.config.ts + PostCSS)
- [ ] T06 Install and configure vite-plugin-pwa with Workbox in vite.config.ts
- [ ] T07 Create Web App Manifest: name, short_name, icons, display standalone, theme_color #1a1a2e
- [ ] T08 Add PWA icons: icon-192.png, icon-512.png, icon-maskable.png to frontend/public/icons/
- [ ] T09 Initialise backend CDK app: cdk init app --language typescript inside backend/
- [ ] T10 Install backend deps: aws-cdk-lib, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-bedrock-runtime, @aws-sdk/client-secrets-manager, @aws-sdk/client-cognito-identity-provider
- [ ] T11 Create .gitignore: node_modules, cdk.out, .env, dist, *.js compiled output
- [ ] T12 Create README.md with project overview, local setup, and deploy instructions
- [ ] T13 Connect GitHub repo to AWS Amplify Hosting; build command: cd frontend and npm run build; output: frontend/dist

---

## Phase 1 - AWS Infrastructure (CDK Stacks)

### 1A - Auth Stack

- [ ] T14 Create backend/cdk/stacks/AuthStack.ts: Cognito User Pool
        Sign-in attributes: email, phone_number
        Auto-verified: email, phone_number
        Password policy: min 8 chars (OTP is primary flow)
        Account recovery: email or phone
- [ ] T15 Create Cognito User Pool App Client
        Auth flows: ALLOW_CUSTOM_AUTH, ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH
        No client secret; token validity: access 1h, refresh 30 days
- [ ] T16 Create Cognito User Pool Group named admin
- [ ] T17 Write backend/functions/auth/preSignUp.ts (Pre Sign-up trigger)
        Read AllowList table by email and phone_number from event attributes
        If neither found: throw NotAuthorizedException invite-only
        If found: return event unchanged
- [ ] T18 Attach preSignUp Lambda as Cognito Pre Sign-up trigger; grant read on AllowList table
- [ ] T19 Write backend/functions/auth/deepLinkExchange.ts
        POST /auth/deeplink/exchange accepts token in body
        GetItem DeepLinkTokens; validate exists + used false + not expired
        UpdateItem set used true
        Call Cognito AdminInitiateAuth CUSTOM_AUTH for userId
        Return accessToken, idToken, refreshToken
- [ ] T20 Create backend/functions/shared/token.ts
        signDeepLinkToken(userId, dayIndex): HMAC-SHA256 JWT, 24h expiry
        verifyDeepLinkToken(token): returns userId and dayIndex or throws
- [ ] T21 Configure Amplify JS v6 in frontend/src/aws-exports.ts
        userPoolId, userPoolWebClientId, region ap-south-1

### 1B - Database Stack

- [ ] T22 Create backend/cdk/stacks/DatabaseStack.ts with five DynamoDB tables (on-demand, encrypted):
        Users: PK userId; GSI EmailIndex PK email; GSI PhoneIndex PK phone
        Plans: PK planId; GSI UserIdIndex PK userId SK generatedAt
        Content: PK contentId; GSI StageActiveIndex PK stage SK active
        AllowList: PK value
        DeepLinkTokens: PK token; TTL attribute expiresAt
- [ ] T23 Enable DynamoDB TTL on DeepLinkTokens table; attribute: expiresAt
- [ ] T24 Export all five table names as CDK CfnOutputs for cross-stack reference
- [ ] T25 Create backend/functions/shared/dynamodb.ts: singleton DynamoDB DocumentClient

### 1C - API Stack

- [ ] T26 Create backend/cdk/stacks/ApiStack.ts: API Gateway HTTP API in ap-south-1
- [ ] T27 Create Cognito JWT Authorizer on HTTP API
        Issuer: https://cognito-idp.ap-south-1.amazonaws.com/{userPoolId}
        Audience: appClientId
- [ ] T28 Wire all Lambda functions to routes (see design.md section 5)
        No auth: POST /auth/check-allowlist, POST /auth/deeplink/exchange
        JWT auth: all other routes
        JWT auth + admin group check in Lambda: all /admin/* routes
- [ ] T29 Configure CORS: allow-origin APP_BASE_URL; methods GET POST PUT PATCH DELETE OPTIONS
- [ ] T30 Set environment variables on all Lambdas via CDK:
        USERS_TABLE, PLANS_TABLE, CONTENT_TABLE, ALLOWLIST_TABLE,
        DEEPLINK_TOKENS_TABLE, BEDROCK_REGION, BEDROCK_MODEL_ID,
        WHATSAPP_SECRET_NAME, WHATSAPP_PHONE_NUMBER_ID,
        APP_BASE_URL, COGNITO_USER_POOL_ID, DEEPLINK_JWT_SECRET

### 1D - Deploy and Smoke Test

- [ ] T31 Run cdk bootstrap then cdk deploy --all targeting ap-south-1
- [ ] T32 Verify AWS Console: five DynamoDB tables with correct key schemas and GSIs
- [ ] T33 Verify Cognito: sign-in attributes correct, Pre Sign-up trigger attached, admin group present
- [ ] T34 Verify API Gateway: JWT Authorizer configured, all routes present
- [ ] T35 Verify Amplify Hosting: app live at Amplify domain serving placeholder frontend

---

## Phase 2 - Authentication UI

- [ ] T36 Create frontend/src/components/auth/SignUp.tsx
        Fields: full name, email, phone number
        On submit: call POST /auth/check-allowlist first
        If rejected: show This app is invite-only. Contact Vijay to request access.
        If allowed: call Amplify Auth.signUp; navigate to /verify
- [ ] T37 Create frontend/src/components/auth/OtpVerify.tsx
        6-digit OTP input; call Amplify Auth.confirmSignUp
        On success: navigate to /onboarding
        Resend code option after 60 seconds
- [ ] T38 Create frontend/src/components/auth/SignIn.tsx
        Email or phone input; call Amplify Auth.signIn (OTP challenge)
        On confirmed: auth gate routes to /home or /onboarding
- [ ] T39 Create frontend/src/hooks/useAuth.ts
        Expose: user, isAuthenticated, isLoading, signOut
        On mount: call Amplify Auth.getCurrentUser; populate Zustand auth slice
- [ ] T40 Create Zustand auth slice: userId, name, email, isAuthenticated, isAdmin, onboardingComplete, planStatus
- [ ] T41 Create auth gate in App.tsx
        Not authenticated: redirect /signin
        Authenticated + onboardingComplete false: redirect /onboarding
        Authenticated + planStatus generating: redirect /onboarding/generating
        Otherwise: render requested route
- [ ] T42 Create /deeplink route handler
        Extract token from URL query param
        Call POST /auth/deeplink/exchange; store tokens via Amplify Auth
        Navigate to /module/:dayIndex from response
- [ ] T43 Test sign-up with email not on AllowList; expect rejection message
- [ ] T44 Add test email to AllowList directly in DynamoDB Console
- [ ] T45 Test full sign-up end to end: sign-up, OTP verify, arrive at /onboarding

---

## Phase 3 - Onboarding Flow

- [ ] T46 Create frontend/src/components/onboarding/OnboardingForm.tsx (4-step wizard)
        Step 1: Role selector (PM / Delivery Manager / Platform Lead / RTE / Other)
        Step 2: Responsibilities textarea (max 500 chars + counter)
        Step 3: Career goal textarea (max 500 chars + counter)
        Step 4: Daily time selector (10/15/20/25/30 min) + active days checkboxes default Mon-Fri
        Progress indicator (1 of 4); Back/Next; Submit on step 4 only
- [ ] T47 On Submit: call POST /onboarding; show Saving your profile...; navigate to /onboarding/generating
- [ ] T48 Write backend/functions/onboarding/submitOnboarding.ts
        Validate: role, dailyMinutes, activeDays required
        PutItem Users table with all onboarding fields + onboardingComplete false
        Invoke generatePlan Lambda asynchronously (InvocationType Event)
        Return planStatus generating
- [ ] T49 Create frontend/src/components/onboarding/PlanGenerating.tsx
        Animated loading: Generating your personalized learning plan...
        Poll GET /plan/status every 2 seconds
        planStatus active: navigate /home
        planStatus error: show error + Retry button
        Show This is taking a moment... after 10 seconds
- [ ] T50 Test onboarding form: submit, verify data in DynamoDB Users table
- [ ] T51 Test loading screen: confirm polling and navigation to /home on completion

---

## Phase 4 - Plan Generation (Backend)

- [ ] T52 Write backend/functions/plan/generatePlan.ts
        Read user profile from Users table
        Scan Content table: active true AND reviewedByAdmin true
        Build Bedrock prompt (system + user message per design.md section 8.2)
        Call Bedrock InvokeModel with Claude 3 Haiku
        Parse JSON: array of dayIndex, stageNumber, contentId, aiSummary
        On success: PutItem Plans, UpdateItem Users (planId, planStatus active, currentDayIndex 0)
        On error: UpdateItem Users planStatus error; do not write partial plan
- [ ] T53 Create backend/functions/shared/bedrock.ts: singleton BedrockRuntimeClient
- [ ] T54 Grant generatePlan Lambda IAM: Users UpdateItem, Plans PutItem, Content Scan, Bedrock InvokeModel
- [ ] T55 Add GET /plan/status handler: read Users planStatus, currentDayIndex, totalDays; return all three
- [ ] T56 Seed Content DynamoDB table with minimum 42 items before testing
        At least 8 items per stage (stages 1-5)
        Mix of article, video, podcast formats
        All items: active true, reviewedByAdmin true, estimatedMinutes 10-25
- [ ] T57 Test plan generation end to end:
        Trigger POST /plan/generate for a test user
        Verify Plan record in DynamoDB with 42+ day entries
        Verify each entry has contentId, stageNumber, aiSummary

---

## Phase 5 - Daily Module Delivery

- [ ] T58 Write backend/functions/module/getModule.ts
        GET /module/today: read currentDayIndex from Users, fetch DayEntry from Plans, join Content item
        GET /module/:dayIndex: same for specified index
        Return: dayIndex, stageNumber, stageLabel, title, url, format, estimatedMinutes, aiSummary, completedAt
- [ ] T59 Write backend/functions/module/completeModule.ts
        POST /module/:dayIndex/complete
        UpdateItem Plans: set days[dayIndex].completedAt to ISO timestamp
        Recalculate streak: yesterday or today = increment; else reset to 1
        UpdateItem Users: streakCount, lastCompletionDate, advance currentDayIndex if this was current day
        Return streakCount, currentDayIndex
- [ ] T60 Create frontend/src/components/home/TodayModule.tsx
        Fetch GET /module/today on mount
        Show stage label, day number, title, estimated time badge
        Start Today's Module button navigates to /module/:dayIndex
- [ ] T61 Create frontend/src/components/home/StreakBadge.tsx
        Plain text: e.g. 7-day streak
        Professional understated style; no gamification imagery
        Show Start your streak today if streak is 0
- [ ] T62 Create frontend/src/components/home/HomeScreen.tsx
        Compose TodayModule + StreakBadge
        Quick nav: View Roadmap, Weekly Recap
        Plan Paused banner with Resume button when planStatus is paused
- [ ] T63 Create frontend/src/components/module/ModuleScreen.tsx
        Fetch GET /module/:dayIndex on mount
        Stage + day header, title, AI summary as formatted paragraphs
        Read / Watch Original button: opens url in new tab, rel noopener
        Mark as Done button: POST complete, navigate /home
        Back arrow to /home or /roadmap
- [ ] T64 Register Workbox StaleWhileRevalidate route for /module/* in sw.ts; cache name: modules-cache
- [ ] T65 Create frontend/src/offline/db.ts: idb store pendingCompletions with dayIndex, timestamp, userId
- [ ] T66 Create frontend/src/offline/sync.ts
        On window online event: read pendingCompletions from idb
        For each: POST /module/:dayIndex/complete
        On success: delete from idb; on 3 failures: show toast Could not sync - will retry
- [ ] T67 ModuleScreen: if offline write to idb instead of API; optimistically update Zustand state
- [ ] T68 Test module screen: summary renders, external link opens, mark done advances day
- [ ] T69 Test offline: disable network, mark done, re-enable, verify sync fires

---

## Phase 6 - Progress Tracking

- [ ] T70 Write backend/functions/progress/getProgress.ts
        GET /progress: return planStatus, currentDayIndex, totalDays, streakCount,
        and stages array with stageNumber, stageLabel, totalModules, completedModules,
        and modules array with dayIndex, title, completedAt
        GET /profile: return name, role, dailyMinutes, activeDays, notifOptOut
- [ ] T71 Write backend/functions/progress/setPauseState.ts
        PATCH /progress/pause body paused true or false: UpdateItem Users planStatus
        PATCH /profile/notifications body notifOptOut: UpdateItem Users notifOptOut
- [ ] T72 Create frontend/src/components/roadmap/RoadmapView.tsx
        Fetch GET /progress on mount
        5 collapsible stage sections; each shows X of Y complete
        Module rows: title, format icon, checkmark if done, lock if future
        Current module highlighted; tapping completed module navigates to /module/:dayIndex
- [ ] T73 Create frontend/src/components/recap/WeeklyRecap.tsx
        Filter completedAt in last 7 days from progress data
        Show: modules completed this week, streak, next 5 upcoming modules
- [ ] T74 Create frontend/src/components/profile/ProfileScreen.tsx
        Display name, role, dailyMinutes, activeDays (read-only)
        Pause/Resume toggle calls PATCH /progress/pause
        Notification opt-out toggle calls PATCH /profile/notifications
        Sign out button: Amplify Auth.signOut then redirect /signin
- [ ] T75 Test roadmap: all stages render, completed modules show checkmark
- [ ] T76 Test pause: pause shows banner, resume removes it

---

## Phase 7 - Notifications

- [ ] T77 Store WhatsApp token in AWS Secrets Manager
        Secret name: whatsapp/system-user-token
        Value: accessToken and phoneNumberId as JSON
- [ ] T78 Create backend/functions/shared/whatsapp.ts
        sendWhatsAppTemplate(to, templateName, parameters)
        POST to graph.facebook.com/v19.0/{phoneNumberId}/messages with Bearer token
        Retrieve token from Secrets Manager; cache in Lambda memory per invocation
        Return success/failure; log errors to CloudWatch
- [ ] T79 Register two WhatsApp templates in Meta Business Manager:
        daily_module_reminder (utility): params user_name, module_title, deep_link_url
        weekly_recap (utility): params user_name, completed_count, streak_count, next_module_preview
        Wait for Meta approval before T80
- [ ] T80 Write backend/functions/notifications/sendDaily.ts
        EventBridge cron(30 2 * * ? *) - 08:00 IST daily
        Scan Users: planStatus active AND notifOptOut false
        For each user:
          Read days[currentDayIndex] from Plans
          Skip if today not in user activeDays
          PutItem DeepLinkTokens: uuid token, userId, dayIndex, expiresAt now+86400, used false
          Build deepLinkUrl: APP_BASE_URL/deeplink?token=uuid
          sendWhatsAppTemplate(phone, daily_module_reminder, [name, title, url])
          On failure: log to CloudWatch; schedule one-time retry after 5 min
- [ ] T81 Write backend/functions/notifications/sendWeeklyRecap.ts
        EventBridge cron(30 2 ? * SUN *) - 08:00 IST Sunday
        Scan Users: planStatus active AND notifOptOut false
        For each: count completions last 7 days, get next 5 titles, send weekly_recap template
- [ ] T82 Create backend/cdk/stacks/NotificationStack.ts
        EventBridge Scheduler rules for sendDaily and sendWeeklyRecap
        Grant: Secrets Manager GetSecretValue, Users Scan, Plans GetItem, DeepLinkTokens PutItem
- [ ] T83 Test manually: invoke sendDaily via AWS Console
        Verify WhatsApp message received, DeepLinkToken in DynamoDB
        Tap link: verify PWA opens pre-authenticated on correct module
- [ ] T84 Test opt-out: notifOptOut true, invoke sendDaily, verify no message sent

---

## Phase 8 - Admin Interface

- [ ] T85 Write backend/functions/admin/upsertContent.ts
        GET /admin/content: Scan and return all Content items
        PUT /admin/content/:contentId: PutItem or UpdateItem; validate title, url, format, stage, estimatedMinutes; set updatedAt
        Validate admin group claim in JWT; return 403 if not admin
- [ ] T86 Write backend/functions/admin/generateSummary.ts
        POST /admin/content/:contentId/summarise
        Read title, url, tags from Content table
        Call Bedrock: write original 300-400 word summary for delivery leader; do not reproduce source text
        Return aiSummary only; do not auto-save
- [ ] T87 Write backend/functions/admin/updateAllowList.ts
        GET /admin/allowlist: Scan AllowList
        POST /admin/allowlist: PutItem with value, type, note, addedAt, addedBy
        DELETE /admin/allowlist/:value: DeleteItem by PK
        Validate admin claim in all handlers
- [ ] T88 Create frontend/src/components/admin/AdminScreen.tsx: two tabs Content Library and Allow List
- [ ] T89 Create frontend/src/components/admin/ContentTable.tsx
        Fetch GET /admin/content; table columns: title, stage, format, active, reviewedByAdmin, actions
        Edit button opens ContentForm; Add New opens blank ContentForm
- [ ] T90 Create frontend/src/components/admin/ContentForm.tsx (slide-over)
        Fields: title, url, format, stage, roleRelevance multi-select, tags, estimatedMinutes, active toggle, reviewedByAdmin toggle
        Generate AI Summary button: calls summarise endpoint, shows preview
        Save calls PUT /admin/content/:contentId
- [ ] T91 Create frontend/src/components/admin/AllowListTable.tsx
        Table: value, type, note, addedAt; inline Add Entry form; Delete with confirmation
- [ ] T92 Protect /admin route: redirect non-admin to /home
- [ ] T93 Test admin: add content item, generate summary, save, verify in DynamoDB
- [ ] T94 Test allow-list: add entry via admin UI, sign up with that email, verify success

---

## Phase 9 - Integration Testing and Launch Readiness

- [ ] T95 E2E flow 1 - New tester onboarding:
        Add to AllowList; sign up; OTP verify; complete onboarding
        Verify plan in DynamoDB (42+ days); home shows today module
        Mark done; verify streak 1 and currentDayIndex advances
- [ ] T96 E2E flow 2 - Returning user:
        Sign out; sign in via OTP
        Verify correct day module shown; roadmap shows prior completions
- [ ] T97 E2E flow 3 - WhatsApp deep link:
        Invoke sendDaily; tap link on mobile
        Verify correct module, pre-authenticated
        Verify second tap rejected (token already used)
- [ ] T98 E2E flow 4 - Offline:
        Load module online (confirm service worker cached)
        Disable network; verify module readable
        Mark done offline; re-enable network; verify sync
- [ ] T99 E2E flow 5 - Pause and resume:
        Pause from profile; invoke sendDaily; verify no message sent
        Resume; verify next notification sends
- [ ] T100 PWA install test:
        iOS Safari: Add to Home Screen works, standalone mode, correct icon
        Android Chrome: install prompt appears, standalone mode, correct icon
- [ ] T101 Performance: home cold load under 3s on 4G; cached module under 500ms
- [ ] T102 Security checks:
        /admin/* with non-admin JWT: expect 403
        /module/* without Authorization: expect 401
        Expired deep-link token: expect rejection
        Reused deep-link token: expect rejection
- [ ] T103 Seed full content library: minimum 42 reviewed items across all 5 stages
- [ ] T104 Add all 15-25 tester emails and phones to AllowList table
- [ ] T105 Set custom domain on Amplify Hosting (recommended before tester invites)
- [ ] T106 Send tester invite messages via WhatsApp with PWA URL and sign-up instructions

---

## Appendix: Task Count by Area

| Area | Tasks | Count |
|---|---|---|
| Project setup | T01-T13 | 13 |
| Infrastructure CDK | T14-T35 | 22 |
| Authentication UI | T36-T45 | 10 |
| Onboarding | T46-T51 | 6 |
| Plan generation | T52-T57 | 6 |
| Daily modules | T58-T69 | 12 |
| Progress tracking | T70-T76 | 7 |
| Notifications | T77-T84 | 8 |
| Admin interface | T85-T94 | 10 |
| Integration testing | T95-T106 | 12 |
| Total | | 106 |
