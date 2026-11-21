from typing import Optional, List, Any
from pydantic import BaseModel, Field, field_validator


class HealthResponse(BaseModel):
    status: str
    keys_configured: int
    cache_enabled: bool


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1, max_length=128)
    message: str = Field(..., min_length=1, max_length=4000)
    system_prompt: Optional[str] = None

    @field_validator("session_id")
    @classmethod
    def validate_session_id(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed or len(trimmed) > 128:
            raise ValueError("session_id must be between 1 and 128 characters after trimming")
        return trimmed

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("message must not be blank after trimming")
        if len(trimmed) > 4000:
            raise ValueError("message must not exceed 4000 characters after trimming")
        return trimmed


class ChatMetadata(BaseModel):
    resolution_source: str
    model: str
    latency_ms: int
    input_tokens: int
    output_tokens: int
    key_id: Optional[str] = None
    fallback_attempts: int


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    metadata: ChatMetadata


class AssistantMetadataOut(BaseModel):
    resolution_source: str
    input_tokens: int
    output_tokens: int


class MessageItem(BaseModel):
    role: str
    content: str
    metadata: Optional[AssistantMetadataOut] = None


class SessionHistoryResponse(BaseModel):
    session_id: str
    messages: List[MessageItem]
