# Tasks: Helm. — AI Learning App for Delivery Leaders (Tester Phase)

**Owner:** Vijayakumar J
**Version:** 0.3 (Updated July 2026 — reflects actual implementation status)
**Date:** July 2026
**Derives from:** design.md v0.3

Each task has a status: [ ] not started, [x] complete, [~] in progress.
Tasks are grouped by build phase.

---

## Phase 0 - Project Scaffolding and Repo Setup

- [x] T01 Create GitHub repository: ai-leader-learning-app
- [x] T02 Initialise monorepo structure: frontend/ and backend/ folders at root
- [x] T03 Initialise frontend: Vite + React + TypeScript
- [x] T04 Install frontend deps: tailwindcss, @headlessui/react, zustand, aws-amplify, idb, react-router-dom
- [x] T05 Configure Tailwind CSS (tailwind.config.cjs + postcss.config.cjs — CommonJS for Amplify compat)
- [x] T06 Install and configure vite-plugin-pwa with Workbox in vite.config.ts
- [x] T07 Create Web App Manifest: name "Helm.", icons, display standalone, theme_color #1a1a2e
- [x] T08 Add PWA icons: icon-192.png, icon-512.png, icon-maskable.png (placeholder navy PNGs)
- [x] T09 Initialise backend CDK app (TypeScript)
- [x] T10 Install backend deps: aws-cdk-lib, @aws-sdk/*, @anthropic-ai/sdk
- [x] T11 Create .gitignore
- [x] T12 Create README.md
- [x] T13 Connect GitHub repo to AWS Amplify Hosting (master branch, appRoot: frontend)

---

## Phase 1 - AWS Infrastructure (CDK Stacks)

### 1A - Auth Stack

- [x] T14 Create AuthStack.ts: Cognito User Pool (email sign-in, password auth)
- [x] T15 Create Cognito User Pool App Client (USER_PASSWORD_AUTH flow, no client secret)
- [x] T16 Create Cognito User Pool Group "admin"
- [x] T17 Write preSignUp.ts (Pre Sign-up trigger) — checks AllowList, auto-confirms user
- [x] T18 Attach preSignUp Lambda as Cognito Pre Sign-up trigger
- [x] T19 Write checkAllowList.ts — frontend pre-check endpoint
- [x] T20 Write deepLinkExchange.ts — token exchange for WhatsApp deep links
- [x] T21 Configure Amplify JS v6 in frontend/src/aws-exports.ts

### 1B - Database Stack

- [x] T22 Create DatabaseStack.ts with five DynamoDB tables (on-demand):
        ai-leader-users (PK: userId)
        ai-leader-plans (PK: planId)
        ai-leader-content (PK: contentId)
        ai-leader-allowlist (PK: email)
        ai-leader-deeplink-tokens (PK: token, TTL: expiresAt)
- [x] T23 Enable DynamoDB TTL on deeplink-tokens table
- [x] T24 Export table names as CDK outputs
- [x] T25 Create shared/dynamodb.ts: singleton DocumentClient

### 1C - API Stack

- [x] T26 Create ApiStack.ts: API Gateway HTTP API in ap-south-1
- [x] T27 Create Cognito JWT Authorizer on HTTP API
- [x] T28 Wire all Lambda functions to routes (12 Lambdas total)
- [x] T29 Configure CORS for Amplify domain
- [x] T30 Set environment variables on all Lambdas via CDK

### 1D - Deploy and Verify

- [x] T31 Run cdk deploy --all targeting ap-south-1
- [x] T32 Verify: five DynamoDB tables created
- [x] T33 Verify: Cognito User Pool with Pre Sign-up trigger
- [x] T34 Verify: API Gateway with JWT Authorizer and all routes
- [x] T35 Verify: Amplify Hosting live at master.d1domee0zrh3fl.amplifyapp.com

---

## Phase 2 - Authentication UI (Password-Based)

- [x] T36 Create SignUp.tsx (email + password, AllowList pre-check)
- [x] T37 Create SignIn.tsx (email + password, USER_PASSWORD_AUTH)
- [x] T38 Create useAuth hook + Zustand auth slice
- [x] T39 Create auth gate in App.tsx (redirect logic for onboarding/home)
- [x] T40 Create /deeplink route handler (token exchange)
- [x] T41 Test sign-up with email not on AllowList (rejection works)
- [x] T42 Test full sign-in flow end to end

**Note:** OTP/email verification was removed. Password auth used because
Cognito email delivery is unreliable in ap-south-1.

---

## Phase 3 - Onboarding Flow

- [x] T43 Create OnboardingForm.tsx (4-step wizard)
        Step 1: Role (10 options + "Other" with free-text)
        Step 2: Responsibilities textarea (500 char limit)
        Step 3: Career goal textarea (500 char limit)
        Step 4: Daily time + active days selector
- [x] T44 POST /onboarding endpoint: saves profile, triggers plan generation
- [x] T45 Write submitOnboarding.ts Lambda
- [x] T46 Create PlanGenerating.tsx (loading screen, polls /plan/status)
- [x] T47 Test onboarding form end to end

---

## Phase 4 - Plan Generation (Anthropic API)

- [x] T48 Write generatePlan.ts Lambda
        - Reads user profile + all active content modules
        - Separates 46 generic + role-specific modules
        - Calls Anthropic API for personalized ordering
        - Generates AI summaries for each module
        - Guarantees ALL 46 generic modules included
        - Appends role-specific modules as extra days
        - Deterministic fallback if Anthropic fails
- [x] T49 Create shared/anthropic.ts (Secrets Manager key retrieval + API client)
- [x] T50 Store Anthropic API key in Secrets Manager (`anthropic/api-key`)
- [x] T51 Grant generatePlan Lambda: Users UpdateItem, Plans PutItem, Content Scan, Secrets Manager read
- [x] T52 Add GET /plan/status handler
- [x] T53 Seed Content table with 55 modules (46 generic + 9 role-specific)
- [x] T54 Test plan generation end to end (verify 46+ days, AI summaries)

**Note:** Originally designed for AWS Bedrock (Claude 3 Haiku). Migrated to
Anthropic API direct because AISPL/RBI payment restriction blocks Bedrock
marketplace access from India accounts.

---

## Phase 5 - Daily Module Delivery

- [x] T55 Write getModule.ts (GET /module/today and /module/:dayIndex)
- [x] T56 Write completeModule.ts (POST /module/:dayIndex/complete)
- [x] T57 Create HomeScreen.tsx (TodayModule + StreakBadge + navigation)
- [x] T58 Create ModuleScreen.tsx (summary + external link + Mark as Done)
- [x] T59 Create TodayModule.tsx component
- [x] T60 Create StreakBadge.tsx component
- [x] T61 Workbox StaleWhileRevalidate for /module/* routes
- [x] T62 Create offline/db.ts (idb pendingCompletions store)
- [x] T63 Create offline/sync.ts (flush queue on reconnect)
- [x] T64 Test: mark done advances day, streak increments

---

## Phase 6 - Progress Tracking

- [x] T65 Write getProgress.ts (GET /progress — full plan summary by stage)
- [x] T66 Write setPauseState.ts (PATCH /progress/pause)
- [x] T67 Create RoadmapView.tsx (5 stages, collapsible, progress bars)
- [x] T68 Create WeeklyRecap.tsx
- [x] T69 Create ProfileScreen.tsx (pause toggle, notif opt-out, sign out)
- [x] T70 Test roadmap: stages render, completed modules show checkmark
- [x] T71 Test pause/resume flow

---

## Phase 7 - Notifications (Code Complete, Not Yet Active)

- [x] T72 Write sendDaily.ts Lambda (EventBridge cron, WhatsApp template)
- [x] T73 Write sendWeeklyRecap.ts Lambda
- [x] T74 Create NotificationStack.ts (EventBridge Scheduler rules)
- [x] T75 Write shared/whatsapp.ts (Meta Graph API client)
- [ ] T76 Register WhatsApp templates in Meta Business Manager (BLOCKED: account approval pending)
- [ ] T77 Store WhatsApp token in Secrets Manager
- [ ] T78 Test: invoke sendDaily, verify message received
- [ ] T79 Test: opt-out prevents message

**Status:** Lambda code deployed. WhatsApp integration blocked pending Meta
Business account approval.

---

## Phase 8 - Admin Interface

- [x] T80 Write upsertContent.ts (GET/PUT /admin/content)
- [x] T81 Write generateSummary.ts (POST /admin/content/:id/summarise via Anthropic)
- [x] T82 Write updateAllowList.ts (GET/POST/DELETE /admin/allowlist)
- [x] T83 Create AdminScreen.tsx (tabs: Content Library, Allow List)
- [x] T84 Create ContentTable.tsx + ContentForm.tsx
- [x] T85 Create AllowListTable.tsx
- [x] T86 Protect /admin route (admin group check)
- [x] T87 Test: add content, generate summary, manage allow-list

---

## Phase 9 - Topic Request Feature

- [x] T88 Write requestTopic.ts Lambda (POST /plan/request-topic)
        - Validates topicRequestCount < 5
        - Anthropic splits multi-topic inputs
        - Generates clean titles
        - Creates Content entries
        - Appends modules to user's plan
- [x] T89 Create TopicRequestForm.tsx in frontend
- [x] T90 Add topicRequestCount field to Users table schema
- [x] T91 Test: submit topic, verify new module appended to plan

---

## Phase 10 - Deployment & Production Fixes

- [x] T92 Connect Amplify Hosting to GitHub (master branch, auto-deploy)
- [x] T93 Fix build: remove `tsc` from build command (Vite handles TS via esbuild)
- [x] T94 Fix CSS: convert postcss.config.js and tailwind.config.ts to .cjs (CommonJS)
- [x] T95 Add placeholder PWA icon files (valid PNGs)
- [x] T96 Create scripts/create-test-users.ps1
- [x] T97 Create scripts/reset-user.ps1
- [x] T98 Verify production build: Tailwind CSS renders, icons load, auth works

---

## Phase 11 - Integration Testing & Launch Readiness

- [x] T99 E2E: New user sign-in → onboarding → plan generated → home shows module
- [x] T100 E2E: Mark done → streak increments → next day shows
- [~] T101 E2E: WhatsApp deep link flow (blocked by T76)
- [x] T102 PWA install test (Add to Home Screen)
- [ ] T103 Performance: home cold load < 3s on 4G
- [ ] T104 Security: /admin with non-admin JWT returns 403
- [ ] T105 Create all 15-25 tester accounts via create-test-users.ps1
- [ ] T106 Send tester invite messages with app URL and credentials
- [ ] T107 Collect tester feedback after 3 weeks

---

## Summary

| Phase | Tasks | Completed | Status |
|---|---|---|---|
| 0 - Scaffolding | T01-T13 | 13/13 | Done |
| 1 - Infrastructure | T14-T35 | 22/22 | Done |
| 2 - Auth UI | T36-T42 | 7/7 | Done |
| 3 - Onboarding | T43-T47 | 5/5 | Done |
| 4 - Plan Generation | T48-T54 | 7/7 | Done |
| 5 - Daily Modules | T55-T64 | 10/10 | Done |
| 6 - Progress | T65-T71 | 7/7 | Done |
| 7 - Notifications | T72-T79 | 4/8 | Partial (WhatsApp blocked) |
| 8 - Admin | T80-T87 | 8/8 | Done |
| 9 - Topic Request | T88-T91 | 4/4 | Done |
| 10 - Deployment | T92-T98 | 7/7 | Done |
| 11 - Launch | T99-T107 | 3/9 | In progress |
| **Total** | **T01-T107** | **97/107** | **91% complete** |

---

## Remaining Work

1. **WhatsApp notifications** — Blocked on Meta Business account approval
2. **Create tester accounts** — Run create-test-users.ps1 with real emails
3. **Performance/security validation** — Quick manual checks
4. **Tester invites** — Share credentials + app URL
5. **Regenerate failed AI summaries** — Some modules have placeholder text from initial seeding
