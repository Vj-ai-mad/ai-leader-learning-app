# Requirements: Helm. — AI Learning App for Delivery Leaders (Tester Phase)

**Owner:** Vijayakumar J
**Version:** 0.4 (Updated July 2026 — reflects deployed implementation)
**Date:** July 2026

---

## 1. Background & Problem Statement

Program Managers, Delivery Managers, Platform Leads, RTEs, DevOps Engineers,
SREs, and other delivery leaders are expected to lead AI-enabled delivery and
governance decisions, but existing AI learning content is either too technical
(built for engineers) or too generic (built for mass consumers). There is no
structured, role-aware, time-boxed learning path built for delivery leaders who
need to speak credibly about AI without becoming hands-on practitioners.

---

## 2. Goals

- Build a PWA ("Helm.") that takes a leader's role, responsibilities, and
  5-year career goal, and generates a personalized "0 to expert" AI learning
  plan covering 46 generic modules + role-specific extras.
- Deliver the plan in daily 15–25 minute sessions using curated free internet
  resources, with AI-generated summaries via Anthropic API.
- Track progress and sustain the learning habit through streaks, roadmap
  visualization, and eventually WhatsApp reminders with deep links.
- Allow users to request custom topics (up to 5) to extend their plan.

---

## 3. Target Users

| Role | Description |
|------|-------------|
| Program Manager | Cross-program delivery leadership |
| Delivery Manager | Sprint/release delivery ownership |
| Platform Lead | Platform engineering leadership |
| RTE / RTM | Release Train Engineer/Manager (SAFe) |
| Production Manager | Production operations leadership |
| Test Manager / QA Manager | Quality assurance leadership |
| SDM | Service Delivery Manager |
| DevOps Engineer | CI/CD and infrastructure automation |
| SRE | Site Reliability Engineering |
| Other (please specify) | Free-text custom role |

Tester phase: 15–25 invited users from the owner's professional network.

---

## 4. Tester-Phase Success Criteria

| Metric | Description |
|--------|-------------|
| Onboarding completion rate | % of invited testers who complete the onboarding flow |
| Habit formation signal | % of testers who complete at least 3 consecutive weeks |
| Daily session completion rate | Average % of active users completing their module daily |
| Plan relevance rating | Qualitative: was the plan relevant and personalized? |
| Net Promoter Score (NPS) | Collected after 6–8 weeks |

---

## 5. Functional Requirements

### 5.1 Sign-up / Enrollment

**REQ-AUTH-01** — Sign-up requires email address and password.

**REQ-AUTH-02** — Password-based authentication (not OTP). Cognito email
delivery is unreliable in ap-south-1; passwords are set by admin during
tester account creation via `scripts/create-test-users.ps1`.

**REQ-AUTH-03** — Access is restricted to a manually maintained allow-list
of approved email addresses stored in the `ai-leader-allowlist` DynamoDB table.
A sign-up attempt from an email not on the allow-list is rejected with:
"This app is currently invite-only. Contact Vijay to request access."

**REQ-AUTH-04** — The allow-list is stored in DynamoDB and is editable by the
admin without a code deployment (via admin UI, AWS Console, or creation script).

**REQ-AUTH-05** — Returning users sign in with email + password.

**REQ-AUTH-06** — Authentication is handled by Amazon Cognito User Pool with
email as the sign-in attribute. USER_PASSWORD_AUTH flow is used.

**REQ-AUTH-07** — Cognito session tokens are stored securely by the Amplify
Auth library with automatic token refresh.

---

### 5.2 Onboarding Flow

**REQ-ONB-01** — After first successful sign-in, the user is directed to a
one-time onboarding flow. No learning content is shown until onboarding completes.

**REQ-ONB-02** — The onboarding flow collects:

| Field | Input Type | Options / Notes |
|-------|-----------|-----------------|
| Role | Single-select | 10 roles + "Other" with free-text field |
| Current responsibilities | Free text | ≤ 500 characters |
| 5-year career goal | Free text | ≤ 500 characters |
| Daily time availability | Numeric selector | 10 / 15 / 20 / 25 / 30 min |
| Active learning days | Multi-select | Default: Mon–Fri |

**REQ-ONB-03** — Role, time availability, and active learning days are required.
Responsibilities and career goal are strongly encouraged but may be left blank.

**REQ-ONB-04** — On submission, data is persisted to DynamoDB and plan
generation is triggered immediately.

**REQ-ONB-05** — User sees a loading state ("Generating your personalized
plan…") while the plan is generated. Target: ≤ 30 seconds including cold start.

**REQ-ONB-06** — Onboarding data is read-only for the user in this phase.

---

### 5.3 Personalized Plan Generation

**REQ-PLAN-01** — On onboarding submission, a Lambda function calls Anthropic
API (claude-haiku-4-5-20251001) to generate a personalized learning plan.

**REQ-PLAN-02** — The plan is built from the seeded content library of 55
modules (46 generic + 9 role-specific). Anthropic personalizes the ordering
based on the user's role, responsibilities, career goal, and time budget.

**REQ-PLAN-03** — **ALL 46 generic modules are always included for every user.**
Role-specific modules are ADDITIONAL days appended at the end, never
substitutes for generic modules.

**REQ-PLAN-04** — The learning roadmap progresses through five ordered stages:

| # | Stage Name | Module Count |
|---|-----------|---|
| 1 | AI Literacy Foundations | 9 |
| 2 | AI in Delivery & Program Management | 9 |
| 3 | Leading AI-enabled Initiatives | 9 |
| 4 | Governance, Risk & Responsible AI | 9 |
| 5 | Becoming the AI-fluent Leader | 10 |

Plus role-specific modules appended as additional days.

**REQ-PLAN-05** — Each day in the plan maps to exactly one module: one curated
content item + an AI-generated summary (~300–400 words).

**REQ-PLAN-06** — AI-generated summaries are original text composed by Anthropic.
They orient the user toward the resource without reproducing source content.

**REQ-PLAN-07** — Plan is stored in DynamoDB Plans table. Generation is
idempotent: existing plan is not regenerated unless admin resets it.

**REQ-PLAN-08** — Anthropic API is called directly via HTTPS from Lambda
(not through AWS Bedrock, which is blocked by AISPL/RBI payment restrictions).
API key stored in Secrets Manager (`anthropic/api-key`).

**REQ-PLAN-09** — If plan generation fails, user sees error state with Retry
button. No partial plan is saved. Deterministic fallback ordering is used if
Anthropic is unavailable.

---

### 5.4 Topic Request Feature

**REQ-TOPIC-01** — Users can request up to 5 custom topics to add to their
learning plan via POST /plan/request-topic.

**REQ-TOPIC-02** — Anthropic validates topic relevance (AI/leadership related),
splits multi-topic inputs into individual topics, and generates clean titles.

**REQ-TOPIC-03** — New modules are created in the Content table and appended
to the user's plan as additional days.

**REQ-TOPIC-04** — Each request increments the user's topicRequestCount.
Requests beyond 5 are rejected.

---

### 5.5 Daily Module Delivery

**REQ-MOD-01** — The home screen shows "Today's Module" — the next incomplete
module per the user's current plan position.

**REQ-MOD-02** — Each module screen displays:
- Stage name and day number
- Module/resource title
- AI-generated summary (formatted text)
- "Read / Watch Original" button (opens external URL in new tab)
- "Mark as Done" button

**REQ-MOD-03** — "Mark as Done" records completion timestamp, advances plan
pointer, and updates streak.

**REQ-MOD-04** — Users can navigate to previously completed modules from roadmap.

**REQ-MOD-05** — Streak counter tracks consecutive active days with completions.
Displayed in professional, understated style.

**REQ-MOD-06** — Service worker caches module content for offline reading.
"Mark as Done" offline is queued in IndexedDB and synced on reconnect.

---

### 5.6 Progress Tracking

**REQ-PROG-01** — Visual roadmap shows all five stages, modules within each,
and completion status. Current module highlighted.

**REQ-PROG-02** — Each stage shows progress (e.g., "3 of 9 complete").

**REQ-PROG-03** — Weekly recap shows: last 7 days completions, streak, upcoming.

**REQ-PROG-04** — Pause / Resume: user can pause plan from profile. While
paused: no notifications, home shows "Plan Paused" with Resume button.

**REQ-PROG-05** — Progress data in DynamoDB is single source of truth.

---

### 5.7 Notifications (Not Yet Active)

**REQ-NOTIF-01** — Primary channel: WhatsApp daily reminders (when activated).

**REQ-NOTIF-02** — Daily message contains module title + pre-authenticated
deep link.

**REQ-NOTIF-03** — Deep link uses short-lived single-use token (24h TTL).

**REQ-NOTIF-04** — Weekly recap notification every Sunday.

**REQ-NOTIF-05** — WhatsApp via direct Meta Cloud API (no BSP).

**REQ-NOTIF-06** — Notifications require Meta Business account approval
(pending for tester phase).

**REQ-NOTIF-07** — Users can opt out via profile toggle.

---

### 5.8 Content Library (Admin)

**REQ-CONTENT-01** — 55 modules seeded in `ai-leader-content` DynamoDB table.

**REQ-CONTENT-02** — Each entry contains: contentId, title, url, format,
stage, roleRelevance, tags, aiSummary, estimatedMinutes, active.

**REQ-CONTENT-03** — Admin can manage content via /admin screen (protected
by Cognito admin group).

**REQ-CONTENT-04** — AI summary generation available via admin screen using
Anthropic API.

**REQ-CONTENT-05** — Deactivating an item excludes it from future plans only.

---

## 6. Non-Functional Requirements

### 6.1 Platform — PWA

**REQ-NFR-01** — Progressive Web App, not distributed via app stores.

**REQ-NFR-02** — Meets PWA installability: HTTPS, manifest, service worker.

**REQ-NFR-03** — "Add to Home Screen" works on iOS Safari 16+ and Android Chrome.

**REQ-NFR-04** — App shell renders within 3 seconds on 4G after installation.

### 6.2 Offline Access

**REQ-NFR-05** — Service worker caches app shell and loaded module content.

**REQ-NFR-06** — "Mark as Done" offline queues in IndexedDB, syncs on reconnect.

**REQ-NFR-07** — Unfetched modules show "Available once connected" placeholder.

### 6.3 AWS Infrastructure & Cost

**REQ-NFR-08** — All serverless/consumption-based:

| Layer | Service |
|-------|---------|
| Hosting | AWS Amplify Hosting (Git-based CI/CD) |
| Auth | Amazon Cognito User Pool |
| API | API Gateway HTTP API + Lambda (Node.js 22) |
| Database | DynamoDB on-demand |
| AI | Anthropic API direct (claude-haiku-4-5-20251001) |
| Scheduling | EventBridge Scheduler |
| Secrets | AWS Secrets Manager |
| Logging | CloudWatch Logs |

**REQ-NFR-09** — Anthropic API called only at: plan generation, topic request,
and admin content summarisation. Never on page load.

**REQ-NFR-10** — Primary region: ap-south-1 (Mumbai). Anthropic API called
externally (api.anthropic.com).

**REQ-NFR-11** — Expected monthly cost at tester scale:
- AWS Free Tier covers Lambda, API GW, DynamoDB, Cognito
- Anthropic API: ~$2–10/month (Haiku is cheapest tier)
- Total tester phase: $10–25

### 6.4 Performance

**REQ-NFR-12** — Plan generation ≤ 30 seconds (including Lambda cold start).

**REQ-NFR-13** — Module screen cached load: < 500ms. Network load: < 2s on 4G.

### 6.5 Security & Privacy

**REQ-NFR-14** — All API routes protected by Cognito JWT authorizer.

**REQ-NFR-15** — Deep-link tokens: short-lived, signed, single-use.

**REQ-NFR-16** — Anthropic API key in Secrets Manager, never logged or committed.

**REQ-NFR-17** — DynamoDB encryption at rest. No PII in CloudWatch logs.

**REQ-NFR-18** — CORS restricted to app's canonical domain.

---

## 7. Out of Scope (Tester Phase)

- Payment, subscription, or billing features
- Company/B2B admin dashboards
- Social/community features (leaderboards, cohorts)
- Certificates or badges
- Hosting original content (links to external only)
- Multi-language / i18n
- Self-service profile editing post-onboarding
- App Store / Google Play distribution
- Corporate SSO / SAML / OIDC
- Inbound WhatsApp message handling
- OTP/email verification (using password auth instead)

---

## 8. Assumptions & Constraints

- Password-based auth used because Cognito email/SMS delivery unreliable in
  ap-south-1. Admin creates accounts via script.
- Anthropic API used instead of AWS Bedrock due to AISPL/RBI payment
  restriction blocking Bedrock marketplace access from India.
- 55 content modules seeded before first tester onboards.
- Tester users primarily in India.
- The tester allow-list is maintained manually via script or admin UI.
- Build capacity: solo part-time (2–5 hours/week).
- WhatsApp notifications require Meta Business account approval (pending).

---

## 9. Open Questions

1. **WhatsApp activation:** When will Meta Business account be approved for
   template messages?
2. **Content refresh:** Manual curation vs semi-automated discovery pipeline?
3. **Monetisation:** B2C subscription vs B2B team licensing — post-tester.
4. **Additional role-specific modules:** Expand beyond Test Manager, DevOps,
   SRE to cover all 10 roles?

---

## 10. Glossary

| Term | Definition |
|------|-----------|
| Module | A single day's learning unit: one curated resource + AI summary |
| Plan | Full day-by-day sequence (46–55 days) generated for a user |
| Stage | One of five ordered thematic phases of the roadmap |
| Streak | Consecutive active days with at least one module completed |
| Allow-list | Email addresses permitted to enrol in tester phase |
| Deep link | Pre-authenticated URL opening PWA to a specific module |
| Topic request | User-submitted custom topic added to their plan (max 5) |
| Helm. | App brand name |
