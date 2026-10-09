# PHASE 11 — CAREER INTELLIGENCE V1
## ARCHITECTURE & FEASIBILITY AUDIT REPORT

**Date:** October 6, 2026  
**Phase:** 11 (Career Intelligence V1) — Batch 1 (Audit Only)  
**Status:** COMPLETE (Zero Production Code Changes)  

---

## 1. Executive Summary

Phase 11 initiates the transition of CareerOS from an opportunity discovery and operational tracking platform into an intelligent, personalized career navigation system. The master product roadmap identifies three core intelligence differentiators for Career Intelligence V1:
1. **Opportunity-to-Action Engine:** Transforming saved opportunities and skill gaps into structured, actionable preparation workflows (todos, learning resources, calendar milestones).
2. **"Why You Match" Intelligence:** Providing deterministic, transparent explanations of candidate-opportunity fit (highlighting verified strengths, technology alignments, and specific missing requirements).
3. **GitHub Proof-of-Work Integration:** Bridging self-reported student profile claims with demonstrated evidence (repositories, languages, commits, recency).

This audit conducts a non-invasive, comprehensive architectural inspection across the entire frontend and backend codebases. It documents existing data structures, evaluates current ingestion scoring algorithms, identifies integration surfaces, establishes strict deterministic boundaries (zero reliance on external AI/LLM APIs for core scoring), and defines a safe, modular implementation roadmap for subsequent batches.

---

## 2. Existing Profile Intelligence

The student profile is defined by [`server/src/models/User.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/User.js) and [`server/src/models/Profile.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Profile.js), exposed via [`server/src/controllers/profile.controller.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/controllers/profile.controller.js) and [`src/pages/Profile/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/Profile/index.jsx).

### 2.1 Profile Field Inventory & Classification

| Profile Field | Model Schema Location | Stored Type | Classification | Usable for Deterministic Matching | Notes & Intelligence Usability |
|:---|:---|:---|:---:|:---:|:---|
| **Full Name / Personal** | `personal.firstName`, `lastName`, `displayName` | String | A. Structured | No | Display only; identity verification. |
| **Location** | `personal.location.{city, state, country}` | Object | A. Structured | **Yes** | Geographic eligibility & commute/relocation match. |
| **Education: Degree** | `education[].degree` | String | B. Semi-structured | **Yes** | Normalizable against `eligibility.educationLevels`. |
| **Education: Field/Branch**| `education[].fieldOfStudy` | String | B. Semi-structured | **Yes** | Normalizable against `eligibility.branches` (e.g. "CSE", "IT"). |
| **Education: Years** | `education[].{startYear, endYear, current}` | Number, Boolean | A. Structured | **Yes** | Computes expected graduation year for internship cutoff matching. |
| **Education: CGPA** | `education[].cgpa` | Number (0-10) | A. Structured | **Yes** | Can match minimum academic cutoffs. |
| **Skills** | `skills[].{name, level}` | String, Enum | A. Structured | **Yes (Primary)** | Lowercase names; level: `beginner`, `intermediate`, `advanced`, `expert`. |
| **Interests** | `interests[]` | Array of Strings | B. Semi-structured | **Yes** | Topic interest matching against opportunity tags/categories. |
| **Projects: Title & Desc** | `projects[].{title, description}` | String | C. Free text | Limited | Keyword extraction possible, but freeform. |
| **Projects: Technologies** | `projects[].technologies[]` | Array of Strings | B. Semi-structured | **Yes (Secondary)**| Strong evidence of applied skill. |
| **Projects: Repository URL**| `projects[].githubUrl` | URL String | A. Structured | **Yes** | Link to external proof of work; extractable repo identifier. |
| **Projects: Live URL** | `projects[].liveUrl` | URL String | A. Structured | No | Proof of deployment; not parsed for skills. |
| **Experience: Role & Org** | `experience[].{role, organization}` | String | B. Semi-structured | **Yes** | Past title & company matching; tenure calculation. |
| **Experience: Dates** | `experience[].{startDate, endDate, current}`| Date, Boolean | A. Structured | **Yes** | Total months of experience computation. |
| **Experience: Description** | `experience[].description` | String | C. Free text | Limited | Freeform description text. |
| **Certifications** | `certifications[].{name, issuer, credentialUrl}` | String, URL | B. Semi-structured | Partially | Credential evidence. |
| **Achievements** | `achievements[].{title, description, url}` | String, URL | C. Free text | No | Honors / contest awards. |
| **Professional Links** | `professionalLinks.{github, linkedin, leetcode, ...}` | URL Strings | A. Structured | **Yes** | Profile handles extractable from URLs. |
| **Documents / Resumes** | `documents[].{name, type, url}` | String, Enum, URL| B. Semi-structured | No | Document metadata only; document text is unparsed. |
| **Career Preferences** | `careerPreferences.{opportunityTypes, workModes, locations, domains}` | String Arrays | A. Structured | **Yes** | Direct candidate preference filter alignment. |
| **Career Goal** | `careerGoal.title` | String | B. Semi-structured | Partially | Target role string (e.g., "Full Stack Developer"). |

### 2.2 Key Profile Intelligence Insights
- **High Deterministic Value:** `skills` (with proficiency levels), `careerPreferences`, `education.endYear` (grad year), `education.fieldOfStudy`, `projects.technologies`, and `personal.location` are already structured in MongoDB.
- **Current Limitation:** Profile skills are self-reported with uncurated freeform names (e.g., user can input `"react"`, `"React.js"`, or `"reactjs"`). There is no canonical skill dictionary enforcing alias normalization on write.

---

## 3. Existing Opportunity Data Intelligence

The opportunity data foundation is defined in [`server/src/models/Opportunity.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Opportunity.js) and normalized via [`server/src/services/ingestion/normalizer.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/ingestion/normalizer.js).

### 3.1 Opportunity Field Inventory & Reliability

| Opportunity Field | Stored Type | Ingestion Reliability | Usability for Deterministic Matching | Notes & Edge Cases |
|:---|:---|:---:|:---:|:---|
| `title` | String | A. Reliable | **Yes** | Cleaned and stripped of noise prefixes in `normalizer.js`. |
| `organization` | String | A. Reliable | **Yes** | Cleaned of legal suffixes (`Inc`, `LLC`). |
| `type` | Enum (12 values) | A. Reliable | **Yes** | Normalized enum (`internship`, `hackathon`, `workshop`, etc.). |
| `skills` | Array of Strings | B. Partially reliable | **Yes (Core)** | Lowercased, comma/slash split, but source-dependent. |
| `tags` | Array of Strings | B. Partially reliable | **Yes** | Category tags (e.g. `frontend`, `ai`, `web3`). |
| `workMode` | Enum (`remote`, `onsite`, `hybrid`, `online`) | A. Reliable | **Yes** | Reliable across normalized sources. |
| `location` | Object (`country`, `state`, `city`) | B. Partially reliable | **Yes** | High reliability for remote/India; variable city granularity. |
| `eligibility.educationLevels` | Array of Strings | C. Noisy | Partially | Ingested sources rarely provide structured eligibility; defaults empty. |
| `eligibility.branches` | Array of Strings | C. Noisy | Partially | Rarely populated in scraped external job feeds. |
| `eligibility.graduationYears` | Array of Numbers | C. Noisy | Partially | Often buried in description free text. |
| `deadline` | Date | A. Reliable | **Yes** | Standard ISO Date; essential for urgency & action scheduling. |
| `eventDate` / `endDate` | Date | B. Partially reliable | **Yes** | Applicable for hackathons/contests/events. |
| `description` | String | A. Reliable | **Yes (Keyword)** | Rich text / plain text; source of unextracted skill mentions. |
| `shortDescription` | String | B. Partially reliable | Limited | Snippet summary. |
| `stipend` / `prize` | Object (`amount`, `currency`, `period`) | B. Partially reliable | Informational | Structured if parsed from source. |
| `applicationUrl` / `registrationUrl` | URL String | A. Reliable | Operational | Direct external action endpoint. |
| `qualityScore` / `relevanceScore` | Number (0-100) | A. Reliable | Prioritization | Calculated during ingestion by `scoring.service.js`. |

### 3.2 Requirements Structuring Assessment
- **Sufficient for V1:** Opportunities have clean `type`, `workMode`, `skills` (lowercased), `tags`, and `deadline`.
- **Gaps for Matching:** Many ingested job posts have sparse `skills` arrays (e.g., 2 skills listed while description mentions 10 technologies). A deterministic keyword extraction helper from `description` will significantly increase match recall without requiring AI.

---

## 4. Scoring Engine Audit

The existing scoring engine is located in [`server/src/services/ingestion/scoring.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/ingestion/scoring.service.js) and verified by [`server/tests/services/scoring.test.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/tests/services/scoring.test.js).

### 4.1 Detailed Engine Specifications
1. **Inputs:** Single normalized opportunity document (`opp`). Takes **no** user profile or candidate context.
2. **Outputs:** Three integer scores (0–100):
   - `completenessScore`: Hygiene and metadata completeness.
   - `relevanceScore`: General platform fit for Indian CSE students.
   - `qualityScore`: Composite quality metric.
3. **Score Range:** Bounded strictly between `0` and `100` via `Math.floor(Math.min(Math.max(score, 0), 100))`.
4. **Factors & Weights:**
   - **Completeness (100 pts max):** Core Identity (40 pts), Description length (30 pts), Actionable URL (10 pts), Logistics (15 pts), Enrichment (5 pts).
   - **Relevance (100 pts max):** Audience fit (40 pts), Domain/CSE keywords (30 pts), Geography/India/Remote (30 pts).
   - **Quality Score:** `(Completeness * 0.4) + (Relevance * 0.6) - Penalties` (e.g. -30 penalty if missing actionable URL).
5. **Determinism Guarantees:** 100% pure functions. No database lookups, no network calls, no asynchronous operations, no random numbers, no external API dependencies.
6. **Missing-Field Behavior:** Gracefully returns `0` for `null` or `undefined` without throwing.
7. **Explainability:** Current engine does not emit explainability metadata; it returns raw scalar numbers.
8. **Current Limitations:** **It is an ingestion-level data filter, NOT a candidate matching engine.** It evaluates whether an opportunity is high-quality for the platform, not whether *Alex* or *Priya* is qualified for it.

### 4.2 Recommendation on Scoring Architecture
- **Option Chosen: B. Wrapped by a personalized intelligence layer.**
- **Rationale:** 
  - Keep `calculateQualityScore`, `calculateCompletenessScore`, and `calculateRelevanceScore` intact for ingestion pipeline filtering and baseline sorting.
  - Create a new dedicated candidate match service (`match.service.js` or `fit.service.js`) that takes `(profile, opportunity)` as inputs.
  - The personalized fit score will blend:
    1. **Skill Match (50%):** Overlap between profile skills/project technologies and opportunity required skills.
    2. **Preference Alignment (25%):** Work mode (`remote` vs `onsite`), opportunity type, and domain.
    3. **Eligibility & Experience (15%):** Education year, branch, and years of experience.
    4. **Opportunity Baseline Quality (10%):** Ingestion `qualityScore` to discount low-quality listings.

---

## 5. Saved Opportunity Flow Audit

### 5.1 Real Production Flow Trace

```
1. Discover (/opportunities)
   ├── Browse feed (search, category, work mode, sort)
   ├── View OpportunityCard (metadata, skills, save bookmark)
   └── Click "View Details"
        ↓
2. Opportunity Detail (/opportunities/:id)
   ├── Inspect full requirements, eligibility, tech stack
   ├── CTAs: Save, Add to Calendar, Mark as Applied/Registered, Apply Externally
   └── Click "Save" (SavedOpportunityContext.toggleSave)
        ↓
3. Saved Opportunities (/saved)
   ├── Lists all user-saved opportunities (paginated via SavedOpportunity collection)
   ├── Tab filters: All Saved, Interested, Applied, Expired
   └── Action: Unsave, Track Application, External Apply
        ↓
4. Application Tracking (/applications)
   ├── Created via Opportunity Detail CTA or Applications board
   ├── Manages lifecycle: applied → interview → waiting → selected / rejected
   └── Stores personal tracking notes, external URL, appliedAt timestamp
        ↓
5. Calendar Integration (/calendar)
   ├── Automatic backend sync (calendarSync.service.js) creates CalendarEvent on registration/application
   └── User can also manually "Add to Calendar" from Opportunity Detail
        ↓
6. Notifications (/notifications)
   ├── Automated background generation (notificationGeneration.service.js)
   └── Triggers deadline alerts and reminder worker notices
        ↓
7. Daily Execution (Todos / Goals / Learning)
   ├── Todos (/todos): Independent student task board
   ├── Goals (/goals): Independent target metrics with deadlines
   └── Learning (/learning): Predefined curriculum tracks (Frontend, Backend, Cloud, DSA)
```

### 5.2 Opportunity-to-Action Engine Integration Points
The audit identifies the exact seams where candidate intelligence connects into this flow:
- **At Opportunity Detail (`/opportunities/:id`):**
  - Add a **"Why You Match" Intelligence Panel** below the header banner.
  - Display Match Percentage, Verified Strengths, and Missing Skill Gaps.
- **At Saved Opportunity (`/saved`):**
  - Display match badge (`88% Match`) on cards.
  - Add a **"Generate Preparation Plan"** action button on saved cards.
- **At Opportunity-to-Action Bridge:**
  - Clicking "Prepare" creates a linked set of **Todos** (e.g., `"Review Docker containerization for Backend Intern at Acme"`), suggests matching **Learning Tracks** (e.g., `"Backend Engineering Track - Docker Module"`), and schedules a **Calendar Milestone** 3 days before the deadline.

---

## 6. GitHub Integration Audit

### 6.1 Current Repository Findings
1. **Existing GitHub Code:** Zero GitHub API clients exist in the codebase. No `@octokit/rest` or OAuth libraries are installed in `package.json` or `server/package.json`.
2. **Identity Storage:** GitHub handles/URLs are stored in exactly two places:
   - `Profile.professionalLinks.github`: Freeform URL string (e.g., `https://github.com/alex-chen-demo`).
   - `Profile.projects[].githubUrl`: Freeform repository URL string (e.g., `https://github.com/alex-chen-demo/devsync`).
3. **Settings Page:** `src/pages/Settings/index.jsx` contains static mock markup `{ name: 'GitHub', handle: '@alex-chen-demo', connected: true }` without underlying backend data.

### 6.2 Key Architectural Questions Answered
1. *Does any GitHub integration already exist?* No. Only unvalidated URL strings in MongoDB profile documents.
2. *Is GitHub identity stored anywhere?* Only as raw URLs in `Profile`.
3. *Can profile data support a GitHub handle?* Yes. A handle can be extracted via regex from `professionalLinks.github` (e.g., `github.com/([a-zA-Z0-9-]+)`), or stored as a structured field.
4. *Can the current auth architecture support future OAuth?* Yes. The existing session architecture (JWT + HttpOnly refresh cookies) can accommodate a standard OAuth2 callback route (`GET /api/auth/github/callback`) linking a `githubId` or `githubUsername` to the authenticated `User` record.
5. *What minimum GitHub data is required for V1?*
   - Public repository metadata: Repository names, descriptions, primary languages, topic tags, commit count/activity recency, star count, and `isFork` status.
   - **Zero OAuth write scopes required:** Public GitHub REST API (`https://api.github.com/users/{username}/repos`) provides this without requiring user OAuth tokens, though an optional personal token or OAuth read-only token avoids public rate limiting (60 req/hr unauthenticated vs 5,000 req/hr authenticated).
6. *What data could be derived from repositories?*
   - **Demonstrated Languages & Frameworks:** (e.g. TypeScript, Python, Go).
   - **Repository Recency:** Pushed in the last 30/90 days.
   - **Original Work vs Fork:** Filtering out forks to evaluate genuine student work.
7. *What data should NOT be stored permanently?*
   - Full code trees, file contents, git commit blobs, commit messages, raw PR diffs, or email addresses. Only store structured aggregates: `{ repoName, language, stars, lastPushedAt, topics }`.

---

## 7. "Why You Match" Audit

The "Why You Match" intelligence engine requires a deterministic data contract that explains fit without black-box AI hallucinations.

### 7.1 Required Output Contract
```typescript
interface WhyYouMatchResult {
  opportunityId: string;
  overallScore: number; // 0-100
  tier: 'High' | 'Medium' | 'Low'; // >=75: High, 50-74: Medium, <50: Low
  strengths: {
    matchingSkills: Array<{ skill: string; profileLevel: string; demonstratedInProjects: boolean }>;
    matchingPreferences: Array<{ factor: string; detail: string }>; // e.g. "Work Mode: Remote matches your preference"
    relevantProjects: Array<{ title: string; matchingTechnologies: string[]; githubUrl?: string }>;
  };
  gaps: {
    missingRequiredSkills: string[];
    missingPreferredSkills: string[];
    suggestedFocus: string[]; // Top 2-3 skills to bridge the gap
  };
  explanation: {
    headline: string; // e.g. "Strong Match: 4 of 5 core technologies in your stack"
    summary: string;
    actionableAdvice: string;
  };
}
```

### 7.2 Deterministic Explanation Rules
- **Rule 1 (Skill Overlap):** If candidate has >= 75% of opportunity skills $\rightarrow$ Headline: *"Strong match for your core skill set."*
- **Rule 2 (Demonstrated Evidence):** If matching skills appear in candidate's `projects[].technologies` $\rightarrow$ Strengths: *"You have built projects using React and Node.js."*
- **Rule 3 (Preference Match):** If `opportunity.workMode === profile.careerPreferences.preferredWorkModes` $\rightarrow$ Strengths: *"Matches your preferred Remote work mode."*
- **Rule 4 (Gap Highlight):** If opportunity requires `Docker` and candidate lacks it $\rightarrow$ Gaps: *"Missing required skill: Docker."* Advice: *"Complete the Docker containerization module to improve your fit."*

---

## 8. Skill Intelligence Audit

### 8.1 Current Representation
- **In `Profile.skills`:** `{ name: String (lowercase, trim), level: 'beginner'|'intermediate'|'advanced'|'expert' }`
- **In `Profile.projects`:** `technologies: [String]` (freeform)
- **In `Opportunity.skills`:** `skills: [String]` (lowercased in normalizer)

### 8.2 The Canonical Skill Representation Gap
Currently, string variance causes false negatives in matching:
- `react` $\neq$ `reactjs` $\neq$ `react.js`
- `node` $\neq$ `nodejs` $\neq$ `node.js`
- `cpp` $\neq$ `c++`
- `ts` $\neq$ `typescript`
- `golang` $\neq$ `go`
- `mongo` $\neq$ `mongodb`

### 8.3 Minimum Deterministic Taxonomy Required for V1
Instead of creating a heavyweight database schema for skills in V1, a deterministic **Skill Canonicalizer & Synonym Dictionary** utility (`server/src/utils/skillCanonicalizer.js`) should be introduced.
- Maps aliases to canonical slugs:
  ```javascript
  const SKILL_ALIASES = {
    'reactjs': 'react', 'react.js': 'react',
    'nodejs': 'node.js', 'node': 'node.js',
    'typescript': 'typescript', 'ts': 'typescript',
    'javascript': 'javascript', 'js': 'javascript',
    'cpp': 'c++', 'cplusplus': 'c++',
    'golang': 'go',
    'postgres': 'postgresql', 'psql': 'postgresql',
    'mongo': 'mongodb',
    'aws': 'cloud_aws', 'amazon web services': 'cloud_aws',
    'docker': 'docker', 'k8s': 'kubernetes'
  };
  ```
- Normalizes comparisons: `canonicalizeSkill(a) === canonicalizeSkill(b)`.

---

## 9. Opportunity-to-Action Audit

### 9.1 Conceptual Pipeline & Entity Mapping

```
Opportunity (ID, Title, Deadline, Skills)
   ↓
[Skill Gap Detection] (Identifies missing skills, e.g., Docker, Redux)
   ↓
[Preparation Plan Generator] (Generates structured preparation roadmap)
   ↓
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│          Todo           │     Learning Track      │     Calendar Event      │
│ (Preparation Checklist) │   (Curriculum Track)    │   (Deadline Milestone)  │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
   ↓
Notification & Reminder Worker Alerts
   ↓
Application Tracker (applied / interview / offer)
```

### 9.2 Reusability Matrix

| Pipeline Step | Reusable Existing Entity | Required New Entity / Structure | Required New API | Required Frontend Surface |
|:---|:---|:---|:---|:---|
| **Skill Gaps** | None (computed in memory) | `GapAnalysis` data transfer object | `GET /api/intelligence/opportunities/:id/fit` | "Why You Match" section on Detail page |
| **Preparation Items**| None | `PreparationPlan` (can be stored in new collection or generated on-the-fly) | `POST /api/intelligence/opportunities/:id/plan` | "Action Plan" modal / drawer |
| **Todo Generation** | `Todo` model (`category: 'Application'`, `priority: 'High'`) | None! Directly creates `Todo` documents with `opportunityId` or title reference | `POST /api/todos` (or bulk creation endpoint) | Visible on `/todos` with badge |
| **Learning Track Link**| `LearningTrack` & `LearningResource` | Mapping between canonical skills and `LearningTrack.category` | `GET /api/learning/tracks?skill=...` | "Recommended Learning" card |
| **Calendar Milestones**| `CalendarEvent` (`type: 'deadline' \| 'reminder'`, `source: 'opportunity'`) | None! `calendarSync.service.js` already handles event synchronization | `POST /api/calendar/events` | Visible on `/calendar` |
| **Reminders** | `Notification` & `reminder.worker.js` | None! `notificationGeneration.service.js` already generates notifications | Handled by existing background worker | Toast / Notification Center |
| **Application Tracker**| `Application` model | None! Already stores tracking status and notes | `POST /api/applications` | Visible on `/applications` |

---

## 10. Career Profile Intelligence: Claimed vs Demonstrated Skills

A core architectural distinction in Career Intelligence V1 is between:
1. **Claimed Skill:** A skill the student added to their profile (`Profile.skills`).
   - Confidence: Low/Medium (self-assessed).
   - Value: Necessary starting point for student aspirations.
2. **Demonstrated Skill:** A skill verified through external or internal artifacts.
   - **Internal Artifacts:** Technologies referenced in `Profile.projects` and completed `UserLearningProgress` modules.
   - **External Artifacts:** Repositories, languages, and commit recency discovered through the student's linked GitHub account.
   - Confidence: High (verifiable proof of work).

### V1 Verification Weighting
When scoring match fit:
- Matching on a *Demonstrated Skill* carries **1.5x weight** compared to a purely *Claimed Skill*.
- Display in UI: Badges showing *"Demonstrated in Project: DevSync"* or *"Verified via GitHub"*.

---

## 11. Application Intelligence

### 11.1 Current Application Data Foundation
The `Application` model ([`server/src/models/Application.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Application.js)) stores:
- `type`: `'application'` | `'registration'`
- `status`: `'applied'`, `'interview'`, `'waiting'`, `'selected'`, `'rejected'`, `'withdrawn'` (or registration statuses)
- `appliedAt`, `registeredAt`
- `notes` (freeform tracking notes)
- `externalUrl`
- Indexed by `(userId, opportunityId, type)`.

### 11.2 Future Intelligence Opportunities
1. **Application Health & Momentum:** Calculating time spent in `'applied'` or `'interview'` stages without updates.
2. **Deadline Risk Alerts:** Proactive warnings when a saved opportunity is 48 hours from deadline with zero tracking record created.
3. **Funnel Analytics (V2):** Ratio of applications to interviews per domain (deferred to post-V1).

---

## 12. Data Model Gaps

### 12.1 Existing Models (Fully Operational)
- `User`, `Profile`, `Opportunity`, `OpportunitySource`, `OpportunityIngestionRun`, `SavedOpportunity`, `Application`, `CalendarEvent`, `Notification`, `Todo`, `Goal`, `Tracker`, `LearningTrack`, `LearningItem`, `LearningResource`, `UserLearningProgress`, `Note`, `Contest`.

### 12.2 New Models / Schemas Needed for Career Intelligence V1
To prevent schema bloat and preserve backward compatibility, Career Intelligence V1 requires **minimal** schema changes:
1. **Option A (Lean / Ephemeral):** Compute match and gaps on-the-fly without a persistent `MatchResult` collection. Match results are pure functions of `(Profile, Opportunity)`.
   - *Advantage:* Zero storage, zero cache invalidation bugs when profile updates, 100% deterministic.
   - *Recommendation:* **Adopt Option A for Match Scoring.**
2. **GitHub Cache Model (`GitHubProfile` or sub-document in `Profile`):**
   - Stores cached public repository summaries and sync timestamp to prevent API rate limits:
     ```javascript
     {
       userId: ObjectId,
       username: String,
       lastSyncedAt: Date,
       repositories: [{
         name: String,
         description: String,
         language: String,
         topics: [String],
         stars: Number,
         pushedAt: Date,
         isFork: Boolean,
       }],
       topLanguages: [String],
     }
     ```
3. **Preparation Plan Reference in `Todo` / `CalendarEvent`:**
   - Existing `Todo` and `CalendarEvent` schemas already have `opportunityId` or freeform notes. Adding an optional `sourceRef` or `opportunityId` on `Todo` enables grouping opportunity-generated todos cleanly.

---

## 13. API Gaps

The current API catalog does not have dedicated intelligence endpoints. The following minimal endpoints are required for V1:

| Proposed Endpoint | Method | Purpose | Auth Required |
|:---|:---:|:---|:---:|
| `/api/intelligence/opportunities/:id/fit` | `GET` | Computes personalized fit score, strengths, and skill gaps for the authenticated student. | Yes (`student`) |
| `/api/intelligence/opportunities/:id/plan` | `POST` | Generates and commits preparation action items (creates linked Todos and Calendar deadline milestones). | Yes (`student`) |
| `/api/intelligence/github/sync` | `POST` | Fetches and refreshes student's public GitHub portfolio data into cache. | Yes (`student`) |
| `/api/intelligence/github/summary` | `GET` | Returns aggregated proof-of-work evidence (top languages, active repos). | Yes (`student`) |

---

## 14. Frontend / UX Gaps

### 14.1 Screen Audit
- **Opportunity Detail (`/opportunities/:id`):** Currently displays standard metadata. Needs a new component: `<MatchIntelligenceCard />` displaying Match Score %, Strengths, Gaps, and "Prepare Action Plan" CTA.
- **Opportunities Feed (`/opportunities`):** Currently sorts by date/featured. In V1, can display a compact `<MatchScoreBadge score={85} />` on `OpportunityCard`.
- **Saved Opportunities (`/saved`):** Needs a direct "Generate Preparation Plan" action button.
- **Profile (`/profile`):** Needs a verified GitHub sync button and proof-of-work summary badge list.

---

## 15. Deterministic vs AI Boundary

To maintain operational reliability, determinism, testability, and zero runtime API cost, Career Intelligence V1 enforces a strict boundary:

```
┌────────────────────────────────────────────────────────────────────────┐
│               STRICTLY DETERMINISTIC IN V1 (NO AI)                     │
│  - Skill Canonicalization & Synonym Normalization                     │
│  - Set Overlap Match Percentage Calculation                            │
│  - Geographic, Work Mode, and Eligibility Filtering                    │
│  - Skill Gap Detection (Opportunity Skills \ Profile Skills)           │
│  - Why You Match Explanations (Template-Driven Rules)                 │
│  - Preparation Plan Generation (Rule-based Mapping to Todos)          │
│  - GitHub Repository Language & Metadata Aggregation                   │
│  - Database Transactions & IDOR Authorization Boundaries               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│               OPTIONAL FUTURE AI (DEFERRED TO V2+)                     │
│  - Natural-language resume tailoring suggestions                       │
│  - Unstructured JD semantic summarization                              │
│  - Synthetic mock interview questions generation                       │
│  - Freeform conversational career advisory bot                         │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> **V1 Constraint:** No external LLM/AI APIs (OpenAI, Gemini, Anthropic) will be integrated in Phase 11. All matching, gap detection, and explanation generation must remain 100% deterministic, offline-testable, and reproducible in Vitest.

---

## 16. Security & Privacy Considerations

1. **User Ownership & IDOR Protection:**
   - Any intelligence analysis endpoint must read the profile exclusively from `req.auth.userId`.
   - Never accept a target `userId` in query parameters or request bodies for candidate fit.
2. **GitHub Data Minimization:**
   - Only fetch and store metadata from public repositories.
   - Do NOT store or request access to private repositories in V1.
   - Do NOT store user source code files or git commit contents.
3. **Rate Limiting & Caching:**
   - Outgoing calls to GitHub API must be throttled and cached (minimum 6-hour cache TTL per user).
   - Dedicated rate limiter on `/api/intelligence/github/sync` to prevent abuse.
4. **Data Leakage Safeguards:**
   - Match results must never leak private application notes or private profiles across users.
   - Student profile data is strictly visible only to the owning student and administrators.

---

## 17. Testing Strategy

Following the established Vitest architecture (sequential execution, in-memory MongoDB replica set):

1. **Deterministic Matching Consistency:**
   - Identical `(profile, opportunity)` input must always produce the identical integer score.
   - Symmetric test cases verifying edge conditions (0% match, 100% match, partial match).
2. **Synonym & Canonicalization Tests:**
   - Test that `react` matches `ReactJS`, `node` matches `nodejs`, `cpp` matches `c++`.
3. **Missing Data Handling:**
   - Empty profile skills $\rightarrow$ score reflects baseline preference/quality without crashing.
   - Empty opportunity skills $\rightarrow$ graceful fallback to description keyword matching.
4. **Gap Detection Accuracy:**
   - Mathematical difference set validation: $Gaps = OppSkills \setminus ProfileSkills$.
5. **IDOR & Security Boundary Tests:**
   - Verify that User A cannot request match data or trigger action plans for User B.
6. **Action Plan Generation Tests:**
   - Confirm that generating a preparation plan idempotently creates `Todo` items and does not create duplicate tasks on re-run.

---

## 18. Recommended Implementation Roadmap

To maintain engineering discipline and zero disruption to the existing test gate (698/698 passing), Phase 11 is divided into sequential, verified batches:

```
┌──────────────────────────────────────────────────────────────┐
│  Phase 11A: Intelligence Architecture Audit (THIS BATCH)     │
│  - Audit complete, contracts defined, zero code modified.    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11B: Canonical Skill Intelligence Foundation          │
│  - Skill canonicalization dictionary & alias normalizer.     │
│  - Deterministic skill extractor from opportunity text.      │
│  - Comprehensive Vitest test suite for skill matching.       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11C: Candidate Opportunity Fit Engine                 │
│  - Pure function fit score calculator (profile x opp).       │
│  - Skill overlap, work mode, eligibility, experience factors.│
│  - Backend GET /api/intelligence/opportunities/:id/fit.       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11D: "Why You Match" & Skill Gap Intelligence         │
│  - Deterministic Strengths & Gaps explanation generator.     │
│  - Frontend UI: Match score badge & "Why You Match" card.    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11E: Opportunity-to-Action Engine                     │
│  - Backend POST /api/intelligence/opportunities/:id/plan.    │
│  - Automated Todo creation, Learning Track linkage, Calendar.│
│  - Frontend "Prepare for Opportunity" modal & action flow.   │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11F: GitHub Proof-of-Work Integration                 │
│  - Public GitHub repository metadata sync service.           │
│  - Demonstrated skill extraction from repos & languages.     │
│  - Boost fit score confidence for demonstrated skills.       │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│  Phase 11G: Career Intelligence V1 End-to-End Verification   │
│  - Full regression test run, Docker stack smoke tests, docs. │
└──────────────────────────────────────────────────────────────┘
```

---

## 19. V1 Scope

- **In Scope for Phase 11 V1:**
  - Canonical skill normalization dictionary.
  - Deterministic `(profile, opportunity)` personalized fit score (0–100).
  - "Why You Match" transparent breakdown (Strengths, Gaps, Advice).
  - Opportunity-to-Action workflow: generating linked Todos, Learning Track recommendations, and Calendar deadline events from saved opportunities.
  - Public GitHub repository metadata synchronization and demonstrated skill badges.
  - Complete Vitest test coverage and zero regression across existing 698 tests.

---

## 20. Out-of-Scope Items (Deferred to V2+)

- **Out of Scope for Phase 11 V1:**
  - External LLM / AI API integrations (OpenAI, Gemini, Anthropic).
  - Private GitHub repository OAuth tokens or code inspection.
  - Parsing uploaded PDF/DOCX resume documents.
  - Complex multi-tenant institutional analytics dashboards.
  - Automated external application form autofill / browser extension scraping.

---

## 21. Exact Files Inspected

### Backend Schemas & Config
- [`server/src/models/User.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/User.js)
- [`server/src/models/Profile.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Profile.js)
- [`server/src/models/Opportunity.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Opportunity.js)
- [`server/src/models/SavedOpportunity.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/SavedOpportunity.js)
- [`server/src/models/Application.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Application.js)
- [`server/src/models/CalendarEvent.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/CalendarEvent.js)
- [`server/src/models/Notification.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Notification.js)
- [`server/src/models/Todo.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Todo.js)
- [`server/src/models/Goal.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Goal.js)
- [`server/src/models/Tracker.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Tracker.js)
- [`server/src/models/LearningTrack.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/LearningTrack.js)
- [`server/src/models/LearningItem.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/LearningItem.js)
- [`server/src/models/LearningResource.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/LearningResource.js)
- [`server/src/models/UserLearningProgress.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/UserLearningProgress.js)
- [`server/src/models/Note.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/models/Note.js)
- [`server/package.json`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/package.json)
- [`package.json`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/package.json)

### Backend Services & Controllers
- [`server/src/services/ingestion/scoring.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/ingestion/scoring.service.js)
- [`server/src/services/ingestion/normalizer.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/ingestion/normalizer.js)
- [`server/src/services/opportunity.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/opportunity.service.js)
- [`server/src/controllers/opportunity.controller.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/controllers/opportunity.controller.js)
- [`server/src/services/profile.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/profile.service.js)
- [`server/src/controllers/profile.controller.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/controllers/profile.controller.js)
- [`server/src/services/savedOpportunity.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/savedOpportunity.service.js)
- [`server/src/services/calendarSync.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/calendarSync.service.js)
- [`server/src/services/notificationGeneration.service.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/src/services/notificationGeneration.service.js)
- [`server/tests/services/scoring.test.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/server/tests/services/scoring.test.js)

### Frontend Pages & Services
- [`src/pages/OpportunityDetail/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/OpportunityDetail/index.jsx)
- [`src/pages/Opportunities/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/Opportunities/index.jsx)
- [`src/pages/Saved/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/Saved/index.jsx)
- [`src/pages/Applications/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/Applications/index.jsx)
- [`src/pages/Profile/index.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/pages/Profile/index.jsx)
- [`src/components/cards/OpportunityCard.jsx`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/components/cards/OpportunityCard.jsx)
- [`src/services/opportunityApi.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/services/opportunityApi.js)
- [`src/services/savedOpportunityApi.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/services/savedOpportunityApi.js)
- [`src/services/applicationApi.js`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/src/services/applicationApi.js)

---

## 22. Exact Files Created
- [`PHASE_11_INTELLIGENCE_AUDIT.md`](file:///Users/ritweek/Desktop/Student-Help/Student-Help/PHASE_11_INTELLIGENCE_AUDIT.md)

---

## 23. Exact Files Modified
- **Zero production code files modified.** (Batch 1 was strictly audit and documentation).
