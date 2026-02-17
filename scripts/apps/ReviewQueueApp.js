export class ReviewQueueApp extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "chronicle-weaver-review",
            title: "Chronicle Weaver - Review Queue",
            template: "modules/chronicle-weaver/templates/review-queue.html",
            width: 600,
            height: 500,
            resizable: true,
            closeOnSubmit: false
        });
    }

    getData() {
        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];
        const formatted = pending.map(e => ({
            ...e,
            keysDisplay: Array.isArray(e.keys) ? e.keys.join(', ') : e.keys
        }));
        return { pending: formatted };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.approve').click(async (ev) => {
            const el = $(ev.currentTarget).closest('.review-item');
            const id = el.data('id');
            const keys = el.find('input[name="keys"]').val().split(',').map(k => k.trim()).filter(k => k.length > 0);
            const content = el.find('textarea[name="content"]').val();

            if (keys.length === 0) {
                ui.notifications.warn('Chronicle Weaver: Please enter at least one keyword before approving.');
                return;
            }

            await this._approveEntry(id, keys, content);
        });

        html.find('.reject').click(async (ev) => {
            const el = $(ev.currentTarget).closest('.review-item');
            const id = el.data('id');
            await this._rejectEntry(id);
        });
    }

    async _approveEntry(id, keys, content) {
        try {
            // 1. Add to Grimoire
            let grimoire = game.chronicleWeaver.grimoires.find(g => g.name === "Learned Lore");
            if (!grimoire) {
                grimoire = new game.chronicleWeaver.models.Grimoire({ name: "Learned Lore" });
                game.chronicleWeaver.grimoires.push(grimoire);
            }

            grimoire.entries.push({
                uid: foundry.utils.randomID(), // Ensure ID consistency
                keys: keys,
                content: content,
                enabled: true
            });

            // Save Grimoires — must succeed before removing from pending
            const allGrimoires = game.chronicleWeaver.grimoires.map(g => g.toJSON());
            await game.settings.set('chronicle-weaver', 'data_grimoires', allGrimoires);

            // 2. Only remove from pending once grimoire save is confirmed
            await this._removeFromPending(id);

            ui.notifications.info("Chronicle Weaver: Entry approved and added to Grimoire.");
        } catch (err) {
            console.error("Chronicle Weaver | Failed to approve entry:", err);
            ui.notifications.error("Chronicle Weaver: Failed to save entry. Please try again.");
        }
    }

    async _rejectEntry(id) {
        try {
            await this._removeFromPending(id);
            ui.notifications.info("Chronicle Weaver: Entry rejected.");
        } catch (err) {
            console.error("Chronicle Weaver | Failed to reject entry:", err);
            ui.notifications.error("Chronicle Weaver: Failed to remove entry. Please try again.");
        }
    }

    async _removeFromPending(id) {
        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];
        const newPending = pending.filter(e => e.id !== id);
        await game.settings.set('chronicle-weaver', 'pending_entries', newPending);
        this.render();
    }

    async _updateObject(event, formData) {
        // Not used as we handle individual actions, but required by FormApplication
    }
}
