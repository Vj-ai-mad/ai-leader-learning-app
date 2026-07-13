# Requirements: AI Learning App for Delivery Leaders — Tester Phase (MVP)

**Owner:** Vijayakumar J
**Version:** 0.3 (Updated to reflect current implementation status)
**Date:** July 2026

---

## 1. Background & Problem Statement

Program Managers, Delivery Managers, Platform Leads, and Release Train Engineers
(RTEs) are expected to lead AI-enabled delivery and governance decisions, but
existing AI learning content is either too technical (built for engineers) or
too generic (built for mass consumers). There is no structured, role-aware,
time-boxed learning path built for delivery leaders who need to speak credibly
about AI without becoming hands-on practitioners.

---

## 2. Goals

- Build a PWA that takes a leader's role, responsibilities, and 5-year career
  goal, and generates a personalized "0 to expert" AI learning plan.
- Deliver the plan in daily 15–25 minute sessions using curated free internet
  resources, with AI-generated summaries.
- Track progress and sustain the learning habit through WhatsApp reminders with
  deep links.

---

## 3. Target Users

- Program Managers
- Delivery Managers
- Platform Leads
- Release Train Engineers (RTEs)
- Tester phase: 15–25 invited users from the owner's personal/professional network

---

## 4. Tester-Phase Success Criteria

| Metric | Description |
|--------|-------------|
| Onboarding completion rate | % of invited testers who complete the onboarding flow |
| Habit formation signal | % of testers who complete at least 3 consecutive weeks of daily modules |
| Daily session completion rate | Average % of active users completing their module on any given day |
| Plan relevance rating | Qualitative feedback: was the plan relevant to their role and felt personalized? |
| Net Promoter Score (NPS) | Collected after 6–8 weeks — would they recommend the app? |

---

## 5. Functional Requirements

### 5.1 Sign-up / Enrollment

**REQ-AUTH-01** — Sign-up requires three fields: full name, email address, and
phone number.

**REQ-AUTH-02** — Both the email address and phone number must be verified:
- Phone: OTP sent via SMS (primary verification channel)
- Email: verification link or OTP sent to the email address

Both must be confirmed before the user is admitted to the onboarding flow.

**REQ-AUTH-03** — For the tester phase, access is restricted to a manually
maintained allow-list of approved email addresses and/or phone numbers.
A sign-up attempt from an address or number not on the allow-list is rejected
with a clear message (e.g., "This app is currently invite-only. Contact Vijay
to request access.").

**REQ-AUTH-04** — The allow-list is stored in DynamoDB (or AWS Secrets
Manager / environment config) and is editable by the admin without a code
deployment. Changes take effect immediately for new sign-up attempts.

**REQ-AUTH-05** — Returning users sign in with email or phone number followed
by OTP (passwordless). A password-based sign-in option may be offered as a
fallback but is not required for MVP.

**REQ-AUTH-06** — Authentication is handled by Amazon Cognito User Pool with
email and phone configured as sign-in attributes and as required verification
attributes.

**REQ-AUTH-07** — Cognito session tokens are stored securely by the Amplify
Auth library. Automatic token refresh is handled by Cognito/Amplify. No
plaintext tokens are stored in localStorage.

---

### 5.2 Onboarding Flow

**REQ-ONB-01** — After first successful sign-in (and allow-list check), the
user is directed to a one-time onboarding flow. The app does not show learning
content until onboarding is complete.

**REQ-ONB-02** — The onboarding flow collects the following:

| Field | Input Type | Options / Notes |
|-------|-----------|-----------------|
| Role | Single-select | PM / Delivery Manager / Platform Lead / RTE / Other |
| Current responsibilities | Free text (or guided tags) | ≤ 500 characters |
| 5-year career goal | Free text (or guided options) | ≤ 500 characters |
| Daily time availability | Numeric selector | Default 15–25 min; options: 10 / 15 / 20 / 25 / 30 min |
| Active learning days | Multi-select (days of week) | Default: Mon–Fri; user can deselect weekend days or specific weekdays |

**REQ-ONB-03** — Role, time availability, and active learning days are required.
Responsibilities and career goal are strongly encouraged but may be left blank
(a default prompt is used for Bedrock if they are empty).

**REQ-ONB-04** — On submission, onboarding data is persisted to the user's
record in DynamoDB, and plan generation (REQ-PLAN-01) is triggered immediately.

**REQ-ONB-05** — The user sees a loading/progress state ("Generating your
personalized plan…") while Bedrock produces the plan. This must complete within
a few seconds (target: ≤ 15 seconds end-to-end including Lambda cold start).

**REQ-ONB-06** — Onboarding data is read-only for the user in this phase.
Admin can edit it directly in DynamoDB if a tester requests a change.

---

### 5.3 Personalized Plan Generation

**REQ-PLAN-01** — On onboarding submission, a Lambda function calls Amazon
Bedrock (Claude) to generate a 6–8 week, day-by-day learning plan for the user.

**REQ-PLAN-02** — The plan is built by selecting and sequencing items from the
curated content library stored in DynamoDB. Library items are tagged by stage,
role relevance, format, and estimated time. Bedrock selects and sequences items
that fit the user's role, responsibilities, career goal, and daily time budget.

**REQ-PLAN-03** — The Bedrock prompt includes:
- User's role
- Current responsibilities (or default if blank)
- 5-year career goal (or default if blank)
- Daily time availability in minutes
- The full list of content library items (id, title, stage, roleRelevance,
  format, estimatedMinutes, tags) as structured context

**REQ-PLAN-04** — The learning roadmap progresses through five ordered stages:

| # | Stage Name |
|---|-----------|
| 1 | AI Literacy Foundations |
| 2 | AI in Delivery & Program Management |
| 3 | Leading AI-enabled Initiatives |
| 4 | Governance, Risk & Responsible AI |
| 5 | Becoming the AI-fluent Leader |

Stages are completed in order. A user does not skip to a later stage until
earlier stages are complete.

**REQ-PLAN-05** — Each day in the plan maps to exactly one module. A module is:
- One curated content library item (by `contentId`)
- An AI-generated summary (~300–400 words; ~5-minute read)
- The original external resource URL (always surfaced to the user)

**REQ-PLAN-06** — AI-generated summaries are original text composed by Bedrock.
They orient the user toward the resource. The full source article, video
transcript, or podcast audio must never be reproduced within the app.

**REQ-PLAN-07** — The generated plan is stored in DynamoDB under the user's
record. Plan generation is idempotent: if a completed plan already exists, it
is not regenerated unless the admin explicitly resets it.

**REQ-PLAN-08** — Bedrock is called from the AWS region where the chosen Claude
model is available (may differ from ap-south-1). The Lambda making the Bedrock
call may cross regions; this is acceptable.

**REQ-PLAN-09** — If plan generation fails (Bedrock error, timeout, throttle),
the user sees a clear error state with a "Retry" button. No partial plan is
saved on failure.

---

### 5.4 Daily Module Delivery

**REQ-MOD-01** — The home screen defaults to "Today's Module" — the next
incomplete module scheduled for the current calendar day per the user's
active learning days setting.

**REQ-MOD-02** — Each module screen displays:
- Stage name and day number (e.g., "Stage 1 · Day 4")
- Module/resource title
- AI-generated summary (formatted, readable text)
- A clearly labelled button: "Read / Watch Original →" — opens the external
  resource URL in a new browser tab
- A "Mark as Done" button

**REQ-MOD-03** — Tapping "Mark as Done" records a completion timestamp for the
module in DynamoDB and advances the plan pointer to the next day's module.

**REQ-MOD-04** — Users can navigate to any previously completed module from
the roadmap view.

**REQ-MOD-05** — Streak counter: the system tracks consecutive active learning
days on which the user marked at least one module complete. The streak is
displayed on the home screen in a professional, understated style (not
gamified or childish in tone).

**REQ-MOD-06** — Previously fetched module content (summary text, resource URL)
is cached by the service worker for offline reading. "Mark as Done" while
offline is queued in IndexedDB and synced when connectivity is restored.

---

### 5.5 Progress Tracking

**REQ-PROG-01** — A visual roadmap screen shows all five stages, the modules
within each stage, and the completion status of each module (not started /
completed). The current module is highlighted.

**REQ-PROG-02** — Each stage shows a progress indicator (e.g., "3 of 8
modules complete").

**REQ-PROG-03** — A weekly recap view (accessible from the home screen) shows:
- Modules completed in the past 7 days
- Current streak count
- The next module(s) queued for the coming week

**REQ-PROG-04** — Pause / Resume: a user can pause their plan from the profile
or settings screen. While paused:
- No daily notifications are dispatched
- The home screen shows a "Plan Paused" state with a "Resume" button
- The plan pointer does not advance
Resuming reactivates notifications and continues from the next incomplete module.

**REQ-PROG-05** — Progress data (completion timestamps, streak, pause state,
plan pointer) is stored per user in DynamoDB and is the single source of truth.
Client state is derived from it on each app load.

---

### 5.6 Notifications

**REQ-NOTIF-01** — Primary notification channel: WhatsApp. Daily reminders are
sent to each active (non-paused) user's registered phone number.

**REQ-NOTIF-02** — The daily WhatsApp message contains:
- A short contextual message referencing the day's module title
- A deep link URL that opens the PWA directly to that day's module

**REQ-NOTIF-03** — The deep link is pre-authenticated: it embeds a short-lived
signed token (JWT or equivalent, valid ≤ 24 hours, single-use) so tapping the
link logs the user into the app and navigates directly to the module — no
manual sign-in step required.

**REQ-NOTIF-04** — Weekly recap notification: every Sunday (configurable),
each active user receives a WhatsApp message summarising:
- Modules completed that week
- Current streak
- A preview of the coming week's content

**REQ-NOTIF-05** — WhatsApp messages are sent via direct Meta WhatsApp Cloud
API integration (Graph API). No third-party BSP is used; this avoids BSP
subscription fees at tester-phase volumes.

**REQ-NOTIF-06** — If a tester replies to a WhatsApp message, this opens a
free 24-hour service window with Meta, allowing lightweight conversational
follow-up without incurring additional template message costs. The app does
not need to handle inbound replies programmatically for the tester phase;
they can be monitored manually by the admin.

**REQ-NOTIF-07** — Notification dispatch is triggered by a scheduled AWS Lambda
via Amazon EventBridge Scheduler. No persistent server process is required.

**REQ-NOTIF-08** — WhatsApp phone numbers are stored in E.164 format in the
user's DynamoDB profile.

**REQ-NOTIF-09** — If a message send fails (API error, number not on WhatsApp),
the failure is logged to CloudWatch. A single retry after 5 minutes is
acceptable; no retry storm.

**REQ-NOTIF-10** — Users can opt out of notifications via a toggle in profile
settings or by replying "STOP" to any WhatsApp message. Opt-out is applied
immediately to subsequent scheduled sends.

---

### 5.7 Content Library (Admin / Backend)

**REQ-CONTENT-01** — A curated content library is maintained in a DynamoDB
table. It is not user-facing; it is the source from which plans are generated.

**REQ-CONTENT-02** — Each content library entry contains:

| Attribute | Type | Description |
|-----------|------|-------------|
| `contentId` | String (PK) | UUID |
| `title` | String | Resource title |
| `url` | String | External resource URL |
| `format` | String | article / video / podcast / exercise / template |
| `stage` | Number | 1–5 (maps to the five roadmap stages) |
| `roleRelevance` | String Set | PM / Delivery Manager / Platform Lead / RTE / General |
| `tags` | String Set | Free-form descriptive tags |
| `aiSummary` | String | AI-generated module summary text |
| `estimatedMinutes` | Number | Estimated read/watch time |
| `active` | Boolean | Eligible for plan generation if true |
| `reviewedByAdmin` | Boolean | Manual quality-control gate before use in plans |
| `createdAt` | String | ISO 8601 timestamp |
| `updatedAt` | String | ISO 8601 timestamp |

**REQ-CONTENT-03** — For the tester phase, content entries are added and edited
via either:
- (a) Direct DynamoDB console, or
- (b) A minimal internal admin screen (not publicly accessible; protected by
  a Cognito admin group or IAM) that provides a form to create/edit entries

**REQ-CONTENT-04** — The AI-generated summary for a content item is produced
by calling Bedrock with the resource title, URL, and tags as context. This can
be triggered from the admin tool or run as a batch Lambda. The admin must
review and set `reviewedByAdmin: true` before the item is used in plans.

**REQ-CONTENT-05** — Deactivating an item (`active: false`) excludes it from
future plan generation. It does not affect plans already generated or modules
already assigned to users.

**REQ-CONTENT-06** — The content library must be seeded with a minimum of
~40–56 items (enough to cover a full 6–8 week plan) before the first user
completes onboarding.

**REQ-CONTENT-07** — The admin allow-list (REQ-AUTH-04) is managed through
the same admin interface or directly in DynamoDB.

---

## 6. Non-Functional Requirements

### 6.1 Platform — PWA

**REQ-NFR-01** — The application is a Progressive Web App (PWA). It is not
distributed via the Apple App Store or Google Play Store.

**REQ-NFR-02** — The app must meet PWA installability criteria:
- Served over HTTPS
- Valid Web App Manifest (name, short_name, icons at 192px and 512px,
  start_url, display: standalone, theme_color, background_color)
- Registered and active service worker

**REQ-NFR-03** — "Add to Home Screen" must work on iOS Safari (16+) and
Android Chrome, giving users an app-like icon and fullscreen experience.

**REQ-NFR-04** — The app shell (navigation, home screen, roadmap skeleton)
renders within 3 seconds on a 4G connection after installation.

### 6.2 Offline Access

**REQ-NFR-05** — The service worker caches the app shell and previously loaded
module content (summary text, resource URL, stage/day metadata). Cached modules
remain fully readable offline.

**REQ-NFR-06** — "Mark as Done" while offline queues the action in IndexedDB
and syncs to the backend when connectivity returns (Background Sync API where
supported; fallback to sync-on-next-foreground).

**REQ-NFR-07** — Modules not yet fetched display a clear offline placeholder
("Available once connected") rather than crashing or showing a blank screen.

### 6.3 AWS Infrastructure & Cost

**REQ-NFR-08** — All backend components use serverless or consumption-based AWS
services to avoid fixed/always-on costs:

| Layer | Service |
|-------|---------|
| Hosting | AWS Amplify Hosting (or S3 + CloudFront) |
| Authentication | Amazon Cognito User Pool |
| API | Amazon API Gateway (HTTP API) + AWS Lambda |
| Database | Amazon DynamoDB (on-demand billing mode) |
| AI | Amazon Bedrock (Claude — pay per token) |
| Scheduling | Amazon EventBridge Scheduler |
| Secrets | AWS Secrets Manager |
| Logging | Amazon CloudWatch Logs |

**REQ-NFR-09** — Bedrock is called only at plan generation time and on-demand
for admin content summarisation. It is never called on page load or routine
user actions.

**REQ-NFR-10** — Primary AWS deployment region: **ap-south-1 (Mumbai)**.
Bedrock calls may route to a different region (e.g., us-east-1) based on
Claude model availability. Cross-region Lambda-to-Bedrock calls are acceptable.

**REQ-NFR-11** — Expected monthly cost at tester scale:
- AWS Free Tier covers Lambda, API Gateway, DynamoDB, and Cognito usage
  well within limits for 15–25 users
- Bedrock/Claude: approximately $2–10/month
- WhatsApp Cloud API (direct with Meta): ~$2–5 for the full 8-week test run
  at India utility-message rates
- Total realistic cost for the entire tester phase: $10–25

**REQ-NFR-12** — No payment, billing, or subscription features are in scope
for this phase.

### 6.4 Performance

**REQ-NFR-13** — Plan generation (Lambda + Bedrock) must complete within
~15 seconds of onboarding submission under normal conditions (no Lambda
warm-up; cold start included).

**REQ-NFR-14** — Module screen load time (cached): < 500ms. Module screen
load time (network): < 2 seconds on 4G.

### 6.5 Security & Privacy

**REQ-NFR-15** — All API Gateway routes are protected by Cognito JWT
authorisation. No unauthenticated routes exist except the sign-up/OTP
flow itself and the deep-link token exchange endpoint.

**REQ-NFR-16** — Deep-link tokens are short-lived (≤ 24 hours), signed,
validated server-side, and invalidated after first use.

**REQ-NFR-17** — The Meta WhatsApp access token is stored in AWS Secrets
Manager. It is never hard-coded, committed to source control, or written
to CloudWatch logs.

**REQ-NFR-18** — DynamoDB tables use AWS-managed encryption at rest.
No PII (name, phone, email) is written to CloudWatch logs in plaintext.

**REQ-NFR-19** — CORS policy on API Gateway is restricted to the app's
canonical domain.

**REQ-NFR-20** — Minimal personal data is collected: name, email, phone
number, role, responsibilities, career goal, and progress data. No sensitive
personal data (financial, health, biometric) is collected or stored.

### 6.6 Content & Intellectual Property

**REQ-NFR-21** — The app always links out to original source content.
Full article text, video transcripts, or podcast audio must never be
reproduced or stored within the app.

**REQ-NFR-22** — AI-generated summaries are original compositions. They
summarise and orient the learner but do not copy or closely paraphrase
the source text.

### 6.7 Scalability (Tester Phase)

**REQ-NFR-23** — The system is designed for 15–25 simultaneous users.
Lambda concurrency, DynamoDB throughput, and API Gateway rate limits are
left at defaults for this phase.

---

## 7. Out of Scope (Tester Phase)

- Payment, subscription, or billing features
- Company/B2B admin dashboards
- Social or community features (leaderboards, peer comparison, cohort sharing)
- Certificates or badges
- Hosting original video, audio, or article content
- Multi-language / i18n support
- Self-service profile editing post-onboarding
- App Store or Google Play distribution
- Corporate SSO / SAML / OIDC federation
- Inbound WhatsApp message handling (replies monitored manually by admin)

---

## 8. Assumptions & Constraints

- The operator (Vijayakumar J) has an approved Meta Business account and a
  verified WhatsApp Business phone number before the first notification is sent.
- A Meta WhatsApp Cloud API System User access token with
  `whatsapp_business_messaging` permission is provisioned and stored in Secrets
  Manager before the notification Lambda is deployed.
- Claude model access (Haiku or Sonnet) is enabled in the target Bedrock region
  before any user completes onboarding.
- A minimum of ~40–56 active, reviewed content library items must be seeded
  in DynamoDB before the first tester completes onboarding.
- Tester users are primarily in India; phone numbers use the +91 prefix
  (E.164 format) unless otherwise configured.
- The tester allow-list is maintained manually; no self-service invitation
  flow is in scope.
- Build capacity is approximately 2–5 hours per week (solo part-time);
  scope and complexity are sized accordingly.
- Phase 0 (manual validation with 5 testers via Google Forms + manually
  curated plans) may run in parallel or just before the Phase 1 app build
  to validate core assumptions with minimal investment.

---

## 9. Open Questions

1. **Content library sourcing:** Will curation be fully manual, or is there
   a semi-automated discovery pipeline (e.g., RSS feeds, curated newsletter
   sources) to reduce ongoing maintenance effort?
2. **Monetisation model:** B2C subscription vs B2B team licensing — to be
   decided after tester-phase feedback. Relevant to how user management and
   admin dashboards are designed in Phase 2.

---

## 10. Future Considerations (Post-Tester Phase)

- B2B licensing to company L&D teams; multi-tenant admin dashboards
- Expanded personas: QA leads, Finance professionals, other roles
- Certificates and LinkedIn-shareable completion badges
- Community and cohort accountability features
- Monthly content refresh cadence as AI tooling evolves
- Self-service onboarding profile editing
- Advanced analytics for the admin (engagement, drop-off, content ratings)

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| Module | A single day's learning unit: one curated resource + AI-generated summary |
| Plan | The full 6–8 week, day-by-day sequence of modules generated for a user |
| Stage | One of the five ordered thematic phases of the learning roadmap |
| Streak | Consecutive active learning days on which the user marked at least one module complete |
| Allow-list | Manually maintained set of email/phone values permitted to enrol in the tester phase |
| BSP | Business Solution Provider — a third-party WhatsApp API reseller (not used in this build) |
| Deep link | A URL that opens the PWA directly to a specific module screen, pre-authenticated |
| OTP | One-time passcode used for passwordless authentication via Cognito |
| Service window | Meta's 24-hour free messaging window opened when a user replies to a WhatsApp message |
| PWA | Progressive Web App — installable via browser "Add to Home Screen," no app store required |
