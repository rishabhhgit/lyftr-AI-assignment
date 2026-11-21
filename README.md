# Lyftr AI Full-Stack Assignment: LLM Chatbot with Key Failover & Response Caching

![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![LiteLLM](https://img.shields.io/badge/LiteLLM-Proxy%20%26%20Cache-blue?style=for-the-badge)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Python](https://img.shields.io/badge/python-3670A0?style=for-the-badge&logo=python&logoColor=ffdd54)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-10%2F10%20Passed-brightgreen?style=for-the-badge)

---

## About

This repository contains the complete, production-grade submission for the **Lyftr AI Full-Stack Assignment**. It implements an intelligent AI chatbot system built for resilience, low latency, and cost efficiency.

### Core Architectural Capabilities
1. **Intelligent Key Pooling & Automatic Failover**: Configured with a pool of 2+ API keys across models. The backend automatically catches HTTP 429 (rate limits), quota exhaustion, and 5xx errors, transparently falling over to the next key without crashing or exposing stack traces.
2. **Response Caching via LiteLLM**: Implements LiteLLM's cache engine keyed by model and the exact message sequence. Second calls with the same context immediately return cached responses labeled `LLM_CACHE` with sub-10ms latency.
3. **Multi-Turn Session State**: Session histories are isolated by `session_id` and persisted in an asynchronous SQLite database (`aiosqlite`). The client sends only new messages, and the backend reconstructs conversational history.
4. **Deterministic Failover Simulation (`X-Simulate-Failure`)**: On-demand testing hook to simulate provider outages (`key_1=429`, `key_1=500`, or `*=429`) without exhausting live quotas.
5. **Exact Contract & Testability**: Every API response adheres to the strict JSON schema specification, and the React UI provides all mandatory `data-testid` attributes.
6. **Containerized Deployment**: Multi-stage Dockerfiles for backend and frontend with a Docker Compose volume mounted at `/data` for SQLite persistence.

---

## Table of Contents
- [1. Live URLs](#1-live-urls)
- [2. Run locally: with Docker and without](#2-run-locally-with-docker-and-without)
- [3. Design decisions: key fallback, caching, SQLite session storage](#3-design-decisions-key-fallback-caching-sqlite-session-storage)
- [4. Verification: how to see failover, cache hits and per-message token usage](#4-verification-how-to-see-failover-cache-hits-and-per-message-token-usage)
- [5. Setup Used: your editor and AI tools](#5-setup-used-your-editor-and-ai-tools)
- [6. Bonus features (if any): what you added beyond the requirements and why](#6-bonus-features-if-any-what-you-added-beyond-the-requirements-and-why)
- [API Contract Specification](#api-contract-specification)
- [Frontend Test Attributes](#frontend-test-attributes)

---

## 1. Live URLs

| Service | Deployed URL |
|---|---|
| **Frontend UI** | `https://lyftr-ai-assignment-frontend-nine.vercel.app/` |
| **Backend API** | `https://lyftr-ai-assignment-backend.vercel.app` |
| **Health Check** | `https://lyftr-ai-assignment-backend.vercel.app/health` |

---

## 2. Run locally: with Docker and without

### A. With Docker (Recommended)

**Prerequisites**: Docker Desktop & Docker Compose installed.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rishabhhgit/lyftr-AI-assignment.git
   cd lyftr-assignment
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to supply at least two Gemini API keys (obtainable for free from [Google AI Studio](https://aistudio.google.com)):
   ```env
   LLM_API_KEYS=your_key_1,your_key_2
   ```

3. **Start the stack with a single command**:
   ```bash
   make up
   ```
   This builds minimal multi-stage images, mounts the persistent named volume `/data` for SQLite, and launches both services:
   - **Frontend UI**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

4. **Stop the stack**:
   ```bash
   make down
   ```

---

### B. Without Docker (Local Development)

#### Backend (Python 3.10+):
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run automated tests (10/10 passing)
PYTHONPATH=. pytest -v

# Start backend server
export LLM_API_KEYS="your_key_1,your_key_2"
export DATABASE_URL="sqlite+aiosqlite:///./app.db"
export ALLOWED_ORIGINS="http://localhost:3000"
export ENABLE_FAILURE_SIMULATION="true"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend (Node.js 18+):
```bash
cd frontend
npm install
VITE_API_URL="http://localhost:8000" npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Design decisions: key fallback, caching, SQLite session storage

### Key Fallback Architecture
- **Key Pool**: `LLM_API_KEYS` accepts a comma-separated list of 2 or more API keys. Keys are indexed sequentially as `key_1`, `key_2`, etc.
- **Failover Logic**: When a request is processed, the backend attempts execution on the first available key. If the provider returns a retriable error (HTTP 429, quota exhaustion, 500, 502, 503, or rate limits), the backend catches the error, increments `fallback_attempts`, and transparently fails over to the next key in the pool.
- **Graceful Exhaustion**: If all configured keys fail, the backend returns a clean HTTP 503 response: `{"detail": "all providers unavailable"}`. No broken screen, no stack traces, and nothing is written to the database history.
- **Deterministic Test Hook**: When `ENABLE_FAILURE_SIMULATION=true`, the `X-Simulate-Failure` header intercepts the designated keys (e.g. `key_1=429`, `key_1=500`, or `*=429`) and triggers simulated provider responses without consuming live API quotas.

### Caching Architecture
- **Cache Engine**: LiteLLM's built-in caching system is initialized on startup (`litellm.enable_cache(type="local")` or disk cache).
- **Exact Cache Key**: The cache key evaluates the model plus the complete ordered list of messages (system prompt + history + new user message).
- **Behavior**:
  - The first message sent in a new session hits `LIVE_INFERENCE`.
  - The identical message sent in a subsequent session immediately hits `LLM_CACHE`.
  - Cache hits return the identical reply, exact stored token counts, `key_id: null`, and `fallback_attempts: 0`.
  - Latency on cache hits is sub-millisecond, strictly faster than live inference.
  - Any change in the conversation history or message alters the hash and triggers `LIVE_INFERENCE`.

### SQLite Session Storage
- **Zero External Dependencies**: Standard SQLite database using asynchronous non-blocking drivers (`aiosqlite`).
- **Persistence**: Database lives at the location configured by `DATABASE_URL` (default: `/data/app.db` on a Docker named volume `sqlite_data`), ensuring conversation history survives container restarts and upgrades.
- **Schema Management**: Tables and indices (`idx_messages_session`) are created automatically on startup.
- **Session Isolation**: History is strictly scoped per `session_id`. Each browser refresh generates a fresh client-side session ID.

---

## 4. Verification: how to see failover, cache hits and per-message token usage

### 1. Verify Health Check
```bash
curl -s http://localhost:8000/health | jq .
```
**Expected Response**:
```json
{
  "status": "ok",
  "keys_configured": 2,
  "cache_enabled": true
}
```

### 2. Verify Key Failover (via `X-Simulate-Failure`)
Force `key_1` to fail with HTTP 429; `key_2` will answer:
```bash
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: key_1=429" \
  -d '{"session_id": "demo-failover", "message": "Explain quantum computing in one sentence."}' | jq .
```
**Expected Response**:
```json
{
  "session_id": "demo-failover",
  "reply": "Quantum computing uses quantum mechanics to solve complex problems faster than classical computers.",
  "metadata": {
    "resolution_source": "LIVE_INFERENCE",
    "model": "gemini/gemini-2.0-flash",
    "latency_ms": 780,
    "input_tokens": 16,
    "output_tokens": 24,
    "key_id": "key_2",
    "fallback_attempts": 1
  }
}
```

### 3. Verify All Keys Failing (Clean 503)
Simulate failure across all keys using wildcard `*=429`:
```bash
curl -s -i -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -H "X-Simulate-Failure: *=429" \
  -d '{"session_id": "demo-fail-all", "message": "Hello"}'
```
**Expected Response**:
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{"detail": "all providers unavailable"}
```
*(Verify that nothing was saved to history: `curl -s http://localhost:8000/sessions/demo-fail-all/messages` returns 404)*

### 4. Verify Caching (`LIVE_INFERENCE` vs `LLM_CACHE`)
Send a query in session 1:
```bash
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-alpha", "message": "What is the capital of Iceland?"}' | jq .metadata
```
**Output**: `"resolution_source": "LIVE_INFERENCE"`, `latency_ms: ~800`

Send the **same first message** in a brand new session:
```bash
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "sess-beta", "message": "What is the capital of Iceland?"}' | jq .metadata
```
**Output**: `"resolution_source": "LLM_CACHE"`, `"key_id": null`, `"latency_ms": ~1` (faster, identical reply).

### 5. Verify Per-Message Token Usage
Observe `input_tokens` and `output_tokens` in the metadata:
- Two equal-length first messages in separate sessions report the same `input_tokens`.
- In a multi-turn session, `input_tokens` increases in turn 2 because prior conversation history is included.

### 6. Verify Session History Retrieval
```bash
curl -s http://localhost:8000/sessions/sess-alpha/messages | jq .
```

---

## 5. Setup Used: your editor and AI tools

- **AI Tools**: Antigravity (Google DeepMind) for architectural scaffolding, automated test generation, and contract verification.
- **Editor & Environment**: VS Code on macOS (Apple Silicon), Python 3.12, Node.js 22.
- **Libraries**:
  - `litellm`: AI gateway for multi-provider routing and built-in caching.
  - `fastapi` & `uvicorn`: High-performance asynchronous REST API.
  - `aiosqlite`: Asynchronous non-blocking SQLite database driver.
  - `react` & `vite`: Client-side interface with fast HMR and responsive design.

---

## 6. Bonus features (if any): what you added beyond the requirements and why

1. **Custom System Prompt Override**:
   - The UI includes a dedicated input bar (`data-testid="system-prompt-input"`) allowing the user to configure system behavior (e.g. "You are an expert French translator").
   - The system prompt is persisted in the session and automatically included in all subsequent turns of that conversation.

2. **Automated Docker Healthcheck**:
   - Both Docker Compose and standalone containers include built-in healthchecks against `/health`. Frontend service waits for backend readiness before accepting traffic.

3. **Auto-expanding Responsive Input**:
   - Dynamic textarea that automatically expands with multi-line inputs up to 140px, supporting Shift+Enter for newlines and Enter to submit.

4. **100% Automated Backend Test Suite**:
   - Comprehensive Pytest suite covering all edge cases (validation, failover, caching, 503 handling, multi-turn state preservation).

---

## API Contract Specification

### `GET /health`
Returns status, count of configured keys, and cache state.
```json
{ "status": "ok", "keys_configured": 2, "cache_enabled": true }
```

### `POST /chat`
**Request Body**:
```json
{
  "session_id": "s-7f3a",
  "message": "What is the capital of France?",
  "system_prompt": "Optional system prompt override"
}
```

**Response 200**:
```json
{
  "session_id": "s-7f3a",
  "reply": "The capital of France is Paris.",
  "metadata": {
    "resolution_source": "LIVE_INFERENCE",
    "model": "gemini/gemini-2.0-flash",
    "latency_ms": 812,
    "input_tokens": 42,
    "output_tokens": 9,
    "key_id": "key_1",
    "fallback_attempts": 0
  }
}
```

### `GET /sessions/{session_id}/messages`
**Response 200**:
```json
{
  "session_id": "s-7f3a",
  "messages": [
    { "role": "user", "content": "What is the capital of France?" },
    {
      "role": "assistant",
      "content": "The capital of France is Paris.",
      "metadata": {
        "resolution_source": "LIVE_INFERENCE",
        "input_tokens": 42,
        "output_tokens": 9
      }
    }
  ]
}
```

---

## Frontend Test Attributes

| `data-testid` | Element | Content / Behavior |
|---|---|---|
| `chat-input` | Textarea | Cleared immediately after sending |
| `send-button` | Button | Sends message (Enter key also triggers send) |
| `assistant-message` | Div | Message container containing reply text and metadata badges |
| `meta-source` | Span | Exactly `LIVE_INFERENCE` or `LLM_CACHE` |
| `meta-model` | Span | Model identifier string |
| `meta-latency` | Span | Server latency in milliseconds (e.g. `812 ms`) |
| `meta-input-tokens` | Span | Number of prompt tokens for this request |
| `meta-output-tokens` | Span | Number of completion tokens for this request |
| `system-prompt-input` | Input | System prompt configuration field |
