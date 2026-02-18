/**
 * @file ReviewQueueApp.js
 * @description ApplicationV2 UI for the GM to review, edit, approve, or
 *   reject lore entries extracted by the LearningService before they are
 *   committed to a Grimoire.
 *
 *   V13: Extends `HandlebarsApplicationMixin(ApplicationV2)`.
 *   - No jQuery, no FormApplication.
 *   - All interactions use the declarative `data-action` system.
 */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "chronicle-weaver";

export class ReviewQueueApp extends HandlebarsApplicationMixin(ApplicationV2) {

  // ---------------------------------------------------------------------------
  // Application definition
  // ---------------------------------------------------------------------------

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "chronicle-weaver-review",
    window: {
      title: "Chronicle Weaver — Review Queue",
      resizable: true,
    },
    position: { width: 620, height: 540 },
    actions: {
      approve: ReviewQueueApp._onApprove,
      reject:  ReviewQueueApp._onReject,
    },
  };

  /** @override */
  static PARTS = {
    queue: {
      template: "modules/chronicle-weaver/templates/review-queue.html",
    },
  };

  // ---------------------------------------------------------------------------
  // Context
  // ---------------------------------------------------------------------------

  /**
   * Prepares the data passed to the Handlebars template.
   *
   * @param {object} _options - Render options (unused).
   * @returns {Promise<{pending: Object[]}>} Template context.
   * @override
   */
  async _prepareContext(_options = {}) {
    const pending = game.settings.get(MODULE_ID, "pending_entries") ?? [];
    return {
      pending: pending.map(e => ({
        ...e,
        keysDisplay: Array.isArray(e.keys) ? e.keys.join(", ") : String(e.keys ?? ""),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Actions (static; called with `this` = app instance via ApplicationV2)
  // ---------------------------------------------------------------------------

  /**
   * Approves a pending entry: validates user edits, pushes to the "Learned Lore"
   * Grimoire, and removes the entry from the pending queue.
   *
   * @param {PointerEvent} event  - The click event.
   * @param {HTMLElement}  target - The element bearing `data-action="approve"`.
   * @returns {Promise<void>}
   */
  static async _onApprove(event, target) {
    const item = target.closest(".review-item");
    const id   = item?.dataset.id;
    if (!id) return;

    const keysInput    = item.querySelector('input[name="keys"]');
    const contentInput = item.querySelector('textarea[name="content"]');

    const keys = (keysInput?.value ?? "")
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);
    const content = (contentInput?.value ?? "").trim();

    if (keys.length === 0) {
      ui.notifications.warn("Chronicle Weaver: Please enter at least one keyword before approving.");
      return;
    }
    if (!content) {
      ui.notifications.warn("Chronicle Weaver: Please enter a description before approving.");
      return;
    }

    try {
      let grimoire = game.chronicleWeaver.grimoires.find(g => g.name === "Learned Lore");
      if (!grimoire) {
        grimoire = new game.chronicleWeaver.models.Grimoire({ name: "Learned Lore" });
        game.chronicleWeaver.grimoires.push(grimoire);
      }

      grimoire.entries.push({
        uid:     foundry.utils.randomID(),
        keys,
        content,
        enabled: true,
      });

      // Persist grimoire first; only remove from pending once that succeeds.
      await game.settings.set(
        MODULE_ID, "data_grimoires",
        game.chronicleWeaver.grimoires.map(g => g.toJSON())
      );
      await ReviewQueueApp._removeFromPending.call(this, id);

      ui.notifications.info("Chronicle Weaver: Entry approved and added to Grimoire.");

    } catch (err) {
      console.error("Chronicle Weaver | Failed to approve entry:", err);
      ui.notifications.error("Chronicle Weaver: Failed to save entry. Please try again.");
    }
  }

  /**
   * Rejects and discards a pending entry permanently.
   *
   * @param {PointerEvent} event  - The click event.
   * @param {HTMLElement}  target - The element bearing `data-action="reject"`.
   * @returns {Promise<void>}
   */
  static async _onReject(event, target) {
    const item = target.closest(".review-item");
    const id   = item?.dataset.id;
    if (!id) return;

    try {
      await ReviewQueueApp._removeFromPending.call(this, id);
      ui.notifications.info("Chronicle Weaver: Entry rejected.");
    } catch (err) {
      console.error("Chronicle Weaver | Failed to reject entry:", err);
      ui.notifications.error("Chronicle Weaver: Failed to remove entry. Please try again.");
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Removes an entry from the pending queue by ID and re-renders the app.
   * Called with `this` bound to the ReviewQueueApp instance.
   *
   * @param {string} id - The entry's `id` field.
   * @returns {Promise<void>}
   * @private
   */
  static async _removeFromPending(id) {
    const current = game.settings.get(MODULE_ID, "pending_entries") ?? [];
    await game.settings.set(
      MODULE_ID, "pending_entries",
      current.filter(e => e.id !== id)
    );
    this.render();
  }
}
