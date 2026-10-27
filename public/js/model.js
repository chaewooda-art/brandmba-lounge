// 프로필 데이터를 화면·추천·지도에서 같은 방식으로 읽기 위한 도우미
//
// 저장 형태(members/{mid})
//   type     'grad' | 'student' | 'conf'
//   year     입학 연도(숫자) 또는 null(학술회 참가자)
//   cohort   기수(숫자) 또는 null(모르거나 학술회 참가자)
//   fn       직무 분야 키 목록(최대 3)       fnEtc    직무 '기타'에 직접 적은 글
//   offer    줄 수 있는 것 키 목록(최대 3)   offerEtc '기타'에 직접 적은 글(쉼표로 여러 개)
//   need     필요한 것 키 목록(최대 3)       needEtc  〃
//   stage    학술회 참가자의 현재 신분 'work'|'prof'|'ugrad'|'gstu'|'etc' 또는 null(동문)
//   admit    학술회 참가자의 입학 관심 'yes'|'applied'|'no' 또는 null(동문)

import { HELPS as HELP, FUNCTIONS as FN, TYPES } from './constants.js';
export { isLimited, isProspect } from './constants.js';

// '기타' 글은 'x:정리한 글' 토큰으로 바꿔 목록 키와 같은 방식으로 비교합니다.
const tok = s => 'x:' + String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
export const etcList = s => String(s || '').split(/\s*,\s*/).map(x => x.trim()).filter(Boolean);
const etcTokens = s => etcList(s).map(tok);
export const isEtc = k => typeof k === 'string' && k.startsWith('x:');

export const fnsOf = u => (Array.isArray(u.fn) ? u.fn : (u.fn ? [u.fn] : []));
export const fnTokens = u => [...fnsOf(u), ...etcTokens(u.fnEtc)];
export const offersOf = u => [...(u.offer || []), ...etcTokens(u.offerEtc)];
export const needsOf = u => [...(u.need || []), ...etcTokens(u.needEtc)];
export const inter = (a, b) => (a || []).filter(x => (b || []).includes(x));
// giver가 taker에게 줄 수 있는 것(키 또는 'x:' 토큰)
export const helps = (giver, taker) => inter(offersOf(giver), needsOf(taker));

// 키·토큰 → 화면 글자
export const helpLabel = k => HELP[k] || (isEtc(k) ? k.slice(2) : k);
export const fnLabel = k => FN[k] || (isEtc(k) ? k.slice(2) : k);
// 직무 분야 전체를 글자로: '브랜드 전략 · 마케팅 · (기타 글)'
export const fnText = u => [...fnsOf(u).map(k => FN[k] || k), ...etcList(u.fnEtc)].join(' · ');
export const offerLabels = u => [...(u.offer || []).map(k => HELP[k] || k), ...etcList(u.offerEtc)];
export const needLabels = u => [...(u.need || []).map(k => HELP[k] || k), ...etcList(u.needEtc)];

// 구분·기수 표시
const STAGE_SHORT = { work: '실무자', prof: '교수·연구자', ugrad: '학부생', gstu: '대학원생' };
const ADMIT_SHORT = { yes: '입학 관심', applied: '입학 지원·합격' };
export const admitLabel = u => (u && u.type === 'conf' && ADMIT_SHORT[u.admit]) || '';
export function cohortLabel(u) {
  if (u.type === 'conf') return [STAGE_SHORT[u.stage] ? '학술회 · ' + STAGE_SHORT[u.stage] : '학술회 참가', admitLabel(u)].filter(Boolean).join(' · ');
  const base = u.cohort ? `${u.cohort}기` : (u.year ? `${u.year} 입학` : '');
  return u.type === 'student' ? (base ? base + ' 재학' : '재학생') : base;
}
export const typeLabel = u => TYPES[u.type] || TYPES.grad;

// 기수 추정(지도 '기수순' 배치용). BM은 한 해에 두 기수: 2025년 입학 = 55기
export const cohortNum = u => u.cohort || (u.year ? (u.year - 1998) * 2 + 1 : null);
// 정렬: 동문은 기수(또는 입학 연도) 순, 학술회 참가자는 뒤
export const orderKey = u => (u.type === 'conf' ? 10000 : (cohortNum(u) || 9000));
