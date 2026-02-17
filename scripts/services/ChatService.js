import { Grimoire } from './models/Grimoire.js';
import { Soul } from './models/Soul.js';
import { Spirit } from './models/Spirit.js';

export class ChatService {
    constructor() {
        this.requestQueue = [];
        this.isProcessing = false;
    }

    /**
     * Sends a chat request to the AI.
     * @param {string} prompt - The prompt to send.
     * @param {Object} context - Additional context (Grimoires, Spirits, etc.).
     * @returns {Promise<string>} - The AI's response.
     */
    async generateResponse(prompt, context = {}) {
        const settings = this._getSettings();

        // Prepare the request body based on API type (Ollama for now)
        const requestBody = {
            model: settings.model,
            prompt: this._constructFullPrompt(prompt, context, settings),
            stream: false,
            options: {
                temperature: 0.7,
                // Add validation/other params here
            }
        };

        try {
            const response = await fetch(`${settings.url}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error("Chronicle Weaver | Chat Generation Error:", error);
            ui.notifications.error(`Chronicle Weaver: ${error.message}`);
            return null;
        }
    }

    /**
     * Constructs the full prompt with context from Grimoires, Souls, etc.
     */
    _constructFullPrompt(userPrompt, context, settings) {
        let fullPrompt = "";

        // 1. System Prompt / Soul Identity
        if (context.soul) {
            fullPrompt += `### Instruction:\n${context.soul.getSystemPrompt()}\n\n`;
        } else {
            fullPrompt += `### Instruction:\nYou are a helpful assistant.\n\n`;
        }

        // 2. World Info / Grimoire Entries
        if (context.grimoires && context.grimoires.length > 0) {
            const relevantEntries = [];
            for (const grimoire of context.grimoires) {
                // Scan user prompt and recent history (mocked history for now)
                const matches = grimoire.scan(userPrompt);
                relevantEntries.push(...matches);
            }

            if (relevantEntries.length > 0) {
                fullPrompt += `### World Info:\n`;
                for (const entry of relevantEntries) {
                    fullPrompt += `${entry.content}\n`;
                }
                // Inject Generic NPCs here as temporary lore
                if (context.sceneGrimoire && context.sceneGrimoire.length > 0) {
                    for (const npc of context.sceneGrimoire) {
                        // Strip HTML from bio if needed, for now just dump it
                        // A simple format: Name: [Name] \n Description: [Desc]
                        // Or just as a block
                        fullPrompt += `NPC: ${npc.name}\nDescription: ${npc.description.replace(/<[^>]*>?/gm, '')}\n`;
                    }
                }
                fullPrompt += `\n`;
            } else if (context.sceneGrimoire && context.sceneGrimoire.length > 0) {
                // Case where no Grimoire entries matched, but we have NPCs
                fullPrompt += `### World Info:\n`;
                for (const npc of context.sceneGrimoire) {
                    fullPrompt += `NPC: ${npc.name}\nDescription: ${npc.description.replace(/<[^>]*>?/gm, '')}\n`;
                }
                fullPrompt += `\n`;
            }
        }

        // 3. Spirit (Character) Context
        if (context.spirits && context.spirits.length > 0) {
            fullPrompt += `### NPCs Present:\n`;
            for (const spirit of context.spirits) {
                fullPrompt += `${spirit.getCharBlock()}\n`;
            }
            fullPrompt += `\n`;
        }

        // 3.5 Players Present
        if (context.players && context.players.length > 0) {
            fullPrompt += `### Players Present:\n${context.players.join(', ')}\n\n`;
        }

        // 4. Chat History (To be implemented fully later)
        if (context.history) {
            fullPrompt += `### History:\n${context.history}\n\n`;
        }

        // 5. Current User Input
        fullPrompt += `### Input:\n${userPrompt}\n\n### Response:\n`;

        return fullPrompt;
    }

    _getSettings() {
        return {
            url: game.settings.get('chronicle-weaver', 'ollamaUrl'),
            model: game.settings.get('chronicle-weaver', 'ollamaModel')
        };
    }
}
