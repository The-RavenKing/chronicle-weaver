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
        data.souls = game.chronicleWeaver.souls;
        data.grimoires = game.chronicleWeaver.grimoires;
        data.spirits = game.chronicleWeaver.spirits;
        data.activeSoul = game.settings.get('chronicle-weaver', 'activeSoul'); // Preserve existing data

        const pending = game.settings.get('chronicle-weaver', 'pending_entries') || [];
        data.pendingCount = pending.length;

        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);

        // Add listeners for adding/editing/deleting items
        html.find('.item-create').click(this._onItemCreate.bind(this));
        html.find('.item-delete').click(this._onItemDelete.bind(this));

        // Add Button for Review Queue if not present in template yet
        // Ideally we update the template, but we can also inject behavior if the button exists
        html.find('.open-review-queue').click((ev) => {
            new ReviewQueueApp().render(true);
        });
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const type = header.dataset.type;
        // Logic to create new Soul/Grimoire/Spirit
        console.log(`Creating new ${type}`);
    }

    async _onItemDelete(event) {
        event.preventDefault();
        const li = $(event.currentTarget).parents(".item");
        // Logic to delete item
        console.log(`Deleting item ${li.data("id")}`);
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
