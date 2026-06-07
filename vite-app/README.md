# A Noise Maker

A browser-based **halftone texture tool**. Add an image or video, screen it into
halftone dots (mono, duotone, or CMYK), and export the result as a **PNG**, **SVG**,
or a recorded **WebM**. Everything runs locally in the browser — nothing is uploaded,
there are no servers, no tracking, and no accounts.

This folder is the production-ready version, built with [Vite](https://vitejs.dev/)
and React.

---

## Quick start (run it on your computer)

You need [Node.js](https://nodejs.org/) version 18 or newer installed. To check, run
`node --version` in a terminal.

```bash
# 1. Move into this folder
cd vite-app

# 2. Install dependencies (one time only)
npm install

# 3. Start the dev server
npm run dev
```

Vite prints a local address (usually `http://localhost:5173`). Open it in your
browser. **Edit any file in `src/` and the page updates instantly** — no manual
refresh, no waiting.

---

## Project structure

```
vite-app/
├── index.html              ← page shell; loads the font + mounts the app
├── package.json            ← dependencies and the dev/build/preview commands
├── vite.config.js          ← build configuration
├── src/
│   ├── main.jsx            ← entry point: mounts <App> into the page
│   ├── App.jsx            ← the entire UI (controls, presets, export)
│   ├── halftone-engine.js  ← the rendering math (pure functions, no React)
│   └── styles.css          ← all styling
└── README.md               ← this file
```

The **engine** (`halftone-engine.js`) is plain, dependency-free JavaScript — it does
the actual halftone screening and SVG export. The **UI** (`App.jsx`) is React and
handles controls, file loading, and exports. Keeping them separate means you can
add new effects in the engine without touching the interface, and vice versa.

---

## Adding features

- **A new control** (slider, toggle, color) → edit `src/App.jsx`. The reusable
  `Slider`, `Swatch`, `Segmented`, and `ShapeIcon` components are defined at the top.
- **A new halftone effect or export format** → edit `src/halftone-engine.js` and
  expose it from the `export { … }` line at the bottom.
- **A new dependency** (e.g. a GIF encoder) → `npm install <package>` then
  `import` it where you need it.

Save the file and the running dev server reflects the change immediately.

---

## Building for production

```bash
npm run build
```

This creates a `dist/` folder containing a fully optimized, minified site with no
build tools or CDN dependencies. That folder is what you deploy. To preview the
built site locally before deploying:

```bash
npm run preview
```

---

## Putting it on the internet (hosting)

Because the app is 100% client-side (no backend, no database), hosting is free or
nearly free on any static host. Two easy routes:

### Option A — drag-and-drop (no account setup, fastest)

1. Run `npm run build` to produce the `dist/` folder.
2. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)**.
3. Drag the **`dist`** folder onto the page.
4. Netlify gives you a live URL within seconds. Done.

(Cloudflare Pages and Vercel have the same drag-and-drop flow.)

### Option B — connect a Git repo (auto-deploys on every change, recommended)

This way, every time you push a change, the site rebuilds and redeploys itself.

1. Put this project in a **GitHub** repository (see the next section).
2. Sign up at **[netlify.com](https://www.netlify.com/)**, **[vercel.com](https://vercel.com/)**,
   or **[Cloudflare Pages](https://pages.cloudflare.com/)** (all have free tiers).
3. Click **"Add new site" → "Import from Git"** and pick your repo.
4. When asked for build settings, enter:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - (If the repo root is the parent folder, also set the **base directory** to `vite-app`.)
5. Click **Deploy**. You'll get a live URL, and every future `git push` auto-updates it.

### Custom domain

Once the site is live, every host above has a **"Custom domain"** setting where you
can point your own domain (e.g. `anoisemaker.com`) at it — follow their guided steps
to update your domain's DNS. HTTPS is provisioned automatically and free.

---

## Putting the code on GitHub (for Option B)

If you've never used Git: install [GitHub Desktop](https://desktop.github.com/), then
**File → Add Local Repository**, point it at this `vite-app` folder, and **Publish**.
Or from a terminal:

```bash
cd vite-app
git init
git add .
git commit -m "Initial commit"
# then create an empty repo on github.com and follow its "push existing repo" lines
```

The included `.gitignore` keeps `node_modules/` and `dist/` out of the repo — the
host rebuilds those itself.

---

## A note on browser support

Export to **WebM** uses the browser's `MediaRecorder`, which works in Chrome, Edge,
and Firefox. Safari support for WebM recording is limited; PNG and SVG export work
everywhere. This is a browser limitation, not a bug in the app.

---

## License

MIT — see [`LICENSE`](./LICENSE). Built with React, Vite, and the Andada Pro
typeface (OFL 1.1). The halftone method itself is long-established, unpatented
prepress technique in the public domain.
