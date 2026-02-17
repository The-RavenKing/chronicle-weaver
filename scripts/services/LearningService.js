export class LearningService {
    constructor() {
    }

    /**
     * Ingests unread chat history to find new lore.
     */
    async learnFromChat() {
        console.log("Chronicle Weaver | Learning from chat...");
        const chatUrl = game.settings.get('chronicle-weaver', 'ollamaUrl');
        const readerModel = game.settings.get('chronicle-weaver', 'ollamaModel');
        const coderModel = game.settings.get('chronicle-weaver', 'coderModel');
        const lastId = game.settings.get('chronicle-weaver', 'lastProcessedMessageId');

        // 1. Identify new messages
        const allMessages = game.messages.contents;
        let startIndex = 0;

        if (lastId) {
            const lastIndex = allMessages.findIndex(m => m.id === lastId);
            if (lastIndex !== -1) {
                startIndex = lastIndex + 1;
            }
        }

        const newMessages = allMessages.slice(startIndex).filter(m => m.content && [0, 1, 2].includes(m.type));

        if (newMessages.length === 0) {
            ui.notifications.info("Chronicle Weaver: No new messages to analyze.");
            return;
        }

        ui.notifications.info(`Chronicle Weaver: Analyzing ${newMessages.length} new messages...`);

        // 2. Chunking Logic (25 messages per chunk, 10 overlap)
        // Each chunk starts CHUNK_SIZE - OVERLAP messages after the previous one,
        // so adjacent chunks share OVERLAP messages for continuity.
        // e.g. chunk 1 = msgs 0-24, chunk 2 = msgs 15-39, chunk 3 = msgs 30-54, ...
        const CHUNK_SIZE = 25;
        const OVERLAP = 10;
        const chunks = [];

        for (let i = 0; i < newMessages.length; i += (CHUNK_SIZE - OVERLAP)) {
            const chunk = newMessages.slice(i, i + CHUNK_SIZE);
            if (chunk.length === 0) break;
            chunks.push(chunk);
        }

        console.log(`Chronicle Weaver | Processing ${chunks.length} chunks...`);

        // 3. Reader Phase: Analyze each chunk
        let gatheredInsights = [];

        for (const [index, chunk] of chunks.entries()) {
            const logText = chunk.map(m => `${m.speaker.alias || 'Unknown'}: ${m.content}`).join('\n');
            const insight = await this._analyzeChunk(logText, readerModel, chatUrl);
            if (insight) {
                gatheredInsights.push(`Chunk ${index + 1} Insights:\n${insight}`);
            }
        }

        if (gatheredInsights.length === 0) {
            console.log("Chronicle Weaver | No insights gathered.");
            return;
        }

        // 4. Coder Phase: Collate and structure
        const combinedInsights = gatheredInsights.join('\n\n');
        await this._structureAndSave(combinedInsights, coderModel, chatUrl);

        // 5. Update Marker
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage) {
            await game.settings.set('chronicle-weaver', 'lastProcessedMessageId', lastMessage.id);
            console.log(`Chronicle Weaver | Marker updated to ${lastMessage.id}`);
        }
    }

    /**
     * Reader Model: Extracts raw narrative facts.
     */
    async _analyzeChunk(text, model, url) {
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

            const data = await response.json();
            let entries = [];
            try {
                entries = JSON.parse(data.response.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                console.warn("Chronicle Weaver | Failed to parse Coder JSON:", e);
                return;
            }

            if (Array.isArray(entries) && entries.length > 0) {
                await this.updateGrimoire(entries);
            }

        } catch (e) {
            console.error("Chronicle Weaver | Coder Error:", e);
        }
    }

    async updateGrimoire(entries) {
        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];
        let added = 0;

        for (const entry of entries) {
            // Simple duplicate check against pending + existing Grimoires needed?
            // For now just push to pending.
            pending.push({
                id: foundry.utils.randomID(),
                keys: entry.keys,
                content: entry.content,
                confidence: entry.confidence || null,
                source: 'learned',
                timestamp: Date.now(),
                status: 'pending'
            });
            added++;
        }

        if (added > 0) {
            await game.settings.set('chronicle-weaver', 'pending_entries', pending);
            ui.notifications.info(`Chronicle Weaver: ${added} entries ready for review`);
            // Optionally trigger a re-render of the config or badge if open
        } else {
            ui.notifications.info("Chronicle Weaver: No new lore found.");
        }
    }
}
