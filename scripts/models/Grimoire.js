/**
 * @file Grimoire.js
 * @description DataModel for a Lorebook / World-Info database (Grimoire).
 *   Grimoires hold keyword-triggered lore entries that are injected into the
 *   AI system prompt when their keys appear in recent chat history.
 *   Compatible with SillyTavern Lorebook JSON format.
 *
 *   V13: Extends `foundry.abstract.DataModel` for schema-based validation.
 */

const { StringField, NumberField, ArrayField, BooleanField, ObjectField } = foundry.data.fields;

export class Grimoire extends foundry.abstract.DataModel {

  /**
   * Defines the validated schema for Grimoire data.
   * Entries are stored as plain ObjectField items because their internal
   * shape varies across imported SillyTavern lorebooks.
   *
   * @returns {Object} The schema definition object.
   */
  static defineSchema() {
    return {
      id: new StringField({ required: true, blank: false, initial: () => foundry.utils.randomID() }),
      name: new StringField({ required: true, initial: "New Grimoire" }),
      description: new StringField({ initial: "" }),
      /** How many recent message turns to scan for keyword triggers. */
      scan_depth: new NumberField({ integer: true, initial: 2, min: 1 }),
      /** Approximate token budget for injected lore (informational). */
      token_budget: new NumberField({ integer: true, initial: 500, min: 0 }),
      recursive_scanning: new BooleanField({ initial: false }),
      /** Arbitrary SillyTavern extension metadata — preserved on import. */
      extensions: new ObjectField({ initial: {} }),
      /** Array of lore entry objects. Each entry has: uid, keys, content, enabled. */
      entries: new ArrayField(new ObjectField()),
    };
  }

  // ---------------------------------------------------------------------------
  // Scanning
  // ---------------------------------------------------------------------------

  /**
   * Scans `text` for keyword matches and returns all triggered lore entries,
   * de-duplicated and sorted by `order`.
   *
   * @param {string} text - The combined history + current prompt text to scan.
   * @returns {Object[]} Array of matching lore entry objects.
   */
  scan(text) {
    const lowerText = text.toLowerCase();
    const seen      = new Set();
    const matches   = [];

    for (const entry of this.entries) {
      if (!entry.enabled) continue;
      if (!Array.isArray(entry.keys) || entry.keys.length === 0) continue;

      // Primary key check — any single match is sufficient.
      const primaryMatched = entry.keys.some(k => lowerText.includes(k.toLowerCase()));
      if (!primaryMatched) continue;

      // Optional secondary key check — at least one secondary key must also match.
      if (Array.isArray(entry.secondary_keys) && entry.secondary_keys.length > 0) {
        const secondaryMatched = entry.secondary_keys.some(k => lowerText.includes(k.toLowerCase()));
        if (!secondaryMatched) continue;
      }

      const entryKey = entry.uid ?? `__idx_${this.entries.indexOf(entry)}`;
      if (seen.has(entryKey)) continue;

      matches.push(entry);
      seen.add(entryKey);
    }

    return matches.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  // ---------------------------------------------------------------------------
  // Serialisation
  // ---------------------------------------------------------------------------

  /**
   * Serialises this Grimoire to a plain object suitable for `game.settings.set`.
   *
   * @returns {Object} Plain serialisable representation of this Grimoire.
   */
  toJSON() {
    return this.toObject();
  }
}
