import { ChatService } from './services/ChatService.js';
import { LearningService } from './services/LearningService.js';
import { Grimoire } from './models/Grimoire.js';
import { Soul } from './models/Soul.js';
import { Spirit } from './models/Spirit.js';
import { ChronicleWeaverConfig } from './apps/ChronicleWeaverConfig.js';

console.log("Chronicle Weaver | Loading...");

// Ensure MODULE_ID is available globally within the module scope
const MODULE_ID = 'chronicle-weaver';

Hooks.once('init', () => {
    console.log("Chronicle Weaver | Initializing settings...");
    registerSettings();

    // --------------------------------------------------------
    // METHOD 1: Sidebar Context Menu (Reliable Fallback)
    // --------------------------------------------------------
    Hooks.on('getActorDirectoryEntryContext', (html, options) => {
        options.push({
            name: "CW: Toggle PC Status",
            icon: '<i class="fas fa-scroll"></i>',
            condition: (li) => {
                const actorId = li.data("documentId");
                const actor = game.actors.get(actorId);
                return game.user.isGM && actor;
            },
            callback: async (li) => {
                const actorId = li.data("documentId");
                const actor = game.actors.get(actorId);
                const isPC = actor.getFlag(MODULE_ID, 'isPC') || false;

                await actor.setFlag(MODULE_ID, 'isPC', !isPC);

                if (!isPC) {
                    ui.notifications.info(`Chronicle Weaver: ${actor.name} marked as PC.`);
                    if (game.chronicleWeaver?.soulManager) {
                        await game.chronicleWeaver.soulManager.updateFromActor(actor);
                    }
                } else {
                    ui.notifications.info(`Chronicle Weaver: ${actor.name} un-marked.`);
                }
            }
        });
    });

    // --------------------------------------------------------
    // METHOD 2: Classic Hook Injection (Standard Sheets)
    // --------------------------------------------------------
    const hookNames = [
        'getCharacterActorSheetHeaderButtons',
        'getActorSheetHeaderButtons',
        'getActorSheet5eCharacterHeaderButtons',
        'getApplicationHeaderButtons'
    ];

    hookNames.forEach(hookName => {
        Hooks.on(hookName, (app, buttons) => {
            // Use user-defined classes + standard ones
            const allowedClasses = game.settings.get(MODULE_ID, 'supportedSheetClasses').split(',').map(c => c.trim());
            allowedClasses.push('ActorSheet', 'ActorSheet5eCharacter');

            const appClass = app.constructor?.name;

            // Check if class is allowed or if it inherits from Actor
            let isTarget = false;
            if (allowedClasses.includes(appClass)) isTarget = true;
            if (app.document instanceof Actor) isTarget = true;

            if (!isTarget) return;

            handleHeaderButtons(app, buttons).catch(err => console.error("Chronicle Weaver | handleHeaderButtons error:", err));
        });
    });

    // --------------------------------------------------------
    // METHOD 3: DOM Injection (AppV2 / Non-Standard Sheets)
    // --------------------------------------------------------
    Hooks.on('renderApplication', (app, html, data) => {
        // Fallback for new sheets that don't trigger header buttons hook
        if (!game.user.isGM) return;
        const actor = app.document || app.object || app.actor;
        if (!actor || !(actor instanceof Actor)) return;

        // Dedup: Check if button already exists in DOM
        // Note: html might be the window OR content depending on app type.
        // We look broadly.
        const appElement = app.element && app.element[0] ? app.element : html;

        // Try to find header window
        const windowHeader = appElement.closest('.window-app')?.find('.window-header');

        if (windowHeader && windowHeader.length > 0) {
            if (windowHeader.find('.cw-pc-toggle').length === 0) {
                // console.log("Chronicle Weaver | Injecting DOM button for", app.title);
                const isPC = actor.getFlag(MODULE_ID, 'isPC') || false;
                // Insert before close button (usually last)
                const title = windowHeader.find('.window-title');
                const btn = $(`<a class="header-control cw-pc-toggle" title="CW: Toggle PC"><i class="${isPC ? 'fas fa-check-square' : 'far fa-square'}"></i> CW</a>`);

                btn.on('click', async () => {
                    // Read current state fresh from actor each click to avoid stale closure
                    const currentState = actor.getFlag(MODULE_ID, 'isPC') || false;
                    const newState = !currentState;
                    await actor.setFlag(MODULE_ID, 'isPC', newState);
                    btn.find('i').attr('class', newState ? 'fas fa-check-square' : 'far fa-square');

                    if (newState) {
                        ui.notifications.info(`Chronicle Weaver: ${actor.name} marked as PC.`);
                        if (game.chronicleWeaver?.soulManager) {
                            game.chronicleWeaver.soulManager.updateFromActor(actor);
                        }
                    } else {
                        ui.notifications.info(`Chronicle Weaver: ${actor.name} un-marked.`);
                    }
                });

                // Insert after title
                title.after(btn);
            }
        }
    });

    // Handle the button insertion logic (Internal helper)
    async function handleHeaderButtons(app, buttons) {
        if (buttons.find(b => b.class === 'cw-pc-toggle')) return;

        const actor = app.actor || app.document || app.object;
        if (!actor || !(actor instanceof Actor)) return;
        if (!game.user.isGM) return;

        const isPC = actor.getFlag(MODULE_ID, 'isPC') || false;
        buttons.unshift({
            label: "CW: PC",
            class: "cw-pc-toggle",
            icon: isPC ? 'fas fa-check-square' : 'far fa-square',
            onclick: async (ev) => {
                // Read fresh state from actor to avoid stale closure
                const currentState = actor.getFlag(MODULE_ID, 'isPC') || false;
                const newState = !currentState;
                await actor.setFlag(MODULE_ID, 'isPC', newState);
                app.render(); // Re-render to update icon
                if (newState) {
                    ui.notifications.info(`Chronicle Weaver: ${actor.name} marked as PC.`);
                    if (game.chronicleWeaver?.soulManager) {
                        await game.chronicleWeaver.soulManager.updateFromActor(actor);
                    }
                } else {
                    ui.notifications.info(`Chronicle Weaver: ${actor.name} un-marked.`);
                }
            }
        });
    }
});

Hooks.once('ready', async () => {
    console.log("Chronicle Weaver | Ready!");

    game.chronicleWeaver = {
        chatService: new ChatService(),
        learningService: new LearningService(),
        models: { Grimoire, Soul, Spirit },
        grimoires: [],
        souls: [],
        spirits: []
    };

    // Add SoulManager helper
    game.chronicleWeaver.soulManager = {
        updateFromActor: async (actor) => {
            console.log(`Chronicle Weaver | Syncing Soul for ${actor.name}`);
            const souls = game.chronicleWeaver.souls;
            const existingIndex = souls.findIndex(s => s.foundry_actor_id === actor.id);

            if (actor.getFlag(MODULE_ID, 'isPC')) {
                const soulData = {
                    // Preserve existing ID if updating, generate new one only for new entries
                    id: existingIndex >= 0 ? souls[existingIndex].id : foundry.utils.randomID(),
                    name: actor.name,
                    foundry_actor_id: actor.id,
                    attributes: {
                        class: actor.items.find(i => i.type === 'class')?.name || "Unknown",
                        level: actor.system.details?.level || 1,
                    }
                };
                if (existingIndex >= 0) {
                    souls[existingIndex] = new Soul(soulData);
                } else {
                    souls.push(new Soul(soulData));
                }
                // Save
                await game.settings.set(MODULE_ID, 'data_souls', souls.map(s => s.toJSON()));
            } else {
                // Remove
                if (existingIndex >= 0) {
                    souls.splice(existingIndex, 1);
                    await game.settings.set(MODULE_ID, 'data_souls', souls.map(s => s.toJSON()));
                }
            }
        }
    };

    await loadData();

    // Auto-respond to chat messages
    Hooks.on('createChatMessage', async (message, options, userId) => {
        if (userId !== game.user.id) return;

        const autoWeave = game.settings.get(MODULE_ID, 'autoWeave');
        if (!autoWeave) return;

        // Check if message is from AI
        if (message.getFlag(MODULE_ID, 'isAI')) return;

        // Only respond to IC speech (0), emotes (1), OOC (2) - ignore rolls, system messages etc.
        if (![0, 1, 2].includes(message.type)) return;

        // Setup Context
        const activeSpiritId = game.settings.get(MODULE_ID, 'activeSpirit');
        const activeSpirit = game.chronicleWeaver.spirits.find(s => s.id === activeSpiritId);

        const activeSouls = game.chronicleWeaver.souls.filter(s => {
            if (!s.foundry_actor_id) return false;
            return game.actors.get(s.foundry_actor_id) !== undefined;
        });

        // Build history
        const historyDepth = game.settings.get(MODULE_ID, 'historyDepth');
        const history = game.messages.contents
            .filter(m => m.id !== message.id && [0, 1, 2].includes(m.type))
            .slice(-historyDepth)
            .map(m => ({
                role: m.getFlag(MODULE_ID, 'isAI') ? 'assistant' : 'user',
                content: `${m.speaker.alias || 'Unknown'}: ${m.content}`
            }));

        const prompt = `${message.speaker.alias || 'User'}: ${message.content}`;

        const response = await game.chronicleWeaver.chatService.generateResponse(prompt, {
            spirit: activeSpirit,
            grimoires: game.chronicleWeaver.grimoires,
            souls: activeSouls,
            history: history
        });

        if (response) {
            const aiName = activeSpirit ? activeSpirit.name : "Narrator";
            await ChatMessage.create({
                content: response,
                speaker: { alias: aiName },
                type: 0, // CONST.CHAT_MESSAGE_TYPES.OTHER
                flags: {
                    [MODULE_ID]: { isAI: true }
                }
            });
        }
    });

    // Register chat commands
    Hooks.on('chatMessage', handleChatCommand);
}); // End of Hooks.once('ready')

async function loadData() {
    console.log("Chronicle Weaver | Loading data from settings...");

    // SPIRITS (AI Personas) - was data_spirits
    let spiritData = game.settings.get(MODULE_ID, 'data_spirits');
    game.chronicleWeaver.spirits = spiritData.map(d => new Spirit(d));

    // SOULS (PC Personas) - renamed from 'data_spirits' to 'data_souls' in v2
    let soulData = game.settings.get(MODULE_ID, 'data_souls');
    game.chronicleWeaver.souls = soulData.map(d => new Soul(d));

    // GRIMOIRES
    let grimoireData = game.settings.get(MODULE_ID, 'data_grimoires');
    game.chronicleWeaver.grimoires = grimoireData.map(d => new Grimoire(d));

    console.log(`Chronicle Weaver | Loaded ${game.chronicleWeaver.spirits.length} Spirits (AI), ${game.chronicleWeaver.souls.length} Souls (PC), ${game.chronicleWeaver.grimoires.length} Grimoires.`);
}

function registerSettings() {
    game.settings.register(MODULE_ID, 'autoWeave', {
        name: 'Auto-Weaving',
        hint: 'If enabled, the AI will automatically reply to chat messages.',
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'supportedSheetClasses', {
        name: 'Supported Sheet Classes',
        hint: 'Comma-separated list of sheet class names (e.g. ActorSheet5eCharacter, CharacterActorSheet) to target for buttons if they don\'t appear automatically.',
        scope: 'world',
        config: true,
        type: String,
        default: 'CharacterActorSheet, ActorSheet5eCharacter2, ActorSheet5eCharacter'
    });

    game.settings.register(MODULE_ID, 'ollamaUrl', {
        name: 'Ollama URL',
        hint: 'URL where Ollama is running. use "Manage Souls & Grimoires" above to Test Connection.',
        scope: 'world',
        config: true,
        type: String,
        default: 'http://localhost:11434'
    });

    game.settings.register(MODULE_ID, 'ollamaModel', {
        name: 'Reader/Main Model',
        hint: 'Model used for chat. Use "Manage Souls & Grimoires" to select from list.',
        scope: 'world',
        config: true,
        type: String,
        default: 'llama2:7b'
    });

    game.settings.register(MODULE_ID, 'coderModel', {
        name: 'Coder Model',
        hint: 'Model used for data. Use "Manage Souls & Grimoires" to select from list.',
        scope: 'world',
        config: true,
        type: String,
        default: 'qwen2.5-coder:7b'
    });

    game.settings.register(MODULE_ID, 'lastProcessedMessageId', {
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE_ID, 'historyDepth', {
        name: 'Conversation History Depth',
        hint: 'How many recent messages to include in AI context (default 10)',
        scope: 'world',
        config: true,
        type: Number,
        default: 10,
        range: { min: 5, max: 30, step: 5 }
    });

    game.settings.register(MODULE_ID, 'pending_entries', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'activeSpirit', { // AI Persona
        name: 'Active Spirit',
        hint: 'The Spirit currently controlling the AI narrator.',
        scope: 'world',
        config: true,
        type: String,
        default: '',
        onChange: value => {
            console.log("Chronicle Weaver | Active Spirit changed to:", value);
        }
    });

    // Data Settings
    game.settings.register(MODULE_ID, 'data_spirits', { // AI Personas 
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'data_souls', { // PC Personas
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'data_grimoires', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register(MODULE_ID, 'ollamaContextModels', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.registerMenu(MODULE_ID, "config", {
        name: "Chronicle Weaver Management",
        label: "Manage Souls & Grimoires",
        hint: "Configure your Grimoires, Souls, and Spirits.",
        icon: "fas fa-book-spells",
        type: ChronicleWeaverConfig,
        restricted: true
    });
}

async function handleChatCommand(chatLog, message, chatData) {
    const msg = message.trim();

    if (msg.startsWith('/cw reset')) {
        await game.settings.set(MODULE_ID, 'lastProcessedMessageId', '');
        await game.settings.set(MODULE_ID, 'pending_entries', []);
        ui.notifications.info("Chronicle Weaver: Reset complete. Learning marker and pending entries cleared.");
        return false;
    }

    if (msg.startsWith('/cw learn')) {
        ui.notifications.info("Chronicle Weaver: Starting learning process...");
        await game.chronicleWeaver.learningService.learnFromChat();
        return false;
    }

    return true;
}
