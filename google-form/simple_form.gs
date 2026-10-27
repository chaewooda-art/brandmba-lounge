/**
 * 간편 신청서(구글 폼) 만들기 · 라운지 신청서와 별개
 *
 * 구글 로그인 없이 누구나 낼 수 있는 짧은 신청서입니다.
 *  1쪽  이름, 연락처, 이메일, 신분(재학생/졸업생/신입 희망/학술회 참가), 알게 된 경로, 개인정보 수집·이용 동의
 *       알게 된 경로에서 '지인 추천'을 고른 사람만 → 2쪽, 나머지는 바로 제출
 *  2쪽  추천해 준 분 이름
 *
 * 실행: 함수 선택에서 createSimpleForm → [실행]
 * 실행 로그에 신청서 주소(공유용), 수정 주소, 응답 시트 주소가 나옵니다.
 * 라운지 자동 연동(sync.gs)과 연결되지 않고, 스크립트 속성(FORM_ID, SHEET_ID)도 건드리지 않습니다.
 * 실행할 때마다 새 신청서가 하나씩 만들어지니 한 번만 실행하세요.
 *
 * 이미 만든 신청서(SIMPLE_FORM_ID)에 '알게 된 경로'와 추천인 칸을 덧붙이려면 addReferralQuestion 을 실행합니다.
 */

// 2026-10-28에 만든 간편 신청서 (https://forms.gle/bcxAfXACaGtTWmCs8)
const SIMPLE_FORM_ID = '1uE1ILq90N2Zj6h2QGkxFw-3bnWT1ePgsMApGdtD22f8';
const SIMPLE_SOURCES = ['학술회 현장', '지인 추천', 'SNS', '학교 홈페이지', '기타'];
const SIMPLE_PRIV = '수집 항목: 이름, 연락처, 이메일, 신분, 알게 된 경로, 추천해 준 분 이름(지인 추천일 때) / 목적: 신청 확인과 안내 연락(행사·입학·소식) / 보관: 수집한 날부터 1년(요청하면 바로 삭제). 동의하지 않을 수 있으며, 이 경우 신청할 수 없습니다. (필수)';
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
  form.addMultipleChoiceItem().setTitle('신분').setChoiceValues(['재학생', '졸업생', '신입 희망', '학술회 참가']).setRequired(true);
  form.addCheckboxItem().setTitle('개인정보 수집·이용 동의')
    .setHelpText('수집 항목: 이름, 연락처, 이메일, 신분 / 목적: 신청 확인과 안내 연락(행사·입학·소식) / 보관: 수집한 날부터 1년(요청하면 바로 삭제). 동의하지 않을 수 있으며, 이 경우 신청할 수 없습니다. (필수)')
    .setChoiceValues(['동의합니다']).setRequired(true);

  simpleReferral_(form);

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
}

// 이미 만든 간편 신청서에 '알게 된 경로'(필수)와 '지인 추천'일 때만 보이는 추천인 칸을 덧붙입니다. 여러 번 실행해도 됩니다.
function addReferralQuestion() {
  const form = FormApp.openById(SIMPLE_FORM_ID);
  simpleReferral_(form);
  Logger.log('알게 된 경로·추천인 칸을 반영했습니다. 응답 수: ' + form.getResponses().length + '\n' + simpleOutline_(form));
}

// 1쪽 동의 바로 앞에 '알게 된 경로', 맨 뒤에 2쪽 '추천해 준 분'. 지인 추천만 2쪽으로, 나머지는 바로 제출.
// '알게 된 경로'는 필수여야 합니다(비워 두면 다음 쪽으로 넘어가기 때문).
function simpleReferral_(form) {
  const PB = FormApp.ItemType.PAGE_BREAK, MC = FormApp.ItemType.MULTIPLE_CHOICE;
  const find = (t, type) => form.getItems().filter(i => i.getTitle() === t && (!type || i.getType() === type))[0];
  const consent = find('개인정보 수집·이용 동의');
  if (!consent) throw new Error('‘개인정보 수집·이용 동의’ 질문을 찾지 못했습니다.');

  if (!find('알게 된 경로', MC)) {
    const src = form.addMultipleChoiceItem().setTitle('알게 된 경로').setHelpText('이 신청서를 어떻게 알게 되셨나요?').setRequired(true);
    form.moveItem(src.getIndex(), consent.getIndex());
  }
  if (!find('추천해 준 분', PB)) {
    form.addPageBreakItem().setTitle('추천해 준 분').setHelpText('소개해 준 분을 알려 주세요.');
    form.addTextItem().setTitle('추천해 준 분 이름').setHelpText('예: 홍길동 (여러 명이면 쉼표로)').setRequired(true)
      .setValidation(FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(40).setHelpText('40자 이내로 적어 주세요.').build());
  }
  const page = find('추천해 준 분', PB).asPageBreakItem();
  const mc = find('알게 된 경로', MC).asMultipleChoiceItem();
  mc.setChoices(SIMPLE_SOURCES.map(v => v === '지인 추천' ? mc.createChoice(v, page) : mc.createChoice(v, FormApp.PageNavigationType.SUBMIT)));
  find('개인정보 수집·이용 동의').asCheckboxItem().setHelpText(SIMPLE_PRIV);
  form.setDescription(SIMPLE_DESC);
}

// 확인용: 쪽·질문 순서와 '알게 된 경로'의 다음 쪽
function simpleOutline_(form) {
  return form.getItems().map(i => {
    const t = i.getType();
    if (t === FormApp.ItemType.PAGE_BREAK) return '── [' + i.getTitle() + ']';
    if (t === FormApp.ItemType.MULTIPLE_CHOICE && i.getTitle() === '알게 된 경로') return '   알게 된 경로: ' + i.asMultipleChoiceItem().getChoices().map(c =>
      c.getValue() + '→' + (c.getPageNavigationType() === FormApp.PageNavigationType.GO_TO_PAGE ? c.getGotoPage().getTitle() : c.getPageNavigationType())).join(', ') +
      (i.asMultipleChoiceItem().isRequired() ? ' (필수)' : '');
    return '   ' + i.getTitle();
  }).join('\n');
}
