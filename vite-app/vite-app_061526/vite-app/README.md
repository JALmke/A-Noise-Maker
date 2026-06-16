# A Noise Maker

A browser-based **halftone texture tool**. Add an image or video, screen it into
halftone dots (mono, duotone, or CMYK) or a 1-bit **bitmap dither** (ordered, Floyd–Steinberg,
Atkinson, noise), and export the result as a **PNG**, **SVG**,
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
│   ├── main.jsx            ← entry point: picks Desktop vs Mobile UI by device
│   ├── App.jsx             ← DESKTOP UI (controls, presets, export)
│   ├── MobileApp.jsx       ← MOBILE UI — "Split Studio": docked image + adaptive
│   │                         control tray, share-to-Photos export, video fix
│   ├── halftone-engine.js  ← the rendering math (pure functions, no React)
│   ├── styles.css          ← desktop styling
│   └── halftone-mobile.css ← mobile styling (scoped under .mh-root)
└── README.md               ← this file
```

The **engine** (`halftone-engine.js`) is plain, dependency-free JavaScript — it does
the actual halftone screening and SVG export, shared by both UIs.

There are **two interfaces**, chosen automatically at runtime by `main.jsx`:

- **Desktop** (`App.jsx`) — the side-panel layout, shown on computers.
- **Mobile** (`MobileApp.jsx`) — the "Split Studio" layout, shown on phones and
  touch devices: the image is docked on top, a control tray sits below and sizes
  itself to the active category, exports use the native **share sheet** so PNGs
  can be saved to the photo library, and video loads reliably on iOS.

The switch uses a media query — `(max-width: 768px), (pointer: coarse)` — so any
phone or tablet gets the mobile UI while desktops keep the desktop UI. Rotating or
resizing re-evaluates live. To change where the split happens, edit `MOBILE_QUERY`
at the top of `src/main.jsx`.

The **engine** and **UI** being separate means you can add new effects in the
engine without touching either interface, and vice versa.

---

## Adding features

- **A new control** (slider, toggle, color) → add it to **both** `src/App.jsx`
  (desktop) and `src/MobileApp.jsx` (mobile) so the two UIs stay in sync. Each file
  defines its own reusable `Slider`, `Swatch`, `Segmented`, and `ShapeIcon` helpers.
- **A new halftone effect or export format** → edit `src/halftone-engine.js` and
  expose it from the `export { … }` line at the bottom. Both UIs pick it up. (The
  **Bitmap** mode is a worked example: a dither stage in the engine plus a `Bitmap`
  option and dither picker added to both `App.jsx` and `MobileApp.jsx`.)
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

You can do this entirely **in the browser** — no command line or Git app required.

### In the browser (easiest)

1. **Unzip the download first** so you have a real `vite-app` folder with the files
   inside (the uploader needs the actual files, not the `.zip`).
2. Go to **[github.com/new](https://github.com/new)**, sign in, name the repo
   (e.g. `a-noise-maker`), and click **Create repository**.
3. On the new repo page, click **Add file → Upload files** (or the
   "uploading an existing file" link).
4. Open your unzipped `vite-app` folder, select **everything inside it**
   (including the `src` folder), and drag it onto the page. GitHub keeps the
   folder structure.
5. Scroll down and click **Commit changes**.

Two things to watch for:

- **Upload the _contents_ of `vite-app`, not the folder itself** — so `package.json`,
  `index.html`, and the `src/` folder end up at the top level of the repo. Hosts
  expect to find `package.json` at the root.
- **The `.gitignore` file may be hidden** by your operating system because its name
  starts with a dot. It isn't required for the upload to work. To include it anyway:
  on Mac press **Cmd+Shift+.** in Finder; on Windows enable "Hidden items" in File
  Explorer's View menu.

> The browser uploader is perfect for this first upload. For frequent edits later,
> [GitHub Desktop](https://desktop.github.com/) (also no command line) makes pushing
> changes smoother.

### With Git (if you prefer the command line)

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
