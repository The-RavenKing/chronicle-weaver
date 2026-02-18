/**
 * @file chronicle-weaver.js
 * @description Main module entry point for Chronicle Weaver.
 *   Registers settings, injects PC-toggle controls into actor sheets,
 *   applies coloured dialogue formatting, and drives the auto-weave
 *   chat response pipeline.
 *
 *   V13 compliance:
 *   - All hook handlers use plain DOM APIs — no jQuery.
 *   - renderChatMessage guard prevents TypeError crash during world load (Bug 1 fix).
 *   - processTextNodes strips italic asterisks correctly (Bug 3 fix).
 *   - HTML-escapes interpolated content before innerHTML assignment (Bug 4 fix).
 */

import { ChatService } from "./services/ChatService.js";
import { LearningService } from "./services/LearningService.js";
import { Grimoire } from "./models/Grimoire.js";
import { Soul } from "./models/Soul.js";
import { Spirit } from "./models/Spirit.js";
import { ChronicleWeaverConfig } from "./apps/ChronicleWeaverConfig.js";

console.log("Chronicle Weaver | Loading…");

const MODULE_ID = "chronicle-weaver";

// =============================================================================
// INIT — settings & hook registration
// =============================================================================

Hooks.once("init", () => {
  console.log("Chronicle Weaver | Initialising settings…");
  registerSettings();

  // ---------------------------------------------------------------------------
  // METHOD 1: Sidebar context menu (most reliable fallback)
  // ---------------------------------------------------------------------------
  Hooks.on("getActorDirectoryEntryContext", (html, options) => {
    options.push({
      name: "CW: Toggle PC Status",
      icon: '<i class="fas fa-scroll"></i>',
      condition: li => {
        const actor = game.actors.get(li.dataset.documentId);
        return game.user.isGM && !!actor;
      },
      callback: async li => {
        const actor = game.actors.get(li.dataset.documentId);
        if (!actor) return;
        const isPC = actor.getFlag(MODULE_ID, "isPC") ?? false;
        await actor.setFlag(MODULE_ID, "isPC", !isPC);
        ui.notifications.info(
          `Chronicle Weaver: ${actor.name} ${!isPC ? "marked as" : "un-marked as"} PC.`
        );
        await game.chronicleWeaver?.soulManager?.updateFromActor(actor);
      },
    });
  });

  // ---------------------------------------------------------------------------
  // METHOD 2: Header button injection for legacy ActorSheet (V1 sheets)
  // ---------------------------------------------------------------------------
  const HEADER_HOOKS = [
    "getCharacterActorSheetHeaderButtons",
    "getActorSheetHeaderButtons",
    "getActorSheet5eCharacterHeaderButtons",
    "getApplicationHeaderButtons",
  ];

  HEADER_HOOKS.forEach(hookName => {
    Hooks.on(hookName, (app, buttons) => {
      if (!game.user.isGM) return;
      if (buttons.some(b => b.class === "cw-pc-toggle")) return;

      const actor = app.actor ?? app.document ?? app.object;
      if (!actor || !(actor instanceof Actor)) return;

      const allowedClasses = [
        ...game.settings.get(MODULE_ID, "supportedSheetClasses")
          .split(",").map(c => c.trim()),
        "ActorSheet",
        "ActorSheet5eCharacter",
      ];
      const isTarget =
        allowedClasses.includes(app.constructor?.name) ||
        app.document instanceof Actor;
      if (!isTarget) return;

      const isPC = actor.getFlag(MODULE_ID, "isPC") ?? false;
      buttons.unshift({
        label: "CW: PC",
        class: "cw-pc-toggle",
        icon: isPC ? "fas fa-check-square" : "far fa-square",
        onclick: async () => {
          const current = actor.getFlag(MODULE_ID, "isPC") ?? false;
          await actor.setFlag(MODULE_ID, "isPC", !current);
          app.render();
          ui.notifications.info(
            `Chronicle Weaver: ${actor.name} ${!current ? "marked as" : "un-marked as"} PC.`
          );
          await game.chronicleWeaver?.soulManager?.updateFromActor(actor);
        },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // METHOD 3: DOM injection for AppV2 / non-standard sheets
  // V13: `html` parameter in renderApplication is an HTMLElement — no jQuery.
  // ---------------------------------------------------------------------------
  Hooks.on("renderApplication", (app, html) => {
    if (!game.user.isGM) return;
    const actor = app.document ?? app.object ?? app.actor;
    if (!actor || !(actor instanceof Actor)) return;

    const windowEl = html.classList?.contains("window-app")
      ? html
      : html.closest?.(".window-app");

    const header = windowEl?.querySelector(".window-header");
    if (!header || header.querySelector(".cw-pc-toggle")) return;

    const isPC = actor.getFlag(MODULE_ID, "isPC") ?? false;
    const title = header.querySelector(".window-title");

    const btn = document.createElement("a");
    btn.className = "header-control cw-pc-toggle";
    btn.title = "CW: Toggle PC";
    btn.innerHTML = `<i class="${isPC ? "fas fa-check-square" : "far fa-square"}"></i> CW`;

    btn.addEventListener("click", async () => {
      const current = actor.getFlag(MODULE_ID, "isPC") ?? false;
      await actor.setFlag(MODULE_ID, "isPC", !current);
      btn.querySelector("i").className = !current ? "fas fa-check-square" : "far fa-square";
      ui.notifications.info(
        `Chronicle Weaver: ${actor.name} ${!current ? "marked as" : "un-marked as"} PC.`
      );
      await game.chronicleWeaver?.soulManager?.updateFromActor(actor);
    });

    title?.after(btn);
  });

  // ---------------------------------------------------------------------------
  // Coloured Dialogue & Markdown formatting
  //
  // V13: `html` parameter in renderChatMessage is an HTMLElement — no jQuery.
  //
  // Bug 1 fix: Guard `game.chronicleWeaver` — this hook fires during world
  //   load when Foundry re-renders the existing chat log, BEFORE `ready` runs,
  //   making game.chronicleWeaver undefined. Without this guard every existing
  //   message throws a TypeError on load.
  // ---------------------------------------------------------------------------
  Hooks.on("renderChatMessage", (message, html) => {
    // Bug 1 — early exit if module is not yet initialised.
    if (!game.chronicleWeaver) return;

    const speaker = message.speaker;
    if (!speaker?.alias) return;

    let color = null;
    if (message.getFlag(MODULE_ID, "isAI")) {
      const spirit = game.chronicleWeaver.spirits.find(s => s.name === speaker.alias);
      if (spirit?.color && spirit.color !== "#ffffff") color = spirit.color;
    } else {
      const soul =
        (speaker.actor
          ? game.chronicleWeaver.souls.find(s => s.foundry_actor_id === speaker.actor)
          : null) ??
        game.chronicleWeaver.souls.find(s => s.name === speaker.alias);
      if (soul?.color && soul.color !== "#ffffff") color = soul.color;
    }

    const contentDiv = html.querySelector(".message-content");
    if (contentDiv) Array.from(contentDiv.childNodes).forEach(processTextNodes);

    // Always add the class to enable CSS formatting (white-space: pre-wrap)
    // even if no custom color is set.
    if (message.getFlag(MODULE_ID, "isAI") ||
      game.chronicleWeaver.souls.some(s => s.name === speaker.alias) ||
      (speaker.actor && game.chronicleWeaver.souls.some(s => s.foundry_actor_id === speaker.actor))) {
      html.classList.add("cw-message");
    }

    if (color) {
      html.style.borderLeft = `4px solid ${color}`;
      html.style.background = `linear-gradient(to right, ${color}11, transparent)`;
      const sender = html.querySelector(".message-header .message-sender");
      if (sender) {
        sender.style.color = color;
        sender.style.fontWeight = "bold";
      }
    }
  });
});

// =============================================================================
// READY
// =============================================================================

Hooks.once("ready", async () => {
  console.log("Chronicle Weaver | Ready!");

  game.chronicleWeaver = {
    chatService: new ChatService(),
    learningService: new LearningService(),
    models: { Grimoire, Soul, Spirit },
    grimoires: [],
    souls: [],
    spirits: [],
  };

  game.chronicleWeaver.soulManager = {
    updateFromActor: async actor => {
      console.log(`Chronicle Weaver | Syncing Soul for ${actor.name}`);
      const souls = game.chronicleWeaver.souls;
      const existing = souls.findIndex(s => s.foundry_actor_id === actor.id);

      if (actor.getFlag(MODULE_ID, "isPC")) {
        let soul;
        if (existing >= 0) {
          soul = souls[existing];
        } else {
          soul = new Soul({ id: foundry.utils.randomID(), foundry_actor_id: actor.id });
          souls.push(soul);
        }
        soul.syncFromActor(actor);
        await game.settings.set(MODULE_ID, "data_souls", souls.map(s => s.toJSON()));
      } else if (existing >= 0) {
        souls.splice(existing, 1);
        await game.settings.set(MODULE_ID, "data_souls", souls.map(s => s.toJSON()));
      }
    },
  };

  await loadData();

  // ---------------------------------------------------------------------------
  // Auto-weave: respond to new chat messages.
  // ---------------------------------------------------------------------------
  Hooks.on("createChatMessage", async (message, _options, userId) => {
    if (userId !== game.user.id) return;
    if (!game.settings.get(MODULE_ID, "autoWeave")) return;
    if (message.getFlag(MODULE_ID, "isAI")) return;

    const skipTypes = new Set(["roll", "whisper"]);
    if (skipTypes.has(message.type)) return;
    if (!message.speaker?.alias && message.rolls?.length > 0) return;

    const activeSpiritId = game.settings.get(MODULE_ID, "activeSpirit");
    const activeSpirit = game.chronicleWeaver.spirits.find(s => s.id === activeSpiritId);

    const activeSouls = game.chronicleWeaver.souls.filter(
      s => s.foundry_actor_id && game.actors.has(s.foundry_actor_id)
    );

    const historyDepth = game.settings.get(MODULE_ID, "historyDepth");
    const SKIP_HISTORY_TYPES = new Set(["roll", "whisper", "other"]);

    const history = game.messages.contents
      .filter(m => m.id !== message.id && !SKIP_HISTORY_TYPES.has(m.type))
      .slice(-historyDepth)
      .map(m => ({
        role: m.getFlag(MODULE_ID, "isAI") ? "assistant" : "user",
        content: `${m.speaker.alias ?? "Unknown"}: ${stripHtml(m.content)}`,
      }));

    const prompt = `${message.speaker.alias ?? "User"}: ${stripHtml(message.content)}`;
    const response = await game.chronicleWeaver.chatService.generateResponse(prompt, {
      spirit: activeSpirit,
      grimoires: game.chronicleWeaver.grimoires,
      souls: activeSouls,
      history,
    });

    if (!response) return;

    const aiName = activeSpirit?.name ?? "Narrator";
    try {
      await ChatMessage.create({
        content: response,
        speaker: { alias: aiName },
        type: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? CONST.CHAT_MESSAGE_TYPES?.OTHER ?? 0,
        flags: { [MODULE_ID]: { isAI: true } },
      });
    } catch (err) {
      console.error("Chronicle Weaver | Failed to post AI message:", err);
      ui.notifications.error("Chronicle Weaver: Failed to post AI response to chat.");
    }
  });

  Hooks.on("chatMessage", handleChatCommand);
});

// =============================================================================
// Data loading
// =============================================================================

async function loadData() {
  console.log("Chronicle Weaver | Loading data from settings…");
  game.chronicleWeaver.spirits = game.settings.get(MODULE_ID, "data_spirits").map(d => new Spirit(d));
  game.chronicleWeaver.souls = game.settings.get(MODULE_ID, "data_souls").map(d => new Soul(d));
  game.chronicleWeaver.grimoires = game.settings.get(MODULE_ID, "data_grimoires").map(d => new Grimoire(d));
  console.log(
    `Chronicle Weaver | Loaded ${game.chronicleWeaver.spirits.length} Spirits, ` +
    `${game.chronicleWeaver.souls.length} Souls, ` +
    `${game.chronicleWeaver.grimoires.length} Grimoires.`
  );
}

// =============================================================================
// Settings registration
// =============================================================================

function registerSettings() {
  game.settings.register(MODULE_ID, "autoWeave", {
    name: "Auto-Weaving", hint: "If enabled, the AI will automatically reply to chat messages.",
    scope: "client", config: true, type: Boolean, default: true,
  });
  game.settings.register(MODULE_ID, "supportedSheetClasses", {
    name: "Supported Sheet Classes",
    hint: "Comma-separated sheet class names to target for the PC toggle button.",
    scope: "world", config: true, type: String,
    default: "CharacterActorSheet, ActorSheet5eCharacter2, ActorSheet5eCharacter",
  });
  game.settings.register(MODULE_ID, "ollamaUrl", {
    name: "Ollama URL", hint: 'URL where Ollama is running (e.g. "http://localhost:11434").',
    scope: "world", config: true, type: String, default: "http://localhost:11434",
  });
  game.settings.register(MODULE_ID, "ollamaModel", {
    name: "Reader / Chat Model", hint: 'Model used for chat. Use "Manage Souls & Grimoires" to select.',
    scope: "world", config: true, type: String, default: "llama2:7b",
  });
  game.settings.register(MODULE_ID, "coderModel", {
    name: "Coder Model", hint: 'Model for JSON structuring. Use "Manage Souls & Grimoires" to select.',
    scope: "world", config: true, type: String, default: "qwen2.5-coder:7b",
  });
  game.settings.register(MODULE_ID, "lastProcessedMessageId", {
    scope: "world", config: false, type: String, default: "",
  });
  game.settings.register(MODULE_ID, "historyDepth", {
    name: "Conversation History Depth", hint: "How many recent messages to include in AI context.",
    scope: "world", config: true, type: Number, default: 10,
    range: { min: 5, max: 30, step: 5 },
  });
  game.settings.register(MODULE_ID, "pending_entries", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "activeSpirit", { name: "Active Spirit", hint: "The Spirit currently narrating.", scope: "world", config: true, type: String, default: "", onChange: v => console.log("Chronicle Weaver | Active Spirit:", v) });
  game.settings.register(MODULE_ID, "data_spirits", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "data_souls", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "data_grimoires", { scope: "world", config: false, type: Array, default: [] });
  game.settings.register(MODULE_ID, "ollamaContextModels", { scope: "world", config: false, type: Array, default: [] });

  game.settings.registerMenu(MODULE_ID, "config", {
    name: "Chronicle Weaver Management", label: "Manage Souls & Grimoires",
    hint: "Configure Grimoires, Souls, and Spirits.",
    icon: "fas fa-book-spells", type: ChronicleWeaverConfig, restricted: true,
  });
}

// =============================================================================
// Chat command handler
// =============================================================================

/**
 * Handles `/cw` slash commands entered in the chat box.
 *
 * @param {ChatLog} _chatLog - The chat log instance (unused).
 * @param {string}  message  - The raw message string.
 * @returns {boolean} `false` suppresses the message from appearing in chat.
 */
function handleChatCommand(_chatLog, message) {
  const msg = message.trim();

  if (msg.startsWith("/cw reset")) {
    game.settings.set(MODULE_ID, "lastProcessedMessageId", "")
      .then(() => game.settings.set(MODULE_ID, "pending_entries", []))
      .then(() => ui.notifications.info("Chronicle Weaver: Reset complete."))
      .catch(err => {
        console.error("Chronicle Weaver | Reset failed:", err);
        ui.notifications.error("Chronicle Weaver: Reset failed. Please try again.");
      });
    return false;
  }

  if (msg.startsWith("/cw learn")) {
    ui.notifications.info("Chronicle Weaver: Starting learning process…");
    game.chronicleWeaver.learningService.learnFromChat().catch(err => {
      console.error("Chronicle Weaver | learnFromChat failed:", err);
      ui.notifications.error("Chronicle Weaver: Learning process failed. Check the console.");
    });
    return false;
  }

  return true;
}

// =============================================================================
// Utility — HTML stripping
// =============================================================================

/**
 * Strips HTML tags and decodes common entities from a string.
 *
 * @param {string} html - Raw HTML string.
 * @returns {string} Plain text.
 */
function stripHtml(html) {
  return (html ?? "")
    .replace(/<[^>]*>/gm, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// =============================================================================
// Coloured dialogue — text-node processor
// =============================================================================

/**
 * HTML-escapes a plain-text string before it is interpolated into innerHTML.
 * Prevents bare `<` / `>` characters in AI dialogue from being parsed as
 * HTML markup and breaking the chat card's DOM structure (Bug 4 fix).
 *
 * @param {string} str - Raw captured string from a text node.
 * @returns {string} HTML-safe string.
 */
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Recursively walks DOM nodes inside `.message-content`, replacing
 * `**bold**`, `*italic*`, and `"speech"` patterns with styled spans.
 *
 * Bug 3 fix: Italic asterisks are now stripped before wrapping in markup
 *   (`*text*` → `<em>text</em>` — the original code left the `*` visible).
 * Bug 4 fix: All captured text is HTML-escaped before innerHTML assignment.
 *
 * @param {Node} node - A DOM node (text or element) to process.
 */
function processTextNodes(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? "";

    // 1. Pre-escape the entire text to prevent XSS (Bug 4 fix).
    //    We do this *before* applying our own markup, so that any <script> tags
    //    in the original text are neutralized but our own <span> tags are safe.
    const safeText = escHtml(text);

    // Matches:
    // 1. **Bold** (often used for actions in some models, or emphasis)
    // 2. *Italic* (standard actions)
    // 3. "Speech" (including ”smart quotes“)
    const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(["\u201C\u201D][^"\u201C\u201D]+["\u201C\u201D])/g;

    let newHtml = safeText;

    // 2. Apply Markdown formatting if present.
    //    Note: we run this on the *escaped* text, so we don't need to escape inside.
    //    Removed regex.test() check to avoid lastIndex pitfalls and simplify.
    newHtml = safeText.replace(regex, (match, bold, italic, speech) => {
      // Debug log to confirm we are catching things
      // console.log("Chronicle Weaver | Formatting match:", match);

      if (bold) {
        const inner = bold.replace(/\*\*/g, ""); // Already escaped
        const isHeader = bold.includes(":");
        const markup = `<strong><span class="cw-action">${inner}</span></strong>`;
        return isHeader ? `<br/><br/>${markup} ` : markup;
      }
      if (italic) {
        const inner = italic.replace(/^\*|\*$/g, ""); // Already escaped
        const isHeader = italic.includes(":");
        const markup = `<em><span class="cw-action">${inner}</span></em>`;
        return isHeader ? `<br/><br/>${markup} ` : markup;
      }
      if (speech) {
        return `<span class="cw-speech">${speech}</span>`; // Already escaped
      }
      return match;
    });

    // 3. Convert newlines to breaks for readability.
    if (newHtml.includes("\n")) {
      newHtml = newHtml.replace(/\n/g, "<br/>");
    }

    // Optimization: If nothing changed (no markdown, no newlines), avoid DOM thrashing.
    // BUT checking equality against `text` is tricky because we escaped it.
    // So we check against `safeText`? No, if safeText != text, we MUST update (to show escaping).
    // If safeText == text (no special chars) and no markdown/newlines, we can skip.
    if (newHtml === text) return;

    const span = document.createElement("span");
    span.innerHTML = newHtml;
    node.parentNode?.replaceChild(span, node);

  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // Skip already-processed CW spans to prevent double-processing on re-render.
    if (node.classList.contains("cw-action") || node.classList.contains("cw-speech")) return;
    Array.from(node.childNodes).forEach(processTextNodes);
  }
}
