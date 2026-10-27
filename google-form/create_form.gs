/**
 * BM 라운지 신청서(구글 폼) 자동 생성 · 3판
 *
 * 사용법
 * 1) 운영진 Gmail로 https://script.google.com 에서 프로젝트를 열고 이 코드를 붙여넣은 뒤 저장
 * 2) 함수 선택에서 createLoungeForm 을 고르고 [실행] → 권한 승인
 * 3) 아래 [실행 로그]에 나온 주소를 챙깁니다.
 *    - 신청서 주소      → 단체방에 공유, 라운지 config.js 의 FORM_URL 에도 넣기
 *    - 신청서 수정 주소 → 운영진만
 *    - 응답 시트 주소   → 운영진만. '승인' 칸을 체크하면 라운지에 반영됩니다.
 *
 * 신청서 구조 (3판)
 *  1쪽  구분(졸업생/재학생/학술회 참가자), 이름
 *       졸업생·재학생 → 동문 정보 / 학술회 참가자 → 학술회 참가자 정보
 *  2쪽  입학 연도(필수), 기수(선택) (졸업생·재학생) → 4쪽으로
 *  3쪽  현재 신분, 입학 관심, 입학 안내 받기(선택) (학술회 참가자만)
 *  4쪽  지금 하는 일과 경력
 *  5쪽  라운지에서 주고받을 것
 *  6쪽  연락처와 동의
 *
 * 학위논문 제목은 받지 않습니다(신청서·라운지 모두).
 *
 * 이미 만든 2판 신청서 고치기(응답은 그대로)
 *  - addConfQuestions     학술회 참가자 정보 쪽 덧붙이기
 *  - removeThesisQuestion 학위논문 질문과 '졸업생 정보' 쪽 지우기
 *
 * 구글 계정 로그인이 있어야 신청할 수 있고, 로그인한 계정 이메일이 응답 시트의 '이메일 주소' 열에
 * 자동으로 남습니다. 이 이메일이 라운지 로그인 이메일입니다.
 *
 * 질문 제목과 선택지는 라운지가 그대로 읽습니다.
 * 바꾸려면 public/js/constants.js 의 FORM_COLUMNS·선택지 목록도 똑같이 바꿔 주세요.
 */

// 라운지 주소. lounge.brandmba.com 을 연결하면 바꿔 주세요(폼 설명·확인 메시지에 들어갑니다).
const LOUNGE_URL = 'https://chaewooda-art.github.io/brandmba-lounge';
// 1판 신청서. 새 신청서를 만들면 응답을 받지 않도록 닫고 새 주소를 안내합니다. 비워 두면 건드리지 않습니다.
const OLD_FORM_ID = '1Vt7eVCq6J3_QwN1juBMmjqgsMGtmmvaSFN3DLE0istg';

const TYPES = ['졸업생', '재학생', '학술회 참가자'];
const INDUSTRIES = ['식품·외식', '뷰티·패션', '유통·커머스', '브랜드·광고 에이전시', 'IT·통신·서비스', '제조·건설', '금융·공공', '기타'];
const FUNCTIONS = ['마케팅', '브랜드 전략', '디자인', '고객경험·BX', '콘텐츠·PR', '영업·MD', '전략·사업기획', '경영(대표)', '재무·투자', '운영·시스템', '교육·HR', '기타'];
const YEARS = ['경력 없음(학생)', '3년 이하', '4~7년', '8~12년', '13~19년', '20년 이상'];
const HELPS = ['브랜드 전략 자문', '디자인·BX', '퍼포먼스 마케팅', '콘텐츠·SNS', '유통 채널 연결', '해외 진출', '투자·재무', '채용·인재 추천', '데이터 분석', '강연·멘토링', '공동 프로젝트·제휴', '입학·진학 상담'];
const STAGES = ['직장인·실무자', '교수·연구자', '대학생(학부)', '대학원생', '기타'];
const ADMITS = ['관심 있어요', '이미 지원했거나 합격했어요', '아니요'];
const AGREE = '동의합니다';
const ADMIT_INFO_YES = '받을게요';

// 3판 문구 (createLoungeForm 과 addConfQuestions 가 함께 씀)
const T = {
  desc: '경희대학교 경영대학원 브랜드매니지먼트전공 라운지 신청서입니다. 동문(졸업생·재학생)과 학술회 참가자(학부생, 입학 관심자 포함)가 신청할 수 있어요.\n\n' +
    '· 구글 계정으로 로그인해야 신청할 수 있어요. 로그인한 구글 계정 이메일이 라운지 로그인 이메일이 됩니다.\n' +
    '· 운영진이 확인해 등록하면 ' + LOUNGE_URL + ' 에서 같은 이메일로 들어올 수 있어요.\n' +
    '· 라운지에서는 등록된 이용자끼리 서로의 프로필과 이메일을 볼 수 있어요. 학부생·입학 관심자는 소개 요청이 수락된 상대의 이메일을 볼 수 있어요. 휴대폰 번호는 운영진만 봅니다.',
  confPage: '학술회 참가자 정보',
  confHelp: '학술회 참가자만 답합니다. 비슷한 처지의 사람, 입학 이야기를 들려줄 동문과 이어 드리는 데 씁니다.',
  stageHelp: '지금 하는 일에 가장 가까운 것',
  admitTitle: '입학 관심',
  admitHelp: '경희대 경영대학원 브랜드매니지먼트전공 입학에 관심이 있나요? 관심 있다고 답하면 라운지에 ‘입학 관심’으로 표시되고, 입학 이야기를 들려줄 재학생·졸업생과 이어 드려요. 라운지 이용자의 이메일은 소개 요청이 수락된 상대의 것만 보여요.',
  infoTitle: '입학 안내 받기',
  infoHelp: '선택 · 운영진이 브랜드매니지먼트전공 입학 설명회·모집 안내를 휴대폰·이메일로 보내 드려요. 원하지 않으면 비워 두세요. 라운지 ‘내 프로필’에서 언제든 끌 수 있어요.',
  org: '예: CJ제일제당, 개인 스튜디오, ○○대학교 · 학생이면 학교·학과',
  title: '예: 브랜드전략팀 팀장 · 학생이면 전공·학년',
  industry: '학생이면 관심 있는 업종을 골라 주세요.',
  map: '이름, 구분, 입학 연도·기수, 현재 신분·입학 관심(학술회 참가자), 회사·소속, 직무·직책, 업종, 직무 분야, 경력, 주고받을 것, 한 줄 소개, 구글 계정 이메일을 라운지에 등록된 이용자(동문·학술회 참가자)에게 보여주는 데 동의합니다. 휴대폰 번호와 입학 안내 받기 여부는 공개되지 않습니다. (필수)',
  priv: '수집 항목: 이 신청서의 모든 응답과 구글 계정 이메일 / 목적: 신청자 확인, 라운지(명부·네트워크 지도·시너지 추천) 제공, 운영진의 라운지 운영·행사 안내 연락, 입학 안내 받기를 고른 분께 입학 설명회·모집 안내 / 보관: 탈퇴할 때까지. ' +
    '라운지는 Google(Firebase, 구글 폼·시트)을 이용하며 일부 정보는 해외 서버에서 처리될 수 있습니다. ' +
    '자세한 내용: ' + LOUNGE_URL + '/privacy.html (필수)'
};
const FN_HELP = '최대 3개 · 가까운 것부터 골라 주세요. 목록에 없으면 ‘기타’에 직접 적어 주세요.';
const HELP_HELP = '최대 3개 · 목록에 없으면 ‘기타’에 직접 적어 주세요.';

function createLoungeForm() {
  const maxLen = n => FormApp.createTextValidation().requireTextLengthLessThanOrEqualTo(n).setHelpText(n + '자 이내로 적어 주세요.').build();
  const atMost3 = () => FormApp.createCheckboxValidation().requireSelectAtMost(3).setHelpText('3개까지 골라 주세요.').build();

  const form = FormApp.create('경희 브랜드MBA 라운지 신청서');
  form.setDescription(T.desc);
  // 구글 계정 로그인 필수 + 계정 이메일 자동 수집
  if (FormApp.EmailCollectionType && typeof form.setEmailCollectionType === 'function') {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } else {
    form.setCollectEmail(true);
  }
  form.setLimitOneResponsePerUser(true); // 계정당 한 번. 고칠 때는 '응답 수정'
  form.setAllowResponseEdits(true);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    '신청서를 받았습니다. 운영진이 확인해 등록하면 ' + LOUNGE_URL + ' 에서 이 구글 계정 이메일로 들어올 수 있어요.\n' +
    '내용을 고치려면 이 신청서를 다시 열고 ‘응답 수정’을 누르세요.'
  );

  // 1쪽: 구분, 이름 (구분에 따라 다음 쪽이 달라짐)
  const typeItem = form.addMultipleChoiceItem().setTitle('구분').setRequired(true);
  form.addTextItem().setTitle('이름').setRequired(true).setValidation(maxLen(20));

  // 2쪽: 졸업생·재학생
  const pAlumni = form.addPageBreakItem().setTitle('동문 정보');
  form.addTextItem().setTitle('입학 연도').setHelpText('숫자 네 자리로 적어 주세요. 예: 2015').setRequired(true)
    .setValidation(FormApp.createTextValidation().requireNumberBetween(1995, 2030).setHelpText('1995부터 2030 사이 연도로 적어 주세요.').build());
  form.addTextItem().setTitle('기수')
    .setHelpText('선택 · 숫자만. 기억나지 않으면 비워 두세요. 운영진이 입학 연도로 확인해요.')
    .setValidation(FormApp.createTextValidation().requireNumberBetween(1, 80).setHelpText('1부터 80 사이 숫자로 적어 주세요.').build());

  // 3쪽: 학술회 참가자만
  const pConf = form.addPageBreakItem().setTitle(T.confPage).setHelpText(T.confHelp);
  confItems_(form);

  // 4쪽: 모두
  const pWork = form.addPageBreakItem().setTitle('지금 하는 일과 경력')
    .setHelpText('같은 업종·같은 회사를 거친 사람과 이어 드리는 데 씁니다.');
  form.addTextItem().setTitle('회사·소속').setHelpText(T.org).setRequired(true).setValidation(maxLen(40));
  form.addTextItem().setTitle('직무·직책').setHelpText(T.title).setRequired(true).setValidation(maxLen(40));
  form.addMultipleChoiceItem().setTitle('업종').setHelpText(T.industry).setChoiceValues(INDUSTRIES).setRequired(true);
  form.addCheckboxItem().setTitle('직무 분야').setHelpText(FN_HELP).setChoiceValues(FUNCTIONS.filter(x => x !== '기타')).showOtherOption(true).setRequired(true).setValidation(atMost3());
  form.addMultipleChoiceItem().setTitle('총 경력 연차').setChoiceValues(YEARS).setRequired(true);
  form.addParagraphTextItem().setTitle('주요 경력')
    .setHelpText('선택 · 한 줄에 하나씩, 최대 3줄. ‘회사 · 직무 · 기간’ 순서로 적으면 같은 회사를 거친 사람을 찾아 드려요.\n예)\nCJ제일제당 · 브랜드매니저 · 2015–2020\n○○에이전시 · AE · 2011–2015')
    .setValidation(FormApp.createParagraphTextValidation().requireTextLengthLessThanOrEqualTo(200).setHelpText('200자 이내로 적어 주세요.').build());

  // 5쪽: 모두
  form.addPageBreakItem().setTitle('라운지에서 주고받을 것')
    .setHelpText('두 질문은 같은 목록이에요. 내가 필요한 것을 다른 사람이 줄 수 있으면 라운지가 서로를 추천해 드려요.');
  form.addCheckboxItem().setTitle('내가 줄 수 있는 것').setHelpText(HELP_HELP).setChoiceValues(HELPS).showOtherOption(true).setRequired(true).setValidation(atMost3());
  form.addCheckboxItem().setTitle('내가 필요한 것').setHelpText(HELP_HELP).setChoiceValues(HELPS).showOtherOption(true).setRequired(true).setValidation(atMost3());
  form.addTextItem().setTitle('한 줄 소개').setHelpText('선택 · 라운지 이용자에게 보일 한 문장').setValidation(maxLen(60));

  // 6쪽: 모두
  form.addPageBreakItem().setTitle('연락처와 동의');
  form.addTextItem().setTitle('휴대폰')
    .setHelpText('운영진만 봅니다. 라운지 이용자에게는 공개되지 않아요. 예: 010-1234-5678')
    .setRequired(true)
    .setValidation(FormApp.createTextValidation().requireTextMatchesPattern('^[0-9+\\-\\s()]{9,20}$').setHelpText('숫자와 하이픈(-)으로 적어 주세요.').build());
  form.addCheckboxItem().setTitle('공개 동의').setHelpText(T.map).setChoiceValues([AGREE]).setRequired(true);
  form.addCheckboxItem().setTitle('개인정보 수집·이용 동의').setHelpText(T.priv).setChoiceValues([AGREE]).setRequired(true);

  // 구분에 따라 다음 쪽: 졸업생·재학생 → 동문 정보, 학술회 참가자 → 학술회 참가자 정보
  typeItem.setChoices([
    typeItem.createChoice(TYPES[0], pAlumni),
    typeItem.createChoice(TYPES[1], pAlumni),
    typeItem.createChoice(TYPES[2], pConf)
  ]);
  // 동문 정보(2쪽)를 마치면 학술회 참가자 정보(3쪽)를 건너뛰고 지금 하는 일(4쪽)로
  pConf.setGoToPage(pWork);

  if (typeof form.setPublished === 'function') form.setPublished(true);
  form.setAcceptingResponses(true);

  // 응답 시트 + 운영진 열(승인, 라운지 반영)
  const ss = SpreadsheetApp.create('BM 라운지 신청서 응답');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  const sheet = ss.getSheets().filter(s => s.getFormUrl())[0];
  if (sheet && sheet.getLastColumn() > 0) {
    const col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col, 1, 2).setValues([['승인', '라운지 반영']]).setFontWeight('bold').setBackground('#f6e7ea');
    sheet.getRange(2, col, 998, 1).insertCheckboxes();
    sheet.setColumnWidth(col + 1, 220);
    sheet.setFrozenRows(1);
    ss.getSheets().forEach(s => {
      if (s.getSheetId() !== sheet.getSheetId() && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
    });
  } else {
    Logger.log('※ 응답 시트를 바로 찾지 못했습니다. 맨 오른쪽 빈 열에 “승인”(체크박스)과 “라운지 반영” 열을 만들어 주세요.');
  }

  const shortUrl = form.shortenFormUrl(form.getPublishedUrl());
  PropertiesService.getScriptProperties().setProperties({ FORM_ID: form.getId(), SHEET_ID: ss.getId() });

  // 1판 신청서 닫기
  if (OLD_FORM_ID) {
    try {
      FormApp.openById(OLD_FORM_ID).setAcceptingResponses(false)
        .setCustomClosedFormMessage('신청서가 새로 바뀌었습니다. 이 주소에서 신청해 주세요: ' + shortUrl);
      Logger.log('1판 신청서는 응답을 받지 않도록 닫고 새 주소를 안내했습니다.');
    } catch (e) {
      Logger.log('1판 신청서를 닫지 못했습니다(이미 지웠거나 권한 없음): ' + e);
    }
  }

  Logger.log('이메일 수집: ' + (form.getEmailCollectionType ? form.getEmailCollectionType() : (form.collectsEmail() ? '수집' : '안 함')) +
    ' · 게시: ' + (form.isPublished ? form.isPublished() : '확인 불가') + ' · 응답 받는 중: ' + form.isAcceptingResponses());
  Logger.log('신청서 주소: ' + shortUrl);
  Logger.log('신청서 수정 주소(운영진): ' + form.getEditUrl());
  Logger.log('응답 시트 주소(운영진): ' + ss.getUrl());
}

/* ---------- 고치기 ---------- */

// 이미 만든 신청서의 '직무 분야'를 한 개 선택 → 최대 3개 선택으로 바꿉니다(응답이 없을 때만).
// 응답 시트 머리글도 새 질문 순서로 다시 만들고, '승인'·'라운지 반영' 열을 다시 붙입니다.
function fixFnQuestion() {
  const P = PropertiesService.getScriptProperties();
  const form = FormApp.openById(P.getProperty('FORM_ID'));
  if (form.getResponses().length) throw new Error('응답이 이미 있어 바꾸지 않았습니다. 폼 편집 화면에서 질문 유형을 체크박스로 바꿔 주세요.');
  const find = title => form.getItems().filter(i => i.getTitle() === title)[0];
  let fn = find('직무 분야');
  if (!fn) throw new Error('‘직무 분야’ 질문을 찾지 못했습니다.');
  if (fn.getType() !== FormApp.ItemType.CHECKBOX) {
    const cb = form.addCheckboxItem().setTitle('직무 분야').setHelpText('최대 3개 · 가까운 것부터 골라 주세요.')
      .setChoiceValues(FUNCTIONS).setRequired(true)
      .setValidation(FormApp.createCheckboxValidation().requireSelectAtMost(3).setHelpText('3개까지 골라 주세요.').build());
    form.deleteItem(fn);
    fn = form.getItemById(cb.getId());
  }
  // '업종' 바로 다음 자리로
  const target = find('업종').getIndex() + 1;
  if (fn.getIndex() !== target) form.moveItem(fn.getIndex(), fn.getIndex() > target ? target : target - 1);

  // 응답 시트: 같은 파일 안에 새 응답 탭을 만들고, 머리글만 있는 이전 탭은 지움
  const ss = SpreadsheetApp.openById(P.getProperty('SHEET_ID'));
  form.removeDestination();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  Utilities.sleep(3000);
  const sheet = ss.getSheets().filter(s => s.getFormUrl())[0];
  if (!sheet) throw new Error('새 응답 탭을 찾지 못했습니다.');
  ss.getSheets().forEach(s => { if (s.getSheetId() !== sheet.getSheetId() && s.getLastRow() <= 1) ss.deleteSheet(s); });
  const col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col, 1, 2).setValues([['승인', '라운지 반영']]).setFontWeight('bold').setBackground('#f6e7ea');
  sheet.getRange(2, col, 998, 1).insertCheckboxes();
  sheet.setColumnWidth(col + 1, 220);
  sheet.setFrozenRows(1);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  Logger.log('직무 분야를 최대 3개 선택으로 바꿨습니다. 응답 시트 머리글: ' + sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].join(' | '));
}

// 이미 만든 신청서의 '직무 분야', '내가 줄 수 있는 것', '내가 필요한 것'에 직접 적는 '기타'를 붙입니다.
// '직무 분야'의 일반 선택지 '기타'는 직접 적는 '기타'로 바꿉니다. 여러 번 실행해도 됩니다.
function addOtherOptions() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const find = title => form.getItems().filter(i => i.getTitle() === title)[0];
  const fn = find('직무 분야').asCheckboxItem();
  fn.setChoiceValues(FUNCTIONS.filter(x => x !== '기타')).showOtherOption(true).setHelpText(FN_HELP);
  ['내가 줄 수 있는 것', '내가 필요한 것'].forEach(t => find(t).asCheckboxItem().showOtherOption(true).setHelpText(HELP_HELP));
  const show = t => { const it = find(t).asCheckboxItem(); return t + ': ' + it.getChoices().map(c => c.getValue()).join(', ') + (it.hasOtherOption() ? ', 기타(직접 입력)' : ''); };
  Logger.log(['직무 분야', '내가 줄 수 있는 것', '내가 필요한 것'].map(show).join('\n'));
}

/* ---------- 3판: 학술회 참가자 정보 ---------- */

// 학술회 참가자 정보 쪽의 질문 셋(현재 신분, 입학 관심, 입학 안내 받기)을 폼 끝에 추가하고 돌려줍니다.
function confItems_(form) {
  return [
    form.addMultipleChoiceItem().setTitle('현재 신분').setHelpText(T.stageHelp).setChoiceValues(STAGES).setRequired(true),
    form.addMultipleChoiceItem().setTitle(T.admitTitle).setHelpText(T.admitHelp).setChoiceValues(ADMITS).setRequired(true),
    form.addCheckboxItem().setTitle(T.infoTitle).setHelpText(T.infoHelp).setChoiceValues([ADMIT_INFO_YES])
  ];
}

// 이미 만든 2판 신청서에 '학술회 참가자 정보' 쪽을 덧붙입니다. 이미 낸 응답은 그대로 남고,
// 응답 시트에는 새 질문 열이 생깁니다(자동 연동은 열 제목으로 찾으므로 순서는 상관없음). 여러 번 실행해도 됩니다.
//  - 구분 '학술회 참가자' → 학술회 참가자 정보 → 지금 하는 일과 경력
//  - 졸업생·재학생은 동문 정보를 마치면 학술회 참가자 정보를 건너뜀
//  - 주고받을 것에 '입학·진학 상담', 총 경력 연차에 '경력 없음(학생)'
//  - 학생을 위한 도움말, 공개 동의·개인정보 동의 문구 갱신
function addConfQuestions() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const items = () => form.getItems();
  const find = (title, type) => items().filter(i => i.getTitle() === title && (!type || i.getType() === type))[0];
  const PB = FormApp.ItemType.PAGE_BREAK;
  const pThesis = find('졸업생 정보', PB), pAlumni = find('동문 정보', PB), pWork = find('지금 하는 일과 경력', PB);
  if (!pAlumni || !pWork) throw new Error('신청서의 쪽(동문 정보, 지금 하는 일과 경력)을 찾지 못했습니다.');

  // 1) 학술회 참가자 정보 쪽: '지금 하는 일과 경력' 바로 앞에
  let pConf = find(T.confPage, PB);
  if (!pConf) {
    const pb = form.addPageBreakItem().setTitle(T.confPage).setHelpText(T.confHelp);
    form.moveItem(pb.getIndex(), pWork.getIndex());
    const made = confItems_(form);
    made.forEach((it, n) => form.moveItem(it.getIndex(), find(T.confPage, PB).getIndex() + 1 + n));
    pConf = find(T.confPage, PB);
  }
  pConf = pConf.asPageBreakItem();
  const work = find('지금 하는 일과 경력', PB).asPageBreakItem();
  pConf.setGoToPage(work); // 동문 정보를 마치면 지금 하는 일로

  // 2) 구분 → 다음 쪽
  const typeItem = find('구분', FormApp.ItemType.MULTIPLE_CHOICE).asMultipleChoiceItem();
  typeItem.setChoices([
    typeItem.createChoice(TYPES[0], (pThesis || pAlumni).asPageBreakItem()),
    typeItem.createChoice(TYPES[1], pAlumni.asPageBreakItem()),
    typeItem.createChoice(TYPES[2], pConf)
  ]);

  // 3) 선택지·문구
  ['내가 줄 수 있는 것', '내가 필요한 것'].forEach(t => find(t).asCheckboxItem().setChoiceValues(HELPS).showOtherOption(true).setHelpText(HELP_HELP));
  find('총 경력 연차').asMultipleChoiceItem().setChoiceValues(YEARS);
  find('회사·소속').asTextItem().setHelpText(T.org);
  find('직무·직책').asTextItem().setHelpText(T.title);
  find('업종').asMultipleChoiceItem().setHelpText(T.industry);
  find('공개 동의').asCheckboxItem().setHelpText(T.map);
  find('개인정보 수집·이용 동의').asCheckboxItem().setHelpText(T.priv);
  form.setDescription(T.desc);

  Logger.log('학술회 참가자 정보 쪽을 반영했습니다. 응답 수: ' + form.getResponses().length + '\n' + formOutline_(form));
}

// 신청서의 쪽·질문 순서와 구분별 다음 쪽을 글로 (확인용)
function formOutline_(form) {
  const PB = FormApp.ItemType.PAGE_BREAK;
  return form.getItems().map(i => {
    const t = i.getType();
    if (t === PB) { const g = i.asPageBreakItem().getGoToPage(); return '── [' + i.getTitle() + ']' + (g ? ' (앞 쪽을 마치면 → ' + g.getTitle() + ')' : ''); }
    if (t === FormApp.ItemType.MULTIPLE_CHOICE && i.getTitle() === '구분') return '   구분: ' + i.asMultipleChoiceItem().getChoices().map(c => c.getValue() + '→' + (c.getPageNavigationType() === FormApp.PageNavigationType.GO_TO_PAGE ? c.getGotoPage().getTitle() : c.getPageNavigationType())).join(', ');
    return '   ' + i.getTitle();
  }).join('\n');
}

/* ---------- 학위논문 질문 지우기 ---------- */

// 신청서에서 '학위논문 제목' 질문과 그 질문만 있던 '졸업생 정보' 쪽을 지웁니다. 여러 번 실행해도 됩니다.
// 졸업생도 재학생처럼 1쪽 → 동문 정보로 갑니다. 공개 동의 문구도 새로 맞춥니다.
// 이미 받은 응답의 논문 제목은 응답 시트의 예전 열에 남습니다(라운지는 읽지 않음).
function removeThesisQuestion() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty('FORM_ID'));
  const find = (title, type) => form.getItems().filter(i => i.getTitle() === title && (!type || i.getType() === type))[0];
  const PB = FormApp.ItemType.PAGE_BREAK;
  const pAlumni = find('동문 정보', PB);
  if (!pAlumni) throw new Error('‘동문 정보’ 쪽을 찾지 못했습니다.');

  // 1) 구분: 졸업생도 동문 정보로 (쪽을 지우기 전에 먼저 바꿔야 함)
  const typeItem = find('구분', FormApp.ItemType.MULTIPLE_CHOICE).asMultipleChoiceItem();
  const next = typeItem.getChoices().map(c => [c.getValue(), c.getPageNavigationType() === FormApp.PageNavigationType.GO_TO_PAGE ? c.getGotoPage() : null]);
  typeItem.setChoices(next.map(([v, page]) => typeItem.createChoice(v,
    v === TYPES[0] || !page || page.getTitle() === '졸업생 정보' ? pAlumni.asPageBreakItem() : page)));

  // 2) 질문과 쪽 지우기
  const q = find('학위논문 제목'), p = find('졸업생 정보', PB);
  if (q) form.deleteItem(q);
  if (p) form.deleteItem(p);

  // 3) 공개 동의 문구에서 논문 빼기
  const map = find('공개 동의');
  if (map) map.asCheckboxItem().setHelpText(T.map);

  Logger.log((q || p ? '학위논문 질문을 지웠습니다.' : '이미 지워져 있습니다.') + ' 응답 수: ' + form.getResponses().length + '\n' + formOutline_(form));
}
