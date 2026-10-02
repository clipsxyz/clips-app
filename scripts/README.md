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





















## Dev bootstrap (LAN IP auto-repair + stale asset guard)

`scripts/lib/dev-bundle-bootstrap.cjs` owns all of this. It is invoked from
`metro.config.cjs`, which is the **only** seam every launch style shares:

    npm start                 -> prestart? no. metro.config.cjs loads.
    npx react-native start    -> metro.config.cjs loads.
    npx expo start            -> metro.config.cjs loads.

There is deliberately **no `prestart` script**. An npm `prestart` hook fires only for
`npm start`, so it never covered the `npx` paths, and keeping both meant every
`npm start` ran the adb round-trips twice.

| Command | Purpose |
| --- | --- |
| `npm run android:dev-host` | Detect LAN IP, push `debug_http_host`, verify |
| `npm run android:dev-host -- --check` | Audit only; exits 1 on drift |
| `npm run android:dev-host -- --print` | List LAN candidates; touches nothing |
| `npm run android:asset-bundle` | Rebuild the embedded APK JS snapshot |
| `npm run android:asset-bundle -- --check` | Exit 1 when the snapshot is stale |

### Env switches

| Variable | Effect |
| --- | --- |
| `GAZETTEER_SKIP_BOOTSTRAP=1` | Disable entirely. Exported to the child of the background asset rebuild so `react-native bundle` re-loading this config cannot recurse. |
| `GAZETTEER_NO_AUTO_BUNDLE=1` | Report a stale snapshot instead of rebuilding it |
| `GAZETTEER_PROBE_DEVICE=1` | Probe device reachability from inside Metro (off by default — see below) |
| `GAZETTEER_BOOTSTRAP_DEBUG=1` | Print raw adb probe failures |

### Why Metro does not probe the device

Metro is single-threaded and spends startup transforming the bundle. A `/status`
request from the device queues behind that work and misses the probe timeout, so the
probe reports "cannot reach Metro" for a device that is reachable moments later. The
identical command returns in ~0.2s from an idle shell. A false alarm here sends you
chasing a network fault that does not exist, so the check lives in the CLI instead
(`npm run android:dev-host -- --check`), which runs outside the bundler.

### Why no `--reset-cache` in the auto-repair

`react-native bundle` loads `metro.config.cjs` too. Resetting the cache from inside
that path would wipe the cache of the server currently serving the developer. The
background repair therefore never passes it; the standalone rebuild accepts
`--reset-cache` as an explicit opt-in.
