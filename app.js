/* ============================================================
   PUTRAJAYA.RBLX WIKI — LAUNCH FILM
   A deterministic timeline engine cut to the uploaded soundtrack
   ============================================================ */
(() => {
  "use strict";

  const DURATION = 60;
  const SPEED = 1.0;
  const PLAYBACK = DURATION;
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
     ACT 1 — LOGO RESOLVE
     ============================================================ */
  track("#act1", [
    { t: 0, opacity: 1 },
    { t: 4.82, opacity: 1 },
    { t: 5.0, opacity: 0, ease: "inOut" },
  ]);
  track("#a1Lockup", [
    { t: 0.02, opacity: 0, y: 14, scale: 0.985 },
    { t: 0.58, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 1.5, opacity: 1, y: 0, scale: 1.006 },
    { t: 1.74, opacity: 0, y: -8, scale: 0.99, ease: "inOut" },
  ]);
  track(".a1-mark", [
    { t: 0.04, opacity: 0, y: 12, scale: 0.94 },
    { t: 0.5, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 1.5, opacity: 1, y: 0, scale: 1 },
    { t: 1.74, opacity: 0, y: -6, scale: 0.96, ease: "inOut" },
  ]);
  const a1Lines = $$(".a1-word .mask > span");
  a1Lines.forEach((el, i) => {
    track(el, [
      { t: 0.12 + i * 0.055, y: 64 },
      { t: 0.62 + i * 0.055, y: 0, ease: "expo" },
      { t: 1.46, y: 0 },
      { t: 1.7, y: -40, ease: "inOut" },
    ]);
  });
  track("#a1Rule", [
    { t: 0.5, scaleX: 0, opacity: 0 },
    { t: 0.8, scaleX: 1, opacity: 1, ease: "inOut" },
    { t: 1.46, opacity: 1 },
    { t: 1.7, opacity: 0 },
  ]);
  track("#a1Kicker", [
    { t: 0.62, opacity: 0, y: 8 },
    { t: 0.96, opacity: 1, y: 0, ease: "expo" },
    { t: 1.46, opacity: 1, y: 0 },
    { t: 1.7, opacity: 0, y: -6, ease: "inOut" },
  ]);

  /* promise takes over the opening */
  track("#a1Promise", [
    { t: 1.74, opacity: 0, y: 30, scale: 1 },
    { t: 2.1, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 4.75, opacity: 1, y: 0, scale: 1.012, ease: "inOut" },
    { t: 4.98, opacity: 0, y: -18, scale: 1.02, ease: "inOut" },
  ]);
  const a1PromiseLines = $$("#a1PromiseTitle .mask > span");
  a1PromiseLines.forEach((el, i) => {
    track(el, [
      { t: 1.82 + i * 0.08, y: 100 },
      { t: 2.44 + i * 0.08, y: 0, ease: "expo" },
    ]);
  });
  track("#a1PromiseKicker", [
    { t: 1.86, opacity: 0, y: 10 },
    { t: 2.18, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a1PromiseSub", [
    { t: 2.24, opacity: 0, y: 12 },
    { t: 2.6, opacity: 1, y: 0, ease: "expo" },
  ]);

  /* ============================================================
     ACT 2 — SEARCH + ARTICLE
     ============================================================ */
  track("#act2", [
    { t: 4.95, opacity: 0 },
    { t: 5.0, opacity: 1, ease: "out" },
    { t: 28.9, opacity: 1 },
    { t: 29.05, opacity: 0, ease: "inOut" },
  ]);
  track("#a2World", [
    { t: 5, scale: 1, y: 0 },
    { t: 28.7, scale: 1.02, y: -4, ease: "inOut" },
  ]);
  track("#a2DeviceStage", [
    { t: 5, x: 140, y: 0 },
    { t: 5.7, x: 0, y: 0, ease: "expo" },
    { t: 8.8, x: 0, y: 0 },
    { t: 9.3, x: -60, y: -8, ease: "inOut" },
    { t: 13.2, x: -80, y: -8 },
    { t: 16.5, x: 0, y: 0, ease: "inOut" },
    { t: 17.2, x: 0, y: 0 },
    { t: 20.8, x: -55, y: -6, ease: "inOut" },
    { t: 23.2, x: -85, y: -6 },
    { t: 27.6, x: 0, y: 0, ease: "inOut" },
    { t: 28.9, x: 0, y: 0 },
  ]);
  track("#laptop", [
    { t: 5, opacity: 1, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 0.78 },
    { t: 5.8, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 0.82, ease: "expo" },
    { t: 8.8, scale: 0.82 },
    { t: 9.3, scale: 0.84, y: -8 },
    { t: 13.2, scale: 0.86, y: -8 },
    { t: 16.5, scale: 0.82, y: 0, ease: "inOut" },
    { t: 17.2, scale: 0.82 },
    { t: 20.8, scale: 0.84, y: -6 },
    { t: 23.2, scale: 0.85, y: -6 },
    { t: 27.6, scale: 0.82, y: 0, ease: "inOut" },
    { t: 28.9, scale: 0.82 },
  ]);

  /* headline: FIND IT FAST */
  track("#a2TypeSearch", [
    { t: 5.0, opacity: 0, y: 34, scale: 1 },
    { t: 5.2, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 8.85, opacity: 1, y: 0, scale: 1 },
    { t: 9.25, opacity: 0.72, y: -128, scale: 0.52, ease: "inOut" },
    { t: 16.2, opacity: 0.72, y: -128, scale: 0.52 },
    { t: 16.55, opacity: 0, y: -150, scale: 0.5, ease: "inOut" },
  ]);
  const searchTypeLines = $$("#a2TypeSearch .mask > span");
  searchTypeLines.forEach((el, i) => {
    track(el, [
      { t: 5.04 + i * 0.07, y: 92 },
      { t: 5.58 + i * 0.07, y: 0, ease: "expo" },
    ]);
  });

  /* headline: EVERY ROLE, EXPLAINED */
  track("#a2TypeRoles", [
    { t: 16.72, opacity: 0, y: 34, scale: 1 },
    { t: 17.08, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 20.55, opacity: 1, y: 0, scale: 1 },
    { t: 20.95, opacity: 0.62, y: -118, scale: 0.52, ease: "inOut" },
    { t: 27.6, opacity: 0.62, y: -118, scale: 0.52 },
    { t: 28.3, opacity: 0, y: -138, scale: 0.5, ease: "inOut" },
  ]);
  const rolesTypeLines = $$("#a2TypeRoles .mask > span");
  rolesTypeLines.forEach((el, i) => {
    track(el, [
      { t: 16.82 + i * 0.065, y: 100 },
      { t: 17.44 + i * 0.065, y: 0, ease: "expo" },
    ]);
  });
  track(".laptop-base, .laptop-shadow", [{ t: 0, opacity: 0 }]);
  track("[data-d-boot], .screen--desktop [data-d-flash], .screen--desktop [data-d-sweep]", [{ t: 0, opacity: 0 }]);
  track("[data-d-cursor], [data-d-ripple]", [{ t: 0, opacity: 0 }]);

  track(".d-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".d-hero-title, .d-hero-tag, .d-hero-actions, .d-hero-badges, .d-hero-search", [{ t: 0, opacity: 1, y: 0 }]);
  const deskArtRot = [-7, 6, -4];
  $$(".d-art-card").forEach((el, i) => {
    track(el, [{ t: 0, opacity: 1, y: 0, rotateZ: deskArtRot[i] || 0 }]);
  });

  /* real Pagefind search */
  track("[data-d-modal]", [
    { t: 6.0, opacity: 0 },
    { t: 6.15, opacity: 1, ease: "out" },
    { t: 15.95, opacity: 1 },
    { t: 16.2, opacity: 0, ease: "inOut" },
  ]);
  track("[data-d-panel]", [
    { t: 6.0, y: 12, scale: 0.988 },
    { t: 6.28, y: 0, scale: 1, ease: "expo" },
  ]);
  track("[data-d-result]", [
    { t: 8.55, opacity: 0.06, y: 10, scale: 1 },
    { t: 8.68, opacity: 0.3, y: 8, scale: 1 },
    { t: 8.82, opacity: 1, y: 0, scale: 1.014, ease: "expo" },
    { t: 9.1, opacity: 1, y: 0, scale: 1 },
    { t: 11.8, scale: 1.006, ease: "inOut" },
    { t: 12.1, scale: 1 },
    { t: 14.2, scale: 1.006, ease: "inOut" },
    { t: 14.5, scale: 1 },
    { t: 15.95, opacity: 1, y: 0, scale: 1 },
    { t: 16.1, opacity: 0, y: 0, scale: 1 },
  ]);
  track(".d-search-result--dim", [
    { t: 8.55, opacity: 0.03, y: 8 },
    { t: 8.68, opacity: 0.1, y: 8 },
    { t: 8.95, opacity: 0.85, y: 0, ease: "expo" },
    { t: 16.0, opacity: 0, y: 0 },
  ]);
  track(".d-search-foot", [
    { t: 8.9, opacity: 0 },
    { t: 9.2, opacity: 1, ease: "out" },
  ]);

  /* search result becomes the article */
  track(".d-page--home", [
    { t: 0, opacity: 1, x: 0, blur: 0, scale: 1 },
    { t: 16.84, opacity: 1, x: 0, blur: 0, scale: 1 },
    { t: 16.86, opacity: 0, x: 0, blur: 0, scale: 1 },
  ]);
  track(".d-page--article", [
    { t: 0, opacity: 0, x: 0, blur: 0, scale: 1.01 },
    { t: 16.84, opacity: 0, x: 0, blur: 0, scale: 1.01 },
    { t: 16.86, opacity: 1, x: 0, blur: 0, scale: 1, ease: "out" },
    { t: 17.05, opacity: 1, x: 0, blur: 0, scale: 1 },
  ]);

  track(".d-side", [{ t: 0, opacity: 1, x: 0 }]);
  track(".d-rail", [{ t: 0, opacity: 1, x: 0 }]);
  track(".d-toc", [{ t: 0, opacity: 1 }]);
  track(".d-progress", [
    { t: 16.8, opacity: 0 },
    { t: 17.1, opacity: 1 },
  ]);
  track("[data-d-progress]", [
    { t: 17.0, scaleX: 0 },
    { t: 28.8, scaleX: 0.86, ease: "inOut" },
  ]);
  track(".d-article-head", [{ t: 0, opacity: 1, y: 0 }]);
  $$(".d-article-body > *").forEach((el) => track(el, [{ t: 0, opacity: 1, y: 0 }]));

  /* read the article, then switch to dark */
  track("[data-d-article-scroll]", [
    { t: 0, y: 0 },
    { t: 17.4, y: 0 },
    { t: 19.0, y: -180, ease: "inOut" },
    { t: 27.4, y: -180 },
  ]);
  track("#desktopUI", [{ t: 0, "--dark": 0 }]);
  track("[data-theme-ripple] span", [{ t: 0, opacity: 0, scale: 0 }]);

  /* cursor: open the first result */
  track("[data-d-cursor]", [
    { t: 14.9, opacity: 0, x: 840, y: 560, scale: 1 },
    { t: 15.1, opacity: 1, x: 790, y: 505, ease: "out" },
    { t: 15.35, x: 720, y: 410, ease: "inOut" },
    { t: 15.68, x: 655, y: 312, ease: "out" },
    { t: 15.78, scale: 0.86 },
    { t: 15.88, scale: 1 },
    { t: 16.1, opacity: 0, x: 655, y: 312 },
  ]);
  track("[data-d-ripple]", [
    { t: 15.7, opacity: 0, x: 655, y: 312, scale: 0.2 },
    { t: 15.76, opacity: 0.75, x: 655, y: 312, scale: 0.7, ease: "out" },
    { t: 16.08, opacity: 0, x: 655, y: 312, scale: 1.8, ease: "out" },
  ]);

  /* ============================================================
     ACT 4 — MAP + FAMILY
     ============================================================ */
  track("#act4", [
    { t: 28.99, opacity: 0 },
    { t: 29.02, opacity: 1, ease: "out" },
    { t: 40.9, opacity: 1 },
    { t: 41.05, opacity: 0, ease: "inOut" },
    { t: 45.85, opacity: 0 },
    { t: 45.95, opacity: 1, ease: "out" },
    { t: 50.9, opacity: 1 },
    { t: 51.05, opacity: 0, ease: "inOut" },
  ]);
  track("#a4DeviceStage", [
    { t: 28.99, opacity: 0, y: 40, x: 100, scale: 1 },
    { t: 29.35, opacity: 1, y: 0, x: 0, scale: 1, ease: "expo" },
    { t: 33.6, opacity: 1, y: 0, x: 0, scale: 1 },
    { t: 34.6, x: -40, y: -4, scale: 1 },
    { t: 38.0, x: -70, y: -6, scale: 1 },
    { t: 40.7, x: 0, y: 0, scale: 1 },
    { t: 40.9, opacity: 0, y: -12, scale: 1.004, ease: "inOut" },
  ]);
  track("#tablet", [
    { t: 29.0, y: 0, rotateX: 12, rotateY: 0, rotateZ: -4, scale: 0.95 },
    { t: 30.2, y: 0, rotateX: 10, rotateY: 0, rotateZ: -3, scale: 0.95 },
    { t: 31.4, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 0.95, ease: "expo" },
    { t: 32.8, scale: 0.96 },
    { t: 34.6, scale: 0.98 },
    { t: 38.0, scale: 1.02 },
    { t: 40.8, scale: 0.95 },
  ]);
  track("[data-t-boot], .screen--tablet [data-t-flash]", [{ t: 0, opacity: 0 }]);
  track(".t-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-page--article", [{ t: 0, opacity: 0 }]);
  track(".t-map-page", [{ t: 0, opacity: 1 }]);
  track(".t-map-scroll h1, .t-map-desc, .t-map-card, .t-map-filters span, .t-map-tools", [{ t: 0, opacity: 1, y: 0 }]);
  track(".t-map-img", [{ t: 0, scale: 1 }]);

  /* THE WHOLE CITY, MAPPED */
  track("#a4Type", [
    { t: 29.0, opacity: 0, y: 34, scale: 1 },
    { t: 29.4, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 32.8, opacity: 1, y: 0, scale: 1.01 },
    { t: 33.2, opacity: 0.6, y: -95, scale: 0.55, ease: "inOut" },
    { t: 38.8, opacity: 0.6, y: -95, scale: 0.55 },
    { t: 39.6, opacity: 0, y: -115, scale: 0.5, ease: "inOut" },
  ]);
  const mapTypeLines = $$("#a4Type .mask > span");
  mapTypeLines.forEach((el, i) => {
    track(el, [
      { t: 29.1 + i * 0.07, y: 100 },
      { t: 29.72 + i * 0.07, y: 0, ease: "expo" },
    ]);
  });

  /* ONE WIKI. EVERY SCREEN. on the breakdown */
  track("#a4Family", [
    { t: 45.85, opacity: 0 },
    { t: 46.0, opacity: 1, ease: "out" },
    { t: 50.8, opacity: 1 },
    { t: 51.0, opacity: 0, ease: "inOut" },
  ]);
  track("#familyFinal", [
    { t: 45.9, opacity: 0, y: 30, scale: 1 },
    { t: 46.15, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 50.5, opacity: 1, y: 0, scale: 1.012, ease: "inOut" },
    { t: 50.9, opacity: 0, y: -18, scale: 1.01, ease: "inOut" },
  ]);
  track("#familyFinal h2 .mask > span", [
    { t: 45.98, y: 120 },
    { t: 46.6, y: 0, ease: "expo" },
  ]);
  track("#familyFinalKicker", [
    { t: 46.02, opacity: 0, y: 10 },
    { t: 46.35, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#familyFinalLine", [
    { t: 46.2, opacity: 0, y: 12 },
    { t: 46.55, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#miniLaptop", [
    { t: 46.1, opacity: 0, x: -160, y: 10, scale: 0.92 },
    { t: 46.55, opacity: 1, x: 0, y: 0, scale: 1, ease: "expo" },
    { t: 50.5, opacity: 1, x: 0, y: 0, scale: 1.015, ease: "inOut" },
    { t: 50.9, opacity: 0, x: -80, y: -10, scale: 1.02, ease: "inOut" },
  ]);
  track("#miniPhone", [
    { t: 46.2, opacity: 0, x: 160, y: 10, scale: 1.1 },
    { t: 46.65, opacity: 1, x: 0, y: 0, scale: 1.2, ease: "expo" },
    { t: 50.5, opacity: 1, x: 0, y: 0, scale: 1.22, ease: "inOut" },
    { t: 50.9, opacity: 0, x: 80, y: -10, scale: 1.25, ease: "inOut" },
  ]);
  track("#miniTablet", [{ t: 0, opacity: 0 }]);

  /* ============================================================
     ACT 3 — MOBILE
     ============================================================ */
  track("#act3", [
    { t: 40.95, opacity: 0 },
    { t: 41.0, opacity: 1, ease: "out" },
    { t: 45.85, opacity: 1 },
    { t: 46.0, opacity: 0, ease: "inOut" },
  ]);
  track("#a3DeviceStage", [
    { t: 40.95, opacity: 0, y: 40, x: 80, scale: 1 },
    { t: 41.4, opacity: 1, y: 0, x: 0, scale: 1, ease: "expo" },
    { t: 45.6, opacity: 1, y: -6, x: 0, scale: 1 },
    { t: 45.9, opacity: 0, y: -14, x: 0, scale: 1.005, ease: "inOut" },
  ]);
  track("#phone", [
    { t: 41.2, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 },
    { t: 41.9, y: 0, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.01, ease: "expo" },
    { t: 45.6, y: -4, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.04, ease: "inOut" },
  ]);
  track("[data-p-boot], .screen--phone [data-p-flash]", [{ t: 0, opacity: 0 }]);
  track(".p-header", [{ t: 0, opacity: 1, y: 0 }]);
  track(".p-page--home", [
    { t: 0, opacity: 1, x: 0, blur: 0 },
    { t: 41.92, opacity: 1, x: 0, blur: 0 },
    { t: 42.14, opacity: 0, x: -18, blur: 3, ease: "inOut" },
  ]);
  track(".p-page--article", [
    { t: 0, opacity: 0, x: 18, blur: 3 },
    { t: 41.96, opacity: 0, x: 18, blur: 3 },
    { t: 42.18, opacity: 1, x: 0, blur: 0, ease: "expo" },
  ]);
  track(".p-mobilebars", [{ t: 0, opacity: 1 }]);
  track(".p-article-title", [{ t: 0, opacity: 1, y: 0 }]);
  $$(".p-article-scroll > *:not(.p-article-title)").forEach((el) => track(el, [{ t: 0, opacity: 1, y: 0 }]));
  track(".p-appearance-pill", [{ t: 0, opacity: 1, y: 0 }]);
  track("[data-p-article-scroll]", [{ t: 0, y: 0 }]);
  track(".p-drawer-scrim", [{ t: 0, opacity: 0 }]);
  track(".p-drawer-panel", [{ t: 0, x: -340 }]);
  track(".p-drawer-link, .p-drawer-search, .p-drawer-foot", [{ t: 0, opacity: 1, y: 0 }]);
  track("[data-p-touch]", [
    { t: 41.68, opacity: 0, x: 112, y: 612, scale: 0.6 },
    { t: 41.83, opacity: 1, x: 112, y: 612, scale: 1, ease: "out" },
    { t: 41.96, scale: 0.8 },
    { t: 42.08, scale: 1 },
    { t: 42.25, opacity: 0, x: 112, y: 612 },
  ]);

  /* ONE WIKI. ANYWHERE. */
  track("#a3Type", [
    { t: 41.0, opacity: 0, y: 34, scale: 1 },
    { t: 41.35, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 44.35, opacity: 1, y: 0, scale: 1 },
    { t: 44.8, opacity: 0.6, y: -118, scale: 0.58, ease: "inOut" },
    { t: 45.55, opacity: 0, y: -138, scale: 0.55, ease: "inOut" },
  ]);
  const mobileTypeLines = $$("#a3Type .mask > span");
  mobileTypeLines.forEach((el, i) => {
    track(el, [
      { t: 41.08 + i * 0.07, y: 100 },
      { t: 41.7 + i * 0.07, y: 0, ease: "expo" },
    ]);
  });

  /* ============================================================
     ACT 5 — VISIT
     ============================================================ */
  track("#act5", [
    { t: 50.85, opacity: 0 },
    { t: 50.95, opacity: 1, ease: "out" },
  ]);
  track("#a5Outro", [
    { t: 50.85, opacity: 0, scale: 1 },
    { t: 51.15, opacity: 1, scale: 1, ease: "out" },
    { t: 60, opacity: 1, scale: 1.028, ease: "inOut" },
  ]);
  track("#outroMark", [
    { t: 50.95, opacity: 0, y: 18, scale: 0.92 },
    { t: 51.35, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track("#outroEyebrow", [
    { t: 51.15, opacity: 0, y: 8 },
    { t: 51.45, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroTitle .mask > span", [
    { t: 50.85, y: 96 },
    { t: 51.45, y: 0, ease: "expo" },
  ]);
  track("#outroSub", [
    { t: 51.45, opacity: 0, y: 12 },
    { t: 51.82, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroUrl", [
    { t: 52.25, opacity: 0, y: 18, scale: 0.98 },
    { t: 52.75, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 53.0, scale: 1.018, ease: "out" },
    { t: 53.35, scale: 1, ease: "inOut" },
    { t: 58.5, scale: 1.012, ease: "inOut" },
  ]);
  track("#outroNote", [
    { t: 52.8, opacity: 0, y: 8 },
    { t: 53.15, opacity: 1, y: 0, ease: "expo" },
  ]);

  /* ============================================================
     BACKGROUNDS
     ============================================================ */
  track(".bg--intro, .bg--features", [{ t: 0, opacity: 0 }]);
  track(".bg--bright", [
    { t: 0, opacity: 1 },
    { t: 28.9, opacity: 1 },
    { t: 29.2, opacity: 0 },
  ]);
  track(".bg--warm", [
    { t: 28.9, opacity: 0 },
    { t: 29.2, opacity: 1 },
    { t: 40.9, opacity: 1 },
    { t: 41.2, opacity: 0 },
    { t: 45.9, opacity: 0 },
    { t: 46.2, opacity: 1 },
    { t: 50.55, opacity: 1 },
    { t: 50.9, opacity: 0, ease: "inOut" },
  ]);
  track(".bg--night", [
    { t: 40.9, opacity: 0 },
    { t: 41.2, opacity: 1 },
    { t: 45.9, opacity: 1 },
    { t: 46.2, opacity: 0 },
  ]);
  track(".bg--outro", [
    { t: 50.45, opacity: 0 },
    { t: 50.85, opacity: 1, ease: "inOut" },
  ]);

  /* parallax depth planes */
  track(".depth-plane--a", [
    { t: 0, x: 0, y: 0, scale: 1 },
    { t: 60, x: -90, y: 50, scale: 1.12 },
  ]);
  track(".depth-plane--b", [
    { t: 0, x: 0, y: 0, scale: 1.06 },
    { t: 60, x: 70, y: -40, scale: 0.98 },
  ]);
  track(".depth-plane--c", [
    { t: 0, x: 0, y: 0, scale: 1 },
    { t: 60, x: -40, y: -30, scale: 1.08 },
  ]);
  track(".depth-ring", [
    { t: 0, x: 0, y: 0, scale: 1, rotate: 0 },
    { t: 60, x: -50, y: 34, scale: 1.07, rotate: 24 },
  ]);

  /* ============================================================
     TRANSITIONS
     ============================================================ */
  track("#wipe", [
    { t: 28.8, opacity: 0, "--wipe-x": -140 },
    { t: 29.0, opacity: 0.26, "--wipe-x": -60, ease: "out" },
    { t: 29.55, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 40.8, opacity: 0, "--wipe-x": -140 },
    { t: 41.0, opacity: 0.24, "--wipe-x": -60, ease: "out" },
    { t: 41.55, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 45.8, opacity: 0, "--wipe-x": -140 },
    { t: 46.0, opacity: 0.24, "--wipe-x": -60, ease: "out" },
    { t: 46.55, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 50.65, opacity: 0, "--wipe-x": -140 },
    { t: 50.85, opacity: 0.26, "--wipe-x": -60, ease: "out" },
    { t: 51.4, opacity: 0, "--wipe-x": 170, ease: "inOut" },
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
  const captionIndexEl = $("#filmCaptionIndex");
  const mapSearchText = $("#mapSearchText");
  const mapFilters = $$("#tabletUI .t-map-filters span");
  let lastTyped = null;
  let lastMapTyped = null;
  let lastCaption = null;

  /* The feature typography inside each act now carries the story. */
  const captionCues = [];

  function setStates(t) {
    dUI.classList.toggle("is-article", t >= 16.85);
    pUI.classList.toggle("is-article", t >= 42.15);
    tUI.classList.toggle("is-map", t >= 29.0);
    if (a4Family) a4Family.classList.toggle("is-live", t >= 46.0 && t < 51.0);
    stage.classList.toggle("is-ended", t >= 59.7);
    let idx = 0;
    if (t >= 19.0) idx = 1;
    if (t >= 21.4) idx = 2;
    tocLinks.forEach((a, i) => a.classList.toggle("is-active", i === idx));
    if (appearanceAuto) appearanceAuto.classList.add("is-checked");
    if (appearanceDark) {
      appearanceDark.classList.remove("is-checked", "is-active");
    }
  }

  function setCaption(t) {
    if (!captionEl) return;
    const cue = captionCues.find((c) => t >= c.from && t < c.to);
    const key = cue ? `${cue.index}|${cue.kicker}|${cue.title}|${cue.side || "left"}` : "";
    if (key === lastCaption) return;
    lastCaption = key;
    if (!cue) {
      captionEl.classList.remove("is-visible", "is-in");
      return;
    }
    if (captionIndexEl) captionIndexEl.textContent = cue.index || "";
    captionKickerEl.textContent = cue.kicker;
    captionTitleEl.innerHTML = cue.title
      .split(" ")
      .map((word, i) => `<span style="--wd:${(i * 0.055).toFixed(3)}s">${word}</span>`)
      .join(" ");
    captionEl.classList.toggle("film-caption--right", cue.side === "right");
    captionEl.classList.remove("is-in");
    void captionEl.offsetWidth;
    captionEl.classList.add("is-visible", "is-in");
  }

  function extras(t) {
    const q = "city roles";
    let n = 0;
    if (t >= 6.1) n = Math.min(q.length, Math.floor((t - 6.1) * 10.5) + 1);
    const typed = q.slice(0, n);
    if (typed !== lastTyped) {
      typeEl.textContent = typed;
      lastTyped = typed;
    }

    const mq = "bridge";
    let mn = 0;
    if (t >= 31.8) mn = Math.min(mq.length, Math.floor((t - 31.8) * 8) + 1);
    const mapTyped = t < 39.0 ? mq.slice(0, mn) : "";
    if (mapTyped !== lastMapTyped) {
      if (mapSearchText) mapSearchText.textContent = mapTyped;
      lastMapTyped = mapTyped;
    }
    tUI.classList.toggle("is-map-search", t >= 31.6 && t < 39.2);
    mapFilters.forEach((el, i) => el.classList.toggle("is-active", i === 0));
    tUI.classList.remove("is-map-filter", "is-map-pin");

    countEls.forEach((el, i) => {
      const target = Number(el.dataset.count || 0);
      const p = clamp((t - 44.05 - i * 0.12) / 0.85, 0, 1);
      const val = Math.round(target * E.expo(p));
      const str = String(clamp(val, 0, target)).padStart(2, "0");
      if (el.textContent !== str) el.textContent = str;
    });
  }

  function render(t) {
    applyTimeline(t);
    setStates(t);
    extras(t);
    setCaption(t);
    drawParticles(t);
    updatePlayerUI(t);
  }

  /* ============================================================
     PLAYER
     ============================================================ */
  const state = { t: 0, playing: false, last: 0, scrubbing: false };
  const soundtrack = $("#soundtrack");
  const TRACK_OFFSET = 6.0;
  const TRACK_LEVEL = 0.86;
  const trackVolume = (t) => {
    const inFade = clamp(t / 0.55, 0, 1);
    const outFade = t > 59.15 ? clamp((60 - t) / 0.85, 0, 1) : 1;
    return TRACK_LEVEL * inFade * outFade;
  };
  function syncTrack(force = false) {
    if (!soundtrack || !audioOn) return;
    const target = TRACK_OFFSET + state.t;
    if (force || Math.abs(soundtrack.currentTime - target) > 0.28) {
      try { soundtrack.currentTime = target; } catch (e) {}
    }
    soundtrack.volume = trackVolume(state.t);
  }
  function playTrack() {
    if (!soundtrack || !audioOn) return;
    syncTrack(true);
    const p = soundtrack.play();
    if (p && p.catch) p.catch(() => {});
  }
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
    { t: 0, label: "Brand" },
    { t: 5, label: "Search" },
    { t: 17, label: "Article" },
    { t: 29, label: "Map" },
    { t: 41, label: "Every screen" },
    { t: 51, label: "Visit" },
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
    if (audioOn) {
      syncTrack(true);
      if (state.playing) playTrack();
    }
  }

  function tick(now) {
    if (!state.playing) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    state.t += dt * SPEED;
    if (state.t >= DURATION) {
      state.t = DURATION;
      render(state.t);
      stage.classList.add("is-ended");
      pause();
      return;
    }
    render(state.t);
    if (audioOn) syncTrack();
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
    if (audioOn) playTrack();
    raf = requestAnimationFrame(tick);
    scheduleIdle();
  }

  function pause() {
    state.playing = false;
    cancelAnimationFrame(raf);
    document.body.classList.remove("is-playing", "idle");
    playBtn.setAttribute("aria-label", "Play");
    if (audioOn) audioLevel(PAUSED_LEVEL, 0.3);
    if (soundtrack) soundtrack.pause();
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
    const stageEl = document.getElementById("stage");
    if (stageEl) {
      stageEl.style.transform = `translate(-50%, -50%) scale(${s})`;
    }
  }
  window.addEventListener("resize", fit);
  window.addEventListener("load", fit);
  fit();
  setTimeout(fit, 300);

  /* ---------------- SOUNDTRACK ----------------
     The launch cut plays the uploaded AudioTrack.mp3 only. The legacy
     synthesised score below is left dormant so the cut can be reversed. */
  let audio = null;
  let audioOn = false;
  let audioMuted = false;
  let audioChapter = -1;
  let lastTypeTick = -1;
  let lastPulse = -1;
  let lastArp = -1;
  let lastBeat = -1;
  let lastEighth = -1;
  let lastChordIdx = -1;
  let lastMapTick = -1;

  const BPM = 120;
  const BEAT = 60 / BPM;
  const chordForTime = (t) => [0, 1, 2, 3][Math.floor(Math.max(0, t) / 4) % 4];

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
    lastTypeTick = Math.floor(t * 8);
    lastMapTick = Math.floor(t * 8);
    lastBeat = Math.floor(t / BEAT);
    lastEighth = Math.floor(t / (BEAT / 2));
    lastChordIdx = chordForTime(t);
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
    audioMuted = false;
    audioOn = true;
    syncTrack(true);
    if (state.playing) playTrack();
    updateSoundUI();
  }

  function audioLevel(value, tc) {
    if (!audio) return;
    const now = audio.ctx.currentTime;
    audio.master.gain.cancelScheduledValues(now);
    audio.master.gain.setTargetAtTime(value, now, tc || 0.35);
  }

  function disableAudio() {
    audioOn = false;
    if (soundtrack) soundtrack.pause();
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

  function sfxPluck(freq, vol = 0.022) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const g = envGain(vol, 0.006, 0.38);
    o.connect(lp);
    lp.connect(g);
    sendTo(g, 0.35);
    o.start(t);
    o.stop(t + 0.42);
  }

  function sfxBass(freq = 65, vol = 0.045) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const g = envGain(vol * SFX_BOOST, 0.005, 0.35);
    o.connect(lp);
    lp.connect(g);
    sendTo(g, 0.05);
    o.start(t);
    o.stop(t + 0.4);
  }

  function sfxKick(vol = 0.05) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(124, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.13);
    const g = envGain(vol * SFX_BOOST, 0.002, 0.22);
    o.connect(g);
    sendTo(g, 0.08);
    o.start(t);
    o.stop(t + 0.26);
  }

  function sfxClap(vol = 0.022) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.9;
    const g = envGain(vol * SFX_BOOST, 0.002, 0.12);
    src.connect(bp);
    bp.connect(g);
    sendTo(g, 0.18);
    src.start(t);
    src.stop(t + 0.16);
  }

  function sfxHat(vol = 0.012) {
    if (!audio) return;
    const ctx = audio.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = audio.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = envGain(vol * SFX_BOOST, 0.001, 0.05);
    src.connect(hp);
    hp.connect(g);
    sendTo(g, 0.04);
    src.start(t);
    src.stop(t + 0.06);
  }

  const AUDIO_CUES = [
    { t: 0.22, fn: () => sfxBoom(0.14) },
    { t: 0.7, fn: () => sfxChime(523.25, 0.04) },
    { t: 2.0, fn: () => sfxClick(0.035) },
    { t: 4.0, fn: () => sfxChime(659.25, 0.045) },
    { t: 7.5, fn: () => sfxWhoosh(0.6, 0.06, 300, 1600) },
    { t: 10.0, fn: () => sfxWhoosh(0.7, 0.05, 220, 1200) },
    { t: 14.0, fn: () => sfxClick(0.06) },
    { t: 14.5, fn: () => sfxChime(523.25, 0.035) },
    { t: 21.5, fn: () => sfxWhoosh(0.7, 0.06, 220, 1900) },
    { t: 22.0, fn: () => { sfxBoom(0.09); sfxChime(392, 0.025); } },
    { t: 24.0, fn: () => sfxClick(0.045) },
    { t: 25.0, fn: () => sfxChime(659.25, 0.035) },
    { t: 30.0, fn: () => sfxClick(0.03) },
    { t: 34.5, fn: () => sfxWhoosh(0.7, 0.06, 240, 2000) },
    { t: 35.0, fn: () => { sfxBoom(0.08); sfxChime(440, 0.025); } },
    { t: 39.0, fn: () => sfxWhoosh(0.7, 0.05, 240, 1400) },
    { t: 41.5, fn: () => sfxClick(0.04) },
    { t: 42.0, fn: () => sfxWhoosh(0.55, 0.06, 300, 1600) },
    { t: 45.0, fn: () => sfxClick(0.035) },
    { t: 46.5, fn: () => sfxWhoosh(0.7, 0.06, 240, 1900) },
    { t: 47.0, fn: () => { sfxBoom(0.08); sfxChime(523.25, 0.03); } },
    { t: 51.5, fn: () => sfxWhoosh(0.8, 0.07, 260, 2200) },
    { t: 52.0, fn: () => { sfxBoom(0.12); sfxChime(392, 0.03); } },
    { t: 53.0, fn: () => sfxChime(523.25, 0.05) },
    { t: 56.0, fn: () => { sfxBoom(0.1); sfxChime(659.25, 0.05); } },
    { t: 58.0, fn: () => sfxChime(783.99, 0.03) },
  ];

  function audioFrame(prev, next) {
    if (!audioOn || !audio || next < prev) return;

    if (next >= 2 && next < 56) {
      const beat = Math.floor(next / BEAT);
      if (beat !== lastBeat) {
        lastBeat = beat;
        const inBar = ((beat % 4) + 4) % 4;
        sfxKick(inBar === 0 ? 0.06 : 0.045);
        if (inBar === 1 || inBar === 3) sfxClap(0.022);
        const chord = CHORDS[chordForTime(next)];
        sfxBass(chord[0] / 2, 0.04);
      }
      const eighth = Math.floor(next / (BEAT / 2));
      if (eighth !== lastEighth) {
        lastEighth = eighth;
        if (eighth % 2 === 1) sfxHat(0.012);
        const chord = CHORDS[chordForTime(next)];
        const pattern = [1, 2, 3, 2, 1, 3, 2, 1];
        sfxPluck(chord[pattern[eighth % pattern.length]] * 2, eighth % 2 ? 0.008 : 0.013);
      }
      const ci = chordForTime(next);
      if (ci !== lastChordIdx) {
        lastChordIdx = ci;
        setChord(ci);
      }
    } else if (next >= 56 && lastChordIdx !== 5) {
      lastChordIdx = 5;
      setChord(5);
    }

    for (const cue of AUDIO_CUES) {
      if (prev < cue.t && next >= cue.t) cue.fn();
    }
    if (next >= 2.45 && next <= 3.8) {
      const k = Math.floor(next * 8);
      if (k !== lastTypeTick) {
        lastTypeTick = k;
        sfxTick();
      }
    }
    if (next >= 24.45 && next <= 25.6) {
      const k = Math.floor(next * 8);
      if (k !== lastMapTick) {
        lastMapTick = k;
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
    if (opts.view === "article") {
      const home = clone.querySelector(".d-page--home, .p-page--home");
      const article = clone.querySelector(".d-page--article, .p-page--article");
      if (home) home.style.opacity = "0";
      if (article) {
        article.style.opacity = "1";
        article.style.transform = "none";
        article.style.filter = "none";
      }
      const scroll = clone.querySelector("[data-d-article-scroll], [data-p-article-scroll]");
      if (scroll) scroll.style.transform = `translateY(${opts.scroll !== undefined ? opts.scroll : -150}px)`;
    }
    const wrap = document.createElement("div");
    wrap.className = "mini-scaler";
    wrap.appendChild(clone);
    target.innerHTML = "";
    target.appendChild(wrap);
  }
  cloneMini("#desktopUI", "#miniLaptop .mini-screen", { dark: true, view: "article", scroll: 0 });
  cloneMini("#phoneUI", "#miniPhone .mini-screen", { view: "article", scroll: 0 });
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
