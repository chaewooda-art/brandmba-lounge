/**
 * 간편 신청서(구글 폼) 만들기 · 라운지 신청서와 별개
 *
 * 구글 로그인 없이 누구나 낼 수 있는 짧은 신청서입니다.
 *  1쪽  기본 정보: 이름, 연락처, 이메일, 신분(재학생/졸업생/입학 희망/학술회 참가자/기타)
 *       신분에 따라 → 재학생·졸업생: 2쪽 / 입학 희망: 3쪽 / 기타: 4쪽 / 학술회 참가자: 바로 5쪽
 *  2쪽  동문 정보: 입학 연도                → 5쪽
 *  3쪽  입학 희망: 희망 입학 시기           → 5쪽
 *  4쪽  신분 직접 입력: 신분(직접 입력)     → 5쪽
 *  5쪽  안내와 동의: 받고 싶은 안내(여러 개), 알게 된 경로, 개인정보 수집·이용 동의
 *       알게 된 경로에서 '지인 추천'을 고른 사람만 → 6쪽, 나머지는 바로 제출
 *  6쪽  추천해 준 분: 추천해 준 분 이름
 *
 * 새로 만들기: createSimpleForm → [실행] (실행할 때마다 새 신청서가 생기니 한 번만)
 * 이미 만든 신청서(SIMPLE_FORM_ID)를 위 구조로 맞추기: updateSimpleForm → [실행] (여러 번 실행해도 됨)
 * 라운지 자동 연동(sync.gs)과 연결되지 않고, 스크립트 속성(FORM_ID, SHEET_ID)도 건드리지 않습니다.
 */

// 2026-10-28에 만든 간편 신청서 (https://forms.gle/bcxAfXACaGtTWmCs8)
const SIMPLE_FORM_ID = '1uE1ILq90N2Zj6h2QGkxFw-3bnWT1ePgsMApGdtD22f8';
const SIMPLE_SOURCES = ['학술회 현장', '지인 추천', 'SNS', '학교 홈페이지', '기타'];
const SIMPLE_GUIDES = ['입학 설명회·상담', '학술회·특강 소식', '동문 네트워킹 모임', '협업·채용 소식']; // + 기타(직접 입력)
const SIMPLE_WHEN = ['2027년 상반기', '2027년 하반기', '2028년 이후', '아직 정하지 않았어요'];
const SIMPLE_PRIV = '수집 항목: 이름, 연락처, 이메일, 신분, 입학 연도(재학생·졸업생), 희망 입학 시기(입학 희망), 받고 싶은 안내, 알게 된 경로, 추천해 준 분 이름(지인 추천일 때) / 목적: 신청 확인과 안내 연락(행사·입학·소식) / 보관: 수집한 날부터 1년(요청하면 바로 삭제). 동의하지 않을 수 있으며, 이 경우 신청할 수 없습니다. (필수)';
const SIMPLE_DESC = '이름, 연락처, 이메일 등 몇 가지만 적어 주세요. 구글 로그인 없이 1분이면 끝나요.\n운영진이 확인하고 안내 연락을 드립니다.';

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
  form.addMultipleChoiceItem().setTitle('신분').setChoiceValues(['재학생', '졸업생', '입학 희망', '학술회 참가자', '기타']).setRequired(true);
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
  simpleStructure_(form);
  Logger.log('간편 신청서를 새 구조로 맞췄습니다. 응답 수: ' + form.getResponses().length + '\n' + simpleOutline_(form));
}

/* ---------- 구조 맞추기 ---------- */

function simpleFind_(form, title, type) {
  return form.getItems().filter(i => i.getTitle() === title && (!type || i.getType() === type))[0];
}

function simpleStructure_(form) {
  const PB = FormApp.ItemType.PAGE_BREAK, MC = FormApp.ItemType.MULTIPLE_CHOICE;
  const find = (t, type) => simpleFind_(form, t, type);
  if (!find('신분', MC)) throw new Error('‘신분’ 질문을 찾지 못했습니다.');
  if (!find('개인정보 수집·이용 동의')) throw new Error('‘개인정보 수집·이용 동의’ 질문을 찾지 못했습니다.');

  // 1) 신분 바로 뒤에 신분별 쪽(2~4쪽)과 '안내와 동의' 쪽 머리, '받고 싶은 안내'
  if (!find('안내와 동의', PB)) {
    const maxLen = n => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).setHelpText(n + '자 이내로 적어 주세요.').build();
    const make = [
      () => form.addPageBreakItem().setTitle('동문 정보').setHelpText('재학생·졸업생만 답합니다.'),
      () => form.addTextItem().setTitle('입학 연도').setHelpText('숫자 네 자리 · 예: 2015').setRequired(true)
        .setValidation(FormApp.createTextValidation().requireNumberBetween(1995, 2030).setHelpText('1995부터 2030 사이 연도로 적어 주세요.').build()),
      () => form.addPageBreakItem().setTitle('입학 희망').setHelpText('브랜드매니지먼트전공 입학을 생각하는 분만 답합니다.'),
      () => form.addMultipleChoiceItem().setTitle('희망 입학 시기').setChoiceValues(SIMPLE_WHEN).setRequired(true),
      () => form.addPageBreakItem().setTitle('신분 직접 입력'),
      () => form.addTextItem().setTitle('신분(직접 입력)').setHelpText('예: 교수, 기업 관계자, 타 대학원생').setRequired(true).setValidation(maxLen(40)),
      () => form.addPageBreakItem().setTitle('안내와 동의'),
      () => form.addCheckboxItem().setTitle('받고 싶은 안내').setHelpText('여러 개 고를 수 있어요.').setChoiceValues(SIMPLE_GUIDES).showOtherOption(true).setRequired(true)
    ];
    let at = find('신분', MC).getIndex() + 1;
    make.forEach(fn => { const it = fn(); form.moveItem(it.getIndex(), at++); });
  }

  // 2) 맨 뒤 '추천해 준 분' 쪽과 '알게 된 경로'(동의 바로 앞)
  simpleReferral_(form);

  // 3) 신분 → 다음 쪽, 각 쪽을 마치면 '안내와 동의'로
  const pAlum = find('동문 정보', PB).asPageBreakItem(), pWant = find('입학 희망', PB).asPageBreakItem();
  const pEtc = find('신분 직접 입력', PB).asPageBreakItem(), pGuide = find('안내와 동의', PB).asPageBreakItem();
  const st = find('신분', MC).asMultipleChoiceItem();
  st.showOtherOption(false);
  st.setChoices([
    st.createChoice('재학생', pAlum), st.createChoice('졸업생', pAlum), st.createChoice('입학 희망', pWant),
    st.createChoice('학술회 참가자', pGuide), st.createChoice('기타', pEtc)
  ]);
  pWant.setGoToPage(pGuide); // 동문 정보(2쪽)를 마치면 → 안내와 동의
  pEtc.setGoToPage(pGuide);  // 입학 희망(3쪽)을 마치면 → 안내와 동의 (신분 직접 입력 4쪽은 순서대로 5쪽)

  find('개인정보 수집·이용 동의').asCheckboxItem().setHelpText(SIMPLE_PRIV);
  form.setDescription(SIMPLE_DESC);
}

// '알게 된 경로'(필수, 동의 바로 앞)와 맨 뒤 '추천해 준 분' 쪽. 지인 추천만 추천인 쪽으로, 나머지는 바로 제출.
// '알게 된 경로'는 필수여야 합니다(비워 두면 다음 쪽으로 넘어가기 때문).
function simpleReferral_(form) {
  const PB = FormApp.ItemType.PAGE_BREAK, MC = FormApp.ItemType.MULTIPLE_CHOICE;
  const find = (t, type) => simpleFind_(form, t, type);
  if (!find('알게 된 경로', MC)) {
    const src = form.addMultipleChoiceItem().setTitle('알게 된 경로').setHelpText('이 신청서를 어떻게 알게 되셨나요?').setRequired(true);
    form.moveItem(src.getIndex(), find('개인정보 수집·이용 동의').getIndex());
  }
  if (!find('추천해 준 분', PB)) {
    form.addPageBreakItem().setTitle('추천해 준 분').setHelpText('소개해 준 분을 알려 주세요.');
    form.addTextItem().setTitle('추천해 준 분 이름').setHelpText('예: 홍길동 (여러 명이면 쉼표로)').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(40).setHelpText('40자 이내로 적어 주세요.').build());
  }
  const page = find('추천해 준 분', PB).asPageBreakItem();
  const mc = find('알게 된 경로', MC).asMultipleChoiceItem();
  mc.setChoices(SIMPLE_SOURCES.map(v => v === '지인 추천' ? mc.createChoice(v, page) : mc.createChoice(v, FormApp.PageNavigationType.SUBMIT)));
}

// 확인용: 쪽·질문 순서, 쪽을 마친 뒤 가는 곳, 선택지별 다음 쪽
function simpleOutline_(form) {
  const nav = c => c.getPageNavigationType() === FormApp.PageNavigationType.GO_TO_PAGE ? c.getGotoPage().getTitle() : String(c.getPageNavigationType());
  return form.getItems().map(i => {
    const t = i.getType();
    if (t === FormApp.ItemType.PAGE_BREAK) {
      const g = i.asPageBreakItem().getGoToPage();
      return '── [' + i.getTitle() + ']' + (g ? ' (앞 쪽을 마치면 → ' + g.getTitle() + ')' : '');
    }
    if (t === FormApp.ItemType.MULTIPLE_CHOICE && ['신분', '알게 된 경로'].indexOf(i.getTitle()) >= 0) {
      return '   ' + i.getTitle() + ': ' + i.asMultipleChoiceItem().getChoices().map(c => c.getValue() + '→' + nav(c)).join(', ');
    }
    if (t === FormApp.ItemType.CHECKBOX && i.getTitle() === '받고 싶은 안내') {
      const cb = i.asCheckboxItem();
      return '   받고 싶은 안내: ' + cb.getChoices().map(c => c.getValue()).join(', ') + (cb.hasOtherOption() ? ', 기타(직접 입력)' : '');
    }
    return '   ' + i.getTitle();
  }).join('\n');
}
