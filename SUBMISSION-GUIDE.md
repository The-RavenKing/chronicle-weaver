# Chronicle Keeper - Foundry VTT Submission Guide

## ✅ Pre-Submission Checklist

### Required Files (All Present!)
- [x] `module.json` - Complete with all fields
- [x] `LICENSE` - MIT License
- [x] `README.md` - Comprehensive documentation
- [x] `CHANGELOG.md` - Version history
- [x] `.gitignore` - Git ignore rules
- [x] Source code (`scripts/`, `styles/`, `lang/`)
- [ ] `assets/icon.png` - **YOU NEED TO CREATE THIS**
- [ ] `assets/cover.png` - **YOU NEED TO CREATE THIS**

### module.json Fields to Update
Before submitting, replace these placeholders in `module.json`:

1. **authors** section:
   ```json
   "name": "Your Real Name",
   "email": "your.email@example.com",
   "url": "https://github.com/The-RavenKing"
   ```

2. **URL fields** (replace `The-RavenKing` with your GitHub username):
   ```json
   "url": "https://github.com/The-RavenKing/chronicle-keeper",
   "manifest": "https://github.com/The-RavenKing/chronicle-keeper/releases/latest/download/module.json",
   "download": "https://github.com/The-RavenKing/chronicle-keeper/releases/latest/download/chronicle-keeper.zip",
   "bugs": "https://github.com/The-RavenKing/chronicle-keeper/issues"
   ```

## 📦 Step-by-Step Submission

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `chronicle-keeper`
3. Description: "AI-powered campaign memory for Foundry VTT"
4. Public repository
5. Don't initialize with README (we have one)
6. Create repository

### Step 2: Push Code to GitHub

```bash
cd /path/to/chronicle-keeper

# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial release v1.0.0"

# Add your GitHub repo as remote (replace The-RavenKing!)
git remote add origin https://github.com/The-RavenKing/chronicle-keeper.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Create Images

Create these images (see `assets/README.md` for details):
1. **Icon**: `assets/icon.png` (128x128 or 256x256)
2. **Cover**: `assets/cover.png` (1200x400)

Then add and commit:
```bash
git add assets/icon.png assets/cover.png
git commit -m "Add module icon and cover image"
git push
```

### Step 4: Update module.json

Edit `module.json` and replace:
- `The-RavenKing` with your actual GitHub username (in all URLs)
- Author name, email, URL

Then commit:
```bash
git add module.json
git commit -m "Update URLs and author info"
git push
```

### Step 5: Create First Release

1. Go to your repo: `https://github.com/The-RavenKing/chronicle-keeper`
2. Click **Releases** → **Create a new release**
3. Click **Choose a tag** → Type `v1.0.0` → **Create new tag**
4. Release title: `v1.0.0 - Initial Release`
5. Description:
   ```markdown
   # Chronicle Keeper v1.0.0
   
   Initial release of Chronicle Keeper - AI-powered campaign memory for Foundry VTT!
   
   ## Features
   - Automatic conversation memory
   - Content ingestion from journals, characters, NPCs, scenes
   - Custom AI system prompts
   - GM Only Mode for spoiler protection
   - Whisper commands for private conversations
   - Campaign separation
   
   ## Installation
   1. Install Ollama from ollama.ai
   2. Pull model: `ollama pull llama2:7b`
   3. Start Ollama: `ollama serve`
   4. Install module in Foundry VTT
   5. Configure and use `/ingest` to load campaign
   
   See README for full documentation.
   ```
6. Click **Publish release**

The GitHub Action will automatically:
- Create `chronicle-keeper.zip`
- Upload it to the release
- Upload `module.json` to the release

### Step 6: Test Installation

1. Open Foundry VTT
2. Go to **Add-on Modules** → **Install Module**
3. Paste your manifest URL:
   ```
   https://github.com/The-RavenKing/chronicle-keeper/releases/latest/download/module.json
   ```
4. Click **Install**
5. Test that it works!

### Step 7: Submit to Foundry VTT

#### Option A: Foundry Hub (Recommended)
1. Go to https://foundryvtt.com/packages/submit
2. Log in to your Foundry account
3. Click **Submit Package**
4. Fill out the form:
   - **Package Type**: Module
   - **Package Name**: Chronicle Keeper
   - **Manifest URL**: `https://github.com/The-RavenKing/chronicle-keeper/releases/latest/download/module.json`
5. Submit and wait for approval

#### Option B: Community List
1. Fork https://github.com/foundry-vtt-community/modules
2. Edit `modules.json`
3. Add your module:
   ```json
   {
     "name": "chronicle-keeper",
     "title": "Chronicle Keeper",
     "description": "AI-powered campaign memory assistant",
     "version": "1.0.0",
     "manifest": "https://github.com/The-RavenKing/chronicle-keeper/releases/latest/download/module.json",
     "compatibility": {
       "minimum": "11",
       "verified": "13"
     }
   }
   ```
4. Create Pull Request

## 🎨 Quick Image Creation

If you need to create images quickly:

### Icon (Simple Version)
1. Open Canva
2. Create 256x256 custom size
3. Add text "CK" in fantasy font
4. Add book/scroll background
5. Download as PNG

### Cover (Simple Version)
1. Open Canva
2. Create 1200x400 custom size
3. Use fantasy RPG template
4. Add text "Chronicle Keeper"
5. Add subtitle "AI Campaign Memory"
6. Download as PNG

## 📋 Submission Form Details

When submitting to Foundry, you'll need:

**Required:**
- Module name: Chronicle Keeper
- Short description: AI-powered campaign memory assistant
- Manifest URL: Your GitHub releases manifest
- License: MIT
- Author: Your name

**Recommended:**
- Tags: ai, campaign-management, npc, gm-tools, utility
- Systems: Universal (works with all systems)
- Languages: English
- Links: GitHub repository

## 🔄 Future Updates

When you release updates:

1. Update version in `module.json`
2. Update `CHANGELOG.md` with changes
3. Commit and push
4. Create new release on GitHub (e.g., `v1.1.0`)
5. GitHub Action automatically builds and uploads
6. Foundry users get update notification automatically!

## ⚠️ Important Notes

### Before First Submission
- [ ] Update author info in module.json
- [ ] Update all GitHub URLs in module.json
- [ ] Create icon and cover images
- [ ] Test installation from your GitHub release
- [ ] Verify all commands work
- [ ] Test with fresh Foundry install

### Foundry Requirements
- Module must be free to use
- Source code must be available
- Must follow Foundry's module standards
- No paywall for core functionality

## 🎉 After Approval

Once approved by Foundry:
1. Your module appears in the official module list
2. Users can install directly from Foundry
3. Share on:
   - Foundry VTT Discord
   - Reddit r/FoundryVTT
   - Twitter/X with #FoundryVTT

## 📞 Help

If you have questions:
- Foundry Discord: #module-development
- Foundry Forums: https://forums.forge-vtt.com
- Foundry Package Submission: https://foundryvtt.com/packages/submit

## 🚀 You're Ready!

Everything is prepared for submission. Just:
1. Create images
2. Update author info
3. Push to GitHub
4. Create release
5. Submit to Foundry

Good luck! 🎲✨
