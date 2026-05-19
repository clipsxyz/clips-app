# Native App Feature Audit

> **Status (May 2026):** Core native parity is largely complete. Sections below include **historical** notes from Dec 2024; trust the status summary first.

**React Native:** 0.85.x · **Dual client:** `src/` (web) + `App.native.tsx` / `src/screens/` (native)

## ✅ Native parity — current (May 2026)

| Area | Status |
|------|--------|
| Main tabs (Home, Discover, Create, Search, Inbox) | ✅ |
| Instant create + gallery preview + filters | ✅ |
| Create composer (stickers, filters, cover frame) | ✅ |
| Text-only create + details + templates | ✅ |
| Public post deep links | ✅ |
| Profile cover + API `profile_background_url` | ✅ |
| Feed video autoplay + playback settings | ✅ |
| Instagram-style video compress + filter bake (FFmpeg) | ✅ (after `npm run setup:ffmpeg-native`) |
| Background post → feed “Posting…” placeholder | ✅ |
| Payment, splash, landing, stories, boost, etc. | ✅ (see `App.native.tsx`) |

## 🎨 Polish (May 2026)

- Composer: stickers, haptics, keyboard dismiss; filters baked via FFmpeg when binaries installed
- Feed: text-only cards, posters, autoplay, pending upload row at top
- Video: cover frame only (no trim); compress before upload

## FFmpeg native setup (required for video compress / filter bake)

Arthenica binaries were retired from Maven/CocoaPods. Use vendored **de-id/ffmpeg-kit** builds:

```bash
npm run setup:ffmpeg-native   # once per machine / CI
cd ios && pod install
npm run dev:android   # or dev:ios
```

## ⏭️ Intentionally not ported

- Full video editor, Canva editor, template browser/editor
- Web-only create extras: music picker, multi-clip timeline, green screen, voiceover

## 📜 Historical audit (Dec 2024)

---

## ✅ Features Ported (Dec 2024)

1. **ZoomableMedia Component** - Pinch-to-zoom for images/videos
2. **Profile Tabs** - Messages, Drafts, Collections, Settings
3. **Traveled Feature** - Places traveled button and modal
4. **Handle Generation** - Using regional location (e.g., `Barry@Dublin`)
5. **Header Updates** - "Stories" → "Shorts", increased font sizes
6. **CollectionFeed Screen** - View collection posts

---

## ❌ Missing Pages/Screens (historical — many since added)

### 1. **SplashPage** → was missing; now `SplashScreen` in native
- **Web:** `/splash` - Animated splash screen with logo
- **Native (2024):** ❌ No splash screen

### 2. **PaymentPage** → was missing; now `PaymentScreen` in native
- **Web:** `/payment` - Payment processing page
- **Native:** ❌ No payment screen
- **Impact:** Cannot process payments in native app
- **Priority:** High (if payments are required)

### 3. **InstantCreatePage** → Missing in Native
- **Web:** `/create/instant` - Camera recording with multi-clip support
- **Native:** ❌ No instant create flow
- **Impact:** Missing core video creation feature
- **Priority:** High

### 4. **InstantFiltersPage** → Missing in Native
- **Web:** `/create/filters` - Video filters and adjustments
- **Native:** ❌ No filters page
- **Impact:** Cannot apply filters to videos
- **Priority:** High

### 5. **VideoEditorPage** → Missing in Native
- **Web:** `/video-editor` - Full video editing interface
- **Native:** ❌ No video editor
- **Impact:** Missing advanced video editing
- **Priority:** Medium

### 6. **CanvaVideoEditor** → Missing in Native
- **Web:** `/create/video-editor` - Canva-style video editor
- **Native:** ❌ No Canva editor
- **Impact:** Missing template-based editing
- **Priority:** Medium

### 7. **TemplatesPage** → Missing in Native
- **Web:** `/templates` - Browse video templates
- **Native:** ❌ No templates page
- **Impact:** Cannot browse templates
- **Priority:** Medium

### 8. **TemplateEditorPage** → Missing in Native
- **Web:** `/template-editor` - Edit video templates
- **Native:** ❌ No template editor
- **Impact:** Cannot edit templates
- **Priority:** Medium

### 9. **TextOnlyPostPage** → Missing in Native
- **Web:** `/create/text-only` - Create text-only posts
- **Native:** ❌ No text-only post creation
- **Impact:** Cannot create text posts
- **Priority:** Low

### 10. **TextOnlyPostDetailsPage** → Missing in Native
- **Web:** `/create/text-only/details` - Text post details
- **Native:** ❌ No text post details
- **Impact:** Missing text post flow
- **Priority:** Low

---

## ⚠️ Incomplete Features

### 1. **CreateScreen** - Severely Limited
- **Web CreatePage Features:**
  - ✅ Media selection (image/video)
  - ✅ Text captions
  - ✅ Location tagging
  - ✅ Stickers (animated, text, user tags)
  - ✅ Music picker
  - ✅ Filters and adjustments
  - ✅ Multi-clip support
  - ✅ Video trimming
  - ✅ Speed control
  - ✅ Reverse video
  - ✅ Green screen
  - ✅ Voiceover
  - ✅ Text overlays
  - ✅ Banner text (news ticker)
  - ✅ Boost option
  - ✅ Save to drafts
  - ✅ Template support

- **Native CreateScreen Features:**
  - ✅ Basic media selection
  - ✅ Text captions
  - ✅ Location tagging
  - ❌ No stickers
  - ❌ No music picker
  - ❌ No filters
  - ❌ No multi-clip support
  - ❌ No video trimming
  - ❌ No speed control
  - ❌ No reverse video
  - ❌ No green screen
  - ❌ No voiceover
  - ❌ No text overlays
  - ❌ No banner text
  - ❌ No boost option
  - ❌ No save to drafts
  - ❌ No template support

**Priority:** High - Core feature is incomplete

### 2. **ProfileScreen** - Missing Profile Editing
- **Web ProfilePage Features:**
  - ✅ View profile
  - ✅ Edit bio
  - ✅ Edit social links (website, X, Instagram, TikTok)
  - ✅ Edit location (national, regional, local)
  - ✅ Edit country flag
  - ✅ Edit places traveled
  - ✅ Change profile picture
  - ✅ Toggle privacy (public/private)
  - ✅ View collections
  - ✅ View drafts
  - ✅ Settings

- **Native ProfileScreen Features:**
  - ✅ View profile
  - ✅ View collections
  - ✅ View drafts
  - ✅ Settings (logout only)
  - ❌ No profile editing
  - ❌ No bio editing
  - ❌ No social links editing
  - ❌ No location editing
  - ❌ No country flag editing
  - ❌ No places traveled editing
  - ❌ No profile picture change
  - ❌ No privacy toggle

**Priority:** High - Users cannot edit their profile

### 3. **ViewProfileScreen** - Missing Features
- **Web ViewProfilePage Features:**
  - ✅ World map background
  - ✅ "Passport" title with Instagram-style font
  - ✅ Profile picture overlay
  - ✅ Follow/Message buttons
  - ✅ Traveled button
  - ✅ Social links display
  - ✅ Bio display
  - ✅ Stats (following, followers, views, likes)
  - ✅ Posts grid
  - ✅ Stories integration

- **Native ViewProfileScreen Features:**
  - ❌ No world map background
  - ❌ No "Passport" title styling
  - ✅ Profile picture
  - ✅ Follow/Message buttons
  - ✅ Traveled button (ported today)
  - ❌ No social links display
  - ✅ Bio display
  - ✅ Stats (posts, followers, following)
  - ✅ Posts grid
  - ✅ Stories integration

**Priority:** Medium - Missing visual polish

### 4. **FeedScreen** - Missing Zoom Feature
- **Web Feed Features:**
  - ✅ ZoomableMedia component (pinch-to-zoom)
  - ✅ All other feed features

- **Native FeedScreen Features:**
  - ❌ ZoomableMedia not integrated
  - ✅ All other feed features

**Priority:** Medium - Zoom was created but not integrated

---

## 🔍 Missing Components

### Web-Only Components:
1. **ZoomableMedia.tsx** (web version) - Used in web feed
2. **ProcessingVideoPiP.tsx** - Video processing indicator
3. **QRCodeModal.tsx** - QR code display
4. **Timeline.tsx** - Video timeline editor
5. **EffectWrapper.tsx** - Video effects
6. **StickerOverlay.tsx** - Sticker rendering
7. **StickerPicker.tsx** - Sticker selection
8. **TextStickerModal.tsx** - Text sticker creation
9. **UserTaggingModal.tsx** - User tagging
10. **MusicPicker.tsx** - Music selection
11. **GifPicker.tsx** - GIF selection
12. **BoostSelectionModal.tsx** - Boost options
13. **SavePostModal.tsx** - Save post to collections
14. **EditPostModal.tsx** - Edit existing posts
15. **PostMenuModal.tsx** - Post menu options
16. **ScenesModal.tsx** - View post scenes
17. **ShareModal.tsx** - Share post
18. **CommentsModal.tsx** - Comments (may exist in native)
19. **CreateModal.tsx** - Create post modal
20. **TaggedUsersBottomSheet.tsx** - Tagged users list

**Note:** Some of these may need native equivalents or may not be applicable to native.

---

## 📊 Feature Completeness Summary

### Core Features:
- **Feed:** 95% complete (missing zoom integration)
- **Profile View:** 80% complete (missing editing)
- **Create Post:** 20% complete (severely limited)
- **Stories/Shorts:** 100% complete ✅
- **Discover:** 100% complete ✅
- **Search:** 90% complete (similar to web, may need UI polish)
- **Messages/Inbox:** 85% complete (similar to web, may need UI polish)
- **Collections:** 90% complete (missing some UI polish)
- **View Profile:** 70% complete (missing visual polish)

### Advanced Features:
- **Video Editing:** 0% complete ❌
- **Templates:** 0% complete ❌
- **Filters:** 0% complete ❌
- **Stickers:** 0% complete ❌
- **Music:** 0% complete ❌
- **Payment:** 0% complete ❌
- **Splash Screen:** 0% complete ❌

---

## 🎯 Priority Recommendations

### **Critical (Must Have):**
1. **Profile Editing** - Users need to edit their profiles
2. **Create Post Enhancement** - Core feature is too limited
3. **Zoom Integration** - Add ZoomableMedia to FeedScreen

### **High Priority:**
4. **Instant Create Flow** - Camera recording with multi-clip
5. **Filters Page** - Video filters and adjustments
6. **Stickers Support** - Add stickers to CreateScreen
7. **Music Picker** - Add music to posts

### **Medium Priority:**
8. **Video Editor** - Full editing capabilities
9. **Templates** - Template browsing and editing
10. **ViewProfile Polish** - World map, Passport styling
11. **Splash Screen** - Branded app launch

### **Low Priority:**
12. **Text-Only Posts** - If needed
13. **Payment Page** - If payments are required
14. **Advanced Features** - Green screen, voiceover, etc.

---

## 📝 Notes

- **ZoomableMedia.native.tsx** was created but not integrated into FeedScreen
- **Collections** functionality exists but may need UI improvements
- **Drafts** functionality exists but may need improvements
- Some web components use browser-specific APIs that need native equivalents
- Video processing may require native libraries (FFmpeg, etc.)

---

## 🔄 Next Steps

1. **Immediate:** Integrate ZoomableMedia into FeedScreen
2. **Short-term:** Add profile editing to ProfileScreen
3. **Short-term:** Enhance CreateScreen with stickers, music, filters
4. **Medium-term:** Port InstantCreatePage and InstantFiltersPage
5. **Long-term:** Port video editor and templates

---

**Last Updated:** 2024-12-20

