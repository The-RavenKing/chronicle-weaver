export class LearningService {
    constructor() {
    }

    /**
     * Ingests unread chat history to find new lore.
     */
    async learnFromChat() {
        console.log("Chronicle Weaver | Starting learning process...");
        const chatLog = game.messages.contents;
        const lastProcessedId = game.settings.get('chronicle-weaver', 'lastProcessedMessageId');

        // 1. Filter new messages
        let newMessages = [];
        const FIRST_RUN_CAP = 100;
        if (!lastProcessedId) {
            if (chatLog.length > FIRST_RUN_CAP) {
                ui.notifications.warn(
                    `Chronicle Weaver: First run — capping analysis to the most recent ${FIRST_RUN_CAP} messages. ` +
                    `Use /cw reset then /cw learn to reprocess from scratch if needed.`
                );
                newMessages = chatLog.slice(-FIRST_RUN_CAP);
            } else {
                newMessages = chatLog;
            }
        } else {
            const index = chatLog.findIndex(m => m.id === lastProcessedId);
            if (index !== -1 && index < chatLog.length - 1) {
                newMessages = chatLog.slice(index + 1);
            } else if (index === -1) {
                // Marker not found — chat may have been cleared. Cap to recent messages.
                ui.notifications.warn(
                    `Chronicle Weaver: Previous marker not found. Analyzing the most recent ${FIRST_RUN_CAP} messages.`
                );
                newMessages = chatLog.slice(-FIRST_RUN_CAP);
            }
        }

        if (newMessages.length === 0) {
            console.log("Chronicle Weaver | No new messages to learn from.");
            ui.notifications.info("Chronicle Weaver: No new messages found since last run.");
            return;
        }

        ui.notifications.info(`Chronicle Weaver: Analyzing ${newMessages.length} new messages...`);

        // 2. Prepare Chunks (Simple Text Blob for now)
        // Group by 10-20 messages maybe? Let's just do one big chunk for MVP
        const combinedText = newMessages.map(m => `${m.speaker.alias || 'Unknown'}: ${this._stripHtml(m.content)}`).join('\n');

        // 3. Analyze with Reader Model
        const ollamaUrl = game.settings.get('chronicle-weaver', 'ollamaUrl');
        const readerModel = game.settings.get('chronicle-weaver', 'ollamaModel');
        const coderModel = game.settings.get('chronicle-weaver', 'coderModel');

        const gatheredInsight = await this._analyzeText(combinedText, readerModel, ollamaUrl);

        if (!gatheredInsight || gatheredInsight.trim().length === 0) {
            console.log("Chronicle Weaver | No insights gathered.");
            ui.notifications.info("Chronicle Weaver: Analysis complete — no new lore identified.");
            return;
        }

        ui.notifications.info(`Chronicle Weaver: Found insights. Structuring...`);

        // 4. Structure with Coder Model
        // We pass ALL insights at once. If too many, would need chunking.
        const saveSucceeded = await this._structureAndSave(gatheredInsight, coderModel, ollamaUrl);

        // 5. Update Marker — only if save succeeded so failed messages can be retried
        if (saveSucceeded) {
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
                await game.settings.set('chronicle-weaver', 'lastProcessedMessageId', lastMessage.id);
                console.log(`Chronicle Weaver | Marker updated to ${lastMessage.id}`);
            }
        } else {
            ui.notifications.warn("Chronicle Weaver: Structuring failed — marker not advanced. Run /cw learn again to retry.");
        }
    }

    /**
     * Reader Model: Extracts raw narrative facts.
     */
    async _analyzeText(text, model, url) {
        const prompt = `Read the following RPG chat log and summarize key events, new proper nouns (with descriptions), and character developments.
Do NOT output JSON. Just provide a concise bulleted list of facts.

Chat Log:
${text}`;

        try {
            const response = await fetch(`${url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                })
            });
            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
            const data = await response.json();
            return data.response;
        } catch (e) {
            console.error("Chronicle Weaver | Reader Error:", e);
            return null;
        }
    }

    /**
     * Coder Model: Converts insights into Lorebook entries.
     */
    async _structureAndSave(insights, model, url) {
        console.log("Chronicle Weaver | Structuring insights with Coder...");

        const prompt = `You are a data entry assistant. Convert the following RPG session notes into a JSON array of Lorebook entries.
Each entry must have:
- "keys": array of strings (names, aliases)
- "content": string (factual description)

Ignore duplicates if mentioned multiple times. Merge the information.

Session Notes:
${insights}

Format:
[
    { "keys": ["Name"], "content": "Description..." }
]`;

        try {
            const response = await fetch(`${url}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

            const data = await response.json();
            let entries = [];
            try {
                entries = JSON.parse(data.response.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                console.warn("Chronicle Weaver | Failed to parse Coder JSON:", e);
                return false;
            }

            if (Array.isArray(entries) && entries.length > 0) {
                await this.updateGrimoire(entries);
            }

            return true;

        } catch (e) {
            console.error("Chronicle Weaver | Coder Error:", e);
            return false;
        }
    }

    async updateGrimoire(entries) {
        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];

        // Build a set of existing key fingerprints (pending + approved grimoires)
        const existingFingerprints = new Set();
        for (const p of pending) {
            existingFingerprints.add((p.keys || []).map(k => k.toLowerCase()).sort().join('|'));
        }
        for (const g of game.chronicleWeaver.grimoires) {
            for (const e of g.entries) {
                existingFingerprints.add((e.keys || []).map(k => k.toLowerCase()).sort().join('|'));
            }
        }

        let added = 0;
        for (const entry of entries) {
            const fingerprint = (entry.keys || []).map(k => k.toLowerCase()).sort().join('|');
            if (existingFingerprints.has(fingerprint)) continue; // Skip duplicate

            pending.push({
                id: foundry.utils.randomID(),
                keys: entry.keys,
                content: entry.content,
                confidence: entry.confidence || null,
                source: 'learned',
                timestamp: Date.now(), // Fixed syntax error from original snippet
                status: 'pending'
            });
            existingFingerprints.add(fingerprint); // Prevent within-batch duplicates too
            added++;
        }

        if (added > 0) {
            await game.settings.set('chronicle-weaver', 'pending_entries', pending);
            ui.notifications.info(`Chronicle Weaver: ${added} new entries ready for review`);
        } else {
            ui.notifications.info("Chronicle Weaver: No new lore found (all entries already known).");
        }
    }

    _stripHtml(html) {
        return html?.replace(/<[^>]*>/gm, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim() || '';
    }
}
