# Product Requirements Document
## AI Learning App for Delivery Leaders — Tester Phase (MVP)

**Owner:** Vijayakumar J
**Version:** 0.1 (Draft for tester rollout)
**Date:** July 2026

---

## 1. Problem Statement

Program Managers, Delivery Managers, Platform Leads, and Release Train Engineers (RTEs) are expected to lead AI-enabled delivery and governance decisions, but most AI learning content is either too technical (built for engineers) or too generic (built for the mass consumer market). There is no structured, role-aware, time-boxed learning path built specifically for people who manage run + change and need to speak credibly about AI without becoming hands-on practitioners.

## 2. Goal

Build a mobile app that takes a leader's role, responsibilities, and 5-year career goal, and generates a personalized "0 to expert" AI learning plan — delivered in daily 15-25 minute reading/watching sessions using curated free internet resources — and tracks their progress.

## 3. Target Users (Tester Phase)

- Program Managers
- Delivery Managers
- Platform Leads
- Release Train Engineers (RTEs)
- 15-25 testers recruited from personal/professional network for phase 1

## 4. Success Criteria for Tester Phase

- % of testers who complete onboarding
- % of testers who complete at least 3 weeks of daily plan (habit formation signal)
- Average daily session completion rate
- Qualitative feedback: was the plan relevant to their role? Did content feel personalized?
- Net Promoter Score (would they recommend it) after 6-8 weeks

---

## 5. Core Features (MVP Scope)

### 5.1 Sign-up / Enrollment
- User signs up using **email address** and **phone number**
- Verification: OTP sent to phone (SMS) and/or email verification link — confirms both are real and reachable, since daily reminders depend on them
- Basic profile capture at sign-up: name, email, phone number
- Login on subsequent visits: email/phone + OTP (avoids password management for a small tester base) or a simple password — OTP is lower-friction and lower build effort for MVP
- For tester phase: manual allow-list of approved phone numbers/emails (since only 15-25 testers), so the app can restrict access to invited testers only
- Data captured here is minimal and only used for authentication and reminder delivery — no additional personal data beyond what's needed to run the tester phase

### 5.2 Onboarding
- Capture role (select from list: PM / Delivery Manager / Platform Lead / RTE / Other)
- Capture current responsibilities (short free text or tag selection)
- Capture 5-year career goal (free text or guided options)
- Capture time availability (default 15-25 min/day, editable days of week)

### 5.3 Personalized Plan Generation
- AI-generated learning roadmap based on onboarding inputs
- Roadmap structured into stages:
  1. AI Literacy / Foundations
  2. AI in Delivery & Program Management
  3. Leading AI-enabled Initiatives
  4. Governance, Risk & Responsible AI
  5. Becoming the AI-fluent Leader
- Each stage broken into daily modules (15-25 min each), pulling from a curated library of free resources (articles, videos)
- Plan length: approx. 6-8 weeks for tester phase

### 5.4 Daily Learning Delivery
- One module per day: short AI-generated summary (readable in ~5 min) plus a link to one curated free resource (video or article)
- "Mark as done" action
- Streak counter (subtle, professional tone — not gamified/childish)

### 5.5 Progress Tracking
- Visual roadmap showing stage/module completion
- Weekly recap: modules completed, what's coming next
- Ability to pause/resume plan

### 5.6 Notifications
- **Primary channel: WhatsApp.** Daily reminder message sent to the user's registered phone number, containing a deep link straight to that day's module in the app
- Tapping the link opens the PWA directly to the day's module (pre-authenticated via the link)
- Weekly recap sent the same way
- Integrate directly with **Meta's WhatsApp Cloud API** (not a third-party BSP) to avoid recurring platform subscription fees — at tester-phase volume (15-25 users), Meta's own per-message utility rate is low enough that a middleman platform fee would dominate the cost unnecessarily
- If a tester replies to a WhatsApp message, that opens a free 24-hour service window — useful for any lightweight follow-up without incurring template costs

### 5.7 Content Library (Admin/Backend — not user-facing)
- Curated repository of free resources tagged by: stage, role relevance, format (article/video), estimated time
- AI-assisted summarization pipeline to generate module summaries
- Manual review step before publishing new modules (quality control)

---

## 6. Out of Scope (Tester Phase)

- Payments / subscription billing
- Company/B2B admin dashboards
- Social/community features (leaderboards, peer comparison)
- Certificates/badges
- Hosting original video content (always link out to source)
- Multi-language support

## 7. Non-Functional Requirements

- **Platform:** Mobile app (iOS + Android) — cross-platform framework preferred to keep solo/part-time build feasible
- **Availability:** Content must be accessible offline for previously-loaded modules (leaders often read on commute)
- **Privacy:** Minimal personal data collection (role, goals, progress only); no sensitive personal data
- **Performance:** Plan generation should complete within a few seconds of onboarding submission
- **Content copyright:** App must link out to original sources rather than reproducing full articles/video content; summaries must be original AI-generated text, not copied text

## 8. Technical Stack & Hosting (Kiro + AWS, Minimum Cost)

**Development approach:** Build using **Kiro** (AWS's spec-driven agentic IDE) — this PRD becomes the input for Kiro's `requirements.md`, which it then expands into `design.md` and `tasks.md` before generating code. Kiro's defaults lean toward native AWS services, which lines up well with the "host on AWS, minimize cost" goal below.

**Recommended stack for the tester app:**

| Layer | Service | Why |
|---|---|---|
| Mobile app shell | React Native / Expo (or Flutter) | Single codebase for iOS + Android, works well with Kiro's code generation |
| Authentication | **Amazon Cognito** | Built-in email + phone OTP sign-up/sign-in — matches the Section 5.1 requirement directly, no custom auth code needed |
| Backend logic | AWS Lambda + API Gateway | Serverless — you pay only per request, effectively free at 15-25 testers' usage volume |
| Database | Amazon DynamoDB | Stores user profiles, plans, progress; free tier covers this scale easily |
| AI plan generation & summarization | Amazon Bedrock (Claude) | Pay-per-token; at tester-phase volume (25 users, a handful of AI calls each), this is a few dollars a month at most |
| Push notifications | **WhatsApp Cloud API (direct with Meta)** | Daily reminder + deep link to today's module; free service-window replies; avoids BSP subscription fees at this scale |
| Hosting/deployment | AWS Amplify | Simplifies deploying the backend + tying it to Cognito/DynamoDB/Lambda together |

**Rough monthly cost estimate at 15-25 testers:**
- AWS Free Tier covers most of Lambda, API Gateway, DynamoDB, and Cognito usage at this scale (Free Tier limits are far above what 25 users would generate)
- Bedrock/Claude API calls: likely **$2-10/month** depending on how many plan-generation and summarization calls are made
- WhatsApp Cloud API (direct with Meta, no BSP): daily reminders to 25 testers over an 8-week test run to roughly **1,400 messages total**, at India's low utility-message rate — a few dollars for the entire test run, not monthly
- App store distribution: **not required** for tester phase — the PWA is installed via browser "Add to Home Screen," so there's no Apple/Google store fee at all in this phase
- **Total realistic cost for the entire tester phase: roughly $10-25, almost entirely AWS Bedrock/Claude usage plus a handful of dollars in WhatsApp messages — no store fees, no BSP subscription**

## 9. Suggested Build Approach (Tester Phase)

Given a 2-5 hrs/week solo build capacity, phase the build to de-risk effort:

| Phase | What | Tooling |
|---|---|---|
| 0 — Manual validation | Run the concept manually with 5 testers via Google Form + manually generated plans (Doc/Sheet) sent by email/WhatsApp | Google Forms, AI chat, email/WhatsApp |
| 1 — Tester app | Build the app end-to-end with Kiro generating code from this spec, hosted on AWS as above | Kiro + AWS (Amplify, Cognito, Lambda, DynamoDB, Bedrock) |
| 2 — Scale/Monetise | Add payments, B2B admin, content scaling | Revisit once tester data validates the model |

## 10. Open Questions / Decisions Needed

- Where the curated content library is sourced/maintained (manual curation vs semi-automated discovery)
- Monetisation model (B2C subscription vs B2B licensing) — to be decided after tester feedback

## 11. Future Considerations (Post-Tester)

- B2B licensing to company L&D teams
- Expanded personas (QA, Finance professionals, other roles)
- Certificates/LinkedIn-shareable completion badges
- Community/cohort accountability features
- Monthly content refresh cadence as AI tooling evolves

---

*This is a living document — expected to evolve as tester feedback comes in.*
