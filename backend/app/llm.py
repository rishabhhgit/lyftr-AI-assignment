import os
import time
from typing import List, Dict, Any, Optional
import litellm
from litellm import completion
from app.config import get_settings


class AllKeysFailedException(Exception):
    """Raised when every key in the key pool fails."""
    pass


_cache_initialized = False


def init_cache():
    global _cache_initialized
    if not _cache_initialized:
        settings = get_settings()
        if settings.cache_type == "disk":
            try:
                os.makedirs(settings.cache_dir, exist_ok=True)
                litellm.enable_cache(type="disk", disk_cache_dir=settings.cache_dir)
            except Exception:
                litellm.enable_cache(type="local")
        else:
            litellm.enable_cache(type="local")
        litellm.set_verbose = False
        _cache_initialized = True


def execute_llm_chat(
    messages: List[Dict[str, str]],
    simulate_failures: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    """
    Execute chat with caching, key pool iteration, and automatic failover.
    Synchronous function meant to be run in a thread pool from async FastAPI.
    """
    init_cache()
    settings = get_settings()
    api_keys = settings.api_keys_list
    if not api_keys:
        raise AllKeysFailedException("No API keys configured")

    model = settings.default_model

    # 1. Check cache first
    start_cache_check = time.time()
    try:
        cached_result = litellm.cache.get_cache(messages=messages, model=model)
    except Exception:
        cached_result = None

    if cached_result:
        latency_ms = max(1, int((time.time() - start_cache_check) * 1000))
        # Handle dict or ModelResponse structure returned by cache
        if isinstance(cached_result, dict):
            reply = cached_result["choices"][0]["message"]["content"] or ""
            usage = cached_result.get("usage") or {}
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            cached_model = cached_result.get("model") or model
        else:
            reply = cached_result.choices[0].message.content or ""
            usage = getattr(cached_result, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
            cached_model = getattr(cached_result, "model", None) or model

        return {
            "reply": reply,
            "resolution_source": "LLM_CACHE",
            "model": cached_model,
            "latency_ms": latency_ms,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "key_id": None,
            "fallback_attempts": 0,
        }

    # 2. Live call with key pool fallback
    simulate_failures = simulate_failures or {}
    fallback_attempts = 0
    last_error = None

    for idx, key in enumerate(api_keys):
        key_id = f"key_{idx + 1}"

        # Check simulation hook
        simulated_status = None
        if key_id in simulate_failures:
            simulated_status = simulate_failures[key_id]
        elif "*" in simulate_failures:
            simulated_status = simulate_failures["*"]

        if simulated_status is not None:
            last_error = f"Simulated HTTP {simulated_status} on {key_id}"
            fallback_attempts += 1
            continue

        # Execute live call
        start_time = time.time()
        try:
            response = completion(
                model=model,
                messages=messages,
                api_key=key,
                caching=False,  # We manage LiteLLM cache explicitly
                timeout=60,
            )
            latency_ms = max(1, int((time.time() - start_time) * 1000))

            reply = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            input_tokens = getattr(usage, "prompt_tokens", 0) if usage else 0
            output_tokens = getattr(usage, "completion_tokens", 0) if usage else 0
            actual_model = getattr(response, "model", None) or model

            # Store successful response in LiteLLM cache
            try:
                litellm.cache.add_cache(result=response, messages=messages, model=model)
            except Exception as cache_err:
                pass

            return {
                "reply": reply,
                "resolution_source": "LIVE_INFERENCE",
                "model": actual_model,
                "latency_ms": latency_ms,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "key_id": key_id,
                "fallback_attempts": fallback_attempts,
            }

        except Exception as e:
            err_msg = str(e).lower()
            is_retriable = any(
                code in err_msg
                for code in ["429", "500", "502", "503", "quota", "rate_limit", "ratelimit", "overloaded", "unavailable"]
            )
            if is_retriable:
                last_error = str(e)
                fallback_attempts += 1
                continue
            raise

    # All keys failed
    raise AllKeysFailedException(f"All providers unavailable. Last error: {last_error}")
