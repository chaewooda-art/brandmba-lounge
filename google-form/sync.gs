/**
 * BM 라운지 · 신청서 응답 시트 → 라운지 자동 연동
 *
 * 하는 일
 *  - 응답 시트에서 '승인'을 체크하면 그 줄을 바로 라운지 명부(Firestore)에 올리고 '라운지 반영' 칸에 결과를 적습니다.
 *  - '라운지 반영' 칸을 지우면 그 줄을 다시 반영합니다(신청서를 고친 경우).
 *  - 매일 아침 8시에 놓친 줄이 없는지 한 번 더 확인합니다.
 *  - 새 신청이 들어오면 이 스크립트 주인에게 알림 메일을 보냅니다.
 *
 * 처음 한 번: 함수 선택에서 setupSync 를 고르고 [실행] → 권한 승인
 * 이 스크립트를 실행하는 구글 계정이 Firebase 프로젝트(brandmba-lounge)의 소유자여야 합니다.
 * 라운지 화면의 보안 규칙을 거치지 않고 소유자 권한으로 쓰므로, 아래 검사 규칙이 public/js/app.js 의 parseRow 와 같아야 합니다.
 */

const PROJECT_ID = 'brandmba-lounge';
const POLICY_VERSION = '2026-11-01';
const DOCS = 'projects/' + PROJECT_ID + '/databases/(default)/documents';
const API = 'https://firestore.googleapis.com/v1/';
const TZ = 'Asia/Seoul';

// 선택지: 영문 키 → 신청서 글자 (public/js/constants.js 와 같음)
const S_IND = { food: '식품·외식', beauty: '뷰티·패션', retail: '유통·커머스', agency: '브랜드·광고 에이전시', service: 'IT·통신·서비스', mfg: '제조·건설', public: '금융·공공', etc: '기타' };
const S_FN = { mkt: '마케팅', brand: '브랜드 전략', design: '디자인', cx: '고객경험·BX', content: '콘텐츠·PR', sales: '영업·MD', strat: '전략·사업기획', ceo: '경영(대표)', fin: '재무·투자', ops: '운영·시스템', edu: '교육·HR', etc: '기타' };
const S_HELP = { brand: '브랜드 전략 자문', design: '디자인·BX', perf: '퍼포먼스 마케팅', content: '콘텐츠·SNS', channel: '유통 채널 연결', global: '해외 진출', invest: '투자·재무', hiring: '채용·인재 추천', data: '데이터 분석', mentor: '강연·멘토링', partner: '공동 프로젝트·제휴', admit: '입학·진학 상담' };
const S_TYPES = { grad: '졸업생', student: '재학생', conf: '학술회 참가자' };
const S_STAGES = { work: '직장인·실무자', prof: '교수·연구자', ugrad: '대학생(학부)', gstu: '대학원생', etc: '기타' };
const S_ADMITS = { yes: '관심 있어요', applied: '이미 지원했거나 합격했어요', no: '아니요' };
const S_YEARS = { none: '경력 없음(학생)', y0: '3년 이하', y4: '4~7년', y8: '8~12년', y13: '13~19년', y20: '20년 이상' };
// 열 제목 (FORM_COLUMNS 와 같음)
const S_COL = {
  email: '이메일 주소', type: '구분', name: '이름', thesis: '학위논문 제목', year: '입학 연도', cohort: '기수',
  org: '회사·소속', title: '직무·직책', industry: '업종', fn: '직무 분야', years: '총 경력 연차', career: '주요 경력',
  offer: '내가 줄 수 있는 것', need: '내가 필요한 것', intro: '한 줄 소개',
  stage: '현재 신분', admit: '입학 관심', admitInfo: '입학 안내 받기', phone: '휴대폰',
  agreeMap: '공개 동의', agreePriv: '개인정보 수집·이용 동의', approve: '승인', synced: '라운지 반영'
};
const AGREE_TEXT = '동의합니다';
const S_ADMIT_INFO_YES = '받을게요';

/* ---------- 처음 설정 ---------- */
function setupSync() {
  const ss = sheetFile_();
  ScriptApp.getProjectTriggers()
    .filter(t => ['onSheetEdit', 'syncAll', 'onNewResponse'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('onNewResponse').forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger('syncAll').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();

  // 질문을 바꾸며 남은 빈 응답 탭(연결 끊김, 응답 없음) 정리
  ss.getSheets().forEach(sh => {
    if (sh.getFormUrl() || ss.getSheets().length < 2) return;
    const n = sh.getLastRow(), c = sh.getLastColumn();
    const empty = n < 2 || sh.getRange(2, 1, n - 1, c).getValues().every(r => r.every(v => v === '' || v === false));
    if (empty) { const nm = sh.getName(); ss.deleteSheet(sh); Logger.log('빈 응답 탭을 지웠습니다: ' + nm); }
  });

  const t = fs_('get', DOCS + '/admins?pageSize=1');
  if (t.code !== 200) throw new Error('라운지(Firestore)에 연결하지 못했습니다(' + t.code + '): ' + t.text.slice(0, 300));
  Logger.log('라운지 연결 확인. 자동 연동을 켰습니다: 승인 체크 즉시 반영, 매일 8시 재확인, 새 신청 알림 메일.');
  syncAll();
}

/* ---------- 트리거 ---------- */
// 시트를 고칠 때마다: '승인' 또는 '라운지 반영' 칸이 바뀐 줄만 처리
function onSheetEdit(e) {
  const sh = e.range.getSheet();
  if (!sh.getFormUrl()) return;
  const head = header_(sh);
  if (head.approve == null) return;
  const c0 = e.range.getColumn(), c1 = c0 + e.range.getNumColumns() - 1;
  const hit = c => c != null && c + 1 >= c0 && c + 1 <= c1;
  if (!hit(head.approve) && !hit(head.synced)) return;
  withLock_(() => {
    for (let r = Math.max(2, e.range.getRow()); r <= e.range.getLastRow(); r++) syncIfNeeded_(sh, r, head);
  });
}

// 매일 한 번: 승인됐는데 아직 반영 안 된 줄
function syncAll() {
  const sh = responseSheet_(), head = header_(sh);
  if (head.approve == null) { Logger.log('‘승인’ 열이 없습니다.'); return; }
  let n = 0;
  withLock_(() => {
    const all = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues(); // 한 번에 읽기
    for (let r = 2; r <= all.length; r++) n += syncIfNeeded_(sh, r, head, all[r - 1]) ? 1 : 0;
  });
  Logger.log('반영한 줄: ' + n);
}

// 새 신청 알림 메일
function onNewResponse(e) {
  const v = k => (e.namedValues && e.namedValues[S_COL[k]] && e.namedValues[S_COL[k]][0]) || '';
  const me = Session.getEffectiveUser().getEmail();
  if (!me) return;
  MailApp.sendEmail(me, '[BM 라운지] 새 신청 · ' + v('name') + ' (' + v('type') + ')',
    v('name') + ' 님이 라운지 신청서를 냈습니다.\n' +
    '구분: ' + v('type') + (v('stage') ? ' · ' + v('stage') : '') + (v('admit') ? ' · 입학 관심: ' + v('admit') : '') + '\n회사·직책: ' + v('org') + ' · ' + v('title') + '\n이메일: ' + v('email') + '\n\n' +
    '응답 시트에서 확인한 뒤 ‘승인’을 체크하면 바로 라운지에 반영됩니다.\n' + sheetFile_().getUrl());
}

/* ---------- 한 줄 처리 ---------- */
function syncIfNeeded_(sh, r, head, values) {
  const row = values || sh.getRange(r, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  const cell = k => head[k] == null ? '' : String(row[head[k]] || '').trim();
  if (!cell('email') && !cell('name')) return false;
  if (!/^(true|o|y|yes|예|승인|v|✓|✔|1|☑)$/i.test(cell('approve'))) return false;
  if (head.synced == null || cell('synced')) return false;
  const out = sh.getRange(r, head.synced + 1);
  try {
    out.setValue(syncRow_(cell));
  } catch (err) {
    out.setValue('오류 · ' + String(err && err.message || err).slice(0, 180));
  }
  return true;
}

function syncRow_(cell) {
  const x = parseRow_(cell);
  if (x.errs.length) return '오류 · ' + x.errs.join(' · ');
  const mid = sha256hex_(x.email);
  if (fs_('get', DOCS + '/withdrawn/' + mid).code === 200) return '탈퇴 기록 있음 · 이 줄은 반영하지 않습니다(다시 등록은 운영진 화면 직접 가져오기)';
  const ex = fs_('get', DOCS + '/members/' + mid);
  const isNew = ex.code === 404;
  if (!isNew && ex.code !== 200) throw new Error('라운지 확인 실패(' + ex.code + ')');
  const fields = toFields_(Object.assign({}, x.profile, { status: isNew ? 'approved' : ((ex.json.fields.status || {}).stringValue || 'approved') }));
  if (!isNew && ex.json.fields.createdAt) fields.createdAt = ex.json.fields.createdAt;
  const now = [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }];
  if (isNew || !ex.json.fields.createdAt) now.push({ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' });
  const writes = [
    { update: { name: DOCS + '/members/' + mid, fields: fields }, updateTransforms: now },
    { update: { name: DOCS + '/contacts/' + mid, fields: toFields_({ email: x.email, consent: { map: true, privacy: true, version: POLICY_VERSION, via: 'google-form' } }) },
      updateTransforms: [{ fieldPath: 'consent.at', setToServerValue: 'REQUEST_TIME' }] },
    { update: { name: DOCS + '/private/' + mid, fields: toFields_({ phone: x.phone, admitInfo: x.admitInfo }) } }
  ];
  const r = fs_('post', DOCS + ':commit', { writes: writes });
  if (r.code !== 200) throw new Error('저장 실패(' + r.code + '): ' + r.text.slice(0, 160));
  return '반영됨 · ' + Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm') + (isNew ? ' · 새로 등록' : ' · 내용 갱신');
}

// 응답 한 줄 → 프로필 (public/js/app.js 의 parseRow 와 같은 규칙)
function parseRow_(cell) {
  const errs = [];
  const squash = s => String(s || '').replace(/\s+/g, '').toLowerCase();
  const keyOf = (dict, label) => Object.keys(dict).filter(k => squash(dict[k]) === squash(label))[0] || null;
  const email = cell('email').toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push('이메일 주소 형식 오류');
  const type = keyOf(S_TYPES, cell('type'));
  if (!type) errs.push('구분 ‘' + cell('type') + '’ 확인 필요');
  const name = cell('name');
  if (!name) errs.push('이름 없음'); else if (name.length > 20) errs.push('이름이 20자를 넘음');
  let year = null, cohort = null;
  if (type && type !== 'conf') {
    const y = cell('year');
    if (/^\d{4}$/.test(y) && +y >= 1995 && +y <= 2030) year = +y; else errs.push('입학 연도 ‘' + y + '’ 확인 필요');
    const c = cell('cohort').replace(/기$/, '');
    if (c) { if (/^\d{1,2}$/.test(c) && +c >= 1 && +c <= 99) cohort = +c; else errs.push('기수 ‘' + c + '’ 확인 필요'); }
  }
  // 학술회 참가자: 현재 신분·입학 관심(3판에 추가된 질문이라 비어 있으면 null), 입학 안내 받기(선택)
  const stage = type === 'conf' ? keyOf(S_STAGES, cell('stage')) : null;
  const admit = type === 'conf' ? keyOf(S_ADMITS, cell('admit')) : null;
  const admitInfo = type === 'conf' && cell('admitInfo').indexOf(S_ADMIT_INFO_YES) >= 0;
  const thesis = type === 'grad' ? cell('thesis').slice(0, 100) : '';
  const org = cell('org').slice(0, 40), title = cell('title').slice(0, 40);
  if (!org) errs.push('회사·소속 없음');
  if (!title) errs.push('직무·직책 없음');
  const industry = keyOf(S_IND, cell('industry'));
  if (!industry) errs.push('업종 ‘' + cell('industry') + '’ 확인 필요');
  const pick = (k, dict) => {
    const keys = [], etc = [];
    cell(k).split(/\s*,\s*/).filter(Boolean).forEach(lab => {
      const key = keyOf(dict, lab);
      if (key && key !== 'etc') { if (keys.indexOf(key) < 0) keys.push(key); }
      else if (!key) etc.push(lab);
    });
    return { keys: keys.slice(0, 3), etc: etc.join(', ').slice(0, 60) };
  };
  const fn = pick('fn', S_FN), offer = pick('offer', S_HELP), need = pick('need', S_HELP);
  if (!fn.keys.length && !fn.etc) errs.push('직무 분야 없음');
  const years = keyOf(S_YEARS, cell('years'));
  if (!years) errs.push('총 경력 연차 ‘' + cell('years') + '’ 확인 필요');
  const career = cell('career').split(/\r?\n/).map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 3);
  const intro = cell('intro').slice(0, 60);
  if (cell('agreeMap').indexOf(AGREE_TEXT) < 0) errs.push('공개 동의 없음');
  if (cell('agreePriv').indexOf(AGREE_TEXT) < 0) errs.push('개인정보 동의 없음');
  let phone = cell('phone').slice(0, 20);
  if (/^1\d{8,9}$/.test(phone)) phone = '0' + phone;
  return {
    errs: errs, email: email, phone: phone, admitInfo: admitInfo,
    profile: { name: name, type: type, stage: stage, admit: admit, year: year, cohort: cohort, thesis: thesis, org: org, title: title, industry: industry,
      fn: fn.keys, fnEtc: fn.etc, years: years, career: career, offer: offer.keys, offerEtc: offer.etc, need: need.keys, needEtc: need.etc, intro: intro }
  };
}

/* ---------- 도우미 ---------- */
function sheetFile_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('응답 시트를 모릅니다. createLoungeForm 을 먼저 실행해 주세요.');
  return SpreadsheetApp.openById(id);
}
function responseSheet_() {
  const sh = sheetFile_().getSheets().filter(s => s.getFormUrl())[0];
  if (!sh) throw new Error('신청서와 연결된 응답 탭이 없습니다.');
  return sh;
}
function header_(sh) {
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(s => String(s).trim());
  const out = {};
  Object.keys(S_COL).forEach(k => { const i = h.indexOf(S_COL[k]); if (i >= 0) out[k] = i; });
  if (out.email == null) { const i = h.findIndex(s => /^(email address|이메일)$/i.test(s)); if (i >= 0) out.email = i; }
  return out;
}
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { fn(); } finally { lock.releaseLock(); }
}
function sha256hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function fs_(method, path, body) {
  const opt = {
    method: method, muteHttpExceptions: true, contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'x-goog-user-project': PROJECT_ID }
  };
  if (body) opt.payload = JSON.stringify(body);
  const r = UrlFetchApp.fetch(API + path, opt);
  let json = {};
  try { json = JSON.parse(r.getContentText() || '{}'); } catch (e) { /* 빈 응답 */ }
  return { code: r.getResponseCode(), json: json, text: r.getContentText() };
}
// JS 값 → Firestore REST 값
function toValue_(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(toValue_) } : {} };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'object') return { mapValue: { fields: toFields_(v) } };
  return { stringValue: String(v) };
}
function toFields_(o) {
  const f = {};
  Object.keys(o).forEach(k => { f[k] = toValue_(o[k]); });
  return f;
}
