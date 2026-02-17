# Chronicle Weaver — Bug Report & Fixes
**Audited against live repo:** `C:\Users\karlm\OneDrive\Documents\GitHub\chronicle-weaver`  
**Module version:** 2.0.0  
**Audit date:** 2026-02-17  

---

## Previously Reported Bugs — All Confirmed Fixed ✅

| # | Description | File | Status |
|---|-------------|------|--------|
| 1 | `message.type` numeric check broke auto-weave on Foundry v12+ | `chronicle-weaver.js` | ✅ Fixed |
| 2 | History filter also used numeric type check, emptying AI context on v12+ | `chronicle-weaver.js` | ✅ Fixed |
| 3 | Raw HTML from `message.content` injected into AI prompts | `chronicle-weaver.js`, `LearningService.js` | ✅ Fixed |
| 4 | DOM button injection `closest('.window-app')` traversal failed | `chronicle-weaver.js` | ✅ Fixed |
| 5 | `Grimoire.scan()` silently dropped entries missing a `uid` | `Grimoire.js` | ✅ Fixed |
| 6 | `_editGrimoire` textarea unescaped `JSON.stringify` — XSS risk | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 7 | Stale click event passed to `_onRefreshModels` | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 8 | `form.class` accessor caused browser name collision in `_editSoul` | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 9 | No deduplication in `updateGrimoire` — review queue bloat | `LearningService.js` | ✅ Fixed |
| 10 | `ChatService` Map dedup collapsed uid-less Grimoire entries to one | `ChatService.js` | ✅ Fixed |
| 11 | `Soul.syncFromActor` biography regex `>?` corrupted text with bare `<` | `Soul.js` | ✅ Fixed |
| 12 | `learnFromChat()` unhandled promise — failures silently swallowed | `chronicle-weaver.js` | ✅ Fixed |
| 13 | AI-wrapped array object silently discarded all learned lore entries | `LearningService.js` | ✅ Fixed |
| 14 | Actor names unescaped in Import Soul dialog — XSS risk | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 15 | Partial `attributes` in imported JSON produced `undefined` fields in persona blocks | `Soul.js` | ✅ Fixed |
| 16 | `Soul.stats` partial object caused TypeError in `getPersonaBlock()` | `Soul.js` | ✅ Fixed |
| 17 | `data.models` not null-checked in `_onRefreshModels` | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 18 | AI-returned entries not validated before storage — corrupted review queue | `LearningService.js` | ✅ Fixed |
| 19 | `form.name` browser collision silently cleared Spirit/Soul names on save | `ChronicleWeaverConfig.js` | ✅ Fixed |
| 20 | No content validation on Review Queue approve — empty entries added to Grimoire | `ReviewQueueApp.js` | ✅ Fixed |
| 21 | AI `ChatMessage` created with deprecated numeric `type: 0` constant | `chronicle-weaver.js` | ✅ Fixed |

---

## Remaining Bugs

Three bugs confirmed still present in the current codebase.

---

### Bug 1 — MEDIUM: `_editGrimoire` still uses `form.name.value` — the same `form.name` browser collision that was fixed in `_editSpirit` and `_editSoul` was not carried over here

**File:** `scripts/apps/ChronicleWeaverConfig.js`  
**Location:** `_editGrimoire()` — save callback, line: `grimoire.name = form.name.value;`

**Problem:**  
`_editSpirit` and `_editSoul` were both updated to use `form.elements['name']?.value` to avoid the native `HTMLFormElement.name` IDL collision. However `_editGrimoire` still reads `form.name.value` directly:

```js
// CURRENT — form.name returns "" (the form element's own IDL property, not the input)
grimoire.name = form.name.value; // → undefined
```

Every time a Grimoire is saved through the edit dialog, its name is silently set to `undefined`, rendering it blank in the config list and breaking any name-based lookups (such as the "Learned Lore" grimoire lookup in `ReviewQueueApp`).

**Fix:**
```js
// FIXED — consistent with _editSpirit and _editSoul already in this file
grimoire.name = form.elements['name']?.value || grimoire.name;
```

---

### Bug 2 — LOW: AI-generated messages are included in `learnFromChat()` and their invented content is learned as real lore

**File:** `scripts/services/LearningService.js`  
**Location:** `learnFromChat()` — `combinedText` construction

**Problem:**  
The chat log fed to the reader model includes all messages without filtering out AI-generated ones:

```js
// CURRENT — includes AI responses in the text sent for lore extraction
const combinedText = newMessages
    .map(m => `${m.speaker.alias || 'Unknown'}: ${this._stripHtml(m.content)}`)
    .join('\n');
```

AI response messages are flagged with `{ [MODULE_ID]: { isAI: true } }` at creation. When `learnFromChat` runs, these AI messages are included in the analysis blob. The reader model has no way to distinguish fabricated AI narration from actual player/GM statements. Invented NPC dialogue, atmospheric descriptions, and hallucinated proper nouns from the AI are extracted as "facts" and queued as lore — which then gets injected back into future AI context, compounding errors over time.

**Fix:**
```js
// FIXED — exclude AI-generated messages before building the analysis text
const combinedText = newMessages
    .filter(m => !m.getFlag('chronicle-weaver', 'isAI'))
    .map(m => `${m.speaker.alias || 'Unknown'}: ${this._stripHtml(m.content)}`)
    .join('\n');

if (!combinedText.trim()) {
    ui.notifications.info("Chronicle Weaver: No new player/GM messages to learn from.");
    return;
}
```

---

### Bug 3 — LOW: `Spirit.post_history_instructions` is loaded and saved but never injected — silently breaks SillyTavern cards that rely on it

**File:** `scripts/services/ChatService.js`  
**Location:** `ChatService._buildMessages()` — after conversation history, before user message

**Problem:**  
`Spirit` correctly deserializes and persists `post_history_instructions`, but `_buildMessages()` never injects it into the message array. In SillyTavern this field is specifically designed to be injected *after* conversation history and *before* the current user message, to re-assert character instructions that may have drifted. For any imported Spirit card with this field set, the content is silently discarded every call.

**Fix:**  
Add the injection in `_buildMessages` after pushing history and before pushing the user message:

```js
// After the history forEach loop, before the user message push:

// Inject post-history instructions if present (SillyTavern feature)
if (spirit?.post_history_instructions) {
    messages.push({ role: 'system', content: spirit.post_history_instructions });
}

// 5. Current user message
messages.push({ role: 'user', content: userMessage });
```

---

## Summary

| # | Severity | File | Description |
|---|----------|------|-------------|
| 1 | 🟡 Medium | `scripts/apps/ChronicleWeaverConfig.js` | `form.name` collision in `_editGrimoire` silently clears Grimoire name on save — same fix not carried over from Spirit/Soul |
| 2 | 🔵 Low | `scripts/services/LearningService.js` | AI-generated messages included in lore extraction — invented content learned as real facts, creating a lore feedback loop |
| 3 | 🔵 Low | `scripts/services/ChatService.js` | `post_history_instructions` deserialized and stored but never injected — SillyTavern cards silently lose this feature |
