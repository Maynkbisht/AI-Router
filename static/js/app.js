class AIChatbotRouter {
  constructor() {
    this.sessionId = null;
    this.isLoading = false;
    this.sessionStartTime = Date.now();
    this.messageCount = 0;
    this.aiTypeCounts = {
      general: 0,
      language: 0,
      math: 0,
    };
    this.promptQueue = [];
    this.undoCount = 0;
    this.redoCount = 0;

    this.initializeElements();
    this.attachEventListeners();
    this.startSessionTimer();
    this.loadSessionStats();
    this.updateSessionStatsDisplay();
  }

  unescapeMath(text) {
    return text.replace(/\\\$/g, "$");
  }

  initializeElements() {
    this.chatMessages = document.getElementById("chat-messages");
    this.messageInput = document.getElementById("message-input");
    this.sendBtn = document.getElementById("send-btn");
    this.clearBtn = document.getElementById("clear-btn");
    this.undoBtn = document.getElementById("undo-btn");
    this.redoBtn = document.getElementById("redo-btn");
    this.addToQueueBtn = document.getElementById("add-to-queue-btn");
    this.processQueueBtn = document.getElementById("process-queue-btn");
    this.loadingOverlay = document.getElementById("loading-overlay");
    this.classificationDisplay = document.getElementById(
      "classification-display"
    );
    this.classificationText = document.getElementById("classification-text");
    this.toastContainer = document.getElementById("toast-container");
    this.messageCountEl = document.getElementById("message-count");
    this.sessionTimeEl = document.getElementById("session-time");
    this.totalMessagesEl = document.getElementById("total-messages");
    this.pendingPromptsEl = document.getElementById("pending-prompts");
    this.undoAvailableEl = document.getElementById("undo-available");
    this.redoAvailableEl = document.getElementById("redo-available");
    this.generalCountEl = document.getElementById("general-count");
    this.languageCountEl = document.getElementById("language-count");
    this.mathCountEl = document.getElementById("math-count");
    this.pendingListEl = document.getElementById("pending-list");
  }

  updateSessionStatsDisplay() {
    this.messageCountEl.textContent = this.messageCount;
    this.pendingPromptsEl.textContent = this.promptQueue.length;
    this.undoAvailableEl.textContent = this.undoCount;
    this.redoAvailableEl.textContent = this.redoCount;
  }

  attachEventListeners() {
    this.sendBtn.addEventListener("click", () => this.sendMessage());
    this.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.messageInput.addEventListener("input", () =>
      this.autoResizeTextarea()
    );
    this.clearBtn.addEventListener("click", () => this.clearHistory());
    this.undoBtn.addEventListener("click", () => this.undoMessage());
    this.redoBtn.addEventListener("click", () => this.redoMessage());
    this.addToQueueBtn.addEventListener("click", () => this.addToQueue());
    this.processQueueBtn.addEventListener("click", () => this.processQueue());
    this.loadChatHistory();
  }

  autoResizeTextarea() {
    this.messageInput.style.height = "auto";
    this.messageInput.style.height =
      Math.min(this.messageInput.scrollHeight, 120) + "px";
  }

  // --- QUEUE SUPPORT ---
  addToQueue() {
    const prompt = this.messageInput.value.trim();
    if (!prompt) return;
    this.promptQueue.push(prompt);
    this.updatePendingList();
    this.messageInput.value = "";
    this.autoResizeTextarea();
    this.showToast("info", "Queued", "Prompt added to queue.");
    this.updateSessionStatsDisplay();
  }

  updatePendingList() {
    this.pendingListEl.innerHTML = "";
    if (this.promptQueue.length === 0) {
      this.pendingListEl.innerHTML = `<span class="empty-state">No Pending Prompts.</span>`;
    } else {
      this.promptQueue.forEach((prompt, idx) => {
        const div = document.createElement("div");
        div.className = "pending-item";
        div.textContent = `${idx + 1}. ${prompt}`;
        this.pendingListEl.appendChild(div);
      });
    }
    this.pendingPromptsEl.textContent = this.promptQueue.length;
    this.updateSessionStatsDisplay();
  }

  async processQueue() {
    if (this.promptQueue.length === 0) {
      this.showToast(
        "warning",
        "No prompts",
        "There are no prompts in the queue!"
      );
      return;
    }
    this.setLoading(true);
    try {
      for (let i = 0; i < this.promptQueue.length; i++) {
        const prompt = this.promptQueue[i];
        this.addMessageToChat(
          {
            user_prompt: prompt,
            ai_response: "",
            ai_type: "",
            classification: "",
            timestamp: new Date().toISOString(),
          },
          "user"
        );
        const classification = await this.classifyPrompt(prompt);
        this.showClassification(classification);
        if (classification && classification.category) {
          const typeMap = {
            general_prompt: "general",
            language_prompt: "language",
            math_prompt: "math",
          };
          const aiType = typeMap[classification.category];
          if (aiType && this.aiTypeCounts.hasOwnProperty(aiType)) {
            this.aiTypeCounts[aiType]++;
            this.updateAIStatsDisplay();
          }
        }
        const response = await this.callChatAPIStream(prompt);
        if (response.success) {
          this.messageCount++;
          this.updateAIStatsDisplay();
          this.updateSessionStatsDisplay();
        }
      }
      this.promptQueue = [];
      this.updatePendingList();
      this.hideClassification();
      this.showToast(
        "success",
        "Queue Processed",
        "All queued prompts processed."
      );
      this.updateSessionStatsDisplay();
    } catch (error) {
      this.showToast("error", "Process Error", "Could not process the queue.");
    } finally {
      this.setLoading(false);
    }
  }
  // --- END QUEUE SUPPORT ---

  async callChatAPIStream(prompt) {
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.body) throw new Error("No response body for streaming!");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";

      let aiMessageObj = {
        user_prompt: prompt,
        ai_response: "",
        ai_type: "",
        classification: "",
        timestamp: new Date().toISOString(),
      };
      this.addMessageToChat(aiMessageObj, "ai");
      const lastMessageEl = this.chatMessages.lastElementChild;

      let foundError = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        aiText += decoder.decode(value);

        if (aiText.trim().startsWith("[ERROR]")) {
          this.showToast("error", "Model Error", aiText.trim());
          foundError = true;
          lastMessageEl.querySelector(
            ".message-text"
          ).innerHTML = `<span class="error-text">${this.escapeHTML(
            aiText.trim()
          )}</span>`;
          break;
        }

        lastMessageEl.querySelector(".message-text").innerHTML = marked.parse(
          this.unescapeMath(aiText)
        );
        if (window.MathJax) MathJax.typesetPromise([lastMessageEl]);
      }
      if (foundError) return { success: false, error: aiText.trim() };
      return {
        success: true,
        message: { ...aiMessageObj, ai_response: aiText },
      };
    } catch (error) {
      console.error("Streaming Chat API error:", error);
      this.showToast(
        "error",
        "Error",
        error?.message || "Failed to stream AI response"
      );
      return {
        success: false,
        error: error?.message || "Failed to stream AI response",
      };
    }
  }

  async sendMessage() {
    const prompt = this.messageInput.value.trim();
    if (!prompt || this.isLoading) return;
    this.setLoading(true);
    this.messageInput.value = "";
    this.autoResizeTextarea();

    try {
      this.addMessageToChat(
        {
          user_prompt: prompt,
          ai_response: "",
          ai_type: "",
          classification: "",
          timestamp: new Date().toISOString(),
        },
        "user"
      );
      const classification = await this.classifyPrompt(prompt);
      this.showClassification(classification);

      if (classification && classification.category) {
        const typeMap = {
          general_prompt: "general",
          language_prompt: "language",
          math_prompt: "math",
        };
        const aiType = typeMap[classification.category];
        if (aiType && this.aiTypeCounts.hasOwnProperty(aiType)) {
          this.aiTypeCounts[aiType]++;
          this.updateAIStatsDisplay();
        }
      }

      const response = await this.callChatAPIStream(prompt);

      if (response.success) {
        this.messageCount++;
        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
      } else if (response.error) {
        this.showToast(
          "error",
          "Error",
          response.error || "Failed to get AI response"
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      this.showToast(
        "error",
        "Error",
        "Failed to send message. Please try again."
      );
    } finally {
      this.setLoading(false);
      this.hideClassification();
    }
  }

  async classifyPrompt(prompt) {
    try {
      const response = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await response.json();
      return data.success ? data : null;
    } catch (error) {
      console.error("Classification error:", error);
      return null;
    }
  }

  showClassification(classification) {
    if (!classification) return;
    const categoryMap = {
      general_prompt: "General AI",
      language_prompt: "Language AI",
      math_prompt: "Math AI",
    };
    this.classificationText.textContent = `Routing to ${
      categoryMap[classification.category] || classification.category
    } (${Math.round(classification.confidence * 100)}% confidence)`;
    this.classificationDisplay.style.display = "block";
  }

  hideClassification() {
    this.classificationDisplay.style.display = "none";
  }

  addMessageToChat(message, type) {
    const messageEl = this.createMessageElement(message, type);
    this.chatMessages.appendChild(messageEl);
    this.scrollToBottom();
    if (type === "ai" && window.MathJax) {
      MathJax.typesetPromise([messageEl]);
    }
  }

  createMessageElement(message, type) {
    const div = document.createElement("div");
    div.className = `message ${type} fade-in`;
    div.innerHTML = this.createMessageHTML(message, type);
    return div;
  }

  createMessageHTML(message, type) {
    const timestamp = new Date(message.timestamp).toLocaleTimeString();
    // Prefer human-friendly provider name when available, otherwise fall back to ai_type or classification
    const aiType =
      message.ai_provider || message.ai_type || message.classification;

    let metaHTML = "";
    if (type === "ai" && aiType) {
      const typeMap = {
        general_prompt: "General",
        language_prompt: "Language",
        math_prompt: "Math",
      };
      metaHTML = `
          <div class="message-meta">
             <span class="ai-type-badge ${aiType.replace("_prompt", "")}">
                <i class="fas fa-robot"></i>
                ${typeMap[aiType] || aiType}
             </span>
             <span>${timestamp}</span>
          </div>
        `;
    } else if (type === "user") {
      metaHTML = `
          <div class="message-meta">
             <span>You</span>
             <span>${timestamp}</span>
          </div>
        `;
    }

    let messageText;
    if (type === "ai") {
      messageText = marked.parse(this.unescapeMath(message.ai_response || ""));
    } else {
      messageText = this.escapeHTML(message.user_prompt || "");
    }

    return `
        <div class="message-content">
            <div class="message-text">${messageText}</div>
        </div>
        ${metaHTML}
     `;
  }

  escapeHTML(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  updateAIStats(aiType) {
    if (aiType) {
      const type = aiType.replace("_prompt", "");
      if (this.aiTypeCounts.hasOwnProperty(type)) {
        this.aiTypeCounts[type]++;
        this.updateAIStatsDisplay();
      }
    }
  }

  updateAIStatsDisplay() {
    this.generalCountEl.textContent = this.aiTypeCounts.general;
    this.languageCountEl.textContent = this.aiTypeCounts.language;
    this.mathCountEl.textContent = this.aiTypeCounts.math;
    this.messageCountEl.textContent = this.messageCount;
  }

  async loadChatHistory() {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (data.success && data.messages.length > 0) {
        const welcomeMessage =
          this.chatMessages.querySelector(".welcome-message");
        if (welcomeMessage) {
          welcomeMessage.remove();
        }
        data.messages.forEach((message) => {
          this.addMessageToChat(
            {
              user_prompt: message.user_prompt,
              ai_response: "",
              ai_type: "",
              classification: "",
              timestamp: message.timestamp,
            },
            "user"
          );
          this.addMessageToChat(message, "ai");
          this.updateAIStats(message.ai_type);
          this.messageCount += 2;
        });
        this.updateSessionStatsDisplay();
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }

  async undoMessage() {
    try {
      const response = await fetch("/api/undo", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        if (this.chatMessages.lastElementChild)
          this.chatMessages.removeChild(this.chatMessages.lastElementChild);
        if (this.chatMessages.lastElementChild)
          this.chatMessages.removeChild(this.chatMessages.lastElementChild);

        this.messageCount = Math.max(0, this.messageCount - 2);

        const aiType = data.undone_message.ai_type;
        if (aiType) {
          const type = aiType.replace("_prompt", "");
          if (this.aiTypeCounts.hasOwnProperty(type)) {
            this.aiTypeCounts[type] = Math.max(0, this.aiTypeCounts[type] - 1);
          }
        }
        this.updateAIStatsDisplay();
        this.undoCount++;
        this.updateSessionStatsDisplay();
        this.showToast(
          "info",
          "Undo",
          "Last AI answer and user question removed."
        );
      } else {
        this.showToast(
          "warning",
          "Nothing to Undo",
          data.error || "No messages to undo."
        );
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to undo message.");
    }
  }

  async redoMessage() {
    try {
      const response = await fetch("/api/redo", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        const msg = data.redone_message;
        this.addMessageToChat(
          {
            user_prompt: msg.user_prompt,
            ai_response: "",
            ai_type: "",
            classification: "",
            timestamp: msg.timestamp,
          },
          "user"
        );
        this.addMessageToChat(msg, "ai");

        this.messageCount += 2;
        const aiType = msg.ai_type;
        if (aiType) {
          const type = aiType.replace("_prompt", "");
          if (this.aiTypeCounts.hasOwnProperty(type)) {
            this.aiTypeCounts[type]++;
          }
        }
        this.updateAIStatsDisplay();
        this.redoCount++;
        this.updateSessionStatsDisplay();
        this.showToast(
          "info",
          "Redo",
          "Last AI answer and user question restored."
        );
      } else {
        this.showToast(
          "warning",
          "Nothing to Redo",
          data.error || "No messages to redo."
        );
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to redo message.");
    }
  }

  async clearHistory() {
    try {
      const response = await fetch("/api/clear", { method: "POST" });
      const data = await response.json();
      if (data.success) {
        this.aiTypeCounts = { general: 0, language: 0, math: 0 };
        this.messageCount = 0;
        this.undoCount = 0;
        this.redoCount = 0;
        this.updateAIStatsDisplay();
        this.updateSessionStatsDisplay();
        // Only remove user and ai messages, leave welcome info intact!
        const messages = this.chatMessages.querySelectorAll(
          ".message.user, .message.ai"
        );
        messages.forEach((msg) => msg.remove());
        this.showToast(
          "success",
          "History Cleared",
          "All chat messages and stats cleared."
        );
      } else {
        this.showToast("error", "Error", "Failed to clear history.");
      }
    } catch (error) {
      this.showToast("error", "Error", "Failed to clear history.");
    }
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.loadingOverlay.style.display = loading ? "flex" : "none";
    this.sendBtn.disabled = loading;
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  showToast(type, title, message) {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const iconMap = {
      success: "fas fa-check-circle",
      error: "fas fa-exclamation-circle",
      warning: "fas fa-exclamation-triangle",
      info: "fas fa-info-circle",
    };
    toast.innerHTML = `
        <i class="${iconMap[type]}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
      `;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  startSessionTimer() {
    setInterval(() => {
      const elapsed = Date.now() - this.sessionStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      this.sessionTimeEl.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }, 1000);
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new AIChatbotRouter();
});
