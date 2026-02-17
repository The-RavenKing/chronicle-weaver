# Chronicle Weaver

**Chronicle Weaver** is a Foundry VTT module that integrates Local LLMs (via Ollama) to act as an intelligent Game Master assistant, roleplay partner, and automated lorekeeper. It is designed to provide seamless, context-aware AI interactions that enhance the TTRPG experience without replacing the GM.

## Core Philosophy

1.  **Seamless Integration**: "Auto-Weaving" allows the AI to respond naturally to player chat without requiring slash commands or breaks in immersion.
2.  **Context is King**: The AI understands the game state by combining Conversation History, Active Player Characters (Spirits), and World Lore (Grimoires).
3.  **Human-in-the-Loop**: All AI-learned knowledge is placed in a Review Queue for GM approval, ensuring the "Canon" remains accurate.

## Key Features

### 🧠 Intelligent Agents
*   **Souls (GM Personas)**: Define distinct personalities for the AI narrator (e.g., "Gritty Noir Detective", "High Fantasy Bard"). The active Soul drives the tone and style of responses.
*   **Spirits (Player Personas)**: Representations of Player Characters that automatically sync with Foundry Actors.
    *   **Auto-Sync**: Tracks Class, Level, Race, HP, AC, Equipment, and Gold.
    *   **Context Injection**: The AI knows who is speaking, their capabilities, and their current status (e.g., "injured", "wealthy").

### 📚 Dynamic Lore (Grimoires)
*   **Grimoire System**: A database of world knowledge.
*   **Keyword Scanning**: The Chat Service scans player messages for keywords (names, locations, factions) and injects relevant Grimoire entries into the AI's context window.
*   **Review Queue**:
    *   The **Learning Service** analyzes chat logs using a "Reader" model to extract facts.
    *   A "Coder" model formats these facts into structured data.
    *   New entries appear in a **Review Queue** where the GM can Approve (add to Grimoire), Edit, or Reject them.

### 💬 Chat & Interaction
*   **Auto-Weaving**: The AI automatically detects In-Character (IC), Emote, and Out-Of-Character (OOC) speech and responds if appropriate.
*   **Conversation History**: Maintains a configurable buffer (default 10 messages) of recent chat to ensure continuity in dialogue.
*   **Dual-Model Architecture**:
    *   **Chat Model**: Fast, creative model for generating responses (e.g., `llama3`).
    *   **Coder Model**: Specialized model for data extraction and formatting (e.g., `qwen2.5-coder`).

## Architecture Overview

### Services
*   **`ChatService`**: Handles communication with the `/api/chat` endpoint. constructs the prompt context (`_buildMessages`) by assembling the Soul, active Spirits, triggered Grimoire entries, and history.
*   **`LearningService`**: Manages the background process of reading chat logs. Implements the split Reader/Coder workflow and manages the Review Queue.

### Models
*   **`Soul`**: Configurable AI personality (`system_prompt`).
*   **`Spirit`**: Syncable PC data container.
*   **`Grimoire`**: Collection of Lore Entries (`keys`, `content`).

### Configuration
*   **Module Settings**: Configure Ollama URL, Model selection, History Depth, and Auto-Weaving toggle.
*   **Management UI**: A dedicated interface for creating and managing Souls, Grimoires, and Spirits.

## Usage
1.  **Setup**: Configure your Ollama URL and select your models in Module Settings.
2.  **Personas**: Create a **Soul** for your GM style.
3.  **Players**: Toggle the "Is Player Character?" checkbox on Actor sheets to generate **Spirits**.
4.  **Play**: Chat naturally. The AI will chime in.
5.  **Learn**: Periodically run `/cw learn` to have the AI analyze the session and suggest new Grimoire entries.
6.  **Review**: Open the **Review Queue** from the settings to officially canonize new lore.
