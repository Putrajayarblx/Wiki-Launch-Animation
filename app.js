/* ============================================================
   PUTRAJAYA.RBLX WIKI — LAUNCH FILM
   A deterministic timeline engine + 54 second cinematic score
   ============================================================ */
(() => {
  "use strict";

  const DURATION = 54;
  const SPEED = 1.28;
  const PLAYBACK = DURATION / SPEED;
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
     ACT 1 — BRAND
     ============================================================ */
  track("#act1", [{ t: 0, opacity: 1 }, { t: 6.6, opacity: 1 }, { t: 7.1, opacity: 0 }]);
  track("#a1Orbit", [
    { t: 0.1, opacity: 0, scale: 0.9, rotate: 0 },
    { t: 1.8, opacity: 0.85, scale: 1, rotate: 5, ease: "expo" },
    { t: 6.9, opacity: 0.55, scale: 1.03, rotate: 32, ease: "linear" },
  ]);
  track(".a1-mark", [
    { t: 0.35, opacity: 0, y: 34, scale: 0.82, blur: 12 },
    { t: 1.6, opacity: 1, y: 0, scale: 1, blur: 0, ease: "expo" },
    { t: 5.8, opacity: 1, y: 0, scale: 1.01, blur: 0 },
    { t: 6.7, opacity: 0, y: -10, scale: 0.96, blur: 4 },
  ]);
  track(".a1-mark-ring", [
    { t: 0.5, opacity: 0, scale: 0.55 },
    { t: 1.9, opacity: 0.55, scale: 1, ease: "expo" },
    { t: 6.4, opacity: 0.18, scale: 1.04 },
  ]);
  track(".a1-mark-glow", [
    { t: 0.3, opacity: 0, scale: 0.7 },
    { t: 1.7, opacity: 1, scale: 1, ease: "out" },
    { t: 6.5, opacity: 0.8, scale: 1.05 },
  ]);
  track(".a1-word-main", [
    { t: 1.05, y: 130 },
    { t: 2.15, y: 0, ease: "expo" },
  ]);
  track(".a1-word-sub", [
    { t: 1.24, y: 130 },
    { t: 2.34, y: 0, ease: "expo" },
  ]);
  track("#a1Rule", [
    { t: 2.25, scaleX: 0, opacity: 0 },
    { t: 3.0, scaleX: 1, opacity: 1, ease: "inOut" },
  ]);
  track("#a1Kicker", [
    { t: 2.5, opacity: 0, y: 14 },
    { t: 3.25, opacity: 1, y: 0, ease: "expo" },
  ]);
  stagger(".a1-badge", 3.0, 0.13, { y: 16, dur: 0.7 });
  track("#a1Foot", [
    { t: 3.8, opacity: 0 },
    { t: 4.6, opacity: 1, ease: "out" },
    { t: 5.55, opacity: 1 },
    { t: 6.35, opacity: 0, ease: "inOut" },
  ]);
  track(".a1-ghost", [
    { t: 0.2, opacity: 0, x: -20 },
    { t: 2.2, opacity: 1, x: 0, ease: "out" },
    { t: 6.4, opacity: 0, x: 24 },
  ]);
  track("#a1Lockup", [
    { t: 2.4, y: 0, scale: 1, opacity: 1 },
    { t: 5.3, y: -4, scale: 1.012, opacity: 1 },
    { t: 6.55, y: -60, scale: 0.94, opacity: 0, ease: "inOut" },
  ]);
  track("#a1Sweep", [
    { t: 3.9, opacity: 0, "--a1-sweep-x": -80 },
    { t: 4.25, opacity: 0.65, "--a1-sweep-x": -20, ease: "out" },
    { t: 5.3, opacity: 0, "--a1-sweep-x": 210, ease: "inOut" },
  ]);

  /* ============================================================
     ACT 2 — DESKTOP
     ============================================================ */
  track("#act2", [
    { t: 6.35, opacity: 0 },
    { t: 6.95, opacity: 1 },
    { t: 23.45, opacity: 1 },
    { t: 24.15, opacity: 0 },
  ]);
  track("#a2World", [
    { t: 7.0, scale: 0.995, y: 8 },
    { t: 17.0, scale: 1.012, y: 0, ease: "linear" },
  ]);
  track("#a2Copy", [
    { t: 6.5, opacity: 0, y: 20 },
    { t: 7.25, opacity: 1, y: 0, ease: "expo" },
    { t: 13.55, opacity: 1, x: 0, blur: 0 },
    { t: 14.25, opacity: 0, x: -60, blur: 8, ease: "inOut" },
  ]);
  track(".a2-copy .eyebrow", [
    { t: 6.65, opacity: 0, y: 14 },
    { t: 7.2, opacity: 1, y: 0, ease: "expo" },
  ]);
  const a2Lines = $$("#a2Headline .mask > span");
  a2Lines.forEach((el, i) => {
    track(el, [
      { t: 6.85 + i * 0.13, y: 112 },
      { t: 7.9 + i * 0.13, y: 0, ease: "expo" },
    ]);
  });
  track("#a2Lede", [
    { t: 7.8, opacity: 0, y: 18 },
    { t: 8.55, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a2DeviceStage", [
    { t: 6.45, opacity: 0, y: 150, scale: 0.97, x: 0 },
    { t: 8.0, opacity: 1, y: 0, scale: 1, x: 0, ease: "expo" },
    { t: 13.4, x: 0, y: 0 },
    { t: 14.45, x: -295, y: 8, ease: "inOut" },
    { t: 15.85, x: -295, y: 8 },
    { t: 17.4, x: -295, y: 70, ease: "inOut" },
    { t: 22.7, x: -295, y: 70 },
    { t: 23.9, x: -310, y: 70, ease: "inOut" },
  ]);
  track("#laptop", [
    { t: 6.45, opacity: 0, y: 60, rotateX: 18, rotateY: -20, rotateZ: -2, scale: 0.96, blur: 8 },
    { t: 8.4, opacity: 1, y: 0, rotateX: 5, rotateY: -10, rotateZ: -0.5, scale: 1, blur: 0, ease: "expo" },
    { t: 13.4, rotateX: 5, rotateY: -10, rotateZ: -0.5, scale: 1 },
    { t: 14.45, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.32, ease: "inOut" },
    { t: 15.85, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.32 },
    { t: 17.4, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.71, ease: "inOut" },
    { t: 22.7, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1.71 },
    { t: 23.9, scale: 1.74, ease: "inOut" },
  ]);
  track(".laptop-base, .laptop-shadow", [
    { t: 15.75, opacity: 1 },
    { t: 16.2, opacity: 0, ease: "inOut" },
  ]);
  track("[data-d-boot]", [
    { t: 0, opacity: 1 },
    { t: 8.05, opacity: 1 },
    { t: 8.5, opacity: 0, ease: "inOut" },
  ]);
  track(".screen--desktop [data-d-flash]", [
    { t: 8.15, opacity: 0 },
    { t: 8.35, opacity: 0.9 },
    { t: 8.85, opacity: 0, ease: "out" },
    { t: 20.95, opacity: 0 },
    { t: 21.1, opacity: 0.28 },
    { t: 21.55, opacity: 0, ease: "out" },
  ]);
  track(".screen--desktop [data-d-sweep]", [
    { t: 8.2, opacity: 0, "--screen-sweep-x": -700 },
    { t: 8.5, opacity: 0.5, "--screen-sweep-x": -200, ease: "out" },
    { t: 9.5, opacity: 0, "--screen-sweep-x": 1700, ease: "inOut" },
  ]);

  // desktop UI cascade — faithful to the real splash homepage
  track(".d-header", [
    { t: 8.25, opacity: 0, y: -22 },
    { t: 9.0, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".d-hero-title", [
    { t: 9.15, opacity: 0, y: 18 },
    { t: 9.95, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".d-hero-tag", [
    { t: 9.4, opacity: 0, y: 16 },
    { t: 10.15, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".d-hero-actions", [
    { t: 9.65, opacity: 0, y: 14 },
    { t: 10.35, opacity: 1, y: 0, ease: "expo" },
  ]);
  const deskArtRot = [-7, 6, -4];
  $$(".d-art-card").forEach((el, i) => {
    const rot = deskArtRot[i] || 0;
    const s = 9.25 + i * 0.15;
    track(el, [
      { t: s, opacity: 0, y: 22, rotateZ: rot },
      { t: s + 0.85, opacity: 1, y: 0, rotateZ: rot, ease: "expo" },
    ]);
  });
  track(".d-hero-badges", [
    { t: 10.15, opacity: 0, y: 14 },
    { t: 10.8, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".d-hero-search", [
    { t: 10.35, opacity: 0, y: 14 },
    { t: 11.0, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a2Caption", [
    { t: 10.8, opacity: 0, y: 8 },
    { t: 11.5, opacity: 1, y: 0, ease: "expo" },
    { t: 12.7, opacity: 1 },
    { t: 13.25, opacity: 0, ease: "inOut" },
  ]);

  // cursor + search
  track("[data-d-cursor]", [
    { t: 12.1, opacity: 0, x: 1120, y: 760, scale: 1 },
    { t: 12.45, opacity: 1 },
    { t: 13.35, x: 500, y: 36, ease: "inOut" },
    { t: 13.45, scale: 0.82, ease: "out" },
    { t: 13.6, scale: 1, ease: "out" },
    { t: 15.05, x: 520, y: 36, ease: "inOut" },
    { t: 15.45, x: 620, y: 205, ease: "inOut" },
    { t: 15.52, scale: 0.82 },
    { t: 15.66, scale: 1 },
    { t: 15.8, opacity: 0, x: 620, y: 205 },
    { t: 20.45, opacity: 0, x: 1240, y: 300 },
    { t: 20.7, opacity: 1 },
    { t: 21.0, x: 1352, y: 418, ease: "inOut" },
    { t: 21.08, scale: 0.82 },
    { t: 21.22, scale: 1 },
    { t: 21.5, opacity: 0 },
  ]);
  track("[data-d-ripple]", [
    { t: 13.42, opacity: 0, scale: 0.3, x: 500, y: 36 },
    { t: 13.48, opacity: 0.9, scale: 0.6, x: 500, y: 36 },
    { t: 13.9, opacity: 0, scale: 1.7, x: 500, y: 36, ease: "out" },
    { t: 14.0, opacity: 0, scale: 1.7, x: 500, y: 36 },
    { t: 15.4, opacity: 0, scale: 0.4, x: 620, y: 205 },
    { t: 15.48, opacity: 0.9, scale: 0.6, x: 620, y: 205 },
    { t: 15.9, opacity: 0, scale: 1.7, x: 620, y: 205, ease: "out" },
    { t: 16.0, opacity: 0, scale: 1.7, x: 620, y: 205 },
    { t: 20.95, opacity: 0, scale: 0.4, x: 1352, y: 418 },
    { t: 21.03, opacity: 0.9, scale: 0.6, x: 1352, y: 418 },
    { t: 21.45, opacity: 0, scale: 1.7, x: 1352, y: 418, ease: "out" },
  ]);
  track("[data-d-modal]", [
    { t: 13.45, opacity: 0 },
    { t: 13.65, opacity: 1, ease: "out" },
    { t: 15.68, opacity: 1 },
    { t: 15.92, opacity: 0, ease: "inOut" },
  ]);
  track("[data-d-panel]", [
    { t: 13.45, y: 16, scale: 0.975 },
    { t: 13.9, y: 0, scale: 1, ease: "expo" },
  ]);
  track("[data-d-result]", [
    { t: 13.7, opacity: 0.1, y: 8 },
    { t: 14.55, opacity: 0.35, y: 8 },
    { t: 14.95, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 15.35, opacity: 1, y: 0, scale: 1.012, ease: "out" },
    { t: 15.6, opacity: 1, y: 0, scale: 1 },
    { t: 15.7, opacity: 0 },
  ]);
  track(".d-search-result--dim", [
    { t: 13.7, opacity: 0.05, y: 8 },
    { t: 14.55, opacity: 0.12, y: 8 },
    { t: 15.2, opacity: 0.9, y: 0, ease: "expo" },
    { t: 15.7, opacity: 0 },
  ]);
  track(".d-search-foot", [
    { t: 15.0, opacity: 0 },
    { t: 15.3, opacity: 1, ease: "out" },
  ]);

  // page transition
  track(".d-page--home", [
    { t: 15.7, opacity: 1, x: 0, blur: 0, scale: 1 },
    { t: 16.12, opacity: 0, x: -55, blur: 8, scale: 1.015, ease: "inOut" },
  ]);
  track(".d-page--article", [
    { t: 15.85, opacity: 0, x: 45, blur: 8, scale: 1.015 },
    { t: 16.35, opacity: 1, x: 0, blur: 0, scale: 1, ease: "expo" },
  ]);
  track(".d-side", [
    { t: 16.1, opacity: 0, x: -12 },
    { t: 16.65, opacity: 1, x: 0, ease: "expo" },
  ]);
  track(".d-rail", [
    { t: 16.1, opacity: 0, x: 12 },
    { t: 16.65, opacity: 1, x: 0, ease: "expo" },
  ]);
  track(".d-toc", [
    { t: 16.2, opacity: 0 },
    { t: 16.7, opacity: 1, ease: "expo" },
  ]);
  track(".d-progress", [
    { t: 16.0, opacity: 0 },
    { t: 16.3, opacity: 1 },
  ]);
  track("[data-d-progress]", [
    { t: 18.2, scaleX: 0 },
    { t: 20.5, scaleX: 0.82, ease: "inOut" },
  ]);
  track(".d-article-head", [
    { t: 15.95, opacity: 0, y: 22 },
    { t: 16.55, opacity: 1, y: 0, ease: "expo" },
  ]);
  stagger(".d-article-body > *", 16.1, 0.055, { y: 16, dur: 0.65 });
  track("[data-d-article-scroll]", [
    { t: 18.2, y: 0 },
    { t: 20.6, y: -170, ease: "inOut" },
    { t: 23.7, y: -170 },
  ]);
  track("#desktopUI", [
    { t: 20.9, "--dark": 0 },
    { t: 21.75, "--dark": 1, ease: "inOut" },
  ]);
  track("[data-theme-ripple] span", [
    { t: 20.98, opacity: 0, scale: 0 },
    { t: 21.08, opacity: 0.65, scale: 0.5, ease: "out" },
    { t: 21.75, opacity: 0, scale: 24, ease: "inOut" },
  ]);

  /* ============================================================
     ACT 3 — MOBILE
     ============================================================ */
  track("#act3", [
    { t: 23.4, opacity: 0 },
    { t: 24.0, opacity: 1 },
    { t: 33.25, opacity: 1 },
    { t: 33.45, opacity: 1 },
    { t: 34.05, opacity: 0 },
  ]);
  track("#a3Copy", [
    { t: 23.7, opacity: 0, y: 30 },
    { t: 24.5, opacity: 1, y: 0, ease: "expo" },
    { t: 32.9, opacity: 1, y: 0 },
    { t: 33.45, opacity: 0, y: -20, ease: "inOut" },
  ]);
  const a3Lines = $$("#a3Headline .mask > span");
  a3Lines.forEach((el, i) =>
    track(el, [
      { t: 23.9 + i * 0.13, y: 100 },
      { t: 24.8 + i * 0.13, y: 0, ease: "expo" },
    ])
  );
  track("#a3Lede", [
    { t: 24.5, opacity: 0, y: 18 },
    { t: 25.15, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".a3-ghost", [
    { t: 23.9, opacity: 0, x: 40 },
    { t: 25.0, opacity: 1, x: 0, ease: "out" },
    { t: 33.0, opacity: 0.6, x: -90, ease: "linear" },
  ]);
  track("#a3DeviceStage", [
    { t: 23.55, opacity: 0, y: 160, scale: 0.96 },
    { t: 24.9, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 31.2, y: 0 },
    { t: 32.2, y: -20, ease: "inOut" },
  ]);
  track("#phone", [
    { t: 23.7, y: 120, rotateX: 10, rotateY: -28, rotateZ: 3, scale: 0.94 },
    { t: 25.2, y: 0, rotateX: 4, rotateY: -16, rotateZ: 0, scale: 1, ease: "expo" },
    { t: 31.2, y: 0, rotateX: 1, rotateY: -7, rotateZ: 0, scale: 1.04, ease: "inOut" },
    { t: 33.0, y: -8, rotateX: 1, rotateY: -7, rotateZ: 0, scale: 1.07 },
  ]);
  track("[data-p-boot]", [
    { t: 0, opacity: 1 },
    { t: 24.8, opacity: 1 },
    { t: 25.2, opacity: 0, ease: "inOut" },
  ]);
  track(".screen--phone [data-p-flash]", [
    { t: 24.85, opacity: 0 },
    { t: 25.0, opacity: 0.92 },
    { t: 25.45, opacity: 0, ease: "out" },
  ]);
  track(".p-header", [
    { t: 24.95, opacity: 0, y: -14 },
    { t: 25.45, opacity: 1, y: 0, ease: "expo" },
  ]);
  const phoneArtRot = [-7, 6, -4];
  $$(".p-art-card").forEach((el, i) => {
    const rot = phoneArtRot[i] || 0;
    const s = 25.0 + i * 0.13;
    track(el, [
      { t: s, opacity: 0, y: 22, rotateZ: rot },
      { t: s + 0.85, opacity: 1, y: 0, rotateZ: rot, ease: "expo" },
    ]);
  });
  track(".p-hero-title", [
    { t: 25.15, opacity: 0, y: 14 },
    { t: 25.72, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".p-hero-tag", [
    { t: 25.3, opacity: 0, y: 12 },
    { t: 25.85, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".p-actions", [
    { t: 25.45, opacity: 0, y: 10 },
    { t: 26.0, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".p-badges", [
    { t: 25.6, opacity: 0, y: 10 },
    { t: 26.1, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".p-search", [
    { t: 25.75, opacity: 0, y: 10 },
    { t: 26.2, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("[data-p-home-scroll]", [
    { t: 26.35, y: 0 },
    { t: 27.0, y: -46, ease: "inOut" },
    { t: 29.2, y: -46 },
  ]);
  // drawer
  track(".p-drawer-scrim", [
    { t: 27.2, opacity: 0 },
    { t: 27.55, opacity: 1, ease: "out" },
    { t: 28.95, opacity: 0, ease: "inOut" },
  ]);
  track(".p-drawer-panel", [
    { t: 27.2, x: -340 },
    { t: 27.85, x: 0, ease: "expo" },
    { t: 28.3, x: 0 },
    { t: 28.95, x: -340, ease: "inOut" },
  ]);
  stagger(".p-drawer-link", 27.4, 0.055, { y: 10, dur: 0.55 });
  track(".p-drawer-search", [
    { t: 27.35, opacity: 0, y: 10 },
    { t: 27.8, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".p-drawer-foot", [
    { t: 27.6, opacity: 0 },
    { t: 28.0, opacity: 1 },
  ]);
  // touch
  track("[data-p-touch]", [
    { t: 27.0, opacity: 0, scale: 0.6, x: 352, y: 58 },
    { t: 27.15, opacity: 1, scale: 1, x: 352, y: 58, ease: "out" },
    { t: 27.25, scale: 0.78 },
    { t: 27.4, scale: 1 },
    { t: 27.62, opacity: 0, x: 352, y: 58 },
    { t: 28.22, opacity: 0, x: 300, y: 30 },
    { t: 28.32, opacity: 1, scale: 1, x: 300, y: 30 },
    { t: 28.4, scale: 0.78 },
    { t: 28.55, scale: 1 },
    { t: 28.72, opacity: 0, x: 300, y: 30 },
    { t: 28.98, opacity: 0, x: 160, y: 450 },
    { t: 29.08, opacity: 1, scale: 1, x: 160, y: 450 },
    { t: 29.16, scale: 0.78 },
    { t: 29.3, scale: 1 },
    { t: 29.5, opacity: 0, x: 160, y: 450 },
  ]);
  // mobile article
  track(".p-page--home", [
    { t: 29.0, opacity: 1, x: 0, blur: 0 },
    { t: 29.45, opacity: 0, x: -46, blur: 5, ease: "inOut" },
  ]);
  track(".p-page--article", [
    { t: 29.05, opacity: 0, x: 46, blur: 5 },
    { t: 29.6, opacity: 1, x: 0, blur: 0, ease: "expo" },
  ]);
  track(".p-mobilebars", [
    { t: 29.1, opacity: 0 },
    { t: 29.55, opacity: 1, ease: "out" },
  ]);
  track(".p-article-title", [
    { t: 29.15, opacity: 0, y: 16 },
    { t: 29.75, opacity: 1, y: 0, ease: "expo" },
  ]);
  stagger(".p-article-scroll > *:not(.p-article-title)", 29.3, 0.05, { y: 14, dur: 0.6 });
  track("[data-p-article-scroll]", [
    { t: 30.35, y: 0 },
    { t: 31.45, y: -196, ease: "inOut" },
    { t: 33.2, y: -196 },
  ]);
  track(".p-appearance-pill", [
    { t: 29.7, opacity: 0, y: 10 },
    { t: 30.2, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a3Caption", [
    { t: 25.1, opacity: 0, y: 8 },
    { t: 25.7, opacity: 1, y: 0, ease: "expo" },
    { t: 31.6, opacity: 1 },
    { t: 32.25, opacity: 0, ease: "inOut" },
  ]);

  /* ============================================================
     ACT 4 — TABLET + FAMILY
     ============================================================ */
  track("#act4", [
    { t: 33.3, opacity: 0 },
    { t: 33.9, opacity: 1 },
    { t: 42.95, opacity: 1 },
    { t: 43.45, opacity: 0 },
  ]);
  track("#a4Copy", [
    { t: 33.6, opacity: 0, y: 26 },
    { t: 34.4, opacity: 1, y: 0, ease: "expo" },
    { t: 37.85, opacity: 1, y: 0 },
    { t: 38.4, opacity: 0, y: -20, ease: "inOut" },
  ]);
  const a4Lines = $$("#a4Headline .mask > span");
  a4Lines.forEach((el, i) =>
    track(el, [
      { t: 33.85 + i * 0.13, y: 100 },
      { t: 34.8 + i * 0.13, y: 0, ease: "expo" },
    ])
  );
  track("#a4Lede", [
    { t: 34.5, opacity: 0, y: 16 },
    { t: 35.15, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a4DeviceStage", [
    { t: 33.45, opacity: 0, x: -120, y: 40, scale: 0.98 },
    { t: 34.5, opacity: 1, x: 0, y: 0, scale: 1, ease: "expo" },
    { t: 37.9, opacity: 1, x: 0, y: -4, scale: 1.015 },
    { t: 38.45, opacity: 0, x: 0, y: -20, scale: 1.015, ease: "inOut" },
  ]);
  track("#tablet", [
    { t: 33.6, y: 50, rotateX: 6, rotateY: 20, rotateZ: 1, scale: 0.95 },
    { t: 35.1, y: 0, rotateX: 3, rotateY: -9, rotateZ: 0, scale: 1, ease: "expo" },
    { t: 37.8, y: 0, rotateX: 3, rotateY: -9, rotateZ: 0, scale: 1 },
    { t: 38.4, y: -10, rotateX: 3, rotateY: -9, rotateZ: 0, scale: 1.02, ease: "inOut" },
  ]);
  track("[data-t-boot]", [
    { t: 0, opacity: 1 },
    { t: 34.55, opacity: 1 },
    { t: 35.0, opacity: 0, ease: "inOut" },
  ]);
  track(".screen--tablet [data-t-flash]", [
    { t: 34.6, opacity: 0 },
    { t: 34.78, opacity: 0.8 },
    { t: 35.2, opacity: 0, ease: "out" },
  ]);
  track(".t-header", [
    { t: 34.7, opacity: 0, y: -14 },
    { t: 35.2, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".t-side a", [
    { t: 34.85, opacity: 0, y: 10 },
    { t: 35.4, opacity: 1, y: 0, ease: "expo" },
  ]);
  stagger(".t-article-scroll > *", 34.95, 0.06, { y: 16, dur: 0.65 });
  track(".t-page--article", [
    { t: 36.1, opacity: 1, x: 0 },
    { t: 36.55, opacity: 0, x: -40, ease: "inOut" },
  ]);
  track(".t-map-page", [
    { t: 36.45, opacity: 0, y: 18, scale: 0.985 },
    { t: 36.98, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track(".t-map-scroll h1", [
    { t: 36.55, opacity: 0, y: 14 },
    { t: 37.05, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".t-map-desc", [
    { t: 36.65, opacity: 0, y: 10 },
    { t: 37.1, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".t-map-card", [
    { t: 36.7, opacity: 0, y: 18 },
    { t: 37.25, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".t-map-img", [
    { t: 36.7, scale: 1.04 },
    { t: 38.3, scale: 1.08, ease: "inOut" },
  ]);
  stagger(".t-map-filters span", 36.95, 0.045, { y: 8, dur: 0.45 });
  stagger(".t-map-pin", 37.05, 0.075, { y: 0, scale: 0.4, dur: 0.55 });
  track(".t-map-tools", [
    { t: 37.3, opacity: 0, x: 8 },
    { t: 37.75, opacity: 1, x: 0, ease: "expo" },
  ]);
  track("#a4Caption", [
    { t: 35.2, opacity: 0, y: 8 },
    { t: 35.8, opacity: 1, y: 0, ease: "expo" },
    { t: 37.8, opacity: 0 },
  ]);
  // family
  track("#a4Family", [
    { t: 38.0, opacity: 0, y: 20 },
    { t: 38.75, opacity: 1, y: 0, ease: "expo" },
    { t: 42.55, opacity: 1, y: 0, scale: 1 },
    { t: 43.15, opacity: 0, y: -20, scale: 1.03, ease: "inOut" },
  ]);
  const famLines = $$("#a4FamilyTitle .mask > span");
  track("#a4Family .eyebrow", [
    { t: 38.15, opacity: 0, y: 12 },
    { t: 38.7, opacity: 1, y: 0, ease: "expo" },
  ]);
  famLines.forEach((el) =>
    track(el, [
      { t: 38.3, y: 90 },
      { t: 39.15, y: 0, ease: "expo" },
    ])
  );
  track("#miniLaptop", [
    { t: 38.3, opacity: 0, y: 90, scale: 0.96 },
    { t: 39.1, opacity: 1, y: 0, scale: 1, ease: "expo" },
    { t: 41.9, y: -7, scale: 1 },
  ]);
  track("#miniTablet", [
    { t: 38.4, opacity: 0, x: -170, y: 30, rotateZ: -12, scale: 0.95 },
    { t: 39.25, opacity: 1, x: 0, y: 0, rotateZ: -6, scale: 1, ease: "expo" },
    { t: 41.9, y: 6, rotateZ: -6 },
  ]);
  track("#miniPhone", [
    { t: 38.5, opacity: 0, x: 170, y: 40, rotateZ: 11, scale: 0.95 },
    { t: 39.35, opacity: 1, x: 0, y: 0, rotateZ: 5, scale: 1, ease: "expo" },
    { t: 41.9, y: -5, rotateZ: 5 },
  ]);
  stagger(".a4-labels span", 39.45, 0.1, { y: 12, dur: 0.6 });
  track("#a4Stackline", [
    { t: 39.8, opacity: 0, y: 10 },
    { t: 40.35, opacity: 1, y: 0, ease: "expo" },
  ]);

  /* ============================================================
     ACT 5 — FEATURES
     ============================================================ */
  track("#act5", [
    { t: 42.75, opacity: 0 },
    { t: 43.2, opacity: 1 },
  ]);
  track("#a5Features", [
    { t: 42.9, opacity: 0, y: 24 },
    { t: 43.55, opacity: 1, y: 0, ease: "expo" },
    { t: 46.65, opacity: 1, y: 0 },
    { t: 47.2, opacity: 0, y: -26, ease: "inOut" },
  ]);
  track("#a5Headline .mask > span", [
    { t: 43.1, y: 90 },
    { t: 43.95, y: 0, ease: "expo" },
  ]);
  track(".a5-copy .eyebrow", [
    { t: 43.0, opacity: 0, y: 12 },
    { t: 43.55, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".a5-copy .lede", [
    { t: 43.45, opacity: 0, y: 14 },
    { t: 44.0, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#a5Stats", [
    { t: 43.9, opacity: 0, y: 14 },
    { t: 44.45, opacity: 1, y: 0, ease: "expo" },
  ]);
  stagger(".feat", 43.6, 0.075, { y: 42, dur: 0.7, scale: 0.97, rotateX: 8 });

  /* ============================================================
     OUTRO
     ============================================================ */
  track("#a5Outro", [
    { t: 47.1, opacity: 0 },
    { t: 47.75, opacity: 1, ease: "out" },
  ]);
  track("#outroMark", [
    { t: 47.25, opacity: 0, y: 24, scale: 0.88 },
    { t: 48.0, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track("#outroEyebrow", [
    { t: 47.75, opacity: 0, y: 10 },
    { t: 48.25, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroTitle .mask > span", [
    { t: 47.8, y: 130 },
    { t: 48.75, y: 0, ease: "expo" },
  ]);
  track("#outroSub", [
    { t: 48.35, opacity: 0, y: 14 },
    { t: 48.95, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroUrl", [
    { t: 48.6, opacity: 0, y: 18, scale: 0.97 },
    { t: 49.25, opacity: 1, y: 0, scale: 1, ease: "expo" },
  ]);
  track("#outroNote", [
    { t: 49.15, opacity: 0, y: 10 },
    { t: 49.65, opacity: 1, y: 0, ease: "expo" },
  ]);
  track(".outro-foot", [
    { t: 49.35, opacity: 0 },
    { t: 49.9, opacity: 1, ease: "out" },
  ]);
  track("#outroDevices", [
    { t: 50.05, opacity: 0, y: 14 },
    { t: 50.65, opacity: 1, y: 0, ease: "expo" },
  ]);
  track("#outroSweep", [
    { t: 50.2, opacity: 0, "--sweep-x": -120 },
    { t: 50.6, opacity: 0.8, "--sweep-x": -10, ease: "out" },
    { t: 51.6, opacity: 0, "--sweep-x": 290, ease: "inOut" },
    { t: 52.2, opacity: 0, "--sweep-x": -120 },
    { t: 52.6, opacity: 0.5, "--sweep-x": -10, ease: "out" },
    { t: 53.5, opacity: 0, "--sweep-x": 290, ease: "inOut" },
  ]);
  track(".a5-outro", [
    { t: 52.5, scale: 1, y: 0 },
    { t: 54, scale: 1.014, y: -6, ease: "linear" },
  ]);

  /* ============================================================
     BACKGROUNDS
     ============================================================ */
  track(".bg--intro", [{ t: 0, opacity: 1 }, { t: 6.7, opacity: 1 }, { t: 7.6, opacity: 0 }]);
  track(".bg--bright", [
    { t: 6.6, opacity: 0 },
    { t: 7.5, opacity: 1 },
    { t: 23.2, opacity: 1 },
    { t: 24.0, opacity: 0 },
  ]);
  track(".bg--night", [
    { t: 23.3, opacity: 0 },
    { t: 24.1, opacity: 1 },
    { t: 33.1, opacity: 1 },
    { t: 33.9, opacity: 0 },
  ]);
  track(".bg--warm", [
    { t: 33.2, opacity: 0 },
    { t: 34.0, opacity: 1 },
    { t: 42.7, opacity: 1 },
    { t: 43.5, opacity: 0 },
  ]);
  track(".bg--features", [
    { t: 42.8, opacity: 0 },
    { t: 43.6, opacity: 1 },
    { t: 47.1, opacity: 1 },
    { t: 47.9, opacity: 0 },
  ]);
  track(".bg--outro", [{ t: 47.2, opacity: 0 }, { t: 48.0, opacity: 1 }]);
  track(".bg-plus--intro", [
    { t: 0.3, opacity: 0 },
    { t: 1.4, opacity: 0.24 },
    { t: 6.4, opacity: 0.24 },
    { t: 7.2, opacity: 0 },
  ]);
  track(".bg-plus--bright", [
    { t: 6.8, opacity: 0 },
    { t: 7.6, opacity: 0.34 },
    { t: 23.2, opacity: 0.34 },
    { t: 23.9, opacity: 0 },
    { t: 33.7, opacity: 0 },
    { t: 34.4, opacity: 0.3 },
    { t: 42.8, opacity: 0.3 },
    { t: 43.4, opacity: 0 },
  ]);
  track(".bg-plus--dark", [
    { t: 23.6, opacity: 0 },
    { t: 24.3, opacity: 0.26 },
    { t: 33.1, opacity: 0.26 },
    { t: 33.8, opacity: 0 },
    { t: 43.0, opacity: 0 },
    { t: 43.6, opacity: 0.24 },
    { t: 47.3, opacity: 0.24 },
    { t: 48.0, opacity: 0 },
  ]);
  track(".aurora--a", [
    { t: 0, x: -40, y: 0, scale: 1 },
    { t: 18, x: 90, y: 40, scale: 1.15, ease: "inOut" },
    { t: 36, x: -20, y: 10, scale: 1.05, ease: "inOut" },
    { t: 54, x: 60, y: -30, scale: 1.2, ease: "inOut" },
  ]);
  track(".aurora--b", [
    { t: 0, x: 30, y: 0, scale: 1 },
    { t: 22, x: -80, y: 30, scale: 1.1, ease: "inOut" },
    { t: 44, x: 40, y: -20, scale: 1.2, ease: "inOut" },
    { t: 54, x: -40, y: 20, scale: 1.05, ease: "inOut" },
  ]);
  track(".aurora--c", [
    { t: 0, x: 0, y: 20, scale: 1 },
    { t: 26, x: -60, y: -20, scale: 1.15, ease: "inOut" },
    { t: 54, x: 40, y: 0, scale: 1.05, ease: "inOut" },
  ]);

  /* ============================================================
     TRANSITIONS
     ============================================================ */
  const flareAt = (t0, peak, scale) => {
    track("#flare", [
      { t: t0, opacity: 0 },
      { t: t0 + (peak || 0.25), opacity: 1, ease: "out" },
      { t: t0 + 0.95, opacity: 0, ease: "inOut" },
    ]);
    track("#flare span", [
      { t: t0, scale: 0.2 },
      { t: t0 + 0.9, scale: scale || 3.4, ease: "inOut" },
    ]);
  };
  flareAt(6.55, 0.22, 4.4);
  flareAt(23.35, 0.2, 3.4);
  flareAt(33.25, 0.22, 3.8);
  flareAt(42.8, 0.2, 3.6);
  flareAt(47.05, 0.24, 4.2);

  track("#flashCut", [
    { t: 6.62, opacity: 0 },
    { t: 6.76, opacity: 0.4, ease: "out" },
    { t: 6.84, opacity: 0.4 },
    { t: 7.18, opacity: 0, ease: "inOut" },
    { t: 23.48, opacity: 0 },
    { t: 23.6, opacity: 0.32, ease: "out" },
    { t: 23.68, opacity: 0.32 },
    { t: 24.02, opacity: 0, ease: "inOut" },
    { t: 33.4, opacity: 0 },
    { t: 33.52, opacity: 0.32, ease: "out" },
    { t: 33.6, opacity: 0.32 },
    { t: 33.94, opacity: 0, ease: "inOut" },
    { t: 42.86, opacity: 0 },
    { t: 42.98, opacity: 0.3, ease: "out" },
    { t: 43.06, opacity: 0.3 },
    { t: 43.4, opacity: 0, ease: "inOut" },
    { t: 47.1, opacity: 0 },
    { t: 47.22, opacity: 0.36, ease: "out" },
    { t: 47.3, opacity: 0.36 },
    { t: 47.64, opacity: 0, ease: "inOut" },
  ]);

  track("#wipe", [
    { t: 6.6, opacity: 0, "--wipe-x": -130 },
    { t: 6.78, opacity: 0.9, "--wipe-x": -30, ease: "out" },
    { t: 7.45, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 23.3, opacity: 0, "--wipe-x": -130 },
    { t: 23.5, opacity: 0.75, "--wipe-x": -60, ease: "out" },
    { t: 24.25, opacity: 0, "--wipe-x": 170, ease: "inOut" },
    { t: 33.2, opacity: 0, "--wipe-x": -130 },
    { t: 33.4, opacity: 0.55, "--wipe-x": -40, ease: "out" },
    { t: 34.1, opacity: 0, "--wipe-x": 170, ease: "inOut" },
  ]);
  track("#globalSweep", [
    { t: 11.5, opacity: 0, "--sweep-x": -100 },
    { t: 12.0, opacity: 0.34, "--sweep-x": -20, ease: "out" },
    { t: 13.2, opacity: 0, "--sweep-x": 270, ease: "inOut" },
    { t: 26.0, opacity: 0, "--sweep-x": -100 },
    { t: 26.5, opacity: 0.22, "--sweep-x": -20, ease: "out" },
    { t: 27.8, opacity: 0, "--sweep-x": 270, ease: "inOut" },
    { t: 38.6, opacity: 0, "--sweep-x": -100 },
    { t: 39.1, opacity: 0.28, "--sweep-x": -20, ease: "out" },
    { t: 40.4, opacity: 0, "--sweep-x": 270, ease: "inOut" },
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

  buildParticles($("#particles"), 34, {
    x: [-40, 1960], y: [-60, 1140], speed: [6, 18], env: globalEnv,
  });
  buildParticles($("#a1Particles"), 18, {
    x: [700, 1220], y: [280, 850], speed: [8, 22], env: a1Env,
  });
  buildParticles($("#outroParticles"), 22, {
    x: [520, 1400], y: [200, 940], speed: [5, 14], env: outroEnv,
  });

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
  let lastTyped = null;

  function setStates(t) {
    dUI.classList.toggle("is-article", t >= 16.15);
    pUI.classList.toggle("is-article", t >= 29.1);
    tUI.classList.toggle("is-map", t >= 36.3);
    if (a4Family) a4Family.classList.toggle("is-live", t >= 37.9);
    stage.classList.toggle("is-ended", t >= 53.75);
    let idx = 0;
    if (t >= 18.9) idx = 1;
    if (t >= 19.8) idx = 2;
    tocLinks.forEach((a, i) => a.classList.toggle("is-active", i === idx));
    const dark = t >= 20.98;
    if (appearanceAuto) appearanceAuto.classList.toggle("is-checked", !dark);
    if (appearanceDark) appearanceDark.classList.toggle("is-checked", dark);
  }

  function extras(t) {
    const q = "city roles";
    let n = 0;
    if (t >= 14.2) n = Math.min(q.length, Math.floor((t - 14.2) * 10.5) + 1);
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
    applyTimeline(t);
    setStates(t);
    extras(t);
    drawParticles(t);
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
    { t: 0, label: "Brand" },
    { t: 7, label: "Desktop" },
    { t: 23.6, label: "Mobile" },
    { t: 33.6, label: "Devices" },
    { t: 43, label: "Features" },
    { t: 47.2, label: "Launch" },
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
    lastTypeTick = Math.floor(t * 11);
    lastPulse = Math.floor((t - 7) / 1.5);
    lastArp = Math.floor((t - 7) / 1.8);
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
    { t: 0.45, fn: () => sfxBoom(0.25) },
    { t: 6.72, fn: () => sfxWhoosh(1.1, 0.14, 180, 2800) },
    { t: 7.25, fn: () => sfxBoom(0.12) },
    { t: 13.46, fn: () => sfxClick(0.07) },
    { t: 15.5, fn: () => sfxClick(0.06) },
    { t: 16.45, fn: () => sfxChime(523.25, 0.045) },
    { t: 20.99, fn: () => sfxClick(0.065) },
    { t: 21.18, fn: () => sfxChime(659.25, 0.03) },
    { t: 23.5, fn: () => sfxWhoosh(0.95, 0.13, 160, 2400) },
    { t: 25.55, fn: () => sfxBoom(0.07) },
    { t: 27.15, fn: () => sfxClick(0.045) },
    { t: 28.3, fn: () => sfxClick(0.04) },
    { t: 29.06, fn: () => sfxClick(0.05) },
    { t: 33.42, fn: () => sfxWhoosh(0.95, 0.13, 180, 2600) },
    { t: 35.45, fn: () => sfxBoom(0.07) },
    { t: 36.5, fn: () => sfxWhoosh(0.7, 0.06, 300, 1800) },
    { t: 39.15, fn: () => sfxChime(392, 0.032) },
    { t: 42.9, fn: () => sfxWhoosh(0.9, 0.13, 160, 2400) },
    { t: 47.18, fn: () => sfxWhoosh(1.0, 0.14, 200, 3200) },
    { t: 48.1, fn: () => { sfxBoom(0.15); sfxChime(523.25, 0.055); } },
    { t: 50.1, fn: () => sfxChime(659.25, 0.045) },
  ];

  function audioFrame(prev, next) {
    if (!audioOn || !audio || next < prev) return;
    const ci = chapterAt(next);
    if (ci !== audioChapter) {
      audioChapter = ci;
      setChord(ci);
    }
    for (const cue of AUDIO_CUES) {
      if (prev < cue.t && next >= cue.t) cue.fn();
    }
    if (next >= 7 && next < 47.2) {
      const beat = Math.floor((next - 7) / 1.5);
      if (beat !== lastPulse) {
        lastPulse = beat;
        sfxPulse();
      }
      const arp = Math.floor((next - 7) / 1.8);
      if (arp !== lastArp) {
        lastArp = arp;
        const chord = CHORDS[clamp(ci, 0, CHORDS.length - 1)];
        const pattern = [1, 2, 3, 2, 1, 3];
        sfxPluck(chord[pattern[arp % pattern.length]] * 2);
      }
    }
    if (next >= 14.15 && next <= 15.15) {
      const k = Math.floor(next * 11);
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
      }, 650);
      setTimeout(() => loader.remove(), 1500);
    }
    if (!previewPaused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTimeout(() => play(), 550);
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
