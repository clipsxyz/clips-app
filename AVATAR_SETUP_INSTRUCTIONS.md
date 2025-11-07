# Avatar Frame Sequences Setup Guide

## Quick Start

1. **Create folder structure** in your `public` directory:
```
public/
  assets/
    avatars/
      avatar1/
        idle/
        excited/
        happy/
        calm/
        talking/
```

2. **Add your avatar frame images** to the appropriate folders

3. **Update the configuration** in `src/utils/avatarSpriteRenderer.ts`:
   - Uncomment and update the frame URLs in `getAvatarSpriteConfig()`
   - Replace placeholder paths with your actual image paths

## Example Configuration

Once you have your images, update the config like this:

```typescript
avatar1: {
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
        // ... etc
    },
}
```

## Current Status

✅ **System is ready** - Frame sequence renderer is implemented
✅ **Lip-sync ready** - Mouth shape detection integrated
✅ **Background ready** - Cityscape background implemented
⏳ **Waiting for assets** - Add your avatar frame images

## Testing

Once you add your images:
1. Record a voice clip
2. Select an avatar
3. The system will automatically use your frame sequences
4. If frames aren't found, it falls back to programmatic drawing

## Next Steps

1. Create or source your avatar frame sequences
2. Place them in the `public/assets/avatars/` folder
3. Update the configuration file
4. Test with voice clips!


