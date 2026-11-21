import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock

# Configure test environment
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_fastapi.db"
os.environ["LLM_API_KEYS"] = "test_key_1,test_key_2"
os.environ["ALLOWED_ORIGINS"] = "http://localhost:3000"
os.environ["ENABLE_FAILURE_SIMULATION"] = "true"
os.environ["DEFAULT_MODEL"] = "gemini/gemini-2.0-flash"

from app.main import app
from app.config import get_settings
import litellm

# Clear LRU cache on settings
get_settings.cache_clear()


def make_mock_completion_response(content="Paris is the capital of France.", prompt_tokens=42, completion_tokens=9):
    resp = litellm.ModelResponse()
    resp.choices = [litellm.Choices(message=litellm.Message(content=content))]
    resp.usage = litellm.Usage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=prompt_tokens + completion_tokens)
    resp.model = "gemini/gemini-2.0-flash"
    return resp


@pytest_asyncio.fixture(scope="function")
async def client():
    # Initialize DB
    from app.database import init_db
    await init_db()

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    # Cleanup DB after tests
    if os.path.exists("./test_fastapi.db"):
        try:
            os.remove("./test_fastapi.db")
        except Exception:
            pass


@pytest.mark.asyncio
async def test_health_endpoint(client):
    res = await client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["keys_configured"] == 2
    assert data["cache_enabled"] is True


@pytest.mark.asyncio
async def test_chat_validation_empty_message(client):
    res = await client.post("/chat", json={"session_id": "val-1", "message": "   "})
    assert res.status_code == 422
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_chat_validation_missing_session_id(client):
    res = await client.post("/chat", json={"message": "hello"})
    assert res.status_code == 422
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_chat_validation_long_message(client):
    res = await client.post("/chat", json={"session_id": "val-3", "message": "x" * 4001})
    assert res.status_code == 422
    assert "detail" in res.json()


@pytest.mark.asyncio
async def test_chat_live_inference(client):
    mock_resp = make_mock_completion_response()
    with patch("app.llm.completion", return_value=mock_resp):
        res = await client.post(
            "/chat",
            json={
                "session_id": "s-live-1",
                "message": "What is the capital of France?",
            },
        )
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == "s-live-1"
    assert data["reply"] == "Paris is the capital of France."
    assert data["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert data["metadata"]["key_id"] == "key_1"
    assert data["metadata"]["fallback_attempts"] == 0
    assert data["metadata"]["input_tokens"] == 42
    assert data["metadata"]["output_tokens"] == 9
    assert data["metadata"]["model"] == "gemini/gemini-2.0-flash"


@pytest.mark.asyncio
async def test_chat_caching(client):
    """The same first message sent in a new session must return LLM_CACHE the second time."""
    mock_resp = make_mock_completion_response(content="Tokyo is the capital of Japan.")
    unique_msg = "What is the capital of Japan in year 2026?"
    with patch("app.llm.completion", return_value=mock_resp):
        # 1st request -> LIVE_INFERENCE
        r1 = await client.post(
            "/chat",
            json={"session_id": "s-cache-a", "message": unique_msg},
        )
        assert r1.status_code == 200
        assert r1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

        # 2nd request in new session with same first message -> LLM_CACHE
        r2 = await client.post(
            "/chat",
            json={"session_id": "s-cache-b", "message": unique_msg},
        )
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["metadata"]["resolution_source"] == "LLM_CACHE"
        assert data2["metadata"]["key_id"] is None
        assert data2["metadata"]["fallback_attempts"] == 0
        assert data2["reply"] == "Tokyo is the capital of Japan."
        assert data2["metadata"]["input_tokens"] == 42
        assert data2["metadata"]["output_tokens"] == 9


@pytest.mark.asyncio
async def test_failover_key_1_to_key_2(client):
    """X-Simulate-Failure: key_1=429 should failover to key_2."""
    mock_resp = make_mock_completion_response()
    with patch("app.llm.completion", return_value=mock_resp):
        res = await client.post(
            "/chat",
            json={"session_id": "s-failover-1", "message": "Hello failover test"},
            headers={"X-Simulate-Failure": "key_1=429"},
        )
    assert res.status_code == 200
    data = res.json()
    assert data["metadata"]["key_id"] == "key_2"
    assert data["metadata"]["fallback_attempts"] == 1


@pytest.mark.asyncio
async def test_all_keys_failed(client):
    """X-Simulate-Failure: *=429 returns 503 and nothing is saved to DB."""
    res = await client.post(
        "/chat",
        json={"session_id": "s-all-fail", "message": "This should fail"},
        headers={"X-Simulate-Failure": "*=429"},
    )
    assert res.status_code == 503
    assert res.json() == {"detail": "all providers unavailable"}

    # Ensure nothing was saved to history
    hist_res = await client.get("/sessions/s-all-fail/messages")
    assert hist_res.status_code == 404
    assert hist_res.json() == {"detail": "session not found"}


@pytest.mark.asyncio
async def test_session_history_and_not_found(client):
    # 404 on nonexistent session
    res_404 = await client.get("/sessions/s-nonexistent/messages")
    assert res_404.status_code == 404
    assert res_404.json() == {"detail": "session not found"}

    # Chat once
    mock_resp = make_mock_completion_response(content="Hello there!", prompt_tokens=20, completion_tokens=5)
    with patch("app.llm.completion", return_value=mock_resp):
        await client.post(
            "/chat",
            json={"session_id": "s-hist-test", "message": "Hi bot"},
        )

    # Now get history
    res_hist = await client.get("/sessions/s-hist-test/messages")
    assert res_hist.status_code == 200
    hist = res_hist.json()
    assert hist["session_id"] == "s-hist-test"
    assert len(hist["messages"]) == 2
    assert hist["messages"][0]["role"] == "user"
    assert hist["messages"][0]["content"] == "Hi bot"
    assert hist["messages"][1]["role"] == "assistant"
    assert hist["messages"][1]["content"] == "Hello there!"
    assert hist["messages"][1]["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert hist["messages"][1]["metadata"]["input_tokens"] == 20
    assert hist["messages"][1]["metadata"]["output_tokens"] == 5


@pytest.mark.asyncio
async def test_multi_turn_history_preservation(client):
    """Multi-turn messages build on previous history in the same session."""
    mock_resp1 = make_mock_completion_response(content="I am Lyftr Bot.", prompt_tokens=15, completion_tokens=6)
    mock_resp2 = make_mock_completion_response(content="You previously said: What is your name?", prompt_tokens=30, completion_tokens=10)

    responses = [mock_resp1, mock_resp2]
    call_idx = 0

    def mock_completion(**kwargs):
        nonlocal call_idx
        resp = responses[call_idx]
        call_idx += 1
        return resp

    with patch("app.llm.completion", side_effect=mock_completion):
        r1 = await client.post("/chat", json={"session_id": "s-multi", "message": "What is your name?"})
        assert r1.status_code == 200

        r2 = await client.post("/chat", json={"session_id": "s-multi", "message": "What did I ask before?"})
        assert r2.status_code == 200

    hist_res = await client.get("/sessions/s-multi/messages")
    assert hist_res.status_code == 200
    messages = hist_res.json()["messages"]
    assert len(messages) == 4
    assert messages[0]["content"] == "What is your name?"
    assert messages[1]["content"] == "I am Lyftr Bot."
    assert messages[2]["content"] == "What did I ask before?"
    assert messages[3]["content"] == "You previously said: What is your name?"
