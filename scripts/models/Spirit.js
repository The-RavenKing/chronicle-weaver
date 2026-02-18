/**
 * @file Spirit.js
 * @description DataModel for an AI Narrator Persona (Spirit).
 *   Spirits define the personality, scenario, and system prompt that shape
 *   how the Ollama model responds in chat. Compatible with SillyTavern V1/V2
 *   character card formats.
 *
 *   V13: Extends `foundry.abstract.DataModel` for schema-based validation.
 */

const { StringField, ArrayField, ObjectField } = foundry.data.fields;

export class Spirit extends foundry.abstract.DataModel {

  /**
   * Defines the validated schema for Spirit data.
   *
   * @returns {Object} The schema definition object.
   */
  static defineSchema() {
    return {
      id: new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
      name: new StringField({ required: true, initial: "New Spirit" }),
      /** Primary character description / base system prompt content. */
      description: new StringField({ initial: "You are a helpful assistant." }),
      personality:    new StringField({ initial: "" }),
      scenario:       new StringField({ initial: "" }),
      first_message:  new StringField({ initial: "" }),
      /** SillyTavern example dialogue block. */
      mes_example:    new StringField({ initial: "" }),
      creator_notes:  new StringField({ initial: "" }),
      /**
       * Explicit system prompt override. When set, replaces description +
       * personality + scenario in `getSystemPrompt()`.
       */
      system_prompt: new StringField({ initial: "" }),
      /**
       * SillyTavern post-history instruction block. Injected into the message
       * array AFTER conversation history and BEFORE the current user turn, to
       * re-assert character instructions that may drift in long sessions.
       */
      post_history_instructions: new StringField({ initial: "" }),
      tags:              new ArrayField(new StringField()),
      creator:           new StringField({ initial: "" }),
      character_version: new StringField({ initial: "" }),
      /** Arbitrary extension data from SillyTavern cards — preserved on import. */
      extensions: new ObjectField({ initial: {} }),
      /** Per-Spirit chat bubble accent colour (hex string). */
      color: new StringField({ initial: "#ffffff" }),
    };
  }

  // ---------------------------------------------------------------------------
  // Prompt assembly
  // ---------------------------------------------------------------------------

  /**
   * Builds the system prompt string sent to Ollama.
   * Uses the explicit `system_prompt` override if provided; otherwise
   * concatenates description, personality, and scenario.
   *
   * @returns {string} The assembled system prompt.
   */
  getSystemPrompt() {
    let prompt = this.system_prompt || this.description;
    if (this.personality) prompt += `\n\nPersonality:\n${this.personality}`;
    if (this.scenario)    prompt += `\n\nScenario:\n${this.scenario}`;
    return prompt;
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  /**
   * Serialises this Spirit to a plain object suitable for `game.settings.set`.
   *
   * @returns {Object} Plain serialisable representation of this Spirit.
   */
  toJSON() {
    return this.toObject();
  }
}
