/**
 * BM 동문 라운지 신청서(구글 폼) 자동 생성
 *
 * 사용법
 * 1) 동문회 공용 Gmail로 https://script.google.com 에 들어가 [새 프로젝트]
 * 2) 이 코드를 전부 붙여넣고 저장(디스크 아이콘)
 * 3) 위쪽 함수 선택에서 createLoungeForm 을 고르고 [실행] → 권한 승인
 * 4) 아래 [실행 로그]에 세 개의 주소가 나옵니다.
 *    - 동문에게 보낼 신청서 주소  → 단체방에 공유, 라운지 config.js 의 FORM_URL 에도 넣기
 *    - 신청서 수정 주소           → 운영진만
 *    - 응답 시트 주소             → 운영진만. 맨 오른쪽 '승인' 칸을 체크한 뒤 라운지로 가져옵니다.
 *
 * 질문 제목과 선택지는 라운지의 '신청서 가져오기'가 그대로 읽습니다.
 * 바꾸려면 public/js/constants.js 의 FORM_COLUMNS·선택지 목록도 똑같이 바꿔 주세요.
 */

const LOUNGE_URL = 'https://lounge.brandmba.com';

const INDUSTRIES = ['식품·외식', '뷰티·패션', '유통·커머스', '브랜드·광고 에이전시', 'IT·통신·서비스', '제조·건설', '금융·공공', '기타'];
const FUNCTIONS = ['마케팅', '브랜드 전략', '디자인', '고객경험·BX', '콘텐츠·PR', '영업·MD', '전략·사업기획', '경영(대표)', '재무·투자', '운영·시스템', '교육·HR', '기타'];
const HELPS = ['브랜드 전략 자문', '디자인·BX', '퍼포먼스 마케팅', '콘텐츠·SNS', '유통 채널 연결', '해외 진출', '투자·재무', '채용·인재 추천', '데이터 분석', '강연·멘토링', '공동 프로젝트·제휴'];
const SHARE = ['승인된 동문에게 공개', '소개 요청을 수락한 동문에게만 공개'];
const AGREE = '동의합니다';

function createLoungeForm() {
  const maxLen = n => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).setHelpText(n + '자 이내로 적어 주세요.').build();
  const atMost3 = () => FormApp.createCheckboxValidation().requireSelectAtMost(3).setHelpText('3개까지 골라 주세요.').build();

  const form = FormApp.create('경희 브랜드MBA 동문 라운지 신청서');
  form.setDescription(
    '경희대학교 경영대학원 브랜드매니지먼트전공 동문 라운지 신청서입니다.\n' +
    '운영진이 동문임을 확인해 명부에 올리면, ' + LOUNGE_URL + ' 에서 아래에 적은 이메일로 ‘처음 로그인’을 해 라운지를 이용할 수 있습니다.\n' +
    '라운지에서는 명부에 오른 동문끼리만 서로의 정보를 볼 수 있습니다.'
  );
  form.setCollectEmail(false);
  form.setAllowResponseEdits(true);
  form.setConfirmationMessage(
    '신청서를 받았습니다. 운영진이 확인해 명부에 올리면 ' + LOUNGE_URL +
    ' 에서 신청서에 적은 이메일로 ‘처음 로그인’을 해 주세요.'
  );

  form.addSectionHeaderItem().setTitle('기본 정보');
  form.addTextItem().setTitle('이름').setRequired(true).setValidation(maxLen(20));
  form.addTextItem().setTitle('기수').setHelpText('숫자만 적어 주세요. 예: 22').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireNumberBetween(1, 80).setHelpText('1부터 80 사이 숫자로 적어 주세요.').build());
  form.addTextItem().setTitle('라운지 로그인 이메일')
    .setHelpText('라운지에 이 이메일로 로그인합니다. 네이버나 회사 메일도 됩니다. 오타가 없는지 꼭 확인해 주세요.')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().setHelpText('이메일 주소 형식으로 적어 주세요.').build());

  form.addSectionHeaderItem().setTitle('지금 하는 일');
  form.addTextItem().setTitle('회사·소속').setHelpText('예: 식품 대기업, 개인 스튜디오').setRequired(true).setValidation(maxLen(40));
  form.addTextItem().setTitle('직무·직책').setHelpText('예: 브랜드전략팀 팀장').setRequired(true).setValidation(maxLen(40));
  form.addMultipleChoiceItem().setTitle('업종').setChoiceValues(INDUSTRIES).setRequired(true);
  form.addMultipleChoiceItem().setTitle('직무 분야').setChoiceValues(FUNCTIONS).setRequired(true);

  form.addSectionHeaderItem().setTitle('동문과 주고받을 것')
    .setHelpText('두 질문은 같은 목록입니다. 내가 필요한 것을 다른 동문이 줄 수 있으면 라운지 네트워크 지도에서 서로 이어집니다.');
  form.addCheckboxItem().setTitle('내가 줄 수 있는 것').setHelpText('최대 3개').setChoiceValues(HELPS).setRequired(true).setValidation(atMost3());
  form.addCheckboxItem().setTitle('내가 필요한 것').setHelpText('최대 3개').setChoiceValues(HELPS).setRequired(true).setValidation(atMost3());
  form.addTextItem().setTitle('한 줄 소개').setHelpText('선택 · 동문들에게 보일 한 문장').setValidation(maxLen(60));

  form.addSectionHeaderItem().setTitle('연락처');
  form.addTextItem().setTitle('휴대폰').setHelpText('선택 · 010-0000-0000 형식으로 적어 주세요.')
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[0-9+\\-\\s()]{7,20}$').setHelpText('숫자와 하이픈(-)으로 적어 주세요.').build());
  form.addMultipleChoiceItem().setTitle('연락처 공개')
    .setHelpText('이메일과 휴대폰을 누구에게 보여줄지 정합니다. 라운지에서 언제든 바꿀 수 있어요.')
    .setChoiceValues(SHARE).setRequired(true);

  form.addSectionHeaderItem().setTitle('동의');
  form.addCheckboxItem().setTitle('명부 공개 동의')
    .setHelpText('이름, 기수, 회사·소속, 직무·직책, 업종, 직무 분야, 주고받을 것, 한 줄 소개를 운영진이 명부에 올린 동문에게 명부와 네트워크 지도로 보여주는 데 동의합니다. (필수)')
    .setChoiceValues([AGREE]).setRequired(true);
  form.addCheckboxItem().setTitle('개인정보 수집·이용 동의')
    .setHelpText(
      '수집 항목: 이 신청서의 모든 응답 / 목적: 동문 확인, 명부·네트워크 지도 제공, 소개 요청 전달 / 보관: 탈퇴할 때까지. ' +
      '라운지는 Google(Firebase, 구글 폼·시트)을 이용하며 일부 정보는 해외 서버에서 처리될 수 있습니다. ' +
      '자세한 내용: ' + LOUNGE_URL + '/privacy.html (필수)'
    )
    .setChoiceValues([AGREE]).setRequired(true);

  // 응답 시트 만들기
  const ss = SpreadsheetApp.create('BM 동문 라운지 신청서 응답');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  const sheet = ss.getSheets().filter(s => s.getFormUrl())[0];
  if (sheet && sheet.getLastColumn() > 0) {
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue('승인').setFontWeight('bold').setBackground('#f6e7ea');
    sheet.getRange(2, col, 998, 1).insertCheckboxes();
    sheet.setFrozenRows(1);
    ss.getSheets().forEach(s => {
      if (s.getSheetId() !== sheet.getSheetId() && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
    });
  } else {
    Logger.log('※ 응답 시트를 바로 찾지 못했습니다. 응답 시트 맨 오른쪽 빈 열 첫 칸에 “승인”이라고 적고, 그 아래를 체크박스로 만들어 주세요.');
  }

  Logger.log('동문에게 보낼 신청서 주소: ' + form.shortenFormUrl(form.getPublishedUrl()));
  Logger.log('신청서 수정 주소(운영진): ' + form.getEditUrl());
  Logger.log('응답 시트 주소(운영진): ' + ss.getUrl());
}
