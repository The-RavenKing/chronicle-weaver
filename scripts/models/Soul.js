/**
 * @file Soul.js
 * @description DataModel for a Player Character Persona (Soul).
 *   Souls are synced from Foundry Actors and injected into the AI context
 *   to give the model awareness of the party's composition and backstory.
 *
 *   V13: Extends `foundry.abstract.DataModel` for schema-based validation,
 *   replacing the manual property-assignment constructor pattern.
 */

const { StringField, NumberField, ArrayField, SchemaField } = foundry.data.fields;

export class Soul extends foundry.abstract.DataModel {

  /**
   * Defines the validated schema for Soul data.
   * Foundry will coerce and validate all fields on construction and `updateSource()`.
   *
   * @returns {Object} The schema definition object.
   */
  static defineSchema() {
    return {
      id: new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
      name: new StringField({ required: true, initial: "New Soul" }),
      description: new StringField({ initial: "" }),
      personality: new StringField({ initial: "" }),
      /** Opening/intro message — maps from SillyTavern `first_message`. */
      intro: new StringField({ initial: "" }),
      scenario: new StringField({ initial: "" }),
      /** Example dialogue — maps from SillyTavern `mes_example`. */
      example_dialogue: new StringField({ initial: "" }),
      background: new StringField({ initial: "" }),

      attributes: new SchemaField({
        class:      new StringField({ initial: "Unknown" }),
        subclass:   new StringField({ initial: "" }),
        level:      new NumberField({ integer: true, initial: 1, min: 1 }),
        race:       new StringField({ initial: "Unknown" }),
        background: new StringField({ initial: "" }),
      }),

      stats: new SchemaField({
        hp: new SchemaField({
          current: new NumberField({ integer: true, initial: 10, min: 0 }),
          max:     new NumberField({ integer: true, initial: 10, min: 0 }),
        }),
        ac: new NumberField({ integer: true, initial: 10, min: 0 }),
      }),

      equipment: new ArrayField(new StringField()),
      gold: new NumberField({ initial: 0, min: 0 }),

      /** Nullable — a manually-imported Soul may have no linked Actor. */
      foundry_actor_id: new StringField({ nullable: true, initial: null }),
      user_id:          new StringField({ nullable: true, initial: null }),

      /** Per-character chat bubble accent colour (hex string). */
      color: new StringField({ initial: "#ffffff" }),
    };
  }

  // ---------------------------------------------------------------------------
  // Presentation
  // ---------------------------------------------------------------------------

  /**
   * Builds a single-line persona summary injected into the AI system prompt.
   *
   * @returns {string} e.g. "Aldric (Human Paladin 5, HP: 32/45): A brooding knight…"
   */
  getPersonaBlock() {
    const summary = `${this.name} (${this.attributes.race} ${this.attributes.class} ${this.attributes.level}, HP: ${this.stats.hp.current}/${this.stats.hp.max})`;
    const details = [this.description, this.personality, this.background]
      .filter(Boolean)
      .join(" ");
    return `${summary}: ${details}`;
  }

  // ---------------------------------------------------------------------------
  // Actor sync
  // ---------------------------------------------------------------------------

  /**
   * Populates this Soul's fields from a live Foundry Actor document.
   * Focused on D&D 5e but falls back gracefully for other systems.
   *
   * @param {Actor} actor - The Foundry Actor document to sync from.
   * @returns {void}
   */
  syncFromActor(actor) {
    const sys = actor.system;

    const race =
      actor.items.find(i => i.type === "race")?.name ??
      sys.details?.race ??
      "Unknown";

    let charClass = "Unknown";
    let level = 1;
    if (actor.classes && Object.keys(actor.classes).length > 0) {
      charClass = Object.values(actor.classes)
        .map(c => `${c.name} ${c.system.levels}`)
        .join("/");
      level = sys.details?.level ?? 1;
    } else {
      charClass = sys.details?.class ?? "Unknown";
      level     = sys.details?.level ?? 1;
    }

    const background =
      sys.details?.background?.name ?? sys.details?.background ?? "";

    const bio = !this.description
      ? (sys.details?.biography?.value?.replace(/<[^>]*>/gm, "") ?? "")
      : this.description;

    const equipment = actor.items
      .filter(i => ["weapon", "equipment", "tool"].includes(i.type))
      .filter(i => i.system?.equipped)
      .map(i => i.name);

    this.updateSource({
      name:             actor.name,
      foundry_actor_id: actor.id,
      description:      bio,
      background,
      attributes: { race, class: charClass, level, background },
      stats: {
        hp: {
          current: sys.attributes?.hp?.value ?? 0,
          max:     sys.attributes?.hp?.max   ?? 0,
        },
        ac: sys.attributes?.ac?.value ?? 10,
      },
      equipment,
      gold: sys.currency?.gp ?? this.gold,
    });
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  /**
   * Serialises this Soul to a plain object suitable for `game.settings.set`.
   *
   * @returns {Object} Plain serialisable representation of this Soul.
   */
  toJSON() {
    return this.toObject();
  }
}
