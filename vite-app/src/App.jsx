// Halftone tool — main React app.
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Halftone from './halftone-engine.js';
import sampleUrl from './sample-cat.jpg';

// ---------- defaults / presets ----------
const DEFAULTS = {
  mode: 'mono', // mono | duotone | cmyk
  shape: 'circle', // circle | square | diamond | line | cross
  cell: 10, // px in output space
  angle: 45,
  brightness: 0,
  contrast: 1.15,
  jitter: 0,
  invert: false,
  bg: '#f4efe4',
  ink: '#111111',
  inkC: '#00b3d9',
  inkM: '#e6007e',
  inkY: '#ffd400',
  inkK: '#0a0a0a',
  outputScale: 1.0 // 1.0 = match input
};

const PRESETS = [
{
  name: 'Newsprint',
  s: { mode: 'mono', shape: 'circle', cell: 9, angle: 45,
    brightness: 0, contrast: 1.2, jitter: 0, invert: false,
    bg: '#f1ece0', ink: '#161616' }
},
{
  name: 'CMYK',
  s: { mode: 'cmyk', shape: 'circle', cell: 10, angle: 45,
    brightness: 0, contrast: 1.1, jitter: 0,
    bg: '#f7f4ec',
    inkC: '#00b3d9', inkM: '#e6007e', inkY: '#ffd400', inkK: '#0a0a0a' }
},
{
  name: 'Riso',
  s: { mode: 'cmyk', shape: 'circle', cell: 12, angle: 45,
    brightness: 0.04, contrast: 1.05, jitter: 0.2,
    bg: '#fff7e6',
    inkC: '#1c5fbf', inkM: '#e35a8d', inkY: '#fff7e6', inkK: '#fff7e6' }
},
{
  name: 'Glow',
  s: { mode: 'duotone', shape: 'circle', cell: 8, angle: 0,
    brightness: -0.04, contrast: 1.25, jitter: 0, invert: true,
    bg: '#0a0a0c', ink: '#e8e0a8' }
},
{
  name: 'Engraving',
  s: { mode: 'mono', shape: 'line', cell: 7, angle: 30,
    brightness: 0, contrast: 1.35, jitter: 0,
    bg: '#efe9d8', ink: '#1a1a1a' }
},
{
  name: 'Grid',
  s: { mode: 'mono', shape: 'square', cell: 12, angle: 0,
    brightness: 0, contrast: 1.15, jitter: 0,
    bg: '#ece4cf', ink: '#111111' }
}];


// ---------- sample image ----------
// A photo bundled with the tool, shown as the default canvas so there's
// something to screen before the user loads their own image or video.
const SAMPLE_SRC = sampleUrl;
function loadSampleCanvas(onReady) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    onReady(c);
  };
  img.src = SAMPLE_SRC;
}

// ---------- color swatch input ----------
function Swatch({ label, value, onChange }) {
  return (
    <label className="swatch">
      <span className="swatch-dot" style={{ background: value }}>
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="swatch-label">{label}</span>
      <span className="swatch-hex">{value.toUpperCase()}</span>
    </label>);

}

// ---------- slider ----------
function Slider({ label, value, min, max, step, onChange, format }) {
  const fmt = format || ((v) => v.toFixed(2));
  return (
    <label className="slider">
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>);

}

// ---------- segmented ----------
function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) =>
      <button key={o.value}
      className={value === o.value ? 'seg seg-on' : 'seg'}
      onClick={() => onChange(o.value)}
      title={o.label}>
          {o.icon ? <span className="seg-icon">{o.icon}</span> : null}
          <span className="seg-text">{o.label}</span>
        </button>
      )}
    </div>);

}

// ---------- shape icon (small svg) ----------
function ShapeIcon({ kind }) {
  const c = '#cfcfd4';
  switch (kind) {
    case 'circle':
      return <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill={c} /></svg>;
    case 'square':
      return <svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill={c} /></svg>;
    case 'diamond':
      return <svg viewBox="0 0 16 16"><polygon points="8,2 14,8 8,14 2,8" fill={c} /></svg>;
    case 'line':
      return <svg viewBox="0 0 16 16"><rect x="1" y="6" width="14" height="4" fill={c} /></svg>;
    case 'cross':
      return <svg viewBox="0 0 16 16">
        <rect x="2" y="6.5" width="12" height="3" fill={c} />
        <rect x="6.5" y="2" width="3" height="12" fill={c} />
      </svg>;
    default:return null;
  }
}

// ---------- main app ----------
function App() {
  const [s, setS] = useState(DEFAULTS);
  const [sourceLabel, setSourceLabel] = useState('SAMPLE.JPG');
  const [sourceKind, setSourceKind] = useState('sample'); // sample | image | video
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState({ w: 0, h: 0, fps: 0 });
  const [dropping, setDropping] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [sampleVer, setSampleVer] = useState(0);

  // refs
  const workingRef = useRef(null); // hidden source-prep canvas
  const outRef = useRef(null); // visible output canvas
  const videoRef = useRef(null); // hidden video element
  const imageRef = useRef(null); // current HTMLImageElement
  const sampleRef = useRef(null); // sample canvas
  const rafRef = useRef(0);
  const lastFpsAt = useRef({ t: performance.now(), n: 0, fps: 0 });
  const recorderRef = useRef(null);
  const recordStartRef = useRef(0);
  const lastUrlRef = useRef(null); // object URL of the current image/video, revoked on next load

  // Load the bundled sample photo into the canvas once on mount.
  useEffect(() => {
    loadSampleCanvas((c) => { sampleRef.current = c; setSampleVer((v) => v + 1); });
  }, []);

  // Update single setting
  const set = useCallback((key, val) => {
    setS((p) => ({ ...p, [key]: val }));
  }, []);

  // Current source provider
  const getSource = useCallback(() => {
    if (sourceKind === 'image' && imageRef.current) return imageRef.current;
    if (sourceKind === 'video' && videoRef.current &&
    videoRef.current.readyState >= 2) return videoRef.current;
    return sampleRef.current;
  }, [sourceKind]);

  // Compute output dimensions based on source + scale
  const sizeOutput = useCallback(() => {
    const src = getSource();
    if (!src) return null;
    let sw = src.videoWidth || src.naturalWidth || src.width;
    let sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) return null;
    // Cap output canvas to a reasonable size for performance
    const cap = 1400;
    const k = Math.min(1, cap / Math.max(sw, sh)) * s.outputScale;
    return { w: Math.max(2, Math.round(sw * k)), h: Math.max(2, Math.round(sh * k)) };
  }, [getSource, s.outputScale]);

  const renderOnce = useCallback(() => {
    const src = getSource();
    if (!src) return;
    const working = workingRef.current;
    const out = outRef.current;
    if (!working || !out) return;
    // Sample working canvas at ~2x cell density for crisp sampling
    const maxWorking = 900;
    const got = Halftone.prepareSource(src, working, maxWorking);
    if (!got) return;
    const sz = sizeOutput();
    if (!sz) return;
    if (out.width !== sz.w) out.width = sz.w;
    if (out.height !== sz.h) out.height = sz.h;

    const opts = {
      mode: s.mode,
      shape: s.shape,
      cell: s.cell,
      angle: s.angle,
      brightness: s.brightness,
      contrast: s.contrast,
      jitter: s.jitter,
      invert: s.invert,
      bg: s.bg,
      ink: s.ink,
      inks: { c: s.inkC, m: s.inkM, y: s.inkY, k: s.inkK }
    };
    Halftone.renderHalftone(working, out, opts);

    // meta + fps
    const now = performance.now();
    lastFpsAt.current.n += 1;
    const elapsed = now - lastFpsAt.current.t;
    if (elapsed > 500) {
      const fps = Math.round(lastFpsAt.current.n * 1000 / elapsed);
      lastFpsAt.current.t = now;lastFpsAt.current.n = 0;lastFpsAt.current.fps = fps;
      setMeta({ w: sz.w, h: sz.h, fps });
    } else {
      setMeta((m) => m.w === sz.w && m.h === sz.h ? m : { ...m, w: sz.w, h: sz.h });
    }
  }, [s, getSource, sizeOutput]);

  // Static render whenever settings or source change (and we're NOT playing video)
  useEffect(() => {
    if (playing) return;
    // Defer one frame so source is ready (esp. for image swap)
    const id = requestAnimationFrame(renderOnce);
    return () => cancelAnimationFrame(id);
  }, [s, sourceKind, playing, renderOnce, sampleVer]);

  // RAF loop while playing (video) OR recording
  useEffect(() => {
    if (!playing && !recording) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      renderOnce();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {alive = false;cancelAnimationFrame(rafRef.current);};
  }, [playing, recording, renderOnce]);

  // Record timer tick
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      setRecordTime((performance.now() - recordStartRef.current) / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  // ---------- source loaders ----------
  const loadImageFile = useCallback((file) => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    const url = URL.createObjectURL(file);
    lastUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setSourceKind('image');
      setSourceLabel(file.name.toUpperCase().slice(0, 28));
      setPlaying(false);
      stopVideo();
    };
    img.src = url;
  }, []);

  const loadVideoFile = useCallback((file) => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    const url = URL.createObjectURL(file);
    lastUrlRef.current = url;
    if (!videoRef.current) {
      videoRef.current = document.createElement('video');
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      videoRef.current.playsInline = true;
    }
    const v = videoRef.current;
    v.src = url;
    v.onloadeddata = () => {
      setSourceKind('video');
      setSourceLabel(file.name.toUpperCase().slice(0, 28));
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
  }, []);

  const stopVideo = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
  }, []);

  const useSample = useCallback(() => {
    stopVideo();
    setSourceKind('sample');
    setSourceLabel('SAMPLE.JPG');
    setPlaying(false);
  }, [stopVideo]);

  const togglePlay = useCallback(() => {
    if (sourceKind !== 'video') return;
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      v.play().then(() => setPlaying(true)).catch(() => {});
    }
  }, [playing, sourceKind]);

  // ---------- export ----------
  const downloadPNG = useCallback(() => {
    const c = outRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `noise-maker-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }, []);

  const downloadSVG = useCallback(() => {
    const out = outRef.current;
    const working = workingRef.current;
    if (!out || !working || !working.width) return;
    const opts = {
      mode: s.mode, shape: s.shape, cell: s.cell, angle: s.angle,
      brightness: s.brightness, contrast: s.contrast, jitter: s.jitter,
      invert: s.invert, bg: s.bg, ink: s.ink,
      inks: { c: s.inkC, m: s.inkM, y: s.inkY, k: s.inkK }
    };
    const svg = Halftone.renderHalftoneSVG(working, out.width, out.height, opts);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noise-maker-${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [s]);

  const startRecord = useCallback(() => {
    const c = outRef.current;
    if (!c || recording) return;
    try {
      const stream = c.captureStream(30);
      const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'];

      const mimeType = candidates.find((t) =>
      window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)
      ) || '';
      const rec = new MediaRecorder(stream,
      mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => {if (e.data && e.data.size) chunks.push(e.data);};
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `noise-maker-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      rec.start(250);
      recorderRef.current = rec;
      recordStartRef.current = performance.now();
      setRecording(true);
      setRecordTime(0);
      // If a video source is loaded, auto-play it so frames advance
      if (sourceKind === 'video' && videoRef.current) {
        videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
      }
    } catch (e) {
      console.error(e);
      alert('Video recording is not supported in this browser.');
    }
  }, [recording, sourceKind]);

  const stopRecord = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {rec.stop();} catch (e) {}
    recorderRef.current = null;
    setRecording(false);
  }, []);

  // ---------- drag & drop / paste / file inputs ----------
  const fileInputRef = useRef(null);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDropping(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!f) return;
    if (f.type.startsWith('image/')) loadImageFile(f);else
    if (f.type.startsWith('video/')) loadVideoFile(f);
  }, [loadImageFile, loadVideoFile]);

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f && f.type.startsWith('image/')) {loadImageFile(f);break;}
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadImageFile]);

  const onPickFile = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.type.startsWith('image/')) loadImageFile(f);else
    if (f.type.startsWith('video/')) loadVideoFile(f);
    e.target.value = '';
  }, [loadImageFile, loadVideoFile]);

  const applyPreset = useCallback((p) => {
    setS((prev) => ({ ...prev, ...p.s }));
  }, []);

  // ---------- UI ----------
  const showVideoControls = sourceKind === 'video';

  // Export action buttons — rendered in the right panel on desktop and in a
  // single-row bar above the image on mobile (same handlers, two mount points).
  const renderExportActions = () => (
    <div className="action-grid">
      <button className="btn btn-primary" onClick={downloadPNG}>Export PNG</button>
      <button className="btn btn-accent" onClick={downloadSVG}>Export SVG</button>
      <button className={'btn ' + (recording ? 'btn-record on' : 'btn-record')}
      onClick={recording ? stopRecord : startRecord}>
        <span className="rec-dot" aria-hidden="true" />
        <span>{recording ? `Stop · ${recordTime.toFixed(1)}s` : 'Record'}</span>
      </button>
      <button className="btn btn-ghost" onClick={() => setS(DEFAULTS)}>Reset</button>
    </div>
  );

  return (
    <div className="app">
      {/* Top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="22" height="22">
              <circle cx="6" cy="6" r="1.2" fill="currentColor" />
              <circle cx="16" cy="6" r="2.4" fill="currentColor" />
              <circle cx="26" cy="6" r="3.4" fill="currentColor" />
              <circle cx="6" cy="16" r="2.4" fill="currentColor" />
              <circle cx="16" cy="16" r="3.4" fill="currentColor" />
              <circle cx="26" cy="16" r="4.2" fill="currentColor" />
              <circle cx="6" cy="26" r="3.4" fill="currentColor" />
              <circle cx="16" cy="26" r="4.2" fill="currentColor" />
              <circle cx="26" cy="26" r="5" fill="currentColor" />
            </svg>
          </span>
          <div className="brand-text">
            <div className="brand-name">A NOISE MAKER</div>
            <div className="brand-sub">A Graphic Texture Tool | Add images or video, edit and export</div>
          </div>
        </div>
      </header>

      {/* Mobile-only: export buttons in a single row above the image */}
      <div className="mobile-actions">{renderExportActions()}</div>

      <div className="body">
        {/* Canvas viewport */}
        <main
          className={'viewport ' + (dropping ? 'dropping' : '')}
          onDragOver={(e) => {e.preventDefault();setDropping(true);}}
          onDragLeave={() => setDropping(false)}
          onDrop={onDrop}>
          <div className="viewport-frame">
            <canvas ref={outRef} className="output-canvas" />
            <canvas ref={workingRef} style={{ display: 'none' }} />
          </div>
          {showVideoControls &&
          <div className="vp-controls">
              <button className="btn btn-ghost" onClick={togglePlay}>
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <span className="vp-controls-label">video clip</span>
            </div>
          }
          {dropping && <div className="drop-overlay">Drop image or video</div>}
        </main>

        {/* Controls panel */}
        <aside className="panel">
          <div className="panel-section panel-section--export">
            <div className="panel-title">Export</div>
            {renderExportActions()}
          </div>

          <div className="panel-section">
            <div className="panel-title">Source</div>
            <div className="source-tabs" role="tablist">
              <button className={'src-tab ' + (sourceKind === 'sample' ? 'on' : '')}
              onClick={useSample}>
                <span className="src-glyph">▦</span><span>Sample</span>
              </button>
              <button className={'src-tab ' + (sourceKind === 'image' || sourceKind === 'video' ? 'on' : '')}
              onClick={() => fileInputRef.current.click()}>
                <span className="src-glyph">↑</span><span>Add file…</span>
              </button>
            </div>
            <div className="source-meta">
              <span className="src-label">{sourceLabel}</span>
              <span className="src-dot">·</span>
              <span className="src-dim">{meta.w}×{meta.h}</span>
              {playing ?
              <><span className="src-dot">·</span><span className="src-live">● {meta.fps} fps</span></> :
              <><span className="src-dot">·</span><span className="src-static">static</span></>}
            </div>
            <input ref={fileInputRef} type="file"
            accept="image/*,video/*" style={{ display: 'none' }}
            onChange={onPickFile} />
          </div>

          <div className="panel-section">
            <div className="panel-title">Presets</div>
            <div className="preset-grid">
              {PRESETS.map((p) =>
              <button key={p.name} className="preset-card"
              onClick={() => applyPreset(p)}
              title={p.name}>
                  <span className="preset-swatch" style={{ background: p.s.bg }}>
                    <span className="preset-dot" style={{ background: p.s.ink || p.s.inkK || '#000' }} />
                    {p.s.mode === 'cmyk' &&
                  <>
                        <span className="preset-dot preset-dot-2" style={{ background: p.s.inkC }} />
                        <span className="preset-dot preset-dot-3" style={{ background: p.s.inkM }} />
                      </>
                  }
                  </span>
                  <span className="preset-name">{p.name}</span>
                </button>
              )}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">Mode</div>
            <Segmented
              value={s.mode}
              onChange={(v) => set('mode', v)}
              options={[
              { value: 'mono', label: 'Mono' },
              { value: 'duotone', label: 'Duotone' },
              { value: 'cmyk', label: 'CMYK' }]
              } />
            
          </div>

          <div className="panel-section">
            <div className="panel-title">Shape</div>
            <div className="shape-grid">
              {['circle', 'square', 'diamond', 'line', 'cross'].map((k) =>
              <button key={k}
              className={'shape-btn ' + (s.shape === k ? 'on' : '')}
              onClick={() => set('shape', k)}
              title={k}>
                  <ShapeIcon kind={k} />
                  <span>{k}</span>
                </button>
              )}
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-title">Geometry</div>
            <Slider label="Cell size" value={s.cell} min={3} max={36} step={1}
            onChange={(v) => set('cell', v)} format={(v) => v + ' px'} />
            {s.mode !== 'cmyk' &&
            <Slider label="Angle" value={s.angle} min={0} max={90} step={1}
            onChange={(v) => set('angle', v)} format={(v) => v + '°'} />
            }
            <Slider label="Jitter" value={s.jitter} min={0} max={1} step={0.01}
            onChange={(v) => set('jitter', v)} format={(v) => v.toFixed(2)} />
          </div>

          <div className="panel-section">
            <div className="panel-title">Tone</div>
            <Slider label="Brightness" value={s.brightness} min={-0.5} max={0.5} step={0.01}
            onChange={(v) => set('brightness', v)} format={(v) => (v >= 0 ? '+' : '') + v.toFixed(2)} />
            <Slider label="Contrast" value={s.contrast} min={0.4} max={2.5} step={0.01}
            onChange={(v) => set('contrast', v)} format={(v) => v.toFixed(2) + '×'} />
            {s.mode !== 'cmyk' &&
            <label className="check">
                <input type="checkbox" checked={s.invert}
              onChange={(e) => set('invert', e.target.checked)} />
                <span>Invert (light ink on dark bg)</span>
              </label>
            }
          </div>

          <div className="panel-section">
            <div className="panel-title">Ink</div>
            <Swatch label="Background" value={s.bg} onChange={(v) => set('bg', v)} />
            {s.mode !== 'cmyk' &&
            <Swatch label="Ink" value={s.ink} onChange={(v) => set('ink', v)} />
            }
            {s.mode === 'cmyk' &&
            <div className="cmyk-grid">
                <Swatch label="C" value={s.inkC} onChange={(v) => set('inkC', v)} />
                <Swatch label="M" value={s.inkM} onChange={(v) => set('inkM', v)} />
                <Swatch label="Y" value={s.inkY} onChange={(v) => set('inkY', v)} />
                <Swatch label="K" value={s.inkK} onChange={(v) => set('inkK', v)} />
              </div>
            }
          </div>

          <div className="panel-section">
            <div className="panel-title">Output</div>
            <Slider label="Scale" value={s.outputScale} min={0.4} max={1.8} step={0.05}
            onChange={(v) => set('outputScale', v)}
            format={(v) => v.toFixed(2) + '×'} />
          </div>

          <div className="panel-footer">
            <div className="privacy-line">
              <strong>Your images never leave your device.</strong> Every render happens locally in your browser. Nothing is uploaded, there are no servers, no tracking, and no account.
            </div>

            <details className="about-drop">
              <summary className="footer-about">
                <span>About</span>
                <span className="about-caret" aria-hidden="true">▾</span>
              </summary>
              <div className="about-drop-body">
                <p className="about-lede">A Noise Maker lets users use a variety of textures and adjustment features to edit their images and videos and export the result as a PNG, SVG, or a recorded WebM file. Have fun!</p>

                <div className="about-block">
                  <div className="about-block-title">License · MIT</div>
                  <p>Released under the permissive MIT License — free to use, copy,
                  modify, and distribute, including commercially, provided the
                  notice below travels with substantial copies.</p>
                  <pre className="about-license">{`MIT License

Copyright (c) 2026 A Noise Maker

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`}</pre>
                </div>

                <div className="about-block">
                  <div className="about-block-title">Credits</div>
                  <ul className="about-credits">
                    <li><b>React &amp; React DOM</b><i>MIT</i></li>
                    <li><b>Babel (standalone)</b><i>MIT</i></li>
                    <li><b>Andada Pro typeface</b><i>OFL 1.1</i></li>
                  </ul>
                </div>

                <div className="about-block">
                  <div className="about-block-title">Method</div>
                  <p>The halftone method itself — luminance sampling, dot screening,
                  and the traditional CMYK screen angles — is long-established,
                  unpatented prepress technique in the public domain.</p>
                </div>
              </div>
            </details>

            <div className="footer-formats">PNG · SVG · WebM · drop or paste</div>
          </div>
        </aside>
      </div>
    </div>);

}

export default App;