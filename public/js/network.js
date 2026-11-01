// 네트워크 지도 (캔버스)
// 명부에 오른 사람(동문·학술회 참가자)을 점으로, "한쪽이 필요한 것을 다른 쪽이 줄 수 있는" 관계를 선으로 그립니다.
// d3(전역)는 index.html 에서 먼저 불러옵니다.

import { offersOf, needsOf, fnsOf, fnTokens, fnText, helpLabel, cohortLabel, cohortNum } from './model.js';

const FONT = "'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif";
const ST = { bg: '#0b0a13', ink: '#eeeaf6', muted: '#9c97ad', spark: '#fff6f8', mint: '#4fd8b8', gold: '#e2bd6e', halo: 'rgba(11,10,19,.9)' };
// 점 색: 졸업생 빨강, 재학생 파랑, 학술회 참가자 보라 (선은 두 사람 색을 이어 그라데이션)
const TC = { grad: '255,79,110', student: '58,150,255', conf: '170,104,255' };
const rgb = (c, a) => `rgba(${c},${a == null ? 1 : a})`;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inter = (a, b) => (a || []).filter(x => (b || []).includes(x));
const CONF = 'conf';
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
  const { members, meUid, dict, onProfile, onIntro, onSelect, initialSel, demo, wheelZoom, intro } = opts;
  const { IND, FN, HELP } = dict;
  const d3 = window.d3;
  if (!d3) { root.innerHTML = '<p class="hint">지도를 불러오지 못했습니다. 페이지를 새로고침해 주세요.</p>'; return { destroy() {} }; }
  const ac = new AbortController(), on = { signal: ac.signal };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const H_ = arr => (arr || []).map(helpLabel);

  /* ---------- 데이터 ---------- */
  // offer/need 는 '기타' 글까지 토큰으로, fn 은 묶음용 대표 직무(첫째), fnT 는 비교용 전체, cx 는 기수(추정 포함)
  const people = members.map((m, i) => ({ ...m, id: i, me: m.uid === meUid, offer: offersOf(m), need: needsOf(m),
    fn: fnsOf(m)[0] || 'etc', fnT: fnTokens(m), cx: m.type === CONF ? null : cohortNum(m), lab: cohortLabel(m) }));
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
  people.forEach(p => { p.c = TC[p.type] || TC.grad; p.r = Math.min(18, 2.6 + Math.pow(p.deg, 1.25) * .75) + (p.me ? 1 : 0); p.ph = hash01(p.uid) * Math.PI * 2; });
  const HUBS = people.filter(p => p.deg > 0).sort((a, b) => b.deg - a.deg).slice(0, 8);
  const links = REC.map(e => ({ source: e.a, target: e.b }));
  const R = rng(7), order = people.slice();
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const x = order[i]; order[i] = order[j]; order[j] = x; }
  const step = Math.min(.03, .9 / Math.max(1, people.length));
  order.forEach((p, i) => { p.appear = .15 + i * step; });
  const labelAll = people.length <= 40;
  const cohorts = people.map(p => p.cx).filter(Boolean);
  const cMin = Math.min(1, ...cohorts), cMax = Math.max(2, ...cohorts);
  const hasConf = people.some(p => p.type === CONF);

  /* ---------- 화면 틀 ---------- */
  root.innerHTML = `<section class="nv-stage" aria-label="라운지 네트워크 지도">
    <div class="nv-viz">
      <canvas class="nv-cv" role="img" aria-label="라운지에 등록된 ${people.length}명을 점으로, 서로 도울 수 있는 사람을 선으로 이은 지도. 같은 내용을 오른쪽 패널과 명부에서 볼 수 있습니다."></canvas>
      <div class="nv-ov nv-top">
        <div class="nv-pills nv-glass" role="group" aria-label="보기 방식">
          <button data-mode="net" aria-pressed="true">연결망</button><button data-mode="industry" aria-pressed="false">업종별</button><button data-mode="fn" aria-pressed="false">직무별</button><button data-mode="cohort" aria-pressed="false">기수순</button>
        </div>
        <div class="nv-search"><label class="sr-only" for="nv-q">사람 찾기</label><input id="nv-q" class="nv-glass" type="search" placeholder="이름, 회사, 직책으로 찾기" autocomplete="off"><ul class="nv-sugg nv-glass" hidden></ul></div>
      </div>
      <div class="nv-ov nv-bot">
        <div class="nv-legend nv-glass" role="group" aria-label="연결선 종류"></div>
        <div class="nv-zoom nv-glass" role="group" aria-label="확대와 축소"><button data-nact="zin" aria-label="확대">+</button><button data-nact="zout" aria-label="축소">−</button><button data-nact="fit" aria-label="전체 보기">⤢</button></div>
      </div>
      <div class="nv-tip nv-glass" hidden></div>
      ${people.length < 3 ? `<div class="nv-empty nv-glass"><b>아직 등록된 사람이 ${people.length}명이에요</b><span>사람이 늘어날수록 이 지도에 연결이 생깁니다. 동문과 학술회 참가자에게 라운지를 알려 주세요.</span></div>` : ''}
    </div>
    <aside class="nv-panel nv-glass" aria-live="polite"></aside>
  </section>`;
  const q = s => root.querySelector(s);
  const viz = q('.nv-viz'), cv = q('.nv-cv'), ctx = cv.getContext('2d'), tip = q('.nv-tip'), panel = q('.nv-panel');
  const bgc = document.createElement('canvas');
  const GLOW = { spark: sprite('255,236,242') }; Object.values(TC).forEach(c => { GLOW[c] = sprite(c); });

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
      // 넓은 화면일수록 사람 사이를 벌려 지도가 화면을 채우게 함
      const n = Math.max(1, people.length), k = Math.max(1, Math.min(3, Math.sqrt(aw * ah / n) / 48, .8 * Math.min(aw, ah) / (30 * Math.sqrt(n))));
      // 연결이 적은 사람은 허브 가까이(별 모양), 허브끼리는 서로 밀어 무리가 갈라지게
      sim.force('link', d3.forceLink(links).distance(l => 40 * k * (Math.min(l.source.deg, l.target.deg) <= 1 ? .7 : 1.2)).strength(.3))
        .force('charge', d3.forceManyBody().strength(d => -26 * k * (1 + d.deg * .3)).distanceMax(260 * k))
        .force('x', d3.forceX(cx).strength(.05))
        .force('y', d3.forceY(cy).strength(.05 * Math.max(1, aw / ah)));
    } else if (S.mode === 'cohort') {
      const right = hasConf ? 110 : 46;
      const sx = c => x0 + 46 + (c - cMin) / (cMax - cMin) * (aw - 46 - right);
      const xConf = x1 - 52;
      sim.force('x', d3.forceX(d => (d.cx ? sx(d.cx) : xConf)).strength(.55)).force('y', d3.forceY(cy - 14).strength(.06)).force('charge', d3.forceManyBody().strength(-5));
      const span = cMax - cMin, st = span <= 10 ? 1 : span <= 25 ? 5 : 10, ticks = [cMin];
      for (let t = Math.ceil((cMin + 1) / st) * st; t < cMax; t += st) ticks.push(t);
      ticks.push(cMax);
      AX = { sx, y: y1 - 10, ticks: [...new Set(ticks)], conf: hasConf ? xConf : null };
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
    const cx = (AREA.x0 + AREA.x1) / 2, cy = (AREA.y0 + AREA.y1) / 2, M = Math.max(W, H);
    const glow = (x, y, rad, c, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgb(c, a)); gr.addColorStop(1, rgb(c, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
    glow(cx - (AREA.x1 - AREA.x0) * .22, cy + (AREA.y1 - AREA.y0) * .1, M * .42, TC.student, .10);
    glow(cx + (AREA.x1 - AREA.x0) * .2, cy - (AREA.y1 - AREA.y0) * .15, M * .4, TC.grad, .09);
    glow(cx, cy, M * .3, TC.conf, .06);
    // 장식용 흐릿한 연결망과 큰 호(실제 데이터 아님)
    const r = rng(11), pts = [];
    for (let i = 0; i < 150; i++) pts.push([r() * W, r() * H, r()]);
    g.strokeStyle = '#d8d4ea'; g.lineWidth = .6;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i]; let n = 0;
      for (let j = i + 1; j < pts.length && n < 2; j++) {
        const [x2, y2] = pts[j], d = Math.hypot(x2 - x, y2 - y);
        if (d < 160) { n++; g.globalAlpha = .07 + (1 - d / 160) * .08; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + x2) / 2 - (y2 - y) * .25, (y + y2) / 2 + (x2 - x) * .25, x2, y2); g.stroke(); }
      }
    }
    g.fillStyle = '#d8d4ea';
    for (const [x, y, z] of pts) { g.globalAlpha = .16 + z * .2; g.beginPath(); g.arc(x, y, .8 + z * 1.4, 0, 7); g.fill(); }
    g.lineWidth = .7;
    for (let i = 0; i < 8; i++) { g.globalAlpha = .05 + r() * .04; g.beginPath(); g.arc(r() * W, r() * H, M * (.25 + r() * .5), r() * 7, r() * 7 + 1.4 + r() * 2); g.stroke(); }
    g.globalAlpha = 1;
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, M * .8);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  /* ---------- 확대 ---------- */
  const zoom = d3.zoom().scaleExtent([.6, 5]).clickDistance(5)
    .filter(ev => ev.type === 'wheel' ? (ev.ctrlKey || ev.metaKey || (wheelZoom && wide)) : ev.type.startsWith('touch') ? ev.touches.length > 1 : !ev.button)
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
      fn: people.filter(o => o !== p && inter(o.fnT, p.fnT).some(k => k !== 'etc')),
      industry: people.filter(o => o !== p && o.industry === p.industry && p.industry !== 'etc'),
      cohort: people.filter(o => o !== p && (p.type === CONF ? o.type === CONF : (p.cx && o.cx === p.cx)))
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
  // 두 사람 색을 잇는 그라데이션 곡선(비즈니스 매칭)
  function strokeGrad(pairs, alpha, lw) {
    if (!pairs.length || alpha <= 0) return;
    ctx.lineWidth = lw; ctx.globalAlpha = alpha;
    for (const pr of pairs) {
      const a = pr[0], b = pr[1], c = ctrl(a, b), gr = ctx.createLinearGradient(a.dx, a.dy, b.dx, b.dy);
      gr.addColorStop(0, rgb(a.c)); gr.addColorStop(1, rgb(b.c));
      ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(a.dx, a.dy); ctx.quadraticCurveTo(c[0], c[1], b.dx, b.dy); ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
      ctx.globalAlpha = .5 * f; ctx.drawImage(GLOW.spark, x - 8 / k, y - 8 / k, 16 / k, 16 / k);
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
      if (AX.conf) { ctx.fillText('학술회', AX.conf, AX.y + 5 / k); }
      ctx.textAlign = 'left'; ctx.fillText('입학 기수 · 1기는 1998년 · 기수를 모르면 입학 연도로 배치', AX.sx(cMin), AX.y - 20 / k);
    }
    ctx.globalAlpha = 1;

    if (S.show.m) strokeGrad(recPairs, (sel ? .06 : hov ? .22 : .5) * eA, 1.1 / k);
    if (!sel && hov && S.show.m) strokeGrad(REC.filter(e => e.a === hov || e.b === hov).map(e => [e.a, e.b]), .95 * eA, 1.8 / k);
    if (sel) {
      if (S.show.industry) strokeSet(PEERS.industry.map(o => [sel, o]), ST.ink, .22, 1 / k);
      if (S.show.cohort) strokeSet(PEERS.cohort.map(o => [sel, o]), ST.ink, .75, 1.4 / k, [1.2 / k, 4 / k]);
      if (S.show.fn) strokeSet(PEERS.fn.map(o => [sel, o]), ST.mint, .7, 1.3 / k);
      if (S.show.m) strokeGrad(STAR.map(s => [s.a, s.b]), .95, 1.9 / k);
    }
    if (S.show.m && !reduce && el > 1.7) { stepParticles(dt); drawParticles(k); }

    for (const p of people) {
      if (p.ia <= 0) continue;
      let a = p.ia;
      if (sel) a *= (p === sel || SELSET.has(p)) ? 1 : .15;
      else if (hov) a *= (p === hov || hov.recN.has(p)) ? 1 : .42;
      const r = p.r * (p === hov ? 1.3 : 1) * (.35 + .65 * p.ia);
      if (!sel && p.deg >= 3) { const gs = r * (p.deg >= 6 ? 6 : 4); ctx.globalAlpha = a * (p.deg >= 6 ? .55 : .35); ctx.drawImage(GLOW[p.c], p.dx - gs, p.dy - gs, gs * 2, gs * 2); }
      ctx.globalAlpha = a; ctx.fillStyle = rgb(p.c);
      ctx.beginPath(); ctx.arc(p.dx, p.dy, r, 0, 7); ctx.fill();
      if (p.me) { ctx.strokeStyle = ST.gold; ctx.lineWidth = 1.5 / k; ctx.beginPath(); ctx.arc(p.dx, p.dy, r + 3, 0, 7); ctx.stroke(); }
      if (p === hov) { ctx.strokeStyle = ST.ink; ctx.lineWidth = 1.2 / k; ctx.globalAlpha = a * .7; ctx.beginPath(); ctx.arc(p.dx, p.dy, r + 4.5, 0, 7); ctx.stroke(); }
    }
    if (sel) {
      const r = sel.r * 1.35;
      ctx.globalAlpha = .85; ctx.drawImage(GLOW[sel.c], sel.dx - r * 7, sel.dy - r * 7, r * 14, r * 14);
      if (!reduce) for (let i = 0; i < 2; i++) { const ph = (el * .62 + i * .5) % 1; ctx.globalAlpha = (1 - ph) * .55; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2 / k; ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r + 3 + ph * 26, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = rgb(sel.c); ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6 / k; ctx.beginPath(); ctx.arc(sel.dx, sel.dy, r + 1.5 / k, 0, 7); ctx.stroke();
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
    tip.innerHTML = `<b>${esc(p.name)}</b> <span>${esc(p.lab)} · ${esc(IND[p.industry] || '')}</span><br>${esc(p.org)} <span>${esc(p.title)}</span>`;
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
    const st = { m: 'stroke:url(#nv-mg);stroke-width:2.4', fn: `stroke:${ST.mint};stroke-width:2`, industry: `stroke:${ST.ink};stroke-width:1.4;opacity:.5`, cohort: `stroke:${ST.ink};stroke-width:2;stroke-dasharray:1.2 4` }[t];
    return `<svg class="nv-sw" width="22" height="8" viewBox="0 0 22 8" aria-hidden="true">${t === 'm' ? `<defs><linearGradient id="nv-mg" gradientUnits="userSpaceOnUse" x1="2" y1="0" x2="20" y2="0"><stop offset="0" stop-color="${rgb(TC.grad)}"/><stop offset="1" stop-color="${rgb(TC.student)}"/></linearGradient></defs>` : ''}<line x1="2" y1="4" x2="20" y2="4" style="${st};stroke-linecap:round"/>${t === 'm' ? `<circle cx="13" cy="4" r="2.2" style="fill:${ST.spark}"/>` : ''}</svg>`;
  };
  const chips = (arr, c) => `<div class="nv-chips">${H_(arr).map(x => `<span class="nv-chip ${c}">${esc(x)}</span>`).join('')}</div>`;
  const row = (o, why) => `<button class="nv-row" data-nact="sel" data-uid="${o.uid}"><span class="nv-pn">${esc(o.name)}${o.me ? ' (나)' : ''}<i>${esc(o.lab)} · ${esc(o.org)}</i></span><span class="nv-pw">${esc(why)}</span></button>`;
  const nameBtns = (list, max) => list.slice(0, max).map(o => `<button class="nv-nm" data-nact="sel" data-uid="${o.uid}">${esc(o.name)}</button>`).join('') + (list.length > max ? `<span class="nv-more">외 ${list.length - max}명</span>` : '');
  function renderPanel() {
    const p = S.sel, me = byUid.get(meUid);
    if (!p) {
      const nc = {}; people.forEach(o => o.need.forEach(h => { nc[h] = (nc[h] || 0) + 1; }));
      const top = Object.entries(nc).sort((a, b) => b[1] - a[1]).slice(0, 4), mx = top.length ? top[0][1] : 1;
      panel.innerHTML = `${intro || ''}<p class="nv-k">${demo ? 'EXAMPLE NETWORK' : 'ALUMNI NETWORK'}</p>
        <h2>${people.length}명,<br>추천 매칭 ${REC.length}쌍</h2>
        <p class="nv-d">점 하나가 한 사람이고, 선은 한쪽이 필요한 것을 다른 쪽이 줄 수 있는 두 사람이에요. 빛이 흐르는 방향으로 도움이 갑니다.</p>
        <p class="nv-d">점을 누르면 그 사람을 중심으로 보여 줍니다. ${wheelZoom && window.matchMedia('(min-width: 980px)').matches ? '스크롤하면 확대·축소돼요.' : '확대하려면 ⌘ 또는 Ctrl을 누른 채 스크롤하세요.'}</p>
        ${me ? `<section class="nv-sec"><h3>나를 도울 수 있는 사람<b>${me.helpers.length}명</b></h3>
          ${me.helpers.slice(0, 3).map(o => row(o, H_(inter(o.offer, me.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다. 사람이 늘거나 ‘필요한 것’을 바꾸면 생깁니다.</span>'}
          <div class="nv-actions"><button class="nv-btn" data-nact="center-me">나를 중심으로 보기</button>${demo ? '' : '<a class="nv-btn" href="#/match">시너지 추천 보기</a>'}</div></section>` : ''}
        ${top.length ? `<section class="nv-sec"><h3>가장 많이 찾는 도움</h3>${top.map(([h, c]) => `<div class="nv-bar"><span>${esc(helpLabel(h))}</span><span class="nv-tr"><i style="--w:${(c / mx * 100).toFixed(1)}%"></i></span><b>${c}명</b></div>`).join('')}</section>` : ''}
        <p class="nv-note"><span class="nv-ring" aria-hidden="true"></span><span>${demo ? '금색 테두리가 고른 예시 인물(나)입니다.' : '금색 테두리가 나입니다.'}</span></p>`;
    } else {
      const self = p.uid === meUid;
      panel.innerHTML = `<div class="nv-ptop"><span class="nv-k">${self ? 'MY NETWORK' : 'ALUMNI'}</span><button class="nv-close" data-nact="clear">전체 보기</button></div>
        <h2>${esc(p.name)}${self ? ' <span class="nv-me">나</span>' : ''}</h2>
        <p class="nv-meta">${esc(p.lab)} · ${esc(IND[p.industry] || '')} · ${esc(fnText(p))}</p>
        <p class="nv-org">${esc(p.org)}<br><span>${esc(p.title)}</span></p>
        ${(p.career || []).length ? `<p class="nv-d">경력 · ${esc(p.career.join(' / '))}</p>` : ''}
        ${p.intro ? `<p class="nv-d">${esc(p.intro)}</p>` : ''}
        <div class="nv-give"><div><h4>줄 수 있는 것</h4>${chips(p.offer, 'give')}</div><div><h4>필요한 것</h4>${chips(p.need, 'need')}</div></div>
        <div class="nv-actions"><button class="nv-btn" data-nact="profile" data-uid="${p.uid}">프로필 보기</button>${self ? '' : `<button class="nv-btn primary" data-nact="intro" data-uid="${p.uid}">소개 요청</button>`}</div>
        <section class="nv-sec"><h3>${swatch('m')}도움받을 수 있는 사람<b>${p.helpers.length}명</b></h3>${p.helpers.length > 6 ? '<p class="nv-h">지도에는 추천 순서대로 6명까지 선으로 보입니다.</p>' : ''}${p.helpers.slice(0, 5).map(o => row(o, H_(inter(o.offer, p.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다</span>'}</section>
        <section class="nv-sec"><h3>${swatch('m')}도움 줄 수 있는 사람<b>${p.helps.length}명</b></h3>${p.helps.slice(0, 5).map(o => row(o, H_(inter(p.offer, o.need)).join(', '))).join('') || '<span class="nv-more">아직 없습니다</span>'}</section>
        <section class="nv-sec"><h3>${swatch('fn')}같은 직무 · ${esc(fnText(p))}<b>${PEERS.fn.length}명</b></h3><div class="nv-names">${PEERS.fn.length ? nameBtns(PEERS.fn, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>
        <section class="nv-sec"><h3>${swatch('industry')}같은 업종 · ${esc(IND[p.industry] || '')}<b>${PEERS.industry.length}명</b></h3><div class="nv-names">${PEERS.industry.length ? nameBtns(PEERS.industry, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>
        <section class="nv-sec"><h3>${swatch('cohort')}${p.type === CONF ? '같은 학술회 참가자' : `같은 기수 · ${esc(p.cx ? p.cx + '기' : p.lab)}`}<b>${PEERS.cohort.length}명</b></h3><div class="nv-names">${PEERS.cohort.length ? nameBtns(PEERS.cohort, 12) : '<span class="nv-more">아직 없습니다</span>'}</div></section>`;
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
    const dots = [['grad', '졸업생'], ['student', '재학생'], [CONF, '학술회 참가자']].filter(([t]) => people.some(p => p.type === t));
    q('.nv-legend').innerHTML = `<span class="nv-types">${dots.map(([t, n]) => `<span><i class="nv-dot" style="background:${rgb(TC[t])};box-shadow:0 0 8px ${rgb(TC[t], .7)}"></i>${n}</span>`).join('')}</span>` + items.map(([t, n]) => `<label><input type="checkbox" data-t="${t}" ${S.show[t] ? 'checked' : ''}>${swatch(t)}${n}</label>`).join('')
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
    results = people.filter(p => [p.name, p.org, p.title, IND[p.industry], fnText(p), p.lab].join(' ').toLowerCase().includes(v)).slice(0, 7);
    sugg.innerHTML = results.length ? results.map(p => `<li><button data-uid="${p.uid}"><b>${esc(p.name)}</b><span>${esc(p.lab)} · ${esc(p.org)}</span></button></li>`).join('') : '<li class="nv-none">찾는 사람이 없습니다</li>';
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
