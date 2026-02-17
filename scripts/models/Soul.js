export class Soul {
    constructor(data = {}) {
        this.name = data.name || "New Soul";
        this.description = data.description || "You are a helpful assistant.";
        this.personality = data.personality || "";
        this.scenario = data.scenario || "";
        this.first_message = data.first_message || "";
        this.mes_example = data.mes_example || ""; // Example messages
        this.creator_notes = data.creator_notes || "";
        this.system_prompt = data.system_prompt || "";
        this.post_history_instructions = data.post_history_instructions || "";
        this.tags = data.tags || [];
        this.creator = data.creator || "";
        this.character_version = data.character_version || "";
        this.extensions = data.extensions || {};
    }

    /**
     * Constructs the system prompt for this soul.
     * @returns {string} - The full system prompt.
     */
    getSystemPrompt() {
        let prompt = this.system_prompt || this.description;
        if (this.personality) prompt += `\n\nPersonality:\n${this.personality}`;
        if (this.scenario) prompt += `\n\nScenario:\n${this.scenario}`;
        return prompt;
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            personality: this.personality,
            scenario: this.scenario,
            first_message: this.first_message,
            mes_example: this.mes_example,
            creator_notes: this.creator_notes,
            system_prompt: this.system_prompt,
            post_history_instructions: this.post_history_instructions,
            tags: this.tags,
            creator: this.creator,
            character_version: this.character_version,
            extensions: this.extensions
        };
    }
}
