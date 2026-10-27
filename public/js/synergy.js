// 시너지 추천: 두 사람 사이에 '왜 만나면 좋은지'를 이유와 함께 계산합니다.
// 화면(app.js)은 recommend(), synergy(), companyGroups()만 씁니다.
//
// 점수 기준(높을수록 먼저 추천)
//  - 상대가 내가 필요한 것을 줄 수 있음   항목당 3점 ('기타'에 같은 말을 적은 경우 포함)
//  - 내가 상대가 필요한 것을 줄 수 있음   항목당 2점
//  - 같은 회사를 거침(현재 소속 + 주요 경력) 3점
//  - 동종업계(같은 업종)                 1.5점
//  - 논문 주제 낱말이 겹침               1.5점
//  - 같은 직무 분야(하나라도 겹침)        1점
//  - 같은 업종·직무의 선배/후배(재학생↔졸업생) 1점 / 0.5점
//  - 동문 ↔ 학술회 참가자가 같은 업종·직무   0.5점(두 모임을 잇는 연결)
//    입학 관심자에게 같은 업종·직무 동문은 1점(입학 선배), 동문에게 같은 분야 입학 관심자는 0.5점
//  - '입학·진학 상담'은 다른 주고받을 것과 같은 방식(줄 수 있음 3점 / 도울 수 있음 2점)

import { INDUSTRIES as IND } from './constants.js';
import { helps, fnTokens, fnLabel, helpLabel, inter, isProspect } from './model.js';

const q = arr => arr.map(k => `‘${helpLabel(k)}’`).join(', ');

/* ---------- 회사 이름 맞추기 ---------- */
// '식품 대기업', '프리랜서'처럼 회사 이름이 아닌 값은 같은 회사로 보지 않습니다.
const GENERIC = ['대기업', '중견기업', '중소기업', '스타트업', '프리랜서', '개인', '외국계', '공기업', '공공기관', '자영업',
  '무직', '학생', '대학원', '휴직', '퇴사', '없음', '기타', '회사원', '직장인', '에이전시', '컨설팅사', '광고대행사'];
const normCo = s => String(s || '')
  .replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\binc\b\.?|\bcorp\b\.?|\bco\.?,?\s*ltd\b\.?|\bltd\b\.?/gi, '')
  .replace(/[\s.,·()\-]/g, '').toLowerCase();
// 경력 한 줄 '회사 · 직무 · 기간'에서 회사 부분만. 구분 기호가 없으면 첫 낱말.
function firstPart(line) {
  const s = String(line || '').trim();
  const parts = s.split(/\s*[·|/,]\s*|\s+-\s+|\s+–\s+/);
  return parts.length > 1 ? parts[0] : s.split(/\s+/)[0];
}
export function companies(m) {
  const out = new Map(); // 정리한 이름 → 화면에 보일 이름
  [m.org, ...(m.career || []).map(firstPart)].forEach(raw => {
    const disp = String(raw || '').trim(), n = normCo(disp);
    // '○○대학교', 'OO회사'처럼 이름을 가린 값도 같은 회사로 보지 않음
    if (n.length >= 2 && !/[○●◯]|^oo|^xx/.test(n) && !GENERIC.some(g => n.includes(g)) && !out.has(n)) out.set(n, disp);
  });
  return out;
}

/* ---------- 논문 제목 낱말 ---------- */
const STOP = new Set(['연구', '영향', '관한', '대한', '미치는', '중심', '중심으로', '분석', '효과', '사례', '관계', '매개', '조절',
  '역할', '실증', '기반', '활용', '통한', '따른', '방안', '전략', '요인', '인식', '차이', '비교', '고찰', '탐색', '개발', '적용',
  '검증', '측정', '모형', '모델', '이용', '소비자', '브랜드', '브랜딩', '기업', '국내', '한국', '경우', '위한', '통해', '관점',
  '효과성', '결정요인', '마케팅', '경영', '중요성', '변화', '현황', '개선', '경험', '고객', '의도', '구매', '만족', '신뢰', '애착', '참여', '활동',
  'the', 'of', 'and', 'on', 'for', 'to', 'with', 'in', 'a', 'an', 'study', 'effect', 'effects', 'impact', 'brand', 'brands', 'case', 'analysis']);
const JOSA = /(으로서|으로써|으로|에서의|에서|에게|에의|과의|와의|이라는|라는|이며|에|의|을|를|이|가|은|는|과|와|로|및|도|적)$/;
export function thesisWords(m) {
  const out = new Set();
  String(m.thesis || '').toLowerCase().split(/[^0-9a-z가-힣]+/).forEach(w => {
    if (!w) return;
    const cut = w.replace(JOSA, '');
    const word = cut.length >= 2 ? cut : w;
    if (word.length >= 2 && !STOP.has(word)) out.add(word);
  });
  return out;
}

/* ---------- 두 사람 사이 ---------- */
// me 기준으로 o 와의 시너지. { score, reasons: [{ k, t }] }
export function synergy(me, o, cache = new Map()) {
  const memo = (m, key, fn) => { const id = m.uid + key; if (!cache.has(id)) cache.set(id, fn(m)); return cache.get(id); };
  const R = []; let s = 0;
  const get = helps(o, me);
  if (get.length) { s += 3 * get.length; R.push({ k: 'get', t: `내가 찾는 ${q(get)} 도움 가능` }); }
  const give = helps(me, o);
  if (give.length) { s += 2 * give.length; R.push({ k: 'give', t: `이 분이 찾는 ${q(give)}, 내가 도울 수 있음` }); }
  const mine = memo(me, ':co', companies), theirs = memo(o, ':co', companies);
  const same = [...theirs].filter(([n]) => mine.has(n)).map(([, d]) => d);
  if (same.length) { s += 3; R.push({ k: 'co', t: `같은 회사 출신 · ${same[0]}` }); }
  const sameInd = me.industry && me.industry === o.industry && me.industry !== 'etc';
  if (sameInd) { s += 1.5; R.push({ k: 'ind', t: `동종업계 · ${IND[o.industry] || ''}` }); }
  const tw = memo(me, ':th', thesisWords), ow = memo(o, ':th', thesisWords);
  const shared = [...ow].filter(w => tw.has(w));
  if (shared.length) { s += 1.5; R.push({ k: 'thesis', t: `논문 주제가 겹쳐요 · ${shared.slice(0, 2).join(', ')}` }); }
  const fns = inter(fnTokens(me), fnTokens(o)).filter(k => k !== 'etc');
  if (fns.length) { s += 1; R.push({ k: 'fn', t: `같은 직무 · ${fns.slice(0, 2).map(fnLabel).join(', ')}` }); }
  const near = sameInd || fns.length > 0;
  if (near && me.type === 'student' && o.type === 'grad') { s += 1; R.push({ k: 'senior', t: '같은 분야 선배 동문' }); }
  if (near && me.type === 'grad' && o.type === 'student') { s += .5; R.push({ k: 'junior', t: '같은 분야 후배 동문' }); }
  if (near && (me.type === 'conf') !== (o.type === 'conf')) {
    if (isProspect(me)) { s += 1; R.push({ k: 'senior', t: '같은 분야 동문 · 입학 선배가 될 분' }); }
    else if (isProspect(o)) { s += .5; R.push({ k: 'junior', t: '같은 분야 입학 관심자' }); }
    else { s += .5; R.push({ k: 'bridge', t: o.type === 'conf' ? '같은 분야 학술회 참가자' : '같은 분야 동문' }); }
  }
  return { score: s, reasons: R };
}

// 나와 시너지가 큰 순서.
export function recommend(me, members, n = 9) {
  if (!me) return [];
  const cache = new Map(), tie = id => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return h; };
  return members.filter(o => o.uid !== me.uid)
    .map(o => ({ u: o, ...synergy(me, o, cache) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || b.reasons.length - a.reasons.length || tie(a.u.uid) - tie(b.u.uid))
    .slice(0, n);
}

// 같은 회사를 거친 사람 묶음(2명 이상). [{ name, people: [...] }]
export function companyGroups(members) {
  const G = new Map();
  members.forEach(m => companies(m).forEach((disp, n) => {
    if (!G.has(n)) G.set(n, { name: disp, people: [] });
    G.get(n).people.push(m);
  }));
  return [...G.values()].filter(g => g.people.length >= 2)
    .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name, 'ko'));
}
