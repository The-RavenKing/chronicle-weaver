export class Spirit {
    constructor(data = {}) {
        this.id = data.id || foundry.utils.randomID();
        this.name = data.name || "New Spirit";
        this.description = data.description || "";
        this.personality = data.personality || "";
        this.intro = data.first_message || "";
        this.scenario = data.scenario || "";
        this.example_dialogue = data.mes_example || "";
        this.background = data.background || "";

        // PC specific fields
        this.attributes = data.attributes || {
            class: "Unknown",
            subclass: "",
            level: 1,
            race: "Unknown"
        };

        this.stats = data.stats || {
            hp: { current: 10, max: 10 },
            ac: 10
        };

        this.equipment = data.equipment || [];
        this.gold = data.gold || 0;

        // Links
        this.foundry_actor_id = data.foundry_actor_id || null;
        this.user_id = data.user_id || null;
    }

    /**
     * Formats the Spirit data for AI injection.
     * @returns {string} Text block describing the PC.
     */
    getPersonaBlock() {
        // Example: Lucien Ashford (Rogue 7, HP: 48/52): A cunning rogue. Former Black Crows member. Charming but ruthless.

        const summary = `${this.name} (${this.attributes.race} ${this.attributes.class} ${this.attributes.level}, HP: ${this.stats.hp.current}/${this.stats.hp.max})`;

        let details = "";
        if (this.description) details += `${this.description} `;
        if (this.personality) details += `${this.personality} `;
        if (this.background) details += `${this.background} `;

        return `${summary}: ${details.trim()}`;
    }

    /**
     * Updates this Spirit from a Foundry Actor.
     * @param {Actor} actor 
     */
    syncFromActor(actor) {
        this.name = actor.name;
        this.foundry_actor_id = actor.id;

        // Try to infer ownership (first owner that isn't GM)
        // Or just let the module handle user_id assignment on creation

        // System agnostic attempt (D&D 5e focused default, expand for others)
        const sys = actor.system;

        // D&D 5e Mapping
        this.attributes.race = actor.items.find(i => i.type === 'race')?.name || sys.details?.race || "Unknown";

        // Class/Level
        if (actor.classes) {
            // 5e specific helper
            const classes = Object.values(actor.classes).map(c => `${c.name} ${c.system.levels}`).join('/');
            this.attributes.class = classes || "Unknown";
            this.attributes.level = sys.details?.level || 1;
        } else {
            this.attributes.class = sys.details?.class || "Unknown";
            this.attributes.level = sys.details?.level || 1;
        }

        this.attributes.background = sys.details?.background?.name || sys.details?.background || "";

        // Bio (Description/Personality/Background) covers a lot
        // We might want to keep manual edits to Description/Personality if the user sets them in CW
        // But for "Background" maybe we pull from bio?
        // For now, let's just pull text if our fields are empty to avoid overwriting custom AI prompts
        if (!this.description) this.description = sys.details?.biography?.value?.replace(/<[^>]*>?/gm, '') || "";

        // Stats
        this.stats.hp = {
            current: sys.attributes?.hp?.value || 0,
            max: sys.attributes?.hp?.max || 0
        };
        this.stats.ac = sys.attributes?.ac?.value || 10;

        // Equipment (Equipped items)
        this.equipment = actor.items
            .filter(i => i.type === 'weapon' || i.type === 'equipment' || i.type === 'tool')
            .filter(i => i.system?.equipped)
            .map(i => i.name);

        // Currency
        // 5e uses system.currency (cp, sp, ep, gp, pp)
        if (sys.currency) {
            this.gold = sys.currency.gp || 0; // Simplified
        }
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            personality: this.personality,
            background: this.background,
            attributes: this.attributes,
            stats: this.stats,
            equipment: this.equipment,
            gold: this.gold,
            foundry_actor_id: this.foundry_actor_id,
            user_id: this.user_id
        };
    }
}
