# Architecture & Data Flow

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│                    (HTML/CSS/JavaScript)                         │
│                   (templates/index.html)                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST /api/chat
                         │ {prompt: "..."}
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Flask Application (app.py)                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ POST /api/chat:                                          │   │
│  │ 1. Get prompt from request                               │   │
│  │ 2. Call classifier.classify_prompt()                    │   │
│  │ 3. Call api_handler.call_ai_api()                       │   │
│  │ 4. Create ChatMessage with provider info                │   │
│  │ 5. Return JSON response                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└────┬──────────────┬──────────────────────────────┬───────────────┘
     │              │                              │
     ↓              ↓                              ↓
┌──────────┐  ┌───────────┐  ┌────────────────────────────────┐
│Classifier│  │ API Handler│  │    Provider Registry           │
│           │  │           │  │  (providers.py)                │
└──────────┘  └───────────┘  │                                │
     │              │         │ ┌──────────────────────────┐   │
     │              │         │ │ GeminiProvider           │   │
     ↓              │         │ │  ├─ id: "gemini"        │   │
  analyze prompt    │         │ │  ├─ name: "Gemini..."   │   │
                    │         │ │  ├─ strengths: [...]    │   │
  return:           │         │ │  └─ call(prompt)        │   │
  - category        │         │ └──────────────────────────┘   │
  - confidence      │         │                                │
  - keywords        │         │ ┌──────────────────────────┐   │
                    │         │ │ OpenAIProvider           │   │
                    │         │ │  ├─ id: "openai"        │   │
                    │         │ │  ├─ name: "OpenAI"      │   │
                    │         │ │  ├─ strengths: [...]    │   │
                    │         │ │  └─ call(prompt)        │   │
                    │         │ └──────────────────────────┘   │
                    │         │                                │
                    │         │ ┌──────────────────────────┐   │
                    │         │ │ ClaudeProvider           │   │
                    │         │ │  ├─ id: "claude"        │   │
                    │         │ │  ├─ name: "Claude..."   │   │
                    │         │ │  ├─ strengths: [...]    │   │
                    │         │ │  └─ call(prompt)        │   │
                    │         │ └──────────────────────────┘   │
                    │         │                                │
                    │         │ ┌──────────────────────────┐   │
                    │         │ │ LocalEchoProvider        │   │
                    │         │ │  ├─ id: "local_echo"    │   │
                    │         │ │  ├─ name: "Local Echo"  │   │
                    │         │ │  ├─ strengths: [...]    │   │
                    │         │ │  └─ call(prompt)        │   │
                    │         │ └──────────────────────────┘   │
                    │         └────────────────────────────────┘
                    │
                    ↓
            Score each provider:
            - Category match (0.6)
            - Keyword overlap (0.2)
            - Quality score (0.2)

            Select best = max(scores)

                    │
                    ↓
         ┌──────────────────────┐
         │ Call provider.call() │
         └──────────────────────┘
                    │
                    ↓
          Returns: {
            success: bool,
            response: str,
            provider: str,
            error?: str
          }
                    │
                    ↓
         Create ChatMessage with:
         - user_prompt
         - ai_response
         - ai_type (provider.id)
         - ai_provider (provider.name)
         - timestamp
                    │
                    ↓
         Return JSON to Frontend
                    │
                    ↓
         Display message with
         provider badge
```

## Data Structures

### ChatMessage

```python
{
    'user_prompt': str,           # User's input
    'ai_response': str,           # AI's response
    'ai_type': str,               # Provider ID (e.g., 'gemini')
    'classification': str,        # Category (e.g., 'math_prompt')
    'ai_provider': str,           # Provider name (e.g., 'Gemini (Google)')
    'timestamp': str              # ISO format timestamp
}
```

### Classifier Output

```python
(
    'general_prompt',             # Category
    0.86,                         # Confidence (0-1)
    []                            # Keyword matches
)
```

### Provider Response

```python
{
    'success': True,
    'response': 'The answer is...',
    'provider': 'gemini',
    'provider_name': 'Gemini (Google)',
    'raw': {...},                 # Original API response
    'error': '...'                # Only if success=False
}
```

## Request/Response Flow Example

### Request

```bash
POST /api/chat
{
    "prompt": "What is 15 * 12?"
}
```

### Processing

```
1. classifier.classify_prompt("What is 15 * 12?")
   → ('math_prompt', 0.99, ['math', 'arithmetic'])

2. api_handler.call_ai_api("What is 15 * 12?", 'math_prompt', [...])
   → For each provider in PROVIDERS:
     - GeminiProvider: score = 0.6 (has 'general_prompt')
                              + 0.05 (1/2 keywords match)
                              + 0.18 (quality 0.9)
                              = 0.83
     - OpenAIProvider: score = 0.0 (no 'math_prompt' in strengths)
                              + 0.1 (2/2 keywords match)
                              + 0.186 (quality 0.93)
                              = 0.286
     - ClaudeProvider: score = 0.0 (no 'math_prompt')
                              + 0.1 (2/2 keywords match)
                              + 0.184 (quality 0.92)
                              = 0.284
     - LocalEchoProvider: score = 0.6 (has 'math_prompt')
                                 + 0.1 (2/2 keywords match)
                                 + 0.1 (quality 0.5)
                                 = 0.8

   → Winner: GeminiProvider (0.83) [or LocalEchoProvider if Gemini key missing]

3. gemini_provider.call("What is 15 * 12?")
   → Makes HTTP request to Gemini API
   → Returns: {'success': True, 'response': '180', ...}

4. Create ChatMessage:
   {
     'user_prompt': 'What is 15 * 12?',
     'ai_response': '180',
     'ai_type': 'gemini',
     'ai_provider': 'Gemini (Google)',
     'classification': 'math_prompt',
     'timestamp': '2025-12-15 14:35:22'
   }
```

### Response

```json
{
  "success": true,
  "message": {
    "user_prompt": "What is 15 * 12?",
    "ai_response": "180",
    "ai_type": "gemini",
    "classification": "math_prompt",
    "ai_provider": "Gemini (Google)",
    "timestamp": "2025-12-15 14:35:22"
  },
  "classification": {
    "category": "math_prompt",
    "confidence": 0.99,
    "explanation": "Classified as Math AI because prompt contains math keywords: math, arithmetic."
  },
  "session_stats": {
    "messages": 1,
    "pending": 0,
    "undo": 1,
    "redo": 0
  }
}
```

## Scoring Algorithm

```
Final Score = (0.6 × category_match) + (0.2 × keyword_overlap) + (0.2 × quality)

Where:
  category_match ∈ {0, 1}        (1 if provider.strengths contains prompt_category)
  keyword_overlap ∈ [0, 1]       (count of matching keywords / total keywords)
  quality ∈ [0, 1]               (provider.quality attribute)
```

### Scoring Example

**Prompt:** "Translate hello to Spanish"
**Classification:** ('language_prompt', 0.98, ['translate', 'language', 'grammar'])

| Provider  | Category                | Keywords | Quality | Score                               | Winner? |
| --------- | ----------------------- | -------- | ------- | ----------------------------------- | ------- |
| Gemini    | 1 (has language_prompt) | 1/3=0.33 | 0.90    | 0.6×1 + 0.2×0.33 + 0.2×0.90 = 0.846 | ✓       |
| OpenAI    | 0                       | 2/3=0.67 | 0.93    | 0.6×0 + 0.2×0.67 + 0.2×0.93 = 0.320 |         |
| Claude    | 1 (has language_prompt) | 1/3=0.33 | 0.92    | 0.6×1 + 0.2×0.33 + 0.2×0.92 = 0.850 | ✓✓      |
| LocalEcho | 0                       | 0/3=0    | 0.5     | 0.6×0 + 0.2×0 + 0.2×0.5 = 0.100     |         |

**Winner:** Claude (0.850)

## File Dependencies

```
providers.py              (independent)
├── Provider base class
├── All provider implementations
└── PROVIDERS list

api_handler.py
├── imports: providers.PROVIDERS
├── imports: math
└── implements: api_handler.call_ai_api()

app.py
├── imports: api_handler
├── imports: classifier
├── imports: data_structures
└── implements: Flask routes

classifier.py            (independent)
└── implements: prompt analysis

data_structures.py       (independent)
├── ChatMessage (uses ai_provider field)
└── ChatSession
```

## Adding a New Provider Checklist

- [ ] Create class inheriting from `Provider`
- [ ] Set `id`, `name`, `strengths`, `quality` in `__init__`
- [ ] Implement `call(prompt)` method
- [ ] Return dict: `{success: bool, response/error: str, raw?: any}`
- [ ] Add to `PROVIDERS` list
- [ ] Set environment variable for API key
- [ ] Test with `/api/classify` first
- [ ] Test with `/api/chat`
- [ ] Verify message includes correct `ai_provider`

---

**Architecture designed for extensibility and simplicity.**
