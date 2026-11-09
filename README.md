# Putrajaya.rblx Wiki — Official Launch Film

A 60-second cinematic motion-design film introducing the **official Putrajaya.rblx Wiki**.
Built as a single, dependency-free web experience: vanilla HTML, CSS and JavaScript, a custom
deterministic timeline engine, and a pixel-faithful CSS recreation of the wiki itself.

The film opens on the product, not the logo: a real Pagefind search, a real answer, then the
article, the map and every screen — ending on a clean launch card and CTA.

> **One wiki. Every screen.**

![Putrajaya.rblx Wiki launch graphic](https://raw.githubusercontent.com/Putrajayarblx/Putrajayarblx-Wiki/main/public/PutrajayaWikiLaunch.png)

**Live film:** [wiki-launch-animation.vercel.app](https://wiki-launch-animation.vercel.app)

[Watch the film](index.html) · [Read the wiki](https://putrajayarblx-wiki.vercel.app) · [Wiki repository](https://github.com/Putrajayarblx/Putrajayarblx-Wiki)

---

## The film

| # | Chapter | Time | What happens |
|---|---------|------|--------------|
| 01 | **Logo** | 0:00–0:02 | A clean brand resolve on a deep teal field with a brighter mint glow — no hero copy, navigation or floating cards behind it. The product is revealed at 0:02. |
| 02 | **Search** | 0:02–0:08 | The real wiki opens. Pagefind search types `city roles`, the matching article appears as the first result, and the result opens the article. |
| 03 | **Article** | 0:08–0:22 | The real *City roles and departments* article fills the frame at a readable scale. It scrolls to the Caution, the Appearance panel highlights **Dark**, and the page switches themes. |
| 04 | **Map** | 0:22–0:35 | The real 67-place interactive map on tablet. The map search types `bridge`; the two bridge pins stay prominent while the rest recede. The search clears and the full map returns. |
| 05 | **Mobile** | 0:35–0:47 | The complete phone frame shows the same article, scrolls to the Caution, then a touch opens the real menu drawer. The footer keeps **Auto** and **English** visible. |
| 06 | **Every screen** | 0:47–0:52 | A device-family hero — laptop, tablet and phone running the real interface — with the audience line: *For new citizens, department staff and longtime residents.* |
| 07 | **Visit** | 0:52–1:00 | A restrained brand close: **The official wiki**, **Now available**, the benefit line, the live URL and a high-contrast **Visit the wiki** CTA. |

The animation is **cut to an original 120 BPM score**: section changes and key UI hits land on the beat, with short drum fills leading into the map, mobile, device-family and launch cards. The reference video was used as a tempo and pacing guide only — no audio, branding or interface is copied.

The animation is designed for **1920 × 1080** and scales losslessly to any viewport.

---

## Watch it

### In the browser

Open `index.html` directly, or serve the folder with any static server:

```sh
npx serve .
# or
python -m http.server 8080
```

No install, build step or framework required.

### Player controls

| Control | Action |
|---|---|
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek 2 seconds |
| `Home` / `End` | Jump to start / end |
| `R` | Restart |
| `F` | Fullscreen |
| `M` | Toggle the soundtrack |
| `H` | Hide player chrome |
| `S` | Toggle the title-safe frame |
| Click / drag the timeline | Scrub anywhere |
| Chapter labels | Jump to a chapter |

The player auto-hides while playing and returns on mouse movement. The film starts automatically
unless the visitor prefers reduced motion, in which case it waits on the first frame.

**Sound** starts on the first click or tap anywhere in the player — browsers block audio before a
gesture. A **Tap for sound** prompt appears on load, and the player always has a visible
**Sound off / Sound on** control.

### Preview and capture modes

Useful for design review, thumbnails and frame-accurate captures:

```text
?t=17.8&paused=1&chrome=0
```

- `t` — start at a specific time in seconds
- `paused=1` — hold the frame
- `chrome=0` — hide the player UI and title-safe frame

`window.__film` exposes `seek(t)`, `play()`, `pause()` and the current time for automation.

---

## What is on screen

The wiki interface is **not a screenshot**. It is rebuilt in HTML/CSS from the live
[Starlight](https://starlight.astro.build) site and animated as a real interface:

- The real splash homepage: header, hero copy, gradient wordmark, official category artwork, badge row and search
- The real *City roles and departments* article: exact copy, Caution callout, sidebar, On this page, Appearance panel and page footer
- Pagefind-style search overlay with live typing and results
- Light and dark themes, switched through the real Appearance → Color control
- The real mobile splash, menu drawer, and article with Navigation / On this page bars, pagination and the Appearance pill
- The real tablet article layout, plus the interactive Putrajaya map page with search, category filters and place pins
- Real device chrome: laptop lid and base, phone frame with island, tablet bezel and glass reflections

No invented categories, stats, infoboxes or article sections were added to the wiki screens. If it is
not on the live site, it is not in the mockup.

The device-family shot at the end is generated by cloning the actual desktop, mobile and tablet
interfaces, stripping their animation state and scaling them into miniature devices. That means the
tiny screens are the same wiki, not mockups.

---

## Project structure

```text
.
├── index.html          Structure, icon sprite, player chrome, all three wiki UIs
├── styles.css          Stage, atmosphere, devices, effects, player, loader
├── ui.css              Desktop wiki interface and shared design tokens
├── ui-mobile.css       Phone interface
├── ui-tablet.css       Tablet interface
├── scenes.css          Act compositions, device family, story captions, outro
├── app.js              Timeline engine, 60-second score, player, audio
├── vercel.json         Static hosting config
├── .nojekyll           GitHub Pages support
└── README.md
```

### Timeline engine

`app.js` contains a small deterministic keyframe engine rather than a CSS-animation chain:

- Absolute-time tracks with per-segment easing (`expo`, `inOut`, `quint`, …)
- Transform, opacity, blur, filter and CSS custom-property interpolation
- Full scrubbing: every visual is a pure function of `t`
- Deliberate cuts, short crossfades and light wipes — key changes land on a 120 BPM beat grid
- Procedural grain and a synthesised soundtrack — a chord bed, kick, clap, hats, bass, arpeggio, whooshes, impacts and UI ticks, all synced to the timeline

This keeps the film reproducible for captures and allows the player to seek instantly.

---

## Fidelity and assets

Text, article copy, taxonomy and UI structure are drawn from the official
[Putrajaya.rblx Wiki repository](https://github.com/Putrajayarblx/Putrajayarblx-Wiki). The official
logo, favicon, category artwork and minimap are loaded from that repository at runtime via
`raw.githubusercontent.com`, so the film always uses the current brand assets.

The headline type is **Plus Jakarta Sans**; the interface uses **Public Sans** — matching the wiki's
typography. Both load from Google Fonts.

The map beat uses the live 67-place count and category totals from the wiki's map page. The
article footer shows the November 2026 update date. Update those values when the wiki grows.

---

## Deployment

**Live:** <https://wiki-launch-animation.vercel.app>

### Vercel

Import the repository as a static project. No framework preset, build command or output directory is
needed — Vercel serves the repository root, with `index.html` as the entry point. `vercel.json`
enables clean URLs.

```sh
vercel --prod
```

### Any static host

The repository root is fully static. It can be served directly by GitHub Pages, Netlify, Cloudflare
Pages or any object store. `.nojekyll` keeps the folder structure intact on GitHub Pages; no build
command or output directory is required.

---

## Accessibility notes

- All player controls are real buttons with accessible labels.
- Keyboard seeking, restart, fullscreen and mute are supported.
- `prefers-reduced-motion` disables autoplay and ambient floating animations.
- The film is a visual experience; the wiki itself is the accessible, semantic source of truth.

---

## Credits

- **Wiki**: Putrajaya.rblx community · developer-approved
- **Platform**: [Astro](https://astro.build) + [Starlight](https://starlight.astro.build), Pagefind
- **Type**: Plus Jakarta Sans, Public Sans
- **Film**: original motion design, direction and build for the Putrajaya.rblx Wiki launch

The wiki's content and marks belong to the Putrajaya.rblx community. The film code is provided for
the wiki's launch and promotional use.
