# Lyftr AI Full-Stack Assignment: LLM Chatbot with Key Failover & Response Caching

A production-ready full-stack AI chatbot application featuring multi-turn conversation memory, intelligent key pooling with automatic failover, response caching via LiteLLM, and SQLite persistence.

- **Frontend**: React (Vite, CSS Modules, clean UI with exact `data-testid` contracts)
- **Backend**: Python (FastAPI + LiteLLM + aiosqlite + SQLite)
- **Containerization**: Multi-stage Dockerfiles + Docker Compose + Makefile

---

## 1. Live URLs

| Service | Deployed URL |
|---|---|
| **Frontend UI** | `https://lyftr-chatbot-frontend.vercel.app` *(insert your Vercel URL)* |
| **Backend API** | `https://lyftr-chatbot-backend.onrender.com` *(insert your Render URL)* |
| **Health Check** | `https://lyftr-chatbot-backend.onrender.com/health` |

---

## 2. Run locally: with Docker and without

### A. With Docker (Recommended)

**Prerequisites**: Docker & Docker Compose installed.

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd lyftr-assignment
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` to supply at least two Gemini API keys (obtainable for free from [Google AI Studio](https://aistudio.google.com)):
   ```env
   LLM_API_KEYS=AIzaSyA...,AIzaSyB...
   ```

3. **Start the stack with a single command**:
   ```bash
   make up
   ```
   This builds multi-stage images, starts both containers, mounts the named volume `/data` for SQLite persistence, and verifies health:
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

# Run automated tests
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
- **Key Pool**: `LLM_API_KEYS` accepts a comma-separated list of 2 or more API keys. Keys are indexed in order as `key_1`, `key_2`, etc.
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
  "reply": "...",
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
