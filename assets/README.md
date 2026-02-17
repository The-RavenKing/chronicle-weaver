# Assets Needed for Publication

To publish Chronicle Keeper on Foundry VTT, you'll need these images:

## Required Images

### 1. Icon (Required)
- **File**: `assets/icon.png`
- **Size**: 128x128 pixels minimum (256x256 recommended)
- **Format**: PNG with transparency
- **Content**: Simple, recognizable symbol representing Chronicle Keeper
- **Suggestions**:
  - Book with a quill
  - Scroll with magical glow
  - Crystal ball with memory symbols
  - Open journal with glowing pages

### 2. Cover/Banner (Recommended)
- **File**: `assets/cover.png`
- **Size**: 1200x400 pixels (or 3:1 aspect ratio)
- **Format**: PNG or JPG
- **Content**: Attractive banner showing the module in action
- **Suggestions**:
  - Screenshot of Chronicle Keeper in use
  - Fantasy-themed artwork with "Chronicle Keeper" text
  - Stylized representation of AI + RPG elements

## Where to Create These

### Free Options
1. **Canva** (canva.com) - Easy templates
2. **GIMP** (gimp.org) - Free Photoshop alternative
3. **Photopea** (photopea.com) - Online Photoshop alternative
4. **Figma** (figma.com) - Professional design tool

### AI Generation
1. **DALL-E** - Generate custom artwork
2. **Midjourney** - High-quality fantasy art
3. **Stable Diffusion** - Free AI image generation

### Icon Ideas (Prompts)
- "Simple icon of an open book with a quill, fantasy RPG style, transparent background"
- "Minimalist scroll with glowing magical text, icon style, dark background"
- "Crystal ball showing swirling memories, icon design, 128x128"

### Banner Ideas (Prompts)
- "Fantasy RPG game master with magical AI assistant, wide banner, cinematic"
- "Open spellbook with glowing digital text merging with handwritten notes, banner format"
- "Medieval scribe writing in a book with holographic data floating above, wide format"

## Current Status

The module.json points to:
- `assets/icon.png` (doesn't exist yet)
- `assets/cover.png` (doesn't exist yet)

You need to create these before publishing!

## Quick Temporary Solution

If you need to publish immediately, you can:
1. Remove the `media` section from module.json
2. Add images later via GitHub release

Or use simple placeholder text:
1. Create 128x128 image with "CK" text
2. Create 1200x400 banner with "Chronicle Keeper" text

## After Creating Images

1. Place them in `assets/` folder
2. Update URLs in module.json (if hosting on GitHub)
3. Test that images load in Foundry
4. Commit to your repository

The URLs in module.json should match your GitHub repository structure.
