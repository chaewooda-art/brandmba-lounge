/**
 * 간편 신청서(구글 폼) 만들기 · 라운지 신청서와 별개
 *
 * 구글 로그인 없이 누구나 낼 수 있는 짧은 신청서입니다.
 *  1쪽  기본 정보: 이름, 연락처, 이메일, 신분(재학생/졸업생/입학 희망/학술회 참가자/기타: 직접 입력)
 *       입학 희망 → 3쪽, 그 밖(기타 포함) → 2쪽
 *  2쪽  안내와 동의: 받고 싶은 안내(여러 개), 알게 된 경로, 개인정보 수집·이용 동의
 *       알게 된 경로에서 '지인 추천' → 4쪽, 나머지는 바로 제출
 *  3쪽  입학 희망: 희망 입학 시기            → 마치면 2쪽으로
 *  4쪽  추천해 준 분: 추천해 준 분 이름
 *
 * 쪽 순서가 2→3으로 거꾸로 가는 이유: 신분의 '기타(직접 입력)'은 선택지별 다음 쪽을 정할 수 없어
 * 항상 바로 다음 쪽(2쪽)으로 갑니다. 그래서 공통 쪽을 2쪽에 두고, 입학 희망 쪽을 뒤에 둔 뒤 2쪽으로 돌려보냅니다.
 *
 * 새로 만들기: createSimpleForm → [실행] (실행할 때마다 새 신청서가 생기니 한 번만)
 * 이미 만든 신청서(SIMPLE_FORM_ID)를 위 구조로 맞추기: updateSimpleForm → [실행] (여러 번 실행해도 됨)
 * 라운지 자동 연동(sync.gs)과 연결되지 않고, 스크립트 속성(FORM_ID, SHEET_ID)도 건드리지 않습니다.
 */

// 2026-10-28에 만든 간편 신청서 (https://forms.gle/bcxAfXACaGtTWmCs8)
const SIMPLE_FORM_ID = '1uE1ILq90N2Zj6h2QGkxFw-3bnWT1ePgsMApGdtD22f8';
const SIMPLE_STATUS = ['재학생', '졸업생', '입학 희망', '학술회 참가자']; // + 기타(직접 입력)
const SIMPLE_SOURCES = ['학술회 현장', '지인 추천', 'SNS', '학교 홈페이지', '기타'];
const SIMPLE_GUIDES = ['입학 설명회·상담', '학술회·특강 소식', '동문 네트워킹 모임', '협업·채용 소식']; // + 기타(직접 입력)
const SIMPLE_WHEN = ['2027년 상반기', '2027년 하반기', '2028년 이후', '아직 정하지 않았어요'];
const SIMPLE_PRIV = '수집 항목: 이름, 연락처, 이메일, 신분, 희망 입학 시기(입학 희망), 받고 싶은 안내, 알게 된 경로, 추천해 준 분 이름(지인 추천일 때) / 목적: 신청 확인과 안내 연락(행사·입학·소식) / 보관: 수집한 날부터 1년(요청하면 바로 삭제). 동의하지 않을 수 있으며, 이 경우 신청할 수 없습니다. (필수)';
const SIMPLE_DESC = '이름, 연락처, 이메일 등 몇 가지만 적어 주세요. 구글 로그인 없이 1분이면 끝나요.\n운영진이 확인하고 안내 연락을 드립니다.';
// 예전 구조에서 쓰다 뺀 질문·쪽 (updateSimpleForm 이 지움)
const SIMPLE_OLD_ITEMS = ['입학 연도', '신분(직접 입력)'];
const SIMPLE_OLD_PAGES = ['동문 정보', '신분 직접 입력'];

function createSimpleForm() {
  const title = '경희 브랜드MBA 간편 신청서';
  const maxLen = n => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).setHelpText(n + '자 이내로 적어 주세요.').build();

  const form = FormApp.create(title);
  form.setDescription(SIMPLE_DESC);

  // 로그인 없이: 구글 계정 이메일을 받지 않고, 한 사람 한 번 제한도 두지 않음(제한은 로그인이 필요함)
  if (FormApp.EmailCollectionType && typeof form.setEmailCollectionType === 'function') {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } else {
    form.setCollectEmail(false);
  }
  try { form.setRequireLogin(false); } catch (e) { /* 개인 Gmail 계정에는 없는 설정 */ }
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('신청을 받았습니다. 운영진이 확인하고 연락드릴게요. 감사합니다.');

  form.addTextItem().setTitle('이름').setRequired(true).setValidation(maxLen(20));
  form.addTextItem().setTitle('연락처').setHelpText('휴대폰 번호 · 예: 010-1234-5678').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[0-9+\\-\\s()]{9,20}$').setHelpText('숫자와 하이픈(-)으로 적어 주세요.').build());
  form.addTextItem().setTitle('이메일').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('이메일 주소 형식으로 적어 주세요.').build());
  form.addMultipleChoiceItem().setTitle('신분').setChoiceValues(SIMPLE_STATUS).setRequired(true);
  form.addCheckboxItem().setTitle('개인정보 수집·이용 동의').setHelpText(SIMPLE_PRIV).setChoiceValues(['동의합니다']).setRequired(true);

  simpleStructure_(form);

  if (typeof form.setPublished === 'function') form.setPublished(true);
  form.setAcceptingResponses(true);

  const ss = SpreadsheetApp.create(title + ' (응답)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Logger.log('이메일 수집: ' + (form.getEmailCollectionType ? form.getEmailCollectionType() : (form.collectsEmail() ? '수집' : '안 함')) +
    ' · 로그인 필요: ' + (function () { try { return form.requiresLogin(); } catch (e) { return '해당 없음'; } })() +
    ' · 게시: ' + (form.isPublished ? form.isPublished() : '확인 불가') + ' · 응답 받는 중: ' + form.isAcceptingResponses());
  Logger.log('신청서 주소(공유용): ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('신청서 수정 주소(운영진): ' + form.getEditUrl());
  Logger.log('응답 시트 주소(운영진): ' + ss.getUrl());
  Logger.log(simpleOutline_(form));
}

// 이미 만든 간편 신청서를 위 구조로 맞춥니다. 이미 받은 응답은 그대로 남습니다. 여러 번 실행해도 됩니다.
function updateSimpleForm() {
  const form = FormApp.openById(SIMPLE_FORM_ID);
  const other = simpleStructure_(form);
  const cleaned = simpleCleanSheet_(form);
  Logger.log('간편 신청서를 새 구조로 맞췄습니다. ' + other + ' · 응답 수: ' + form.getResponses().length +
    (cleaned.length ? ' · 응답 시트에서 지운 빈 열: ' + cleaned.join(', ') : '') + '\n' + simpleOutline_(form));
}

/* ---------- 구조 맞추기 ---------- */

function simpleFind_(form, title, type) {
  return form.getItems().filter(i => i.getTitle() === title && (!type || i.getType() === type))[0];
}

function simpleStructure_(form) {
  const PB = FormApp.ItemType.PAGE_BREAK, MC = FormApp.ItemType.MULTIPLE_CHOICE, CB = FormApp.ItemType.CHECKBOX, TX = FormApp.ItemType.TEXT;
  const find = (t, type) => simpleFind_(form, t, type);
  const toEnd = it => form.moveItem(it.getIndex(), form.getItems().length - 1);
  if (!find('신분', MC)) throw new Error('‘신분’ 질문을 찾지 못했습니다.');
  const consent = find('개인정보 수집·이용 동의', CB);
  if (!consent) throw new Error('‘개인정보 수집·이용 동의’ 질문을 찾지 못했습니다.');

  // 1) 필요한 쪽과 질문이 없으면 만들기(일단 맨 뒤에)
  if (!find('안내와 동의', PB)) form.addPageBreakItem().setTitle('안내와 동의');
  if (!find('받고 싶은 안내', CB)) form.addCheckboxItem().setTitle('받고 싶은 안내').setHelpText('여러 개 고를 수 있어요.').setRequired(true);
  if (!find('알게 된 경로', MC)) form.addMultipleChoiceItem().setTitle('알게 된 경로').setHelpText('이 신청서를 어떻게 알게 되셨나요?').setRequired(true);
  if (!find('입학 희망', PB)) form.addPageBreakItem().setTitle('입학 희망').setHelpText('브랜드매니지먼트전공 입학을 생각하는 분만 답합니다.');
  if (!find('희망 입학 시기', MC)) form.addMultipleChoiceItem().setTitle('희망 입학 시기').setRequired(true);
  if (!find('추천해 준 분', PB)) form.addPageBreakItem().setTitle('추천해 준 분').setHelpText('소개해 준 분을 알려 주세요.');
  if (!find('추천해 준 분 이름', TX)) {
    form.addTextItem().setTitle('추천해 준 분 이름').setHelpText('예: 홍길동 (여러 명이면 쉼표로)').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(40).setHelpText('40자 이내로 적어 주세요.').build());
  }
  const pGuide = find('안내와 동의', PB).asPageBreakItem(), pWant = find('입학 희망', PB).asPageBreakItem(), pRef = find('추천해 준 분', PB).asPageBreakItem();

  // 2) 신분 → 다음 쪽 (지울 쪽을 가리키는 선택지가 없도록 먼저 바꿈)
  const st = find('신분', MC).asMultipleChoiceItem();
  st.setChoices(SIMPLE_STATUS.map(v => st.createChoice(v, v === '입학 희망' ? pWant : pGuide)));

  // 3) 예전 구조의 질문·쪽 지우기(입학 연도, 신분 직접 입력 쪽)
  SIMPLE_OLD_ITEMS.forEach(t => { const it = find(t); if (it) form.deleteItem(it); });
  SIMPLE_OLD_PAGES.forEach(t => { const it = find(t, PB); if (it) form.deleteItem(it); });

  // 4) 순서: 1쪽(이름·연락처·이메일·신분) → 안내와 동의 → 입학 희망 → 추천해 준 분
  [pGuide, find('받고 싶은 안내', CB), find('알게 된 경로', MC), find('개인정보 수집·이용 동의', CB),
    pWant, find('희망 입학 시기', MC), pRef, find('추천해 준 분 이름', TX)].forEach(toEnd);

  // 5) 선택지와 다음 쪽
  find('받고 싶은 안내', CB).asCheckboxItem().setChoiceValues(SIMPLE_GUIDES).showOtherOption(true).setHelpText('여러 개 고를 수 있어요.');
  find('희망 입학 시기', MC).asMultipleChoiceItem().setChoiceValues(SIMPLE_WHEN);
  const src = find('알게 된 경로', MC).asMultipleChoiceItem();
  src.setChoices(SIMPLE_SOURCES.map(v => v === '지인 추천' ? src.createChoice(v, pRef) : src.createChoice(v, FormApp.PageNavigationType.SUBMIT)));
  pGuide.setGoToPage(FormApp.PageNavigationType.CONTINUE); // 1쪽을 마치면(기타 포함) → 바로 다음 쪽 = 안내와 동의
  pWant.setGoToPage(FormApp.PageNavigationType.SUBMIT);    // 안내와 동의를 마치면 → 제출(알게 된 경로가 정하지만 안전장치)
  pRef.setGoToPage(pGuide);                                // 입학 희망을 마치면 → 안내와 동의

  find('개인정보 수집·이용 동의', CB).asCheckboxItem().setHelpText(SIMPLE_PRIV);
  form.setDescription(SIMPLE_DESC);

  // 6) 신분 '기타(직접 입력)'. 선택지별 다음 쪽이 있는 질문에는 스크립트로 켤 수 없는 경우가 있어
  //    안 되면 폼 편집 화면에서 신분 질문에 ‘기타’ 추가를 눌러 켭니다(기타는 다음 쪽 = 안내와 동의로 감).
  try {
    if (!st.hasOtherOption()) st.showOtherOption(true);
    return '신분 기타(직접 입력): 켜짐';
  } catch (e) {
    return '신분 기타(직접 입력): 스크립트로 켤 수 없음 → 폼 편집 화면에서 ‘기타’ 추가 필요';
  }
}

// 응답 시트에서 지운 질문의 열이 비어 있으면 지움. 응답이 하나라도 있으면 그대로 둠.
function simpleCleanSheet_(form) {
  const out = [];
  let ss;
  try { ss = SpreadsheetApp.openById(form.getDestinationId()); } catch (e) { return out; }
  const sh = ss.getSheets().filter(s => s.getFormUrl())[0];
  if (!sh || sh.getLastColumn() < 1) return out;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  for (let c = head.length; c >= 1; c--) {
    if (SIMPLE_OLD_ITEMS.indexOf(String(head[c - 1]).trim()) < 0) continue;
    const n = sh.getLastRow();
    const empty = n < 2 || sh.getRange(2, c, n - 1, 1).getDisplayValues().every(r => r[0] === '');
    if (empty) { sh.deleteColumn(c); out.push(head[c - 1]); }
  }
  return out;
}

// 확인용: 쪽·질문 순서, 쪽을 마친 뒤 가는 곳, 선택지별 다음 쪽
function simpleOutline_(form) {
  const nav = c => c.getPageNavigationType() === FormApp.PageNavigationType.GO_TO_PAGE ? c.getGotoPage().getTitle() : String(c.getPageNavigationType());
  return form.getItems().map(i => {
    const t = i.getType();
    if (t === FormApp.ItemType.PAGE_BREAK) {
      const p = i.asPageBreakItem(), g = p.getGoToPage();
      return '── [' + i.getTitle() + '] (앞 쪽을 마치면 → ' + (g ? g.getTitle() : String(p.getPageNavigationType())) + ')';
    }
    if (t === FormApp.ItemType.MULTIPLE_CHOICE) {
      const mc = i.asMultipleChoiceItem();
      return '   ' + i.getTitle() + ': ' + mc.getChoices().map(c => c.getValue() + '→' + nav(c)).join(', ') + (mc.hasOtherOption() ? ', 기타(직접 입력)' : '');
    }
    if (t === FormApp.ItemType.CHECKBOX && i.getTitle() === '받고 싶은 안내') {
      const cb = i.asCheckboxItem();
      return '   받고 싶은 안내: ' + cb.getChoices().map(c => c.getValue()).join(', ') + (cb.hasOtherOption() ? ', 기타(직접 입력)' : '');
    }
    return '   ' + i.getTitle();
  }).join('\n');
}
