# Paw-Palja Development Guide

> AI-powered Dog Diary & Health Management App

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Backend Details](#5-backend-details)
6. [Frontend Details](#6-frontend-details)
7. [AI Agent System](#7-ai-agent-system)
8. [Database Schema](#8-database-schema)
9. [Authentication System](#9-authentication-system)
10. [Internationalization (i18n)](#10-internationalization-i18n)
11. [Social Features](#11-social-features)
12. [Push Notifications](#12-push-notifications)
13. [API Reference](#13-api-reference)
14. [Local Development](#14-local-development)
15. [Production Deployment](#15-production-deployment)
16. [Environment Variables](#16-environment-variables)

---

## 1. Project Overview

**Paw-Palja** is a mobile-first web application where dog owners record their pet's daily activities (mood, food, walk, poop, notes, photos), and an **AI multi-agent system** generates:

- A personalized **diary entry** written from the dog's perspective
- A **daily horoscope/fortune** with lucky items and interaction tips
- A **health analysis** with risk assessment based on the logged data
- **AI persona comments** that react to the diary like social media friends

The app supports **5 languages** (Korean, English, Japanese, Chinese, Spanish) with full i18n for both frontend and backend AI-generated content.

### Key Features

| Feature | Description |
|---------|-------------|
| AI Diary Generation | LangGraph multi-agent pipeline generates diary, horoscope, health analysis |
| AI Comments | Persona-based comment agents (e.g., "Popy-unni", "Churu-captain", "Elder-dog") react to diaries via SSE streaming |
| Social Feed | Public diary sharing with paginated feed, share links, public profiles |
| Health Analysis | Chain-of-thought reasoning for health risk assessment with breed-specific context |
| RAG Pipeline | ChromaDB vector store for meme references and breed health data |
| Push Notifications | Web Push (VAPID) for daily diary reminders |
| Multi-language | Full i18n with dual-language AI content generation (ko+en, ja, zh, es) |
| Admin Dashboard | User/diary statistics, engagement analytics, agent usage tracking |
| Mobile Support | Capacitor wrapper for native iOS/Android builds |

---

## 2. Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | Async Python web framework |
| **SQLAlchemy 2.0** (async) | ORM with async session support |
| **PostgreSQL** | Production database (via asyncpg) |
| **SQLite** | Local development database (via aiosqlite) |
| **Redis** | Caching (horoscope results) + rate limiting |
| **LangGraph** | Multi-agent orchestration framework |
| **LangChain** | LLM abstraction layer |
| **ChromaDB** | Vector database for RAG pipeline |
| **ARQ** | Async task queue for background LLM processing |
| **APScheduler** | Scheduled tasks (push notification reminders) |
| **SlowAPI** | Rate limiting middleware |
| **PyWebPush** | Web Push notification delivery |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **Vite 7** | Build tool and dev server |
| **react-router-dom v7** | Client-side routing |
| **Motion (Framer Motion)** | Page transitions and animations |
| **i18next** | Internationalization framework |
| **html2canvas** | Diary screenshot/capture feature |
| **Capacitor 6** | Native mobile wrapper (iOS/Android) |

### LLM Providers (switchable via env var)
| Provider | Model | Usage |
|----------|-------|-------|
| **Google Gemini** | gemini-2.0-flash | Default provider (free tier available) |
| **Azure OpenAI** | GPT-4o | Enterprise/internal use |

---

## 3. Project Structure

```
pawpalja/
├── backend/
│   ├── main.py                 # FastAPI app entry point, middleware, router registration
│   ├── agents.py               # LangGraph multi-agent system (Oracle, Journalist, Vet)
│   ├── comment_agents.py       # AI comment persona system (SSE streaming)
│   ├── llm_provider.py         # LLM provider switcher (Google/Azure)
│   ├── models.py               # SQLAlchemy ORM models
│   ├── database.py             # DB engine & session factory (auto-detects SQLite/PostgreSQL)
│   ├── auth.py                 # JWT authentication (access + refresh tokens)
│   ├── schemas.py              # Pydantic request/response schemas
│   ├── user_store.py           # User & diary CRUD operations
│   ├── rag_pipeline.py         # ChromaDB RAG for meme/breed data
│   ├── prompt_engineering.py   # Few-shot prompt templates
│   ├── enhanced_persona_system.py  # Advanced persona configuration
│   ├── a2a_protocol.py         # Agent-to-Agent memo exchange
│   ├── cache.py                # Redis async cache wrapper
│   ├── rate_limit.py           # SlowAPI rate limiter setup
│   ├── i18n.py                 # Backend i18n message system
│   ├── logger.py               # Structured JSON logging
│   ├── scheduler.py            # APScheduler for push reminders
│   ├── tools.py                # LangChain tools (weather, trends, breed info)
│   ├── fetch_sns_data.py       # External data fetching (Tavily, Apify)
│   ├── routes/
│   │   ├── __init__.py         # Router exports
│   │   ├── auth.py             # Auth endpoints (signup, login, refresh, logout)
│   │   ├── diary.py            # Diary CRUD + generation endpoints
│   │   ├── comments.py         # Comment generation + SSE streaming
│   │   ├── social.py           # Social feed, sharing, public profiles
│   │   ├── admin.py            # Admin dashboard endpoints
│   │   ├── analytics.py        # Analytics endpoints
│   │   ├── hospitals.py        # Nearby hospital search (Kakao API)
│   │   └── push.py             # Push notification subscription
│   ├── mcp/                    # Model Context Protocol integration
│   │   ├── bootstrap.py
│   │   └── registry.py
│   └── process_datasets.py     # Dataset processing for RAG
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root component with routing
│   │   ├── api.js              # API client with auto-refresh token logic
│   │   ├── i18n.js             # i18next configuration
│   │   ├── context/
│   │   │   └── AuthContext.jsx  # Authentication context provider
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx  # Auth guard for routes
│   │   │   ├── DiaryCard.jsx       # Diary list item with i18n-aware text
│   │   │   └── LanguageToggle.jsx  # Language switcher component
│   │   ├── pages/
│   │   │   ├── Onboarding.jsx  # Welcome/landing page
│   │   │   ├── Login.jsx       # Login page
│   │   │   ├── Signup.jsx      # Multi-step signup (account → dog profile → notification time)
│   │   │   ├── Home.jsx        # Main diary list with greeting
│   │   │   ├── NewDiary.jsx    # Step-by-step diary input wizard
│   │   │   ├── DiaryDetail.jsx # Full diary view (diary, horoscope, health, comments)
│   │   │   ├── Social.jsx      # Social feed (public diaries from other users)
│   │   │   ├── Profile.jsx     # User profile + settings + easter egg
│   │   │   ├── Admin.jsx       # Admin dashboard
│   │   │   ├── SharedDiary.jsx # Public shared diary viewer
│   │   │   └── PublicProfile.jsx   # Public user profile viewer
│   │   ├── locales/
│   │   │   ├── ko/translation.json  # Korean
│   │   │   ├── en/translation.json  # English
│   │   │   ├── ja/translation.json  # Japanese
│   │   │   ├── zh/translation.json  # Chinese
│   │   │   └── es/translation.json  # Spanish
│   │   └── utils/
│   │       └── date.js         # Date formatting + mood emoji mapping
│   ├── package.json
│   └── vite.config.js
│
├── docker-compose.prod.yml    # Production: PostgreSQL + Redis + Backend + Worker + Nginx
├── Dockerfile                 # Backend Docker image
├── requirements.txt           # Python dependencies
├── .env.template              # Environment variable template
└── ref/datasets/              # RAG source data (memes, breed info)
```

---

## 4. Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Client (React SPA / Capacitor Native)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Home │ │NewDi.│ │Social│ │Profi.│ │Admin │        │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘        │
│     └─────────┴────────┴────────┴────────┘              │
│                        │ api.js (auto-refresh JWT)       │
└────────────────────────┼────────────────────────────────┘
                         │ HTTPS
┌────────────────────────┼────────────────────────────────┐
│  Nginx (Reverse Proxy) │                                 │
│  - /api/v1/* → Backend │                                 │
│  - /*        → Static  │                                 │
└────────────────────────┼────────────────────────────────┘
                         │
┌────────────────────────┼────────────────────────────────┐
│  FastAPI Backend        │                                │
│  ┌──────────────┐ ┌────┴─────┐ ┌─────────────────────┐ │
│  │ Auth Router  │ │Diary Rtr.│ │ Social Router       │ │
│  │ /auth/*      │ │/diary/*  │ │ /social/*, /share/* │ │
│  └──────────────┘ └────┬─────┘ └─────────────────────┘ │
│                        │                                 │
│  ┌─────────────────────┴───────────────────────┐        │
│  │  LangGraph Multi-Agent Pipeline              │        │
│  │  ┌────────┐  ┌──────────┐  ┌──────────────┐ │        │
│  │  │ Oracle │→ │Journalist│→ │     Vet      │ │        │
│  │  │(運勢)  │  │ (日記)   │  │  (健康分析)  │ │        │
│  │  └────┬───┘  └────┬─────┘  └──────┬───────┘ │        │
│  │       │           │               │          │        │
│  │       └───── A2A Memo Protocol ───┘          │        │
│  └──────────────────────────────────────────────┘        │
│                        │                                 │
│  ┌──────────┐  ┌───────┴───────┐  ┌───────────────────┐ │
│  │ ChromaDB │  │ LLM Provider  │  │  External Tools   │ │
│  │ (RAG)    │  │ Google/Azure  │  │ Weather, Trends,  │ │
│  │          │  │               │  │ Breed Info        │ │
│  └──────────┘  └───────────────┘  └───────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │                    │
   ┌─────┴──────┐    ┌───────┴────────┐
   │ PostgreSQL │    │     Redis      │
   │ (Data)     │    │ (Cache + Rate) │
   └────────────┘    └────────────────┘
```

### Request Flow: Diary Generation

```
User Input → [mood, food, walk, poop, notes, photo]
    │
    ▼
POST /api/v1/diary/generate
    │
    ▼ (if USE_TASK_QUEUE=true, enqueue to ARQ worker)
    │
    ▼
LangGraph Pipeline Starts
    │
    ├─ 1. Oracle Agent (Horoscope)
    │     ├─ Check Redis cache (same breed+MBTI today?)
    │     ├─ Tool Calling: get_weather(), search_trends(), lookup_breed_info()
    │     ├─ Generate horoscope with lucky item, interaction hint
    │     └─ Create A2A memo for Journalist
    │
    ├─ 2. Journalist Agent (Diary)
    │     ├─ Read Oracle's A2A memo
    │     ├─ Few-Shot prompts for writing style
    │     ├─ RAG: retrieve meme references from ChromaDB
    │     ├─ Generate diary entry in dog's voice (dual language: ko + en)
    │     └─ Create A2A memo for Vet
    │
    └─ 3. Vet Agent (Health)
          ├─ Read Oracle + Journalist memos
          ├─ Chain-of-Thought reasoning for health risk
          ├─ RAG: breed-specific health data from ChromaDB
          └─ Generate risk level, symptom analysis, advice
    │
    ▼
Save to DB (diary, horoscope, health, agent_memos, logs)
    │
    ▼
Return entry → Frontend shows result
    │
    ▼
Auto-trigger: Comment SSE Stream
    ├─ Persona 1: "뽀삐언니" (cheerful popular dog)
    ├─ Persona 2: "츄르대장" (cool cat living among dogs)
    ├─ Persona 3: "할배멍" (wise elder dog)
    └─ ... (random selection from persona pool)
```

---

## 5. Backend Details

### FastAPI Application (`main.py`)

The app initializes with these middleware and features:

- **CORS Middleware**: Configurable allowed origins via `ALLOWED_ORIGINS` env var
- **Rate Limiting**: SlowAPI with per-endpoint limits (e.g., 5/minute for LLM endpoints)
- **Request ID Middleware**: UUID tracking for every request
- **Static File Serving**: Serves built frontend from `/app/frontend/dist`
- **Structured Logging**: JSON-formatted logs with request correlation

### Router Modules

| Router | Prefix | Description |
|--------|--------|-------------|
| `auth_router` | `/api/v1/auth` | Signup, login, logout, token refresh, ID check |
| `diary_router` | `/api/v1/diary` | Generate, list, get, edit, delete diary entries |
| `comments_router` | `/api/v1/comments` | Generate comments, SSE streaming |
| `social_router` | `/api/v1` | Social feed, share/unshare, public profiles |
| `admin_router` | `/api/v1/admin` | Dashboard stats, user management |
| `analytics_router` | `/api/v1/admin/analytics` | Engagement, agent usage analytics |
| `hospitals_router` | `/api/v1/hospitals` | Nearby vet hospital search (Kakao Maps API) |
| `push_router` | `/api/v1/push` | VAPID key, subscribe, unsubscribe, test notification |

### LLM Provider System (`llm_provider.py`)

The LLM provider is switchable at runtime via `LLM_PROVIDER` environment variable:

```python
# .env
LLM_PROVIDER=google   # Uses Gemini 2.0 Flash (free tier available)
# or
LLM_PROVIDER=azure    # Uses Azure OpenAI GPT-4o (enterprise)
```

Both `get_llm()` (chat model) and `get_embeddings()` (embedding model) adapt automatically.

### Caching Strategy

- **Redis** caches horoscope results keyed by `breed + MBTI + date`
- Cache TTL: 1 hour
- Graceful degradation: if Redis is unavailable, LLM is called directly
- Rate limiting uses Redis as backend (falls back to in-memory)

---

## 6. Frontend Details

### Page Flow

```
Onboarding → Login / Signup → Home
                                 ├─ NewDiary (step wizard: mood → food → walk → poop → notes → generate)
                                 ├─ DiaryDetail (full diary + horoscope + health + comments)
                                 ├─ Social (public diary feed)
                                 └─ Profile (dog info, notification time, language, visibility)
```

### Bottom Navigation (4 tabs)

| Tab | Icon | Route | Description |
|-----|------|-------|-------------|
| Home | House | `/home` | Main diary list with time-based greeting |
| New | Plus circle | `/diary/new` | Step-by-step diary input wizard |
| Social | Globe | `/social` | Public diary feed from other users |
| Profile | User | `/profile` | Settings and dog profile management |

### API Client (`api.js`)

The API client handles:

- **Auto-refresh tokens**: On 401 response, automatically refreshes using the refresh token
- **Token deduplication**: Multiple concurrent 401s share a single refresh request
- **Session cleanup**: On refresh failure, clears tokens and dispatches `auth:logout` event
- **Capacitor-aware**: Detects native platform and uses absolute URL for API calls

### State Management

- **AuthContext**: React Context for user authentication state
- **Local component state**: Each page manages its own data via `useState` + `useEffect`
- **No external state library**: Kept simple intentionally (no Redux/Zustand)

---

## 7. AI Agent System

### LangGraph Multi-Agent Pipeline (`agents.py`)

The core AI system uses LangGraph's `StateGraph` with three specialized agents:

#### Oracle Agent (Horoscope/Fortune)
- **Strategy**: Tool Calling
- **Tools**: `get_weather()`, `search_trends()`, `lookup_breed_info()`
- **Output**: `HoroscopeResult` (summary, lucky_item, interaction_hint, weather_context, trend_reference)
- **Caching**: Redis-backed daily cache per breed+MBTI combo
- **Dual Language**: Generates both Korean and English summaries

#### Journalist Agent (Diary Writer)
- **Strategy**: Few-Shot + RAG
- **RAG Source**: ChromaDB meme/trend vector store
- **Output**: `DiaryResult` (title, content, mood_icon, meme_reference)
- **Writing Style**: Writes from the dog's first-person perspective with personality traits
- **A2A**: Receives Oracle's weather and trend memos to weave into diary

#### Vet Agent (Health Analyzer)
- **Strategy**: Chain-of-Thought (CoT) reasoning
- **RAG Source**: ChromaDB breed health data
- **Output**: `HealthAnalysis` (risk_level, symptom_analysis, duration_context, breed_context, conclusion, advice)
- **Risk Levels**: low / medium / high / critical
- **A2A**: Receives memos from both Oracle and Journalist for holistic analysis

### Agent-to-Agent (A2A) Protocol

Agents exchange structured memos through a shared state:

```python
memo = create_memo(
    sender="oracle",
    receiver="journalist",
    content={"weather": "sunny, 22°C", "trend": "spring hiking popular"}
)
```

The Journalist and Vet agents use `filter_memos_for("journalist")` to read relevant memos.

### Comment Agent System (`comment_agents.py`)

After diary generation, comment personas react to the diary via SSE streaming:

| Persona | Emoji | Personality |
|---------|-------|-------------|
| 뽀삐언니 (Poppy) | 🐩 | Popular neighborhood dog, always cheerful |
| 츄르대장 (Churu Captain) | 🐱 | Cat living among dogs, cool but secretly caring |
| 할배멍 (Elder Dog) | 🦮 | Wise senior dog, warm life advice |
| 멍스타그램 (Dogstagram) | 📸 | Influencer dog, hashtag addicted |
| 산책왕 (Walk King) | 🏃 | Exercise-obsessed, always talking about walks |

Comments arrive via **Server-Sent Events (SSE)** with random delays (2s between each) to feel "real-time".

---

## 8. Database Schema

### ORM Models (`models.py`)

#### Users Table
```
users
├── user_id (PK, String 30)
├── nickname (String 30)
├── password_hash (String 128, bcrypt)
├── diary_time (String 5, e.g., "09:00")
├── refresh_token_hash (String 128, nullable)
├── refresh_token_family (String 36, for token rotation security)
├── bio (String 200, nullable)
├── is_profile_public (Boolean, default False)
└── created_at (DateTime with timezone)
```

#### Dog Profiles Table
```
dog_profiles
├── id (PK, autoincrement)
├── user_id (FK → users.user_id, unique)
├── name (String 50)
├── breed (String 50)
├── mbti (String 10)
└── image (Text, base64 encoded, nullable)
```

#### Diary Entries Table
```
diary_entries
├── entry_id (PK, UUID)
├── user_id (FK → users.user_id)
├── date (String 10, "YYYY-MM-DD")
├── diary (JSON: {title_ko, title_en, content_ko, content_en, mood_icon, ...})
├── horoscope (JSON: {summary_ko, summary_en, lucky_item, ...})
├── health (JSON: {risk_level, symptom_analysis, advice, ...})
├── comments (JSON: [{agent, emoji, text, timestamp}, ...])
├── agent_memos (JSON: A2A memo exchange log)
├── logs (JSON: raw input data)
├── photo (Text, base64 encoded, nullable)
├── is_edited (Boolean)
├── is_public (Boolean, for social feed)
├── share_token (String 32, unique, for shareable links)
├── view_count (Integer, for shared diary)
└── created_at (DateTime with timezone)

Indexes:
  - ix_diary_user_date (user_id, date)        # Fast lookup by user+date
  - ix_diary_public_created (is_public, created_at)  # Social feed query
```

#### Other Tables
- **user_events**: Analytics event tracking (event_type, metadata, timestamps)
- **push_subscriptions**: Web Push subscription data (endpoint, p256dh, auth_key)

---

## 9. Authentication System

### JWT Token Flow

```
Signup/Login → { access_token (5min), refresh_token (7 days) }
    │
    ▼
API Request with Authorization: Bearer <access_token>
    │
    ├─ 200 OK → success
    │
    └─ 401 Unauthorized → auto-refresh flow:
         │
         POST /auth/refresh { refresh_token }
         │
         ├─ 200 → new { access_token, refresh_token } → retry original request
         │
         └─ 401 → clear tokens → redirect to login
```

### Security Features

- **bcrypt** password hashing with salt
- **Token family rotation**: Each refresh creates a new token family chain. If a stolen token from an old family is used, all sessions are invalidated (nuclear revocation)
- **Short-lived access tokens**: 5 minutes (configurable via `JWT_ACCESS_EXPIRE_MINUTES`)
- **Refresh token rotation**: New refresh token on every refresh call
- **Weak secret detection**: Server rejects weak JWT secrets at startup

---

## 10. Internationalization (i18n)

### Supported Languages

| Code | Language | Flag |
|------|----------|------|
| `ko` | Korean | 🇰🇷 |
| `en` | English | 🇺🇸 |
| `ja` | Japanese | 🇯🇵 |
| `zh` | Chinese (Simplified) | 🇨🇳 |
| `es` | Spanish | 🇪🇸 |

### Frontend i18n

- **Framework**: `react-i18next` with `i18next-browser-languagedetector`
- **Detection order**: localStorage → browser language
- **Fallback**: English
- **Translation files**: `frontend/src/locales/{lang}/translation.json`
- **Usage**: `const { t } = useTranslation(); t('diary.todayDiary')`

### Backend i18n (AI Content)

The AI agents generate **dual-language content** for every entry:

```json
{
  "diary": {
    "title_ko": "오늘의 산책 일기",
    "title_en": "Today's Walk Diary",
    "content_ko": "오늘 공원에서 나비를 쫓았어요! ...",
    "content_en": "I chased a butterfly in the park today! ..."
  }
}
```

The frontend uses a `safeText()` helper to pick the right language:

```javascript
function safeText(obj, field, lang) {
  const candidates = [
    obj[`${field}_${lang}`],  // e.g., title_en
    obj[field],                // e.g., title (legacy)
    obj[`${field}_ko`],        // fallback to Korean
    obj[`${field}_en`],        // fallback to English
  ]
  // Returns first non-null, non-"None" string
}
```

### Backend Error Messages

Error messages are also i18n-aware via `backend/i18n.py`:

```python
from backend.i18n import get_message, get_lang

lang = get_lang(request)  # Reads Accept-Language header
raise HTTPException(404, detail=get_message("entry_not_found", lang))
```

---

## 11. Social Features

### Social Feed (`/social`)

- Shows public diary entries from users with public profiles
- Paginated with `limit` + `offset` query params
- Logged-in users can optionally exclude their own entries
- **Auth-optional**: Uses `HTTPBearer(auto_error=False)` so unauthenticated users can browse

### Diary Sharing

Users can share individual diary entries via unique links:

```
POST /api/v1/diary/{entry_id}/share     → Generate share link
DELETE /api/v1/diary/{entry_id}/share   → Revoke share link
GET /api/v1/share/{share_token}          → View shared diary (no auth required)
```

### Public Profiles

```
PUT /api/v1/profile/me/visibility        → Toggle profile public/private, set bio
GET /api/v1/profile/{user_id}/public     → View public profile with recent public diaries
```

### Privacy Model

- **Profile visibility** and **diary sharing** are independent controls
- Making a profile public does NOT automatically share all diaries
- Each diary must be explicitly shared via the share button
- The social feed only shows diaries where BOTH the diary is public AND the user's profile is public

---

## 12. Push Notifications

### Web Push (VAPID)

- Uses **pywebpush** on backend + Service Worker on frontend
- VAPID key pair generated via `npx web-push generate-vapid-keys`
- Subscriptions stored in `push_subscriptions` table

### Daily Reminders

- APScheduler checks each user's `diary_time` setting
- Sends push notification at the configured time each day
- Content: "Time to write {dog_name}'s diary!"

### API Endpoints

```
GET  /api/v1/push/vapid-public-key    → Get VAPID public key for subscription
POST /api/v1/push/subscribe           → Register push subscription
DELETE /api/v1/push/unsubscribe       → Remove push subscription
POST /api/v1/push/test                → Send test notification
```

---

## 13. API Reference

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/signup` | No | Create account with dog profile |
| POST | `/api/v1/auth/login` | No | Login, returns JWT tokens |
| POST | `/api/v1/auth/logout` | Yes | Invalidate refresh token |
| POST | `/api/v1/auth/refresh` | No | Refresh access token |
| GET | `/api/v1/auth/check-id/{id}` | No | Check if user ID is available |

### User
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/user/me` | Yes | Get current user profile |
| PUT | `/api/v1/user/me` | Yes | Update dog profile or diary time |

### Diary
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/diary/generate` | Yes | Generate diary via AI agents |
| GET | `/api/v1/diary/job/{job_id}` | Yes | Check async job status (if task queue enabled) |
| GET | `/api/v1/diary/list` | Yes | List all user's diary entries |
| GET | `/api/v1/diary/entry/{entry_id}` | Yes | Get single diary entry |
| PUT | `/api/v1/diary/edit/{entry_id}` | Yes | Edit diary content |
| DELETE | `/api/v1/diary/{entry_id}` | Yes | Delete diary entry |

### Comments
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/comments/generate` | Yes | Generate comments (non-streaming) |
| GET | `/api/v1/comments/stream/{entry_id}` | Token(query) | SSE stream of AI comments |

### Social
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/social/feed` | Optional | Paginated public diary feed |
| POST | `/api/v1/diary/{entry_id}/share` | Yes | Share a diary entry |
| DELETE | `/api/v1/diary/{entry_id}/share` | Yes | Unshare a diary entry |
| GET | `/api/v1/share/{share_token}` | No | View shared diary |
| GET | `/api/v1/profile/{user_id}/public` | No | View public profile |
| PUT | `/api/v1/profile/me/visibility` | Yes | Update profile visibility |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/v1/admin/system` | Admin | System health info |
| GET | `/api/v1/admin/analytics/overview` | Admin | Analytics overview |
| GET | `/api/v1/admin/analytics/engagement` | Admin | Engagement metrics |
| GET | `/api/v1/admin/analytics/agents` | Admin | Agent usage stats |

---

## 14. Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- (Optional) Redis for caching
- (Optional) PostgreSQL for production-like setup

### Backend Setup

```bash
# 1. Clone and setup
cd pawpalja
python -m venv venv
venv\Scripts\activate  # Windows
# or: source venv/bin/activate  # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Setup environment
copy .env.template .env
# Edit .env: set GOOGLE_API_KEY or Azure credentials

# 4. Run backend (auto-creates SQLite DB)
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Run dev server (proxies API to :8000)
npm run dev
# → Opens at http://localhost:3000
```

### Database

- **Local**: SQLite is used automatically when `DATABASE_URL` is not set
  - DB file: `./data/pawpalja.db`
  - Tables auto-created on startup
- **Production**: Set `DATABASE_URL=postgresql+asyncpg://...` for PostgreSQL

---

## 15. Production Deployment

### Docker Compose (`docker-compose.prod.yml`)

The production stack consists of 5 services:

| Service | Image | Purpose |
|---------|-------|---------|
| `db` | postgres:16-alpine | PostgreSQL database |
| `redis` | redis:7-alpine | Caching + rate limiting |
| `backend` | pawpalja/backend | FastAPI API server |
| `worker` | pawpalja/backend | ARQ async task worker |
| `nginx` | pawpalja/nginx | Reverse proxy + static serving |

### Deployment Steps

```bash
# 1. Setup environment
cp .env.template .env
# Edit .env with production values:
#   - Strong JWT_SECRET
#   - DB_PASSWORD
#   - GOOGLE_API_KEY (or Azure credentials)
#   - VAPID keys

# 2. Build frontend
cd frontend && npm ci && npm run build && cd ..

# 3. Launch stack
docker compose -f docker-compose.prod.yml up -d --build

# 4. Verify
docker compose -f docker-compose.prod.yml ps
curl http://localhost/health
```

### DigitalOcean Recommended Setup

- **Droplet**: Basic $8/mo (1 vCPU, 2 GB RAM) — sufficient for ~100 concurrent users
- **Managed PostgreSQL**: $15/mo (1 GB RAM, 10 GB storage)
- **Managed Redis**: $15/mo (or use container Redis for smaller scale)
- **Total**: ~$16-38/mo depending on managed vs. self-hosted services

---

## 16. Environment Variables

See `.env.template` for all variables. Key ones:

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | Yes | `google` or `azure` |
| `GOOGLE_API_KEY` | If google | Google Gemini API key |
| `AOAI_*` | If azure | Azure OpenAI credentials |
| `JWT_SECRET` | Yes | Strong random string (64+ chars) |
| `DATABASE_URL` | No | PostgreSQL URL (omit for SQLite) |
| `REDIS_URL` | No | Redis URL (graceful degradation if absent) |
| `TAVILY_API_KEY` | Optional | For trend searching tool |
| `OPENWEATHER_API_KEY` | Optional | For weather tool |
| `KAKAO_REST_API_KEY` | Optional | For nearby hospital search |
| `VAPID_*` | Optional | For push notifications |
| `USE_TASK_QUEUE` | No | Enable async diary generation (default: false) |
| `ALLOWED_ORIGINS` | Yes | CORS allowed origins |

---

## Easter Egg

There's a hidden developer note in the Profile page. Tap the avatar icon 7 times to discover the developer's philosophy about keeping this space as a pure AI-only interaction zone.

---

*Built with LangGraph, FastAPI, React, and lots of love for dogs.*
