import { Grimoire } from './models/Grimoire.js';
import { Soul } from './models/Soul.js';
import { Spirit } from './models/Spirit.js';

export class ChatService {
    constructor() {
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * Generates a response from the AI using /api/chat.
     * @param {string} userPrompt - The user's input.
     * @param {Object} context - Data for context (soul, grimoires, spirits, history).
     * @returns {Promise<string>} The AI's response.
     */
    async generateResponse(userPrompt, context) {
        const settings = {
            url: game.settings.get('chronicle-weaver', 'ollamaUrl'),
            model: game.settings.get('chronicle-weaver', 'ollamaModel')
        };

        const messages = this._buildMessages(userPrompt, context);

        try {
            console.log("Chronicle Weaver | Sending to LLM:", messages);
            const response = await fetch(`${settings.url}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: messages,
                    stream: false,
                    options: { temperature: 0.8 }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(err || response.statusText);
            }

            const data = await response.json();
            // /api/chat returns 'message' object
            return data.message?.content || data.response || "No response.";

        } catch (error) {
            console.error("Chronicle Weaver | API Error:", error);
            ui.notifications.error(`AI Error: ${error.message}`);
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
        let systemContent = '';

        // 1. Soul (GM personality)
        if (context.soul) {
            systemContent += context.soul.getSystemPrompt();
        } else {
            systemContent += "You are a helpful Game Master.";
        }

        // 2. Active Spirit personas (player characters)
        if (context.spirits && context.spirits.length > 0) {
            systemContent += '\n\n## Player Characters\n';
            context.spirits.forEach(s => {
                systemContent += s.getPersonaBlock() + '\n';
            });
        }

        // 3. Grimoire entries triggered by keywords
        if (context.grimoires && context.grimoires.length > 0) {
            const historyText = context.history
                ? context.history.map(h => h.content).join(' ')
                : '';
            const scanText = (historyText + ' ' + userMessage).trim();

            const triggered = [];
            for (const grimoire of context.grimoires) {
                triggered.push(...grimoire.scan(scanText));
            }

            if (triggered.length > 0) {
                systemContent += '\n\n## World Information\n';
                triggered.forEach(entry => {
                    systemContent += entry.content + '\n';
                });
            }
        }

        // Push system message
        messages.push({ role: 'system', content: systemContent });

        // 4. Conversation history as alternating messages
        if (context.history && context.history.length > 0) {
            context.history.forEach(h => {
                messages.push({
                    role: h.role,
                    content: h.content
                });
            });
        }

        // 5. Current user message
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }
}
