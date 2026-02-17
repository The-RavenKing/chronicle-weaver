export class ChatService {
    constructor() { }

    /**
     * Generates a response from the AI using /api/chat.
     * @param {string} userPrompt - The user's input.
     * @param {Object} context - Data for context (soul, grimoires, spirits, history).
     * @returns {Promise<string>} The AI's response.
     */
    async generateResponse(userPrompt, context) {
        // context: { spirit: Spirit (AI), souls: Soul[] (Players), grimoires: Grimoire[], history: [] }

        const activeSpirit = context.spirit; // Was activeSoul
        const activeSouls = context.souls || []; // Was activeSpirits

        const ollamaUrl = game.settings.get('chronicle-weaver', 'ollamaUrl');
        const model = game.settings.get('chronicle-weaver', 'ollamaModel');

        if (!activeSpirit) {
            console.error("Chronicle Weaver | No Active Spirit found!");
            ui.notifications.warn("Chronicle Weaver: No Active Spirit selected. Please select one in Module Settings.");
            return null; // Don't return text to avoid "Narrator needs..." showing up as AI response in some flows
        }

        const messages = this._buildMessages(userPrompt, {
            spirit: activeSpirit,
            souls: activeSouls,
            grimoires: context.grimoires,
            history: context.history
        });

        try {
            const response = await fetch(`${ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: false,
                    options: {
                        temperature: 0.7
                    }
                })
            });

            if (!response.ok) {
                console.error(`Chronicle Weaver | API Error: ${response.status} ${response.statusText}`);
                const errorText = await response.text();
                // console.error(`Chronicle Weaver | Error Body:`, errorText);
                throw new Error(`Ollama API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            const reply = data.message?.content || data.response;
            if (!reply) {
                console.warn("Chronicle Weaver | No content in response:", data);
                return "AI returned empty response.";
            }
            return reply;

        } catch (error) {
            console.error("Chronicle Weaver | Generation Error:", error);
            ui.notifications.error(`Chronicle Weaver Error: ${error.message}`);
            return null;
        }
    }

    /**
     * Builds the messages array for /api/chat.
     * @param {string} userMessage 
     * @param {Object} context 
     * @returns {Array} Array of message objects {role, content}
     */
    _buildMessages(userMessage, context) {
        const messages = [];
        const { spirit, souls, grimoires, history } = context;

        // 1. System Prompt (from Spirit/AI)
        let systemContent = spirit ? spirit.getSystemPrompt() : "You are a Game Master.";

        // 2. Add World Info (Grimoires) - Scanning
        const historyText = history ? history.map(h => h.content).join(' ') : '';
        const scanText = (historyText + ' ' + userMessage).trim();
        const triggered = [];

        if (grimoires && grimoires.length > 0) {
            for (const grimoire of grimoires) {
                triggered.push(...grimoire.scan(scanText));
            }
        }

        if (triggered.length > 0) {
            systemContent += '\n\n## World Information\n';
            // Deduplicate entries by uid (Grimoire entries use uid, not id)
            const uniqueEntries = [...new Map(
                triggered.map((item, idx) => [item.uid ?? `__idx_${idx}`, item])
            ).values()];
            uniqueEntries.forEach(entry => {
                const label = entry.keys?.length > 0 ? entry.keys[0] : 'Info';
                systemContent += `- ${label}: ${entry.content}\n`;
            });
        }

        // 3. Add Player Personas (Souls)
        if (souls && souls.length > 0) {
            systemContent += "\n\n## Player Characters in Scene\n";
            souls.forEach(s => {
                systemContent += s.getPersonaBlock() + "\n";
            });
        }

        // Push system message
        messages.push({ role: 'system', content: systemContent });

        // Inject Spirit's opening message if present and this is the start of a conversation
        if (spirit?.first_message && (!history || history.length === 0)) {
            messages.push({ role: 'assistant', content: spirit.first_message });
        }

        // 4. Conversation History
        if (history && history.length > 0) {
            history.forEach(msg => messages.push(msg));
        }

        // Inject post-history instructions if present (SillyTavern feature)
        if (spirit?.post_history_instructions) {
            messages.push({ role: 'system', content: spirit.post_history_instructions });
        }

        // 5. Current user message
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }
}
