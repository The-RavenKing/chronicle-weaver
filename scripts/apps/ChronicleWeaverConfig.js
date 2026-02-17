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
            tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "spirits" }]
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

        // Edit Item
        html.find('.item-edit').click(this._onItemEdit.bind(this));
    }

    async _onItemEdit(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents('.item');
        const id = li.data('id');
        const type = li.data('type'); // spirit, soul, grimoire

        if (type === 'spirit') {
            const spirit = game.chronicleWeaver.spirits.find(s => s.id === id);
            if (spirit) await this._editSpirit(spirit);
        } else if (type === 'soul') {
            const soul = game.chronicleWeaver.souls.find(s => s.id === id);
            if (soul) await this._editSoul(soul);
        } else if (type === 'grimoire') {
            const grimoire = game.chronicleWeaver.grimoires.find(g => g.id === id);
            if (grimoire) await this._editGrimoire(grimoire);
        }
    }

    async _editSpirit(spirit) {
        const esc = this._esc.bind(this);
        const content = `
            <form>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" value="${esc(spirit.name)}" required>
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" name="color" value="${esc(spirit.color || '#ffffff')}" style="height: 30px; width: 100%;">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="description" rows="3">${esc(spirit.description)}</textarea>
                </div>
                <div class="form-group">
                    <label>Personality</label>
                    <textarea name="personality" rows="3">${esc(spirit.personality)}</textarea>
                </div>
                <div class="form-group">
                    <label>Scenario</label>
                    <textarea name="scenario" rows="3">${esc(spirit.scenario)}</textarea>
                </div>
                <div class="form-group">
                    <label>System Prompt (Override)</label>
                    <textarea name="system_prompt" rows="3">${esc(spirit.system_prompt)}</textarea>
                    <p class="notes">Leave empty to use Description + Personality + Scenario.</p>
                </div>
                <hr>
                <div class="form-group">
                    <label>Update from JSON (SillyTavern Card)</label>
                    <textarea name="json_import" rows="3" placeholder="Paste JSON here to overwrite fields..."></textarea>
                </div>
            </form>
        `;

        new Dialog({
            title: `Edit Spirit: ${spirit.name}`,
            content: content,
            buttons: {
                save: {
                    label: "Save Spirit",
                    icon: '<i class="fas fa-save"></i>',
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const jsonText = form.json_import.value.trim();

                        if (jsonText) {
                            try {
                                const json = JSON.parse(jsonText);
                                const data = this._parseSillyTavernCard(json);
                                if (data) {
                                    spirit.name = data.name || spirit.name;
                                    spirit.description = data.description || spirit.description;
                                    spirit.personality = data.personality || spirit.personality;
                                    spirit.scenario = data.scenario || spirit.scenario;
                                    spirit.system_prompt = data.system_prompt || spirit.system_prompt;
                                    spirit.first_message = data.first_message || spirit.first_message;
                                    // Keep existing color if JSON doesn't specify (custom field)
                                    ui.notifications.info("Overwrote fields from JSON.");
                                }
                            } catch (err) {
                                ui.notifications.warn("Invalid JSON pasted. Using form fields.");
                            }
                        } else {
                            spirit.name = form.elements['name']?.value || spirit.name;
                            spirit.color = form.color.value;
                            spirit.description = form.description.value;
                            spirit.personality = form.personality.value;
                            spirit.scenario = form.scenario.value;
                            spirit.system_prompt = form.system_prompt.value;
                        }

                        await game.settings.set('chronicle-weaver', 'data_spirits', game.chronicleWeaver.spirits.map(s => s.toJSON()));
                        this.render();
                        ui.notifications.info(`Updated Spirit: ${spirit.name}`);
                    }
                }
            },
            default: "save"
        }).render(true);
    }

    async _editSoul(soul) {
        const esc = this._esc.bind(this);
        const content = `
            <form>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" value="${esc(soul.name)}" required>
                </div>
                <div class="form-group">
                    <label>Color</label>
                    <input type="color" name="color" value="${esc(soul.color || '#ffffff')}" style="height: 30px; width: 100%;">
                </div>
                <div class="form-group">
                    <label>Class</label>
                    <input type="text" name="class" value="${esc(soul.attributes?.class)}">
                </div>
                <div class="form-group">
                    <label>Level</label>
                    <input type="number" name="level" value="${esc(soul.attributes?.level || 1)}">
                </div>
                <div class="form-group">
                    <label>Backstory / Persona</label>
                    <textarea name="description" rows="4">${esc(soul.description)}</textarea>
                </div>
                <hr>
                <div class="form-group">
                    <label>Update from JSON</label>
                    <textarea name="json_import" rows="3" placeholder="Paste JSON here to overwrite..."></textarea>
                </div>
            </form>
        `;

        new Dialog({
            title: `Edit Soul: ${soul.name}`,
            content: content,
            buttons: {
                save: {
                    label: "Save Soul",
                    icon: '<i class="fas fa-save"></i>',
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        const jsonText = form.json_import.value.trim();

                        if (jsonText) {
                            try {
                                const json = JSON.parse(jsonText);
                                const data = this._parseSillyTavernCard(json);
                                if (data) {
                                    soul.name = data.name || soul.name;
                                    soul.description = data.description || soul.description;
                                    // Class/Level not standard in ST cards, keep existing
                                    ui.notifications.info("Overwrote fields from JSON.");
                                }
                            } catch (err) {
                                ui.notifications.warn("Invalid JSON pasted. Using form fields.");
                            }
                        } else {
                            soul.name = form.elements['name']?.value || soul.name;
                            soul.color = form.color.value;
                            soul.attributes.class = form.elements['class']?.value ?? soul.attributes.class;
                            soul.attributes.level = parseInt(form.elements['level']?.value) || 1;
                            soul.description = form.description.value;
                        }

                        await game.settings.set('chronicle-weaver', 'data_souls', game.chronicleWeaver.souls.map(s => s.toJSON()));
                        this.render();
                        ui.notifications.info(`Updated Soul: ${soul.name}`);
                    }
                }
            },
            default: "save"
        }).render(true);
    }

    async _editGrimoire(grimoire) {
        const esc = this._esc.bind(this);
        const content = `
            <form>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="name" value="${esc(grimoire.name)}" required>
                </div>
                <div class="form-group">
                    <label>JSON Entries (Read-Only/Manual Edit)</label>
                    <textarea name="entries" rows="10" style="font-family: monospace; font-size: 0.8em;">${this._esc(JSON.stringify(grimoire.entries, null, 2))}</textarea>
                    <p class="notes">Format: <code>[{"uid": "unique-id", "keys": ["key1"], "content": "text", "enabled": true}]</code>. The uid field must be unique per entry.</p>
                </div>
            </form>
        `;

        new Dialog({
            title: `Edit Grimoire: ${grimoire.name}`,
            content: content,
            buttons: {
                save: {
                    label: "Save Grimoire",
                    icon: '<i class="fas fa-save"></i>',
                    callback: async (html) => {
                        const form = html.find('form')[0];
                        grimoire.name = form.elements['name']?.value || grimoire.name;
                        try {
                            const parsed = JSON.parse(form.entries.value);
                            // Normalise: ensure every entry has uid and enabled
                            grimoire.entries = parsed.map(e => ({
                                ...e,
                                uid: e.uid || foundry.utils.randomID(),
                                enabled: e.enabled !== false
                            }));
                            await game.settings.set('chronicle-weaver', 'data_grimoires', game.chronicleWeaver.grimoires.map(g => g.toJSON()));
                            this.render();
                            ui.notifications.info(`Updated Grimoire: ${grimoire.name}`);
                        } catch (err) {
                            ui.notifications.error("Invalid JSON for Entries. Changes NOT saved.");
                            console.error(err);
                        }
                    }
                }
            },
            default: "save",
            width: 600
        }).render(true);
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
                await this._onRefreshModels(null);
            } else {
                throw new Error(response.statusText);
            }
        } catch (error) {
            ui.notifications.error(`Chronicle Weaver: Connection failed. ${error.message}`);
        } finally {
            icon.attr('class', 'fas fa-plug');
        }
    }

    async _onRefreshModels(event = null) {
        if (event?.type === 'click') event.preventDefault();
        const url = game.settings.get('chronicle-weaver', 'ollamaUrl');

        try {
            const response = await fetch(`${url}/api/tags`);
            if (!response.ok) throw new Error("Failed to fetch models");

            const data = await response.json();
            const models = (data.models ?? []).map(m => m.name);

            if (models.length === 0) {
                ui.notifications.warn("Chronicle Weaver: Connected but no models found. Have you pulled a model with `ollama pull`?");
            } else {
                ui.notifications.info(`Chronicle Weaver: Found ${models.length} models.`);
            }

            await game.settings.set('chronicle-weaver', 'ollamaContextModels', models);
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
                // id is assigned by Soul constructor if not already present
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
        const actors = game.actors.contents.map(a => `<option value="${this._esc(a.id)}">${this._esc(a.name)}</option>`).join('');

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

    /** Escapes a value for safe use inside an HTML attribute or text node. */
    _esc(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    _parseSillyTavernCard(json) {
        // Handle V1 and V2 specs roughly
        const data = json.data || json; // V2 vs V1
        return {
            name: data.name || "Unknown",
            description: data.description || data.persona || "",
            personality: data.personality || "",
            scenario: data.scenario || "",
            first_message: data.first_mes || "",
            system_prompt: data.system_prompt || ""
        };
    }

    _parseSillyTavernLorebook(json) {
        // SillyTavern Lorebook JSON
        // Structure: { entries: [ { keys: [], content: "", ... } ], ... }
        const rawEntries = json.entries || [];
        // SillyTavern stores entries as either an array or a keyed object — normalise to array
        const entriesArray = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries);

        // Map to our Grimoire Entry format
        const mappedEntries = entriesArray.map(e => ({
            uid: foundry.utils.randomID(),
            keys: e.keys || [],
            content: e.content || "",
            enabled: e.enabled !== false
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
