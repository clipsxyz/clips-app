# Avatar Assets Sourcing Guide

## Where to Get Avatar Frame Sequences

Since I can't directly download files, here are the best resources for getting avatar frame sequences matching your image spec:

### 1. **Free Resources**

#### OpenGameArt.org
- **URL**: https://opengameart.org
- **Search**: "character sprite", "avatar animation", "2D character"
- **Format**: Sprite sheets and frame sequences
- **License**: Check individual licenses (usually CC0 or CC-BY)

#### Itch.io (Free Assets)
- **URL**: https://itch.io/game-assets/free
- **Search**: "character sprite", "avatar frames", "2D character animation"
- **Format**: Sprite sheets, frame sequences
- **License**: Check individual licenses

#### Craftpix.net
- **URL**: https://craftpix.net/freebies/
- **Format**: Sprite sheets with multiple frames
- **License**: Free with attribution

### 2. **Paid Resources (High Quality)**

#### Unity Asset Store
- **URL**: https://assetstore.unity.com
- **Search**: "2D character", "avatar animation", "sprite character"
- **Quality**: Professional grade
- **Price**: $5-$50 typically

#### GameDev Market
- **URL**: https://www.gamedevmarket.net
- **Search**: "2D character", "avatar sprite"
- **Quality**: High quality
- **Price**: $5-$30

#### Fiverr (Custom Creation)
- **URL**: https://www.fiverr.com
- **Search**: "2D character animation", "sprite sheet creation", "avatar animation frames"
- **Quality**: Custom made to your spec
- **Price**: $20-$200 depending on complexity

### 3. **AI Generation Tools**

#### DALL-E / Midjourney
- Create base character images
- Then use animation tools to create frame sequences
- **Note**: You'll need to create multiple frames manually or use animation software

#### Stable Diffusion
- Generate character images
- Use ControlNet for consistent character generation
- Create frame sequences from generated images

### 4. **Animation Software (Create Your Own)**

#### Adobe Animate / Flash
- Professional animation tool
- Export frame sequences
- Best for creating custom avatars

#### Aseprite
- **URL**: https://www.aseprite.org
- Pixel art animation tool
- Export sprite sheets or individual frames
- **Price**: $20 (one-time)

#### Piskel (Free Online)
- **URL**: https://www.piskelapp.com
- Free pixel art editor
- Create frame-by-frame animations
- Export as sprite sheets

### 5. **Recommended Approach**

For your use case (matching the image you showed), I recommend:

1. **Option A: Hire a Fiverr Artist**
   - Show them your reference image
   - Request frame sequences for:
     - Idle animation (4-8 frames)
     - Excited animation (4-8 frames)
     - Happy animation (4-8 frames)
     - Calm animation (4-8 frames)
     - Talking frames with different mouth shapes (12-20 frames)
   - Request both male and female versions
   - **Cost**: $50-$150 per avatar

2. **Option B: Use Free Sprite Sheets**
   - Download from OpenGameArt or Itch.io
   - Extract individual frames using a sprite sheet splitter
   - Organize into the folder structure
   - **Cost**: Free (with attribution)

3. **Option C: Use ReadyPlayerMe or Similar**
   - **URL**: https://readyplayer.me
   - Create 3D avatars
   - Export as 2D sprite sequences
   - **Cost**: Free tier available

### 6. **Frame Requirements**

For each avatar, you need:

**Idle Animation**: 4-8 frames
- Character standing still with subtle movement
- Loop seamlessly

**Excited Animation**: 4-8 frames
- Character with raised hands, big smile
- Bouncing/jumping motion

**Happy Animation**: 4-8 frames
- Character with smile, relaxed pose
- Gentle movement

**Calm Animation**: 4-8 frames
- Character in relaxed pose
- Minimal movement

**Talking Frames**: 12-20 frames
- Closed mouth (2 frames)
- Open mouth (2 frames)
- Oh sound (2 frames)
- Smile (2 frames)
- F sound (2 frames)
- TH sound (2 frames)
- Additional variations for smooth lip-sync

### 7. **Image Specifications**

- **Resolution**: 720x1280 (portrait) or 1080x1920 for higher quality
- **Format**: PNG with transparency
- **Background**: Transparent
- **Style**: Match your reference image (cheerful cartoon style)
- **Colors**: Match your reference (orange hoodie, brown curly hair, etc.)

### 8. **Quick Start**

1. Go to https://opengameart.org
2. Search for "2D character sprite"
3. Download a sprite sheet
4. Use a sprite sheet splitter (online tool) to extract frames
5. Organize frames into folders
6. Update the configuration in `src/utils/avatarSpriteRenderer.ts`

### 9. **Sprite Sheet Splitter Tools**

- **Online**: https://ezgif.com/sprite-cutter
- **Desktop**: TexturePacker (free version available)
- **Online**: https://www.codeandweb.com/free-sprite-sheet-packer

### Next Steps

Once you have your avatar frames:
1. Place them in `public/assets/avatars/avatar1/` (etc.)
2. Update the frame URLs in `src/utils/avatarSpriteRenderer.ts`
3. Test with voice clips!

The system is ready - it just needs your avatar images! 🎨


