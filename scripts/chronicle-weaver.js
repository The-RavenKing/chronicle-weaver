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

    game.chronicleWeaver = {
        chatService: new ChatService(),
        learningService: new LearningService(),
        models: { Grimoire, Soul, Spirit },
        grimoires: [],
        souls: [],
        spirits: []
    };

    loadData();

    // Auto-respond to chat messages
    Hooks.on('createChatMessage', async (message, options, userId) => {
        if (userId !== game.user.id) return;
        if (!game.settings.get('chronicle-weaver', 'autoWeaving')) return;

        // Don't respond to our own AI messages
        if (message.getFlag('chronicle-weaver', 'isAI')) return;

        // Only respond to IC speech (0), emotes (1), OOC (2)
        if (![0, 1, 2].includes(message.type)) return;

        // Get active soul for speaker name
        const activeSoul = game.chronicleWeaver.souls.find(
            s => s.id === game.settings.get('chronicle-weaver', 'activeSoul')
        );
        const aiName = activeSoul?.name || "Chronicle Weaver";

        // Gather active spirits (player characters with linked actors)
        const activeSpirits = game.chronicleWeaver.spirits.filter(s => {
            if (!s.foundry_actor_id) return false;
            return game.actors.get(s.foundry_actor_id) !== undefined;
        });

        // Build conversation history
        const historyDepth = game.settings.get('chronicle-weaver', 'historyDepth');
        const history = game.messages.contents
            .filter(m => [0, 1, 2].includes(m.type) && m.id !== message.id)
            .slice(-historyDepth)
            .map(m => ({
                role: m.getFlag('chronicle-weaver', 'isAI') ? 'assistant' : 'user',
                content: `${m.speaker.alias || 'Unknown'}: ${m.content}`
            }));

        const prompt = `${message.speaker.alias || 'User'}: ${message.content}`;
        console.log("Chronicle Weaver | Auto-responding to:", prompt);

        const response = await game.chronicleWeaver.chatService.generateResponse(prompt, {
            soul: activeSoul || new Soul({ name: "GM", description: "You are a Game Master." }),
            grimoires: game.chronicleWeaver.grimoires,
            spirits: activeSpirits,
            history: history
        });

        if (response) {
            ChatMessage.create({
                content: response,
                speaker: { alias: aiName },
                type: CONST.CHAT_MESSAGE_TYPES.OTHER,
                flags: {
                    'chronicle-weaver': { isAI: true }
                }
            });
        }
    });

    // Inject PC checkbox into Actor sheet
    Hooks.on('renderActorSheet', (app, html, data) => {
        const actor = app.actor;
        const isPC = actor.getFlag('chronicle-weaver', 'isPC') || false;

        const toggleHTML = `
            <div class="chronicle-weaver-pc-toggle" style="display:flex;align-items:center;margin-right:10px;">
                <label class="checkbox">
                    <input type="checkbox" class="cw-is-pc" ${isPC ? "checked" : ""}>
                    Chronicle Weaver: Is Player Character?
                </label>
            </div>
        `;

        let target = html.find('input[name="name"]');
        if (target.length === 0) target = html.find('.window-title');

        if (target.length > 0) {
            const toggle = $(toggleHTML);
            target.parent().after(toggle);

            toggle.find('.cw-is-pc').change(async (ev) => {
                const checked = ev.currentTarget.checked;
                await actor.setFlag('chronicle-weaver', 'isPC', checked);
                console.log(`Chronicle Weaver | Set ${actor.name} isPC to ${checked}`);
                if (checked) {
                    await SpiritManager.createFromActor(actor);
                }
            });
        }
    });

    // Auto-sync actor stats to Spirit on update
    Hooks.on('updateActor', async (actor, changes) => {
        if (!actor.getFlag('chronicle-weaver', 'isPC')) return;
        await SpiritManager.syncFromActor(actor);
    });

    // Register chat commands
    Hooks.on('chatMessage', handleChatCommand);
});

// Spirit management helper
class SpiritManager {
    static async createFromActor(actor) {
        let spirit = game.chronicleWeaver.spirits.find(
            s => s.foundry_actor_id === actor.id
        );

        if (!spirit) {
            spirit = game.chronicleWeaver.spirits.find(s => s.name === actor.name);
            if (spirit) {
                spirit.foundry_actor_id = actor.id;
            } else {
                spirit = new game.chronicleWeaver.models.Spirit();
                game.chronicleWeaver.spirits.push(spirit);
            }
        }

        spirit.syncFromActor(actor);

        // Assign owner (first non-GM user with OWNER permission)
        const ownerEntry = Object.entries(actor.ownership).find(
            ([id, level]) => level === 3 && !game.users.get(id)?.isGM
        );
        if (ownerEntry) spirit.user_id = ownerEntry[0];

        await this.saveSpirits();
        ui.notifications.info(`Chronicle Weaver: Synced Spirit for ${actor.name}`);
    }

    static async syncFromActor(actor) {
        const spirit = game.chronicleWeaver.spirits.find(
            s => s.foundry_actor_id === actor.id
        );
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
        scope: 'client',
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
        hint: 'The Soul currently controlling the AI narrator.',
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });

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
        hint: "Configure your Grimoires, Souls, and Spirits.",
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

    console.log(
        `Chronicle Weaver | Loaded ${game.chronicleWeaver.souls.length} Souls,`,
        `${game.chronicleWeaver.grimoires.length} Grimoires,`,
        `${game.chronicleWeaver.spirits.length} Spirits.`
    );
}

async function handleChatCommand(message, chatData) {
    const msg = message.trim();

    if (msg.startsWith('/cw reset')) {
        return false;
    }

    if (msg.startsWith('/cw learn')) {
        ui.notifications.info("Chronicle Weaver: Starting learning process...");
        await game.chronicleWeaver.learningService.learnFromChat();
        return false;
    }

    return true;
}
