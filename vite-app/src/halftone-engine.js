// Halftone rendering engine. Pure functions over canvases.
// ES module: exports renderHalftone, renderHalftoneSVG, prepareSource.

// ---------- helpers ----------
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function rgbToLuma(r, g, b) {
    // Rec. 709
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Apply brightness + contrast to a luma value (0..1).
  function tone(v, brightness, contrast) {
    // contrast pivots around 0.5
    v = (v - 0.5) * contrast + 0.5 + brightness;
    return clamp(v, 0, 1);
  }

  // Sample mean of fn(r,g,b) over a small box around (sx,sy). Returns 0..1.
  function sampleChannel(srcData, sw, sh, sx, sy, radius, fn) {
    const x0 = clamp((sx - radius) | 0, 0, sw - 1);
    const x1 = clamp((sx + radius) | 0, 0, sw - 1);
    const y0 = clamp((sy - radius) | 0, 0, sh - 1);
    const y1 = clamp((sy + radius) | 0, 0, sh - 1);
    let sum = 0, count = 0;
    const d = srcData.data;
    const step = Math.max(1, ((x1 - x0) / 4) | 0);
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const i = (y * sw + x) * 4;
        sum += fn(d[i], d[i + 1], d[i + 2]);
        count++;
      }
    }
    return count ? (sum / count) / 255 : 0;
  }

  // ---------- shapes ----------
  // Draws a halftone "ink" mark at (x,y) with normalized "amount" 0..1 -> 0..cell.
  // ctx fillStyle should already be set.
  function drawMark(ctx, x, y, amount, cell, shape, jitter) {
    if (amount <= 0.002) return;
    const max = cell * 0.72; // a touch over half to allow overlap at amount=1
    let size = max * amount;
    if (jitter) {
      const j = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453);
      const r = (j - Math.floor(j) - 0.5) * jitter * cell * 0.25;
      x += r;
      y += r;
    }
    switch (shape) {
      case 'square': {
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
        break;
      }
      case 'diamond': {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'line': {
        // horizontal stripe whose thickness encodes amount
        const t = amount * cell * 0.95;
        ctx.fillRect(x - cell * 0.6, y - t / 2, cell * 1.2, t);
        break;
      }
      case 'cross': {
        const t = amount * cell * 0.55;
        const len = cell * 0.78;
        ctx.fillRect(x - len / 2, y - t / 2, len, t);
        ctx.fillRect(x - t / 2, y - len / 2, t, len);
        break;
      }
      case 'circle':
      default: {
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }

  // ---------- main render ----------
  // opts:
  //   mode: 'mono' | 'duotone' | 'cmyk'
  //   shape: 'circle' | 'square' | 'diamond' | 'line' | 'cross'
  //   cell: cell size in output pixels
  //   angle: degrees (mono / duotone)
  //   brightness, contrast: 0-centered / 1-centered
  //   invert: bool
  //   jitter: 0..1
  //   bg, ink: css colors (mono / duotone)
  //   inks: {c,m,y,k} css colors for cmyk
  function renderHalftone(srcCanvas, dstCanvas, opts) {
    const sw = srcCanvas.width, sh = srcCanvas.height;
    if (!sw || !sh) return;

    const dw = dstCanvas.width, dh = dstCanvas.height;
    const sctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const srcData = sctx.getImageData(0, 0, sw, sh);

    const dctx = dstCanvas.getContext('2d');
    dctx.save();
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = opts.bg || '#ffffff';
    dctx.fillRect(0, 0, dw, dh);
    dctx.restore();

    // Map output pixel (ox,oy) -> source pixel (sx,sy)
    const sxPerOx = sw / dw;
    const syPerOy = sh / dh;
    const cell = Math.max(2, opts.cell);
    const sampleRadius = Math.max(1, (cell * sxPerOx) * 0.5);

    if (opts.mode === 'cmyk') {
      // Traditional press angles
      const channels = [
        { color: opts.inks.c, angle: 15, fn: (r, g, b) => 255 - r },
        { color: opts.inks.m, angle: 75, fn: (r, g, b) => 255 - g },
        { color: opts.inks.y, angle: 0,  fn: (r, g, b) => 255 - b },
        { color: opts.inks.k, angle: 45, fn: (r, g, b) => 255 - Math.max(r, g, b) },
      ];
      dctx.globalCompositeOperation = 'multiply';
      for (const ch of channels) {
        renderGrid(dctx, srcData, sw, sh, dw, dh, sxPerOx, syPerOy, cell,
          ch.angle, sampleRadius, opts, ch.color, ch.fn);
      }
    } else {
      // mono / duotone: same algorithm; duotone just uses chosen ink/bg.
      const ink = opts.ink || '#000000';
      const fn = opts.invert
        ? (r, g, b) => rgbToLuma(r, g, b)
        : (r, g, b) => 255 - rgbToLuma(r, g, b);
      dctx.globalCompositeOperation = 'source-over';
      renderGrid(dctx, srcData, sw, sh, dw, dh, sxPerOx, syPerOy, cell,
        opts.angle, sampleRadius, opts, ink, fn);
    }
  }

  function renderGrid(dctx, srcData, sw, sh, dw, dh, sxPerOx, syPerOy, cell,
                      angleDeg, sampleRadius, opts, color, fn) {
    dctx.fillStyle = color;
    const a = angleDeg * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);

    // Rotate the grid: iterate in grid space (u,v) and map to canvas space.
    // Compute bounding box of canvas in grid coordinates so we cover everything.
    const corners = [
      [0, 0], [dw, 0], [0, dh], [dw, dh],
    ];
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (const [x, y] of corners) {
      const u =  ca * x + sa * y;
      const v = -sa * x + ca * y;
      if (u < uMin) uMin = u; if (u > uMax) uMax = u;
      if (v < vMin) vMin = v; if (v > vMax) vMax = v;
    }

    const brightness = opts.brightness;
    const contrast = opts.contrast;
    const shape = opts.shape;
    const jitter = opts.jitter || 0;

    // Snap to multiples of cell
    const uStart = Math.floor(uMin / cell) * cell;
    const vStart = Math.floor(vMin / cell) * cell;
    const half = cell / 2;

    for (let v = vStart; v <= vMax; v += cell) {
      for (let u = uStart; u <= uMax; u += cell) {
        // Cell center in grid space, then back to canvas space
        const uc = u + half;
        const vc = v + half;
        const x = ca * uc - sa * vc;
        const y = sa * uc + ca * vc;
        if (x < -cell || y < -cell || x > dw + cell || y > dh + cell) continue;

        const sx = x * sxPerOx;
        const sy = y * syPerOy;
        let amount = sampleChannel(srcData, sw, sh, sx, sy, sampleRadius, fn);
        amount = tone(amount, brightness, contrast);
        drawMark(dctx, x, y, amount, cell, shape, jitter);
      }
    }
  }

  // ---------- SVG export (mirrors canvas algorithm) ----------
  function escAttr(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function fmt(n) {
    // 2 decimals, strip trailing zeros
    return (Math.round(n * 100) / 100).toString();
  }

  function emitMarkSVG(x, y, amount, cell, shape, jitter) {
    if (amount <= 0.002) return '';
    const max = cell * 0.72;
    const size = max * amount;
    if (jitter) {
      const j = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const r = (j - Math.floor(j) - 0.5) * jitter * cell * 0.25;
      x += r; y += r;
    }
    switch (shape) {
      case 'square':
        return `<rect x="${fmt(x - size)}" y="${fmt(y - size)}" width="${fmt(size*2)}" height="${fmt(size*2)}"/>`;
      case 'diamond':
        return `<polygon points="${fmt(x)},${fmt(y-size)} ${fmt(x+size)},${fmt(y)} ${fmt(x)},${fmt(y+size)} ${fmt(x-size)},${fmt(y)}"/>`;
      case 'line': {
        const t = amount * cell * 0.95;
        return `<rect x="${fmt(x - cell*0.6)}" y="${fmt(y - t/2)}" width="${fmt(cell*1.2)}" height="${fmt(t)}"/>`;
      }
      case 'cross': {
        const t = amount * cell * 0.55;
        const len = cell * 0.78;
        return `<rect x="${fmt(x-len/2)}" y="${fmt(y-t/2)}" width="${fmt(len)}" height="${fmt(t)}"/>`
             + `<rect x="${fmt(x-t/2)}" y="${fmt(y-len/2)}" width="${fmt(t)}" height="${fmt(len)}"/>`;
      }
      case 'circle':
      default:
        return `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(size)}"/>`;
    }
  }

  function emitGridSVG(srcData, sw, sh, dw, dh, sxPerOx, syPerOy, cell,
                       angleDeg, sampleRadius, opts, fn) {
    const a = angleDeg * Math.PI / 180;
    const ca = Math.cos(a), sa = Math.sin(a);
    const corners = [[0,0],[dw,0],[0,dh],[dw,dh]];
    let uMin=Infinity,uMax=-Infinity,vMin=Infinity,vMax=-Infinity;
    for (const [x,y] of corners) {
      const u =  ca*x + sa*y;
      const v = -sa*x + ca*y;
      if (u<uMin)uMin=u; if (u>uMax)uMax=u;
      if (v<vMin)vMin=v; if (v>vMax)vMax=v;
    }
    const uStart = Math.floor(uMin/cell)*cell;
    const vStart = Math.floor(vMin/cell)*cell;
    const half = cell/2;
    const brightness = opts.brightness, contrast = opts.contrast;
    const shape = opts.shape, jitter = opts.jitter || 0;
    let out = '';
    for (let v=vStart; v<=vMax; v+=cell) {
      for (let u=uStart; u<=uMax; u+=cell) {
        const uc=u+half, vc=v+half;
        const x = ca*uc - sa*vc;
        const y = sa*uc + ca*vc;
        if (x<-cell||y<-cell||x>dw+cell||y>dh+cell) continue;
        const sx = x*sxPerOx, sy = y*syPerOy;
        let amount = sampleChannel(srcData, sw, sh, sx, sy, sampleRadius, fn);
        amount = tone(amount, brightness, contrast);
        out += emitMarkSVG(x, y, amount, cell, shape, jitter);
      }
    }
    return out;
  }

  function renderHalftoneSVG(srcCanvas, outW, outH, opts) {
    const sw = srcCanvas.width, sh = srcCanvas.height;
    if (!sw || !sh) return '';
    const ctx = srcCanvas.getContext('2d', { willReadFrequently: true });
    const srcData = ctx.getImageData(0, 0, sw, sh);
    const sxPerOx = sw / outW, syPerOy = sh / outH;
    const cell = Math.max(2, opts.cell);
    const sampleRadius = Math.max(1, (cell * sxPerOx) * 0.5);

    let body = `<rect width="${outW}" height="${outH}" fill="${escAttr(opts.bg || '#ffffff')}"/>`;

    if (opts.mode === 'cmyk') {
      const channels = [
        { color: opts.inks.c, angle: 15, fn: (r,g,b)=>255-r },
        { color: opts.inks.m, angle: 75, fn: (r,g,b)=>255-g },
        { color: opts.inks.y, angle: 0,  fn: (r,g,b)=>255-b },
        { color: opts.inks.k, angle: 45, fn: (r,g,b)=>255-Math.max(r,g,b) },
      ];
      for (const ch of channels) {
        body += `<g fill="${escAttr(ch.color)}" style="mix-blend-mode:multiply">`;
        body += emitGridSVG(srcData, sw, sh, outW, outH, sxPerOx, syPerOy, cell,
                            ch.angle, sampleRadius, opts, ch.fn);
        body += `</g>`;
      }
    } else {
      const ink = opts.ink || '#000000';
      const fn = opts.invert
        ? (r,g,b) => rgbToLuma(r,g,b)
        : (r,g,b) => 255 - rgbToLuma(r,g,b);
      body += `<g fill="${escAttr(ink)}">`;
      body += emitGridSVG(srcData, sw, sh, outW, outH, sxPerOx, syPerOy, cell,
                          opts.angle, sampleRadius, opts, fn);
      body += `</g>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>\n`
      + `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" `
      + `viewBox="0 0 ${outW} ${outH}" shape-rendering="geometricPrecision">${body}</svg>`;
  }

  // ---------- prepare source ----------
  function prepareSource(src, working, maxDim) {
    let sw, sh;
    if (src instanceof HTMLVideoElement) {
      sw = src.videoWidth;
      sh = src.videoHeight;
    } else if (src instanceof HTMLImageElement) {
      sw = src.naturalWidth;
      sh = src.naturalHeight;
    } else {
      sw = src.width;
      sh = src.height;
    }
    if (!sw || !sh) return null;

    const scale = Math.min(1, maxDim / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * scale));
    const h = Math.max(1, Math.round(sh * scale));
    if (working.width !== w) working.width = w;
    if (working.height !== h) working.height = h;
    const ctx = working.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(src, 0, 0, w, h);
    return { w, h };
  }

export { renderHalftone, renderHalftoneSVG, prepareSource };
