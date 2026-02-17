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

        // Ignore messages from the AI itself (prevent loops)
        const aiName = "Chronicle Weaver"; // TODO: Get from active Soul
        if (message.speaker.alias === aiName) return;

        // Ignore rolls/system messages, only reply to speech/emotes/ooc
        if (![0, 1, 2].includes(message.type)) return;

        // Check if the speaker is a PC
        const actor = game.actors.get(message.speaker.actor);
        if (actor && !actor.getFlag('chronicle-weaver', 'isPC')) {
            // If the speaker IS NOT a PC (i.e., is an NPC), we generally don't want to auto-reply 
            // because that would mean the AI replying to itself (if it generated the message) 
            // or the GM roleplaying.
            // However, for now we will just proceed and let the AI decide if it needs to say something.
        }

        // Gather Context from Scene
        const presentSpirits = [];
        const presentPlayers = [];
        const presentNPCs = []; // Generic NPCs to be treated as Grimoire/Lore

        if (canvas.scene) {
            for (const token of canvas.tokens.placeables) {
                const tokenActor = token.actor;
                if (!tokenActor) continue;

                if (tokenActor.getFlag('chronicle-weaver', 'isPC')) {
                    presentPlayers.push(tokenActor.name);
                } else {
                    // It's an NPC. 
                    // Check if we have an EXPLICIT defined Spirit for it.
                    let spirit = game.chronicleWeaver.spirits.find(s => s.name === tokenActor.name);

                    if (spirit) {
                        presentSpirits.push(spirit);
                    } else {
                        // No explicit Spirit -> Treat as generic NPC (Grimoire Entry)
                        presentNPCs.push({
                            name: tokenActor.name,
                            description: tokenActor.system?.details?.biography?.value || "A character in the scene."
                        });
                    }
                }
            }
        }

        // Send to AI
        const prompt = message.content;
        console.log("Chronicle Weaver | Auto-responding to:", prompt);

        const response = await game.chronicleWeaver.chatService.generateResponse(prompt, {
            soul: game.chronicleWeaver.souls.find(s => s.id === game.settings.get('chronicle-weaver', 'activeSoul')) || new Soul({ name: "GM", description: "You are a Game Master." }),
            grimoires: game.chronicleWeaver.grimoires,
            spirits: presentSpirits, // Only true Spirits
            players: presentPlayers,
            sceneGrimoire: presentNPCs // Generic NPCs as Lore
        });

        if (response) {
            ChatMessage.create({
                content: response,
                speaker: { alias: aiName },
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
            target.parent().after(toggleHTML);

            // Activate listener
            html.find('.cw-is-pc').change(async (ev) => {
                const checked = ev.currentTarget.checked;
                await actor.setFlag('chronicle-weaver', 'isPC', checked);
                console.log(`Chronicle Weaver | Set ${actor.name} isPC to ${checked}`);
            });
        }
    });
});

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

        // 2. Sync PC Souls
        const pcs = game.actors.filter(a => a.getFlag('chronicle-weaver', 'isPC'));
        for (const pc of pcs) {
            await game.chronicleWeaver.learningService.syncSoulFromActor(pc);
        }

        return false;
    }

    return true;
}
