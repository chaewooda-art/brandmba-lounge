// ─────────────────────────────────────────────────────────────
// 1) Firebase 콘솔 > 프로젝트 설정 > 일반 > 내 앱 > "SDK 설정 및 구성"에서
//    firebaseConfig 값을 복사해 아래에 붙여넣습니다.
//    이 값은 비밀번호가 아니라 앱을 구분하는 공개 값이라 노출돼도 괜찮습니다.
//    (데이터 보호는 firestore.rules 가 서버에서 맡습니다.)
// ─────────────────────────────────────────────────────────────
export const firebaseConfig = {
  apiKey: "AIzaSyC_Rgg4bwWCR4fcfI7EuRM_1MPkCxe8IKE",
  authDomain: "brandmba-lounge.firebaseapp.com",
  projectId: "brandmba-lounge",
  storageBucket: "brandmba-lounge.firebasestorage.app",
  messagingSenderId: "414533002579",
  appId: "1:414533002579:web:b154be39c0e97c33ceeda6"
};

// 2) 동문 신청서(구글 폼) 주소. 비워 두면 링크 버튼이 숨겨집니다.
export const FORM_URL = "";

// 3) Google 로그인 버튼. Firebase 콘솔 > Authentication > 로그인 방법에서
//    Google 을 켠 뒤 true 로 바꿉니다.
export const ENABLE_GOOGLE = false;

// 4) 개인정보처리방침 버전. privacy.html 내용을 고치면 날짜를 바꿉니다.
//    가입할 때 어떤 버전에 동의했는지 함께 저장됩니다.
export const POLICY_VERSION = "2026-11-01";
