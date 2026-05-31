# RN Home feed parity checklist (vs web)

Use this on **Nokia + web `/feed`** side-by-side.  
**Mode:** mock/demo (Sarah/Bob sample MP4s are expected — not a bug).

## Before you start

- Nokia: **Ireland** tab, not a custom location search feed.
- Web: same — Home `/feed`, Ireland (or your national tab).
- Reload RN after code changes: Metro → shake → **Reload** (no APK rebuild for JS-only changes).

---

## Header (single row — web PillTabs)

- [ ] **Stories** icon + label on the left (opens Stories 24)
- [ ] **Location picker** in the center (Ireland / Dublin / menu)
- [ ] **Passport** avatar + label on the right (opens profile)
- [ ] **No** second row with large "Gazetteer" title + duplicate pills

## Feed chrome

- [ ] Animated discover ambient background (gradient wave + halftone), not flat gray
- [ ] Posts scroll under the sticky header
- [ ] Pull-to-refresh reloads posts
- [ ] **Offline banner** when airplane mode: "You're offline…"
- [ ] **Loading skeletons** (2 pulsing gray cards) on first open, not only a spinner
- [ ] **Error + Retry** if feed fails (hard to force — optional)

## Injected feed cards (Ireland home only)

- [ ] **Stories 24** rail after the **1st post**
- [ ] **Local business** strip (~2nd post area) or preview on Ireland feed
- [ ] **Suggested follower** card after **3rd post** (if data allows)
- [ ] **Suggested places** strip (users from places you like)
- [ ] **Interests onboarding** card after **4th post**
- [ ] **Ad card** (if active ads in mock/API)

## Post cards

- [ ] Image/video posts show media (mock MP4s from Sarah@Artane / Bob@Ireland OK in demo)
- [ ] Text-only posts use bubble layout
- [ ] Engagement row: like, comment, reclip, save, share
- [ ] Video: **Scenes** overlay works
- [ ] Tap post / caption → Post detail
- [ ] Tap avatar / handle → Profile

## Bottom nav

- [ ] **Square icon** boxes (filled when active, white border when inactive)
- [ ] **Add Yours** gold bubble on **Create** tab ~1s after landing on Home
- [ ] **Inbox badge** counts notifications + DMs (not DMs only)

## Stability (Nokia)

- [ ] App opens to Home (not blank)
- [ ] Scroll feels acceptable (ambient throttled on Android)
- [ ] If feed crashes, "Home feed failed" message (not empty screen)

---

## Mock feed note

RN defaults to **mock mode** unless Laravel is enabled. Sample videos use Google test URLs (`ForBiggerEscapes.mp4`, etc.) for Scenes testing. Web may show different posts if it uses the live API.

---

## Not in this milestone

Profile tab in bottom bar, Create/Profile deep parity, Clip studio, Stripe, Search/Discover full parity.

## After Home is checked off

Next screens: **Search** tab, **Discover** (header menu), then Profile/Create.
