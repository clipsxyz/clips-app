# Avatar Assets Guide - Voice Clip Animation

## Best Option: **Frame Sequences** (Individual Images)

For the **highest quality** animated avatars with lip-sync, **Frame Sequences** is the best choice.

### Why Frame Sequences?

1. **Highest Quality**
   - Each frame is individually optimized
   - No compression artifacts from combining frames
   - Can use different resolutions per frame if needed
   - Better image quality than sprite sheets

2. **Perfect Lip-Sync**
   - Each mouth shape can be a separate frame
   - Smooth transitions between mouth shapes
   - Can have multiple frames per phoneme
   - Precise timing control

3. **Flexible Animation**
   - Different expressions per frame
   - Can mix and match frames
   - Easy to add new animations
   - Better control over animation timing

4. **Easy to Update**
   - Replace individual frames without affecting others
   - Add new expressions easily
   - Update lip-sync frames independently

### Recommended Structure

```
/public/assets/avatars/
  avatar1/
    idle/
      idle-1.png
      idle-2.png
      idle-3.png
      idle-4.png
    excited/
      excited-1.png
      excited-2.png
      excited-3.png
      excited-4.png
    happy/
      happy-1.png
      happy-2.png
      happy-3.png
      happy-4.png
    talking/
      talking-closed-1.png
      talking-closed-2.png
      talking-open-1.png
      talking-open-2.png
      talking-oh-1.png
      talking-oh-2.png
      talking-smile-1.png
      talking-smile-2.png
      talking-f-1.png
      talking-f-2.png
      talking-th-1.png
      talking-th-2.png
```

### Frame Specifications

- **Resolution**: 720x1280 (portrait) or 1080x1920 for higher quality
- **Format**: PNG with transparency
- **Frame Rate**: 30fps (30 frames per second)
- **Idle Animation**: 4-8 frames loop
- **Expression Animations**: 4-8 frames each
- **Talking Frames**: 2-4 frames per mouth shape

### Example Configuration

```typescript
{
  id: 'avatar1',
  name: 'Happy Guy',
  frames: {
    idle: [
      '/assets/avatars/avatar1/idle/idle-1.png',
      '/assets/avatars/avatar1/idle/idle-2.png',
      '/assets/avatars/avatar1/idle/idle-3.png',
      '/assets/avatars/avatar1/idle/idle-4.png',
    ],
    excited: [
      '/assets/avatars/avatar1/excited/excited-1.png',
      '/assets/avatars/avatar1/excited/excited-2.png',
      '/assets/avatars/avatar1/excited/excited-3.png',
      '/assets/avatars/avatar1/excited/excited-4.png',
    ],
    happy: [
      '/assets/avatars/avatar1/happy/happy-1.png',
      '/assets/avatars/avatar1/happy/happy-2.png',
      '/assets/avatars/avatar1/happy/happy-3.png',
      '/assets/avatars/avatar1/happy/happy-4.png',
    ],
    calm: [
      '/assets/avatars/avatar1/calm/calm-1.png',
      '/assets/avatars/avatar1/calm/calm-2.png',
      '/assets/avatars/avatar1/calm/calm-3.png',
      '/assets/avatars/avatar1/calm/calm-4.png',
    ],
    talking: [
      // Closed mouth
      '/assets/avatars/avatar1/talking/talking-closed-1.png',
      '/assets/avatars/avatar1/talking/talking-closed-2.png',
      // Open mouth
      '/assets/avatars/avatar1/talking/talking-open-1.png',
      '/assets/avatars/avatar1/talking/talking-open-2.png',
      // Oh sound
      '/assets/avatars/avatar1/talking/talking-oh-1.png',
      '/assets/avatars/avatar1/talking/talking-oh-2.png',
      // Smile
      '/assets/avatars/avatar1/talking/talking-smile-1.png',
      '/assets/avatars/avatar1/talking/talking-smile-2.png',
      // F sound
      '/assets/avatars/avatar1/talking/talking-f-1.png',
      '/assets/avatars/avatar1/talking/talking-f-2.png',
      // TH sound
      '/assets/avatars/avatar1/talking/talking-th-1.png',
      '/assets/avatars/avatar1/talking/talking-th-2.png',
    ],
  },
}
```

### Comparison with Other Options

#### Frame Sequences vs Sprite Sheet
- ✅ Better quality (no compression artifacts)
- ✅ Easier to update individual frames
- ✅ More flexible animation control
- ❌ More HTTP requests (can be optimized with preloading)

#### Frame Sequences vs Single Image
- ✅ Supports animation
- ✅ Supports lip-sync
- ✅ Supports different expressions
- ❌ More files to manage

### Performance Optimization

1. **Preload all frames** before animation starts
2. **Use WebP format** for smaller file sizes (with PNG fallback)
3. **Lazy load** frames that aren't immediately needed
4. **Cache frames** in memory after first load

### Next Steps

1. Create or source avatar frame sequences
2. Organize them in the recommended folder structure
3. Update the avatar configuration in `avatarSpriteRenderer.ts`
4. Test lip-sync with different voice clips


