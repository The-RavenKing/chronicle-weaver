# Chronicle Keeper

**Your Campaign's Perfect Memory**

Chronicle Keeper is an AI-powered campaign assistant for Foundry VTT that automatically remembers every conversation, character, location, and event in your campaign. Using local AI processing via Ollama, it keeps perfect records while maintaining complete privacy.

![Chronicle Keeper](https://img.shields.io/badge/Foundry%20VTT-v11%2B-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### 🧠 Perfect Campaign Memory
- **Automatic Storage** - Every conversation is remembered
- **Content Ingestion** - Learns from journals, characters, NPCs, and scenes
- **Smart Context** - Finds relevant information automatically
- **Campaign Separation** - Keep multiple campaigns isolated

### 🎭 Intelligent NPCs
- **Consistent Personalities** - NPCs remember past conversations
- **Natural Roleplay** - Talk to NPCs with `/npc` commands
- **Private Conversations** - Whisper commands for secret interactions

### 🔒 Complete Privacy
- **100% Local** - All AI processing on your computer
- **No Cloud Services** - Nothing sent to external servers
- **Your Data Stays Yours** - Complete control and privacy

### 🛡️ Spoiler Protection
- **GM Only Mode** - Prevent players from asking spoiler questions
- **Restricted Commands** - Control who can search campaign memory
- **Safe Ingestion** - Load entire campaign without worry

### ⚙️ Highly Customizable
- **Custom AI Behavior** - Write your own system prompts
- **Flexible AI Name** - Brand the AI to match your campaign
- **Multiple Campaigns** - Separate memory for each story

## 📦 Installation

### Prerequisites

1. **Install Ollama** - Download from [ollama.ai](https://ollama.ai)

2. **Pull an AI Model**
   ```bash
   ollama pull llama2:7b
   ```

3. **Start Ollama**
   ```bash
   ollama serve
   ```

### Install Module

#### Method 1: Via Foundry (After Publication)
1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Search for "Chronicle Keeper"
4. Click **Install**

#### Method 2: Manifest URL
1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste manifest URL (see releases)
4. Click **Install**

#### Method 3: Manual Installation
1. Download the latest release
2. Extract to `Data/modules/chronicle-keeper/`
3. Restart Foundry VTT

## 🚀 Quick Start

### 1. Enable Module
- Launch your world
- **Game Settings → Manage Modules**
- Enable "Chronicle Keeper"
- Refresh browser (F5)

### 2. Configure Settings
- **Settings → Module Settings**
- Set **Ollama URL**: `http://localhost:11434`
- Set **Model Name**: `llama2:7b`
- Enable **RAG** (memory system)
- Enable **GM Only Mode** (recommended)

### 3. Load Campaign Knowledge
```
/ingest
```
Wait for "✅ Ingestion Complete!"

### 4. Start Using!
```
/ask What's the history of this kingdom?
/npc Innkeeper: What's the local gossip?
```

## 📖 Commands

### Public Commands (Everyone Sees)
| Command | Description |
|---------|-------------|
| `/ask [question]` | Ask the AI anything |
| `/npc [Name]: [message]` | Talk to an NPC |
| `/remember [info]` | Add information to memory |
| `/recall [topic]` | Search campaign memory |
| `/history` | View recent conversations |

### Whisper Commands (Private to GMs)
| Command | Description |
|---------|-------------|
| `/wask [question]` | Ask privately (you + GMs only) |
| `/wnpc [Name]: [message]` | Private NPC conversation |
| `/wremember [info]` | Add info privately |
| `/wrecall [topic]` | Search privately |

### GM-Only Commands
| Command | Description |
|---------|-------------|
| `/ingest` | Learn all campaign content |
| `/clearhistory` | Clear campaign memory |
| `/campaigns` | List all campaigns |

## 🎮 Usage Examples

### Ask General Questions
```
/ask What do we know about the cult?
```
AI searches past conversations and ingested journals to provide comprehensive answer.

### Talk to NPCs
```
/npc Guard Captain: Any updates on the investigation?
```
Guard Captain remembers previous conversations and responds consistently.

### Private Conversations
```
/wask What's the villain's secret plan?
```
Only you and GMs see the question and answer - no spoilers for players!

### Load Campaign Knowledge
```
/ingest
```
AI learns everything from your journals, characters, NPCs, and scenes.

### Track Campaign Details
```
/remember The party discovered the cult's hideout is at the old mill
```
Information stored for future reference.

### Search Memory
```
/recall cult hideout
```
Finds all mentions of the cult hideout in conversations and journals.

## ⚙️ Configuration

### Module Settings

**Ollama URL** (default: `http://localhost:11434`)
- Where Ollama is running
- Use default for local installation

**Model Name** (default: `llama2:7b`)
- Which AI model to use
- Must match exactly: `ollama list`

**System Prompt**
- Control AI behavior and personality
- Customize for your campaign style

**AI Name** (default: "Chronicle Keeper")
- Display name for AI responses
- Examples: "Game Master", "Storyteller", "The Oracle"

**Enable RAG** (Recommended: ON)
- Turns on memory system
- Required for `/ingest` and memory features

**GM Only Mode** (Recommended: ON)
- Prevents player spoilers
- Restricts `/ask`, `/recall`, `/history` to GMs
- Players can still use NPCs and add observations

**Campaign Name** (Optional)
- Separate multiple campaigns in same world
- Leave blank for single campaign

## 🛡️ Spoiler Protection

### The Problem
Without protection, players could accidentally get spoilers:
```
Player: /ask What's the villain's plan?
AI: [Reveals plot twist from GM's journals!]
```

### The Solution: GM Only Mode
Enable in settings to restrict sensitive commands to GMs only.

**What Gets Restricted:**
- `/ask` - Can't ask spoiler questions
- `/recall` - Can't search for plot secrets
- `/history` - Can't view past conversations

**What Still Works:**
- `/npc` - Talk to NPCs normally
- `/remember` - Add observations
- Full roleplay functionality

## 🎯 Use Cases

### Mystery Campaigns
- Enable GM Only Mode
- Ingest campaign with plot secrets
- Players can't accidentally spoil the mystery

### Sandbox Campaigns
- Disable GM Only Mode
- Players freely explore world lore
- No secrets to protect

### NPC Consistency
- NPCs remember past interactions
- Conversations build relationships
- Natural character development

### Campaign Continuity
- Never forget what happened
- Reference past events easily
- Build consistent narrative

## 📊 Campaign Separation

### Automatic (Recommended)
Each Foundry world has separate memory. Just use different worlds for different campaigns.

### Manual (Advanced)
Run multiple campaigns in same world:
1. **Settings → Campaign Name** = "Main Campaign"
2. Start playing, memory builds up
3. Switch to different campaign: **Campaign Name** = "One-Shot"
4. Completely separate memory

## 🔧 System Requirements

### Minimum
- Foundry VTT v11+
- Ollama installed
- 8GB RAM
- 2GB free disk space

### Recommended
- Foundry VTT v12+
- 16GB RAM
- SSD storage
- Modern CPU (4+ cores)

### Tested On
- Windows 11
- macOS Sonoma
- Ubuntu 24.04
- Foundry VTT v11, v12, v13

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Bug Reports

Found a bug? Please open an issue with:
- Foundry VTT version
- Chronicle Keeper version
- Steps to reproduce
- Console errors (F12)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the Foundry VTT community
- Powered by [Ollama](https://ollama.ai)
- Inspired by the need for better campaign management

## 📞 Support

- **Documentation**: See guides in the repository
- **Issues**: GitHub Issues
- **Community**: Foundry VTT Discord - #module-discussion

---

**Chronicle Keeper** - Your campaign's perfect memory 🎲✨

Made with ❤️ for the TTRPG community
