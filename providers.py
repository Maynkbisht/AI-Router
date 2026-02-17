"""AI Provider registry and base classes.

This module defines the Provider interface and implementations for different AI backends.
To add a new provider (e.g., Gemini, Claude, GPT-4):

1. Create a class inheriting from Provider
2. Implement the call() method
3. Add it to the PROVIDERS list at the bottom
"""

import os
import requests
import urllib3
from typing import List, Dict, Any

# Disable SSL warnings for macOS compatibility
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class Provider:
    """Base class for AI providers."""

    def __init__(self, id: str, name: str, strengths: List[str], quality: float = 0.8):
        self.id = id
        self.name = name
        self.strengths = strengths
        self.quality = float(quality)

    def call(self, prompt: str) -> Dict[str, Any]:
        """Call the provider with the prompt.

        Returns dict with keys: success, response or error, raw.
        """
        raise NotImplementedError()


class GeminiProvider(Provider):
    """Google Gemini API provider."""

    def __init__(self):
        super().__init__(
            id="gemini",
            name="Gemini (Google)",
            strengths=["language_prompt", "general_prompt"],
            quality=0.90,
        )
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "success": False,
                "error": "Gemini API key not configured. Set GEMINI_API_KEY.",
            }

        url = f"{self.base_url}?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {"contents": [{"parts": [{"text": prompt}]}]}

        try:
            # Use verify=False to bypass SSL issues on macOS
            r = requests.post(
                url, headers=headers, json=payload, timeout=30, verify=False
            )
            r.raise_for_status()
            data = r.json()

            answer = ""
            try:
                answer = (
                    data.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                ).strip()
            except Exception:
                answer = ""

            if not answer:
                return {
                    "success": False,
                    "error": f"Empty response from Gemini: {str(data)[:200]}",
                }

            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Gemini request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {
                "success": False,
                "error": f"Gemini connection error: {str(e)[:100]}",
            }
        except Exception as e:
            return {"success": False, "error": f"Gemini error: {str(e)[:100]}"}


class OpenAIProvider(Provider):
    """OpenAI GPT API provider."""

    def __init__(self):
        super().__init__(
            id="openai",
            name="OpenAI",
            strengths=["general_prompt", "math_prompt", "language_prompt"],
            quality=0.93,
        )
        self.api_key = os.environ.get("OPENAI_API_KEY")
        self.base_url = "https://api.openai.com/v1/chat/completions"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "success": False,
                "error": "OpenAI API key not configured. Set OPENAI_API_KEY.",
            }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": 500,
        }

        try:
            # Use verify=False to bypass SSL issues on macOS
            r = requests.post(
                self.base_url, headers=headers, json=payload, timeout=30, verify=False
            )
            r.raise_for_status()
            data = r.json()
            answer = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not answer:
                return {
                    "success": False,
                    "error": f"Empty response from OpenAI: {str(data)[:200]}",
                }
            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "OpenAI request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {
                "success": False,
                "error": f"OpenAI connection error: {str(e)[:100]}",
            }
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return {
                    "success": False,
                    "error": "OpenAI rate limit exceeded - trying next provider",
                }
            return {
                "success": False,
                "error": f"OpenAI HTTP error {e.response.status_code}",
            }
        except Exception as e:
            return {"success": False, "error": f"OpenAI error: {str(e)[:100]}"}


class ClaudeProvider(Provider):
    """Anthropic Claude API provider."""

    def __init__(self):
        super().__init__(
            id="claude",
            name="Claude (Anthropic)",
            strengths=["general_prompt", "language_prompt"],
            quality=0.92,
        )
        self.api_key = os.environ.get("CLAUDE_API_KEY")
        self.base_url = "https://api.anthropic.com/v1/messages"

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "success": False,
                "error": "Claude API key not configured. Set CLAUDE_API_KEY.",
            }

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 500,
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            # Use verify=False to bypass SSL issues on macOS
            r = requests.post(
                self.base_url, headers=headers, json=payload, timeout=30, verify=False
            )
            r.raise_for_status()
            data = r.json()
            answer = data.get("content", [{}])[0].get("text", "").strip()
            if not answer:
                return {
                    "success": False,
                    "error": f"Empty response from Claude: {str(data)[:200]}",
                }
            return {"success": True, "response": answer, "raw": data}
        except requests.exceptions.Timeout:
            return {"success": False, "error": "Claude request timeout (30s exceeded)"}
        except requests.exceptions.ConnectionError as e:
            return {
                "success": False,
                "error": f"Claude connection error: {str(e)[:100]}",
            }
        except Exception as e:
            return {"success": False, "error": f"Claude error: {str(e)[:100]}"}


class LocalEchoProvider(Provider):
    """Local Echo provider for math and basic responses."""

    def __init__(self):
        super().__init__(
            id="local_echo",
            name="Local Echo (dev)",
            strengths=["math_prompt"],
            quality=0.5,
        )

    def call(self, prompt: str) -> Dict[str, Any]:
        import re

        # Try to find mathematical expression
        expr_match = re.search(
            r"(\d+(?:\.\d+)?)\s*([\+\-\*\/])\s*(\d+(?:\.\d+)?)", prompt
        )
        if expr_match:
            try:
                num1, op, num2 = expr_match.groups()
                expr = f"{num1}{op}{num2}"
                result = eval(expr)
                return {
                    "success": True,
                    "response": f"The answer to {expr} is **{result}**.",
                }
            except Exception as e:
                return {
                    "success": False,
                    "error": f"Math evaluation failed: {str(e)[:100]}",
                }

        # For non-math queries, provide helpful response
        return {
            "success": True,
            "response": f"I processed your request: '{prompt[:100]}...' but I'm limited to math calculations. For other queries, please use OpenAI or Gemini.",
        }


PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    ClaudeProvider(),
    LocalEchoProvider(),
]


def get_provider_by_id(provider_id: str):
    """Look up a provider by its ID."""
    for p in PROVIDERS:
        if p.id == provider_id:
            return p
    return None


def list_providers():
    """Return a list of available provider info."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "strengths": p.strengths,
            "quality": p.quality,
        }
        for p in PROVIDERS
    ]
