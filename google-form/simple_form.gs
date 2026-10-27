/**
 * 간편 신청서(구글 폼) 만들기 · 라운지 신청서와 별개
 *
 * 구글 로그인 없이 누구나 낼 수 있는 짧은 신청서입니다.
 *  이름, 연락처, 이메일, 신분(재학생/졸업생/신입 희망/학술회 참가), 개인정보 수집·이용 동의
 *
 * 실행: 함수 선택에서 createSimpleForm → [실행]
 * 실행 로그에 신청서 주소(공유용), 수정 주소, 응답 시트 주소가 나옵니다.
 * 라운지 자동 연동(sync.gs)과 연결되지 않고, 스크립트 속성(FORM_ID, SHEET_ID)도 건드리지 않습니다.
 * 실행할 때마다 새 신청서가 하나씩 만들어지니 한 번만 실행하세요.
 */
function createSimpleForm() {
  const title = '경희 브랜드MBA 간편 신청서';
  const maxLen = n => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).setHelpText(n + '자 이내로 적어 주세요.').build();

  const form = FormApp.create(title);
  form.setDescription('이름, 연락처, 이메일, 신분만 적어 주세요. 구글 로그인 없이 1분이면 끝나요.\n운영진이 확인하고 안내 연락을 드립니다.');

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
