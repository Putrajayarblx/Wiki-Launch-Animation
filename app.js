/* ============================================================
   PUTRAJAYA.RBLX WIKI — LAUNCH FILM
   A deterministic timeline engine + 54 second cinematic score
   ============================================================ */
(() => {
  "use strict";

  const DURATION = 38;
  const SPEED = 1.3;
  const PLAYBACK = DURATION / SPEED;

  /* Compress the old atmospheric timeline between the informative beats.
     The hook is given a little more room; the article, map, mobile, family
     and outro lose only holds, not product detail. */
  const TIME_WARP = [
    [0, 4.0, 0, 3.05],
    [4.0, 13.0, 3.05, 16.5],
    [13.0, 20.0, 16.5, 27.0],
    [20.0, 28.0, 27.0, 37.35],
    [28.0, 32.0, 37.35, 43.15],
    [32.0, 38.0, 43.15, 54.0],
  ];
  function warpTime(t) {
    if (t <= 0) return 0;
    for (const [n0, n1, o0, o1] of TIME_WARP) {
      if (t <= n1) return o0 + ((t - n0) * (o1 - o0)) / (n1 - n0);
    }
    return 54;
  }
  function unwarpTime(t) {
    if (t <= 0) return 0;
    for (const [n0, n1, o0, o1] of TIME_WARP) {
      if (t <= o1) return n0 + ((t - o0) * (n1 - n0)) / (o1 - o0);
    }
    return 38;
  }
  const MASTER_LEVEL = 2.2;
  const PAUSED_LEVEL = 0.18;
  const SFX_BOOST = 1.25;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;

  /* ---------------- EASING ---------------- */
  const E = {
    linear: (p) => p,
    out: (p) => 1 - Math.pow(1 - p, 3),
    expo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    quint: (p) => 1 - Math.pow(1 - p, 5),
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    soft: (p) => 1 - Math.pow(1 - p, 2.2),
    circ: (p) => Math.sqrt(1 - Math.pow(p - 1, 2)),
    in: (p) => p * p * p,
  };

  /* ---------------- TRACK ---------------- */
  const TF_PROPS = ["x", "y", "z", "rotate", "rotateX", "rotateY", "rotateZ", "scale", "scaleX", "scaleY"];
  const CUSTOM_UNITS = {
    "--dark": "",
    "--scroll": "px",
    "--progress": "",
    "--wipe-x": "%",
    "--sweep-x": "%",
    "--a1-sweep-x": "%",
    "--screen-sweep-x": "px",
  };

  class Track {
    constructor(el, keys) {
      this.el = el;
      this.keys = keys
        .map((k) => ({ ...k }))
        .sort((a, b) => a.t - b.t);
      this.props = new Set();
      this.custom = new Set();
      this.hasTf = false;
      this.hasFilter = false;
      this.hasOpacity = false;
      for (const k of this.keys) {
        for (const p of Object.keys(k)) {
          if (p === "t" || p === "ease") continue;
          this.props.add(p);
          if (p.startsWith("--")) this.custom.add(p);
          if (TF_PROPS.includes(p)) this.hasTf = true;
          if (p === "blur" || p === "brightness" || p === "saturate") this.hasFilter = true;
          if (p === "opacity") this.hasOpacity = true;
        }
      }
      // resolve values so omitted properties hold their previous value
      const defaults = {};
      for (const p of this.props) {
        if (p.startsWith("--")) defaults[p] = 0;
        else if (p === "opacity" || p === "brightness" || p === "saturate") defaults[p] = 1;
        else if (p === "scale" || p === "scaleX" || p === "scaleY") defaults[p] = 1;
        else defaults[p] = 0;
      }
      let prev = { ...defaults };
      this.resolved = this.keys.map((k) => {
        const v = { ...prev };
        for (const p of this.props) if (k[p] !== undefined) v[p] = k[p];
        prev = v;
        return { t: k.t, ease: k.ease || "expo", v };
      });
      this.apply(0, true);
    }

    apply(time) {
      const ks = this.resolved;
      if (!ks.length) return;
      let a = ks[0];
      let b = ks[0];
      let p = 0;
      if (time >= ks[ks.length - 1].t) {
        a = b = ks[ks.length - 1];
      } else if (time > ks[0].t) {
        for (let i = 1; i < ks.length; i++) {
          if (time <= ks[i].t) {
            a = ks[i - 1];
            b = ks[i];
            const span = b.t - a.t || 0.0001;
            p = clamp((time - a.t) / span, 0, 1);
            break;
          }
        }
      }
      const ease = E[b.ease] || E.expo;
      const q = ease(p);
      const v = {};
      for (const prop of this.props) {
        const av = a.v[prop];
        const bv = b.v[prop];
        v[prop] = typeof av === "number" && typeof bv === "number" ? lerp(av, bv, q) : bv;
      }
      const st = this.el.style;
      if (this.hasOpacity) st.opacity = String(clamp(v.opacity, 0, 1));
      if (this.hasTf) {
        const sx = v.scaleX !== undefined ? v.scaleX : v.scale !== undefined ? v.scale : 1;
        const sy = v.scaleY !== undefined ? v.scaleY : v.scale !== undefined ? v.scale : 1;
        st.transform =
          `translate3d(${v.x || 0}px, ${v.y || 0}px, ${v.z || 0}px) ` +
          `rotateX(${v.rotateX || 0}deg) rotateY(${v.rotateY || 0}deg) rotateZ(${v.rotateZ !== undefined ? v.rotateZ : v.rotate || 0}deg) ` +
          `scale(${sx}, ${sy})`;
      }
      if (this.hasFilter) {
        const blur = v.blur || 0;
        const br = v.brightness === undefined ? 1 : v.brightness;
        const sat = v.saturate === undefined ? 1 : v.saturate;
        st.filter = `blur(${blur}px) brightness(${br}) saturate(${sat})`;
      }
      for (const prop of this.custom) {
        st.setProperty(prop, `${v[prop]}${CUSTOM_UNITS[prop] || ""}`);
      }
    }
  }

  const tracks = [];
  const track = (sel, keys) => {
    const els = typeof sel === "string" ? $$(sel) : sel instanceof Element ? [sel] : Array.from(sel);
    els.forEach((el) => tracks.push(new Track(el, keys)));
  };
  const applyTimeline = (t) => tracks.forEach((tr) => tr.apply(t));

  function stagger(sel, t0, step, o = {}) {
    const els = $$(sel);
    els.forEach((el, i) => {
      const s = t0 + i * step;
      const d = o.dur || 0.8;
      const from = { t: s, opacity: 0, y: o.y === undefined ? 22 : o.y };
      if (o.x !== undefined) from.x = o.x;
      if (o.scale !== undefined) from.scale = o.scale;
      if (o.blur) from.blur = o.blur;
      if (o.rotateZ !== undefined) from.rotateZ = o.rotateZ;
      if (o.rotateX !== undefined) from.rotateX = o.rotateX;
      const to = { t: s + d, opacity: 1, y: 0, x: 0, scale: 1, blur: 0, ease: o.ease || "expo" };
      if (o.rotateZ !== undefined) to.rotateZ = o.toRotateZ !== undefined ? o.toRotateZ : o.rotateZ;
      if (o.rotateX !== undefined) to.rotateX = 0;
      track(el, [from, to]);
    });
  }

  function fade(sel, keys) {
    track(sel, keys);
  }

  /* ============================================================
     ACT 1 — BRAND STING
     ============================================================ */
  track("#act1", [{ t: 0, opacity: 0 }]);
  track("#a1Lockup", [
    { t: 4.68, opacity: 0, y: 16, scale: 0.98 },
    { t: 5.16, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 6.08, opacity: 1, y: 0, scale: 1.006 },
    { t: 6.24, opacity: 0, y: -8, scale: 0.996, ease: "inOut" },
  ]);
  track(".a1-mark", [
    { t: 4.7, opacity: 0, y: 16, scale: 0.94 },
    { t: 5.2, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  const a1Lines = $$(".a1-word .mask > span");
  a1Lines.forEach((el, i) => {
    track(el, [
      { t: 4.82 + i * 0.09, y: 72 },
      { t: 5.34 + i * 0.09, y: 0, ease: "expo" },
    ]);
  });
  track("#a1Rule", [
    { t: 5.12, scaleX: 0, opacity: 0 },
    { t: 5.52, scaleX: 1, opacity: 1, ease: "inOut" },
  ]);
  track("#a1Kicker", [
    { t: 5.2, opacity: 0, y: 8 },
    { t: 5.62, opacity: 1, y: 0, ease: "expo" },
  ]);

  /* ============================================================
     ACT 2 — FIND INFORMATION
     Search → article → reading comfort
     ============================================================ */
  track("#act2", [
    { t: 0, opacity: 1 },
    { t: 16.5, opacity: 1 },
    { t: 16.58, opacity: 0, ease: "inOut" },
  ]);
  track("#a2World", [
    { t: 0, scale: 1, y: 0 },
    { t: 16.5, scale: 1.008, y: 0, ease: "linear" },
  ]);

  /* camera: close on the real UI */
  track("#a2DeviceStage", [
    { t: 0, x: -200, y: 150, scale: 1 },
    { t: 2.95, x: -200, y: 150, scale: 1 },
    { t: 3.35, x: -272, y: 120, scale: 1, ease: "inOut" },
    { t: 10.9, x: -272, y: 120, scale: 1 },
    { t: 11.35, x: -276, y: 120, scale: 1, ease: "inOut" },
    { t: 16.5, x: -280, y: 120, scale: 1, ease: "linear" },
  ]);
  track("#laptop", [
    { t: 0, opacity: 1, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 2.05 },
    { t: 2.95, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 2.08, ease: "inOut" },
    { t: 3.35, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.7, ease: "inOut" },
    { t: 10.9, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.7 },
    { t: 11.35, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.71, ease: "inOut" },
    { t: 16.5, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.73, ease: "linear" },
  ]);
  track(".laptop-base, .laptop-shadow", [{ t: 0, opacity: 0 }]);
  track("[data-d-boot], .screen--desktop [data-d-flash], .screen--desktop [data-d-sweep]", [{ t: 0, opacity: 0 }]);
  track("[data-d-cursor], [data-d-ripple]", [{ t: 0, opacity: 0 }]);

  /* home is already loaded under the search */
  track(".d-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".d-hero-title, .d-hero-tag, .d-hero-actions, .d-hero-badges, .d-hero-search", [{ t: 0, opacity: 1, y: 0 }]);
  const deskArtRot = [-7, 6, -4];
  $$(".d-art-card").forEach((el, i) => {
    track(el, [{ t: 0, opacity: 1, y: 0, rotateZ: deskArtRot[i] || 0 }]);
  });

  /* search payoff */
  track("[data-d-modal]", [
    { t: 0.08, opacity: 0 },
    { t: 0.34, opacity: 1, ease: "out" },
    { t: 2.9, opacity: 1 },
    { t: 3.08, opacity: 0, ease: "inOut" },
  ]);
  track("[data-d-panel]", [
    { t: 0.08, y: 16, scale: 0.975 },
    { t: 0.52, y: 0, scale: 1, ease: "expo" },
  ]);
  track("[data-d-result]", [
    { t: 0.85, opacity: 0.1, y: 8, scale: 1 },
    { t: 1.35, opacity: 0.32, y: 8, scale: 1 },
    { t: 1.78, opacity: 1, y: 0, scale: 1.012, ease: "expo" },
    { t: 2.12, opacity: 1, y: 0, scale: 1 },
    { t: 2.7, opacity: 1, y: 0, scale: 1 },
    { t: 3.04, opacity: 0, y: 0, scale: 1 },
  ]);
  track(".d-search-result--dim", [
    { t: 0.85, opacity: 0.04, y: 8 },
    { t: 1.35, opacity: 0.1, y: 8 },
    { t: 2.05, opacity: 0.85, y: 0, ease: "expo" },
    { t: 2.8, opacity: 0, y: 0 },
  ]);
  track(".d-search-foot", [
    { t: 1.9, opacity: 0 },
    { t: 2.25, opacity: 1, ease: "out" },
  ]);

  /* page change: search result → article */
  track(".d-page--home", [
    { t: 0, opacity: 1, x: 0, blur: 0, scale: 1 },
    { t: 3.02, opacity: 1, x: 0, blur: 0, scale: 1 },
    { t: 3.18, opacity: 0, x: -20, blur: 3, scale: 1.005, ease: "inOut" },
  ]);
  track(".d-page--article", [
    { t: 0, opacity: 0, x: 18, blur: 3, scale: 1.005 },
    { t: 3.02, opacity: 0, x: 18, blur: 3, scale: 1.005 },
    { t: 3.28, opacity: 1, x: 0, blur: 0, scale: 1, ease: "expo" },
  ]);

  /* article content is fully rendered, never clipped mid-change */
  track(".d-side", [{ t: 0, opacity: 1, x: 0 }]);
  track(".d-rail", [{ t: 0, opacity: 1, x: 0 }]);
  track(".d-toc", [{ t: 0, opacity: 1 }]);
  track(".d-progress", [
    { t: 3.0, opacity: 0 },
    { t: 3.3, opacity: 1 },
  ]);
  track("[data-d-progress]", [
    { t: 3.4, scaleX: 0 },
    { t: 14.4, scaleX: 0.84, ease: "inOut" },
  ]);
  track(".d-article-head", [{ t: 0, opacity: 1, y: 0 }]);
  $$(".d-article-body > *").forEach((el) => track(el, [{ t: 0, opacity: 1, y: 0 }]));

  track("[data-d-article-scroll]", [
    { t: 0, y: 0 },
    { t: 9.45, y: 0 },
    { t: 10.65, y: -340, ease: "inOut" },
    { t: 12.55, y: -340 },
    { t: 13.85, y: -500, ease: "inOut" },
    { t: 16.5, y: -500 },
  ]);

  /* reading comfort */
  track("#desktopUI", [
    { t: 0, "--dark": 0 },
    { t: 11.08, "--dark": 0 },
    { t: 11.72, "--dark": 1, ease: "inOut" },
  ]);
  track("[data-theme-ripple] span", [
    { t: 11.05, opacity: 0, scale: 0 },
    { t: 11.14, opacity: 0.24, scale: 0.3, ease: "out" },
    { t: 11.66, opacity: 0, scale: 10, ease: "inOut" },
  ]);

  /* ============================================================
     ACT 3 — MOBILE
     One answer, in your hand
     ============================================================ */
  track("#act3", [
    { t: 26.9, opacity: 0 },
    { t: 26.98, opacity: 1, ease: "out" },
    { t: 36.9, opacity: 1 },
    { t: 37.35, opacity: 0, ease: "inOut" },
  ]);
  track("#a3DeviceStage", [
    { t: 26.9, opacity: 0, y: 34, x: 18, scale: 0.985 },
    { t: 27.0, opacity: 1, y: 0, x: 0, scale: 1, ease: "out" },
    { t: 36.9, opacity: 1, y: 0, x: 0, scale: 1 },
    { t: 37.3, opacity: 0, y: -18, x: 0, scale: 1.008, ease: "inOut" },
  ]);
  track("#phone", [
    { t: 26.9, y: 50, rotateX: 0, rotateY: -8, rotateZ: 0, scale: 0.99 },
    { t: 27.6, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, ease: "expo" },
    { t: 36.9, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.008, ease: "linear" },
  ]);
  track("[data-p-boot], .screen--phone [data-p-flash]", [{ t: 0, opacity: 0 }]);
  track("[data-p-touch]", [{ t: 0, opacity: 0 }]);

  /* the article is already open — real reading, no empty app state */
  track(".p-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".p-page--home", [{ t: 0, opacity: 0, x: 0, blur: 0 }]);
  track(".p-page--article", [{ t: 0, opacity: 1, x: 0, blur: 0 }]);
  track(".p-mobilebars", [{ t: 0, opacity: 1 }]);
  track(".p-article-title", [{ t: 0, opacity: 1, y: 0 }]);
  $$(".p-article-scroll > *:not(.p-article-title)").forEach((el) => track(el, [{ t: 0, opacity: 1, y: 0 }]));
  track(".p-appearance-pill", [{ t: 0, opacity: 1, y: 0 }]);
  track("[data-p-article-scroll]", [
    { t: 0, y: 0 },
    { t: 29.75, y: 0 },
    { t: 31.15, y: -196, ease: "inOut" },
    { t: 36.9, y: -196 },
  ]);

  /* mobile navigation is a real interaction */
  track(".p-drawer-scrim", [
    { t: 31.9, opacity: 0 },
    { t: 32.2, opacity: 0.45, ease: "out" },
    { t: 33.75, opacity: 0.45 },
    { t: 34.15, opacity: 0, ease: "inOut" },
  ]);
  track(".p-drawer-panel", [
    { t: 31.9, x: -340 },
    { t: 32.42, x: 0, ease: "expo" },
    { t: 33.75, x: 0 },
    { t: 34.25, x: -340, ease: "inOut" },
  ]);
  track(".p-drawer-link, .p-drawer-search, .p-drawer-foot", [{ t: 0, opacity: 1, y: 0 }]);

  /* ============================================================
     ACT 4 — MAP + FAMILY
     Explore the city, then see it on every screen
     ============================================================ */
  track("#act4", [
    { t: 16.5, opacity: 0 },
    { t: 16.62, opacity: 1, ease: "out" },
    { t: 26.95, opacity: 1 },
    { t: 27.02, opacity: 0, ease: "inOut" },
    { t: 28.0, opacity: 0 },
    { t: 32.0, opacity: 0 },
    { t: 37.0, opacity: 0 },
    { t: 37.2, opacity: 1, ease: "out" },
    { t: 42.7, opacity: 1 },
    { t: 43.15, opacity: 0, ease: "inOut" },
  ]);
  track("#a4DeviceStage", [
    { t: 16.5, opacity: 0, y: 24, scale: 0.99 },
    { t: 16.64, opacity: 1, y: 0, scale: 1, ease: "out" },
    { t: 26.8, opacity: 1, y: 0, scale: 1.008, ease: "linear" },
    { t: 27.0, opacity: 0, y: -14, scale: 1.008, ease: "inOut" },
    { t: 37.3, opacity: 0 },
  ]);
  track("#tablet", [
    { t: 16.5, y: 20, rotateX: 0, rotateY: -6, rotateZ: 0, scale: 0.99 },
    { t: 17.2, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, ease: "expo" },
    { t: 26.8, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.008, ease: "linear" },
  ]);
  track("[data-t-boot], .screen--tablet [data-t-flash]", [{ t: 0, opacity: 0 }]);
  track(".t-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-page--article", [{ t: 0, opacity: 0 }]);
  track(".t-map-page", [
    { t: 16.5, opacity: 0, y: 0, scale: 1 },
    { t: 16.6, opacity: 1, y: 0, scale: 1, ease: "out" },
  ]);
  track(".t-map-scroll h1", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-map-desc", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-map-card", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-map-img", [
    { t: 16.6, scale: 1.02 },
    { t: 26.6, scale: 1.08, ease: "inOut" },
  ]);
  track(".t-map-filters span", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-map-pin", [{ t: 0, opacity: 1, y: 0, scale: 1 }]);
  track(".t-map-tools", [{ t: 0, opacity: 1, x: 0 }]);

  /* family — one wiki, every screen */
  track("#a4Family", [
    { t: 37.0, opacity: 0, y: 16 },
    { t: 37.4, opacity: 1, y: 0, ease: "out" },
    { t: 42.5, opacity: 1, y: 0, scale: 1 },
    { t: 43.0, opacity: 0, y: -16, scale: 1.015, ease: "inOut" },
  ]);
  const famLines = $$("#a4FamilyTitle .mask > span");
  famLines.forEach((el) =>
    track(el, [
      { t: 37.15, y: 64 },
      { t: 37.9, y: 0, ease: "expo" },
    ])
  );
  track("#a4FamilySub", [
    { t: 37.3, opacity: 0, y: 8 },
    { t: 37.95, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#miniLaptop", [
    { t: 37.1, opacity: 0, y: 60, scale: 0.97 },
    { t: 37.85, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 41.9, y: -6, scale: 1.01 },
  ]);
  track("#miniTablet", [
    { t: 37.2, opacity: 0, x: -120, y: 24, rotateZ: -10, scale: 0.96 },
    { t: 37.95, opacity: 1, x: 0, y: 0, rotateZ: -6, scale: 1, ease: "expo" },
    { t: 41.9, y: 5, rotateZ: -6, scale: 1 },
  ]);
  track("#miniPhone", [
    { t: 37.3, opacity: 0, x: 120, y: 30, rotateZ: 9, scale: 0.96 },
    { t: 38.05, opacity: 1, x: 0, y: 0, rotateZ: 5, scale: 1, ease: "expo" },
    { t: 41.9, y: -4, rotateZ: 5, scale: 1 },
  ]);

  /* ============================================================
     ACT 5 — VISIT
     ============================================================ */
  track("#act5", [
    { t: 43.0, opacity: 0 },
    { t: 43.3, opacity: 1, ease: "out" },
  ]);
  track("#a5Outro", [
    { t: 43.15, opacity: 0 },
    { t: 43.5, opacity: 1, ease: "out" },
  ]);
  track("#outroMark", [
    { t: 43.05, opacity: 0, y: 18, scale: 0.92 },
    { t: 43.55, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track("#outroEyebrow", [
    { t: 43.3, opacity: 0, y: 8 },
    { t: 43.6, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroTitle .mask > span", [
    { t: 43.15, y: 80 },
    { t: 43.8, y: 0, ease: "expo" },
  ]);
  track("#outroSub", [
    { t: 43.6, opacity: 0, y: 12 },
    { t: 44.05, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroUrl", [
    { t: 43.8, opacity: 0, y: 16, scale: 0.98 },
    { t: 44.35, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track("#outroNote", [
    { t: 44.15, opacity: 0, y: 8 },
    { t: 44.55, opacity: 1, y: 0, ease: "expo" },
  ]);

  /* ============================================================
     BACKGROUNDS
     ============================================================ */
  track(".bg--intro, .bg--features", [{ t: 0, opacity: 0 }]);
  track(".bg--bright", [
    { t: 0, opacity: 1 },
    { t: 16.9, opacity: 1 },
    { t: 17.55, opacity: 0 },
  ]);
  track(".bg--warm", [
    { t: 16.9, opacity: 0 },
    { t: 17.45, opacity: 1 },
    { t: 26.95, opacity: 1 },
    { t: 27.45, opacity: 0 },
    { t: 37.0, opacity: 0 },
    { t: 37.55, opacity: 1 },
    { t: 42.8, opacity: 1 },
    { t: 43.3, opacity: 0 },
  ]);
  track(".bg--night", [
    { t: 26.95, opacity: 0 },
    { t: 27.45, opacity: 1 },
    { t: 37.0, opacity: 1 },
    { t: 37.55, opacity: 0 },
  ]);
  track(".bg--outro", [
    { t: 43.0, opacity: 0 },
    { t: 43.55, opacity: 1 },
  ]);

  /* ============================================================
     TRANSITIONS
     ============================================================ */
  track("#wipe", [
    { t: 16.4, opacity: 0, "--wipe-x": -140 },
    { t: 16.62, opacity: 0.3, "--wipe-x": -60, ease: "out" },
    { t: 17.2, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 26.9, opacity: 0, "--wipe-x": -140 },
    { t: 27.12, opacity: 0.28, "--wipe-x": -60, ease: "out" },
    { t: 27.7, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 37.25, opacity: 0, "--wipe-x": -140 },
    { t: 37.47, opacity: 0.26, "--wipe-x": -60, ease: "out" },
    { t: 38.05, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 42.9, opacity: 0, "--wipe-x": -140 },
    { t: 43.12, opacity: 0.3, "--wipe-x": -60, ease: "out" },
    { t: 43.7, opacity: 0, "--wipe-x": 170, ease: "inOut" },
  ]);

  /* ============================================================
     PARTICLES
     ============================================================ */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261108);

  const particleSets = [];
  function buildParticles(container, count, opts) {
    if (!container) return [];
    const set = [];
    for (let i = 0; i < count; i++) {
      const el = document.createElement("i");
      const plus = rnd() > 0.38;
      el.className = "particle " + (plus ? "particle--plus" : "particle--dot");
      const size = plus ? 5 + rnd() * 8 : 2 + rnd() * 3;
      el.style.width = size + "px";
      el.style.height = size + "px";
      container.appendChild(el);
      set.push({
        el,
        x: opts.x[0] + rnd() * (opts.x[1] - opts.x[0]),
        y: opts.y[0] + rnd() * (opts.y[1] - opts.y[0]),
        speed: opts.speed[0] + rnd() * (opts.speed[1] - opts.speed[0]),
        amp: 8 + rnd() * 26,
        phase: rnd() * Math.PI * 2,
        rot: (rnd() - 0.5) * 30,
        op: (plus ? 0.25 : 0.4) + rnd() * 0.35,
        size,
        plus,
      });
    }
    particleSets.push({ set, env: opts.env });
    return set;
  }

  const envKeys = (t, keys) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [ta, va] = keys[i - 1];
        const [tb, vb] = keys[i];
        let p = (t - ta) / (tb - ta);
        p = p * p * (3 - 2 * p);
        return lerp(va, vb, p);
      }
    }
    return keys[keys.length - 1][1];
  };

  const globalEnv = [
    [0, 0.6], [6.8, 0.25], [8, 0.14], [23.2, 0.14], [24.1, 0.42], [33.2, 0.42],
    [34.2, 0.16], [42.8, 0.16], [43.6, 0.34], [47.2, 0.34], [48.0, 0.55], [54, 0.55],
  ];
  const a1Env = [[0, 0], [1.2, 0.7], [5.6, 0.7], [7.0, 0], [54, 0]];
  const outroEnv = [[0, 0], [47.5, 0], [48.4, 0.8], [54, 0.8]];

  /* Decorative particles are intentionally disabled in the launch-brief edit. */

  function drawParticles(t) {
    for (const { set, env } of particleSets) {
      const e = envKeys(t, env);
      for (const p of set) {
        let y = p.y - t * p.speed;
        if (p.el.closest("#particles")) {
          const span = 1200;
          y = ((y + 60) % span + span) % span - 60;
        }
        const x = p.x + Math.sin(t * 0.5 + p.phase) * p.amp;
        const tw = 0.72 + 0.28 * Math.sin(t * 1.3 + p.phase);
        p.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${t * p.rot + p.phase * 30}deg)`;
        p.el.style.opacity = String(e * p.op * tw);
      }
    }
  }

  /* ============================================================
     STATE / EXTRAS
     ============================================================ */
  const dUI = $("#desktopUI");
  const pUI = $("#phoneUI");
  const tUI = $("#tabletUI");
  const a4Family = $("#a4Family");
  const typeEl = $("[data-d-type]");
  const tocLinks = $$(".d-toc a");
  const appearanceAuto = $('[data-appearance="auto"]');
  const appearanceDark = $('[data-appearance="dark"]');
  const countEls = $$(".a5-stats strong[data-count]");
  const stage = $("#stage");
  const captionEl = $("#filmCaption");
  const captionKickerEl = $("#filmCaptionKicker");
  const captionTitleEl = $("#filmCaptionTitle");
  let lastTyped = null;
  let lastCaption = null;

  const captionCues = [
    { from: 0.32, to: 3.05, kicker: "Search the wiki", title: "Ask. Get the answer." },
    { from: 6.55, to: 9.35, kicker: "City roles and departments", title: "Every role, explained." },
    { from: 9.55, to: 12.45, kicker: "Appearance", title: "Read it your way." },
    { from: 12.55, to: 16.4, kicker: "Community maintained", title: "Kept current." },
    { from: 16.95, to: 23.8, kicker: "Interactive map", title: "The whole city, mapped.", side: "right" },
    { from: 27.25, to: 31.8, kicker: "On mobile", title: "The same answer, in your hand." },
    { from: 32.0, to: 34.45, kicker: "Navigation", title: "Everything within reach." },
  ];

  function setStates(t) {
    dUI.classList.toggle("is-article", t >= 3.02);
    pUI.classList.toggle("is-article", t >= 26.8);
    tUI.classList.toggle("is-map", t >= 16.5);
    if (a4Family) a4Family.classList.toggle("is-live", t >= 37.0);
    stage.classList.toggle("is-ended", t >= 53.75);
    let idx = 0;
    if (t >= 9.5) idx = 1;
    if (t >= 10.7) idx = 2;
    tocLinks.forEach((a, i) => a.classList.toggle("is-active", i === idx));
    const dark = t >= 11.08;
    if (appearanceAuto) appearanceAuto.classList.toggle("is-checked", !dark);
    if (appearanceDark) appearanceDark.classList.toggle("is-checked", dark);
  }

  function setCaption(t) {
    if (!captionEl) return;
    const cue = captionCues.find((c) => t >= c.from && t < c.to);
    const key = cue ? `${cue.kicker}|${cue.title}|${cue.side || "left"}` : "";
    if (key === lastCaption) return;
    lastCaption = key;
    if (!cue) {
      captionEl.classList.remove("is-visible");
      return;
    }
    captionKickerEl.textContent = cue.kicker;
    captionTitleEl.textContent = cue.title;
    captionEl.classList.toggle("film-caption--right", cue.side === "right");
    captionEl.classList.add("is-visible");
  }

  function extras(t) {
    const q = "city roles";
    let n = 0;
    if (t >= 0.55) n = Math.min(q.length, Math.floor((t - 0.55) * 10.5) + 1);
    const typed = q.slice(0, n);
    if (typed !== lastTyped) {
      typeEl.textContent = typed;
      lastTyped = typed;
    }
    countEls.forEach((el, i) => {
      const target = Number(el.dataset.count || 0);
      const p = clamp((t - 44.05 - i * 0.12) / 0.85, 0, 1);
      const val = Math.round(target * E.expo(p));
      const str = String(clamp(val, 0, target)).padStart(2, "0");
      if (el.textContent !== str) el.textContent = str;
    });
  }

  function render(t) {
    const ot = warpTime(t);
    applyTimeline(ot);
    setStates(ot);
    extras(ot);
    setCaption(ot);
    drawParticles(ot);
    updatePlayerUI(t);
  }

  /* ============================================================
     PLAYER
     ============================================================ */
  const state = { t: 0, playing: false, last: 0, scrubbing: false };
  let raf = 0;
  let idleTimer = 0;

  const playBtn = $("#playBtn");
  const timeNow = $("#timeNow");
  const timeTotal = $("#timeTotal");
  const scrub = $("#scrub");
  const scrubWrap = $("#scrubWrap");
  const scrubFill = $("#scrubFill");
  const scrubThumb = $("#scrubThumb");
  const scrubTip = $("#scrubTip");
  const chapterName = $("#chapterName");
  const chapterTicks = $("#chapterTicks");
  const chaptersEl = $("#chapters");

  const chapters = [
    { t: 0, label: "Search" },
    { t: 4, label: "Article" },
    { t: 13, label: "Map" },
    { t: 20, label: "Mobile" },
    { t: 28, label: "Every screen" },
    { t: 32, label: "Visit" },
  ];

  const fmt = (s) => {
    s = clamp(s, 0, DURATION);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  chapters.forEach((c, i) => {
    const tick = document.createElement("span");
    tick.className = "chapter-tick";
    tick.style.left = (c.t / DURATION) * 100 + "%";
    chapterTicks.appendChild(tick);
    const b = document.createElement("button");
    b.className = "chapter-link";
    b.innerHTML = `<span>0${i + 1}</span>${c.label}`;
    b.addEventListener("click", () => {
      seek(c.t + 0.01);
      play();
    });
    chaptersEl.appendChild(b);
  });

  let lastChapter = -1;
  let lastSecond = -1;
  function updatePlayerUI(t) {
    const p = clamp(t / DURATION, 0, 1);
    scrubFill.style.width = p * 100 + "%";
    scrubThumb.style.left = p * 100 + "%";
    const sec = Math.floor(t / SPEED);
    if (sec !== lastSecond) {
      timeNow.textContent = fmt(t / SPEED);
      lastSecond = sec;
    }
    let ci = 0;
    for (let i = 0; i < chapters.length; i++) if (t >= chapters[i].t) ci = i;
    if (ci !== lastChapter) {
      chapterName.textContent = chapters[ci].label;
      $$(".chapter-link", chaptersEl).forEach((b, i) => b.classList.toggle("is-active", i === ci));
      stage.dataset.chapter = String(ci);
      lastChapter = ci;
    }
  }

  function seek(t) {
    state.t = clamp(t, 0, DURATION);
    if (state.t < DURATION - 0.02) stage.classList.remove("is-ended");
    render(state.t);
    if (audioOn) resetAudioPosition(state.t);
  }

  function tick(now) {
    if (!state.playing) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    const prev = state.t;
    state.t += dt * SPEED;
    if (state.t >= DURATION) {
      state.t = DURATION;
      render(state.t);
      audioFrame(prev, state.t);
      stage.classList.add("is-ended");
      pause();
      return;
    }
    render(state.t);
    audioFrame(prev, state.t);
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (state.playing) return;
    if (state.t >= DURATION - 0.05) state.t = 0;
    stage.classList.remove("is-ended");
    state.playing = true;
    state.last = performance.now();
    document.body.classList.add("is-playing");
    document.body.classList.remove("idle");
    playBtn.setAttribute("aria-label", "Pause");
    if (audioOn) audioLevel(MASTER_LEVEL, 0.4);
    raf = requestAnimationFrame(tick);
    scheduleIdle();
  }

  function pause() {
    state.playing = false;
    cancelAnimationFrame(raf);
    document.body.classList.remove("is-playing", "idle");
    playBtn.setAttribute("aria-label", "Play");
    if (audioOn) audioLevel(PAUSED_LEVEL, 0.3);
    clearTimeout(idleTimer);
  }

  function toggle() {
    if (state.playing) pause();
    else play();
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    document.body.classList.remove("idle");
    idleTimer = setTimeout(() => {
      if (state.playing) document.body.classList.add("idle");
    }, 2600);
  }

  playBtn.addEventListener("click", toggle);
  scrubWrap.addEventListener("pointerdown", (e) => {
    state.scrubbing = true;
    document.body.classList.add("is-scrubbing");
    scrubWrap.setPointerCapture(e.pointerId);
    seekFromEvent(e);
  });
  scrubWrap.addEventListener("pointermove", (e) => {
    const r = scrubWrap.getBoundingClientRect();
    const p = clamp((e.clientX - r.left) / r.width, 0, 1);
    scrubTip.textContent = fmt(p * PLAYBACK);
    scrubTip.style.left = `${p * 100}%`;
    if (state.scrubbing) seekFromEvent(e);
  });
  const endScrub = (e) => {
    if (!state.scrubbing) return;
    state.scrubbing = false;
    document.body.classList.remove("is-scrubbing");
    try { scrubWrap.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  scrubWrap.addEventListener("pointerup", endScrub);
  scrubWrap.addEventListener("pointercancel", endScrub);
  function seekFromEvent(e) {
    const r = scrubWrap.getBoundingClientRect();
    const p = clamp((e.clientX - r.left) / r.width, 0, 1);
    seek(p * DURATION);
  }

  document.addEventListener("mousemove", () => {
    if (state.playing) scheduleIdle();
  });
  document.addEventListener("touchstart", () => {
    if (state.playing) scheduleIdle();
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (!audioOn && !audioMuted && k !== "m") enableAudio();
    if (k === " " || k === "k") { e.preventDefault(); toggle(); }
    else if (k === "arrowright") { e.preventDefault(); seek(state.t + 2); }
    else if (k === "arrowleft") { e.preventDefault(); seek(state.t - 2); }
    else if (k === "home") { seek(0); }
    else if (k === "end") { seek(DURATION); }
    else if (k === "r") { seek(0); play(); }
    else if (k === "f") { toggleFullscreen(); }
    else if (k === "h") { document.body.classList.toggle("hide-chrome"); }
    else if (k === "s") { document.body.classList.toggle("show-safe"); }
    else if (k === "m") { toggleSound(); }
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }
  $("#fullBtn").addEventListener("click", toggleFullscreen);
  $("#replayHint").addEventListener("click", () => { seek(0); play(); });
  $("#soundBtn").addEventListener("click", toggleSound);

  /* ---------------- RESPONSIVE STAGE ---------------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.documentElement.style.setProperty("--stage-scale", String(s));
  }
  window.addEventListener("resize", fit);
  fit();

  /* ---------------- SOUNDTRACK & SOUND DESIGN ---------------- */
  let audio = null;
  let audioOn = false;
  let audioMuted = false;
  let audioChapter = -1;
  let lastTypeTick = -1;
  let lastPulse = -1;
  let lastArp = -1;

  const CHORDS = [
    [130.81, 196, 261.63, 329.63],
    [98, 146.83, 196, 293.66],
    [110, 164.81, 220, 329.63],
    [87.31, 130.81, 174.61, 220],
    [98, 146.83, 196, 293.66],
    [130.81, 196, 261.63, 392],
  ];

  function makeNoise(ctx, seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeImpulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  function ensureAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    const master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);
    master.connect(limiter);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 2.8;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const shelf = ctx.createBiquadFilter();
    shelf.type = "highshelf";
    shelf.frequency.value = 2600;
    shelf.gain.value = 2.5;
    comp.connect(shelf);
    shelf.connect(master);
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(comp);
    const convolver = ctx.createConvolver();
    convolver.buffer = makeImpulse(ctx, 2.4, 2.2);
    const wet = ctx.createGain();
    wet.gain.value = 0.28;
    convolver.connect(wet);
    wet.connect(comp);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.45;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.18;
    filter.connect(padGain);
    padGain.connect(bus);
    const padSend = ctx.createGain();
    padSend.gain.value = 0.35;
    padGain.connect(padSend);
    padSend.connect(convolver);

    const notes = CHORDS[0];
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = [0.55, 0.2, 0.13, 0.08][i];
      o.connect(g);
      g.connect(filter);
      o.start();
      return o;
    });
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 230;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const noise = makeNoise(ctx, 2.5);
    const air = ctx.createBufferSource();
    air.buffer = noise;
    air.loop = true;
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = "bandpass";
    airFilter.frequency.value = 1100;
    airFilter.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.007;
    air.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(bus);
    air.start();

    audio = { ctx, master, bus, filter, padGain, oscs, noise, convolver };
    return audio;
  }

  const chapterAt = (t) => {
    let ci = 0;
    for (let i = 0; i < chapters.length; i++) if (t >= chapters[i].t) ci = i;
    return ci;
  };

  function setChord(ci, immediate) {
    if (!audio) return;
    const chord = CHORDS[clamp(ci, 0, CHORDS.length - 1)];
    const now = audio.ctx.currentTime;
    audio.oscs.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], now, immediate ? 0.01 : 0.5));
  }

  function resetAudioPosition(t) {
    lastTypeTick = Math.floor(t * 9);
    lastPulse = Math.floor((t - 5.5) / 1.5);
    lastArp = Math.floor((t - 5.5) / 1.8);
  }

  function updateSoundUI() {
    const btn = $("#soundBtn");
    if (!btn) return;
    const use = btn.querySelector("use");
    const label = $("#soundLabel");
    if (use) use.setAttribute("href", audioOn ? "#i-volume" : "#i-volume-off");
    if (label) label.textContent = audioOn ? "Sound on" : "Sound off";
    btn.setAttribute("aria-label", audioOn ? "Mute sound" : "Enable sound");
    btn.setAttribute("aria-pressed", String(audioOn));
    document.body.classList.toggle("sound-on", audioOn);
    if (audioOn) {
      document.body.classList.add("sound-dismissed");
      const hint = $("#soundHint");
      if (hint) hint.remove();
    }
  }

  function enableAudio() {
    const a = ensureAudio();
    if (!a) return;
    audioMuted = false;
    if (a.ctx.state === "suspended") a.ctx.resume();
    audioOn = true;
    audioLevel(state.playing ? MASTER_LEVEL : PAUSED_LEVEL, 0.5);
    audioChapter = chapterAt(state.t);
    setChord(audioChapter, true);
    resetAudioPosition(state.t);
    updateSoundUI();
  }

  function audioLevel(value, tc) {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(value, now, tc || 0.35);
  }

  function disableAudio() {
    if (audio) audioLevel(0, 0.35);
    audioOn = false;
    updateSoundUI();
  }

  function toggleSound() {
    if (audioOn) {
      audioMuted = true;
      disableAudio();
    } else {
      enableAudio();
    }
  }

  const envGain = (peak, attack, dur) => {
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  };

  function sendTo(node, wet) {
    node.connect(audio.bus);
    if (wet > 0) {
      const s = audio.ctx.createGain();
      s.gain.value = wet;
      node.connect(s);
      s.connect(audio.convolver);
    }
  }

  function sfxWhoosh(dur = 0.9, vol = 0.12, from = 220, to = 2600) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = envGain(vol * SFX_BOOST, 0.08, dur);
    src.connect(bp);
    bp.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(-0.65, t);
      p.pan.linearRampToValueAtTime(0.65, t + dur);
      g.connect(p);
      sendTo(p, 0.3);
    } else {
      sendTo(g, 0.3);
    }
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  function sfxBoom(vol = 0.22) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(92, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.7);
    const g = envGain(vol * SFX_BOOST, 0.012, 1.1);
    o.connect(g);
    sendTo(g, 0.35);
    o.start(t);
    o.stop(t + 1.2);
    const n = ctx.createBufferSource();
    n.buffer = audio.noise;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 180;
    const ng = envGain(vol * 0.5 * SFX_BOOST, 0.005, 0.45);
    n.connect(lp);
    lp.connect(ng);
    sendTo(ng, 0.2);
    n.start(t);
    n.stop(t + 0.5);
  }

  function sfxClick(vol = 0.05) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.05);
    const g = envGain(vol * SFX_BOOST, 0.003, 0.07);
    o.connect(g);
    sendTo(g, 0.12);
    o.start(t);
    o.stop(t + 0.09);
  }

  function sfxChime(freq = 523.25, vol = 0.05) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    [1, 2.01].forEach((mult, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq * mult;
      const g = envGain(vol * (i ? 0.32 : 1) * SFX_BOOST, 0.01, 1.8);
      o.connect(g);
      sendTo(g, 0.45);
      o.start(t);
      o.stop(t + 1.9);
    });
  }

  function sfxPulse() {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(62, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
    const g = envGain(0.06, 0.01, 0.4);
    o.connect(g);
    sendTo(g, 0.15);
    o.start(t);
    o.stop(t + 0.45);
  }

  function sfxTick() {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = 2400;
    const g = envGain(0.016, 0.002, 0.035);
    o.connect(g);
    sendTo(g, 0.04);
    o.start(t);
    o.stop(t + 0.05);
  }

  function sfxPluck(freq) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = envGain(0.022, 0.006, 0.38);
    o.connect(lp);
    lp.connect(g);
    sendTo(g, 0.35);
    o.start(t);
    o.stop(t + 0.42);
  }

  const AUDIO_CUES = [
    { t: 0.34, fn: () => sfxClick(0.035) },
    { t: 1.95, fn: () => sfxChime(523.25, 0.04) },
    { t: 3.12, fn: () => sfxWhoosh(0.6, 0.055, 300, 1500) },
    { t: 9.5, fn: () => sfxWhoosh(0.7, 0.05, 220, 1200) },
    { t: 11.08, fn: () => sfxClick(0.06) },
    { t: 11.32, fn: () => sfxChime(659.25, 0.03) },
    { t: 16.6, fn: () => sfxWhoosh(0.9, 0.12, 160, 2400) },
    { t: 16.95, fn: () => sfxBoom(0.08) },
    { t: 27.0, fn: () => sfxWhoosh(0.9, 0.11, 180, 2400) },
    { t: 32.0, fn: () => sfxClick(0.045) },
    { t: 34.2, fn: () => sfxClick(0.035) },
    { t: 37.45, fn: () => sfxWhoosh(0.7, 0.07, 240, 1800) },
    { t: 37.85, fn: () => sfxBoom(0.07) },
    { t: 43.05, fn: () => sfxWhoosh(1.0, 0.13, 180, 3000) },
    { t: 43.8, fn: () => sfxBoom(0.13) },
    { t: 44.7, fn: () => sfxChime(523.25, 0.05) },
    { t: 47.8, fn: () => sfxChime(659.25, 0.04) },
  ];

  function audioFrame(prev, next) {
    if (!audioOn || !audio || next < prev) return;
    const ci = chapterAt(next);
    if (ci !== audioChapter) {
      audioChapter = ci;
      setChord(ci);
    }
    for (const cue of AUDIO_CUES) {
      const ct = unwarpTime(cue.t);
      if (prev < ct && next >= ct) cue.fn();
    }
    if (next >= 5.5 && next < 35.5) {
      const beat = Math.floor((next - 5.5) / 1.5);
      if (beat !== lastPulse) {
        lastPulse = beat;
        sfxPulse();
      }
      const arp = Math.floor((next - 5.5) / 1.8);
      if (arp !== lastArp) {
        lastArp = arp;
        const chord = CHORDS[clamp(ci, 0, CHORDS.length - 1)];
        const pattern = [1, 2, 3, 2, 1, 3];
        sfxPluck(chord[pattern[arp % pattern.length]] * 2);
      }
    }
    if (next >= 0.45 && next <= 2.2) {
      const k = Math.floor(next * 9);
      if (k !== lastTypeTick) {
        lastTypeTick = k;
        sfxTick();
      }
    }
  }

  function autoEnableAudio(e) {
    if (audioOn || audioMuted) return;
    if (e && e.target && e.target.closest && (e.target.closest("#soundBtn") || e.target.closest("#soundHint"))) return;
    enableAudio();
  }
  document.addEventListener("pointerdown", autoEnableAudio, { passive: true });
  const soundHintEl = $("#soundHint");
  if (soundHintEl) soundHintEl.addEventListener("click", (e) => { e.stopPropagation(); enableAudio(); });
  setTimeout(() => {
    const hint = $("#soundHint");
    if (hint && !audioOn) hint.classList.add("is-quiet");
  }, 11000);

  /* ---------------- MINI DEVICE SCREENS ----------------
     Built from the real interfaces, stripped of animation state.
     Cloned after the timeline exists so selectors stay scoped. */
  function cloneMini(source, host, opts = {}) {
    const src = $(source);
    const target = $(host);
    if (!src || !target) return;
    const clone = src.cloneNode(true);
    clone.removeAttribute("id");
    clone.removeAttribute("style");
    clone.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
    clone
      .querySelectorAll(".d-search-modal,.cursor,.cursor-ripple,.d-progress,.d-toc,.screen-flash,.screen-sweep,.screen-boot,.p-drawer")
      .forEach((n) => n.remove());
    if (opts.dark) clone.style.setProperty("--dark", "1");
    if (opts.view === "map") {
      const map = clone.querySelector(".t-map-page");
      if (map) {
        map.style.opacity = "1";
        map.style.pointerEvents = "none";
      }
    }
    const wrap = document.createElement("div");
    wrap.className = "mini-scaler";
    wrap.appendChild(clone);
    target.innerHTML = "";
    target.appendChild(wrap);
  }
  cloneMini("#desktopUI", "#miniLaptop .mini-screen", { dark: true });
  cloneMini("#phoneUI", "#miniPhone .mini-screen");
  cloneMini("#tabletUI", "#miniTablet .mini-screen", { view: "map" });

  /* ---------------- BOOT ---------------- */
  let booted = false;
  const params = new URLSearchParams(location.search);
  const previewT = params.has("t") ? Number(params.get("t")) || 0 : null;
  const previewPaused = params.get("paused") === "1";
  const hideChrome = params.get("chrome") === "0";
  if (hideChrome) document.body.classList.add("is-recording");

  function boot() {
    if (booted) return;
    booted = true;
    fit();
    timeTotal.textContent = fmt(PLAYBACK);
    const startT = previewT !== null ? clamp(previewT, 0, DURATION) : 0;
    state.t = startT;
    render(startT);
    document.body.classList.add("is-ready");
    const loader = $("#loader");
    if (loader) {
      setTimeout(() => {
        loader.style.opacity = "0";
        loader.style.visibility = "hidden";
        loader.style.pointerEvents = "none";
      }, 250);
      setTimeout(() => loader.remove(), 900);
    }
    if (!previewPaused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTimeout(() => play(), 150);
    } else {
      pause();
      if (previewT === null) render(0);
    }
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
    setTimeout(boot, 1800);
  } else {
    boot();
  }

  // public debug / capture API
  window.__film = {
    seek: (t) => { pause(); seek(t); },
    play: () => play(),
    pause: () => pause(),
    get time() { return state.t; },
    duration: DURATION,
  };
})();
