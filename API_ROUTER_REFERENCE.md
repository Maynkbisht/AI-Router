# API Router Quick Reference Card

## System Overview

Your app is an **AI API Router** that:

1. Takes user prompts
2. Classifies them by type (math, language, general, etc.)
3. Routes to the best AI provider for that prompt type
4. Returns response with provider metadata

```
User Prompt
    ↓
Classifier (analyze type)
    ↓
Score all providers
    ↓
Select best match
    ↓
Call provider API
    ↓
Return response + provider info
```

---

## Provider Scoring Formula

```
Score = (0.6 × category_match) + (0.2 × keyword_overlap) + (0.2 × quality)
```

**Category Match (0.6):**

- 1 point if provider specializes in this category
- 0 points if not
- Example: "Math problem" + LocalEchoProvider (math specialist) = 0.6

**Keyword Overlap (0.2):**

- Points based on how many keywords match provider strengths
- Example: 2 matching keywords out of 3 = 0.2 × (2/3) = 0.133

**Quality Score (0.2):**

- Provider's baseline quality rating (0.0-1.0)
- Example: OpenAI quality=0.93 → 0.2 × 0.93 = 0.186

---

## Prompt Categories

| Category          | Triggers                          | Example                | Best Provider |
| ----------------- | --------------------------------- | ---------------------- | ------------- |
| `math_prompt`     | Numbers, operations, formulas     | "What is 15 \* 12?"    | LocalEcho     |
| `language_prompt` | Grammar, translation, definitions | "Translate to Spanish" | Gemini        |
| `general_prompt`  | Knowledge, trivia, creative       | "Tell me a joke"       | OpenAI        |
| `weather_prompt`  | Weather mentions                  | "What's the weather?"  | Gemini        |
| `news_prompt`     | News mentions                     | "Tell me about AI"     | OpenAI        |
| `greeting_prompt` | Hi, hello, hey, greetings         | "Hello!"               | Gemini        |

---

## Available Providers

### Gemini (Google)

- **ID:** `gemini`
- **Quality:** 0.90
- **Best at:** Language, General Knowledge
- **Requires:** `GEMINI_API_KEY`

### OpenAI

- **ID:** `openai`
- **Quality:** 0.93
- **Best at:** Everything (all-purpose)
- **Requires:** `OPENAI_API_KEY`

### Claude (Anthropic)

- **ID:** `claude`
- **Quality:** 0.92
- **Best at:** Reasoning, Language
- **Requires:** `CLAUDE_API_KEY`

### LocalEcho (Local)

- **ID:** `local_echo`
- **Quality:** 0.50
- **Best at:** Math (instant, local)
- **Requires:** None! ✅

---

## API Endpoints

### Chat

```bash
POST /api/chat
Content-Type: application/json

{
  "prompt": "Your question here"
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    "user_prompt": "Your question",
    "ai_response": "The answer",
    "ai_type": "gemini",
    "ai_provider": "Gemini (Google)",
    "classification": "general_prompt",
    "timestamp": "2025-12-15 14:35:22"
  },
  "classification": {
    "category": "general_prompt",
    "confidence": 0.86,
    "explanation": "..."
  },
  "session_stats": {
    "messages": 1,
    "pending": 0,
    "undo": 1,
    "redo": 0
  }
}
```

### Classify Only (no API call)

```bash
POST /api/classify
Content-Type: application/json

{
  "prompt": "Your question"
}
```

Returns: `category`, `confidence`, `keyword_matches`

### Streaming Response

```bash
POST /api/chat/stream
Content-Type: application/json

{
  "prompt": "Your question"
}
```

Streams response word-by-word

### Queue Management

```bash
# Add to queue
POST /api/pending
{"prompt": "Question 1"}

# View queue
GET /api/pending

# Process next queued prompt
POST /api/pending/process
```

### Session Management

```bash
# Clear history
POST /api/clear

# Undo last message
POST /api/undo

# Redo last undone
POST /api/redo

# Get all messages
GET /api/history
```

---

## Testing with curl

### Test Classification

```bash
curl -X POST http://localhost:5010/api/classify \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2+2?"}'
```

### Test Chat (with routing)

```bash
curl -X POST http://localhost:5010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Translate hello to French"}'
```

### Test without API Keys

```bash
curl -X POST http://localhost:5010/api/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 100 / 5?"}'
# Uses LocalEchoProvider (no key needed)
```

---

## Routing Examples

### Example 1: Math Problem

```
Input: "Solve: 2x + 5 = 13"

Classification:
  Category: math_prompt
  Confidence: 0.99
  Keywords: ['math', 'solve', 'equation']

Provider Scores:
  LocalEcho:  0.6×1 + 0.2×1.0 + 0.2×0.5 = 1.0   ✓ WINNER
  Gemini:     0.6×0 + 0.2×0.33 + 0.2×0.9 = 0.247
  OpenAI:     0.6×1 + 0.2×1.0 + 0.2×0.93 = 1.186

Selected: LocalEchoProvider (instant, local calculation)
Response: "The answer to 2x + 5 = 13 is x = 4"
```

### Example 2: Language Question

```
Input: "Correct my grammar: I going to store"

Classification:
  Category: language_prompt
  Confidence: 0.98
  Keywords: ['grammar', 'correct', 'language']

Provider Scores:
  Gemini:     0.6×1 + 0.2×1.0 + 0.2×0.9 = 1.0   ✓ WINNER
  OpenAI:     0.6×1 + 0.2×1.0 + 0.2×0.93 = 1.186
  Claude:     0.6×1 + 0.2×1.0 + 0.2×0.92 = 1.184

Selected: GeminiProvider (language specialist)
Response: "You should say: 'I am going to the store'"
```

### Example 3: General Knowledge

```
Input: "Tell me a joke"

Classification:
  Category: general_prompt
  Confidence: 0.86
  Keywords: []

Provider Scores:
  OpenAI:     0.6×1 + 0.2×0 + 0.2×0.93 = 0.786   ✓ WINNER
  Gemini:     0.6×1 + 0.2×0 + 0.2×0.9 = 0.78
  Claude:     0.6×1 + 0.2×0 + 0.2×0.92 = 0.784

Selected: OpenAIProvider (versatile, highest quality)
Response: "Why did the AI cross the road? To get to the other side!"
```

---

## Customizing Provider Selection

### Adjust Quality Scores

In `providers.py`, increase quality to favor a provider:

```python
super().__init__(
    id='gemini',
    name='Gemini (Google)',
    strengths=['language_prompt', 'general_prompt'],
    quality=0.95  # ← Increase from 0.90 to 0.95
)
```

Higher quality = higher chance of selection

### Add/Remove Strengths

In `providers.py`, change what each provider excels at:

```python
strengths=['general_prompt', 'math_prompt', 'language_prompt']
# Add or remove categories as needed
```

### Disable a Provider

In `providers.py`, comment out in PROVIDERS list:

```python
PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    # ClaudeProvider(),  # Disabled
    LocalEchoProvider(),
]
```

---

## Adding a New Provider

### Step 1: Create Class

```python
# In providers.py

class MyNewProvider(Provider):
    def __init__(self):
        super().__init__(
            id='mynew',
            name='My New AI',
            strengths=['general_prompt', 'language_prompt'],
            quality=0.85
        )
        self.api_key = os.environ.get('MYNEW_API_KEY')

    def call(self, prompt: str) -> Dict[str, Any]:
        # Your API call logic here
        if not self.api_key:
            return {'success': False, 'error': 'API key not set'}

        try:
            # Call your API
            response = requests.post(
                'https://api.mynew.com/chat',
                json={'prompt': prompt},
                headers={'Authorization': f'Bearer {self.api_key}'}
            )
            return {
                'success': True,
                'response': response.json()['text'],
                'raw': response.json()
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}
```

### Step 2: Register

```python
PROVIDERS: List[Provider] = [
    GeminiProvider(),
    OpenAIProvider(),
    ClaudeProvider(),
    MyNewProvider(),     # ← Add here
    LocalEchoProvider(),
]
```

### Step 3: Set API Key

```bash
export MYNEW_API_KEY="your-api-key"
```

### Step 4: Restart App

```bash
python app.py
```

Done! Your provider is now integrated!

---

## File Structure

```
providers.py
├── Provider (base class)
├── GeminiProvider
├── OpenAIProvider
├── ClaudeProvider
├── LocalEchoProvider
└── PROVIDERS (registry)

api_handler.py
├── _score_provider() - scoring logic
└── call_ai_api() - select & call best provider

app.py
├── /api/chat - main endpoint
├── /api/classify - classification only
├── /api/chat/stream - streaming
├── Queue endpoints
└── Session endpoints

classifier.py
└── classify_prompt() - analyzes prompt type

data_structures.py
├── ChatMessage - stores prompt, response, provider
└── ChatSession - manages messages
```

---

## Troubleshooting

| Problem                  | Solution                                                      |
| ------------------------ | ------------------------------------------------------------- |
| "No providers available" | LocalEchoProvider needs no key; check others                  |
| Wrong provider selected  | Check provider.strengths in providers.py                      |
| Provider returning error | Verify API key format and network connectivity                |
| Can't classify prompt    | Check if prompt matches any keyword patterns in classifier.py |

---

## Environment Variables

```bash
# Required for each provider
export GEMINI_API_KEY="AIzaSyBdtMqeOdZzWdA9WakcUZ9aJFcWgz3_9Q4"
export OPENAI_API_KEY="ssk-proj-3Ho3k0xMu0PjV172kE9sgLkQsiLGc0jipm7MASuRNAZSIJmYvfca9G8oT3NQX1zXPbdKWd4dx8T3BlbkFJkaDbq_2-Yi7_zS7Tivh4AI-26wb8mdp0E8ckzfxVp74w65f77r7I6Dnl5HCNHr7mSHHx53cqAA"
export CLAUDE_API_KEY="FCKGW-RHQQ2 - YXRKT - 8T46W-28798"

# Optional
export SECRET_KEY="your-secret"
```

---

## Key Files Modified

- **providers.py** (NEW) - Provider registry
- **api_handler.py** - Now uses provider scoring
- **app.py** - Passes provider metadata
- **data_structures.py** - Tracks ai_provider
- **static/js/app.js** - Displays provider in UI

---

## Documentation Files

Read these for more details:

1. **GETTING_STARTED.txt** - Quick visual guide
2. **README.md** - Complete documentation
3. **QUICK_START.md** - How to add providers
4. **ARCHITECTURE.md** - Technical diagrams
5. **IMPLEMENTATION_SUMMARY.md** - What changed

---

**Your AI Router is ready to use!** 🚀
