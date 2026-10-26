// 네트워크 지도 (캔버스)
// 승인된 동문을 점으로, "한쪽이 필요한 것을 다른 쪽이 줄 수 있는" 관계를 선으로 그립니다.
// d3(전역)는 index.html 에서 먼저 불러옵니다.

const FONT = "'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const ST = { bg: '#110c0f', ink: '#f1e9e4', node: '#d6c9c4', me: '#f7efea', muted: '#a3949a', amber: '#c98500', spark: '#ffd88f', azure: '#4a8ce6', crimson: '#ff5d79', gold: '#d9b46a', halo: 'rgba(17,12,15,.9)' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inter = (a, b) => (a || []).filter(x => (b || []).includes(x));
const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
const ease = t => 1 - Math.pow(1 - t, 3);
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash01(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h / 4294967296; }
function sprite(rgb) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.35, `rgba(${rgb},.35)`); gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}

export function mountNetwork(root, opts) {
  const { members, meUid, dict, onProfile, onIntro, onSelect, initialSel } = opts;
  const { IND, FN, HELP } = dict;
  const d3 = window.d3;
  if (!d3) { root.innerHTML = '<p class="hint">지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>'; return { destroy() {} }; }
  const ac = new AbortController(), on = { signal: ac.signal };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const H_ = arr => (arr || []).map(k => HELP[k] || k);

  /* ---------- 데이터 ---------- */
  const people = members.map((m, i) => ({ ...m, id: i, me: m.uid === meUid, offer: m.offer || [], need: m.need || [] }));
  const byUid = new Map(people.map(p => [p.uid, p]));
  const helpsOf = (g, t) => inter(g.offer, t.need);
  const score = (g, t) => { const a = helpsOf(g, t).length, b = helpsOf(t, g).length; return a * 2 + b * 1.5 + (b ? 1 : 0) + (g.industry !== t.industry ? .4 : 0) + hash01(g.uid + t.uid) * .3; };
  people.forEach(p => {
    p.helpers = people.filter(q => q !== p && helpsOf(q, p).length).map(q => ({ q, s: score(q, p) })).sort((a, b) => b.s - a.s).map(x => x.q);
    p.helps = people.filter(q => q !== p && helpsOf(p, q).length).map(q => ({ q, s: score(p, q) })).sort((a, b) => b.s - a.s).map(x => x.q);
  });
  const EMAP = new Map(), REC = [];
  people.forEach(p => p.helpers.slice(0, 2).forEach(q => {
    const key = Math.min(p.id, q.id) + '-' + Math.max(p.id, q.id), e = EMAP.get(key);
    if (!e) { const ne = { a: q, b: p, bi: false }; EMAP.set(key, ne); REC.push(ne); }
    else if (e.a === p && e.b === q) e.bi = true;
  }));
  const RECDIR = REC.flatMap(e => e.bi ? [{ a: e.a, b: e.b, rev: false }, { a: e.a, b: e.b, rev: true }] : [{ a: e.a, b: e.b, rev: false }]);
  people.forEach(p => { p.deg = 0; p.recN = new Set(); });
  REC.forEach(e => { e.a.deg++; e.b.deg++; e.a.recN.add(e.b); e.b.recN.add(e.a); });
  people.forEach(p => { p.r = 3.4 + Math.sqrt(p.deg) * 1.3 + (p.me ? 1.2 : 0); p.ph = hash01(p.uid) * Math.PI * 2; });
  const HUBS = people.filter(p => p.deg > 0).sort((a, b) => b.deg - a.deg).slice(0, 8);
  const links = REC.map(e => ({ source: e.a, target: e.b }));
  const R = rng(7), order = people.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = order[i]; order[i] = order[j]; order[j] = x; }
  const step = Math.min(.03, .9 / Math.max(1, people.length));
  order.forEach((p, i) => { p.appear = .15 + i * step; });
  const labelAll = people.length <= 40;
  const cohorts = people.map(p => p.cohort);
  const cMin = Math.min(1, ...cohorts), cMax = Math.max(2, ...cohorts);

  /* ---------- 화면 틀 ---------- */
  root.innerHTML = `<section class="nv-stage" aria-label="동문 네트워크 지도">
    <div class="nv-viz">
      <canvas class="nv-cv" role="img" aria-label="승인된 동문 ${people.length}명을 점으로, 서로 도울 수 있는 동문을 선으로 이은 지도. 같은 내용을 오른쪽 패널과 동문 명부에서 볼 수 있습니다."></canvas>
      <div class="nv-ov nv-top">
        <div class="nv-pills nv-glass" role="group" aria-label="보기 방식">
          <button data-mode="net" aria-pressed="true">연결망</button><button data-mode="industry" aria-pressed="false">업종별</button><button data-mode="fn" aria-pressed="false">직무별</button><button data-mode="cohort" aria-pressed="false">기수순</button>
        </div>
        <div class="nv-search"><label class="sr-only" for="nv-q">동문 찾기</label><input id="nv-q" class="nv-glass" type="search" placeholder="이름, 회사, 직책으로 찾기" autocomplete="off"><ul class="nv-sugg nv-glass" hidden></ul></div>
      </div>
      <div class="nv-ov nv-bot">
        <div class="nv-legend nv-glass" role="group" aria-label="연결선 종류"></div>
        <div class="nv-zoom nv-glass" role="group" aria-label="확대와 축소"><button data-nact="zin" aria-label="확대">+</button><button data-nact="zout" aria-label="축소">−</button><button data-nact="fit" aria-label="전체 보기">⤢</button></div>
      </div>
      <div class="nv-tip nv-glass" hidden></div>
      ${people.length < 3 ? `<div class="nv-empty nv-glass"><b>아직 승인된 동문이 ${people.length}명이에요</b><span>동문이 늘어날수록 이 지도에 연결이 생깁니다. 아는 동문에게 라운지를 알려 주세요.</span></div>` : ''}
    </div>
    <aside class="nv-panel nv-glass" aria-live="polite"></aside>
  </section>`;
  const q = s => root.querySelector(s);
  const viz = q('.nv-viz'), cv = q('.nv-cv'), ctx = cv.getContext('2d'), tip = q('.nv-tip'), panel = q('.nv-panel');
  const bgc = document.createElement('canvas');
  const GLOW = { ivory: sprite('247,239,234'), crimson: sprite('255,80,112'), amber: sprite('255,196,110') };

  /* ---------- 상태 ---------- */
  const S = { mode: 'net', show: { m: true, fn: true, industry: false, cohort: false }, sel: null, hover: null };
  let STAR = [], PEERS = { fn: [], industry: [], cohort: [] }, SELSET = new Set(), parts = [];
  let W = 0, H = 0, DPR = 1, AREA = { x0: 0, x1: 0, y0: 0, y1: 0 }, wide = true, T = d3.zoomIdentity;
  let GL = [], AX = null, labelT = 0, T0 = null, last = 0, inView = true, started = false, alive = true, raf = 0, lastW = 0;

  /* ---------- 배치 ---------- */
  const sim = d3.forceSimulation(people).alphaDecay(.02).velocityDecay(.4).stop();
  function applyMode(heat) {
    const { x0, x1, y0, y1 } = AREA, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, aw = x1 - x0, ah = y1 - y0;
    GL = []; AX = null;
    sim.force('link', null).force('charge', null).force('x', null).force('y', null)
      .force('col', d3.forceCollide(d => d.r + 3.2).strength(.9));
    if (S.mode === 'net') {
      sim.force('link', d3.forceLink(links).distance(40).strength(.24))
        .force('charge', d3.forceManyBody().strength(-30).distanceMax(240))
        .force('x', d3.forceX(cx).strength(.05))
        .force('y', d3.forceY(cy).strength(.05 * Math.max(1, aw / ah)));
    } else if (S.mode === 'cohort') {
      const sx = c => x0 + 46 + (c - cMin) / (cMax - cMin) * (aw - 92);
      sim.force('x', d3.forceX(d => sx(d.cohort)).strength(.55)).force('y', d3.forceY(cy - 14).strength(.06)).force('charge', d3.forceManyBody().strength(-5));
      const span = cMax - cMin, st = span <= 10 ? 1 : span <= 25 ? 5 : 10, ticks = [cMin];
      for (let t = Math.ceil((cMin + 1) / st) * st; t < cMax; t += st) ticks.push(t);
      ticks.push(cMax);
      AX = { sx, y: y1 - 10, ticks: [...new Set(ticks)] };
    } else {
      const key = S.mode, dictK = key === 'industry' ? IND : FN;
      const keys = Object.keys(dictK).filter(k => people.some(p => p[key] === k)), C = {};
      keys.forEach((k, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, keys.length); C[k] = keys.length === 1 ? [cx, cy] : [cx + aw * .36 * Math.cos(a), cy + ah * .33 * Math.sin(a)]; });
      sim.force('x', d3.forceX(d => (C[d[key]] || [cx, cy])[0]).strength(.17)).force('y', d3.forceY(d => (C[d[key]] || [cx, cy])[1]).strength(.17)).force('charge', d3.forceManyBody().strength(-7));
      GL = keys.map(k => { const n = people.filter(p => p[key] === k).length; return { text: dictK[k], n, x: C[k][0], y: C[k][1] - (Math.sqrt(n) * 9 + 18) }; });
    }
    labelT = performance.now();
    if (reduce) { sim.stop(); for (let i = 0; i < 360; i++) sim.tick(); }
    else sim.alpha(heat).restart();
  }

  /* ---------- 크기 ---------- */
  function resize() {
    const r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    W = r.width; H = r.height; DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    wide = window.matchMedia('(min-width: 980px)').matches;
    const top = q('.nv-top').getBoundingClientRect().bottom - r.top + 10;
    const bot = r.bottom - q('.nv-bot').getBoundingClientRect().top + 8;
    AREA = { x0: 14, x1: wide ? W - 362 : W - 14, y0: Math.max(70, top), y1: H - Math.max(60, bot) };
    makeBg();
    return true;
  }
  function makeBg() {
    bgc.width = Math.max(1, Math.round(W * DPR)); bgc.height = Math.max(1, Math.round(H * DPR));
    const g = bgc.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = ST.bg; g.fillRect(0, 0, W, H);
    const cx = (AREA.x0 + AREA.x1) / 2, cy = (AREA.y0 + AREA.y1) / 2;
    let gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .62);
    gr.addColorStop(0, 'rgba(150,26,58,.32)'); gr.addColorStop(.5, 'rgba(92,16,40,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    gr = g.createRadialGradient(W * .12, H * .1, 0, W * .12, H * .1, Math.max(W, H) * .45);
    gr.addColorStop(0, 'rgba(217,180,106,.07)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const r = rng(11); g.fillStyle = '#f7efea';
    for (let i = 0; i < 240; i++) { g.globalAlpha = .03 + r() * .1; g.beginPath(); g.arc(r() * W, r() * H, .35 + r() * .85, 0, 7); g.fill(); }
    g.globalAlpha = 1;
    gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .32, W / 2, H / 2, Math.max(W, H) * .78);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  /* ---------- 확대 ---------- */
  const zoom = d3.zoom().scaleExtent([.6, 5]).clickDistance(5)
    .filter(ev => ev.type === 'wheel' ? (ev.ctrlKey || ev.metaKey) : ev.type.startsWith('touch') ? ev.touches.length > 1 : !ev.button)
    .on('zoom', ev => { T = ev.transform; tip.hidden = true; });
  d3.select(cv).call(zoom).on('dblclick.zoom', null);
  cv.style.touchAction = 'pan-x pan-y';
  const center = () => [(AREA.x0 + AREA.x1) / 2, (AREA.y0 + AREA.y1) / 2];
  function zoomTo(t, d) { d3.select(cv).transition().duration(reduce ? 0 : (d == null ? 850 : d)).ease(d3.easeCubicInOut).call(zoom.transform, t); }
  function focusOn(p) {
    const k = Math.min(2.1, Math.max(1.45, T.k)), [cx, cy] = center();
    zoomTo(d3.zoomIdentity.translate(cx - p.x * k, cy - p.y * k).scale(k));
  }

  /* ---------- 선택 ---------- */
  function computeSel() {
    const p = S.sel; SELSET = new Set(); STAR = [];
    if (!p) return;
    STAR = p.helpers.slice(0, 6).map(o => ({ a: o, b: p })).concat(p.helps.slice(0, 6).map(o => ({ a: p, b: o })));
    PEERS = {
      fn: people.filter(o => o !== p && o.fn === p.fn && p.fn !== 'etc'),
      industry: people.filter(o => o !== p && o.industry === p.industry && p.industry !== 'etc'),
      cohort: people.filter(o => o !== p && o.cohort === p.cohort)
    };
    if (S.show.m) STAR.forEach(s => { SELSET.add(s.a); SELSET.add(s.b); });
    ['fn', 'industry', 'cohort'].forEach(t => { if (S.show[t]) PEERS[t].forEach(o => SELSET.add(o)); });
  }
  function select(p, noZoom) {
    S.sel = p; parts = []; tip.hidden = true; computeSel(); renderPanel();
    if (onSelect) onSelect(p ? p.uid : null);
    if (p && !noZoom) focusOn(p);
  }
  function clearSel() { S.sel = null; STAR = []; parts = []; SELSET = new Set(); renderPanel(); if (onSelect) onSelect(null); zoomTo(d3.zoomIdentity); }

  /* ---------- 그리기 ---------- */
  function ctrl(a, b) { const dx = b.dx - a.dx, dy = b.dy - a.dy; return [(a.dx + b.dx) / 2 - dy * .16, (a.dy + b.dy) / 2 + dx * .16]; }
  function strokeSet(pairs, color, alpha, lw, dash) {
    if (!pairs.length || alpha <= 0) return;
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
    ctx.beginPath();
    for (const pr of pairs) { const a = pr[0], b = pr[1], c = ctrl(a, b); ctx.moveTo(a.dx, a.dy); ctx.quadraticCurveTo(c[0], c[1], b.dx, b.dy); }
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  function spawn() {
    const src = S.sel ? STAR : RECDIR; if (!src.length) return null;
    const e = src[Math.floor(Math.random() * src.length)];
    return { a: e.a, b: e.b, rev: !!e.rev, t: 0, sp: .17 + Math.random() * .15 };
  }
  function stepParticles(dt) {
    const target = S.sel ? Math.min(48, STAR.length * 2) : Math.min(54, RECDIR.length * 2);
    while (parts.length < target) { const n = spawn(); if (!n) break; n.t = Math.random(); parts.push(n); }
    if (parts.length > target) parts.length = target;
    for (let i = 0; i < parts.length; i++) { const p = parts[i]; p.t += p.sp * dt; if (p.t >= 1) { const n = spawn(); if (n) parts[i] = n; else p.t = 0; } }
  }
  function drawParticles(k) {
    for (const p of parts) {
      const a = p.a, b = p.b, c = ctrl(a, b), t = p.rev ? 1 - p.t : p.t, u = 1 - t;
      const x = u * u * a.dx + 2 * u * t * c[0] + t * t * b.dx, y = u * u * a.dy + 2 * u * t * c[1] + t * t * b.dy, f = Math.sin(Math.PI * p.t);
      ctx.globalAlpha = .55 * f; ctx.drawImage(GLOW.amber, x - 8 / k, y - 8 / k, 16 / k, 16 / k);
      ctx.globalAlpha = f; ctx.fillStyle = ST.spark; ctx.beginPath(); ctx.arc(x, y, 1.5 / k, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const recPairs = REC.map(e => [e.a, e.b]);
  function frame(now) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!inView || !W || T0 == null) return;
    const el = (now - T0) / 1000, dt = Math.min(.05, (now - last) / 1000); last = now;
    const k = T.k, sel = S.sel, hov = S.hover;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.drawImage(bgc, 0, 0, W, H);
    ctx.setTransform(DPR * k, 0, 0, DPR * k, DPR * T.x, DPR * T.y);
    const wob = reduce ? 0 : 1.4;
    for (const p of people) {
      p.dx = p.x + Math.sin(el * .55 + p.ph) * wob; p.dy = p.y + Math.cos(el * .47 + p.ph * 1.7) * wob;
      p.ia = reduce ? 1 : ease(clamp((el - p.appear) / .6));
    }
    const eA = reduce ? 1 : ease(clamp((el - 1.15) / 1.5));
    const la = reduce ? 1 : ease(clamp((now - labelT) / 900));

    if (GL.length) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      for (const g of GL) {
        ctx.globalAlpha = .9 * la * eA; ctx.fillStyle = ST.ink; ctx.font = `600 13px ${FONT}`; ctx.fillText(g.text, g.x, g.y);
        ctx.globalAlpha = .5 * la * eA; ctx.fillStyle = ST.muted; ctx.font = `500 11px ${FONT}`; ctx.fillText(g.n + '명', g.x, g.y + 15);
      }
    }
    if (AX) {
      ctx.globalAlpha = .55 * la; ctx.strokeStyle = ST.muted; ctx.lineWidth = 1 / k;
      ctx.beginPath(); ctx.moveTo(AX.sx(cMin), AX.y); ctx.lineTo(AX.sx(cMax), AX.y); ctx.stroke();
      ctx.fillStyle = ST.muted; ctx.font = `500 ${11 / k}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      AX.ticks.forEach(c => { const x = AX.sx(c); ctx.beginPath(); ctx.moveTo(x, AX.y); ctx.lineTo(x, AX.y - 5 / k); ctx.stroke(); ctx.fillText(c + '기', x, AX.y + 5 / k); });
      ctx.textAlign = 'left'; ctx.fillText('입학 기수 · 1기는 1998년', AX.sx(cMin), AX.y - 20 / k);
    }
    ctx.globalAlpha = 1;

    if (S.show.m) strokeSet(recPairs, ST.amber, (sel ? .06 : .3) * eA, 1 / k);
    if (!sel && hov && S.show.m) strokeSet(REC.filter(e => e.a === hov || e.b === hov).map(e => [e.a, e.b]), ST.amber, .95 * eA, 1.6 / k);
    if (sel) {
      if (S.show.industry) strokeSet(PEERS.industry.map(o => [sel, o]), ST.ink, .22, 1 / k);
      if (S.show.cohort) strokeSet(PEERS.cohort.map(o => [sel, o]), ST.ink, .75, 1.4 / k, [1.2 / k, 4 / k]);
      if (S.show.fn) strokeSet(PEERS.fn.map(o => [sel, o]), ST.azure, .75, 1.3 / k);
      if (S.show.m) strokeSet(STAR.map(s => [s.a, s.b]), ST.amber, .9, 1.7 / k);
    }
    if (S.show.m && !reduce && el > 1.7) { stepParticles(dt); drawParticles(k); }

    for (const p of people) {
      if (p.ia <= 0) continue;
      let a = p.ia;
      if (sel) a *= (p === sel || SELSET.has(p)) ? 1 : .15;
      else if (hov) a *= (p === hov || hov.recN.has(p)) ? 1 : .42;
      const r = p.r * (p === hov ? 1.3 : 1) * (.35 + .65 * p.ia);
      if (!sel && p.deg >= 4) { ctx.globalAlpha = a * .32; ctx.drawImage(GLOW.ivory, p.dx - r * 3.6, p.dy - r * 3.6, r * 7.2, r * 7.2); }
      ctx.globalAlpha = a; ctx.fillStyle = p.me ? ST.me : ST.node;
      ctx.beginPath(); ctx.arc(p.dx, p.dy, r, 0, 7); ctx.fill();
      if (p.me) { ctx.strokeStyle = ST.gold; ctx.lineWidth = 1.5 / k; ctx.beginPath(); ctx.arc(p.dx, p.dy, r + 3, 0, 7); ctx.stroke(); }
      if (p === hov) { ctx.strokeStyle = ST.ink; ctx.lineWidth = 1.2 / k; ctx.globalAlpha = a * .7; ctx.beginPath(); ctx.arc(p.dx, p.dy, r + 4.5, 0, 7); ctx.stroke(); }
    }
    if (sel) {
      const r = sel.r * 1.35;
      ctx.globalAlpha = .75; ctx.drawImage(GLOW.crimson, sel.dx - r * 6, sel.dy - r * 6, r * 12, r * 12);
      if (!reduce) for (let i = 0; i < 2; i++) { const ph = (el * .62 + i * .5) % 1; ctx.globalAlpha = (1 - ph) * .6; ctx.strokeStyle = ST.crimson; ctx.lineWidth = 1.3 / k; ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r + 3 + ph * 26, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = ST.crimson; ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r, 0, 7); ctx.fill();
      if (sel.me) { ctx.strokeStyle = ST.gold; ctx.lineWidth = 1.5 / k; ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r + 3, 0, 7); ctx.stroke(); }
    }

    const L = new Set();
    if (sel) { L.add(sel); STAR.forEach(s => { L.add(s.a); L.add(s.b); }); if (S.show.fn) PEERS.fn.slice(0, 10).forEach(o => L.add(o)); if (S.show.cohort) PEERS.cohort.forEach(o => L.add(o)); }
    else {
      if (labelAll || k >= 1.9) people.forEach(p => L.add(p));
      else HUBS.forEach(p => L.add(p));
      if (hov) { L.add(hov); hov.recN.forEach(o => L.add(o)); }
    }
    people.forEach(p => { if (p.me) L.add(p); });
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.lineJoin = 'round';
    L.forEach(p => {
      if (p.ia <= .05) return;
      const big = p === sel, fs = (big ? 14 : 11.5) / k;
      let a = p.ia * eA;
      if (sel) a *= (p === sel || SELSET.has(p) || p.me) ? 1 : 0;
      else if (hov) a *= (p === hov || hov.recN.has(p) || p.me) ? 1 : .35;
      else a *= .88;
      if (a <= .02) return;
      const y = p.dy + p.r * (big ? 1.35 : 1) + (big ? 7 : 5) / k;
      const text = p.me ? `나 · ${p.name}` : p.name;
      ctx.font = `${big || p.me ? 700 : 500} ${fs}px ${FONT}`;
      ctx.globalAlpha = a; ctx.lineWidth = 3.2 / k; ctx.strokeStyle = ST.halo; ctx.strokeText(text, p.dx, y);
      ctx.fillStyle = big ? '#ffffff' : p.me ? ST.gold : ST.ink; ctx.fillText(text, p.dx, y);
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- 마우스 ---------- */
  function hit(mx, my) {
    const x = (mx - T.x) / T.k, y = (my - T.y) / T.k; let best = null, bd = 1e9;
    for (const p of people) { if (p.dx == null) continue; const d = Math.hypot(p.dx - x, p.dy - y); if (d < p.r + 9 / T.k && d < bd) { bd = d; best = p; } }
    return best;
  }
  function showTip(p) {
    tip.innerHTML = `<b>${esc(p.name)}</b> <span>${p.cohort}기 · ${esc(IND[p.industry] || '')}</span><br>${esc(p.org)} <span>${esc(p.title)}</span>`;
    tip.hidden = false;
    const sx = T.applyX(p.dx), sy = T.applyY(p.dy), vw = viz.clientWidth;
    let x = sx + 16; const y = sy - 12;
    if (x + tip.offsetWidth > vw - 12) x = sx - tip.offsetWidth - 16;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  cv.addEventListener('pointermove', ev => {
    if (ev.pointerType === 'touch') return;
    const p = hit(ev.offsetX, ev.offsetY);
    if (p !== S.hover) { S.hover = p; cv.style.cursor = p ? 'pointer' : 'grab'; }
    if (p && p !== S.sel) showTip(p); else tip.hidden = true;
  }, on);
  cv.addEventListener('pointerleave', () => { S.hover = null; tip.hidden = true; }, on);
  cv.addEventListener('click', ev => { const p = hit(ev.offsetX, ev.offsetY); if (p) select(p); else if (S.sel) clearSel(); }, on);

  /* ---------- 오른쪽 패널 ---------- */
  const swatch = t => {
    const st = { m: `stroke:${ST.amber};stroke-width:2.4`, fn: `stroke:${ST.azure};stroke-width:2`, industry: `stroke:${ST.ink};stroke-width:1.4;opacity:.5`, cohort: `stroke:${ST.ink};stroke-width:2;stroke-dasharray:1.2 4` }[t];
    return `<svg class="nv-sw" width="22" height="8" viewBox="0 0 22 8" aria-hidden="true"><line x1="2" y1="4" x2="20" y2="4" style="${st};stroke-linecap:round"/>${t === 'm' ? `<circle cx="13" cy="4" r="2.2" style="fill:${ST.spark}"/>` : ''}</svg>`;
  };
  const chips = (arr, c) => `<div class="nv-chips">${H_(arr).map(x => `<span class="nv-chip ${c}">${esc(x)}</span>`).join('')}</div>`;
  const row = (o, why) => `<button class="nv-row" data-nact="sel" data-uid="${o.uid}"><span class="nv-pn">${esc(o.name)}${o.me ? ' (나)' : ''}<i>${o.cohort}기 · ${esc(o.org)}</i></span><span class="nv-pw">${esc(why)}</span></button>`;
  const nameBtns = (list, max) => list.slice(0, max).map(o => `<button class="nv-nm" data-nact="sel" data-uid="${o.uid}">${esc(o.name)}</button>`).join('') + (list.length > max ? `<span class="nv-more">외 ${list.length - max}명</span>` : '');
  function renderPanel() {
    const p = S.sel, me = byUid.get(meUid);
    if (!p) {
      const nc = {}; people.forEach(o => o.need.forEach(h => { nc[h] = (nc[h] || 0) + 1; }));
      const top = Object.entries(nc).sort((a, b) => b[1] - a[1]).slice(0, 4), mx = top.length ? top[0][1] : 1;
      panel.innerHTML = `<p class="nv-k">ALUMNI NETWORK</p>
        <h2>동문 ${people.length}명,<br>추천 매칭 ${REC.length}쌍</h2>
        <p class="nv-d">점을 누르면 그 동문을 중심으로 보여줍니다. 넓게 보려면 ⌘ 또는 Ctrl을 누른 채 스크롤하세요.</p>
        ${me ? `<section class="nv-sec"><h3>나를 도울 수 있는 동문<b>${me.helpers.length}명</b></h3>
          ${me.helpers.slice(0, 3).map(o => row(o, H_(inter(o.offer, me.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다. 동문이 늘거나 ‘필요한 것’을 바꾸면 생깁니다.</span>'}
          <button class="nv-btn" data-nact="center-me">나를 중심으로 보기</button></section>` : ''}
        ${top.length ? `<section class="nv-sec"><h3>동문들이 가장 많이 찾는 도움</h3>${top.map(([h, c]) => `<div class="nv-bar"><span>${esc(HELP[h] || h)}</span><span class="nv-tr"><i style="--w:${(c / mx * 100).toFixed(1)}%"></i></span><b>${c}명</b></div>`).join('')}</section>` : ''}
        <p class="nv-note"><span class="nv-ring" aria-hidden="true"></span><span>금색 테두리가 나입니다.</span></p>`;
    } else {
      const self = p.uid === meUid;
      panel.innerHTML = `<div class="nv-ptop"><span class="nv-k">${self ? 'MY NETWORK' : 'ALUMNI'}</span><button class="nv-close" data-nact="clear">전체 보기</button></div>
        <h2>${esc(p.name)}${self ? ' <span class="nv-me">나</span>' : ''}</h2>
        <p class="nv-meta">${p.cohort}기 · ${esc(IND[p.industry] || '')} · ${esc(FN[p.fn] || '')}</p>
        <p class="nv-org">${esc(p.org)}<br><span>${esc(p.title)}</span></p>
        ${p.intro ? `<p class="nv-d">${esc(p.intro)}</p>` : ''}
        <div class="nv-give"><div><h4>줄 수 있는 것</h4>${chips(p.offer, 'give')}</div><div><h4>필요한 것</h4>${chips(p.need, 'need')}</div></div>
        <div class="nv-actions"><button class="nv-btn" data-nact="profile" data-uid="${p.uid}">프로필 보기</button>${self ? '' : `<button class="nv-btn primary" data-nact="intro" data-uid="${p.uid}">소개 요청</button>`}</div>
        <section class="nv-sec"><h3>${swatch('m')}도움받을 수 있는 동문<b>${p.helpers.length}명</b></h3>${p.helpers.length > 6 ? '<p class="nv-h">지도에는 추천 순서대로 6명까지 선으로 보입니다.</p>' : ''}${p.helpers.slice(0, 5).map(o => row(o, H_(inter(o.offer, p.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다</span>'}</section>
        <section class="nv-sec"><h3>${swatch('m')}도움 줄 수 있는 동문<b>${p.helps.length}명</b></h3>${p.helps.slice(0, 5).map(o => row(o, H_(inter(p.offer, o.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다</span>'}</section>
        <section class="nv-sec"><h3>${swatch('fn')}같은 직무 · ${esc(FN[p.fn] || '')}<b>${PEERS.fn.length}명</b></h3><div class="nv-names">${PEERS.fn.length ? nameBtns(PEERS.fn, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>
        <section class="nv-sec"><h3>${swatch('industry')}같은 업종 · ${esc(IND[p.industry] || '')}<b>${PEERS.industry.length}명</b></h3><div class="nv-names">${PEERS.industry.length ? nameBtns(PEERS.industry, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>
        <section class="nv-sec"><h3>${swatch('cohort')}같은 기수 · ${p.cohort}기<b>${PEERS.cohort.length}명</b></h3><div class="nv-names">${PEERS.cohort.length ? nameBtns(PEERS.cohort, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>`;
    }
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
    if (!wide && p) panel.scrollTop = 0;
  }
  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-nact]'); if (!b) return;
    const a = b.dataset.nact, p = b.dataset.uid ? byUid.get(b.dataset.uid) : null;
    if (a === 'sel' && p) select(p);
    if (a === 'clear') clearSel();
    if (a === 'center-me' && byUid.get(meUid)) select(byUid.get(meUid));
    if (a === 'profile' && onProfile) onProfile(b.dataset.uid);
    if (a === 'intro' && onIntro) onIntro(b.dataset.uid);
  }, on);

  /* ---------- 범례·검색·보기 방식 ---------- */
  function renderLegend() {
    const items = [['m', '비즈니스 매칭'], ['fn', '같은 직무'], ['industry', '같은 업종'], ['cohort', '같은 기수']];
    q('.nv-legend').innerHTML = items.map(([t, n]) => `<label><input type="checkbox" data-t="${t}" ${S.show[t] ? 'checked' : ''}>${swatch(t)}${n}</label>`).join('')
      + `<label class="nv-me-l"><span class="nv-ring" aria-hidden="true"></span>나</label><span class="nv-lh">직무·업종·기수 선은 동문을 고르면 보입니다.</span>`;
  }
  q('.nv-legend').addEventListener('change', e => {
    const t = e.target.dataset.t; if (!t) return;
    S.show[t] = e.target.checked; parts = []; computeSel(); if (S.sel) renderPanel();
  }, on);
  root.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (S.mode === b.dataset.mode) return;
    S.mode = b.dataset.mode;
    root.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    applyMode(.9);
    if (S.sel) { const p = S.sel; setTimeout(() => { if (alive && S.sel === p) focusOn(p); }, reduce ? 0 : 1100); } else zoomTo(d3.zoomIdentity, 700);
  }, on));
  q('.nv-zoom').addEventListener('click', e => {
    const b = e.target.closest('[data-nact]'); if (!b) return;
    const c = center();
    if (b.dataset.nact === 'zin') d3.select(cv).transition().duration(reduce ? 0 : 350).call(zoom.scaleBy, 1.4, c);
    if (b.dataset.nact === 'zout') d3.select(cv).transition().duration(reduce ? 0 : 350).call(zoom.scaleBy, 1 / 1.4, c);
    if (b.dataset.nact === 'fit') zoomTo(d3.zoomIdentity, 600);
  }, on);
  const qi = q('#nv-q'), sugg = q('.nv-sugg');
  let results = [];
  qi.addEventListener('input', () => {
    const v = qi.value.trim().toLowerCase();
    if (!v) { sugg.hidden = true; results = []; return; }
    results = people.filter(p => [p.name, p.org, p.title, IND[p.industry], FN[p.fn], p.cohort + '기'].join(' ').toLowerCase().includes(v)).slice(0, 7);
    sugg.innerHTML = results.length ? results.map(p => `<li><button data-uid="${p.uid}"><b>${esc(p.name)}</b><span>${p.cohort}기 · ${esc(p.org)}</span></button></li>`).join('') : '<li class="nv-none">찾는 동문이 없습니다</li>';
    sugg.hidden = false;
  }, on);
  qi.addEventListener('keydown', e => {
    if (e.key === 'Enter' && results[0]) { e.preventDefault(); qi.value = ''; sugg.hidden = true; select(results[0]); }
    if (e.key === 'Escape') { qi.value = ''; sugg.hidden = true; }
    if (e.key === 'ArrowDown' && !sugg.hidden) { const b = sugg.querySelector('button'); if (b) { e.preventDefault(); b.focus(); } }
  }, on);
  sugg.addEventListener('click', e => { const b = e.target.closest('button[data-uid]'); if (!b) return; qi.value = ''; sugg.hidden = true; select(byUid.get(b.dataset.uid)); }, on);
  document.addEventListener('click', e => { if (!e.target.closest('.nv-search')) sugg.hidden = true; }, on);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.sel && document.activeElement !== qi && !document.querySelector('#modal:not([hidden])')) clearSel(); }, on);

  /* ---------- 시작 ---------- */
  function start() {
    if (started || !resize()) return;
    started = true; lastW = cv.clientWidth;
    const [cx, cy] = center();
    people.forEach(p => { const a = Math.random() * Math.PI * 2, r = Math.random() * 14; p.x = cx + Math.cos(a) * r; p.y = cy + Math.sin(a) * r; p.vx = 0; p.vy = 0; });
    applyMode(1);
    T0 = performance.now(); last = T0;
    const first = initialSel && byUid.get(initialSel);
    if (first) setTimeout(() => { if (alive) select(first); }, reduce ? 0 : 1500);
  }
  renderLegend(); renderPanel();
  const ro = new ResizeObserver(() => {
    if (!started) { start(); return; }
    const w = cv.clientWidth;
    if (Math.abs(w - lastW) < 2 && Math.abs(cv.clientHeight - H) < 2) return;
    lastW = w; resize(); applyMode(.35);
  });
  ro.observe(viz);
  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(viz);
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      alive = false; ac.abort(); cancelAnimationFrame(raf); sim.stop(); ro.disconnect(); io.disconnect();
      d3.select(cv).interrupt().on('.zoom', null);
    }
  };
}
