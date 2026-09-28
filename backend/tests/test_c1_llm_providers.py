"""Acceptance tests for Phase C1: LLM provider abstraction and multi-provider fallback orchestration."""

import json
import httpx
import pytest
from strata_api.ai.providers import (
    AllLLMProvidersFailedError,
    FallbackLLMProvider,
    GroqProvider,
    LLMProvider,
    LLMProviderError,
    MistralProvider,
    OpenRouterProvider,
    get_default_llm_provider,
)
from strata_api.config import settings


@pytest.mark.asyncio
async def test_llm_provider_protocol_conformance():
    """All providers must conform to the LLMProvider protocol."""
    groq = GroqProvider(api_key="mock_key")
    mistral = MistralProvider(api_key="mock_key")
    openrouter = OpenRouterProvider(api_key="mock_key")
    fallback = FallbackLLMProvider(providers=[groq, mistral, openrouter])

    assert isinstance(groq, LLMProvider)
    assert isinstance(mistral, LLMProvider)
    assert isinstance(openrouter, LLMProvider)
    assert isinstance(fallback, LLMProvider)
    assert hasattr(groq, "complete")
    assert hasattr(mistral, "complete")
    assert hasattr(openrouter, "complete")
    assert hasattr(fallback, "complete")


@pytest.mark.asyncio
async def test_groq_provider_success(monkeypatch):
    """GroqProvider sends correct request format and extracts message content."""
    captured_request = {}

    async def mock_post(self, url, headers=None, json=None):
        captured_request["url"] = str(url)
        captured_request["headers"] = headers
        captured_request["json"] = json
        mock_response = httpx.Response(
            status_code=200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": '{"sql": "SELECT 1;", "explanation": "test"}',
                        }
                    }
                ]
            },
            request=httpx.Request("POST", str(url)),
        )
        return mock_response

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = GroqProvider(api_key="test-groq-key", default_model="llama-3.3-70b-versatile")
    result = await provider.complete(
        system="You are an analyst",
        user="Show top 5",
        json_mode=True,
    )

    assert result == '{"sql": "SELECT 1;", "explanation": "test"}'
    assert captured_request["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert captured_request["headers"]["Authorization"] == "Bearer test-groq-key"
    assert captured_request["json"]["model"] == "llama-3.3-70b-versatile"
    assert captured_request["json"]["response_format"] == {"type": "json_object"}
    assert captured_request["json"]["messages"][0]["role"] == "system"
    assert captured_request["json"]["messages"][1]["role"] == "user"


@pytest.mark.asyncio
async def test_groq_provider_missing_key():
    """GroqProvider raises LLMProviderError if API key is empty."""
    provider = GroqProvider(api_key="")
    with pytest.raises(LLMProviderError) as exc_info:
        await provider.complete(system="sys", user="usr")
    assert "API key is not configured" in str(exc_info.value)
    assert exc_info.value.provider == "groq"


@pytest.mark.asyncio
async def test_mistral_provider_success(monkeypatch):
    """MistralProvider sends correct headers and extracts response."""
    captured_request = {}

    async def mock_post(self, url, headers=None, json=None):
        captured_request["url"] = str(url)
        captured_request["headers"] = headers
        captured_request["json"] = json
        return httpx.Response(
            status_code=200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": '{"sql": "SELECT count(*) FROM table;", "explanation": "count"}',
                        }
                    }
                ]
            },
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = MistralProvider(api_key="test-mistral-key", default_model="mistral-large-latest")
    result = await provider.complete(system="sys", user="count rows", json_mode=True)

    assert result == '{"sql": "SELECT count(*) FROM table;", "explanation": "count"}'
    assert captured_request["url"] == "https://api.mistral.ai/v1/chat/completions"
    assert captured_request["headers"]["Authorization"] == "Bearer test-mistral-key"
    assert captured_request["json"]["model"] == "mistral-large-latest"
    assert captured_request["json"]["response_format"] == {"type": "json_object"}


@pytest.mark.asyncio
async def test_openrouter_provider_success(monkeypatch):
    """OpenRouterProvider sends custom headers and handles completions."""
    captured_request = {}

    async def mock_post(self, url, headers=None, json=None):
        captured_request["url"] = str(url)
        captured_request["headers"] = headers
        captured_request["json"] = json
        return httpx.Response(
            status_code=200,
            json={
                "choices": [
                    {
                        "message": {
                            "role": "assistant",
                            "content": "SELECT avg(price) FROM sales",
                        }
                    }
                ]
            },
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenRouterProvider(api_key="test-openrouter-key", default_model="mistralai/mistral-large")
    result = await provider.complete(system="sys", user="avg price", json_mode=False)

    assert result == "SELECT avg(price) FROM sales"
    assert captured_request["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured_request["headers"]["Authorization"] == "Bearer test-openrouter-key"
    assert captured_request["headers"]["HTTP-Referer"] == "https://strata.ai"
    assert captured_request["headers"]["X-Title"] == "Strata Data Platform"
    assert "response_format" not in captured_request["json"]


@pytest.mark.asyncio
async def test_provider_error_handling(monkeypatch):
    """Providers handle 4xx/5xx and timeouts with LLMProviderError."""
    # 1. 429 Rate limited response
    async def mock_429(self, url, headers=None, json=None):
        return httpx.Response(
            status_code=429,
            text="Rate limit exceeded",
            request=httpx.Request("POST", str(url)),
        )

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_429)
    groq = GroqProvider(api_key="key")
    with pytest.raises(LLMProviderError) as exc_429:
        await groq.complete(system="s", user="u")
    assert exc_429.value.status_code == 429
    assert "Rate limit exceeded" in str(exc_429.value)

    # 2. Timeout
    async def mock_timeout(self, url, headers=None, json=None):
        raise httpx.ReadTimeout("Read timed out")

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_timeout)
    mistral = MistralProvider(api_key="key", timeout=1.0)
    with pytest.raises(LLMProviderError) as exc_timeout:
        await mistral.complete(system="s", user="u")
    assert "timed out" in str(exc_timeout.value).lower()


@pytest.mark.asyncio
async def test_fallback_chain_first_success():
    """When primary provider succeeds, fallback chain returns immediately and records provider."""
    class MockPrimary:
        provider_name = "groq"
        async def complete(self, system, user, *, json_mode=False, model=None):
            return "groq-success"

    class MockSecondary:
        provider_name = "mistral"
        async def complete(self, system, user, *, json_mode=False, model=None):
            raise AssertionError("Secondary provider should not have been called")

    fallback = FallbackLLMProvider(providers=[MockPrimary(), MockSecondary()])
    result = await fallback.complete(system="sys", user="user")

    assert result == "groq-success"
    assert fallback.last_used_provider == "groq"


@pytest.mark.asyncio
async def test_fallback_chain_failover_to_secondary():
    """When primary fails, fallback chain automatically switches to secondary provider."""
    class MockFailingPrimary:
        provider_name = "groq"
        async def complete(self, system, user, *, json_mode=False, model=None):
            raise LLMProviderError("groq", "Rate limit 429", status_code=429)

    class MockWorkingSecondary:
        provider_name = "mistral"
        async def complete(self, system, user, *, json_mode=False, model=None):
            return "mistral-success"

    fallback = FallbackLLMProvider(providers=[MockFailingPrimary(), MockWorkingSecondary()])
    result = await fallback.complete(system="sys", user="user")

    assert result == "mistral-success"
    assert fallback.last_used_provider == "mistral"


@pytest.mark.asyncio
async def test_fallback_chain_all_fail():
    """When all providers fail, AllLLMProvidersFailedError is raised with error details."""
    class Fail1:
        provider_name = "groq"
        async def complete(self, system, user, *, json_mode=False, model=None):
            raise LLMProviderError("groq", "connection timeout")

    class Fail2:
        provider_name = "mistral"
        async def complete(self, system, user, *, json_mode=False, model=None):
            raise LLMProviderError("mistral", "invalid api key", status_code=401)

    class Fail3:
        provider_name = "openrouter"
        async def complete(self, system, user, *, json_mode=False, model=None):
            raise LLMProviderError("openrouter", "service unavailable 503", status_code=503)

    fallback = FallbackLLMProvider(providers=[Fail1(), Fail2(), Fail3()])
    with pytest.raises(AllLLMProvidersFailedError) as exc_info:
        await fallback.complete(system="sys", user="user")

    assert "groq" in exc_info.value.errors
    assert "mistral" in exc_info.value.errors
    assert "openrouter" in exc_info.value.errors
    assert fallback.last_used_provider is None


@pytest.mark.asyncio
async def test_fallback_provider_order_from_settings(monkeypatch):
    """FallbackLLMProvider builds ordered provider instances from settings.LLM_PROVIDER_ORDER."""
    fallback = FallbackLLMProvider(provider_order="mistral,groq,openrouter")
    assert len(fallback.providers) == 3
    assert [p.provider_name for p in fallback.providers] == ["mistral", "groq", "openrouter"]

    default_provider = get_default_llm_provider()
    assert len(default_provider.providers) == 3
    assert [p.provider_name for p in default_provider.providers] == ["groq", "mistral", "openrouter"]


@pytest.mark.asyncio
async def test_groq_intra_provider_model_fallback(monkeypatch):
    """GroqProvider falls back to secondary model if primary model fails (e.g. 404 or 429)."""
    attempted_models = []

    async def mock_post(self, url, headers=None, json=None):
        model = json["model"]
        attempted_models.append(model)
        if model == "llama-3.3-70b-versatile":
            return httpx.Response(status_code=404, text="Model deprecated or not found", request=httpx.Request("POST", str(url)))
        elif model == "llama-3.1-8b-instant":
            return httpx.Response(
                status_code=200,
                json={"choices": [{"message": {"content": "SELECT 42;"}}]},
                request=httpx.Request("POST", str(url)),
            )
        return httpx.Response(status_code=500, text="Internal server error", request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = GroqProvider(api_key="mock-groq-key")
    result = await provider.complete(system="sys", user="query")

    assert result == "SELECT 42;"
    assert attempted_models == ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
    assert provider.last_used_model == "llama-3.1-8b-instant"


@pytest.mark.asyncio
async def test_mistral_intra_provider_model_fallback(monkeypatch):
    """MistralProvider falls back across its 3 models when initial model fails."""
    attempted_models = []

    async def mock_post(self, url, headers=None, json=None):
        model = json["model"]
        attempted_models.append(model)
        if model == "mistral-small-latest":
            return httpx.Response(status_code=429, text="Rate limit", request=httpx.Request("POST", str(url)))
        elif model == "open-mistral-nemo":
            return httpx.Response(
                status_code=200,
                json={"choices": [{"message": {"content": "SELECT sum(val) FROM t;"}}]},
                request=httpx.Request("POST", str(url)),
            )
        return httpx.Response(status_code=500, text="Error", request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = MistralProvider(api_key="mock-mistral-key")
    result = await provider.complete(system="sys", user="query")

    assert result == "SELECT sum(val) FROM t;"
    assert attempted_models == ["mistral-small-latest", "open-mistral-nemo"]
    assert provider.last_used_model == "open-mistral-nemo"


@pytest.mark.asyncio
async def test_openrouter_intra_provider_model_fallback(monkeypatch):
    """OpenRouterProvider falls back across free tier models."""
    attempted_models = []

    async def mock_post(self, url, headers=None, json=None):
        model = json["model"]
        attempted_models.append(model)
        if model == "meta-llama/llama-3.3-70b-instruct:free":
            return httpx.Response(status_code=503, text="Overloaded", request=httpx.Request("POST", str(url)))
        elif model == "mistralai/mistral-small-24b-instruct-2501:free":
            return httpx.Response(
                status_code=200,
                json={"choices": [{"message": {"content": "SELECT count(*) FROM users;"}}]},
                request=httpx.Request("POST", str(url)),
            )
        return httpx.Response(status_code=500, text="Error", request=httpx.Request("POST", str(url)))

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    provider = OpenRouterProvider(api_key="mock-openrouter-key")
    result = await provider.complete(system="sys", user="query")

    assert result == "SELECT count(*) FROM users;"
    assert attempted_models == ["meta-llama/llama-3.3-70b-instruct:free", "mistralai/mistral-small-24b-instruct-2501:free"]
    assert provider.last_used_model == "mistralai/mistral-small-24b-instruct-2501:free"

