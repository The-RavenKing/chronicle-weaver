/**
 * @file ChronicleWeaverConfig.js
 * @description Full configuration UI for Chronicle Weaver: manages Spirits (AI personas),
 *   Souls (PC personas), and Grimoires (lorebooks), plus Ollama connection settings.
 *
 *   V13: Extends `HandlebarsApplicationMixin(ApplicationV2)`.
 *   - No jQuery. All DOM access uses plain querySelector / querySelectorAll.
 *   - All interactions use the declarative `data-action` system.
 *   - Edit dialogs use `foundry.applications.api.DialogV2`.
 *   - `_parseSillyTavernCard` now maps `post_history_instructions` (Bug 2 fix).
 */

import { ReviewQueueApp } from "./ReviewQueueApp.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

const MODULE_ID = "chronicle-weaver";

export class ChronicleWeaverConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  // ---------------------------------------------------------------------------
  // Application definition
  // ---------------------------------------------------------------------------

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "chronicle-weaver-config",
    window: {
      title: "Chronicle Weaver — Configuration",
      resizable: true,
    },
    position: { width: 820, height: 660 },
    /**
     * V13: HandlebarsApplicationMixin resolves tab state from `tabGroups`.
     * The key matches `data-group` on the <nav> element; the value is the
     * initially-active `data-tab` within that group.
     */
    tabGroups: { primary: "spirits" },
    actions: {
      // Toolbar
      testConnection:     ChronicleWeaverConfig._onTestConnection,
      refreshModels:      ChronicleWeaverConfig._onRefreshModels,
      openReviewQueue:    ChronicleWeaverConfig._onOpenReviewQueue,
      // CRUD
      createItem:         ChronicleWeaverConfig._onItemCreate,
      deleteItem:         ChronicleWeaverConfig._onItemDelete,
      editItem:           ChronicleWeaverConfig._onItemEdit,
      // File import triggers (click hidden <input type="file">)
      importSpiritPick:   ChronicleWeaverConfig._onImportSpiritPick,
      importSoulPick:     ChronicleWeaverConfig._onImportSoulPick,
      importGrimoirePick: ChronicleWeaverConfig._onImportGrimoirePick,
      importSoulActor:    ChronicleWeaverConfig._onImportSoulFromActor,
      // Inline settings
      changeActiveSpirit: ChronicleWeaverConfig._onActiveSpiritChange,
      changeSetting:      ChronicleWeaverConfig._onSettingChange,
    },
  };

  /** @override */
  static PARTS = {
    config: {
      template: "modules/chronicle-weaver/templates/config.html",
    },
  };

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  /**
   * Prepares the Handlebars template context.
   *
   * @param {object} _options - Render options (unused).
   * @returns {Promise<object>} Template context.
   * @override
   */
  async _prepareContext(_options = {}) {
    const cw = game.chronicleWeaver;
    return {
      spirits:         cw.spirits,
      souls:           cw.souls,
      grimoires:       cw.grimoires,
      pendingCount:    (game.settings.get(MODULE_ID, "pending_entries") ?? []).length,
      activeSpirit:    game.settings.get(MODULE_ID, "activeSpirit"),
      ollamaUrl:       game.settings.get(MODULE_ID, "ollamaUrl"),
      ollamaModel:     game.settings.get(MODULE_ID, "ollamaModel"),
      coderModel:      game.settings.get(MODULE_ID, "coderModel"),
      availableModels: game.settings.get(MODULE_ID, "ollamaContextModels") ?? [],
    };
  }

  // ---------------------------------------------------------------------------
  // File-input wiring
  // File inputs cannot carry data-action so we wire their `change` events
  // manually in _onRender after each render cycle.
  // ---------------------------------------------------------------------------

  /**
   * Wires hidden file inputs after each render.
   *
   * @param {HTMLElement} html - The rendered application element.
   * @param {object}      _ctx - Template context (unused).
   * @override
   */
  _onRender(html, _ctx) {
    html.querySelector("#import-spirit-file")
      ?.addEventListener("change", ev => this._onImportSpirit(ev));
    html.querySelector("#import-soul-file")
      ?.addEventListener("change", ev => this._onImportSoul(ev));
    html.querySelector("#import-grimoire-file")
      ?.addEventListener("change", ev => this._onImportGrimoire(ev));
  }

  // ---------------------------------------------------------------------------
  // Actions — connection
  // ---------------------------------------------------------------------------

  /**
   * Tests the Ollama connection and auto-refreshes the model list on success.
   *
   * @param {PointerEvent} event  - Click event.
   * @param {HTMLElement}  target - Button element.
   * @returns {Promise<void>}
   */
  static async _onTestConnection(event, target) {
    const url  = game.settings.get(MODULE_ID, "ollamaUrl");
    const icon = target.querySelector("i");
    if (icon) icon.className = "fas fa-spinner fa-spin";

    try {
      const res = await fetch(`${url}/api/version`);
      if (!res.ok) throw new Error(res.statusText);
      ui.notifications.info("Chronicle Weaver: Connected to Ollama successfully!");
      await ChronicleWeaverConfig._onRefreshModels.call(this, event, target);
    } catch (err) {
      ui.notifications.error(`Chronicle Weaver: Connection failed. ${err.message}`);
    } finally {
      if (icon) icon.className = "fas fa-plug";
    }
  }

  /**
   * Fetches the list of locally-pulled Ollama models and stores them for
   * the model selector dropdowns.
   *
   * @param {PointerEvent|null} _event  - Click event (may be null when called programmatically).
   * @param {HTMLElement|null}  _target - Button element.
   * @returns {Promise<void>}
   */
  static async _onRefreshModels(_event, _target) {
    const url = game.settings.get(MODULE_ID, "ollamaUrl");

    try {
      const res = await fetch(`${url}/api/tags`);
      if (!res.ok) throw new Error("Failed to fetch models");

      const data   = await res.json();
      const models = (data.models ?? []).map(m => m.name);

      if (models.length === 0) {
        ui.notifications.warn(
          "Chronicle Weaver: Connected but no models found. Have you run `ollama pull`?"
        );
      } else {
        ui.notifications.info(`Chronicle Weaver: Found ${models.length} model(s).`);
      }

      await game.settings.set(MODULE_ID, "ollamaContextModels", models);
      this.render();

    } catch (err) {
      ui.notifications.error(`Chronicle Weaver: Could not fetch models. ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Actions — review queue
  // ---------------------------------------------------------------------------

  /**
   * Opens the GM review queue.
   *
   * @param {PointerEvent} _event  - Click event.
   * @param {HTMLElement}  _target - Button element.
   */
  static _onOpenReviewQueue(_event, _target) {
    new ReviewQueueApp().render(true);
  }

  // ---------------------------------------------------------------------------
  // Actions — inline settings
  // ---------------------------------------------------------------------------

  /**
   * Persists a single module setting changed via an inline <select> or <input>.
   * The element must have a `name` attribute matching the setting key.
   *
   * @param {Event}       event  - Change event.
   * @param {HTMLElement} target - The changed element.
   * @returns {Promise<void>}
   */
  static async _onSettingChange(event, target) {
    const key   = target.name;
    const value = target.value;
    if (!key) return;
    await game.settings.set(MODULE_ID, key, value);
  }

  /**
   * Persists the active Spirit setting when the selector changes.
   *
   * @param {Event}       event  - Change event.
   * @param {HTMLElement} target - The <select> element.
   * @returns {Promise<void>}
   */
  static async _onActiveSpiritChange(event, target) {
    await game.settings.set(MODULE_ID, "activeSpirit", target.value);
    ui.notifications.info("Chronicle Weaver: Active Spirit updated.");
  }

  // ---------------------------------------------------------------------------
  // Actions — CRUD
  // ---------------------------------------------------------------------------

  /**
   * Creates a new item of the type specified by `data-type`.
   *
   * @param {PointerEvent} _event  - Click event.
   * @param {HTMLElement}  target  - Element with `data-action="createItem"` and `data-type`.
   * @returns {Promise<void>}
   */
  static async _onItemCreate(_event, target) {
    const type = target.dataset.type;
    const cw   = game.chronicleWeaver;

    if (type === "spirit") {
      cw.spirits.push(new cw.models.Spirit({ name: "New Spirit" }));
      await game.settings.set(MODULE_ID, "data_spirits", cw.spirits.map(s => s.toJSON()));
    } else if (type === "soul") {
      cw.souls.push(new cw.models.Soul({ name: "New Soul" }));
      await game.settings.set(MODULE_ID, "data_souls", cw.souls.map(s => s.toJSON()));
    } else if (type === "grimoire") {
      cw.grimoires.push(new cw.models.Grimoire({ name: "New Grimoire" }));
      await game.settings.set(MODULE_ID, "data_grimoires", cw.grimoires.map(g => g.toJSON()));
    }

    this.render();
  }

  /**
   * Deletes an item after GM confirmation via DialogV2.
   *
   * @param {PointerEvent} _event  - Click event.
   * @param {HTMLElement}  target  - Element with `data-action="deleteItem"`.
   * @returns {Promise<void>}
   */
  static async _onItemDelete(_event, target) {
    const li   = target.closest(".item");
    const id   = li?.dataset.id;
    const type = li?.dataset.type;
    if (!id || !type) return;

    const confirmed = await DialogV2.confirm({
      window:  { title: "Delete Item" },
      content: "<p>Are you sure you want to delete this item? This cannot be undone.</p>",
    });
    if (!confirmed) return;

    const cw = game.chronicleWeaver;

    if (type === "spirit") {
      cw.spirits = cw.spirits.filter(s => s.id !== id);
      await game.settings.set(MODULE_ID, "data_spirits", cw.spirits.map(s => s.toJSON()));
    } else if (type === "soul") {
      cw.souls = cw.souls.filter(s => s.id !== id);
      await game.settings.set(MODULE_ID, "data_souls", cw.souls.map(s => s.toJSON()));
    } else if (type === "grimoire") {
      cw.grimoires = cw.grimoires.filter(g => g.id !== id);
      await game.settings.set(MODULE_ID, "data_grimoires", cw.grimoires.map(g => g.toJSON()));
    }

    this.render();
  }

  /**
   * Opens the appropriate edit dialog for the targeted item.
   *
   * @param {PointerEvent} _event  - Click event.
   * @param {HTMLElement}  target  - Element with `data-action="editItem"`.
   * @returns {Promise<void>}
   */
  static async _onItemEdit(_event, target) {
    const li   = target.closest(".item");
    const id   = li?.dataset.id;
    const type = li?.dataset.type;
    if (!id || !type) return;

    const cw = game.chronicleWeaver;

    if (type === "spirit") {
      const spirit = cw.spirits.find(s => s.id === id);
      if (spirit) await ChronicleWeaverConfig._editSpirit.call(this, spirit);
    } else if (type === "soul") {
      const soul = cw.souls.find(s => s.id === id);
      if (soul) await ChronicleWeaverConfig._editSoul.call(this, soul);
    } else if (type === "grimoire") {
      const grimoire = cw.grimoires.find(g => g.id === id);
      if (grimoire) await ChronicleWeaverConfig._editGrimoire.call(this, grimoire);
    }
  }

  // ---------------------------------------------------------------------------
  // Edit dialogs (DialogV2)
  // ---------------------------------------------------------------------------

  /**
   * Opens a DialogV2 to edit a Spirit's fields or overwrite them from a
   * SillyTavern card JSON paste.
   *
   * @param {import('../models/Spirit.js').Spirit} spirit - The Spirit to edit.
   * @returns {Promise<void>}
   * @private
   */
  static async _editSpirit(spirit) {
    const esc     = ChronicleWeaverConfig._esc;
    const content = `
      <form class="cw-edit-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${esc(spirit.name)}" required>
        </div>
        <div class="form-group">
          <label>Accent Colour</label>
          <input type="color" name="color" value="${esc(spirit.color ?? "#ffffff")}" style="height:30px;width:100%;">
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
          <label>Import from JSON (SillyTavern Card)</label>
          <textarea name="json_import" rows="3" placeholder="Paste JSON here to overwrite fields…"></textarea>
        </div>
      </form>`;

    await DialogV2.prompt({
      window:  { title: `Edit Spirit: ${spirit.name}` },
      content,
      ok: {
        label:    "Save Spirit",
        icon:     "fas fa-save",
        callback: async (_ev, _btn, dialog) => {
          const q = name => dialog.querySelector(`[name="${name}"]`)?.value ?? "";

          const jsonText = q("json_import").trim();
          if (jsonText) {
            try {
              const parsed = JSON.parse(jsonText);
              const data   = ChronicleWeaverConfig._parseSillyTavernCard(parsed);
              spirit.updateSource({
                name:                      data.name                      || spirit.name,
                description:               data.description               || spirit.description,
                personality:               data.personality               || spirit.personality,
                scenario:                  data.scenario                  || spirit.scenario,
                system_prompt:             data.system_prompt             || spirit.system_prompt,
                first_message:             data.first_message             || spirit.first_message,
                post_history_instructions: data.post_history_instructions || spirit.post_history_instructions,
              });
              ui.notifications.info("Chronicle Weaver: Overwrote fields from JSON.");
            } catch {
              ui.notifications.warn("Chronicle Weaver: Invalid JSON — using form fields instead.");
              ChronicleWeaverConfig._applyFormToSpirit(spirit, q);
            }
          } else {
            ChronicleWeaverConfig._applyFormToSpirit(spirit, q);
          }

          await game.settings.set(
            MODULE_ID, "data_spirits",
            game.chronicleWeaver.spirits.map(s => s.toJSON())
          );
          this.render();
          ui.notifications.info(`Chronicle Weaver: Updated Spirit "${spirit.name}".`);
        },
      },
      rejectClose: false,
    });
  }

  /**
   * Applies raw form field values to a Spirit via `updateSource`.
   *
   * @param {import('../models/Spirit.js').Spirit} spirit - Target Spirit.
   * @param {Function} q - Value accessor: `name => string`.
   * @private
   */
  static _applyFormToSpirit(spirit, q) {
    spirit.updateSource({
      name:          q("name")          || spirit.name,
      color:         q("color")         || spirit.color,
      description:   q("description"),
      personality:   q("personality"),
      scenario:      q("scenario"),
      system_prompt: q("system_prompt"),
    });
  }

  /**
   * Opens a DialogV2 to edit a Soul's fields.
   *
   * @param {import('../models/Soul.js').Soul} soul - The Soul to edit.
   * @returns {Promise<void>}
   * @private
   */
  static async _editSoul(soul) {
    const esc     = ChronicleWeaverConfig._esc;
    const content = `
      <form class="cw-edit-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${esc(soul.name)}" required>
        </div>
        <div class="form-group">
          <label>Accent Colour</label>
          <input type="color" name="color" value="${esc(soul.color ?? "#ffffff")}" style="height:30px;width:100%;">
        </div>
        <div class="form-group">
          <label>Class</label>
          <input type="text" name="charClass" value="${esc(soul.attributes?.class ?? "")}">
        </div>
        <div class="form-group">
          <label>Level</label>
          <input type="number" name="level" value="${esc(soul.attributes?.level ?? 1)}">
        </div>
        <div class="form-group">
          <label>Backstory / Persona</label>
          <textarea name="description" rows="4">${esc(soul.description)}</textarea>
        </div>
        <hr>
        <div class="form-group">
          <label>Import from JSON (SillyTavern Card)</label>
          <textarea name="json_import" rows="3" placeholder="Paste JSON here to overwrite…"></textarea>
        </div>
      </form>`;

    await DialogV2.prompt({
      window:  { title: `Edit Soul: ${soul.name}` },
      content,
      ok: {
        label:    "Save Soul",
        icon:     "fas fa-save",
        callback: async (_ev, _btn, dialog) => {
          const q = name => dialog.querySelector(`[name="${name}"]`)?.value ?? "";

          const jsonText = q("json_import").trim();
          if (jsonText) {
            try {
              const parsed = JSON.parse(jsonText);
              const data   = ChronicleWeaverConfig._parseSillyTavernCard(parsed);
              soul.updateSource({
                name:        data.name        || soul.name,
                description: data.description || soul.description,
              });
              ui.notifications.info("Chronicle Weaver: Overwrote fields from JSON.");
            } catch {
              ui.notifications.warn("Chronicle Weaver: Invalid JSON — using form fields instead.");
              ChronicleWeaverConfig._applyFormToSoul(soul, q);
            }
          } else {
            ChronicleWeaverConfig._applyFormToSoul(soul, q);
          }

          await game.settings.set(
            MODULE_ID, "data_souls",
            game.chronicleWeaver.souls.map(s => s.toJSON())
          );
          this.render();
          ui.notifications.info(`Chronicle Weaver: Updated Soul "${soul.name}".`);
        },
      },
      rejectClose: false,
    });
  }

  /**
   * Applies raw form field values to a Soul via `updateSource`.
   * Note: field named `charClass` (not `class`) to avoid the reserved word.
   *
   * @param {import('../models/Soul.js').Soul} soul - Target Soul.
   * @param {Function} q - Value accessor: `name => string`.
   * @private
   */
  static _applyFormToSoul(soul, q) {
    soul.updateSource({
      name:        q("name")  || soul.name,
      color:       q("color") || soul.color,
      description: q("description"),
      attributes: {
        ...soul.attributes,
        class: q("charClass") || soul.attributes.class,
        level: parseInt(q("level"), 10) || soul.attributes.level,
      },
    });
  }

  /**
   * Opens a DialogV2 to edit a Grimoire's name and entries JSON.
   *
   * @param {import('../models/Grimoire.js').Grimoire} grimoire - The Grimoire to edit.
   * @returns {Promise<void>}
   * @private
   */
  static async _editGrimoire(grimoire) {
    const esc     = ChronicleWeaverConfig._esc;
    const content = `
      <form class="cw-edit-form">
        <div class="form-group">
          <label>Name</label>
          <input type="text" name="name" value="${esc(grimoire.name)}" required>
        </div>
        <div class="form-group">
          <label>JSON Entries</label>
          <textarea name="entries" rows="12" style="font-family:monospace;font-size:0.8em;">${esc(JSON.stringify(grimoire.entries, null, 2))}</textarea>
          <p class="notes">Format: <code>[{"uid":"id","keys":["key1"],"content":"text","enabled":true}]</code></p>
        </div>
      </form>`;

    await DialogV2.prompt({
      window:   { title: `Edit Grimoire: ${grimoire.name}`, resizable: true },
      content,
      position: { width: 640 },
      ok: {
        label:    "Save Grimoire",
        icon:     "fas fa-save",
        callback: async (_ev, _btn, dialog) => {
          const name       = dialog.querySelector('[name="name"]')?.value?.trim();
          const entriesRaw = dialog.querySelector('[name="entries"]')?.value ?? "";

          if (name) grimoire.updateSource({ name });

          try {
            const parsed = JSON.parse(entriesRaw);
            grimoire.updateSource({
              entries: parsed.map(e => ({
                ...e,
                uid:     e.uid    || foundry.utils.randomID(),
                enabled: e.enabled !== false,
              })),
            });
            await game.settings.set(
              MODULE_ID, "data_grimoires",
              game.chronicleWeaver.grimoires.map(g => g.toJSON())
            );
            this.render();
            ui.notifications.info(`Chronicle Weaver: Updated Grimoire "${grimoire.name}".`);
          } catch (err) {
            ui.notifications.error("Chronicle Weaver: Invalid JSON — changes NOT saved.");
            console.error(err);
          }
        },
      },
      rejectClose: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Actions — import file triggers
  // ---------------------------------------------------------------------------

  /**
   * Triggers the hidden Spirit file input.
   * @param {PointerEvent} _event - Click event.
   * @param {HTMLElement}  _target - Button element.
   */
  static _onImportSpiritPick(_event, _target) {
    this.element.querySelector("#import-spirit-file")?.click();
  }

  /**
   * Triggers the hidden Soul file input.
   * @param {PointerEvent} _event - Click event.
   * @param {HTMLElement}  _target - Button element.
   */
  static _onImportSoulPick(_event, _target) {
    this.element.querySelector("#import-soul-file")?.click();
  }

  /**
   * Triggers the hidden Grimoire file input.
   * @param {PointerEvent} _event - Click event.
   * @param {HTMLElement}  _target - Button element.
   */
  static _onImportGrimoirePick(_event, _target) {
    this.element.querySelector("#import-grimoire-file")?.click();
  }

  // ---------------------------------------------------------------------------
  // File change handlers (wired in _onRender)
  // ---------------------------------------------------------------------------

  /**
   * Handles the Spirit file input `change` event.
   *
   * @param {Event} ev - File input change event.
   * @returns {Promise<void>}
   */
  async _onImportSpirit(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const json       = JSON.parse(await file.text());
      const spiritData = ChronicleWeaverConfig._parseSillyTavernCard(json);
      game.chronicleWeaver.spirits.push(new game.chronicleWeaver.models.Spirit(spiritData));
      await game.settings.set(MODULE_ID, "data_spirits",
        game.chronicleWeaver.spirits.map(s => s.toJSON()));
      this.render();
      ui.notifications.info(`Chronicle Weaver: Imported Spirit "${spiritData.name}".`);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Chronicle Weaver: Failed to import Spirit — invalid JSON.");
    }
    ev.target.value = "";
  }

  /**
   * Handles the Soul file input `change` event.
   *
   * @param {Event} ev - File input change event.
   * @returns {Promise<void>}
   */
  async _onImportSoul(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const json    = JSON.parse(await file.text());
      const soulData = ChronicleWeaverConfig._parseSillyTavernCard(json);
      game.chronicleWeaver.souls.push(new game.chronicleWeaver.models.Soul(soulData));
      await game.settings.set(MODULE_ID, "data_souls",
        game.chronicleWeaver.souls.map(s => s.toJSON()));
      this.render();
      ui.notifications.info(`Chronicle Weaver: Imported Soul "${soulData.name}".`);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Chronicle Weaver: Failed to import Soul — invalid JSON.");
    }
    ev.target.value = "";
  }

  /**
   * Handles the Grimoire / Lorebook file input `change` event.
   *
   * @param {Event} ev - File input change event.
   * @returns {Promise<void>}
   */
  async _onImportGrimoire(ev) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const json         = JSON.parse(await file.text());
      const grimoireData = ChronicleWeaverConfig._parseSillyTavernLorebook(json);
      game.chronicleWeaver.grimoires.push(new game.chronicleWeaver.models.Grimoire(grimoireData));
      await game.settings.set(MODULE_ID, "data_grimoires",
        game.chronicleWeaver.grimoires.map(g => g.toJSON()));
      this.render();
      ui.notifications.info(`Chronicle Weaver: Imported Grimoire "${grimoireData.name}".`);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Chronicle Weaver: Failed to import Grimoire — invalid JSON.");
    }
    ev.target.value = "";
  }

  /**
   * Opens a DialogV2 actor picker and imports/links the selected Actor as a Soul.
   *
   * @param {PointerEvent} _event  - Click event.
   * @param {HTMLElement}  _target - Button element.
   * @returns {Promise<void>}
   */
  static async _onImportSoulFromActor(_event, _target) {
    const esc     = ChronicleWeaverConfig._esc;
    const options = game.actors.contents
      .map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`)
      .join("");

    await DialogV2.prompt({
      window:  { title: "Import Soul from Actor" },
      content: `
        <form>
          <div class="form-group">
            <label>Select Actor</label>
            <select id="cw-actor-select" style="width:100%;">${options}</select>
          </div>
        </form>`,
      ok: {
        label:    "Import",
        callback: async (_ev, _btn, dialog) => {
          const actorId = dialog.querySelector("#cw-actor-select")?.value;
          const actor   = actorId ? game.actors.get(actorId) : null;
          if (!actor) return;

          await actor.setFlag(MODULE_ID, "isPC", true);
          if (game.chronicleWeaver?.soulManager) {
            await game.chronicleWeaver.soulManager.updateFromActor(actor);
          }
          ui.notifications.info(`Chronicle Weaver: Imported/linked Soul for "${actor.name}".`);
          this.render();
        },
      },
      rejectClose: false,
    });
  }

  // ---------------------------------------------------------------------------
  // Static parsing helpers
  // ---------------------------------------------------------------------------

  /**
   * Parses a SillyTavern V1 or V2 character card JSON into Chronicle Weaver's
   * Spirit/Soul data format.
   *
   * Bug 2 fix: `post_history_instructions` is now mapped — previously it was
   * silently discarded on every card import even though the injection pipeline
   * was already wired to use it.
   *
   * @param {Object} json - Raw parsed JSON from the imported file.
   * @returns {Object} Normalised data suitable for `new Spirit(data)` or `new Soul(data)`.
   */
  static _parseSillyTavernCard(json) {
    const data = json.data ?? json; // V2 nests fields under `data`; V1 is flat.
    return {
      name:                      data.name            ?? "Unknown",
      description:               data.description     ?? data.persona ?? "",
      personality:               data.personality     ?? "",
      scenario:                  data.scenario        ?? "",
      first_message:             data.first_mes       ?? "",
      system_prompt:             data.system_prompt   ?? "",
      post_history_instructions: data.post_history_instructions ?? "",
    };
  }

  /**
   * Parses a SillyTavern Lorebook JSON file into Chronicle Weaver's Grimoire format.
   * Handles both array-format and keyed-object-format entry collections.
   *
   * @param {Object} json - Raw parsed JSON from the imported file.
   * @returns {Object} Normalised data suitable for `new Grimoire(data)`.
   */
  static _parseSillyTavernLorebook(json) {
    const raw    = json.entries ?? [];
    const source = Array.isArray(raw) ? raw : Object.values(raw);

    return {
      id:   foundry.utils.randomID(),
      name: json.name ?? "Imported Lorebook",
      entries: source.map(e => ({
        uid:     foundry.utils.randomID(),
        keys:    e.keys    ?? [],
        content: e.content ?? "",
        enabled: e.enabled !== false,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Utility
  // ---------------------------------------------------------------------------

  /**
   * Escapes a value for safe interpolation into an HTML attribute or text node.
   *
   * @param {*} str - Value to escape.
   * @returns {string} HTML-safe string.
   */
  static _esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
