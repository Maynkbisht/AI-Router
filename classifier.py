import re

class classifier:
    @staticmethod
    def classify_prompt(prompt):
        prompt = prompt.lower().strip()

        # ----- Language AI detection -----
        language_keywords = [
            "synonym", "antonym", "opposite", "translate", "pronounce", "definition", "define", "meaning", "sentence",
            "use in a sentence", "grammar", "past tense", "present tense", "future tense", "conjugate", "adjective", "noun",
            "verb", "preposition", "article", "plural of", "singular of", "idiom", "phrasal verb", "how do you say", "in english",
            "in hindi", "in french", "in spanish", "spelling", "capitalization", "is this sentence correct", "correct my sentence",
            "fix this sentence", "is this correct", "correct the sentence", "is this grammatical", "what's the grammar rule", "grammar rules",
            "give me grammar rules", "english grammar rule", "punctuation", "orthography", "usage", "definition of"
        ]
        language_rule_patterns = [
            r'english grammar rules?', r'grammar rules?', r'give me grammar rules', r'list grammar rules', r'what is the grammar rule',
            r'define grammar', r'punctionuation', r'spelling rules?', r'tell me.*grammar', r'.*types of.*tense', r'when to use.*', r'how to use.*',
            r'language learning', r'learn english', r'learn grammar'
        ]
        language_regex = re.compile(r"""
            (\b(?:{})\b)
            | (how do you say .+ in .+)
            | (what does .+ mean)
            | (correct the sentence|fix the sentence|is this sentence correct|is this correct|grammar|spell|misspelled|spelling|capitalization|is this grammatical|correct my sentence|correct my grammar|give me grammar rules|grammar rules?|english grammar)
            | (how to pronounce)
            | (translate .+ to .+)
            | (definition of .+)
        """.format("|".join([re.escape(k) for k in language_keywords])), re.IGNORECASE | re.VERBOSE)

        for pattern in language_rule_patterns:
            if re.search(pattern, prompt):
                return "language_prompt", 0.99, ["language", "grammar", "rules"]

        if language_regex.search(prompt):
            return "language_prompt", 0.98, ["language", "grammar", "translation", "spelling"]

        # ----- Math detection -----
        math_keywords = [
            "integral", "derivative", "solve", "equation", "roots of", "expand", "differentiate", "simplify", "quadratic",
            "calculate", "value of", "area of", "find the", "evaluate", "factor", "sum of", "product of", "matrix", "mean",
            "median", "variance", "probability", "permutation", "combination", "limit", "logarithm", "tan(", "sin(", "cos(",
            "math", "arithmetic", "geometry", "algebra", "calculus"
        ]
        math_regex = re.compile(r"""
            (\d+\s*[\+\-\*/]\s*\d+)
            | (\b(?:{})\b)
            | (\b[xytz](?:\^\d+)?\b)
            | (\bpi\b|\btheta\b|\balpha\b|\bbeta\b)
            | (\bintegral\b|\bdifferentiate\b|\bfind\b.*\bderivative\b)
            | (\bsolve\b.*\bfor\b)
            | (\bformula\b)
            | (\bfactorize\b)
        """.format("|".join([re.escape(k) for k in math_keywords])), re.IGNORECASE | re.VERBOSE)
        if math_regex.search(prompt):
            return "math_prompt", 0.99, ["math", "arithmetic", "calculus", "formula"]

        # ----- Weather/News detection -----
        if "weather" in prompt:
            return "weather_prompt", 0.96, ["weather"]
        if "news" in prompt:
            return "news_prompt", 0.96, ["news"]

        # ----- Greeting detection (fix: only real greetings) -----
        greeting_keywords = ["hello", "hi", "hey", "greetings", "good morning", "good evening"]
        greeting_pattern = r'^(?:' + '|'.join(re.escape(word) for word in greeting_keywords) + r')(\W|$)'
        if re.search(greeting_pattern, prompt):
            return "greeting_prompt", 0.95, greeting_keywords

        # ----- General AI fallback -----
        return "general_prompt", 0.86, []

    @staticmethod
    def get_classification_explanation(prompt):
        prompt_lower = prompt.lower()
        language_keywords = [
            "translate", "grammar", "correct", "sentence", "spelling", "synonym", "antonym", "tense",
            "pronounce", "definition", "idiom", "phrasal verb", "capitalization","grammar rule", "rules"
        ]
        found_language = [word for word in language_keywords if word in prompt_lower]
        if found_language:
            return f"Classified as Language AI because prompt contains language/grammar keywords: {', '.join(found_language)}."

        if re.search(
            r'is this sentence correct|correct the sentence|fix the sentence|is this correct|is this grammatical|correct my grammar|correct my sentence|grammar rules?|english grammar|give me grammar rules|what is the grammar rule',
            prompt_lower):
            return "Classified as Language AI because prompt asks for language rules or grammar checking."

        if re.search(r'translate|how do you say|in english|in hindi|in french|in spanish', prompt_lower):
            return "Classified as Language AI because prompt requests translation."

        if re.search(r'spell|misspelled|spelling|capitalization', prompt_lower):
            return "Classified as Language AI because prompt asks about spelling or capitalization."

        math_keywords = [
            "integral", "derivative", "solve", "equation", "expand", "calculate",
            "quadratic", "factor", "sum", "probability", "formula", "arithmetic"
        ]
        found_math = [word for word in math_keywords if word in prompt_lower]
        if found_math or re.search(r'\d+\s*[\+\-\*/]\s*\d+', prompt_lower) or re.search(r'\b[xytz](?:\^\d+)?\b', prompt_lower):
            reasons = []
            if found_math:
                reasons.append(f"contains math keywords: {', '.join(found_math)}")
            if re.search(r'\d+\s*[\+\-\*/]\s*\d+', prompt_lower):
                reasons.append("contains arithmetic operations")
            if re.search(r'\b[xytz](?:\^\d+)?\b', prompt_lower):
                reasons.append("contains math variable(s)")
            return f"Classified as Math AI because prompt {' and '.join(reasons)}."

        greeting_keywords = ["hello", "hi", "hey", "greetings", "good morning", "good evening"]
        greeting_pattern = r'^(?:' + '|'.join(re.escape(word) for word in greeting_keywords) + r')(\W|$)'
        if re.search(greeting_pattern, prompt_lower):
            return "Classified as Greeting because prompt contains greeting words."

        if "weather" in prompt_lower:
            return "Classified as Weather AI because prompt mentions weather."
        if "news" in prompt_lower:
            return "Classified as News AI because prompt mentions news."
        return "Classified as General AI because prompt doesn't match specific math, language, weather, news, or greeting patterns."
