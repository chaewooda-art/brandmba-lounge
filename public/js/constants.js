// 가입 선택지 목록
// 왼쪽 영문 키는 firestore.rules 의 목록과 반드시 같아야 합니다.
// 오른쪽 한글 이름은 자유롭게 바꿔도 됩니다(저장된 데이터는 키로 남습니다).

export const INDUSTRIES = {
  food: '식품·외식',
  beauty: '뷰티·패션',
  retail: '유통·커머스',
  agency: '브랜드·광고 에이전시',
  service: 'IT·통신·서비스',
  mfg: '제조·건설',
  public: '금융·공공',
  etc: '기타'
};

export const FUNCTIONS = {
  mkt: '마케팅',
  brand: '브랜드 전략',
  design: '디자인',
  cx: '고객경험·BX',
  content: '콘텐츠·PR',
  sales: '영업·MD',
  strat: '전략·사업기획',
  ceo: '경영(대표)',
  fin: '재무·투자',
  ops: '운영·시스템',
  edu: '교육·HR',
  etc: '기타'
};

export const HELPS = {
  brand: '브랜드 전략 자문',
  design: '디자인·BX',
  perf: '퍼포먼스 마케팅',
  content: '콘텐츠·SNS',
  channel: '유통 채널 연결',
  global: '해외 진출',
  invest: '투자·재무',
  hiring: '채용·인재 추천',
  data: '데이터 분석',
  mentor: '강연·멘토링',
  partner: '공동 프로젝트·제휴'
};

export const TYPES = {
  grad: '졸업생',
  student: '재학생',
  conf: '학술회 참가자'
};

export const YEARS = {
  y0: '3년 이하',
  y4: '4~7년',
  y8: '8~12년',
  y13: '13~19년',
  y20: '20년 이상'
};

export const MAX_PICK = 3;
export const MAX_CAREER = 3;      // 주요 경력 줄 수
export const CAREER_LEN = 60;     // 경력 한 줄 글자 수
export const THESIS_LEN = 100;    // 논문 제목 글자 수
export const ETC_LEN = 60;        // '기타' 직접 입력 글자 수
export const YEAR_MIN = 1995, YEAR_MAX = 2030; // 입학 연도 범위
export const COHORT_MAX = 99;

// 구글 폼 질문 제목 = 응답 시트의 머리글. 자동 연동과 운영진 화면의 '신청서 직접 가져오기'가 이 제목으로 열을 찾습니다.
// google-form/create_form.gs, google-form/sync.gs 의 질문 제목과 같아야 합니다.
export const FORM_COLUMNS = {
  email: '이메일 주소',          // 구글 로그인 계정 이메일(폼이 자동 수집)
  type: '구분',
  name: '이름',
  thesis: '학위논문 제목',
  year: '입학 연도',
  cohort: '기수',
  org: '회사·소속',
  title: '직무·직책',
  industry: '업종',
  fn: '직무 분야',
  years: '총 경력 연차',
  career: '주요 경력',
  offer: '내가 줄 수 있는 것',
  need: '내가 필요한 것',
  intro: '한 줄 소개',
  phone: '휴대폰',
  agreeMap: '공개 동의',
  agreePriv: '개인정보 수집·이용 동의',
  approve: '승인',
  synced: '라운지 반영'
};
export const AGREE = '동의합니다';
