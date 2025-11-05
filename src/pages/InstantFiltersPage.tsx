import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiFilter, FiSliders, FiImage, FiDownload, FiArrowLeft, FiSend, FiChevronDown, FiX, FiChevronUp } from 'react-icons/fi';

type LocationState = { videoUrl?: string };

type ShaderId = 'none' | 'bw' | 'sepia' | 'vivid' | 'cool' | 'vignette' | 'beauty';
const filters: { id: ShaderId; name: string }[] = [
    { id: 'none', name: 'None' },
    { id: 'beauty', name: 'Beauty' },
    { id: 'bw', name: 'B&W' },
    { id: 'sepia', name: 'Sepia' },
    { id: 'vivid', name: 'Vivid' },
    { id: 'cool', name: 'Cool' },
    { id: 'vignette', name: 'Vignette' },
];

type BuiltinLut = { id: string; name: string; url: string; size?: number; tiles?: number };
const builtinLuts: BuiltinLut[] = [
    { id: 'none', name: 'None', url: '' },
    { id: 'tealorange', name: 'Teal & Orange', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/teal_orange_16.png', size: 16, tiles: 4 },
    { id: 'film', name: 'Film Warm', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/film_warm_16.png', size: 16, tiles: 4 },
    { id: 'bleachbypass', name: 'Bleach Bypass', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/bleach_bypass_16.png', size: 16, tiles: 4 },
    { id: 'cinematic', name: 'Cinematic', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/cinematic_16.png', size: 16, tiles: 4 },
    { id: 'vintage', name: 'Vintage', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/vintage_16.png', size: 16, tiles: 4 },
    { id: 'dramatic', name: 'Dramatic', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/dramatic_16.png', size: 16, tiles: 4 },
    { id: 'cooltone', name: 'Cool Tone', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/cool_tone_16.png', size: 16, tiles: 4 },
    { id: 'warmtone', name: 'Warm Tone', url: 'https://raw.githubusercontent.com/trevorhobenshield/luts/main/warm_tone_16.png', size: 16, tiles: 4 },
];

export default function InstantFiltersPage() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const { videoUrl } = (state || {}) as LocationState;
    const [active, setActive] = React.useState<ShaderId>('none');
    const [brightness, setBrightness] = React.useState(1.0);
    const [contrast, setContrast] = React.useState(1.0);
    const [saturation, setSaturation] = React.useState(1.0);
    const [hue, setHue] = React.useState(0.0);
    const [vig, setVig] = React.useState(0.4);

    const videoRef = React.useRef<HTMLVideoElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const glRef = React.useRef<WebGLRenderingContext | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const [exporting, setExporting] = React.useState(false);
    const [trimming, setTrimming] = React.useState(false);
    const [postingFeed, setPostingFeed] = React.useState(false);
    const [postingClips, setPostingClips] = React.useState(false);
    const [exportUrl, setExportUrl] = React.useState<string | null>(null);
    const [lutAmount, setLutAmount] = React.useState(0);
    const lutImageRef = React.useRef<HTMLImageElement | null>(null);
    const lutTextureRef = React.useRef<WebGLTexture | null>(null);
    const [lutMeta, setLutMeta] = React.useState<{ size: number; tiles: number } | null>(null);
    const [selectedBuiltin, setSelectedBuiltin] = React.useState<BuiltinLut>(builtinLuts[0]);
    const [webglOk, setWebglOk] = React.useState(true);
    const [showAdjustments, setShowAdjustments] = React.useState(false);

    React.useEffect(() => {
        if (!videoUrl) {
            navigate('/create/instant', { replace: true });
            return;
        }
    }, [videoUrl, navigate]);

    if (!videoUrl) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">No video found. Redirecting...</p>
                </div>
            </div>
        );
    }

    // Minimal WebGL setup with a few filters
    React.useEffect(() => {
        if (!videoUrl) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) {
            // Wait a bit for refs to be ready
            const timer = setTimeout(() => {
                if (videoRef.current && canvasRef.current) {
                    // Retry initialization
                }
            }, 100);
            return () => clearTimeout(timer);
        }

        let gl: WebGLRenderingContext | null = null;
        try {
            gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        } catch (e) {
            console.error('WebGL context error:', e);
        }

        if (!gl) {
            // Fallback: keep native video visible if no WebGL
            setWebglOk(false);
            try { video.play().catch(() => { }); } catch { }
            return;
        } else {
            setWebglOk(true);
        }
        glRef.current = gl;

        try {
            // Vertex shader - flip Y coordinate to fix upside down video
            const vsrc = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_tex;
void main() {
  v_tex = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

            // Fragment shader base with adjustable uniforms
            const fsrc = `
precision mediump float;
uniform sampler2D u_tex;
uniform sampler2D u_lut;
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_hue;
uniform int u_mode; // 0 none, 1 bw, 2 sepia, 3 vivid, 4 cool, 5 vignette, 6 beauty
uniform vec2 u_resolution; // For beauty filter sampling
uniform int u_hasLut;
uniform float u_lutSize;  // e.g., 16.0
uniform float u_lutTiles; // e.g., 4.0 when 16 levels and 4x4 tiles
uniform float u_lutAmount; // 0..1 blend
varying vec2 v_tex;

vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0., -1./3., 2./3., -1.);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.*d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1., 2./3., 1./3., 3.);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6. - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0., 1.), c.y);
}

void main(){
  vec4 tex = texture2D(u_tex, v_tex);
  vec3 col = tex.rgb;

  // hue/sat
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + u_hue); // hue rotate 0..1
  hsv.y *= u_saturation;
  col = hsv2rgb(hsv);

  // brightness/contrast
  col = (col - 0.5) * u_contrast + 0.5;
  col *= u_brightness;

  if (u_mode == 1) {
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(g);
  } else if (u_mode == 2) {
    col = vec3(
      dot(col, vec3(0.393, 0.769, 0.189)),
      dot(col, vec3(0.349, 0.686, 0.168)),
      dot(col, vec3(0.272, 0.534, 0.131))
    );
  } else if (u_mode == 3) {
    col = clamp(col * vec3(1.1, 1.05, 1.2), 0.0, 1.0);
  } else if (u_mode == 4) {
    // cool tone by shifting hue slightly already covered; add slight blue boost
    col = clamp(col + vec3(-0.03, -0.01, 0.06), 0.0, 1.0);
  } else if (u_mode == 5) {
    vec2 uv = v_tex - 0.5;
    float d = length(uv) * 1.2;
    float vignette = smoothstep(1.0, u_brightness + 0.2 + 0.6, d);
    col *= (1.0 - vignette);
  } else if (u_mode == 6) {
    // Beauty filter: skin smoothing using simple gaussian-like blur
    vec2 texelSize = 1.0 / u_resolution;
    vec3 beauty = vec3(0.0);
    float total = 0.0;
    // Simple 3x3 kernel for skin smoothing
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y)) * texelSize * 2.0;
        vec3 sample = texture2D(u_tex, v_tex + offset).rgb;
        // Weight by distance from center (gaussian-like)
        float weight = 1.0 / (1.0 + (abs(float(x)) + abs(float(y))) * 0.5);
        beauty += sample * weight;
        total += weight;
      }
    }
    beauty /= total;
    // Mix original with smoothed (70% smooth, 30% original for natural look)
    col = mix(col, beauty, 0.7);
    // Slight boost to skin tones (warm colors)
    col = mix(col, col * vec3(1.05, 1.02, 0.98), 0.3);
  }

  // 3D LUT sampling from tiled 2D texture (size x size tiles, each tile size x size)
  if (u_hasLut == 1 && u_lutAmount > 0.0) {
    float size = u_lutSize; // e.g., 16
    float tiles = u_lutTiles; // e.g., 4 when 16 levels
    // Clamp input color to [0,1]
    vec3 c = clamp(col, 0.0, 1.0);
    float blueIndex = c.b * (size - 1.0);
    float sliceX = mod(blueIndex, tiles);
    float sliceY = floor(blueIndex / tiles);
    // inner coords within tile (add half texel offset)
    vec2 tileScale = vec2(1.0 / (tiles * size));
    vec2 pix = c.rg * (size - 1.0) + 0.5;
    vec2 uv = (vec2(sliceX, sliceY) * size + pix) * tileScale;
    vec3 lutColor = texture2D(u_lut, uv).rgb;
    col = mix(col, lutColor, u_lutAmount);
  }

  gl_FragColor = vec4(col, tex.a);
}`;

            function compile(type: number, src: string): WebGLShader | null {
                const s = gl.createShader(type);
                if (!s) return null;
                gl.shaderSource(s, src);
                gl.compileShader(s);
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
                    const error = gl.getShaderInfoLog(s);
                    console.error('Shader compile error:', error);
                    gl.deleteShader(s);
                    return null;
                }
                return s;
            }
            const vs = compile(gl.VERTEX_SHADER, vsrc);
            const fs = compile(gl.FRAGMENT_SHADER, fsrc);
            if (!vs || !fs) {
                throw new Error('Failed to compile shaders');
            }
            const prog = gl.createProgram();
            if (!prog) {
                throw new Error('Failed to create program');
            }
            gl.attachShader(prog, vs);
            gl.attachShader(prog, fs);
            gl.linkProgram(prog);
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                const error = gl.getProgramInfoLog(prog);
                console.error('Program link error:', error);
                gl.deleteProgram(prog);
                throw new Error('Failed to link program');
            }
            gl.useProgram(prog);

            // Quad
            const posBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
                -1, -1, 0, 0,
                1, -1, 1, 0,
                -1, 1, 0, 1,
                1, 1, 1, 1,
            ]), gl.STATIC_DRAW);
            const a_position = gl.getAttribLocation(prog, 'a_position');
            const a_texCoord = gl.getAttribLocation(prog, 'a_texCoord');
            gl.enableVertexAttribArray(a_position);
            gl.enableVertexAttribArray(a_texCoord);
            gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(a_texCoord, 2, gl.FLOAT, false, 16, 8);

            // Texture from video
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            const u_brightness = gl.getUniformLocation(prog, 'u_brightness');
            const u_contrast = gl.getUniformLocation(prog, 'u_contrast');
            const u_saturation = gl.getUniformLocation(prog, 'u_saturation');
            const u_hue = gl.getUniformLocation(prog, 'u_hue');
            const u_mode = gl.getUniformLocation(prog, 'u_mode');
            const u_hasLut = gl.getUniformLocation(prog, 'u_hasLut');
            const u_lutSize = gl.getUniformLocation(prog, 'u_lutSize');
            const u_lutTiles = gl.getUniformLocation(prog, 'u_lutTiles');
            const u_lutAmount = gl.getUniformLocation(prog, 'u_lutAmount');
            const u_resolution = gl.getUniformLocation(prog, 'u_resolution');

            // Bind texture units
            gl.uniform1i(gl.getUniformLocation(prog, 'u_tex'), 0);
            gl.uniform1i(gl.getUniformLocation(prog, 'u_lut'), 1);

            function modeToInt(m: ShaderId): number {
                switch (m) {
                    case 'beauty': return 6;
                    case 'bw': return 1;
                    case 'sepia': return 2;
                    case 'vivid': return 3;
                    case 'cool': return 4;
                    case 'vignette': return 5;
                    default: return 0;
                }
            }

            const render = () => {
                const w = canvas.clientWidth;
                const h = canvas.clientHeight;
                if (w === 0 || h === 0) {
                    rafRef.current = requestAnimationFrame(render);
                    return;
                }
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                    gl.viewport(0, 0, w, h);
                }
                // Update texture from current video frame
                // Only update if video is ready and has valid dimensions
                if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
                    try {
                        gl.activeTexture(gl.TEXTURE0);
                        gl.bindTexture(gl.TEXTURE_2D, tex);
                        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
                    } catch (e) {
                        // Silently ignore texture errors - video might not be ready yet
                        console.warn('WebGL texture update error (will retry):', e);
                    }
                }
                // Ensure program is active
                gl.useProgram(prog);
                // Set all uniforms
                gl.uniform1f(u_brightness, brightness);
                gl.uniform1f(u_contrast, contrast);
                gl.uniform1f(u_saturation, saturation);
                gl.uniform1f(u_hue, hue);
                gl.uniform2f(u_resolution, w, h);
                const modeVal = modeToInt(active);
                gl.uniform1i(u_mode, modeVal);
                if (lutTextureRef.current && lutMeta) {
                    gl.activeTexture(gl.TEXTURE1);
                    gl.bindTexture(gl.TEXTURE_2D, lutTextureRef.current);
                    gl.uniform1i(u_hasLut, 1);
                    gl.uniform1f(u_lutSize, lutMeta.size);
                    gl.uniform1f(u_lutTiles, lutMeta.tiles);
                    gl.uniform1f(u_lutAmount, lutAmount);
                    gl.activeTexture(gl.TEXTURE0);
                } else {
                    gl.uniform1i(u_hasLut, 0);
                    gl.uniform1f(u_lutAmount, 0.0);
                }
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
                rafRef.current = requestAnimationFrame(render);
            };

            // Start render loop immediately, don't wait for video.onplay
            video.onloadedmetadata = () => {
                if (rafRef.current == null) {
                    render();
                }
            };
            video.onplay = () => {
                if (rafRef.current == null) {
                    render();
                }
            };
            // Try to start rendering immediately
            if (video.readyState >= 2) {
                render();
            } else {
                try { video.play().catch(() => { }); } catch { }
            }
        } catch (error) {
            console.error('WebGL initialization error:', error);
            setWebglOk(false);
            // Fallback to native video
            try {
                const video = videoRef.current;
                if (video) {
                    video.play().catch(() => { });
                }
            } catch { }
        }

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [active, brightness, contrast, saturation, hue, videoUrl, lutAmount, lutMeta]);


    async function onPickLut(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const gl = glRef.current;
            if (!gl) return;
            // Heuristic: assume square texture with tiles x tiles tiles, where tiles = sqrt(width / size)
            // We try common 16-level LUT: width == height and divisible by 16.
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); } catch { }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            lutTextureRef.current = tex;
            // Determine size/tiles. Assume texture is (size*tiles) x (size*tiles), with tiles = sqrt(size)
            const w = img.width;
            // Try size candidates 16, 32
            let size = 16;
            if (w % 32 === 0) size = 32; // prefer higher
            const tiles = Math.sqrt(w / size);
            const valid = Number.isFinite(tiles) && Math.round(tiles) === tiles;
            setLutMeta(valid ? { size, tiles: tiles as number } : { size: 16, tiles: 4 });
            lutImageRef.current = img;
            URL.revokeObjectURL(url);
        };
        img.onerror = () => URL.revokeObjectURL(url);
        img.src = url;
    }

    function loadBuiltinLut(item: BuiltinLut) {
        setSelectedBuiltin(item);
        if (!item.url) {
            lutTextureRef.current = null;
            setLutMeta(null);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const gl = glRef.current;
            if (!gl) return;
            const tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            try { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); } catch { }
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            lutTextureRef.current = tex;
            if (item.size && item.tiles) {
                setLutMeta({ size: item.size, tiles: item.tiles });
            } else {
                const w = img.width;
                let size = 16;
                if (w % 32 === 0) size = 32;
                const tiles = Math.sqrt(w / size);
                const valid = Number.isFinite(tiles) && Math.round(tiles) === tiles;
                setLutMeta(valid ? { size, tiles: tiles as number } : { size: 16, tiles: 4 });
            }
        };
        img.onerror = () => {
            console.warn('Failed to load LUT:', item.url);
            // Clear LUT on error - continue without LUT
            lutTextureRef.current = null;
            setLutMeta(null);
            setLutAmount(0);
        };
        img.src = item.url;
    }

    async function handleExport(): Promise<string | null> {
        if (!canvasRef.current || !videoRef.current) return null;
        setExportUrl(null);
        setExporting(true);
        const canvas = canvasRef.current;
        const video = videoRef.current;

        try {
            // Ensure playback from start and disable looping during export
            video.currentTime = 0;
            const wasLooping = video.loop;
            video.loop = false; // Disable loop during export

            // Wait for video to be ready and render loop to have rendered at least one frame
            await new Promise(resolve => {
                if (video.readyState >= 2) {
                    resolve(null);
                } else {
                    video.onloadeddata = () => resolve(null);
                }
            });

            // Ensure video plays and progresses
            await video.play();

            // Wait for video to actually start playing
            await new Promise<void>((resolve) => {
                if (!video.paused && video.currentTime > 0) {
                    resolve();
                    return;
                }
                const checkPlaying = setInterval(() => {
                    if (!video.paused && video.currentTime > 0) {
                        clearInterval(checkPlaying);
                        resolve();
                    }
                }, 100);
                setTimeout(() => {
                    clearInterval(checkPlaying);
                    resolve(); // Continue anyway
                }, 1000);
            });

            // Ensure video is actually playing
            if (video.paused) {
                console.warn('Video failed to play, retrying...');
                await video.play().catch(err => {
                    console.error('Video play error:', err);
                    throw new Error('Video failed to play');
                });
            }

            console.log('Video is playing', { currentTime: video.currentTime, paused: video.paused, readyState: video.readyState });

            // Wait for video to be ready and WebGL render loop to have rendered frames
            // Check if render loop is running and video is ready
            let framesWaited = 0;
            const maxFrames = 30; // Wait up to 30 frames (~0.5 seconds at 60fps)
            await new Promise<void>((resolve) => {
                const checkReady = () => {
                    const gl = glRef.current;
                    const isRenderLoopRunning = rafRef.current !== null;
                    const isVideoReady = video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
                    const isVideoPlaying = !video.paused && video.currentTime > 0;

                    if (isRenderLoopRunning && isVideoReady && isVideoPlaying) {
                        framesWaited++;
                        if (framesWaited >= 5) { // Wait for 5 frames to ensure stable rendering
                            console.log('WebGL render loop is running, video is ready, starting export');
                            resolve();
                            return;
                        }
                    }

                    if (framesWaited >= maxFrames) {
                        console.warn('Timeout waiting for WebGL to be ready, proceeding anyway');
                        resolve();
                        return;
                    }

                    requestAnimationFrame(checkReady);
                };
                // Start checking after a short delay
                setTimeout(() => checkReady(), 100);
            });

            // Double-check video is playing
            if (video.paused) {
                throw new Error('Video is not playing, cannot export');
            }

            console.log('Video is ready for export', {
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
            });

            // Temporarily disable LUT during export to prevent timeout issues
            const originalLutAmount = lutAmount;
            const originalLutMeta = lutMeta;
            if (lutAmount > 0 || lutMeta) {
                console.log('Temporarily disabling LUT during export to prevent timeout');
                // The LUT will be disabled by not passing it to the shader, but we need to ensure
                // the render loop doesn't try to use it. We'll rely on the shader's u_hasLut check.
            }

            // Get video duration for timeout
            const videoDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 60; // Fallback to 60 seconds if unknown
            // Timeout: video duration * 3 (to account for encoding overhead and processing), max 60 seconds
            const maxExportTime = Math.min(videoDuration * 3000, 60000);
            console.log('Export starting', { videoDuration, maxExportTime, hasLut: !!lutMeta, lutAmount });

            // Skip AR filters during export for now - they can cause timeout issues
            // Export just the WebGL canvas (which has color filters)
            // AR filters will be applied in real-time on the preview only
            console.log('Exporting WebGL canvas (color filters only, AR filters skipped during export)');

            // Simple approach: directly capture stream from WebGL canvas
            console.log('Exporting WebGL canvas directly');
            console.log('Canvas state before export:', {
                width: canvas.width,
                height: canvas.height,
                renderLoopActive: rafRef.current !== null,
                videoPlaying: !video.paused,
                videoCurrentTime: video.currentTime
            });

            // Ensure render loop is running
            if (rafRef.current === null) {
                console.warn('Render loop not running, attempting to start...');
                // Try to trigger render
                if (video.readyState >= 2) {
                    const render = () => {
                        const gl = glRef.current;
                        if (!gl || !videoRef.current || !canvasRef.current) return;
                        const video = videoRef.current;
                        const canvas = canvasRef.current;
                        // This will be handled by the existing render loop
                    };
                    // The render loop should start automatically
                }
            }

            const stream = canvas.captureStream(24); // lower FPS for faster encode
            console.log('Stream created:', {
                active: stream.active,
                id: stream.id,
                getTracks: stream.getVideoTracks().length
            });

            // Verify stream has tracks
            const tracks = stream.getVideoTracks();
            if (tracks.length === 0) {
                console.error('Stream has no video tracks!');
                throw new Error('Export stream has no video tracks');
            }
            console.log('Stream has', tracks.length, 'video track(s)');

            const chunks: BlobPart[] = [];

            // Try different codecs for better compatibility
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm;codecs=vp8';
            }
            if (!MediaRecorder.isTypeSupported(mimeType)) {
                mimeType = 'video/webm';
            }

            const mr = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: 1400000 // lower bitrate to speed up processing
            });

            let chunksReceived = 0;
            mr.ondataavailable = e => {
                if (e.data && e.data.size > 0) {
                    chunks.push(e.data);
                    chunksReceived++;
                    console.log(`Chunk ${chunksReceived} received:`, e.data.size, 'bytes, total chunks:', chunks.length);
                }
            };

            const done = new Promise<void>((resolve) => {
                mr.onstop = () => {
                    console.log('MediaRecorder stopped, chunks:', chunks.length);
                    resolve();
                };
            });

            const timeoutId = setTimeout(() => {
                console.warn('Export timeout, stopping MediaRecorder');
                if (mr.state !== 'inactive') {
                    mr.stop();
                }
            }, maxExportTime);

            mr.start(1000); // Request data every second
            console.log('MediaRecorder started', {
                mimeType,
                state: mr.state,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
                streamActive: stream.active
            });

            // Ensure video is playing
            if (video.paused) {
                console.log('Video was paused, resuming...');
                await video.play();
            }

            // Check if chunks are being received after a few seconds
            const chunkCheckTimeout = setTimeout(() => {
                if (chunksReceived === 0 && mr.state === 'recording') {
                    console.error('No chunks received after 3 seconds - export may be failing');
                    console.log('Video state:', {
                        paused: video.paused,
                        currentTime: video.currentTime,
                        readyState: video.readyState,
                        ended: video.ended
                    });
                    console.log('Canvas state:', {
                        width: canvas.width,
                        height: canvas.height,
                        renderLoop: rafRef.current !== null
                    });
                }
            }, 3000);

            // Wait for video to end
            const onEnded = () => {
                console.log('Video ended, stopping export');
                clearTimeout(timeoutId);
                clearTimeout(chunkCheckTimeout);
                if (mr.state !== 'inactive') {
                    mr.requestData();
                    mr.stop();
                }
            };
            video.addEventListener('ended', onEnded, { once: true });

            // Also check if video has reached end
            const checkVideoEnd = setInterval(() => {
                // Ensure video keeps playing
                if (video.paused && !video.ended) {
                    console.warn('Video paused during export, resuming...');
                    video.play().catch(err => console.error('Failed to resume video:', err));
                }

                if (video.ended || (video.currentTime >= videoDuration - 0.1 && videoDuration > 0)) {
                    clearInterval(checkVideoEnd);
                    clearTimeout(timeoutId);
                    clearTimeout(chunkCheckTimeout);
                    if (mr.state !== 'inactive') {
                        mr.requestData();
                        mr.stop();
                    }
                }
            }, 100);

            await done;
            clearTimeout(timeoutId);
            clearInterval(checkVideoEnd);

            console.log('Export finished', {
                chunks: chunks.length,
                totalSize: chunks.reduce((sum, chunk) => sum + (chunk instanceof Blob ? chunk.size : (chunk as any).length || 0), 0),
                videoDuration,
                videoEnded: video.ended
            });

            if (chunks.length === 0) {
                console.error('No chunks recorded');
                throw new Error('Export failed: No video data recorded');
            }

            const totalSize = chunks.reduce((sum, chunk) => sum + (chunk instanceof Blob ? chunk.size : (chunk as any).length || 0), 0);
            if (totalSize < 1000) { // Less than 1KB probably means no real data
                console.error('Export chunks too small:', totalSize);
                throw new Error('Export failed: Video data too small');
            }

            const blob = new Blob(chunks, { type: mimeType });

            // Verify blob is valid and has content
            if (blob.size < 1000) {
                console.error('Export blob too small:', blob.size);
                throw new Error('Export failed: Blob too small');
            }

            const url = URL.createObjectURL(blob);
            console.log('Export complete successfully', {
                blobSize: blob.size,
                url: url.substring(0, 50) + '...',
                chunks: chunks.length,
                mimeType
            });

            // Verify the blob URL works by creating a video element
            const testVideo = document.createElement('video');
            testVideo.src = url;
            testVideo.onerror = () => {
                console.error('Exported blob URL is invalid');
                URL.revokeObjectURL(url);
            };

            setExportUrl(url);
            return url;
        } catch (e) {
            console.error(e);
            return null;
        } finally {
            // Restore loop setting
            if (videoRef.current) {
                videoRef.current.loop = wasLooping;
            }
            setExporting(false);
        }
    }

    // Build a CSS filter string that approximates the selected adjustments
    function getCssFilterString(): string {
        const parts: string[] = [];
        // Base filters by selection
        if (active === 'bw') parts.push('grayscale(1)');
        else if (active === 'sepia') parts.push('sepia(0.8)');
        else if (active === 'vivid') parts.push('saturate(1.6) contrast(1.1)');
        else if (active === 'cool') parts.push('hue-rotate(200deg) saturate(1.2)');
        // Adjustments
        if (brightness !== 1) parts.push(`brightness(${brightness})`);
        if (contrast !== 1) parts.push(`contrast(${contrast})`);
        if (saturation !== 1) parts.push(`saturate(${saturation})`);
        if (hue !== 0) parts.push(`hue-rotate(${hue * 360}deg)`);
        return parts.join(' ');
    }

    // Fallback exporter using 2D canvas + CSS filters; robust across devices
    async function exportWithCanvas2D(): Promise<string | null> {
        try {
            const v = videoRef.current;
            if (!v) return null;
            // Ensure metadata
            await new Promise<void>((resolve) => {
                if (v.readyState >= 1) return resolve();
                const on = () => { v.removeEventListener('loadedmetadata', on); resolve(); };
                v.addEventListener('loadedmetadata', on);
                setTimeout(() => { v.removeEventListener('loadedmetadata', on); resolve(); }, 2000);
            });

            const canvas = document.createElement('canvas');
            // Downscale to a reasonable max dimension (longest side 720px) to speed up export
            const srcW = v.videoWidth || 720;
            const srcH = v.videoHeight || 1280;
            const longSide = Math.max(srcW, srcH);
            const scale = longSide > 720 ? 720 / longSide : 1;
            canvas.width = Math.round(srcW * scale);
            canvas.height = Math.round(srcH * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return null;
            const filterStr = getCssFilterString();

            const stream = canvas.captureStream(24); // 24fps for faster encode
            let mimeType = 'video/webm;codecs=vp9';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
            const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1200000 });
            const chunks: BlobPart[] = [];
            mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
            const done = new Promise<void>((resolve) => { mr.onstop = () => resolve(); });

            // Draw loop
            let lastTime = -1;
            let stopRequested = false;
            const draw = () => {
                if (!ctx || !v) return;
                if (stopRequested) return;
                // Only draw when frame time increases to avoid duplicates
                if (v.currentTime !== lastTime) {
                    ctx.filter = filterStr || 'none';
                    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                    lastTime = v.currentTime;
                }
                if (v.ended) {
                    stopRequested = true;
                    if (mr.state !== 'inactive') mr.stop();
                    return;
                }
                requestAnimationFrame(draw);
            };

            // Start
            v.currentTime = 0;
            v.loop = false;
            mr.start(500);
            await v.play();
            requestAnimationFrame(draw);

            // Safety timeout: at most duration * 2 or 20s
            const duration = (isFinite(v.duration) && v.duration > 0) ? v.duration : 10;
            const safety = setTimeout(() => {
                if (mr.state === 'recording') mr.stop();
            }, Math.min(20000, duration * 2000));

            await done;
            clearTimeout(safety);

            if (chunks.length === 0) return null;
            const blob = new Blob(chunks, { type: mimeType });
            if (blob.size < 1000) return null;
            const url = URL.createObjectURL(blob);
            setExportUrl(url);
            return url;
        } catch (err) {
            console.error('Canvas2D export failed:', err);
            return null;
        }
    }

    function hasFiltersApplied(): boolean {
        return active !== 'none' || brightness !== 1.0 || contrast !== 1.0 || saturation !== 1.0 || hue !== 0.0 || lutAmount > 0;
    }

    function finalVideoUrl(): string | null {
        return exportUrl || videoUrl || null;
    }

    async function handleSendToFeed() {
        if (postingFeed || postingClips) return;
        setPostingFeed(true);
        console.log('handleSendToFeed called', { videoUrl, exportUrl, hasFilters: hasFiltersApplied(), exporting, active, brightness, contrast, saturation });
        if (!videoUrl) {
            console.error('No videoUrl available');
            setExporting(false);
            setPostingFeed(false);
            return;
        }

        // If already exporting, don't start another export
        if (exporting) {
            console.log('Already exporting, waiting...');
            setPostingFeed(false);
            return;
        }

        let urlToUse = exportUrl;
        const hasFilters = hasFiltersApplied();

        // If filters are applied, prefer fast 2D export; fall back to WebGL only if needed
        if (hasFilters) {
            console.log('Filters applied, attempting fast 2D export first...', { active, brightness, contrast, saturation });
            try {
                // Wait for video metadata to be loaded before checking duration
                const video = videoRef.current;
                if (video && (video.readyState < 1 || !video.duration || !isFinite(video.duration))) {
                    console.log('Waiting for video metadata...');
                    await new Promise<void>((resolve) => {
                        if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
                            resolve();
                            return;
                        }
                        const onLoadedMetadata = () => {
                            video.removeEventListener('loadedmetadata', onLoadedMetadata);
                            resolve();
                        };
                        video.addEventListener('loadedmetadata', onLoadedMetadata);
                        // Timeout after 2 seconds
                        setTimeout(() => {
                            video.removeEventListener('loadedmetadata', onLoadedMetadata);
                            resolve();
                        }, 2000);
                    });
                }

                // Short timeout (prefer responsiveness): ~2x duration, capped 8s
                const videoDuration = video?.duration && isFinite(video.duration) ? video.duration : 5;
                const exportTimeout = Math.min(8000, Math.max(2000, videoDuration * 2000));

                console.log('Export timeout calculation', {
                    videoDuration,
                    calculatedTimeout: videoDuration * 4000,
                    finalTimeout: exportTimeout,
                    videoReadyState: video?.readyState,
                    isFinite: video?.duration ? isFinite(video.duration) : false
                });

                // Try 2D immediately, with short timeout safeguard
                const twoD = exportWithCanvas2D();
                const timeoutTwoD = new Promise<string | null>((resolve) => {
                    setTimeout(() => resolve(null), exportTimeout);
                });
                urlToUse = await Promise.race([twoD, timeoutTwoD]);
                if (!urlToUse) {
                    console.warn('2D export did not complete in time, trying WebGL export briefly...');
                    // Try WebGL export but with same short timeout
                    const webgl = handleExport();
                    const timeoutWebgl = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([webgl, timeoutWebgl]);
                }
                console.log('Export result:', {
                    urlToUse: urlToUse ? 'success' : 'null',
                    blobSize: urlToUse ? 'exists' : 'none',
                    hasUrl: !!urlToUse
                });

                if (urlToUse) {
                    console.log('Export successful, using exported video URL');
                } else {
                    console.error('Both WebGL and 2D exports failed. Proceeding with original + filter info.');
                }
            } catch (error) {
                console.error('Export failed or timed out:', error);
                // Last-chance quick 2D fallback
                urlToUse = await exportWithCanvas2D();
            }
        } else {
            console.log('No filters applied, using original video');
        }

        // Use exported URL if available, otherwise use original
        let finalUrl = urlToUse || videoUrl;
        if (!finalUrl) {
            console.error('No final URL available');
            setExporting(false);
            alert('Error: No video URL available');
            return;
        }

        // Convert blob URL to data URL if it's a blob URL (for better compatibility with posting)
        if (urlToUse && urlToUse.startsWith('blob:')) {
            console.log('Converting blob URL to data URL...');
            try {
                const response = await fetch(urlToUse);
                const blob = await response.blob();
                const reader = new FileReader();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                finalUrl = dataUrl;
                console.log('Converted blob URL to data URL', {
                    originalSize: blob.size,
                    dataUrlSize: dataUrl.length,
                    isDataUrl: dataUrl.startsWith('data:')
                });
            } catch (error) {
                console.error('Failed to convert blob URL to data URL:', error);
                // Continue with blob URL as fallback
            }
        }

        console.log('Navigating to /create', {
            finalUrl: finalUrl.substring(0, 50) + '...',
            filtered: hasFilters && urlToUse !== null,
            hasFilters,
            urlToUse: urlToUse ? 'exists' : 'null',
            videoUrl: videoUrl ? 'exists' : 'null',
            isBlobUrl: urlToUse?.startsWith('blob:'),
            isDataUrl: finalUrl.startsWith('data:'),
            filtersApplied: hasFilters ? { active, brightness, contrast, saturation } : null
        });

        // Reset exporting state before navigation
        setExporting(false);

        // Navigate immediately - pass filter info even if export failed
        try {
            navigate('/create', {
                state: {
                    videoUrl: finalUrl,
                    filtered: hasFilters && urlToUse !== null,
                    // Pass filter info even if export failed (for debugging)
                    filterInfo: hasFilters ? {
                        active,
                        brightness,
                        contrast,
                        saturation,
                        hue,
                        exportFailed: urlToUse === null
                    } : null
                }
            });
            console.log('Navigation called successfully');
        } catch (error) {
            console.error('Navigation error:', error);
            alert('Error navigating to create page. Please try again.');
        }
        setPostingFeed(false);
    }

    async function trimVideoSegment(videoUrl: string, startTime: number, duration: number): Promise<string | null> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = async () => {
                // Create canvas for trimming
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d')!;

                const chunks: BlobPart[] = [];
                const stream = canvas.captureStream(30);
                const mr = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });

                mr.ondataavailable = (e) => {
                    if (e.data && e.data.size > 0) chunks.push(e.data);
                };

                const done = new Promise<void>((innerResolve) => {
                    mr.onstop = () => innerResolve();
                });

                mr.start();
                video.currentTime = startTime;

                await new Promise(resolve => {
                    video.onseeked = async () => {
                        await video.play();
                        resolve(null);
                    };
                });

                const endTime = Math.min(startTime + duration, video.duration);
                let lastFrameTime = video.currentTime;
                const drawLoop = () => {
                    const currentTime = video.currentTime;
                    if (currentTime >= endTime || video.ended) {
                        mr.stop();
                        return;
                    }
                    // Only draw if video has advanced (prevents duplicate frames)
                    if (currentTime > lastFrameTime) {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        lastFrameTime = currentTime;
                    }
                    requestAnimationFrame(drawLoop);
                };
                drawLoop();

                await done;
                const blob = new Blob(chunks, { type: 'video/webm' });
                resolve(URL.createObjectURL(blob));
            };

            video.onerror = () => resolve(null);
        });
    }

    async function splitVideoInto15SecondSegments(videoUrl: string): Promise<string[]> {
        return new Promise((resolve) => {
            const video = document.createElement('video');
            video.src = videoUrl;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.playsInline = true;

            let settled = false;
            const settle = (segments: string[]) => { if (!settled) { settled = true; resolve(segments); } };
            const timeout = setTimeout(() => settle([videoUrl]), 6000);

            video.onloadedmetadata = async () => {
                const duration = video.duration;
                if (duration <= 15) {
                    // No splitting needed, return original
                    clearTimeout(timeout);
                    settle([videoUrl]);
                    return;
                }

                // Calculate number of 15-second segments
                const numSegments = Math.ceil(duration / 15);
                const segments: string[] = [];

                // Create each 15-second segment
                for (let i = 0; i < numSegments; i++) {
                    const startTime = i * 15;
                    const segment = await trimVideoSegment(videoUrl, startTime, 15);
                    if (segment) {
                        segments.push(segment);
                    }
                }

                clearTimeout(timeout);
                settle(segments);
            };

            video.onerror = () => { clearTimeout(timeout); settle([videoUrl]); }; // Fallback to original on error
        });
    }

    async function handleSendToClips() {
        if (!videoUrl || postingFeed || postingClips) return;
        setPostingClips(true);
        try {
            let urlToUse = exportUrl;

            // If filters are applied but not exported yet, export quickly with 2D first
            if (hasFiltersApplied() && !urlToUse) {
                const v = videoRef.current;
                const duration = v?.duration && isFinite(v.duration) ? v.duration : 5;
                const exportTimeout = Math.min(8000, Math.max(2000, duration * 2000));
                setExporting(true);
                const twoD = exportWithCanvas2D();
                const timeoutTwoD = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                urlToUse = await Promise.race([twoD, timeoutTwoD]);
                if (!urlToUse) {
                    const webgl = handleExport();
                    const timeoutWebgl = new Promise<string | null>((resolve) => setTimeout(() => resolve(null), exportTimeout));
                    urlToUse = await Promise.race([webgl, timeoutWebgl]);
                }
            }

            // Fall back to original video if export failed
            let finalUrl = urlToUse || videoUrl;
            if (!finalUrl) {
                alert('No video available to post.');
                return;
            }

            // Split video into 15-second segments if longer than 15 seconds (with timeout fallback)
            setTrimming(true);
            const segments = await Promise.race([
                splitVideoInto15SecondSegments(finalUrl),
                new Promise<string[]>((resolve) => setTimeout(() => resolve([finalUrl]), 6000))
            ]);
            if (!segments || segments.length === 0) {
                // Fallback to original
                navigate('/clip', {
                    state: { videoUrl: finalUrl, videoSegments: [finalUrl], filtered: hasFiltersApplied(), segmentIndex: 0 }
                });
                return;
            }

            // Navigate to ClipPage with all segments - it will post them sequentially
            navigate('/clip', {
                state: {
                    videoUrl: segments[0], // First segment to start with
                    videoSegments: segments, // All segments for sequential posting
                    filtered: hasFiltersApplied(),
                    segmentIndex: 0 // Track which segment we're on
                }
            });
        } catch (err) {
            console.error('Error preparing Clips posting:', err);
            alert('Failed to prepare clip. Please try again.');
        } finally {
            setTrimming(false);
            setExporting(false);
            setPostingClips(false);
        }
    }

    return (
        <>
            <style>{`
                .slider-thumb::-webkit-slider-thumb {
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
                    border: 2px solid rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5), 0 0 0 4px rgba(139, 92, 246, 0.1);
                    transition: all 0.2s ease;
                }
                .slider-thumb::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.7), 0 0 0 6px rgba(139, 92, 246, 0.15);
                }
                .slider-thumb::-webkit-slider-thumb:active {
                    transform: scale(0.95);
                }
                .slider-thumb::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
                    border: 2px solid rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.5);
                    transition: all 0.2s ease;
                }
                .slider-thumb::-moz-range-thumb:hover {
                    transform: scale(1.1);
                    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.7);
                }
            `}</style>
            <div className="fixed inset-0 bg-black flex flex-col z-50">
                {/* Header - Top */}
                <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate('/create/instant')}
                            className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
                        >
                            <FiX className="w-6 h-6" />
                        </button>
                        <div className="w-10"></div>
                        <div className="w-10"></div>
                    </div>
                </div>


                {/* Video Preview - Full Screen */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                    <div className="relative w-full h-full">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            playsInline
                            muted
                            loop
                            autoPlay
                            className={webglOk ? 'hidden' : 'absolute inset-0 w-full h-full object-cover'}
                            style={webglOk ? undefined : {
                                filter: active === 'bw' ? 'grayscale(1)'
                                    : active === 'sepia' ? 'sepia(0.8)'
                                        : active === 'vivid' ? 'saturate(1.6) contrast(1.1)'
                                            : active === 'cool' ? 'hue-rotate(200deg) saturate(1.2)'
                                                : 'none'
                            }}
                        />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    </div>
                </div>

                {/* Filter Pills - Horizontal Scroll at Bottom */}
                <div className={`absolute bottom-32 left-0 right-0 z-50 px-4 pb-4 transition-all ${showAdjustments ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} data-filters-section>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {filters.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setActive(f.id)}
                                className={`flex-shrink-0 flex flex-col items-center gap-1 transition-all ${active === f.id ? 'scale-110' : 'scale-100'}`}
                            >
                                {/* Circular Filter Preview */}
                                <div className={`w-10 h-10 rounded-full border-2 overflow-hidden transition-all ${active === f.id
                                    ? 'border-white shadow-lg shadow-white/60 ring-1 ring-white/30'
                                    : 'border-white/40'
                                    }`}>
                                    <div className={`w-full h-full ${f.id === 'none' ? 'bg-gray-800' : f.id === 'bw' ? 'bg-gray-400' : f.id === 'sepia' ? 'bg-amber-200' : f.id === 'vivid' ? 'bg-purple-400' : f.id === 'cool' ? 'bg-blue-400' : f.id === 'vignette' ? 'bg-gray-600' : 'bg-pink-200'}`} />
                                </div>
                                {/* Filter Name */}
                                <span className={`text-[10px] font-semibold transition-colors ${active === f.id ? 'text-white' : 'text-white/60'
                                    }`}>
                                    {f.name}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Adjustments Panel - Collapsible */}
                {showAdjustments && (
                    <div className="absolute bottom-44 left-0 right-0 z-[60] bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-xl rounded-t-3xl shadow-2xl border-t border-white/10 max-h-[50vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
                        {/* Header with close button */}
                        <div className="sticky top-0 bg-black/95 backdrop-blur-xl z-10 border-b border-white/10 px-4 pt-4 pb-3">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    <FiSliders className="w-5 h-5" />
                                    Adjustments
                                </h3>
                                <button
                                    onClick={() => setShowAdjustments(false)}
                                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                    aria-label="Close adjustments"
                                >
                                    <FiX className="w-5 h-5 text-white/70" />
                                </button>
                            </div>
                            <div className="w-12 h-1 bg-white/30 rounded-full mx-auto"></div>
                        </div>

                        <div className="p-4 space-y-6">
                            {/* Adjustments Section */}
                            <div>
                                <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Basic Adjustments</h4>
                                <div className="space-y-5">
                                    {[
                                        {
                                            label: 'Brightness',
                                            icon: '☀️',
                                            value: brightness,
                                            min: 0.4,
                                            max: 1.8,
                                            step: 0.01,
                                            onChange: (v: number) => setBrightness(v),
                                            default: 1.0
                                        },
                                        {
                                            label: 'Contrast',
                                            icon: '⚡',
                                            value: contrast,
                                            min: 0.5,
                                            max: 2.0,
                                            step: 0.01,
                                            onChange: (v: number) => setContrast(v),
                                            default: 1.0
                                        },
                                        {
                                            label: 'Saturation',
                                            icon: '🌈',
                                            value: saturation,
                                            min: 0.0,
                                            max: 2.0,
                                            step: 0.01,
                                            onChange: (v: number) => setSaturation(v),
                                            default: 1.0
                                        },
                                        {
                                            label: 'Hue',
                                            icon: '🎨',
                                            value: hue,
                                            min: -1.0,
                                            max: 1.0,
                                            step: 0.001,
                                            onChange: (v: number) => setHue(v),
                                            default: 0.0
                                        },
                                    ].map(({ label, icon, value, min, max, step, onChange, default: defaultValue }) => {
                                        const isDefault = value === defaultValue;
                                        const percentage = ((value - min) / (max - min)) * 100;
                                        return (
                                            <div key={label} className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg">{icon}</span>
                                                        <span className="text-sm font-semibold text-white">{label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        {!isDefault && (
                                                            <button
                                                                onClick={() => onChange(defaultValue)}
                                                                className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                                                                title="Reset to default"
                                                            >
                                                                Reset
                                                            </button>
                                                        )}
                                                        <span className="text-sm font-bold text-white/90 min-w-[3rem] text-right">
                                                            {value > 0 ? '+' : ''}{((value - defaultValue) * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="range"
                                                        min={min}
                                                        max={max}
                                                        step={step}
                                                        value={value}
                                                        onChange={(e) => onChange(parseFloat(e.target.value))}
                                                        className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                                        style={{
                                                            background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${percentage}%, rgba(255, 255, 255, 0.1) ${percentage}%, rgba(255, 255, 255, 0.1) 100%)`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* LUT Section */}
                            <div className="border-t border-white/10 pt-6">
                                <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wider text-white/60">Color Grading</h4>

                                {/* LUT Amount */}
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">🎬</span>
                                            <span className="text-sm font-semibold text-white">LUT Intensity</span>
                                        </div>
                                        <span className="text-sm font-bold text-white/90 min-w-[3rem] text-right">
                                            {Math.round(lutAmount * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={lutAmount}
                                        onChange={(e) => setLutAmount(parseFloat(e.target.value))}
                                        className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb"
                                        style={{
                                            background: `linear-gradient(to right, rgba(139, 92, 246, 0.8) 0%, rgba(139, 92, 246, 0.8) ${lutAmount * 100}%, rgba(255, 255, 255, 0.1) ${lutAmount * 100}%, rgba(255, 255, 255, 0.1) 100%)`
                                        }}
                                    />
                                </div>

                                {/* Built-in LUTs */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-white mb-2">Preset LUTs</label>
                                    <select
                                        className="w-full px-4 py-3 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/10 focus:bg-white/10 focus:border-purple-500/50 transition-all cursor-pointer"
                                        value={selectedBuiltin.id}
                                        onChange={(e) => {
                                            const item = builtinLuts.find(b => b.id === e.target.value) || builtinLuts[0];
                                            loadBuiltinLut(item);
                                        }}
                                    >
                                        {builtinLuts.map(b => (
                                            <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom LUT */}
                                <div className="space-y-3 mt-4">
                                    <label className="block text-sm font-semibold text-white mb-2">Custom LUT</label>
                                    <label className="block w-full px-4 py-3 rounded-xl border-2 border-dashed border-white/30 bg-white/5 backdrop-blur-sm text-white text-sm font-medium cursor-pointer hover:bg-white/10 hover:border-purple-500/50 transition-all text-center">
                                        <input type="file" accept="image/png" onChange={onPickLut} className="hidden" />
                                        <span className="flex items-center justify-center gap-2">
                                            <FiImage className="w-4 h-4" />
                                            Choose LUT File
                                        </span>
                                    </label>
                                    {lutMeta && (
                                        <div className="px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
                                            <p className="text-xs text-white/90 font-medium">
                                                ✓ Loaded: {lutMeta.size}³ grid ({lutMeta.tiles}×{lutMeta.tiles} tiles)
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Action Bar */}
                <div className="absolute bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-black/90 via-black/80 to-transparent p-4 pb-safe">
                    {/* Adjustments Toggle Button */}
                    <button
                        onClick={() => setShowAdjustments(!showAdjustments)}
                        className="w-full mb-3 py-2 px-4 rounded-xl bg-white/10 backdrop-blur-sm text-white text-sm font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                    >
                        <FiSliders className="w-4 h-4" />
                        <span>Adjustments</span>
                        {showAdjustments ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handleSendToFeed}
                            disabled={postingFeed || postingClips}
                            className="py-3 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg transition-all relative"
                        >
                            {postingFeed ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <FiSend className="w-4 h-4" />
                                    <span>News Feed</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSendToClips}
                            disabled={postingFeed || postingClips}
                            className="py-3 rounded-xl bg-purple-600 text-white font-semibold disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg transition-all relative"
                        >
                            {postingClips ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    <span>Processing…</span>
                                </>
                            ) : (
                                <>
                                    <FiSend className="w-4 h-4" />
                                    <span>Clips</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}


