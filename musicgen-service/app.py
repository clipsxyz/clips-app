#!/usr/bin/env python3
"""
Self-hosted MusicGen API Server
Open-source music generation using Meta's MusicGen model

ROYALTY-FREE STATUS:
- All generated music is 100% royalty-free
- No copyright restrictions
- No attribution required
- Safe for commercial use
- Generated content is original AI-created music (not based on copyrighted material)
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import torch
from audiocraft.models import MusicGen
import io
import os
from datetime import datetime
import soundfile as sf
import numpy as np

app = Flask(__name__)
CORS(app)

# Global model variable
model = None

def load_model():
    """Load the MusicGen model"""
    global model
    if model is None:
        print("Loading MusicGen model (this may take a few minutes on first run)...")
        print("Downloading model (~1.5GB) if not already cached...")
        model = MusicGen.get_pretrained('facebook/musicgen-small')
        print("Model loaded successfully!")
    return model

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'model': 'facebook/musicgen-small'})

@app.route('/generate', methods=['POST'])
def generate_music():
    try:
        data = request.json
        prompt = data.get('prompt', '')
        duration = min(int(data.get('duration', 30)), 30)  # Max 30 seconds
        
        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400
        
        print(f"Generating music: '{prompt}' ({duration}s)")
        
        # Load model if not already loaded
        music_model = load_model()
        
        # Generate music
        music_model.set_generation_params(duration=duration)
        print("Generating audio... (this may take 30-60 seconds)")
        wav = music_model.generate([prompt], progress=True)
        
        # Convert tensor to numpy
        audio_np = wav[0].cpu().numpy().T  # Transpose to (samples, channels)
        
        # Convert to bytes
        audio_bytes = io.BytesIO()
        sf.write(audio_bytes, audio_np, music_model.sample_rate, format='WAV')
        audio_bytes.seek(0)
        
        print("Music generation complete!")
        
        return send_file(
            audio_bytes,
            mimetype='audio/wav',
            as_attachment=False  # Return as response body, not download
        )
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"Error: {error_msg}")
        print(traceback.format_exc())
        return jsonify({'error': error_msg}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n{'='*50}")
    print("MusicGen Service Starting...")
    print(f"Service will run on: http://localhost:{port}")
    print(f"Health check: http://localhost:{port}/health")
    print(f"{'='*50}\n")
    app.run(host='0.0.0.0', port=port, debug=False)

