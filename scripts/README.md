# Music Library Scripts

## Fetch Royalty-Free Music from Pixabay

This script automatically fetches CC0/royalty-free music tracks from Pixabay's API and formats them for use in the app.

### Setup

1. **Get a free Pixabay API key:**
   - Visit: https://pixabay.com/accounts/register/
   - Sign up for a free account
   - Get your API key from the dashboard

2. **Install dependencies:**
   ```bash
   npm install node-fetch
   ```

3. **Set your API key:**
   
   **Option 1: Environment variable (recommended)**
   ```bash
   export PIXABAY_API_KEY=your_api_key_here
   ```
   
   **Option 2: Edit the script**
   - Open `scripts/fetchRoyaltyFreeMusic.js`
   - Replace `YOUR_PIXABAY_API_KEY` with your actual key

4. **Run the script:**
   ```bash
   node scripts/fetchRoyaltyFreeMusic.js
   ```

### Output

The script generates `royaltyFreeMusic.json` in the project root with:
- Track metadata (title, artist, cover image)
- MP3 URLs for preview and download
- Genre and mood tags
- License information (CC0)

### Next Steps

1. Review the generated `royaltyFreeMusic.json`
2. Import tracks into your Laravel seeder or use directly in React
3. Download actual MP3 files if needed for local storage

### Alternative Sources

You can also manually add tracks from:
- **FreePD** - https://freepd.com/ (100% free, public domain)
- **Free Music Archive** - https://freemusicarchive.org/ (various CC licenses)
- **MusOpen** - https://musopen.org/ (classical/public domain)
- **OpenGameArt** - https://opengameart.org/ (game-style music)

### License Notes

- **CC0** = No attribution required, free for commercial use ✅
- **CC-BY** = Attribution required
- **CC-BY-SA** = Attribution + ShareAlike required
- Always check individual track licenses before commercial use



















