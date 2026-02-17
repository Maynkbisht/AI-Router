# Quick Start Guide: Adding New AI Providers

## Overview

Your META-AI app now supports multiple AI providers with intelligent routing. The system automatically selects the best provider for each prompt based on classification and provider strengths.

## How It Works

1. **Prompt Classification** → `classifier.py` analyzes the prompt and returns:

   - Category (e.g., `math_prompt`, `language_prompt`, `general_prompt`)
   - Confidence score
   - Keyword matches

2. **Provider Scoring** → `api_handler.py` scores each provider:

   - Category match: 0.6 points
   - Keyword overlap: 0.2 points
   - Provider quality: 0.2 points

3. **Provider Selection** → Highest-scoring provider is selected

4. **API Call** → Provider's `call()` method executes the request

5. **Response** → User gets response + metadata showing which provider was used

## Adding a New Provider

### Example: Adding Claude from Anthropic

**Step 1:** Providers are already defined in `providers.py`. Claude is already there as a placeholder! Just implement it:

```python
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

    def call(self, prompt: str) -> Dict[str, Any]:
        if not self.api_key:
            return {
                "success": False,
                "error": "Claude API key not configured.",
            }

        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=self.api_key)
            response = client.messages.create(
                model="claude-3-opus-20240229",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text
            return {"success": True, "response": text, "raw": response}
        except Exception as e:
            return {"success": False, "error": f"Claude call failed: {e}"}
```

**Step 2:** It's already registered! (See `PROVIDERS` list at bottom of `providers.py`)

**Step 3:** Set your API key:

```bash
export CLAUDE_API_KEY="your-api-key-here"
```

**Step 4:** Test it:

```bash
# Run the app
python app.py

# Send a prompt
curl -X POST http://localhost:5010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Write a short poem about AI"}'
```

## File Structure

```
✓ providers.py       → All provider classes live here
✓ api_handler.py     → Scoring logic and provider selection
✓ classifier.py      → Prompt classification
✓ data_structures.py → ChatMessage stores provider info
✓ app.py             → Flask routes (passes provider data to frontend)
✓ static/js/app.js   → Frontend displays which provider was used
```

## Provider Class Reference

```python
class MyProvider(Provider):
    def __init__(self):
        super().__init__(
            id='myprovider',              # Unique ID (used internally)
            name='My Provider',           # Display name for UI
            strengths=[                   # Categories it's good at
                'general_prompt',
                'language_prompt',
                'math_prompt'
            ],
            quality=0.85                  # Base quality (0.0-1.0)
        )
        self.api_key = os.environ.get('MYPROVIDER_API_KEY')

    def call(self, prompt: str) -> Dict[str, Any]:
        """
        Must return dict with:
        {
            'success': bool,
            'response': 'answer here',  # if success=True
            'error': 'error message',   # if success=False
            'raw': {}                   # optional raw API response
        }
        """
        pass
```

## Tuning Provider Selection

### Scenario 1: Make Gemini always win

Increase Gemini's quality score:

```python
class GeminiProvider(Provider):
    def __init__(self):
        super().__init__(
            id="gemini",
            name="Gemini (Google)",
            strengths=["language_prompt", "general_prompt"],
            quality=0.99  # ← Changed from 0.90
        )
```

### Scenario 2: Make Claude better at math

Add `math_prompt` to Claude's strengths:

```python
class ClaudeProvider(Provider):
    def __init__(self):
        super().__init__(
            id="claude",
            name="Claude (Anthropic)",
            strengths=["general_prompt", "language_prompt", "math_prompt"],  # ← Added math
            quality=0.92,
        )
```

### Scenario 3: Create a specialized provider

```python
class MathSpecialistProvider(Provider):
    def __init__(self):
        super().__init__(
            id="math_wizard",
            name="Math Wizard",
            strengths=["math_prompt"],  # ← ONLY math
            quality=0.99  # ← Very high quality for math
        )
```

Then add to `PROVIDERS`:

```python
PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    ClaudeProvider(),
    MathSpecialistProvider(),  # ← Add your specialist
    LocalEchoProvider(),
]
```

## Testing Your Provider

### Test 1: Direct Classification

```bash
curl -X POST http://localhost:5010/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Solve for x: 2x + 5 = 13"}'
```

Response shows category and keywords.

### Test 2: Full Chat Flow

```bash
curl -X POST http://localhost:5010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is the capital of France?"}'
```

Response includes:

- `ai_provider`: Which provider was selected
- `ai_type`: Provider ID
- `ai_response`: The actual answer

### Test 3: Check Provider List

```python
from providers import list_providers
print(list_providers())
```

## Debugging

**Provider not being selected?**

```python
# In api_handler.py, add logging:
def _score_provider(prompt_category, keyword_matches, provider):
    score = ...
    print(f"Provider {provider.name}: score={score:.3f}")  # ← Add this
    return score
```

**API call failing?**

1. Check environment variable: `echo $YOUR_API_KEY`
2. Check API credentials format on provider's docs
3. Test with simple prompt first
4. Check network connectivity

**Wrong provider selected?**

```python
# Verify strengths match categories:
# If prompt is "math_prompt" but selected provider has
# strengths=["general_prompt"], it won't score well
```

## API Response Format

Every chat response includes provider info:

```json
{
  "success": true,
  "message": {
    "user_prompt": "What is 2+2?",
    "ai_response": "- **The answer to 2+2 is 4.**",
    "ai_type": "local_echo",           // ← Provider ID
    "classification": "math_prompt",
    "ai_provider": "Local Echo (dev)", // ← Provider name
    "timestamp": "2025-12-15 14:30:45"
  },
  "classification": {
    "category": "math_prompt",
    "confidence": 0.99,
    "explanation": "..."
  },
  "session_stats": { ... }
}
```

## Environment Variables

```bash
# Core
export GEMINI_API_KEY="sk-..."      # Google Gemini
export OPENAI_API_KEY="sk-..."      # OpenAI
export CLAUDE_API_KEY="sk-..."      # Anthropic Claude

# Add your new provider key here
export MYPROVIDER_API_KEY="..."

# Optional Flask
export SECRET_KEY="random-secret"
```

## Next Steps

1. **Implement actual API calls** for OpenAI and Claude (placeholders exist)
2. **Add more providers** (Hugging Face, Cohere, Llama, etc.)
3. **Add provider fallback** (if primary fails, try secondary)
4. **Track provider costs** (some APIs charge per token)
5. **User preference** (let users pick favorite provider)
6. **A/B testing** (compare responses from different providers)

---

**Questions?** Check `README.md` for full documentation.
