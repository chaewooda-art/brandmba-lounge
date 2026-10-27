// 로그인 전 화면의 '라운지 미리 보기'용 가상 인물
// 실제 사람이 아닙니다. 이름은 성만 남기고 가렸고, 회사 이름도 지어낸 것입니다.
// 같은 씨앗값으로 만들어서 새로고침해도 늘 같은 사람들이 나옵니다.

const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '백', '허', '남', '심'];
const ORG = {
  food: ['알파식품', '베타푸드', '오메가외식', '루나베이커리'],
  beauty: ['감마코스메틱', '델타뷰티', '시그마패션', '노바스킨'],
  retail: ['카파리테일', '람다커머스', '뮤백화점', '피크마켓'],
  agency: ['제타브랜딩', '에타애드', '세타디자인', '오르빗PR'],
  service: ['이오타테크', '누플랫폼', '크시모바일', '아크클라우드'],
  mfg: ['오미크론전자', '파이건설', '리버모터스'],
  public: ['로금융', '타우공사', '써니캐피탈'],
  etc: ['○○대학교', '개인 스튜디오']
};
const TITLE = {
  mkt: ['마케팅팀 팀장', '그로스 마케터', '마케팅 매니저'], brand: ['브랜드매니저', '브랜드전략 리드', 'BM 팀장'],
  design: ['디자인 디렉터', 'BX 디자이너', '크리에이티브 리드'], cx: ['CX 리드', '고객경험 매니저'],
  content: ['콘텐츠 리드', 'PR 매니저', '에디터'], sales: ['MD', '영업 팀장', '바이어'],
  strat: ['전략기획 매니저', '사업개발 리드'], ceo: ['대표', '공동창업자'], fin: ['투자심사역', '재무 팀장'],
  ops: ['운영 매니저', 'PM'], edu: ['교수', 'HR 리드', '강사']
};
const THESIS = [
  '팝업스토어 경험이 브랜드 애착에 미치는 영향', '라이브커머스 신뢰가 구매 의도에 미치는 영향', 'ESG 활동과 브랜드 진정성 인식',
  'MZ세대 고객경험과 재방문 의도', '브랜드 세계관 콘텐츠의 몰입 효과', '공간 브랜딩이 상권 활성화에 미치는 영향',
  '로컬 브랜드의 진정성과 지역 애착', '구독 서비스 고객경험과 해지 의도', '디자인 일관성이 브랜드 신뢰에 미치는 영향',
  '팬덤 커뮤니티 참여와 브랜드 옹호', 'AI 추천 경험과 고객 만족', '친환경 패키지와 구매 의도'
];
const INTRO = ['브랜드를 오래 가게 만드는 일을 합니다.', '좋은 제품을 더 많은 사람에게 알리는 중입니다.', '해외 시장을 함께 볼 동문을 찾아요.',
  '데이터로 고객을 이해하는 일을 좋아합니다.', '공간과 경험을 설계합니다.', '선후배와 프로젝트를 같이 해 보고 싶어요.', ''];
const HELP_KEYS = ['brand', 'design', 'perf', 'content', 'channel', 'global', 'invest', 'hiring', 'data', 'mentor', 'partner'];
const FN_BY_IND = {
  food: ['brand', 'mkt', 'sales', 'strat'], beauty: ['mkt', 'brand', 'content', 'design'], retail: ['sales', 'mkt', 'strat', 'ops'],
  agency: ['brand', 'design', 'content', 'cx', 'ceo'], service: ['mkt', 'cx', 'ops', 'strat'], mfg: ['brand', 'strat', 'sales'],
  public: ['fin', 'content', 'strat'], etc: ['edu', 'ceo', 'brand']
};
const IND_W = [['food', 9], ['beauty', 9], ['retail', 8], ['agency', 10], ['service', 8], ['mfg', 4], ['public', 4], ['etc', 3]];

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = rng(20261027);
const R2 = rng(1027); // 학술회 참가자의 신분·입학 관심용(다른 값의 순서를 바꾸지 않게 따로)
const pick = a => a[Math.floor(R() * a.length)];
const wpick = w => { let x = R() * w.reduce((s, [, n]) => s + n, 0); for (const [k, n] of w) { if ((x -= n) < 0) return k; } return w[0][0]; };
const some = (a, n) => { const c = a.slice(), o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(R() * c.length), 1)[0]); return o; };
const wpick2 = w => { let x = R2() * w.reduce((s, [, n]) => s + n, 0); for (const [k, n] of w) { if ((x -= n) < 0) return k; } return w[0][0]; };
const yearsOf = y => { const e = 2026 - y + 4; return e <= 3 ? 'y0' : e <= 7 ? 'y4' : e <= 12 ? 'y8' : e <= 19 ? 'y13' : 'y20'; };

function make(i, o = {}) {
  const type = o.type || wpick([['grad', 66], ['student', 19], ['conf', 15]]);
  const industry = o.industry || wpick(IND_W);
  const fn = o.fn || some(FN_BY_IND[industry], R() < .45 ? 2 : 1);
  const year = type === 'conf' ? null : (o.year || (type === 'student' ? 2024 + Math.floor(R() * 3) : 1999 + Math.floor(R() * 24)));
  const cohort = year && R() < .72 ? (year - 1998) * 2 + 1 + (R() < .5 ? 1 : 0) : null;
  const org = o.org || pick(ORG[industry]);
  const prev = Object.values(ORG).flat().filter(x => x !== org && !x.startsWith('○○') && x !== '개인 스튜디오');
  const career = o.career || (R() < .55 ? some(prev, R() < .4 ? 2 : 1).map(c => `${c} · ${pick(TITLE[pick(Object.keys(TITLE))])} · ${2005 + Math.floor(R() * 12)}–${2014 + Math.floor(R() * 10)}`) : []);
  const offer = o.offer || some(HELP_KEYS, 1 + Math.floor(R() * 3));
  const need = o.need || some(HELP_KEYS.filter(k => !offer.includes(k)), 1 + Math.floor(R() * 2));
  const conf = type === 'conf';
  const stage = conf ? (o.stage || wpick2([['work', 55], ['prof', 12], ['ugrad', 18], ['gstu', 10], ['etc', 5]])) : null;
  const admit = conf ? (o.admit || wpick2([['yes', 30], ['applied', 5], ['no', 65]])) : null;
  const ugrad = stage === 'ugrad' && !o.org;
  // 입학 관심자는 '입학·진학 상담'이 필요하고, 재학생·졸업생 일부는 그걸 줄 수 있음
  if (!o.need && conf && admit !== 'no' && !need.includes('admit')) need.splice(0, need.length >= 2 ? 1 : 0, 'admit');
  if (!o.offer && !conf && R2() < .14 && offer.length < 3) offer.push('admit');
  return {
    uid: 'demo-' + i, name: SUR[i % SUR.length] + '○○', type, stage, admit, year, cohort,
    thesis: type === 'grad' ? (o.thesis ?? (R() < .4 ? pick(THESIS) : '')) : '',
    org: ugrad ? '○○대학교' : org, title: ugrad ? '경영학과 학부생' : (o.title || pick(TITLE[fn[0]] || TITLE.brand)), industry, fn, fnEtc: o.fnEtc || '',
    years: ugrad ? 'none' : (o.years || (year ? yearsOf(year) : pick(['y8', 'y13', 'y20']))), career: ugrad ? [] : career,
    offer, offerEtc: o.offerEtc || '', need, needEtc: o.needEtc || '', intro: o.intro ?? pick(INTRO), status: 'approved'
  };
}

// 미리 보기 주인공(나) 셋과, 추천 이유가 잘 드러나도록 짝지은 사람들
export const DEMO_PERSONAS = [
  { uid: 'demo-0', label: '재학생 · 뷰티 마케터' },
  { uid: 'demo-1', label: '졸업생 · 식품 브랜드매니저' },
  { uid: 'demo-2', label: '학술회 참가자 · 교수' },
  { uid: 'demo-13', label: '학부생 · 입학 관심' }
];
const FIXED = [
  { type: 'student', year: 2025, industry: 'beauty', fn: ['mkt', 'content'], org: '노바스킨', title: '그로스 마케터', offer: ['content', 'perf', 'admit'], need: ['channel', 'invest', 'mentor'], career: ['람다커머스 · 마케팅 매니저 · 2019–2024'], intro: '스킨케어 브랜드를 키우고 있어요.' },
  { type: 'grad', year: 2010, industry: 'food', fn: ['brand'], org: '알파식품', title: '브랜드매니저', offer: ['channel', 'mentor'], need: ['design', 'global'], thesis: '팝업스토어 경험이 브랜드 애착에 미치는 영향', career: ['베타푸드 · 마케터 · 2006–2011'] },
  { type: 'conf', stage: 'prof', admit: 'no', industry: 'etc', fn: ['edu'], org: '○○대학교', title: '교수', offer: ['mentor', 'data'], need: ['partner'], needEtc: '공동 연구', intro: '소비자 경험을 연구합니다.' },
  { type: 'grad', year: 2006, industry: 'retail', fn: ['sales'], org: '뮤백화점', title: '바이어', offer: ['channel'], need: ['brand', 'content'], career: ['카파리테일 · MD · 2004–2012'] },
  { type: 'grad', year: 2004, industry: 'public', fn: ['fin'], org: '써니캐피탈', title: '투자심사역', offer: ['invest', 'mentor'], need: ['brand'] },
  { type: 'grad', year: 2016, industry: 'beauty', fn: ['brand', 'design'], org: '델타뷰티', title: 'BM 팀장', offer: ['design', 'brand', 'admit'], need: ['perf', 'content'], career: ['노바스킨 · BX 디자이너 · 2014–2019'] },
  { type: 'grad', year: 2012, industry: 'agency', fn: ['design'], org: '세타디자인', title: '디자인 디렉터', offer: ['design'], need: ['hiring', 'partner'], career: ['알파식품 · BX 디자이너 · 2009–2014'] },
  { type: 'conf', stage: 'work', admit: 'yes', industry: 'service', fn: ['strat'], org: '누플랫폼', title: '사업개발 리드', offer: ['global', 'partner'], need: ['data', 'admit'], offerEtc: '해외 판로' },
  { type: 'grad', year: 2002, industry: 'food', fn: ['ceo'], org: '루나베이커리', title: '대표', offer: ['mentor', 'partner'], need: ['perf', 'content'], thesis: '로컬 브랜드의 진정성과 지역 애착', career: ['알파식품 · 브랜드매니저 · 2001–2010'] },
  { type: 'student', year: 2026, industry: 'agency', fn: ['brand'], org: '제타브랜딩', title: '브랜드 컨설턴트', offer: ['brand'], need: ['mentor', 'channel'], offerEtc: '공간 브랜딩' },
  { type: 'grad', year: 2018, industry: 'service', fn: ['cx', 'ops'], org: '이오타테크', title: 'CX 리드', offer: ['data', 'content'], need: ['brand'], thesis: 'MZ세대 고객경험과 재방문 의도' },
  { type: 'conf', stage: 'work', admit: 'no', industry: 'public', fn: ['content'], org: '타우공사', title: '홍보 매니저', offer: ['partner'], need: ['design', 'content'] },
  { type: 'grad', year: 2008, industry: 'etc', fn: ['edu', 'brand'], org: '한빛컨설팅', title: '연구소장', offer: ['data', 'mentor'], offerEtc: '공동 연구', need: ['partner', 'data'], thesis: '브랜드 진정성과 팬덤 커뮤니티 옹호', intro: '현장 사례로 연구합니다.' },
  { type: 'conf', stage: 'ugrad', admit: 'yes', industry: 'beauty', fn: ['mkt', 'brand'], org: '○○대학교', title: '경영학과 4학년', years: 'none', career: [], offer: ['content'], need: ['admit', 'hiring', 'mentor'], intro: '뷰티 브랜드 마케터를 꿈꾸는 학부생입니다.' }
];
export const DEMO_MEMBERS = (() => {
  const out = FIXED.map((o, i) => make(i, o));
  for (let i = FIXED.length; i < 88; i++) out.push(make(i));
  return out;
})();
