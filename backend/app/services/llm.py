import asyncio
import json
import httpx
from typing import List, Optional, AsyncGenerator, Dict, Any

from app.config import settings, WHISK_DIR
from app.schemas import ChatMessage

# Retry: макс попыток и задержки между ними (секунды)
LLM_MAX_RETRIES = 3
LLM_RETRY_DELAYS = (1, 2, 4)


class LLMService:
    """Сервис для работы с LLM моделями (Ollama и DeepSeek)"""
    
    def _extract_content_from_obj(self, obj):
        """Извлекает контент из объекта ответа RouterAI/OpenAI"""
        if "choices" in obj and obj["choices"]:
            choice = obj["choices"][0]
            if "delta" in choice:
                delta = choice["delta"]
                return delta.get("content", "")
        return None
    
    def __init__(self):
        self.ollama_url = settings.ollama_base_url
        self.ollama_model = settings.ollama_model
        self.deepseek_url = settings.deepseek_base_url
        self.deepseek_api_key = settings.deepseek_api_key
        self.deepseek_model = settings.deepseek_model
        self.openrouter_url = settings.openrouter_base_url
        self.openrouter_api_key = settings.openrouter_api_key
        self.openrouter_model = settings.openrouter_model
        self.routerai_url = settings.routerai_base_url
        self.routerai_api_key = settings.routerai_api_key
        self.routerai_model = settings.routerai_model
        self.default_provider = settings.default_llm_provider
    
    async def chat(
        self, 
        messages: List[ChatMessage], 
        provider: Optional[str] = None,
        model: Optional[str] = None,
        stream: bool = False,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """Отправить запрос к LLM и получить ответ (с retry)."""
        provider = provider or self.default_provider
        last_error = None
        for attempt in range(LLM_MAX_RETRIES):
            try:
                if provider == "ollama":
                    return await self._chat_ollama(messages, model or self.ollama_model, stream=False, options=options)
                elif provider == "deepseek":
                    return await self._chat_deepseek(messages, model or self.deepseek_model)
                elif provider == "openrouter":
                    return await self._chat_openrouter(messages, model or self.openrouter_model)
                elif provider == "routerai":
                    return await self._chat_routerai(messages, model or self.routerai_model)
                else:
                    raise ValueError(f"Неизвестный провайдер: {provider}")
            except (httpx.HTTPError, httpx.RequestError, ValueError) as e:
                last_error = e
                if attempt < LLM_MAX_RETRIES - 1:
                    await asyncio.sleep(LLM_RETRY_DELAYS[attempt])
                else:
                    raise
        if last_error:
            raise last_error
        return ""

    async def chat_stream(
        self,
        messages: List[ChatMessage],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        options: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Стриминг ответа от LLM по частям."""
        provider = provider or self.default_provider
        if provider == "ollama":
            async for chunk in self._chat_ollama_stream(messages, model or self.ollama_model, options=options):
                yield chunk
        elif provider == "deepseek":
            async for chunk in self._chat_deepseek_stream(messages, model or self.deepseek_model):
                yield chunk
        elif provider == "openrouter":
            async for chunk in self._chat_openrouter_stream(messages, model or self.openrouter_model):
                yield chunk
        elif provider == "routerai":
            async for chunk in self._chat_routerai_stream(messages, model or self.routerai_model):
                yield chunk
        else:
            raise ValueError(f"Неизвестный провайдер: {provider}")

    async def _chat_ollama(
        self,
        messages: List[ChatMessage],
        model: str,
        stream: bool = False,
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """Запрос к Ollama (с retry)."""
        ollama_messages = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'], 
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        url = f"{self.ollama_url}/api/chat"
        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": False
        }
        if options:
            payload["options"] = options

        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            result = response.json()
            return result["message"]["content"]

    async def _chat_ollama_stream(
        self,
        messages: List[ChatMessage],
        model: str,
        options: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[str, None]:
        """Стриминг ответа от Ollama."""
        ollama_messages = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'], 
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        url = f"{self.ollama_url}/api/chat"
        payload = {
            "model": model,
            "messages": ollama_messages,
            "stream": True
        }
        if options:
            payload["options"] = options

        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if "message" in data and "content" in data["message"]:
                            content = data["message"]["content"]
                            if content:
                                yield content
                    except Exception:
                        pass

    async def _chat_deepseek(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> str:
        """Запрос к DeepSeek (с retry)."""
        if not self.deepseek_api_key:
            raise ValueError("DeepSeek API ключ не настроен")
        deepseek_messages = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'], 
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        url = f"{self.deepseek_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.deepseek_api_key}",
            "Content-Type": "application/json"
        }
        payload = {"model": model, "messages": deepseek_messages}
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]

    async def _chat_deepseek_stream(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> AsyncGenerator[str, None]:
        """Стриминг ответа от DeepSeek."""
        if not self.deepseek_api_key:
            raise ValueError("DeepSeek API ключ не настроен")
        deepseek_messages = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'], 
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        url = f"{self.deepseek_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.deepseek_api_key}",
            "Content-Type": "application/json"
        }
        payload = {"model": model, "messages": deepseek_messages, "stream": True}
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                        if "choices" in obj and obj["choices"] and "delta" in obj["choices"][0]:
                            delta = obj["choices"][0]["delta"]
                            content = delta.get("content", "")
                            if content:
                                yield content
                    except Exception:
                        pass

    async def _chat_openrouter(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> str:
        """Запрос к OpenRouter."""
        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API ключ не настроен")
        messages_list = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'],
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        # Правильный URL для OpenRouter API
        # openrouter_url должен быть "https://openrouter.ai/api/v1", поэтому endpoint будет "/chat/completions"
        base_url = self.openrouter_url.rstrip('/')
        if not base_url.endswith('/api/v1'):
            if base_url.endswith('/api'):
                url = f"{base_url}/v1/chat/completions"
            elif '/api/v1' in base_url:
                url = f"{base_url}/chat/completions"
            else:
                url = f"{base_url}/api/v1/chat/completions"
        else:
            url = f"{base_url}/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/archon-ai/archon", # Placeholder
            "X-Title": "Archon"
        }
        payload = {"model": model, "messages": messages_list}
        
        # Для reasoning моделей (например, Aurora Alpha) добавляем параметр reasoning
        if "aurora-alpha" in model.lower():
            payload["reasoning"] = {"effort": "high"}  # Рекомендуется для coding use cases
        
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"[OpenRouter] Request: model={model}, url={url}, base_url={self.openrouter_url}, has_api_key={bool(self.openrouter_api_key)}, api_key_preview={self.openrouter_api_key[:10] + '...' if self.openrouter_api_key else 'None'}, has_reasoning={'reasoning' in payload}, messages_count={len(messages_list)}")
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            
            # Обработка различных ошибок от OpenRouter
            if response.status_code == 402:
                error_detail = "Недостаточно средств на балансе OpenRouter"
                try:
                    error_data = response.json()
                    if "error" in error_data:
                        if "message" in error_data["error"]:
                            error_detail = error_data["error"]["message"]
                        elif isinstance(error_data["error"], str):
                            error_detail = error_data["error"]
                except:
                    pass
                raise ValueError(f"{error_detail}. Пожалуйста, пополните баланс на https://openrouter.ai или используйте бесплатную модель с суффиксом :free")
            elif response.status_code == 401:
                error_detail = "Неверный API ключ OpenRouter"
                try:
                    error_data = response.json()
                    if "error" in error_data and "message" in error_data["error"]:
                        error_detail = error_data["error"]["message"]
                except:
                    pass
                raise ValueError(f"{error_detail}. Пожалуйста, проверьте API ключ в настройках на https://openrouter.ai")
            elif response.status_code == 400:
                error_detail = "Неверный запрос к OpenRouter"
                try:
                    error_data = response.json()
                    if "error" in error_data and "message" in error_data["error"]:
                        error_detail = error_data["error"]["message"]
                except:
                    pass
                logger.error(f"OpenRouter 400 error: {error_detail}, model={model}, payload={payload}")
                raise ValueError(f"Ошибка запроса к OpenRouter: {error_detail}. Проверьте правильность модели и параметров запроса.")
            elif not response.is_success:
                error_detail = f"Ошибка OpenRouter (код {response.status_code})"
                try:
                    error_data = response.json()
                    if "error" in error_data and "message" in error_data["error"]:
                        error_detail = error_data["error"]["message"]
                except:
                    error_detail = f"Ошибка OpenRouter: {response.status_code} {response.text[:200]}"
                logger.error(f"OpenRouter error {response.status_code}: {error_detail}")
                raise ValueError(f"{error_detail}. Проверьте настройки на https://openrouter.ai")
            
            response.raise_for_status()
            result = response.json()
            # Обработка reasoning моделей: может быть content в message или в reasoning_details
            if "choices" in result and result["choices"]:
                choice = result["choices"][0]
                if "message" in choice:
                    content = choice["message"].get("content", "")
                    if content:
                        return content
                # Если нет content в message, проверяем reasoning_details
                if "reasoning_details" in choice:
                    # Для reasoning моделей может быть только reasoning без content
                    # В этом случае возвращаем пустую строку или сообщение об ошибке
                    logger.warning(f"OpenRouter reasoning model returned only reasoning_details without content")
                    return ""
            raise ValueError("Не удалось получить ответ от OpenRouter")

    async def generate_image_cloudflare(self, prompt: str, url: str, api_key: str) -> bytes:
        """
        Генерация изображения через Cloudflare Workers AI
        (например free-image-generation-api: https://github.com/saurav-z/free-image-generation-api).
        POST с JSON {"prompt": "..."}, ответ — бинарное изображение (JPEG/PNG).
        """
        import logging
        logger = logging.getLogger(__name__)
        if not url or not url.strip():
            raise ValueError("URL Cloudflare Worker не задан. Укажите в настройках (генерация изображений).")
        if not api_key or not api_key.strip():
            raise ValueError("API ключ Cloudflare Worker не задан. Укажите в настройках.")
        endpoint = url.strip().rstrip("/")
        if not endpoint.startswith("http"):
            endpoint = "https://" + endpoint
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
        }
        payload = {"prompt": prompt}
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(endpoint, json=payload, headers=headers)
        if response.status_code == 401:
            raise ValueError("Неверный API ключ Cloudflare Worker. Проверьте настройки.")
        if response.status_code != 200:
            try:
                err = response.json()
                detail = err.get("error") or err.get("details") or response.text[:200]
            except Exception:
                detail = response.text[:200]
            raise ValueError(f"Cloudflare Worker: {response.status_code} — {detail}")
        content_type = (response.headers.get("content-type") or "").lower()
        if "image/" not in content_type and len(response.content) > 0:
            try:
                err = response.json()
                detail = err.get("error") or err.get("details") or err.get("response")
                if isinstance(detail, str):
                    detail = detail[:150]
                else:
                    detail = str(detail)[:150]
            except Exception:
                detail = (response.text or "не текст")[:150]
            raise ValueError(
                "Cloudflare Worker не вернул изображение: указанный URL отдаёт текст/JSON, а не картинку. "
                "Нужен Worker именно для генерации изображений, например из репозитория "
                "https://github.com/saurav-z/free-image-generation-api (Stable Diffusion). Ответ сервера: " + detail
            )
        return response.content

    async def generate_image_openrouter(self, prompt: str, model: Optional[str] = None) -> bytes:
        """Генерация изображения через OpenRouter (модели с output_modalities: image)."""
        import base64
        import re
        import logging
        logger = logging.getLogger(__name__)

        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API ключ не настроен. Укажите в настройках для генерации портретов.")
        model = model or getattr(self, "openrouter_image_model", None) or "google/gemini-2.5-flash-image"
        base_url = self.openrouter_url.rstrip("/")
        if not base_url.endswith("/api/v1"):
            url = f"{base_url}/api/v1/chat/completions" if "/api" not in base_url else f"{base_url}/v1/chat/completions"
        else:
            url = f"{base_url}/chat/completions"

        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/archon-ai/archon",
            "X-Title": "Archon",
        }
        # Для моделей Sourceful используем только ["image"], для Gemini - ["image", "text"]
        modalities = ["image"] if "sourceful" in model.lower() else ["image", "text"]
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "modalities": modalities,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 401:
                raise ValueError("Неверный API ключ OpenRouter. Проверьте настройки.")
            if response.status_code == 402:
                raise ValueError("Недостаточно средств на балансе OpenRouter. Пополните баланс на openrouter.ai")
            if not response.is_success:
                raise ValueError(f"Ошибка OpenRouter: {response.status_code} {response.text[:200]}")
            result = response.json()

        if not result.get("choices"):
            logger.warning("OpenRouter image: нет choices в ответе: %s", str(result)[:500])
            raise ValueError("OpenRouter не вернул изображение")
        choice = result["choices"][0]
        message = choice.get("message") or {}

        def decode_data_url(data_url: str) -> bytes:
            if not data_url:
                raise ValueError("Пустой data_url")
            match = re.match(r"data:image/\w+;base64,(.+)", data_url.strip())
            if match:
                return base64.b64decode(match.group(1))
            # сырой base64 без префикса
            return base64.b64decode(data_url)

        def decode_raw_base64(b64_str: str) -> bytes:
            return base64.b64decode(b64_str)

        # Формат OpenRouter: message.images[] с image_url.url или imageUrl.url (camelCase)
        images = message.get("images") or []
        if images:
            img0 = images[0]
            if isinstance(img0, dict):
                url = (
                    img0.get("image_url") or img0.get("imageUrl") or {}
                )
                if isinstance(url, dict):
                    data_url = url.get("url") or url.get("URL") or ""
                else:
                    data_url = str(url) if url else ""
                if not data_url:
                    data_url = img0.get("url") or img0.get("URL") or ""
                if data_url:
                    return decode_data_url(data_url)
            elif isinstance(img0, str):
                return decode_data_url(img0) if "base64" in img0 else decode_raw_base64(img0)

        # Альтернатива: content как массив частей (OpenRouter / Gemini)
        content = message.get("content")
        if isinstance(content, list):
            for part in content:
                if not isinstance(part, dict):
                    continue
                # image_url / imageUrl с url
                img_part = part.get("image_url") or part.get("imageUrl") or part.get("image")
                if isinstance(img_part, dict):
                    image_url = img_part.get("url") or img_part.get("URL") or ""
                    if image_url:
                        return decode_data_url(image_url)
                # Gemini-style: inline_data с data (base64)
                inline = part.get("inline_data") or part.get("inlineData")
                if isinstance(inline, dict):
                    raw_b64 = inline.get("data")
                    if raw_b64:
                        return decode_raw_base64(raw_b64)

        refusal = message.get("refusal") or message.get("reasoning")
        content_str = message.get("content") if isinstance(message.get("content"), str) else ""
        hint = ""
        if refusal:
            hint = f" Причина/отказ модели: {str(refusal)[:300]}"
        elif content_str and "image" not in content_str.lower():
            hint = f" Ответ модели (текст): {content_str[:200]}"
        logger.warning(
            "OpenRouter image: модель не вернула изображение. message keys=%s, has images=%s, content type=%s.%s",
            list(message.keys()),
            bool(images),
            type(content).__name__ if content is not None else "None",
            f" refusal={str(refusal)[:100]!r}" if refusal else "",
        )
        raise ValueError(
            "Модель не вернула изображение. Выберите модель с поддержкой генерации изображений (image) на openrouter.ai/models."
            + hint
        )

    async def generate_image_pixazo_schnell(self, prompt: str, api_key: str) -> bytes:
        """Генерация изображения по тексту через Pixazo Flux 1 Schnell (бесплатный Text-to-Image)."""
        import base64
        import logging
        logger = logging.getLogger(__name__)
        if not api_key or not api_key.strip():
            raise ValueError("Pixazo API ключ не настроен. Укажите в настройках (генерация изображений).")
        url = "https://gateway.pixazo.ai/flux-1-schnell/v1/getData"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key.strip(),
            "Content-Type": "application/json",
        }
        payload = {
            "prompt": prompt,
            "num_steps": 4,
            "height": 1024,
            "width": 1024,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 401:
            raise ValueError("Неверный Pixazo API ключ. Проверьте настройки.")
        if response.status_code == 403:
            try:
                err = response.json()
                msg = (err.get("error") or err.get("message") or response.text or "").lower()
            except Exception:
                msg = (response.text or "").lower()
            if "balance" in msg or "insufficient" in msg:
                raise ValueError(
                    "Недостаточно средств на балансе Pixazo. Пополните счёт в личном кабинете: api-console.pixazo.ai"
                )
            raise ValueError(f"Pixazo API: 403 — {msg or 'доступ запрещён'}")
        if not response.is_success:
            try:
                err = response.json()
                detail = err.get("error") or err.get("message") or response.text[:200]
            except Exception:
                detail = response.text[:200]
            raise ValueError(f"Pixazo API: {response.status_code} — {detail}")
        return self._decode_pixazo_image_response(response, logger)

    async def generate_image_pixazo_text_to_image(self, prompt: str, api_key: str) -> bytes:
        """Генерация изображения по тексту через Pixazo Flux 2 Pro (Text-to-Image, платный)."""
        import base64
        import re
        import logging
        logger = logging.getLogger(__name__)
        if not api_key or not api_key.strip():
            raise ValueError("Pixazo API ключ не настроен. Укажите в настройках (генерация изображений).")
        url = "https://gateway.pixazo.ai/flux-2-pro-text-to-image-799/v1/flux-2-pro-text-to-image-request"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key.strip(),
            "Content-Type": "application/json",
        }
        payload = {"prompt": prompt}
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 401:
            raise ValueError("Неверный Pixazo API ключ. Проверьте настройки.")
        if response.status_code == 403:
            try:
                err = response.json()
                msg = (err.get("error") or err.get("message") or response.text or "").lower()
            except Exception:
                msg = (response.text or "").lower()
            if "balance" in msg or "insufficient" in msg:
                raise ValueError(
                    "Недостаточно средств на балансе Pixazo. Пополните счёт в личном кабинете: api-console.pixazo.ai"
                )
            raise ValueError(f"Pixazo API: 403 — {msg or 'доступ запрещён'}")
        if not response.is_success:
            try:
                err = response.json()
                detail = err.get("error") or err.get("message") or response.text[:200]
            except Exception:
                detail = response.text[:200]
            raise ValueError(f"Pixazo API: {response.status_code} — {detail}")
        return self._decode_pixazo_image_response(response, logger)

    async def generate_image_pixazo_image_to_image(
        self, prompt: str, image_bytes: bytes, api_key: str
    ) -> bytes:
        """Генерация изображения по референсу через Pixazo Flux 2 Pro (Image-to-Image).
        Документация: https://www.pixazo.ai/models/flux#image-to-image
        """
        import base64
        import re
        import logging
        logger = logging.getLogger(__name__)
        if not api_key or not api_key.strip():
            raise ValueError("Pixazo API ключ не настроен. Укажите в настройках (генерация изображений).")
        url = "https://gateway.pixazo.ai/flux-2-pro-image-to-image-866/v1/flux-2-pro-image-to-image-request"
        headers = {
            "Ocp-Apim-Subscription-Key": api_key.strip(),
            "Content-Type": "application/json",
        }
        image_b64 = base64.b64encode(image_bytes).decode("ascii")
        payload = {"prompt": prompt, "image": image_b64}
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
        if response.status_code == 401:
            raise ValueError("Неверный Pixazo API ключ. Проверьте настройки.")
        if response.status_code == 403:
            try:
                err = response.json()
                msg = (err.get("error") or err.get("message") or response.text or "").lower()
            except Exception:
                msg = (response.text or "").lower()
            if "balance" in msg or "insufficient" in msg:
                raise ValueError(
                    "Недостаточно средств на балансе Pixazo. Пополните счёт в личном кабинете: api-console.pixazo.ai"
                )
            raise ValueError(f"Pixazo API: 403 — {msg or 'доступ запрещён'}")
        if not response.is_success:
            try:
                err = response.json()
                detail = err.get("error") or err.get("message") or response.text[:200]
            except Exception:
                detail = response.text[:200]
            raise ValueError(f"Pixazo API: {response.status_code} — {detail}")
        return self._decode_pixazo_image_response(response, logger)

    def _decode_pixazo_image_response(self, response: httpx.Response, logger) -> bytes:
        """Извлечь байты изображения из ответа Pixazo (JSON с base64 или бинарный)."""
        import base64
        import re

        def safe_b64decode(b64_str: str) -> bytes:
            s = b64_str.strip().replace("\n", "").replace("\r", "").replace(" ", "")
            if not s:
                raise ValueError("Пустая строка base64")
            remainder = len(s) % 4
            if remainder:
                s += "=" * (4 - remainder)
            try:
                return base64.b64decode(s)
            except Exception:
                try:
                    return base64.b64decode(s, altchars="-_")
                except Exception as e:
                    raise ValueError(f"Не удалось декодировать base64: {e}") from e

        ct = (response.headers.get("content-type") or "").lower()
        if "image/" in ct:
            return response.content
        try:
            data = response.json()
        except Exception:
            if response.content and len(response.content) > 100:
                return response.content
            raise ValueError("Pixazo не вернул изображение: ответ не JSON и не картинка.")
        for key in ("image", "output", "data", "output_image", "result"):
            raw = data.get(key)
            if isinstance(raw, str):
                match = re.match(r"data:image/\w+;base64,(.+)", raw.strip())
                b64 = match.group(1) if match else raw
                return safe_b64decode(b64)
        if isinstance(data.get("images"), list) and data["images"]:
            raw = data["images"][0]
            if isinstance(raw, str):
                return safe_b64decode(raw)
        logger.warning("Pixazo image: неизвестный формат ответа keys=%s", list(data.keys()))
        raise ValueError("Pixazo не вернул изображение в ожидаемом формате.")

    async def generate_image_whisk(self, prompt: str, cookie: str, aspect_ratio: str = "landscape") -> bytes:
        """Генерация изображения через Whisk (Google Labs). Требуется Node.js и установленные зависимости в backend/whisk."""
        import logging
        import os
        import shutil
        import subprocess
        import tempfile
        logger = logging.getLogger(__name__)
        if not cookie or not cookie.strip():
            raise ValueError("Для Whisk укажите cookie Google (настройки → Генерация изображений). Инструкция: labs.google, F12 → Application → Cookies → скопировать значение.")
        script = WHISK_DIR / "generate.mjs"
        if not script.exists():
            raise ValueError(
                "Скрипт Whisk не найден. Установите зависимости: в папке backend/whisk выполните npm install."
            )
        tmpdir = tempfile.mkdtemp(prefix="archon_whisk_")
        try:
            env = os.environ.copy()
            env["COOKIE"] = cookie.strip()

            aspect = (aspect_ratio or "landscape").strip().lower()
            if aspect not in ("landscape", "portrait", "square"):
                aspect = "landscape"

            def _run_whisk_sync() -> tuple[bytes, bytes, int]:
                """Синхронный запуск (обход NotImplementedError asyncio subprocess на Windows)."""
                r = subprocess.run(
                    ["node", str(script), prompt, tmpdir, aspect],
                    capture_output=True,
                    timeout=120,
                    cwd=str(WHISK_DIR),
                    env=env,
                )
                return (r.stdout or b""), (r.stderr or b""), r.returncode

            try:
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, _run_whisk_sync),
                    timeout=125.0,
                )
                stdout_bytes, stderr_bytes, returncode = result
            except FileNotFoundError:
                raise ValueError(
                    "Node.js не найден. Установите Node.js (nodejs.org) и запускайте бэкенд из терминала, где доступна команда node (node --version)."
                )
            except asyncio.TimeoutError:
                raise ValueError("Whisk: таймаут 2 мин. Проверьте cookie и доступность labs.google.")
            except subprocess.TimeoutExpired:
                raise ValueError("Whisk: таймаут 2 мин. Проверьте cookie и доступность labs.google.")
            if returncode != 0:
                err = (stderr_bytes or b"").decode("utf-8", errors="replace").strip()
                logger.warning("Whisk stderr: %s", err)
                raise ValueError(err or "Whisk не вернул изображение. Проверьте cookie и доступность labs.google.")
            stdout_str = (stdout_bytes or b"").decode("utf-8", errors="replace").strip()
            lines = [s.strip() for s in stdout_str.splitlines() if s.strip()]
            out_path = lines[0] if lines else ""
            if out_path:
                out_path = out_path.replace("/", os.sep)
            if not out_path or not os.path.isabs(out_path):
                out_path = os.path.normpath(os.path.join(tmpdir, os.path.basename(out_path) if out_path else ""))
            if not os.path.isfile(out_path):
                try:
                    candidates = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.lower().endswith((".png", ".jpg", ".webp"))]
                except OSError:
                    candidates = []
                if not candidates:
                    raise ValueError(
                        "Скрипт Whisk не вернул путь к файлу и не сохранил изображение. "
                        "Проверьте cookie (полная строка из Network → Request Headers → Cookie), "
                        "что в backend/whisk выполнен npm install и Node.js доступен (node --version)."
                    )
                out_path = candidates[0]
            with open(out_path, "rb") as f:
                return f.read()
        finally:
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

    async def _chat_openrouter_stream(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> AsyncGenerator[str, None]:
        """Стриминг ответа от OpenRouter."""
        # Явно используем глобальный модуль json
        import json as json_module
        
        if not self.openrouter_api_key:
            raise ValueError("OpenRouter API ключ не настроен")
        messages_list = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'],
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        # Правильный URL для OpenRouter API
        # openrouter_url должен быть "https://openrouter.ai/api/v1"
        base_url = self.openrouter_url.rstrip('/')
        if base_url.endswith('/api/v1'):
            url = f"{base_url}/chat/completions"
        elif base_url.endswith('/api'):
            url = f"{base_url}/v1/chat/completions"
        elif '/api/v1' in base_url:
            url = f"{base_url}/chat/completions"
        else:
            url = f"{base_url}/api/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/archon-ai/archon",
            "X-Title": "Archon"
        }
        payload = {"model": model, "messages": messages_list, "stream": True}
        
        # Для reasoning моделей (например, Aurora Alpha) добавляем параметр reasoning
        if "aurora-alpha" in model.lower():
            payload["reasoning"] = {"effort": "high"}  # Рекомендуется для coding use cases
        
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"[OpenRouter] Stream request: model={model}, url={url}, base_url={self.openrouter_url}, has_api_key={bool(self.openrouter_api_key)}, api_key_preview={self.openrouter_api_key[:10] + '...' if self.openrouter_api_key else 'None'}, payload_keys={list(payload.keys())}, messages_count={len(messages_list)}")
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                    # Обработка различных ошибок от OpenRouter
                    if response.status_code == 402:
                        error_detail = "Недостаточно средств на балансе OpenRouter"
                        try:
                            error_text = await response.aread()
                            error_data = json.loads(error_text.decode())
                            if "error" in error_data:
                                if "message" in error_data["error"]:
                                    error_detail = error_data["error"]["message"]
                                elif isinstance(error_data["error"], str):
                                    error_detail = error_data["error"]
                        except:
                            pass
                        raise ValueError(f"{error_detail}. Пожалуйста, пополните баланс на https://openrouter.ai или используйте бесплатную модель с суффиксом :free")
                    elif response.status_code == 401:
                        error_detail = "Неверный API ключ OpenRouter"
                        try:
                            error_text = await response.aread()
                            error_data = json.loads(error_text.decode())
                            if "error" in error_data and "message" in error_data["error"]:
                                error_detail = error_data["error"]["message"]
                        except:
                            pass
                        raise ValueError(f"{error_detail}. Пожалуйста, проверьте API ключ в настройках на https://openrouter.ai")
                    elif response.status_code == 400:
                        error_detail = "Неверный запрос к OpenRouter"
                        try:
                            error_text = await response.aread()
                            error_data = json.loads(error_text.decode())
                            if "error" in error_data and "message" in error_data["error"]:
                                error_detail = error_data["error"]["message"]
                        except:
                            pass
                        logger.error(f"OpenRouter 400 error: {error_detail}, model={model}")
                        raise ValueError(f"Ошибка запроса к OpenRouter: {error_detail}. Проверьте правильность модели и параметров запроса.")
                    elif not response.is_success:
                        error_detail = f"Ошибка OpenRouter (код {response.status_code})"
                        try:
                            error_text = await response.aread()
                            error_data = json.loads(error_text.decode())
                            if "error" in error_data and "message" in error_data["error"]:
                                error_detail = error_data["error"]["message"]
                        except:
                            pass
                        logger.error(f"OpenRouter error {response.status_code}: {error_detail}")
                        raise ValueError(f"{error_detail}. Проверьте настройки на https://openrouter.ai")
                    
                    response.raise_for_status()
                    
                    # Логируем начало стрима
                    logger.warning(f"[OpenRouter] Stream started: status={response.status_code}, model={model}")
                    
                    chunk_count = 0
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        
                        # Логируем первые несколько строк для отладки
                        if chunk_count < 3:
                            logger.debug(f"OpenRouter stream line {chunk_count}: {line[:200]}")
                        
                        if not line.startswith("data: "):
                            continue
                        
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            logger.info(f"OpenRouter stream completed: total_chunks={chunk_count}")
                            break
                        
                        try:
                            obj = json_module.loads(data)
                            # Обработка reasoning моделей: может быть content в delta или в message
                            if "choices" in obj and obj["choices"]:
                                choice = obj["choices"][0]
                                content = None
                                
                                # Стандартный формат: delta.content
                                if "delta" in choice:
                                    content = choice["delta"].get("content", "")
                                # Альтернативный формат для reasoning: message.content
                                elif "message" in choice and "content" in choice["message"]:
                                    content = choice["message"]["content"]
                                
                                if content:
                                    chunk_count += 1
                                    yield content
                        except Exception as e:
                            logger.warning(f"OpenRouter stream parse error: {e}, data: {data[:200]}")
                            # Не прерываем стрим при ошибке парсинга одного чанка
                            pass
                    
                    if chunk_count == 0:
                        logger.error(f"[OpenRouter] Stream: NO CONTENT CHUNKS RECEIVED! model={model}, url={url}")
    
    async def _chat_routerai(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> str:
        """Запрос к RouterAI."""
        if not self.routerai_api_key:
            raise ValueError("RouterAI API ключ не настроен")
        messages_list = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'],
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        # Формируем URL для chat/completions
        # routerai_url может быть "https://routerai.ru/api/v1" или "https://routerai.ru"
        base_url = self.routerai_url.rstrip('/')
        if '/api/v1' in base_url:
            url = f"{base_url}/chat/completions"
        elif '/api' in base_url:
            url = f"{base_url}/v1/chat/completions"
        else:
            url = f"{base_url}/api/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.routerai_api_key}",
            "Content-Type": "application/json"
        }
        payload = {"model": model, "messages": messages_list}
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code == 402:
                raise ValueError("Недостаточно средств на балансе RouterAI. Пожалуйста, пополните баланс на https://routerai.ru")
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]

    async def _chat_routerai_stream(
        self,
        messages: List[ChatMessage],
        model: str
    ) -> AsyncGenerator[str, None]:
        """Стриминг ответа от RouterAI."""
        import logging
        logger = logging.getLogger(__name__)
        
        if not self.routerai_api_key:
            raise ValueError("RouterAI API ключ не настроен")
        messages_list = [
            {"role": msg.role if hasattr(msg, 'role') else msg['role'],
             "content": msg.content if hasattr(msg, 'content') else msg['content']}
            for msg in messages
        ]
        # Формируем URL для chat/completions
        # routerai_url может быть "https://routerai.ru/api/v1" или "https://routerai.ru"
        base_url = self.routerai_url.rstrip('/')
        if '/api/v1' in base_url:
            url = f"{base_url}/chat/completions"
        elif '/api' in base_url:
            url = f"{base_url}/v1/chat/completions"
        else:
            url = f"{base_url}/api/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {self.routerai_api_key}",
            "Content-Type": "application/json"
        }
        payload = {"model": model, "messages": messages_list, "stream": True}
        logger.debug(f"RouterAI stream: отправка запроса на {url}, model={model}")
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                if response.status_code == 402:
                    raise ValueError("Недостаточно средств на балансе RouterAI. Пожалуйста, пополните баланс на https://routerai.ru")
                response.raise_for_status()
                
                chunk_count = 0
                
                # Используем aiter_lines для построчного чтения SSE потока
                # RouterAI использует стандартный OpenAI формат SSE, где каждая строка - это отдельное сообщение
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    
                    # Пропускаем строки без префикса "data: "
                    if not line.startswith("data: "):
                        continue
                    
                    data = line[6:]  # Убираем префикс "data: "
                    
                    # Проверяем завершение стрима
                    if data.strip() == "[DONE]":
                        logger.debug(f"RouterAI stream: получен маркер [DONE], всего чанков: {chunk_count}")
                        break
                    
                    # Пропускаем пустые данные
                    if not data.strip():
                        continue
                    
                    try:
                        obj = json.loads(data)
                        content = self._extract_content_from_obj(obj)
                        if content:
                            chunk_count += 1
                            # Логируем каждый чанк для отладки (первые 5 и каждые 10-й)
                            if chunk_count <= 5 or chunk_count % 10 == 0:
                                logger.debug(f"RouterAI stream: чанк #{chunk_count}, длина: {len(content)}")
                            # Отправляем контент немедленно
                            yield content
                        
                        # Проверяем наличие finish_reason для логирования
                        if "choices" in obj and obj["choices"]:
                            choice = obj["choices"][0]
                            if "finish_reason" in choice and choice["finish_reason"]:
                                logger.debug(f"RouterAI stream: завершение с причиной: {choice['finish_reason']}")
                    
                    except json.JSONDecodeError as e:
                        # Если JSON невалидный, логируем только первые ошибки
                        if chunk_count == 0:
                            logger.debug(f"RouterAI stream: ошибка парсинга JSON: {e}, данные: {data[:200]}")
                        continue
                    except Exception as e:
                        logger.error(f"RouterAI stream: неожиданная ошибка при обработке чанка: {e}", exc_info=True)
                        continue
                
                if chunk_count == 0:
                    logger.warning("RouterAI stream: не получено ни одного чанка контента")

    async def list_models(self, provider: Optional[str] = None) -> List[str]:
        """Получить список доступных моделей"""
        
        provider = provider or self.default_provider
        
        if provider == "ollama":
            models = []
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(f"{self.ollama_url}/api/tags")
                    if response.status_code == 200:
                        data = response.json()
                        models = [m["name"] for m in data.get("models", [])]
            except Exception:
                pass
            
            # Всегда добавляем текущую модель из настроек, если её нет в списке
            if self.ollama_model and self.ollama_model not in models:
                models.append(self.ollama_model)
            
            # Сортируем модели: DeepSeek и QWEN сначала
            def model_priority(model_name: str) -> int:
                model_lower = model_name.lower()
                if 'deepseek' in model_lower:
                    return 1  # DeepSeek - самый высокий приоритет
                elif 'qwen' in model_lower:
                    return 2  # QWEN - второй приоритет
                else:
                    return 3  # Остальные модели
            
            # Сортируем модели по приоритету (DeepSeek и QWEN сначала), затем по алфавиту
            models_sorted = sorted(models, key=lambda m: (model_priority(m), m.lower()))
            
            # Если список пуст, возвращаем хотя бы модель по умолчанию
            return models_sorted if models_sorted else [self.ollama_model]
        
        elif provider == "deepseek":
            if self.deepseek_api_key:
                return ["deepseek-chat", "deepseek-coder"]
            return []
        
        elif provider == "openrouter":
            # Популярные модели OpenRouter, которые всегда должны быть доступны
            popular_models = [
                "openrouter/aurora-alpha",  # Бесплатная reasoning модель
                "google/gemini-pro-1.5",
                "anthropic/claude-3.5-sonnet",
                "openai/gpt-4-turbo",
                "openai/gpt-3.5-turbo",
            ]
            
            if self.openrouter_api_key:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(f"{self.openrouter_url}/models")
                        if response.status_code == 200:
                            data = response.json()
                            models = [m["id"] for m in data.get("data", [])]
                            
                            # Добавляем популярные модели, если их нет в списке
                            for popular_model in popular_models:
                                if popular_model not in models:
                                    models.append(popular_model)
                            
                            # Всегда добавляем текущую модель из настроек, если её нет в списке
                            if self.openrouter_model and self.openrouter_model not in models:
                                models.insert(0, self.openrouter_model)
                            
                            # Сортируем модели: бесплатные (:free) и популярные сначала
                            def sort_key(model_name: str) -> tuple:
                                is_free = ":free" in model_name
                                is_popular = model_name in popular_models
                                is_current = model_name == self.openrouter_model
                                # Приоритет: бесплатные > популярные > текущая модель > остальные
                                return (not is_free, not is_popular, not is_current, model_name)
                            
                            models_sorted = sorted(models, key=sort_key)
                            return models_sorted
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"OpenRouter API error: {e}, using fallback models")
            
            # Fallback: возвращаем популярные модели + текущую модель из настроек
            # Это гарантирует, что Aurora Alpha всегда доступна, даже без API ключа или при ошибке API
            fallback_models = popular_models.copy()
            if self.openrouter_model and self.openrouter_model not in fallback_models:
                fallback_models.insert(0, self.openrouter_model)
            return fallback_models

        elif provider == "routerai":
            # RouterAI совместим с OpenAI API, но может не иметь endpoint /models
            # Поэтому сначала пробуем получить модели через API, если не получается - используем fallback
            if self.routerai_api_key:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        headers = {
                            "Authorization": f"Bearer {self.routerai_api_key}",
                            "Content-Type": "application/json"
                        }
                        # Пробуем получить модели через API
                        # RouterAI совместим с OpenAI API, пробуем разные варианты endpoints
                        base_url = self.routerai_url.rstrip('/v1').rstrip('/api')
                        endpoints_to_try = [
                            f"{base_url}/api/v1/models",  # Стандартный OpenAI-совместимый endpoint
                            f"{base_url}/v1/models",
                            f"{base_url}/models",
                            f"{self.routerai_url}/models",
                            f"{self.routerai_url}/v1/models"
                        ]
                        
                        import logging
                        logger = logging.getLogger(__name__)
                        
                        for endpoint in endpoints_to_try:
                            try:
                                logger.debug(f"RouterAI: пробуем endpoint {endpoint}")
                                response = await client.get(endpoint, headers=headers)
                                if response.status_code == 200:
                                    data = response.json()
                                    # RouterAI/OpenRouter формат: {"data": [{"id": "model-name", ...}, ...]}
                                    models = []
                                    if isinstance(data, dict):
                                        if "data" in data:
                                            # Стандартный формат OpenRouter/RouterAI
                                            models = [m.get("id") or m.get("name") or str(m) for m in data.get("data", [])]
                                        elif "models" in data:
                                            models = [m.get("id") or m.get("name") or str(m) for m in data.get("models", [])]
                                    elif isinstance(data, list):
                                        # Прямой список моделей
                                        models = [m.get("id") or m.get("name") or str(m) if isinstance(m, dict) else str(m) for m in data]
                                    
                                    # Всегда добавляем текущую модель из настроек, если её нет в списке
                                    if self.routerai_model and self.routerai_model not in models:
                                        models.insert(0, self.routerai_model)
                                    
                                    # Перемещаем бесплатную модель в начало списка
                                    free_model = "qwen/qwen3-235b-a22b-thinking-2507"
                                    if free_model in models:
                                        models.remove(free_model)
                                        models.insert(0, free_model)
                                    
                                    # Если список не пуст, возвращаем его
                                    if models:
                                        logger.info(f"RouterAI: успешно загружено {len(models)} моделей из API через {endpoint}")
                                        return models
                                    else:
                                        logger.warning(f"RouterAI: endpoint {endpoint} вернул пустой список моделей")
                            except httpx.HTTPStatusError as e:
                                # Логируем статус код для отладки
                                logger.debug(f"RouterAI: endpoint {endpoint} вернул статус {e.response.status_code}")
                                # Пробуем следующий endpoint
                                continue
                            except Exception as e:
                                logger.debug(f"RouterAI: ошибка при запросе к {endpoint}: {e}")
                                # Пробуем следующий endpoint
                                continue
                        
                        # Если ни один endpoint не сработал, логируем
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning("RouterAI: не удалось загрузить модели через API, используем fallback")
                        
                except httpx.HTTPStatusError as e:
                    # Логируем ошибку для отладки
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"HTTP ошибка при загрузке моделей RouterAI: {e.response.status_code} - {e.response.text[:200]}")
                except Exception as e:
                    # Логируем ошибку для отладки
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Ошибка при загрузке моделей RouterAI: {e}")
            
            # Fallback: возвращаем популярные модели RouterAI из каталога
            # Включая бесплатные модели (например, qwen/qwen3-235b-a22b-thinking-2507 с бесплатным провайдером Alibaba)
            fallback_models = [
                "qwen/qwen3-235b-a22b-thinking-2507",  # Бесплатная модель через провайдер Alibaba
                "anthropic/claude-sonnet-4.6",
                "openai/gpt-5.2",
                "deepseek/deepseek-v3.2",
                "google/gemini-3-pro-preview",
                "x-ai/grok-4",
                "qwen/qwen3.5-plus-02-15",
                "qwen/qwen3.5-397b-a17b",
                "minimax/minimax-m2.5",
                "z-ai/glm-5",
                "qwen/qwen3-max-thinking",
                "anthropic/claude-opus-4.6",
                "qwen/qwen3-coder-next",
                "stepfun/step-3.5-flash",
                "moonshotai/kimi-k2.5",
                "minimax/minimax-m2-her",
                "openai/gpt-3.5-turbo",
                "openai/gpt-4"
            ]
            
            # Всегда добавляем текущую модель из настроек в начало списка
            if self.routerai_model and self.routerai_model not in fallback_models:
                fallback_models.insert(0, self.routerai_model)
            
            return fallback_models

        return []
    
    async def check_connection(self, provider: Optional[str] = None) -> dict:
        """Проверить подключение к провайдеру"""
        
        result = {}
        
        # Проверка Ollama
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.ollama_url}/api/tags")
                result["ollama"] = {
                    "status": "connected" if response.status_code == 200 else "error",
                    "url": self.ollama_url
                }
        except Exception as e:
            result["ollama"] = {
                "status": "disconnected",
                "url": self.ollama_url,
                "error": str(e)
            }
        
        # Проверка DeepSeek
        if self.deepseek_api_key:
            result["deepseek"] = {
                "status": "configured",
                "url": self.deepseek_url
            }
        else:
            result["deepseek"] = {
                "status": "not_configured",
                "url": self.deepseek_url
            }
        
        # Проверка OpenRouter
        if self.openrouter_api_key:
            result["openrouter"] = {
                "status": "configured",
                "url": self.openrouter_url
            }
        else:
            result["openrouter"] = {
                "status": "not_configured",
                "url": self.openrouter_url
            }

        # Проверка RouterAI
        if self.routerai_api_key:
            result["routerai"] = {
                "status": "configured",
                "url": self.routerai_url
            }
        else:
            result["routerai"] = {
                "status": "not_configured",
                "url": self.routerai_url
            }

        return result

llm_service = LLMService()
