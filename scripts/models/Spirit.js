export class Spirit {
    constructor(data = {}) {
        this.name = data.name || "New Spirit";
        this.description = data.description || "";
        this.personality = data.personality || "";
        this.intro = data.first_message || "";
        this.scenario = data.scenario || "";
        this.example_dialogue = data.mes_example || "";
        this.metadata = data.metadata || {};
        this.actorId = data.actorId || null; // Link to Foundry Actor
    }

    /**
     * Binds this Spirit to a Foundry Actor.
     * @param {string} actorId - The ID of the Foundry Actor.
     */
    bindActor(actorId) {
        this.actorId = actorId;
    }

    /**
     * Gets the associated Foundry Actor.
     * @returns {Actor|null} - The Foundry Actor or null if not found.
     */
    getActor() {
        if (!this.actorId) return null;
        return game.actors.get(this.actorId);
    }

    /**
     * Creates a prompt block for this character.
     * @returns {string}
     */
    getCharBlock() {
        let block = `Name: ${this.name}\n`;
        if (this.description) block += `Description: ${this.description}\n`;
        if (this.personality) block += `Personality: ${this.personality}\n`;
        if (this.scenario) block += `Scenario: ${this.scenario}\n`;
        if (this.example_dialogue) block += `\nExample Dialogue:\n${this.example_dialogue}\n`;
        return block;
    }

    toJSON() {
        return {
            name: this.name,
            description: this.description,
            personality: this.personality,
            first_message: this.intro,
            scenario: this.scenario,
            mes_example: this.example_dialogue,
            metadata: this.metadata,
            actorId: this.actorId
        };
    }
}
