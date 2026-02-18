/**
 * @file ChatService.js
 * @description Handles all communication with the Ollama `/api/chat` endpoint.
 *   Assembles the full message array (system prompt, world info, persona blocks,
 *   conversation history, post-history instructions, and the current user turn)
 *   and returns the model's reply as a plain string.
 */

const MODULE_ID = "chronicle-weaver";

export class ChatService {

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Sends a user prompt to the active Ollama model and returns the reply.
   *
   * @param {string} userPrompt - The current player/GM message (plain text, HTML stripped).
   * @param {Object} context - Runtime context assembled by the `createChatMessage` hook.
   * @param {import('../models/Spirit.js').Spirit|null} context.spirit - The active AI persona.
   * @param {import('../models/Soul.js').Soul[]} context.souls - Active PC personas in scene.
   * @param {import('../models/Grimoire.js').Grimoire[]} context.grimoires - All loaded grimoires.
   * @param {Array<{role:string,content:string}>} context.history - Recent chat history entries.
   * @returns {Promise<string|null>} The model's reply, or `null` on error / no spirit.
   */
  async generateResponse(userPrompt, context) {
    const { spirit, souls = [], grimoires = [], history = [] } = context;

    const ollamaUrl = game.settings.get(MODULE_ID, "ollamaUrl");
    const model = game.settings.get(MODULE_ID, "ollamaModel");

    if (!spirit) {
      console.error("Chronicle Weaver | No Active Spirit found!");
      ui.notifications.warn(
        "Chronicle Weaver: No Active Spirit selected. Please select one in Module Settings."
      );
      return null;
    }

    const messages = this._buildMessages(userPrompt, { spirit, souls, grimoires, history });

    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature: 0.7 },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const reply = data.message?.content ?? data.response ?? null;

      if (!reply) {
        console.warn("Chronicle Weaver | Empty response from model:", data);
        return "AI returned an empty response.";
      }

      // Safety Net: Ensure reply doesn't contain leaked placeholders
      const userName = souls.length > 0 ? souls[0].name : "Traveler";
      let cleanReply = this._replacePlaceholders(reply, spirit.name, userName);

      // CRITICAL FIX: Convert newlines to HTML <br> tags.
      // 1. Escape HTML special characters to prevent XSS.
      // 2. Replace newlines with <br/>.
      return this._formatAsHtml(cleanReply);

    } catch (error) {
      console.error("Chronicle Weaver | Generation error:", error);
      ui.notifications.error(`Chronicle Weaver: ${error.message}`);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private — message assembly
  // ---------------------------------------------------------------------------

  /**
   * Assembles the ordered Ollama message array for a single inference call.
   *
   * Message order (matches SillyTavern's injection strategy):
   *  1. System prompt (Spirit persona + world info + PC personas)
   *  2. Spirit's first_message (only on a fresh conversation)
   *  3. Conversation history
   *  4. post_history_instructions (re-asserts character after long sessions)
   *  5. Current user message
   *
   * @param {string} userMessage - Current turn content (HTML stripped).
   * @param {Object} context - Same shape as `generateResponse` context.
   * @returns {Array<{role:string,content:string}>} Ordered message array.
   * @private
   */
  _buildMessages(userMessage, context) {
    const { spirit, souls, grimoires, history } = context;
    const messages = [];

    // Determine the name to use for {{user}}
    const userName = souls.length > 0 ? souls[0].name : "Traveler";

    // -- 1. System prompt --------------------------------------------------
    let systemContent = this._replacePlaceholders(
      spirit.getSystemPrompt(),
      spirit.name,
      userName
    );

    // Inject Formatting Instructions (Critial for "No Formatting" issue)
    systemContent += "\n\n[System Note: Write all actions and narration in *italics*. Write all spoken dialogue in \"quotes\". Do not use {{char}} or {{user}} placeholders.]";

    // Scan grimoires against the combined history + current message text.
    const scanText = [...history.map(h => h.content), userMessage].join(" ").trim();
    const triggered = grimoires.flatMap(g => g.scan(scanText));

    if (triggered.length > 0) {
      systemContent += "\n\n## World Information\n";
      // De-duplicate across grimoires by uid, preserving scan order.
      const seen = new Set();
      for (const entry of triggered) {
        const key = entry.uid ?? `__nouid_${triggered.indexOf(entry)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = entry.keys?.[0] ?? "Info";
        systemContent += `- ${label}: ${entry.content}\n`;
      }
    }

    if (souls.length > 0) {
      systemContent += "\n\n## Player Characters in Scene\n";
      souls.forEach(s => (systemContent += s.getPersonaBlock() + "\n"));
    }

    messages.push({ role: "system", content: systemContent });

    // -- 2. Spirit first message (empty history only) -----------------------
    if (spirit.first_message && history.length === 0) {
      messages.push({
        role: "assistant",
        content: this._replacePlaceholders(spirit.first_message, spirit.name, userName)
      });
    }

    // -- 3. Conversation history -------------------------------------------
    // Clean history content too, to stop the AI from mimicking old broken messages with {{char}}
    history.forEach(msg => messages.push({
      role: msg.role,
      content: this._replacePlaceholders(msg.content, spirit.name, userName)
    }));

    // -- 4. Post-history instructions (SillyTavern feature) ----------------
    //    Injected AFTER history so it takes precedence over drift that
    //    accumulates over a long session.
    if (spirit.post_history_instructions) {
      messages.push({
        role: "system",
        content: this._replacePlaceholders(spirit.post_history_instructions, spirit.name, userName)
      });
    }

    // -- 5. Current user turn ---------------------------------------------
    // Also clean user input for placeholders like "What does {{char}} think?"
    messages.push({
      role: "user",
      content: this._replacePlaceholders(userMessage, spirit.name, userName)
    });

    return messages;
  }

  /**
   * Replaces SillyTavern placeholders {{char}} and {{user}} with actual names.
   *
   * @param {string} text - The raw text containing placeholders.
   * @param {string} charName - The name of the AI character (Spirit).
   * @param {string} userName - The name of the User/Player.
   * @returns {string} The text with placeholders replaced.
   * @private
   */
  _replacePlaceholders(text, charName, userName) {
    if (!text) return "";
    return text
      .replace(/{{char}}/gi, charName)
      .replace(/{{user}}/gi, userName);
  }

  /**
   * Escapes HTML characters and converts newlines to <br/> tags.
   *
   * @param {string} text - Raw text from AI.
   * @returns {string} Safe HTML string.
   * @private
   */
  _formatAsHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");
  }
}
