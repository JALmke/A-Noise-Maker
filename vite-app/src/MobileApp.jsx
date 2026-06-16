// =============================================================================
// A Noise Maker — MOBILE component (Concept A "Split Studio", layout="a").
// ES module for the Vite build. Also supports layout="b" for reference.
// Container-relative (.mh-root fills its parent), so it works full-screen.
// =============================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Halftone from './halftone-engine.js';
import sampleUrl from './sample-cat.jpg';

// ---------- save / share helpers ----------
// A web page can't write straight into the phone's photo library, but the
// native Share Sheet can: navigator.share({files}) → user taps "Save Image"
// → it lands in Photos. We must call it with the user's tap still "active",
// so files are built SYNCHRONOUSLY (toDataURL, not the async toBlob) to keep
// that activation alive on iOS. Desktop & unsupported cases fall back to a
// normal download.
function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(',');
  const mime = (head.match(/:(.*?);/) || [, 'application/octet-stream'])[1];
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
function canvasToFile(canvas, type, name) {
  return new File([dataURLtoBlob(canvas.toDataURL(type))], name, { type });
}
function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function saveOrShare(file, report) {
  // Returns the outcome via report(status, detail) so the UI can show what
  // actually happened on the user's device. Statuses:
  //   'shared'    — native share sheet opened (offers "Save Image" → Photos)
  //   'cancelled' — user dismissed the share sheet
  //   'download'  — no file-share support; fell back to a file download
  //   'error'     — share threw; fell back to a file download
  const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  if (canShareFiles && navigator.share) {
    return navigator.share({ files: [file], title: file.name })
      .then(() => report && report('shared'))
      .catch((err) => {
        if (err && err.name === 'AbortError') { report && report('cancelled'); return; }
        downloadFile(file);
        report && report('error', (err && err.name) || 'share failed');
      });
  }
  downloadFile(file);
  report && report('download', !navigator.share ? 'no Web Share' : 'type not shareable');
  return Promise.resolve();
}

// ---------- defaults / presets ----------
const DEFAULTS = {
  mode: 'mono', shape: 'circle', dither: 'bayer4', cell: 10, angle: 45,
  brightness: 0, contrast: 1.15, jitter: 0, invert: false,
  bg: '#f4efe4', ink: '#111111',
  inkC: '#00b3d9', inkM: '#e6007e', inkY: '#ffd400', inkK: '#0a0a0a',
  outputScale: 1.0
};

const PRESETS = [
  { name: 'Newsprint', s: { mode: 'mono', shape: 'circle', cell: 9, angle: 45, brightness: 0, contrast: 1.2, jitter: 0, invert: false, bg: '#f1ece0', ink: '#161616' } },
  { name: 'CMYK', s: { mode: 'cmyk', shape: 'circle', cell: 10, angle: 45, brightness: 0, contrast: 1.1, jitter: 0, bg: '#f7f4ec', inkC: '#00b3d9', inkM: '#e6007e', inkY: '#ffd400', inkK: '#0a0a0a' } },
  { name: 'Riso', s: { mode: 'cmyk', shape: 'circle', cell: 12, angle: 45, brightness: 0.04, contrast: 1.05, jitter: 0.2, bg: '#fff7e6', inkC: '#1c5fbf', inkM: '#e35a8d', inkY: '#fff7e6', inkK: '#fff7e6' } },
  { name: 'Glow', s: { mode: 'duotone', shape: 'circle', cell: 8, angle: 0, brightness: -0.04, contrast: 1.25, jitter: 0, invert: true, bg: '#0a0a0c', ink: '#e8e0a8' } },
  { name: 'Engraving', s: { mode: 'mono', shape: 'line', cell: 7, angle: 30, brightness: 0, contrast: 1.35, jitter: 0, bg: '#efe9d8', ink: '#1a1a1a' } },
  { name: 'Grid', s: { mode: 'mono', shape: 'square', cell: 12, angle: 0, brightness: 0, contrast: 1.15, jitter: 0, bg: '#ece4cf', ink: '#111111' } },
  { name: 'Dither', s: { mode: 'bitmap', dither: 'bayer4', cell: 5, brightness: 0, contrast: 1.2, jitter: 0, invert: false, bg: '#efe9d8', ink: '#161616' } },
  { name: 'Console', s: { mode: 'bitmap', dither: 'floyd', cell: 4, brightness: 0.02, contrast: 1.3, jitter: 0, invert: true, bg: '#0f1410', ink: '#9bbc0f' } }
];

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

// ---------- small reusable controls ----------
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
function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) =>
        <button key={o.value} className={value === o.value ? 'seg seg-on' : 'seg'} onClick={() => onChange(o.value)}>
          {o.label}
        </button>)}
    </div>);
}
function ShapeIcon({ kind }) {
  const c = '#cfcfd4';
  switch (kind) {
    case 'circle': return <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5" fill={c} /></svg>;
    case 'square': return <svg viewBox="0 0 16 16"><rect x="3" y="3" width="10" height="10" fill={c} /></svg>;
    case 'diamond': return <svg viewBox="0 0 16 16"><polygon points="8,2 14,8 8,14 2,8" fill={c} /></svg>;
    case 'line': return <svg viewBox="0 0 16 16"><rect x="1" y="6" width="14" height="4" fill={c} /></svg>;
    case 'cross': return <svg viewBox="0 0 16 16"><rect x="2" y="6.5" width="12" height="3" fill={c} /><rect x="6.5" y="2" width="3" height="12" fill={c} /></svg>;
    default: return null;
  }
}
function DitherIcon({ kind }) {
  const c = '#cfcfd4';
  const r = (x, y, w = 2, h = 2) => <rect key={x + '-' + y} x={x} y={y} width={w} height={h} fill={c} />;
  switch (kind) {
    case 'bayer4': return <svg viewBox="0 0 16 16">{[0, 4, 8, 12].flatMap((y, j) => [0, 4, 8, 12].filter((x, i) => (i + j) % 2 === 0).map((x) => r(x, y)))}</svg>;
    case 'bayer8': return <svg viewBox="0 0 16 16">{[0, 3, 6, 9, 12].flatMap((y, j) => [0, 3, 6, 9, 12].filter((x, i) => (i + j) % 2 === 0).map((x) => r(x, y, 1.6, 1.6)))}</svg>;
    case 'floyd': return <svg viewBox="0 0 16 16">{[[1, 1], [5, 2], [11, 1], [3, 5], [8, 4], [13, 6], [2, 9], [7, 8], [10, 10], [14, 11], [4, 12], [12, 14]].map(([x, y]) => r(x, y, 1.7, 1.7))}</svg>;
    case 'atkinson': return <svg viewBox="0 0 16 16">{[[2, 2], [9, 3], [13, 5], [5, 7], [11, 9], [3, 11], [8, 13]].map(([x, y]) => r(x, y, 1.7, 1.7))}</svg>;
    case 'noise': return <svg viewBox="0 0 16 16">{[[1, 2], [4, 1], [7, 3], [10, 1], [13, 4], [2, 6], [6, 7], [12, 6], [9, 9], [3, 10], [14, 11], [7, 12], [11, 13], [1, 13]].map(([x, y]) => r(x, y, 1.5, 1.5))}</svg>;
    default: return null;
  }
}

// Diagnostic readout shown after an export — tells the user (and us) exactly
// which path the browser took, so a "nothing saved" report is debuggable.
function ExportStatus({ s }) {
  const map = {
    working: { tone: 'dim', text: `Preparing ${s.kind}…` },
    ready: { tone: 'dim', text: `${s.kind} recorded — tap “Save video” below.` },
    shared: { tone: 'ok', text: `Share sheet opened for ${s.kind}. Choose “Save Image”/“Save Video” to add it to Photos.` },
    cancelled: { tone: 'dim', text: `Share cancelled — nothing saved.` },
    download: { tone: 'warn', text: `This browser can’t open the share sheet (${s.detail}). ${s.kind} was saved to your downloads instead.` },
    error: { tone: 'warn', text: `Share didn’t open (${s.detail}). ${s.kind} was saved to your downloads instead.` }
  };
  const r = map[s.status] || { tone: 'dim', text: '' };
  const color = r.tone === 'ok' ? 'var(--accent-blue)' : r.tone === 'warn' ? 'var(--rec)' : 'var(--text-dim)';
  return <p className="mh-export-hint" style={{ borderColor: color, color }}>{r.text}</p>;
}

// ---------- category icons (stroked, 24-grid) ----------
function CatIcon({ id }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (id) {
    case 'source': return <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" {...p} /><circle cx="8.5" cy="10" r="1.6" {...p} /><path d="M4 17l5-5 4 4 3-3 4 4" {...p} /></svg>;
    case 'presets': return <svg viewBox="0 0 24 24"><circle cx="7" cy="7" r="2.2" {...p} /><circle cx="17" cy="7" r="2.8" {...p} /><circle cx="7" cy="17" r="2.8" {...p} /><circle cx="17" cy="17" r="2.2" {...p} /></svg>;
    case 'mode': return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" /></svg>;
    case 'shape': return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" {...p} /></svg>;
    case 'geometry': return <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" {...p} /><path d="M4 10h16M4 16h16M10 4v16M16 4v16" {...p} /></svg>;
    case 'tone': return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" {...p} /><path d="M12 3.5v17" {...p} /><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" /></svg>;
    case 'ink': return <svg viewBox="0 0 24 24"><path d="M12 3s6 6.5 6 10.5a6 6 0 0 1-12 0C6 9.5 12 3 12 3z" {...p} /></svg>;
    case 'output': return <svg viewBox="0 0 24 24"><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" {...p} /><rect x="8" y="8" width="8" height="8" rx="1" {...p} /></svg>;
    case 'export': return <svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5" {...p} /><path d="M5 20h14" {...p} /></svg>;
    case 'info': return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" {...p} /><path d="M12 11v5" {...p} /><circle cx="12" cy="7.8" r="0.6" fill="currentColor" stroke="none" /></svg>;
    case 'close': return <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" {...p} /></svg>;
    default: return null;
  }
}

// =============================================================================
// Main component
// =============================================================================
function MobileHalftone({ layout = 'a' }) {
  const [s, setS] = useState(DEFAULTS);
  const [sourceLabel, setSourceLabel] = useState('SAMPLE.JPG');
  const [sourceKind, setSourceKind] = useState('sample');
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState({ w: 0, h: 0, fps: 0 });
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [sampleVer, setSampleVer] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [videoErr, setVideoErr] = useState(null);
  const [exportStatus, setExportStatus] = useState(null); // {kind, status, detail}
  const [pendingVideo, setPendingVideo] = useState(null); // File awaiting a user-gesture save

  // layout A: which category tab is active (always one). layout B: which sheet is open (or null).
  const [tab, setTab] = useState('presets');
  const [sheet, setSheet] = useState(null);

  const workingRef = useRef(null);
  const outRef = useRef(null);
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const sampleRef = useRef(null);
  const rafRef = useRef(0);
  const lastFpsAt = useRef({ t: performance.now(), n: 0, fps: 0 });
  const recorderRef = useRef(null);
  const recordStartRef = useRef(0);
  const lastUrlRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSampleCanvas((c) => { sampleRef.current = c; setSampleVer((v) => v + 1); });
  }, []);

  const set = useCallback((key, val) => setS((p) => ({ ...p, [key]: val })), []);

  const getSource = useCallback(() => {
    if (sourceKind === 'image' && imageRef.current) return imageRef.current;
    // In video mode, ALWAYS return the video element if it exists — never fall
    // back to the sample. On loop the browser briefly drops readyState below 2
    // while seeking to 0; gating here flashed the sample image for a frame.
    if (sourceKind === 'video' && videoRef.current) return videoRef.current;
    return sampleRef.current;
  }, [sourceKind]);

  const sizeOutput = useCallback(() => {
    const src = getSource();
    if (!src) return null;
    let sw = src.videoWidth || src.naturalWidth || src.width;
    let sh = src.videoHeight || src.naturalHeight || src.height;
    if (!sw || !sh) return null;
    const cap = 1400;
    const k = Math.min(1, cap / Math.max(sw, sh)) * s.outputScale;
    return { w: Math.max(2, Math.round(sw * k)), h: Math.max(2, Math.round(sh * k)) };
  }, [getSource, s.outputScale]);

  const renderOnce = useCallback(() => {
    const src = getSource();
    if (!src) return;
    // A video mid-seek (e.g. looping back to the start) isn't ready to draw;
    // hold the previous frame rather than drawing a blank or the sample.
    if (sourceKind === 'video' && src.readyState < 2) return;
    const working = workingRef.current, out = outRef.current;
    if (!working || !out) return;
    const got = Halftone.prepareSource(src, working, 900);
    if (!got) return;
    const sz = sizeOutput();
    if (!sz) return;
    if (out.width !== sz.w) out.width = sz.w;
    if (out.height !== sz.h) out.height = sz.h;
    Halftone.renderHalftone(working, out, {
      mode: s.mode, shape: s.shape, dither: s.dither, cell: s.cell, angle: s.angle,
      brightness: s.brightness, contrast: s.contrast, jitter: s.jitter, invert: s.invert,
      bg: s.bg, ink: s.ink, inks: { c: s.inkC, m: s.inkM, y: s.inkY, k: s.inkK }
    });
    const now = performance.now();
    lastFpsAt.current.n += 1;
    const elapsed = now - lastFpsAt.current.t;
    if (elapsed > 500) {
      const fps = Math.round(lastFpsAt.current.n * 1000 / elapsed);
      lastFpsAt.current.t = now; lastFpsAt.current.n = 0; lastFpsAt.current.fps = fps;
      setMeta({ w: sz.w, h: sz.h, fps });
    } else {
      setMeta((m) => m.w === sz.w && m.h === sz.h ? m : { ...m, w: sz.w, h: sz.h });
    }
  }, [s, sourceKind, getSource, sizeOutput]);

  useEffect(() => {
    if (playing) return;
    const id = requestAnimationFrame(renderOnce);
    return () => cancelAnimationFrame(id);
  }, [s, sourceKind, playing, renderOnce, sampleVer]);

  useEffect(() => {
    if (!playing && !recording) return;
    let alive = true;
    const tick = () => { if (!alive) return; renderOnce(); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [playing, recording, renderOnce]);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordTime((performance.now() - recordStartRef.current) / 1000), 250);
    return () => clearInterval(id);
  }, [recording]);

  const stopVideo = useCallback(() => { if (videoRef.current) videoRef.current.pause(); }, []);

  const loadImageFile = useCallback((file) => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    const url = URL.createObjectURL(file);
    lastUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img; setSourceKind('image');
      setSourceLabel(file.name.toUpperCase().slice(0, 24)); setPlaying(false); stopVideo();
    };
    img.src = url;
  }, [stopVideo]);

  // Lazily create the <video> and ATTACH IT TO THE DOM. iOS Safari will not
  // decode frames to <canvas> from a detached video, and won't decode at all
  // from a display:none one — so it lives 1px and nearly invisible, but rendered.
  const ensureVideoEl = useCallback(() => {
    if (!videoRef.current) {
      const v = document.createElement('video');
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.preload = 'auto'; v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', ''); v.setAttribute('disableRemotePlayback', '');
      v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1;';
      document.body.appendChild(v);
      videoRef.current = v;
    }
    return videoRef.current;
  }, []);

  const loadVideoFile = useCallback((file) => {
    if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    const url = URL.createObjectURL(file);
    lastUrlRef.current = url;
    const v = ensureVideoEl();
    setVideoErr(null);

    let readied = false;
    const ready = () => {
      if (readied) return;
      readied = true;
      setSourceKind('video');
      setSourceLabel(file.name.toUpperCase().slice(0, 24));
      setSampleVer((n) => n + 1); // force a render now that a frame exists
      // muted + inline autoplay is permitted on iOS; if it's blocked, fall back
      // to a single decoded still frame via a tiny seek so the user still sees it.
      v.play().then(() => setPlaying(true)).catch(() => {
        setPlaying(false);
        try { v.currentTime = Math.min(0.1, (v.duration || 1) * 0.05); } catch (e) {}
      });
    };

    v.onloadeddata = ready;
    v.oncanplay = ready;
    v.onseeked = () => setSampleVer((n) => n + 1);
    v.onerror = () => {
      setVideoErr("This video format can't be used here. Try an MP4 (H.264).");
      setSourceKind('sample'); setSourceLabel('SAMPLE.JPG'); setPlaying(false);
    };

    v.srcObject = null;
    v.src = url;
    v.load();
  }, [ensureVideoEl]);

  const useSample = useCallback(() => { stopVideo(); setSourceKind('sample'); setSourceLabel('SAMPLE.JPG'); setPlaying(false); }, [stopVideo]);

  const togglePlay = useCallback(() => {
    if (sourceKind !== 'video') return;
    const v = videoRef.current; if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play().then(() => setPlaying(true)).catch(() => {}); }
  }, [playing, sourceKind]);

  const onPickFile = useCallback((e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.type.startsWith('image/')) loadImageFile(f);
    else if (f.type.startsWith('video/')) loadVideoFile(f);
    e.target.value = '';
  }, [loadImageFile, loadVideoFile]);

  const applyPreset = useCallback((p) => setS((prev) => ({ ...prev, ...p.s })), []);

  const reportExport = useCallback((kind) => (status, detail) => {
    setExportStatus({ kind, status, detail });
  }, []);

  const downloadPNG = useCallback(() => {
    const c = outRef.current; if (!c) return;
    setExportStatus({ kind: 'PNG', status: 'working' });
    // Build the file synchronously so the share sheet keeps the user's tap
    // activation (lets iOS offer "Save Image" → Photos).
    saveOrShare(canvasToFile(c, 'image/png', `noise-maker-${Date.now()}.png`), reportExport('PNG'));
  }, [reportExport]);

  const downloadSVG = useCallback(() => {
    const out = outRef.current, working = workingRef.current;
    if (!out || !working || !working.width) return;
    const svg = Halftone.renderHalftoneSVG(working, out.width, out.height, {
      mode: s.mode, shape: s.shape, dither: s.dither, cell: s.cell, angle: s.angle,
      brightness: s.brightness, contrast: s.contrast, jitter: s.jitter, invert: s.invert,
      bg: s.bg, ink: s.ink, inks: { c: s.inkC, m: s.inkM, y: s.inkY, k: s.inkK }
    });
    const file = new File([svg], `noise-maker-${Date.now()}.svg`, { type: 'image/svg+xml' });
    setExportStatus({ kind: 'SVG', status: 'working' });
    saveOrShare(file, reportExport('SVG'));
  }, [s, reportExport]);

  const startRecord = useCallback(() => {
    const c = outRef.current; if (!c || recording) return;
    try {
      const stream = c.captureStream(30);
      const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
      const mimeType = candidates.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8000000 } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        // Recording finishes OUTSIDE a user gesture, so navigator.share would be
        // blocked here. Stash the file and let the user tap "Save video" (a real
        // gesture) to trigger the share sheet / download.
        const file = new File([new Blob(chunks, { type: 'video/webm' })], `noise-maker-${Date.now()}.webm`, { type: 'video/webm' });
        setPendingVideo(file);
        setExportStatus({ kind: 'WebM', status: 'ready' });
      };
      rec.start(250);
      recorderRef.current = rec; recordStartRef.current = performance.now();
      setRecording(true); setRecordTime(0);
      if (sourceKind === 'video' && videoRef.current) videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
    } catch (e) { console.error(e); alert('Video recording is not supported in this browser.'); }
  }, [recording, sourceKind]);

  const stopRecord = useCallback(() => {
    const rec = recorderRef.current; if (!rec) return;
    try { rec.stop(); } catch (e) {}
    recorderRef.current = null; setRecording(false);
  }, []);

  // ---------- control-group bodies (shared by both layouts) ----------
  const groupBody = (id) => {
    switch (id) {
      case 'source': return (
        <div>
          <div className="source-tabs" role="tablist">
            <button className={'src-tab ' + (sourceKind === 'sample' ? 'on' : '')} onClick={useSample}>
              <span>▦</span><span>Sample</span>
            </button>
            <button className={'src-tab ' + (sourceKind === 'image' || sourceKind === 'video' ? 'on' : '')} onClick={() => fileInputRef.current.click()}>
              <span>↑</span><span>Add photo / video</span>
            </button>
          </div>
          <div className="source-meta">
            <span className="src-label">{sourceLabel}</span>
            <span>·</span><span>{meta.w}×{meta.h}</span>
            {playing ? <><span>·</span><span className="src-live">● {meta.fps} fps</span></> : <><span>·</span><span>static</span></>}
          </div>
          {videoErr ? <p className="mh-export-hint" style={{ color: 'var(--rec)' }}>{videoErr}</p> : null}
          {sourceKind === 'video' ? <p className="mh-export-hint">Your video plays muted on a loop. Use <b>Play / Pause</b> on the image, or <b>Record</b> in Export to capture it as WebM.</p> : null}
        </div>);
      case 'presets': return (
        <div className="preset-grid">
          {PRESETS.map((p) =>
            <button key={p.name} className="preset-card" onClick={() => applyPreset(p)}>
              <span className="preset-swatch" style={{ background: p.s.bg }}>
                <span className="preset-dot" style={{ background: p.s.ink || p.s.inkK || '#000' }} />
                {p.s.mode === 'cmyk' && <>
                  <span className="preset-dot preset-dot-2" style={{ background: p.s.inkC }} />
                  <span className="preset-dot preset-dot-3" style={{ background: p.s.inkM }} />
                </>}
              </span>
              <span className="preset-name">{p.name}</span>
            </button>)}
        </div>);
      case 'mode': return (
        <Segmented value={s.mode} onChange={(v) => set('mode', v)}
          options={[{ value: 'mono', label: 'Mono' }, { value: 'duotone', label: 'Duotone' }, { value: 'cmyk', label: 'CMYK' }, { value: 'bitmap', label: 'Bitmap' }]} />);
      case 'shape': return (
        s.mode === 'bitmap' ?
        <div className="shape-grid">
          {[['bayer4', 'order'], ['bayer8', 'fine'], ['floyd', 'floyd'], ['atkinson', 'atkin'], ['noise', 'noise']].map(([k, lbl]) =>
            <button key={k} className={'shape-btn ' + (s.dither === k ? 'on' : '')} onClick={() => set('dither', k)}>
              <DitherIcon kind={k} /><span>{lbl}</span>
            </button>)}
        </div> :
        <div className="shape-grid">
          {['circle', 'square', 'diamond', 'line', 'cross'].map((k) =>
            <button key={k} className={'shape-btn ' + (s.shape === k ? 'on' : '')} onClick={() => set('shape', k)}>
              <ShapeIcon kind={k} /><span>{k}</span>
            </button>)}
        </div>);
      case 'geometry': return (
        <div>
          <Slider label={s.mode === 'bitmap' ? 'Pixel size' : 'Cell size'} value={s.cell} min={s.mode === 'bitmap' ? 2 : 3} max={36} step={1} onChange={(v) => set('cell', v)} format={(v) => v + ' px'} />
          {s.mode !== 'cmyk' && s.mode !== 'bitmap' && <Slider label="Angle" value={s.angle} min={0} max={90} step={1} onChange={(v) => set('angle', v)} format={(v) => v + '°'} />}
          {s.mode !== 'bitmap' && <Slider label="Jitter" value={s.jitter} min={0} max={1} step={0.01} onChange={(v) => set('jitter', v)} format={(v) => v.toFixed(2)} />}
        </div>);
      case 'tone': return (
        <div>
          <Slider label="Brightness" value={s.brightness} min={-0.5} max={0.5} step={0.01} onChange={(v) => set('brightness', v)} format={(v) => (v >= 0 ? '+' : '') + v.toFixed(2)} />
          <Slider label="Contrast" value={s.contrast} min={0.4} max={2.5} step={0.01} onChange={(v) => set('contrast', v)} format={(v) => v.toFixed(2) + '×'} />
          {s.mode !== 'cmyk' &&
            <label className="check">
              <input type="checkbox" checked={s.invert} onChange={(e) => set('invert', e.target.checked)} />
              <span>Invert (light ink on dark bg)</span>
            </label>}
        </div>);
      case 'ink': return (
        <div>
          <Swatch label="Background" value={s.bg} onChange={(v) => set('bg', v)} />
          {s.mode !== 'cmyk' && <Swatch label="Ink" value={s.ink} onChange={(v) => set('ink', v)} />}
          {s.mode === 'cmyk' &&
            <div className="cmyk-grid">
              <Swatch label="C" value={s.inkC} onChange={(v) => set('inkC', v)} />
              <Swatch label="M" value={s.inkM} onChange={(v) => set('inkM', v)} />
              <Swatch label="Y" value={s.inkY} onChange={(v) => set('inkY', v)} />
              <Swatch label="K" value={s.inkK} onChange={(v) => set('inkK', v)} />
            </div>}
        </div>);
      case 'output': return (
        <Slider label="Scale" value={s.outputScale} min={0.4} max={1.8} step={0.05} onChange={(v) => set('outputScale', v)} format={(v) => v.toFixed(2) + '×'} />);
      case 'export': return (
        <div>
          <div className="action-grid">
            <button className="btn btn-primary" onClick={downloadPNG}>Export PNG</button>
            <button className="btn btn-accent" onClick={downloadSVG}>Export SVG</button>
            <button className={'btn ' + (recording ? 'btn-record on' : 'btn-record')} onClick={recording ? stopRecord : startRecord}>
              <span className="rec-dot" aria-hidden="true" />
              <span>{recording ? `Stop · ${recordTime.toFixed(1)}s` : 'Record'}</span>
            </button>
            <button className="btn btn-ghost" onClick={() => setS(DEFAULTS)}>Reset</button>
          </div>
          {pendingVideo ?
            <button className="btn btn-primary" style={{ width: '100%', marginTop: '9px' }}
              onClick={() => { setExportStatus({ kind: 'WebM', status: 'working' }); saveOrShare(pendingVideo, reportExport('WebM')); }}>
              Save video ({(pendingVideo.size / 1048576).toFixed(1)} MB)
            </button> : null}
          <p className="mh-export-hint">
            On a phone, tap <b>Export PNG</b> → choose <b>“Save Image”</b> in the share sheet to add it to Photos.
          </p>
          {exportStatus ? <ExportStatus s={exportStatus} /> : null}
        </div>);
      default: return null;
    }
  };

  const GROUPS = [
    { id: 'source', label: 'Source' },
    { id: 'presets', label: 'Presets' },
    { id: 'mode', label: 'Mode' },
    { id: 'shape', label: 'Shape' },
    { id: 'geometry', label: 'Geometry' },
    { id: 'tone', label: 'Tone' },
    { id: 'ink', label: 'Ink' },
    { id: 'output', label: 'Output' },
    { id: 'export', label: 'Export' }
  ];
  const labelFor = (id) => (GROUPS.find((g) => g.id === id) || {}).label || '';

  // ---------- shared pieces ----------
  const brandMark = (
    <span className="mh-brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="18" height="18">
        <circle cx="6" cy="6" r="1.2" fill="currentColor" /><circle cx="16" cy="6" r="2.4" fill="currentColor" /><circle cx="26" cy="6" r="3.4" fill="currentColor" />
        <circle cx="6" cy="16" r="2.4" fill="currentColor" /><circle cx="16" cy="16" r="3.4" fill="currentColor" /><circle cx="26" cy="16" r="4.2" fill="currentColor" />
        <circle cx="6" cy="26" r="3.4" fill="currentColor" /><circle cx="16" cy="26" r="4.2" fill="currentColor" /><circle cx="26" cy="26" r="5" fill="currentColor" />
      </svg>
    </span>);

  const renderStage = (metaInside) => (
    <div className="mh-stage">
      <div className="mh-stage-pad">
        <canvas ref={outRef} className="mh-canvas" />
        <canvas ref={workingRef} style={{ display: 'none' }} />
      </div>
      {sourceKind === 'video' &&
        <div className="mh-vp">
          <button className="btn btn-ghost" style={{ padding: '7px 12px' }} onClick={togglePlay}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          <span className="mh-vp-label">video</span>
        </div>}
      {metaInside ? <div className="mh-stage-meta">{metaChip}</div> : null}
    </div>);

  const metaChip = (
    <span className="mh-meta">
      {meta.w}×{meta.h}{playing ? <span className="live"> · ● {meta.fps}fps</span> : ''}
    </span>);

  const fileInput = (
    <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={onPickFile} />);

  const aboutOverlay = (
    <div className={'mh-about ' + (aboutOpen ? 'open' : '')}>
      <div className="mh-about-head">
        <div className="mh-brand">{brandMark}<span className="mh-brand-name">A NOISE MAKER</span></div>
        <button className="mh-icon-btn" onClick={() => setAboutOpen(false)} aria-label="Close"><CatIcon id="close" /></button>
      </div>
      <div className="mh-about-body">
        <h2>A graphic texture tool, in your browser.</h2>
        <p>A Noise Maker lets you screen photos and video into halftone textures and export the result as a PNG, SVG, or recorded WebM. Have fun!</p>
        <p className="priv"><strong>Your images never leave your device.</strong> Every render happens locally — nothing is uploaded, no servers, no tracking, no account.</p>
        <div className="blk-title">Credits</div>
        <ul className="credits">
          <li><b>React &amp; React DOM</b><i>MIT</i></li>
          <li><b>Babel (standalone)</b><i>MIT</i></li>
          <li><b>Andada Pro typeface</b><i>OFL 1.1</i></li>
        </ul>
        <div className="blk-title">License</div>
        <p>Released under the permissive MIT License — free to use, copy, modify, and distribute, including commercially.</p>
      </div>
    </div>);

  // =================== LAYOUT A — Split Studio ===================
  if (layout === 'a') {
    return (
      <div className="mh-root mh-a">
        <header className="mh-topbar">
          <div className="mh-brand">{brandMark}<span className="mh-brand-name">A NOISE MAKER</span></div>
          <div className="mh-topbar-actions">
            <button className="mh-icon-btn" onClick={() => setAboutOpen(true)} aria-label="About"><CatIcon id="info" /></button>
          </div>
        </header>
        {renderStage(true)}
        <section className="mh-tray">
          <div className="mh-tabs" role="tablist">
            {GROUPS.map((g) =>
              <button key={g.id} className={'mh-chip ' + (tab === g.id ? 'on' : '')} onClick={() => setTab(g.id)}>
                <CatIcon id={g.id} /><span>{g.id === 'shape' && s.mode === 'bitmap' ? 'Dither' : g.label}</span>
              </button>)}
          </div>
          <div className="mh-body">{groupBody(tab)}</div>
        </section>
        {fileInput}
        {aboutOverlay}
      </div>);
  }

  // =================== LAYOUT B — Immersive Canvas ===================
  return (
    <div className={'mh-root mh-b ' + (sheet ? 'sheet-open' : '')}>
      {renderStage(false)}
      <header className="mh-topbar">
        <div className="mh-brand">{brandMark}<span className="mh-brand-name">A NOISE MAKER</span></div>
        <div className="mh-topbar-actions">
          <button className="mh-icon-btn" onClick={() => setAboutOpen(true)} aria-label="About"><CatIcon id="info" /></button>
        </div>
      </header>
      <div className="mh-stage-meta">{metaChip}</div>

      <nav className="mh-toolbar">
        {GROUPS.map((g) =>
          <button key={g.id} className={'mh-tool ' + (g.id === 'export' ? 'accent' : '')} onClick={() => setSheet(g.id)}>
            <CatIcon id={g.id} /><span>{g.id === 'shape' && s.mode === 'bitmap' ? 'Dither' : g.label}</span>
          </button>)}
      </nav>

      <section className="mh-sheet" aria-hidden={!sheet}>
        <div className="mh-sheet-head">
          <span className="mh-sheet-grip" />
          <span className="mh-sheet-title">{labelFor(sheet)}</span>
          <button className="mh-icon-btn" onClick={() => setSheet(null)} aria-label="Close"><CatIcon id="close" /></button>
        </div>
        <div className="mh-body">{sheet ? groupBody(sheet) : null}</div>
      </section>

      {fileInput}
      {aboutOverlay}
    </div>);
}

export default MobileHalftone;
