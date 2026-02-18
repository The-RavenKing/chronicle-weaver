/**
 * @file LearningService.js
 * @description Analyses unseen chat messages for lore, structures the findings
 *   into Grimoire-compatible JSON via a coder model, and queues them for GM
 *   review before they are committed to any Grimoire.
 *
 *   Key guarantees:
 *   - AI-generated messages (flag `isAI`) are excluded from analysis to prevent
 *     a lore-feedback loop where the model learns its own hallucinations.
 *   - The progress marker is only advanced on a successful save, so a failed
 *     Ollama call can be retried with `/cw learn` without losing messages.
 *   - Entries are de-duplicated against both the pending queue and all approved
 *     Grimoires before being added to the queue.
 */

const MODULE_ID = "chronicle-weaver";
/** Max messages processed on a first run to avoid overwhelming the model. */
const FIRST_RUN_CAP = 100;

export class LearningService {

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Main entry point. Identifies new messages since the last run, extracts
   * lore with a reader model, structures it with a coder model, and queues
   * valid entries for GM review.
   *
   * @returns {Promise<void>}
   */
  async learnFromChat() {
    console.log("Chronicle Weaver | Starting learning process…");

    const chatLog         = game.messages.contents;
    const lastProcessedId = game.settings.get(MODULE_ID, "lastProcessedMessageId");

    const newMessages = this._getNewMessages(chatLog, lastProcessedId);

    if (newMessages.length === 0) {
      ui.notifications.info("Chronicle Weaver: No new messages found since last run.");
      return;
    }

    ui.notifications.info(`Chronicle Weaver: Analysing ${newMessages.length} new messages…`);

    // Exclude AI responses — including them would cause the model to learn its
    // own hallucinations as canonical facts, creating a lore feedback loop.
    const humanText = newMessages
      .filter(m => !m.getFlag(MODULE_ID, "isAI"))
      .map(m => `${m.speaker.alias ?? "Unknown"}: ${this._stripHtml(m.content)}`)
      .join("\n");

    if (!humanText.trim()) {
      ui.notifications.info("Chronicle Weaver: No new player/GM messages to learn from.");
      return;
    }

    const ollamaUrl   = game.settings.get(MODULE_ID, "ollamaUrl");
    const readerModel = game.settings.get(MODULE_ID, "ollamaModel");
    const coderModel  = game.settings.get(MODULE_ID, "coderModel");

    const insights = await this._analyzeText(humanText, readerModel, ollamaUrl);

    if (!insights?.trim()) {
      ui.notifications.info("Chronicle Weaver: Analysis complete — no new lore identified.");
      return;
    }

    ui.notifications.info("Chronicle Weaver: Found insights. Structuring…");

    const saveSucceeded = await this._structureAndSave(insights, coderModel, ollamaUrl);

    // Only advance the marker on success so failures can be retried.
    if (saveSucceeded) {
      const lastMessage = newMessages.at(-1);
      if (lastMessage) {
        await game.settings.set(MODULE_ID, "lastProcessedMessageId", lastMessage.id);
        console.log(`Chronicle Weaver | Marker advanced to ${lastMessage.id}`);
      }
    } else {
      ui.notifications.warn(
        "Chronicle Weaver: Structuring failed — marker not advanced. Run /cw learn to retry."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Selects messages that have not yet been processed, respecting the cap on
   * first runs to avoid overwhelming the model.
   *
   * @param {ChatMessage[]} chatLog - Full ordered chat log.
   * @param {string} lastProcessedId - ID of the last processed message, or `""`.
   * @returns {ChatMessage[]} Array of unprocessed messages.
   * @private
   */
  _getNewMessages(chatLog, lastProcessedId) {
    if (!lastProcessedId) {
      if (chatLog.length > FIRST_RUN_CAP) {
        ui.notifications.warn(
          `Chronicle Weaver: First run — capping analysis to the most recent ${FIRST_RUN_CAP} messages. ` +
          `Use /cw reset then /cw learn to reprocess from scratch if needed.`
        );
        return chatLog.slice(-FIRST_RUN_CAP);
      }
      return [...chatLog];
    }

    const idx = chatLog.findIndex(m => m.id === lastProcessedId);
    if (idx === -1) {
      ui.notifications.warn(
        `Chronicle Weaver: Previous marker not found. Analysing the most recent ${FIRST_RUN_CAP} messages.`
      );
      return chatLog.slice(-FIRST_RUN_CAP);
    }
    return chatLog.slice(idx + 1);
  }

  /**
   * Calls the reader model to extract a bulleted fact-list from `text`.
   *
   * @param {string} text  - Combined chat log text (HTML stripped, AI filtered).
   * @param {string} model - Ollama model name to use.
   * @param {string} url   - Ollama base URL.
   * @returns {Promise<string|null>} Raw insights text, or `null` on failure.
   * @private
   */
  async _analyzeText(text, model, url) {
    const prompt =
      `Read the following RPG chat log and summarise key events, new proper nouns ` +
      `(with descriptions), and character developments.\n` +
      `Do NOT output JSON. Just provide a concise bulleted list of facts.\n\n` +
      `Chat Log:\n${text}`;

    try {
      const res = await fetch(`${url}/api/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      return data.response ?? null;
    } catch (err) {
      console.error("Chronicle Weaver | Reader error:", err);
      return null;
    }
  }

  /**
   * Calls the coder model to convert raw insights into structured JSON, then
   * validates and queues the result via `updateGrimoire`.
   *
   * @param {string} insights - Bulleted fact-list from `_analyzeText`.
   * @param {string} model    - Ollama coder model name.
   * @param {string} url      - Ollama base URL.
   * @returns {Promise<boolean>} `true` if the save pipeline succeeded.
   * @private
   */
  async _structureAndSave(insights, model, url) {
    const prompt =
      `You are a data entry assistant. Convert the following RPG session notes into ` +
      `a JSON array of Lorebook entries.\n` +
      `Each entry must have:\n` +
      `- "keys": array of strings (names, aliases)\n` +
      `- "content": string (factual description)\n\n` +
      `Ignore duplicates. Merge related information.\n\n` +
      `Session Notes:\n${insights}\n\n` +
      `Format:\n[\n    { "keys": ["Name"], "content": "Description…" }\n]`;

    try {
      const res = await fetch(`${url}/api/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, stream: false, format: "json" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();

      const raw = data.response?.replace(/```json|```/g, "").trim() ?? "";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn("Chronicle Weaver | Failed to parse coder JSON:", raw);
        return false;
      }

      // Unwrap common model-specific wrapper objects.
      if (!Array.isArray(parsed) && parsed && typeof parsed === "object") {
        parsed =
          parsed.entries ?? parsed.lore ?? parsed.lorebook ??
          parsed.results ?? Object.values(parsed)[0] ?? [];
      }

      const entries = Array.isArray(parsed) ? parsed : [];
      if (entries.length > 0) await this.updateGrimoire(entries);
      return true;

    } catch (err) {
      console.error("Chronicle Weaver | Coder error:", err);
      return false;
    }
  }

  /**
   * Validates incoming entries, de-duplicates against existing pending and
   * approved lore, and appends novel entries to the pending review queue.
   *
   * @param {Object[]} entries - Raw entry objects from the coder model.
   * @returns {Promise<void>}
   */
  async updateGrimoire(entries) {
    const pending = game.settings.get(MODULE_ID, "pending_entries") ?? [];

    const existingPrints = new Set([
      ...pending.map(p => this._fingerprint(p.keys)),
      ...game.chronicleWeaver.grimoires.flatMap(g =>
        g.entries.map(e => this._fingerprint(e.keys))
      ),
    ]);

    let added = 0;

    for (const entry of entries) {
      const rawKeys = entry.keys;
      const keys = Array.isArray(rawKeys)
        ? rawKeys.map(k => String(k).trim()).filter(Boolean)
        : typeof rawKeys === "string" && rawKeys.trim()
          ? [rawKeys.trim()]
          : [];

      const content = entry.content != null ? String(entry.content).trim() : null;

      if (keys.length === 0 || !content) {
        console.warn("Chronicle Weaver | Skipping invalid entry:", entry);
        continue;
      }

      const print = this._fingerprint(keys);
      if (existingPrints.has(print)) continue;

      pending.push({
        id:         foundry.utils.randomID(),
        keys,
        content,
        confidence: entry.confidence ?? null,
        source:     "learned",
        timestamp:  Date.now(),
        status:     "pending",
      });
      existingPrints.add(print);
      added++;
    }

    if (added > 0) {
      await game.settings.set(MODULE_ID, "pending_entries", pending);
      ui.notifications.info(`Chronicle Weaver: ${added} new entries ready for review.`);
    } else {
      ui.notifications.info("Chronicle Weaver: No new lore found (all entries already known).");
    }
  }

  /**
   * Generates a stable fingerprint for de-duplication — keys lower-cased and sorted.
   *
   * @param {string[]} keys - Array of keyword strings.
   * @returns {string} Fingerprint string.
   * @private
   */
  _fingerprint(keys = []) {
    return (Array.isArray(keys) ? keys : [])
      .map(k => String(k).toLowerCase())
      .sort()
      .join("|");
  }

  /**
   * Strips HTML tags and decodes common entities from a chat message string.
   *
   * @param {string} html - Raw HTML message content.
   * @returns {string} Plain text.
   * @private
   */
  _stripHtml(html) {
    return (html ?? "")
      .replace(/<[^>]*>/gm, "")
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&nbsp;/g, " ")
      .trim();
  }
}
