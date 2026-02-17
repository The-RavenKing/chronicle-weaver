import { ReviewQueueApp } from './ReviewQueueApp.js';

export class ChronicleWeaverConfig extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "chronicle-weaver-config",
            title: "Chronicle Weaver Configuration",
            template: "modules/chronicle-weaver/templates/config.html",
            width: 800,
            height: 600,
            resizable: true,
            tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "souls" }]
        });
    }

    getData() {
        const data = super.getData();
        data.spirits = game.chronicleWeaver.spirits; // AI Personas
        data.souls = game.chronicleWeaver.souls; // PC Personas
        data.grimoires = game.chronicleWeaver.grimoires;

        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];
        data.pendingCount = pending.length;

        data.activeSpirit = game.settings.get('chronicle-weaver', 'activeSpirit'); // Was activeSoul
        // Settings data
        data.ollamaUrl = game.settings.get('chronicle-weaver', 'ollamaUrl');
        data.ollamaModel = game.settings.get('chronicle-weaver', 'ollamaModel');
        data.coderModel = game.settings.get('chronicle-weaver', 'coderModel');

        // Available models
        data.availableModels = game.settings.get('chronicle-weaver', 'ollamaContextModels') || [];

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Existing listeners
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));
        html.find('.open-review-queue').click((ev) => {
            new ReviewQueueApp().render(true);
        });

        // New listeners
        html.find('#cw-test-connection').click(this._onTestConnection.bind(this));
        html.find('#cw-refresh-models').click(this._onRefreshModels.bind(this));
        html.find('select[name="ollamaModel"]').change(this._onSettingChange.bind(this));
        html.find('select[name="coderModel"]').change(this._onSettingChange.bind(this));
        html.find('input[name="ollamaUrl"]').change(this._onSettingChange.bind(this));

        // Import Buttons
        html.find('.import-spirit').click(ev => html.find('#import-spirit-file').click());
        html.find('#import-spirit-file').change(ev => this._onImportSpirit(ev));

        html.find('.import-soul').click(ev => html.find('#import-soul-file').click());
        html.find('#import-soul-file').change(ev => this._onImportSoul(ev));

        html.find('.import-grimoire').click(ev => html.find('#import-grimoire-file').click());
        html.find('#import-grimoire-file').change(ev => this._onImportGrimoire(ev));

        // Import Soul from Actor (Fallback)
        html.find('.import-soul-actor').click(this._onImportSoulFromActor.bind(this));
        // Active Spirit
        html.find('.active-spirit-select').change(this._onActiveSpiritChange.bind(this));
    }

    async _onActiveSpiritChange(event) {
        const id = event.target.value;
        await game.settings.set('chronicle-weaver', 'activeSpirit', id);
        ui.notifications.info("Chronicle Weaver: Active Spirit Updated");
    }

    async _onSettingChange(event) {
        const field = event.currentTarget;
        const key = field.name;
        const value = field.value;
        await game.settings.set('chronicle-weaver', key, value);
        // Don't re-render entire app on input change to avoid losing focus, unless needed
    }

    async _onTestConnection(event) {
        event.preventDefault();
        const url = game.settings.get('chronicle-weaver', 'ollamaUrl');
        const btn = $(event.currentTarget);
        const icon = btn.find('i');

        icon.attr('class', 'fas fa-spinner fa-spin');

        try {
            const response = await fetch(`${url}/api/version`); // Simple ping
            if (response.ok) {
                ui.notifications.info(`Chronicle Weaver: Connected to Ollama successfully!`);
                // Auto-refresh models on success
                await this._onRefreshModels(event);
            } else {
                throw new Error(response.statusText);
            }
        } catch (error) {
            ui.notifications.error(`Chronicle Weaver: Connection failed. ${error.message}`);
        } finally {
            icon.attr('class', 'fas fa-plug');
        }
    }

    async _onRefreshModels(event) {
        if (event) event.preventDefault();
        const url = game.settings.get('chronicle-weaver', 'ollamaUrl');

        try {
            const response = await fetch(`${url}/api/tags`);
            if (!response.ok) throw new Error("Failed to fetch models");

            const data = await response.json();
            const models = data.models.map(m => m.name);

            await game.settings.set('chronicle-weaver', 'ollamaContextModels', models);
            ui.notifications.info(`Chronicle Weaver: Found ${models.length} models.`);
            this.render(); // Re-render to populate dropdowns

        } catch (error) {
            ui.notifications.error(`Chronicle Weaver: Could not fetch models. ${error.message}`);
        }
    }

    async _onImportSpirit(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const json = JSON.parse(text);
            const spiritData = this._parseSillyTavernCard(json);
            if (spiritData) {
                game.chronicleWeaver.spirits.push(new game.chronicleWeaver.models.Spirit(spiritData));
                await game.settings.set('chronicle-weaver', 'data_spirits', game.chronicleWeaver.spirits.map(s => s.toJSON()));
                this.render();
                ui.notifications.info(`Imported Spirit: ${spiritData.name}`);
            }
        } catch (err) {
            console.error(err);
            ui.notifications.error("Failed to import Spirit: Invalid JSON.");
        }
    }

    async _onImportSoul(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const json = JSON.parse(text);
            const soulData = this._parseSillyTavernCard(json); // Souls also use Card format usually or just simplified
            if (soulData) {
                // Souls are PCs, usually synced with Actors. But if importing manually:
                soulData.id = foundry.utils.randomID();
                game.chronicleWeaver.souls.push(new game.chronicleWeaver.models.Soul(soulData));
                await game.settings.set('chronicle-weaver', 'data_souls', game.chronicleWeaver.souls.map(s => s.toJSON()));
                this.render();
                ui.notifications.info(`Imported Soul: ${soulData.name}`);
            }
        } catch (err) {
            console.error(err);
            ui.notifications.error("Failed to import Soul: Invalid JSON.");
        }
    }

    async _onImportSoulFromActor(ev) {
        ev.preventDefault();

        // Simple dialog to select an actor
        const actors = game.actors.contents.map(a => `<option value="${a.id}">${a.name}</option>`).join('');

        new Dialog({
            title: "Import Soul from Actor",
            content: `
                <form>
                    <div class="form-group">
                        <label>Select Actor:</label>
                        <select id="actor-select" style="width: 100%;">${actors}</select>
                    </div>
                </form>
            `,
            buttons: {
                import: {
                    label: "Import",
                    callback: async (html) => {
                        const actorId = html.find('#actor-select').val();
                        const actor = game.actors.get(actorId);
                        if (!actor) return;

                        // Set the flag on the actor so it syncs in the future
                        await actor.setFlag('chronicle-weaver', 'isPC', true);

                        // Manually trigger sync just in case
                        if (game.chronicleWeaver?.soulManager) {
                            await game.chronicleWeaver.soulManager.updateFromActor(actor);
                        }

                        ui.notifications.info(`Imported/Linked Soul: ${actor.name}`);
                        this.render();
                    }
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "import"
        }).render(true);
    }

    async _onImportGrimoire(ev) {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        try {
            const json = JSON.parse(text);
            const grimoireData = this._parseSillyTavernLorebook(json);
            if (grimoireData) {
                game.chronicleWeaver.grimoires.push(new game.chronicleWeaver.models.Grimoire(grimoireData));
                await game.settings.set('chronicle-weaver', 'data_grimoires', game.chronicleWeaver.grimoires.map(g => g.toJSON()));
                this.render();
                ui.notifications.info(`Imported Grimoire: ${grimoireData.name}`);
            }
        } catch (err) {
            console.error(err);
            ui.notifications.error("Failed to import Grimoire: Invalid JSON.");
        }
    }

    _parseSillyTavernCard(json) {
        // Handle V1 and V2 specs roughly
        const data = json.data || json; // V2 vs V1
        return {
            name: data.name || "Unknown",
            description: data.description || data.persona || "",
            personality: data.personality || "",
            scenario: data.scenario || "",
            system_prompt: data.system_prompt || data.first_mes || ""
        };
    }

    _parseSillyTavernLorebook(json) {
        // SillyTavern Lorebook JSON
        // Structure: { entries: [ { keys: [], content: "", ... } ], ... }
        const entries = json.entries || [];
        // Map to our Grimoire Entry format
        const mappedEntries = entries.map(e => ({
            id: foundry.utils.randomID(),
            keys: e.keys || [],
            content: e.content || "",
            active: e.enabled !== false
        }));

        return {
            id: foundry.utils.randomID(),
            name: json.name || "Imported Lorebook",
            entries: mappedEntries
        };
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;

        if (type === 'soul') {
            const newSoul = new game.chronicleWeaver.models.Soul({ name: 'New Soul' });
            game.chronicleWeaver.souls.push(newSoul);
            await game.settings.set('chronicle-weaver', 'data_souls',
                game.chronicleWeaver.souls.map(s => s.toJSON()));
        }

        if (type === 'grimoire') {
            const newGrimoire = new game.chronicleWeaver.models.Grimoire({ name: 'New Grimoire' });
            game.chronicleWeaver.grimoires.push(newGrimoire);
            await game.settings.set('chronicle-weaver', 'data_grimoires',
                game.chronicleWeaver.grimoires.map(g => g.toJSON()));
        }

        if (type === 'spirit') {
            const newSpirit = new game.chronicleWeaver.models.Spirit({ name: 'New Spirit' });
            game.chronicleWeaver.spirits.push(newSpirit);
            await game.settings.set('chronicle-weaver', 'data_spirits',
                game.chronicleWeaver.spirits.map(s => s.toJSON()));
        }

        this.render();
    }

    async _onItemDelete(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents('.item');
        const id = li.data('id');
        const type = li.data('type');

        const confirmed = await Dialog.confirm({
            title: 'Delete Item',
            content: '<p>Are you sure you want to delete this item?</p>'
        });
        if (!confirmed) return;

        if (type === 'soul') {
            game.chronicleWeaver.souls = game.chronicleWeaver.souls.filter(s => s.id !== id);
            await game.settings.set('chronicle-weaver', 'data_souls',
                game.chronicleWeaver.souls.map(s => s.toJSON()));
        }

        if (type === 'grimoire') {
            game.chronicleWeaver.grimoires = game.chronicleWeaver.grimoires.filter(g => g.id !== id);
            await game.settings.set('chronicle-weaver', 'data_grimoires',
                game.chronicleWeaver.grimoires.map(g => g.toJSON()));
        }

        if (type === 'spirit') {
            game.chronicleWeaver.spirits = game.chronicleWeaver.spirits.filter(s => s.id !== id);
            await game.settings.set('chronicle-weaver', 'data_spirits',
                game.chronicleWeaver.spirits.map(s => s.toJSON()));
        }

        this.render();
    }

    async _updateObject(event, formData) {
        // Since this is a custom form, formData might not map 1:1 to our objects if we had inputs
        // For now, we assume the objects in memory (game.chronicleWeaver) are updated by other interactions
        // and we just need to persist them.
        // However, a real implementation would use the form data to update the objects.

        // For MVP, we'll just save the current in-memory state which should be updated by add/edit listeners
        // But since we haven't implemented full add/edit dialogs, let's just save.

        const soulsData = game.chronicleWeaver.souls.map(s => s.toJSON());
        const grimoiresData = game.chronicleWeaver.grimoires.map(g => g.toJSON());
        const spiritsData = game.chronicleWeaver.spirits.map(s => s.toJSON());

        await game.settings.set('chronicle-weaver', 'data_souls', soulsData);
        await game.settings.set('chronicle-weaver', 'data_grimoires', grimoiresData);
        await game.settings.set('chronicle-weaver', 'data_spirits', spiritsData);

        ui.notifications.info("Chronicle Weaver: Configuration Saved");
    }
}
