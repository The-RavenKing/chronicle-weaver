# Changelog

All notable changes to Chronicle Keeper will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-10

### Added
- Initial release of Chronicle Keeper
- Automatic conversation memory storage
- Content ingestion from journals, characters, NPCs, and scenes
- Custom AI system prompts
- Campaign separation for multiple campaigns
- Whisper commands for private conversations
- Customizable AI name
- GM Only Mode for spoiler protection
- Commands:
  - `/ask` - Ask the AI questions (public)
  - `/wask` - Ask the AI questions (whispered)
  - `/npc` - Talk to NPCs (public)
  - `/wnpc` - Talk to NPCs (whispered)
  - `/ingest` - Learn campaign content
  - `/remember` - Manually add information
  - `/wremember` - Add information privately
  - `/recall` - Search campaign memory
  - `/wrecall` - Search memory privately
  - `/history` - View conversation history
  - `/clearhistory` - Clear campaign memory
  - `/campaigns` - List all campaigns

### Features
- Local AI processing via Ollama (100% private, no external servers)
- Smart context retrieval based on keywords
- NPC conversation consistency across sessions
- Automatic storage of all conversations
- Campaign-specific memory isolation
- Complete spoiler protection for players

### Requirements
- Foundry VTT v11 or higher
- Ollama installed locally
- Recommended: llama2:7b model or compatible
- Minimum 8GB RAM (16GB recommended)

## [Unreleased]

### Planned Features
- Vector-based semantic search (advanced RAG)
- Multi-language support
- Export/import campaign memory
- Advanced NPC personality tracking
- Integration with character sheet updates
- Automatic scene summaries
