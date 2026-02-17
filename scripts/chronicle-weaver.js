import { ChatService } from './services/ChatService.js';
import { LearningService } from './services/LearningService.js';
import { Grimoire } from './models/Grimoire.js';
import { Soul } from './models/Soul.js';
import { Spirit } from './models/Spirit.js';
import { ChronicleWeaverConfig } from './apps/ChronicleWeaverConfig.js';

console.log("Chronicle Weaver | Loading...");

Hooks.once('init', () => {
    console.log("Chronicle Weaver | Initializing settings...");
    registerSettings();
});

Hooks.once('ready', async () => {
    console.log("Chronicle Weaver | Ready!");

    // Initialize services
    game.chronicleWeaver = {
        chatService: new ChatService(),
        learningService: new LearningService(),
        models: {
            Grimoire,
            Soul,
            Spirit
        },
        // Storage for runtime data
        grimoires: [],
        souls: [],
        spirits: []
    };

    // Load data
    loadData();

    // Hook into Chat creation for seamless weaving
    Hooks.on('createChatMessage', async (message, options, userId) => {
        if (userId !== game.user.id) return; // Only process for the user who sent it
        if (!game.settings.get('chronicle-weaver', 'autoWeaving')) return; // Check if active

        const aiName = "Chronicle Weaver"; // TODO: Get from active Soul
        if (message.speaker.alias === aiName) return;

        // Ignore rolls/system messages, only reply to speech/emotes/ooc
        if (![0, 1, 2].includes(message.type)) return;

        // -- CHANGED: REMOVED Scene/Token scanning loop per Issue 5 --

        // Gather Context
        // 1. Spirits (Active Player Characters)
        // Find all Spirits that are linked to actors owned by active users
        const activeSpirits = game.chronicleWeaver.spirits.filter(s => {
            if (!s.foundry_actor_id) return false;
            const actor = game.actors.get(s.foundry_actor_id);
            if (!actor) return false;
            // Check if actor has an active user
            // Or just allow all spirits that are PCs. Issue 5 says "Active Spirit personas (player characters who are logged in)"
            // For now, let's include all spirits that we know are PCs.
            return true;
        });

        // 2. Chat History
        const historyDepth = game.settings.get('chronicle-weaver', 'historyDepth');
        const history = game.messages.contents
            .filter(m => [0, 1, 2].includes(m.type) && m.id !== message.id) // Filter valid types, exclude current
            .slice(-historyDepth) // Get last N
            .map(m => ({
                role: m.getFlag('chronicle-weaver', 'isAI') ? 'assistant' : 'user',
                content: `${m.speaker.alias || 'Unknown'}: ${m.content}`
            }));

        const prompt = `${message.speaker.alias || 'User'}: ${message.content}`;
        console.log("Chronicle Weaver | Auto-responding to:", prompt);

        const response = await game.chronicleWeaver.chatService.generateResponse(prompt, {
            soul: game.chronicleWeaver.souls.find(s => s.id === game.settings.get('chronicle-weaver', 'activeSoul')) || new Soul({ name: "GM", description: "You are a Game Master." }),
            grimoires: game.chronicleWeaver.grimoires,
            spirits: activeSpirits,
            history: history
        });

        if (response) {
            ChatMessage.create({
                content: response,
                speaker: { alias: aiName }, // TODO: Alias should probably be the Soul name
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        }
    });

    // Inject "Is Player Character" checkbox into Actor Sheet
    Hooks.on('renderActorSheet', (app, html, data) => {
        const actor = app.actor;
        const isPC = actor.getFlag('chronicle-weaver', 'isPC') || false;

        const toggleHTML = `
            <div class="chronicle-weaver-pc-toggle" style="display: flex; align-items: center; margin-right: 10px;">
                <label class="checkbox">
                    <input type="checkbox" class="cw-is-pc" ${isPC ? "checked" : ""}>
                    Chronicle Weaver: Is Player Character?
                </label>
            </div>
        `;

        // Insert into the header (adjust selector as needed for specific systems, specific to dnd5e initially but trying to be generic)
        // Common generic place is the window header or near the name input
        let target = html.find('input[name="name"]');
        if (target.length === 0) target = html.find('.window-title');

        if (target.length > 0) {
            const toggle = $(toggleHTML);
            target.parent().after(toggle);

            // Activate listener
            toggle.find('.cw-is-pc').change(async (ev) => {
                const checked = ev.currentTarget.checked;
                await actor.setFlag('chronicle-weaver', 'isPC', checked);
                console.log(`Chronicle Weaver | Set ${actor.name} isPC to ${checked}`);

                if (checked) {
                    // Auto-create/Link Spirit
                    await SpiritManager.createFromActor(actor);
                }
            });
        }
    });

    // Inject "Is Player Character" checkbox into Actor Sheet
    Hooks.on('renderActorSheet', (app, html, data) => {
        // ... (Existing code) ...
    });

    // Hook into actor updates for auto-sync
    Hooks.on('updateActor', async (actor, changes) => {
        if (!actor.getFlag('chronicle-weaver', 'isPC')) return;
        await SpiritManager.syncFromActor(actor);
    });

    // Register Chat Command handler
    Hooks.on('chatMessage', handleChatCommand);
});

// Helper for Spirit Management
class SpiritManager {
    static async createFromActor(actor) {
        // ... (Existing code) ...
    }
    // ... (Existing code) ...
}

function registerSettings() {
    // ... (Existing code) ...
}

async function handleChatCommand(message, chatData) {
    const msg = message.trim();
    if (msg.startsWith('/cw reset')) {
        // Implement reset if needed
        return false;
    }
    if (msg.startsWith('/cw learn')) {
        ui.notifications.info("Chronicle Weaver: Starting learning process...");
        await game.chronicleWeaver.learningService.learnFromChat();
        return false;
    }
    return true;
}
// Check if Spirit exists
let spirit = game.chronicleWeaver.spirits.find(s => s.foundry_actor_id === actor.id);

if (!spirit) {
    // Check by name as fallback
    spirit = game.chronicleWeaver.spirits.find(s => s.name === actor.name);
    if (spirit) {
        // Link it
        spirit.foundry_actor_id = actor.id;
    } else {
        // Create new
        spirit = new game.chronicleWeaver.models.Spirit();
        game.chronicleWeaver.spirits.push(spirit);
    }
}

// Sync data
spirit.syncFromActor(actor);

// Try to set User ID (Owner)
const owner = Object.entries(actor.ownership).find(([id, level]) => level === 3 && !game.users.get(id)?.isGM);
if (owner) spirit.user_id = owner[0];

// Save
await this.saveSpirits();
ui.notifications.info(`Chronicle Weaver: Synced Spirit for ${actor.name}`);
    }

    static async syncFromActor(actor) {
    const spirit = game.chronicleWeaver.spirits.find(s => s.foundry_actor_id === actor.id);
    if (spirit) {
        spirit.syncFromActor(actor);
        await this.saveSpirits();
    }
}

    static async saveSpirits() {
    const data = game.chronicleWeaver.spirits.map(s => s.toJSON());
    await game.settings.set('chronicle-weaver', 'data_spirits', data);
}
}

function registerSettings() {
    game.settings.register('chronicle-weaver', 'autoWeaving', {
        name: 'Auto-Weaving',
        hint: 'If enabled, the AI will automatically reply to chat messages.',
        scope: 'client', // Client-side setting so each user can toggle their own interaction
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register('chronicle-weaver', 'ollamaUrl', {
        name: 'Ollama URL',
        hint: 'URL where Ollama is running',
        scope: 'world',
        config: true,
        type: String,
        default: 'http://localhost:11434'
    });

    game.settings.register('chronicle-weaver', 'ollamaModel', {
        name: 'Reader/Main Model',
        hint: 'Model used for chat and reading logs (e.g., llama3.1)',
        scope: 'world',
        config: true,
        type: String,
        default: 'llama2:7b'
    });

    game.settings.register('chronicle-weaver', 'coderModel', {
        name: 'Coder Model',
        hint: 'Model used for structuring data updates (e.g., qwen2.5-coder)',
        scope: 'world',
        config: true,
        type: String,
        default: 'qwen2.5-coder:7b'
    });

    game.settings.register('chronicle-weaver', 'lastProcessedMessageId', {
        scope: 'world',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register('chronicle-weaver', 'historyDepth', {
        name: 'Conversation History Depth',
        hint: 'How many recent messages to include in AI context (default 10)',
        scope: 'world',
        config: true,
        type: Number,
        default: 10,
        range: { min: 5, max: 30, step: 5 }
    });

    game.settings.register('chronicle-weaver', 'pending_entries', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register('chronicle-weaver', 'activeSoul', {
        name: 'Active Soul',
        hint: 'The Persona currently controlling the AI.',
        scope: 'world',
        config: true,
        type: String, // Store ID/Name
        default: 'default'
    });

    // Hidden settings for data storage
    game.settings.register('chronicle-weaver', 'data_souls', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register('chronicle-weaver', 'data_grimoires', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.register('chronicle-weaver', 'data_spirits', {
        scope: 'world',
        config: false,
        type: Array,
        default: []
    });

    game.settings.registerMenu("chronicle-weaver", "config", {
        name: "Chronicle Weaver Management",
        label: "Manage Souls & Grimoires",
        hint: "Configure your Grimoires (Lorebooks), Souls (Personas), and Spirits (Characters).",
        icon: "fas fa-book-spells",
        type: ChronicleWeaverConfig,
        restricted: true
    });
}

function loadData() {
    console.log("Chronicle Weaver | Loading data from settings...");

    const savedSouls = game.settings.get('chronicle-weaver', 'data_souls') || [];
    const savedGrimoires = game.settings.get('chronicle-weaver', 'data_grimoires') || [];
    const savedSpirits = game.settings.get('chronicle-weaver', 'data_spirits') || [];

    game.chronicleWeaver.souls = savedSouls.map(data => new Soul(data));
    game.chronicleWeaver.grimoires = savedGrimoires.map(data => new Grimoire(data));
    game.chronicleWeaver.spirits = savedSpirits.map(data => new Spirit(data));

    console.log(`Chronicle Weaver | Loaded ${game.chronicleWeaver.souls.length} Souls, ${game.chronicleWeaver.grimoires.length} Grimoires, ${game.chronicleWeaver.spirits.length} Spirits.`);
}

async function handleChatCommand(message, chatData) {
    // Keep this for administrative commands if needed in the future
    const msg = message.trim();
    if (msg.startsWith('/cw reset')) {
        // Reset logic
        return false;
    }

    if (msg.startsWith('/cw learn')) {
        ui.notifications.info("Chronicle Weaver: Starting learning process...");

        // 1. Learn from Chat (uses marker now)
        await game.chronicleWeaver.learningService.learnFromChat();

        return false;
    }

    return true;
}
