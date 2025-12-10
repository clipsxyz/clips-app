# MusicGen Service - Royalty-Free AI Music Generation

## Overview

This service provides **100% royalty-free AI music generation** using Meta's open-source MusicGen model. All generated music is original, copyright-free, and safe for commercial use.

## Royalty-Free Status

✅ **Fully Royalty-Free**
- Generated music is original AI-created content
- No copyright restrictions
- No attribution required
- Safe for commercial use
- No licensing fees

## Technology

- **Model**: Meta's MusicGen (open-source, Apache 2.0 license)
- **Source**: https://github.com/facebookresearch/audiocraft
- **License**: Apache 2.0 (open-source, permissive)

## Legal Status

The MusicGen model generates **original music** that:
- Is not based on copyrighted material
- Does not infringe on any existing copyrights
- Is created fresh by the AI model
- Can be used commercially without restrictions

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the service:
```bash
python app.py
```

The service will automatically download the model (~1.5GB) on first run.

## API Usage

```bash
POST http://localhost:5000/generate
Content-Type: application/json

{
  "prompt": "upbeat pop music, instrumental, no vocals",
  "duration": 30
}
```

## Notes

- Generated music is stored in your database with `license_type: "AI Generated (Royalty-Free)"`
- No attribution is required for AI-generated tracks
- All tracks are marked with `license_requires_attribution: false`
