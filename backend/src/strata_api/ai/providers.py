"""LLM provider abstraction and robust multi-tier fallback orchestration."""

import logging
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable
import httpx
from strata_api.config import settings

logger = logging.getLogger(__name__)


class LLMProviderError(Exception):
    """Base exception for LLM provider errors."""

    def __init__(self, provider: str, message: str, status_code: Optional[int] = None):
        super().__init__(f"[{provider}] {message}")
        self.provider = provider
        self.status_code = status_code


class AllLLMProvidersFailedError(Exception):
    """Raised when all configured LLM providers in the fallback chain fail."""

    def __init__(self, errors: Dict[str, str]):
        msg = "All LLM providers failed: " + "; ".join(f"{p}: {e}" for p, e in errors.items())
        super().__init__(msg)
        self.errors = errors


@runtime_checkable
class LLMProvider(Protocol):
    """Protocol defining the LLM provider interface."""

    provider_name: str

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        model: Optional[str] = None,
    ) -> str:
        """Generate a completion given system and user prompts."""
        ...


class GroqProvider:
    """Groq API provider with 3 curated, active, non-decommissioned models.

    Models:
    1. llama-3.3-70b-versatile (Primary high-performance model)
    2. llama-3.1-8b-instant (Fast, lightweight fallback)
    3. gemma2-9b-it (Google Gemma 2 instruction-tuned on Groq)
    """

    provider_name = "groq"
    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        models: Optional[List[str]] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = settings.GROQ_API_KEY if api_key is None else api_key
        if models is not None:
            self.models = list(models)
        else:
            self.models = list(settings.GROQ_MODELS)

        if default_model:
            if default_model not in self.models:
                self.models.insert(0, default_model)
            else:
                self.models.remove(default_model)
                self.models.insert(0, default_model)

        self.timeout = timeout if timeout is not None else float(settings.LLM_TIMEOUT_SECONDS)
        self.last_used_model: Optional[str] = None

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        model: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            raise LLMProviderError(self.provider_name, "API key is not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        # Determine candidate models to try in order
        candidate_models = [model] + [m for m in self.models if m != model] if model else list(self.models)
        if not candidate_models:
            candidate_models = [settings.GROQ_DEFAULT_MODEL]

        errors: List[str] = []
        last_status_code: Optional[int] = None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for current_model in candidate_models:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.1,
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                try:
                    logger.info("Attempting Groq completion with model '%s'", current_model)
                    response = await client.post(self.BASE_URL, headers=headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content")
                        if content:
                            self.last_used_model = current_model
                            logger.info("Groq successfully served completion using model '%s'", current_model)
                            return content
                        errors.append(f"{current_model}: Empty completion payload")
                    else:
                        last_status_code = response.status_code
                        err_text = response.text[:200]
                        logger.warning(
                            "Groq model '%s' returned status %d (%s)",
                            current_model,
                            response.status_code,
                            err_text,
                        )
                        errors.append(f"{current_model}: HTTP {response.status_code} ({err_text})")
                except httpx.TimeoutException as exc:
                    logger.warning("Groq model '%s' timed out after %ss", current_model, self.timeout)
                    errors.append(f"{current_model}: Timed out after {self.timeout}s")
                except httpx.RequestError as exc:
                    logger.warning("Groq model '%s' network request error: %s", current_model, str(exc))
                    errors.append(f"{current_model}: Network error {str(exc)}")

        raise LLMProviderError(
            self.provider_name,
            f"All Groq models failed: {'; '.join(errors)}",
            status_code=last_status_code,
        )


class MistralProvider:
    """Mistral AI API provider with 3 curated, active, non-decommissioned models.

    Models:
    1. mistral-small-latest (Cost-effective fast reasoning)
    2. open-mistral-nemo (12B open-weight model with 128k context)
    3. mistral-large-latest (Flagship large language model)
    """

    provider_name = "mistral"
    BASE_URL = "https://api.mistral.ai/v1/chat/completions"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        models: Optional[List[str]] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = settings.MISTRAL_API_KEY if api_key is None else api_key
        if models is not None:
            self.models = list(models)
        else:
            self.models = list(settings.MISTRAL_MODELS)

        if default_model:
            if default_model not in self.models:
                self.models.insert(0, default_model)
            else:
                self.models.remove(default_model)
                self.models.insert(0, default_model)

        self.timeout = timeout if timeout is not None else float(settings.LLM_TIMEOUT_SECONDS)
        self.last_used_model: Optional[str] = None

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        model: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            raise LLMProviderError(self.provider_name, "API key is not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        candidate_models = [model] + [m for m in self.models if m != model] if model else list(self.models)
        if not candidate_models:
            candidate_models = [settings.MISTRAL_DEFAULT_MODEL]

        errors: List[str] = []
        last_status_code: Optional[int] = None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for current_model in candidate_models:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.1,
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                try:
                    logger.info("Attempting Mistral completion with model '%s'", current_model)
                    response = await client.post(self.BASE_URL, headers=headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content")
                        if content:
                            self.last_used_model = current_model
                            logger.info("Mistral successfully served completion using model '%s'", current_model)
                            return content
                        errors.append(f"{current_model}: Empty completion payload")
                    else:
                        last_status_code = response.status_code
                        err_text = response.text[:200]
                        logger.warning(
                            "Mistral model '%s' returned status %d (%s)",
                            current_model,
                            response.status_code,
                            err_text,
                        )
                        errors.append(f"{current_model}: HTTP {response.status_code} ({err_text})")
                except httpx.TimeoutException as exc:
                    logger.warning("Mistral model '%s' timed out after %ss", current_model, self.timeout)
                    errors.append(f"{current_model}: Timed out after {self.timeout}s")
                except httpx.RequestError as exc:
                    logger.warning("Mistral model '%s' network request error: %s", current_model, str(exc))
                    errors.append(f"{current_model}: Network error {str(exc)}")

        raise LLMProviderError(
            self.provider_name,
            f"All Mistral models failed: {'; '.join(errors)}",
            status_code=last_status_code,
        )


class OpenRouterProvider:
    """OpenRouter API provider with 3 curated, active, non-decommissioned free models.

    Models:
    1. meta-llama/llama-3.3-70b-instruct:free (Open Llama 3.3 70B free tier)
    2. mistralai/mistral-small-24b-instruct-2501:free (Mistral Small 24B free tier)
    3. google/gemini-2.0-flash-exp:free (Google Gemini 2.0 Flash experimental free tier)
    """

    provider_name = "openrouter"
    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(
        self,
        api_key: Optional[str] = None,
        default_model: Optional[str] = None,
        models: Optional[List[str]] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = settings.OPENROUTER_API_KEY if api_key is None else api_key
        if models is not None:
            self.models = list(models)
        else:
            self.models = list(settings.OPENROUTER_MODELS)

        if default_model:
            if default_model not in self.models:
                self.models.insert(0, default_model)
            else:
                self.models.remove(default_model)
                self.models.insert(0, default_model)

        self.timeout = timeout if timeout is not None else float(settings.LLM_TIMEOUT_SECONDS)
        self.last_used_model: Optional[str] = None

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        model: Optional[str] = None,
    ) -> str:
        if not self.api_key:
            raise LLMProviderError(self.provider_name, "API key is not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://strata.ai",
            "X-Title": "Strata Data Platform",
        }

        candidate_models = [model] + [m for m in self.models if m != model] if model else list(self.models)
        if not candidate_models:
            candidate_models = [settings.OPENROUTER_DEFAULT_MODEL]

        errors: List[str] = []
        last_status_code: Optional[int] = None

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for current_model in candidate_models:
                payload: Dict[str, Any] = {
                    "model": current_model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": 0.1,
                }
                if json_mode:
                    payload["response_format"] = {"type": "json_object"}

                try:
                    logger.info("Attempting OpenRouter completion with model '%s'", current_model)
                    response = await client.post(self.BASE_URL, headers=headers, json=payload)
                    if response.status_code == 200:
                        data = response.json()
                        content = data.get("choices", [{}])[0].get("message", {}).get("content")
                        if content:
                            self.last_used_model = current_model
                            logger.info("OpenRouter successfully served completion using model '%s'", current_model)
                            return content
                        errors.append(f"{current_model}: Empty completion payload")
                    else:
                        last_status_code = response.status_code
                        err_text = response.text[:200]
                        logger.warning(
                            "OpenRouter model '%s' returned status %d (%s)",
                            current_model,
                            response.status_code,
                            err_text,
                        )
                        errors.append(f"{current_model}: HTTP {response.status_code} ({err_text})")
                except httpx.TimeoutException as exc:
                    logger.warning("OpenRouter model '%s' timed out after %ss", current_model, self.timeout)
                    errors.append(f"{current_model}: Timed out after {self.timeout}s")
                except httpx.RequestError as exc:
                    logger.warning("OpenRouter model '%s' network request error: %s", current_model, str(exc))
                    errors.append(f"{current_model}: Network error {str(exc)}")

        raise LLMProviderError(
            self.provider_name,
            f"All OpenRouter models failed: {'; '.join(errors)}",
            status_code=last_status_code,
        )


class FallbackLLMProvider:
    """Orchestrates multi-tier LLM completions across providers with robust fallback.

    Architecture:
    - Tier 1: Groq (llama-3.3-70b-versatile -> llama-3.1-8b-instant -> gemma2-9b-it)
    - Tier 2: Mistral (mistral-small-latest -> open-mistral-nemo -> mistral-large-latest)
    - Tier 3: OpenRouter (llama-3.3-70b:free -> mistral-small-24b:free -> gemini-2.0-flash:free)

    Logs which provider and model served each request.
    """

    provider_name = "fallback"

    def __init__(
        self,
        providers: Optional[List[LLMProvider]] = None,
        provider_order: Optional[str] = None,
    ):
        if providers is not None:
            self.providers = providers
        else:
            self.providers = self._build_default_providers(provider_order or settings.LLM_PROVIDER_ORDER)
        self.last_used_provider: Optional[str] = None
        self.last_used_model: Optional[str] = None

    def _build_default_providers(self, order_str: str) -> List[LLMProvider]:
        names = [name.strip().lower() for name in order_str.split(",") if name.strip()]
        provider_map = {
            "groq": GroqProvider,
            "mistral": MistralProvider,
            "openrouter": OpenRouterProvider,
        }
        providers: List[LLMProvider] = []
        for name in names:
            if name in provider_map:
                providers.append(provider_map[name]())
            else:
                logger.warning("Unknown LLM provider '%s' in LLM_PROVIDER_ORDER", name)
        return providers

    async def complete(
        self,
        system: str,
        user: str,
        *,
        json_mode: bool = False,
        model: Optional[str] = None,
    ) -> str:
        """Try each provider in order until one succeeds or all fail."""
        errors: Dict[str, str] = {}

        if not self.providers:
            raise AllLLMProvidersFailedError({"configuration": "No LLM providers configured or available"})

        for provider in self.providers:
            name = getattr(provider, "provider_name", provider.__class__.__name__)
            try:
                logger.info("Fallback chain: Invoking provider '%s'", name)
                result = await provider.complete(system, user, json_mode=json_mode, model=model)
                self.last_used_provider = name
                self.last_used_model = getattr(provider, "last_used_model", None)
                logger.info(
                    "Fallback chain: Request successfully completed by provider '%s' (model: '%s')",
                    name,
                    self.last_used_model,
                )
                return result
            except Exception as e:
                err_msg = str(e)
                logger.warning(
                    "Fallback chain: Provider '%s' failed (%s). Moving to next provider.",
                    name,
                    err_msg,
                )
                errors[name] = err_msg

        self.last_used_provider = None
        self.last_used_model = None
        raise AllLLMProvidersFailedError(errors)


def get_default_llm_provider() -> FallbackLLMProvider:
    """Factory to get the configured multi-provider fallback LLM instance."""
    return FallbackLLMProvider()
