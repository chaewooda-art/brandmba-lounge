# BM 동문 라운지

경희대학교 경영대학원 브랜드매니지먼트전공 동문 라운지(lounge.brandmba.com)입니다.
Firebase 무료 플랜(Authentication, Firestore, Hosting)과 구글 폼으로 돌아갑니다.

## 전체 흐름 (2판)

```
① 신청자   구글 폼 신청서 제출 (구글 계정 로그인 필수 · 졸업생/재학생/학술회 참가자)
② 운영진   응답 시트에서 '승인' 체크 → 자동 연동(google-form/sync.gs)이 즉시 라운지 명부에 올림
③ 신청자   라운지 → '신청한 구글 계정으로 로그인' (또는 같은 이메일로 '처음 로그인' 비밀번호)
④ 이용     네트워크 지도, 시너지 추천, 명부, 소개 요청
```

- 이메일은 라운지 이용자끼리 공개, 휴대폰은 운영진과 본인만 봅니다(`private` 컬렉션).
- 신청서를 고친 사람은 응답 시트의 '라운지 반영' 칸을 지우면 새 내용으로 다시 반영됩니다.
- 매일 아침 8시에 놓친 줄을 다시 확인하고, 새 신청이 오면 스크립트 주인에게 알림 메일이 갑니다.
- 자동 연동이 멈추면 운영진 화면 '신청서 직접 가져오기'(시트 복사·붙여넣기)로 같은 일을 할 수 있습니다.

### 자동 연동 설치 (한 번)
1. Apps Script 프로젝트 ‘BM 라운지 신청서 연동’에 `google-form/create_form.gs`(Code.gs), `google-form/sync.gs`(sync.gs), `google-form/appsscript.json`(매니페스트)을 넣습니다.
2. 함수 `setupSync` 실행 → 권한 승인. 실행 계정은 Firebase 프로젝트 소유자여야 합니다.
3. 스크립트는 소유자 권한으로 Firestore에 직접 씁니다(보안 규칙을 거치지 않음). 그래서 `sync.gs`의 `parseRow_`와 `public/js/app.js`의 `parseRow`, 선택지 목록을 늘 같게 유지합니다.

## 파일 구조

```
brandmba-lounge/
├─ public/                화면(사이트에 올라가는 파일)
│  ├─ index.html          라운지
│  ├─ privacy.html        개인정보처리방침 (노란 칸을 채워야 함)
│  ├─ styles.css          디자인
│  └─ js/
│     ├─ config.js        ★ Firebase 설정값, 신청서 주소
│     ├─ constants.js     업종·직무·주고받을 것 선택지, 신청서 질문 제목
│     ├─ api.js           Firebase 읽기·쓰기
│     ├─ app.js           화면과 흐름, 신청서 직접 가져오기
│     ├─ model.js         프로필 읽기 도우미(구분·기수 표시, 기타 글 토큰)
│     ├─ synergy.js       시너지 추천(필요↔제공, 같은 회사, 동종업계, 논문 주제)
│     └─ network.js       네트워크 지도
├─ google-form/
│  ├─ create_form.gs      ★ 신청서(구글 폼)와 응답 시트를 만드는 스크립트
│  ├─ sync.gs             ★ 응답 시트 → 라운지 자동 연동
│  └─ appsscript.json     Apps Script 권한 목록
├─ firestore.rules        ★ 개인정보 보안 규칙(서버에서 막음)
├─ firestore.indexes.json
├─ firebase.json          배포 설정
└─ .firebaserc            ★ 프로젝트 ID
```

---

## 1. Firebase 준비 (웹 화면, 약 15분)

1. **동문회 공용 Gmail**을 만들고 2단계 인증을 켭니다. 운영진이 바뀌면 이 계정을 넘겨줍니다.
2. https://console.firebase.google.com 에 그 계정으로 들어가 **프로젝트 만들기** → 이름 `brandmba-lounge` → Google 애널리틱스는 꺼도 됩니다.
3. **빌드 → Authentication → 시작하기 → 로그인 방법 → 이메일/비밀번호 → 사용 설정 → 저장**
   (아래의 ‘이메일 링크(비밀번호 없는 로그인)’는 켜지 않습니다.)
4. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치: **asia-northeast3 (Seoul)** ← 나중에 바꿀 수 없으니 꼭 확인
   - **프로덕션 모드**로 시작
5. 톱니바퀴 → **프로젝트 설정 → 일반 → 내 앱 → 웹(`</>`)** → 앱 닉네임 `lounge` → 등록
   - 나온 `firebaseConfig` 값을 `public/js/config.js`에 붙여넣고, `projectId`를 `.firebaserc`에도 넣습니다.

## 2. 신청서 만들기 (구글 폼, 약 5분)

1. 같은 공용 Gmail로 https://script.google.com → **새 프로젝트**
2. `google-form/create_form.gs` 내용을 전부 붙여넣고 저장 → 함수 `createLoungeForm` 선택 → **실행** → 권한 승인
3. 실행 로그에 나온 주소 세 개를 챙깁니다.
   - **신청서 주소**: 동문 단체방에 공유하고, `public/js/config.js`의 `FORM_URL`에도 넣습니다.
   - **신청서 수정 주소**, **응답 시트 주소**: 운영진만 봅니다.
4. 응답 시트 맨 오른쪽에 **승인** 체크박스 열이 생겨 있습니다.

> 폼을 직접 만들거나 고칠 때는 **질문 제목과 선택지 글자를 그대로** 둬야 가져오기가 열을 찾습니다.
> (기준: `public/js/constants.js`의 `FORM_COLUMNS`와 선택지 목록)

## 3. 배포

화면(이 폴더의 `public/`)은 GitHub Pages에 올리고, 로그인과 데이터는 Firebase가 맡습니다.
**방법 A는 터미널 없이 웹 화면만으로 끝납니다.**

### 방법 A. GitHub Pages (추천, 지금 쓰는 방법)

1. **보안 규칙 올리기**: Firebase 콘솔 **Firestore Database → 규칙** 탭 → 기존 내용을 지우고 `firestore.rules` 내용을 전부 붙여넣기 → **게시**
   (규칙을 고칠 때마다 같은 방법으로 다시 게시합니다.)
2. **GitHub 저장소**: `chaewooda-art/brandmba-lounge` (공개) 에 이 폴더 내용을 올립니다.
   공개 저장소지만 비밀번호나 동문 정보는 들어 있지 않습니다. config.js의 값은 원래 공개용이고, 데이터는 보안 규칙이 지킵니다.
3. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
   이후 main에 올라올 때마다 자동으로 배포됩니다(1~2분).
4. 주소: `https://chaewooda-art.github.io/brandmba-lounge/`
5. Firebase 콘솔 **Authentication → 설정 → 승인된 도메인**에 `chaewooda-art.github.io` 를 추가합니다.

### 방법 B. Firebase Hosting (Mac 터미널)

```bash
curl -sL https://firebase.tools | bash     # Firebase 도구 설치 (Node 없이 동작)
firebase login                             # 브라우저가 열리면 공용 Gmail로 로그인
cd 내려받은폴더/brandmba-lounge
firebase deploy                            # 화면 + 보안 규칙을 한 번에 올림
```

끝나면 `https://프로젝트ID.web.app` 주소가 나옵니다.

## 4. 첫 운영진 등록

1. 라운지에서 **처음 로그인** → 운영진 본인 이메일 + 새 비밀번호 → 인증 메일 링크 클릭 → ‘아직 명부에 없습니다’ 화면이 나오면 정상입니다.
2. Firebase 콘솔 **Authentication → 사용자** 탭에서 본인의 **사용자 UID**를 복사합니다.
3. **Firestore Database → 데이터 → 컬렉션 시작** → 컬렉션 ID `admins` → 문서 ID에 UID → 필드 `name`(문자열) = 본인 이름 → 저장
4. 라운지를 새로고침하면 **운영진 화면 열기** 버튼이 생깁니다. 본인도 신청서를 내고 가져오면 바로 라운지에 들어갑니다.

운영진 추가도 같은 방법이고, 해제는 `admins`에서 그 문서를 지웁니다.

## 5. lounge.brandmba.com 연결 (나중에)

`lounge` 하위 주소만 추가하므로 우피로 운영 중인 www.brandmba.com 에는 영향이 없습니다.

**방법 A(GitHub Pages)를 쓰는 경우**
1. brandmba.com 도메인을 산 곳(가비아, 후이즈, 카페24 등)의 **DNS 관리**에서 레코드 추가
   - 종류 `CNAME` / 호스트 `lounge` / 값 `chaewooda-art.github.io`
2. 저장소 **Settings → Pages → Custom domain** 에 `lounge.brandmba.com` 입력 → 저장 → **Enforce HTTPS** 체크
3. **Authentication → 설정 → 승인된 도메인**에 `lounge.brandmba.com` 추가

**방법 B(Firebase Hosting)를 쓰는 경우**
1. Firebase 콘솔 **Hosting → 커스텀 도메인 추가** → `lounge.brandmba.com` → 나온 DNS 레코드를 도메인 관리 화면에 추가
2. **Authentication → 설정 → 승인된 도메인**에 `lounge.brandmba.com` 추가

마지막으로 우피 상단 메뉴에 **[동문 라운지]** 링크를 답니다.

## 6. 오픈 전 확인

- [ ] `public/privacy.html`의 노란 칸(책임자 이름·직책·연락처)을 채우고 다시 배포
- [ ] **Authentication → 템플릿**에서 보낸 사람 이름을 `BM 동문 라운지`로 변경
- [ ] 학교 개인정보 담당 부서에 처리방침 확인
- [ ] 운영진 3~5명이 신청서 → 가져오기 → 처음 로그인 → 소개 요청 → 탈퇴까지 시험

---

## 운영 메모

**신청서 가져오기** (운영진 화면)
- 응답 시트에서 등록할 사람의 **승인** 칸을 체크 → 시트 전체 복사(머리글 포함) 후 붙여넣기, 또는 CSV로 내려받아 올리기 → **미리보기** → **명부에 올리기**
- 이미 등록된 동문은 기본으로 건너뜁니다. 동문이 신청서 응답을 고쳤다면 ‘이미 등록된 동문도 덮어쓰기’를 켜고 가져옵니다(라운지에서 직접 고친 내용은 시트 내용으로 바뀝니다).
- 같은 이메일로 여러 번 낸 응답은 마지막 응답만 씁니다.
- 탈퇴한 동문은 다시 가져와도 건너뛰고 ‘시트에서 이 행을 지워 주세요’로 표시됩니다. 처리방침에 따라 **한 달 안에 시트에서 지워 주세요.**

**그 밖에**
- 명부에서 잠시 내릴 동문: 동문 목록에서 ‘명부에서 내리기’
- 백업: 한 달에 한 번 ‘엑셀용 파일 내려받기’. 연락처가 들어 있으니 운영진만 보는 곳에 두고 이전 파일은 지웁니다.
- 알림 메일 없음: 무료 플랜이라 새 신청이나 소개 요청을 메일로 알려주지 않습니다. 운영진은 주 1~2회 응답 시트를, 동문은 상단 ‘소개 요청’의 숫자 표시를 확인합니다.
- 무료 한도(2026년 기준, 결제 수단을 등록하지 않으면 요금이 나가지 않고 한도를 넘으면 그날만 멈춤): Firestore 하루 읽기 5만·쓰기 2만, 인증 메일 하루 1,000통, 비밀번호 재설정 하루 150통. 동문 수백 명 규모는 충분합니다.

## 선택지 바꾸기

업종·직무·주고받을 것을 바꿀 때는 세 곳을 똑같이 고칩니다.
1. `public/js/constants.js` (라운지 화면, 가져오기)
2. `firestore.rules` (새 항목을 추가하거나 영문 키를 바꿀 때)
3. 구글 폼의 선택지 글자

## Google 로그인 켜기 (선택)

Authentication → 로그인 방법 → Google 사용 설정 → `config.js`의 `ENABLE_GOOGLE = true` → 배포.
신청서에 Gmail을 적은 동문은 비밀번호 없이 Google 버튼으로 들어올 수 있습니다.

## 문제가 생기면

| 증상 | 확인할 것 |
|---|---|
| ‘Firebase 설정값이 아직 없습니다’ | `config.js`에 값을 넣고 다시 배포했는지 |
| 로그인했는데 ‘아직 명부에 없습니다’ | 신청서에 적은 이메일과 로그인 이메일이 같은지, 운영진이 가져오기를 했는지 |
| 가져오기에서 ‘열을 찾지 못했습니다’ | 시트 머리글 행까지 복사했는지, 질문 제목을 바꾸지 않았는지 |
| 가져오기에서 ‘목록에 없음’ 오류 | 폼 선택지 글자가 constants.js 목록과 같은지 |
| 인증 메일이 안 옴 | 스팸함(특히 네이버 메일), 템플릿의 보낸 사람 설정 |
| 운영진 버튼이 안 보임 | `admins` 문서 ID가 UID와 정확히 같은지, 새로고침 |

## 내 컴퓨터에서 시험하기 (개발용)

Firebase 에뮬레이터를 켠 상태에서 `http://localhost:5000/?emulator` 로 열면 실제 데이터 대신 에뮬레이터에 연결됩니다.
