from datetime import datetime


class ChatMessage:
    def __init__(
        self,
        user_prompt,
        ai_response,
        ai_type,
        classification,
        timestamp: datetime,
        ai_provider: str = None,
    ):
        self.user_prompt = user_prompt
        self.ai_response = ai_response
        self.ai_type = ai_type
        self.classification = classification
        self.timestamp = timestamp
        # ai_provider holds the provider id or name (e.g., 'gemini')
        self.ai_provider = ai_provider

    def to_dict(self):
        return {
            "user_prompt": self.user_prompt,
            "ai_response": self.ai_response,
            "ai_type": self.ai_type,
            "classification": self.classification,
            "ai_provider": self.ai_provider,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        }


class ChatSession:
    def __init__(self, session_id):
        self.session_id = session_id
        self.messages = []  # List of ChatMessage instances
        self.redo_stack = []  # List for redo
        self.pending_queue = []  # List for pending prompts

    def add_message(self, message):
        self.messages.append(message)
        self.redo_stack.clear()  # Clear redo stack after new message

    def undo(self):
        """Undo last message, move to redo stack"""
        if self.messages:
            msg = self.messages.pop()
            self.redo_stack.append(msg)
            return msg
        return None

    def redo(self):
        """Redo last undone message"""
        if self.redo_stack:
            msg = self.redo_stack.pop()
            self.messages.append(msg)
            return msg
        return None

    def clear(self):
        self.messages.clear()
        self.redo_stack.clear()
        self.pending_queue.clear()

    def add_pending(self, prompt):
        self.pending_queue.append(prompt)

    def process_pending(self):
        if self.pending_queue:
            return self.pending_queue.pop(0)
        return None

    def get_session_stats(self):
        return {
            "messages": len(self.messages),
            "pending": len(self.pending_queue),
            "undo": len(self.messages),
            "redo": len(self.redo_stack),
        }
