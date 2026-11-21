import json
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import APIRouter, Depends, Header, HTTPException, status
import aiosqlite

from app.config import get_settings
from app.database import get_db
from app.llm import execute_llm_chat, AllKeysFailedException
from app.schemas import (
    HealthResponse,
    ChatRequest,
    ChatResponse,
    ChatMetadata,
    SessionHistoryResponse,
    MessageItem,
    AssistantMetadataOut,
)

router = APIRouter()


def parse_simulate_failure_header(header_value: Optional[str]) -> Dict[str, int]:
    """Parse comma-separated key_id=status pairs, e.g. 'key_1=429,key_2=500' or '*=429'."""
    if not header_value:
        return {}
    failures = {}
    for part in header_value.split(","):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            try:
                failures[k.strip()] = int(v.strip())
            except ValueError:
                pass
    return failures


@router.get("/health", response_model=HealthResponse)
async def health(db: aiosqlite.Connection = Depends(get_db)):
    current_settings = get_settings()
    # Check DB reachability
    async with db.execute("SELECT 1") as cursor:
        await cursor.fetchone()

    return HealthResponse(
        status="ok",
        keys_configured=len(current_settings.api_keys_list),
        cache_enabled=True,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    db: aiosqlite.Connection = Depends(get_db),
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure"),
):
    current_settings = get_settings()

    # Parse simulation header if enabled
    simulate_failures = {}
    if current_settings.enable_failure_simulation and x_simulate_failure:
        simulate_failures = parse_simulate_failure_header(x_simulate_failure)

    # 1. Retrieve session history from SQLite
    async with db.execute(
        "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC",
        (request.session_id,),
    ) as cursor:
        history = await cursor.fetchall()

    # 2. Build messages list for LiteLLM
    messages = []

    # Check for system prompt
    active_system_prompt = request.system_prompt
    if not active_system_prompt:
        for row in history:
            if row["role"] == "system":
                active_system_prompt = row["content"]
                break

    if not active_system_prompt:
        active_system_prompt = (
            "You are a helpful, direct, and concise AI assistant. "
            "Answer clearly and directly using natural formatting, bullet points, or code where appropriate. "
            "Do not start your reply with 'TL;DR:' or summary preambles."
        )

    if active_system_prompt:
        messages.append({"role": "system", "content": active_system_prompt})

    for row in history:
        if row["role"] in ("user", "assistant"):
            messages.append({"role": row["role"], "content": row["content"]})

    messages.append({"role": "user", "content": request.message})

    # 3. Call LLM service in threadpool (blocking I/O)
    try:
        llm_result = await asyncio.to_thread(
            execute_llm_chat, messages, simulate_failures
        )
    except AllKeysFailedException:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="all providers unavailable",
        )

    # 4. Save to DB on success only
    now = datetime.now(timezone.utc).isoformat()

    # Save system prompt if new
    if request.system_prompt and not any(r["role"] == "system" for r in history):
        await db.execute(
            "INSERT INTO messages (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
            (request.session_id, "system", request.system_prompt, None, now),
        )

    # Save user message
    await db.execute(
        "INSERT INTO messages (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
        (request.session_id, "user", request.message, None, now),
    )

    metadata_payload = ChatMetadata(
        resolution_source=llm_result["resolution_source"],
        model=llm_result["model"],
        latency_ms=llm_result["latency_ms"],
        input_tokens=llm_result["input_tokens"],
        output_tokens=llm_result["output_tokens"],
        key_id=llm_result.get("key_id"),
        fallback_attempts=llm_result.get("fallback_attempts", 0),
    )

    # Save assistant message with metadata JSON
    await db.execute(
        "INSERT INTO messages (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            request.session_id,
            "assistant",
            llm_result["reply"],
            json.dumps(metadata_payload.model_dump()),
            now,
        ),
    )

    await db.commit()

    return ChatResponse(
        session_id=request.session_id,
        reply=llm_result["reply"],
        metadata=metadata_payload,
    )


@router.get("/sessions/{session_id}/messages", response_model=SessionHistoryResponse)
async def get_session_messages(
    session_id: str,
    db: aiosqlite.Connection = Depends(get_db),
):
    # Check if session exists (even if only system message exists)
    async with db.execute(
        "SELECT 1 FROM messages WHERE session_id = ? LIMIT 1",
        (session_id,),
    ) as cursor:
        exists = await cursor.fetchone()

    if not exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )

    # Fetch user and assistant messages, oldest first
    async with db.execute(
        "SELECT role, content, metadata FROM messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at ASC, id ASC",
        (session_id,),
    ) as cursor:
        rows = await cursor.fetchall()

    messages_out = []
    for row in rows:
        meta_out = None
        if row["role"] == "assistant" and row["metadata"]:
            try:
                parsed = json.loads(row["metadata"])
                meta_out = AssistantMetadataOut(
                    resolution_source=parsed.get("resolution_source", "LIVE_INFERENCE"),
                    input_tokens=parsed.get("input_tokens", 0),
                    output_tokens=parsed.get("output_tokens", 0),
                )
            except Exception:
                pass
        messages_out.append(
            MessageItem(role=row["role"], content=row["content"], metadata=meta_out)
        )

    return SessionHistoryResponse(session_id=session_id, messages=messages_out)
