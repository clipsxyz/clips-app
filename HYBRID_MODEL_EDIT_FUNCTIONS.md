# Hybrid Model - All Available Edit Functions

## Overview
The hybrid model provides **real-time preview** in the frontend (WebGL) and **final render** in the backend (FFmpeg). All edits are applied to the final video via the `editTimeline` object.

---

## ✅ **Currently Implemented Edit Functions**

### 1. **Video Filters** (Color Effects)
- **Frontend**: Real-time WebGL preview
- **Backend**: Applied via FFmpeg color filters
- **Available Filters**:
  - `None` - No filter
  - `B&W` - Black & White
  - `Sepia` - Vintage sepia tone
  - `Vivid` - Enhanced saturation and contrast
  - `Cool` - Cool color temperature
  - `Vignette` - Darkened edges
  - `Beauty` - Softening/skin smoothing

### 2. **Color Adjustments** (Per-clip)
- **Brightness**: Range 0.4 - 1.8 (default: 1.0)
- **Contrast**: Range 0.5 - 2.0 (default: 1.0)
- **Saturation**: Range 0.0 - 2.0 (default: 1.0)
- **Hue**: Range -1.0 - 1.0 (default: 0.0)
- **Frontend**: Real-time WebGL preview
- **Backend**: Applied via FFmpeg `eq` filter

### 3. **LUT (Look-Up Table) Color Grading**
- **Preset LUTs**:
  - Teal & Orange
  - Film Warm
  - Bleach Bypass
  - Cinematic
  - Vintage
  - Dramatic
  - Cool Tone
  - Warm Tone
- **Custom LUT**: Upload PNG LUT files (16³, 32³, 64³ grids)
- **LUT Intensity**: Range 0% - 100%
- **Frontend**: Real-time WebGL preview
- **Backend**: ⚠️ **Not yet implemented** (placeholder in editTimeline)

### 4. **Video Trimming**
- **Trim Start**: Cut from beginning (seconds)
- **Trim End**: Cut from end (seconds)
- **Frontend**: Preview with trimmed video
- **Backend**: Applied via FFmpeg `trim` filter

### 5. **Playback Speed**
- **Speed Multiplier**: 0.5x, 1x, 2x, etc. (default: 1.0)
- **Frontend**: Preview at adjusted speed
- **Backend**: Applied via FFmpeg `setpts` filter

### 6. **Reverse Playback**
- **Reverse**: Boolean (true/false)
- **Frontend**: Preview reversed video
- **Backend**: Applied via FFmpeg `reverse` filter

### 7. **Multi-Clip Editing**
- **Multiple Clips**: Combine multiple video clips
- **Clip Properties**: Each clip can have independent:
  - Trim (start/end)
  - Speed
  - Reverse
  - Filters
  - Color adjustments
- **Frontend**: Preview timeline
- **Backend**: Concatenated via FFmpeg `concat` filter

### 8. **Transitions Between Clips**
- **Transition Types**:
  - `none` - No transition
  - `fade` - Fade in/out
  - `swipe` - Swipe transition
  - `zoom` - Zoom transition
- **Transition Duration**: Configurable (seconds)
- **Frontend**: Preview transitions
- **Backend**: Applied via FFmpeg transition filters

### 9. **Overlays & Stickers**
- **Sticker Types**:
  - Image stickers
  - Text stickers (with custom text, color, font size)
- **Sticker Properties**:
  - Position (x, y as percentages)
  - Scale
  - Rotation
  - Opacity
  - Start time (seconds)
  - End time (seconds)
- **Frontend**: Preview overlays
- **Backend**: Applied via FFmpeg `overlay` and `drawtext` filters

### 10. **Voiceover Audio**
- **Voiceover URL**: Audio file URL
- **Frontend**: Preview with voiceover
- **Backend**: Mixed with video audio via FFmpeg

### 11. **Green Screen / Chroma Key**
- **Green Screen Enabled**: Boolean
- **Background URL**: Replacement background image/video
- **Frontend**: Preview with green screen effect
- **Backend**: Applied via FFmpeg `chromakey` filter

### 12. **Background Music**
- **Music URL**: Audio file URL
- **Frontend**: Preview with music
- **Backend**: Mixed with video audio via FFmpeg

---

## 📋 **EditTimeline Structure**

```typescript
{
  clips: [
    {
      id: string,
      mediaUrl: string,
      type: 'video',
      startTime: number,        // Position in timeline (seconds)
      duration: number,          // Duration in timeline (seconds)
      trimStart: number,         // Trim from start (seconds)
      trimEnd: number,          // Trim from end (seconds)
      speed: number,            // Playback speed multiplier
      reverse: boolean,          // Reverse playback
      originalDuration: number,  // Original video duration
      filters: {
        name: string,            // Filter name (B&W, Sepia, etc.)
        brightness: number,     // 0.4 - 1.8
        contrast: number,       // 0.5 - 2.0
        saturation: number,     // 0.0 - 2.0
        hue: number,            // -1.0 - 1.0
        lut: {                   // LUT info (for future backend support)
          name: string,
          url: string,
          amount: number,       // 0.0 - 1.0
          size: number,         // LUT grid size
          tiles: number          // LUT tile count
        }
      }
    }
  ],
  transitions: [
    {
      id: string,
      type: 'none' | 'fade' | 'swipe' | 'zoom',
      duration: number,
      fromClipIndex: number,
      toClipIndex: number
    }
  ],
  overlays: [
    {
      id: string,
      type: 'sticker',
      stickerId: string,
      sticker: string,          // Sticker URL or text
      x: number,                // Position X (%)
      y: number,               // Position Y (%)
      scale: number,           // Scale factor
      rotation: number,        // Rotation (degrees)
      opacity: number,          // 0.0 - 1.0
      startTime: number,       // Start time (seconds)
      endTime: number,        // End time (seconds)
      textContent?: string,    // For text stickers
      textColor?: string,     // For text stickers
      fontSize?: string        // For text stickers
    }
  ],
  voiceoverUrl?: string,
  greenScreen?: {
    enabled: boolean,
    backgroundUrl: string
  },
  totalDuration: number        // Total timeline duration (max 90s)
}
```

---

## 🎯 **Frontend vs Backend Processing**

### **Frontend (Real-time Preview)**
- ✅ Filters (B&W, Sepia, Vivid, Cool, Vignette, Beauty)
- ✅ Color adjustments (Brightness, Contrast, Saturation, Hue)
- ✅ LUT color grading (with intensity control)
- ✅ Video playback (trim, speed, reverse preview)
- ✅ Multi-clip preview
- ✅ Transitions preview
- ✅ Overlays/stickers preview
- ✅ Voiceover preview
- ✅ Green screen preview

### **Backend (Final Render via FFmpeg)**
- ✅ Filters (via color filters)
- ✅ Color adjustments (via `eq` filter)
- ⚠️ LUT (placeholder in editTimeline, not yet implemented)
- ✅ Video trimming (via `trim` filter)
- ✅ Playback speed (via `setpts` filter)
- ✅ Reverse playback (via `reverse` filter)
- ✅ Multi-clip concatenation (via `concat` filter)
- ✅ Transitions (via transition filters)
- ✅ Overlays/stickers (via `overlay` and `drawtext` filters)
- ✅ Voiceover mixing (via audio mixing)
- ✅ Green screen (via `chromakey` filter)
- ✅ Background music (via audio mixing)

---

## 🚀 **Potential Future Additions**

1. **Text Overlays** (beyond text stickers)
   - Custom fonts
   - Text animations
   - Multiple text layers

2. **Video Effects**
   - Blur
   - Sharpen
   - Glow
   - Motion blur

3. **Audio Effects**
   - Volume control
   - Fade in/out
   - Audio filters (EQ, reverb, etc.)

4. **Advanced Transitions**
   - Wipe
   - Slide
   - Circle
   - Custom transition effects

5. **Keyframe Animation**
   - Animated sticker movement
   - Animated text
   - Animated filters

6. **Video Stabilization**
   - Shake reduction
   - Auto-leveling

7. **Background Replacement**
   - Beyond green screen
   - AI-based background removal

---

## 📝 **Notes**

- **Max Duration**: 90 seconds enforced
- **Format**: Final output is MP4 (H.264) for compatibility
- **Quality**: CRF 23 (good balance of quality and file size)
- **Real-time Preview**: All edits show instantly in frontend
- **Final Render**: Backend processes and applies all edits for final video












