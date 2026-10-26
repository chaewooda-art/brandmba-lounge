// 라운지 화면과 흐름 (신청서 방식)
// 구글 폼 신청 → 운영진이 응답을 가져와 등록 → 동문은 신청서 이메일로 '처음 로그인' → 지도·명부·소개 요청

import { INDUSTRIES as IND, FUNCTIONS as FN, HELPS as HELP, MAX_PICK, FORM_COLUMNS as COL, SHARE_YES, AGREE } from './constants.js';
import * as api from './api.js';
import { ENABLE_GOOGLE, FORM_URL } from './config.js';
import { mountNetwork } from './network.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const helps = (giver, taker) => (giver.offer || []).filter(x => (taker.need || []).includes(x));
const labels = (arr, dict = HELP) => (arr || []).map(k => dict[k] || k);
const tags = (arr, dict = HELP) => (arr && arr.length)
  ? `<span class="tags">${arr.map(k => `<span class="tag">${esc(dict[k] || k)}</span>`).join('')}</span>`
  : '<span class="muted">없음</span>';
const when = ts => { const d = ts && ts.toDate ? ts.toDate() : null; return d ? `${d.getMonth() + 1}월 ${d.getDate()}일` : '방금'; };
const ms = ts => (ts && ts.toMillis ? ts.toMillis() : Date.now());
const formLink = (cls = 'btn btn-ghost') => FORM_URL ? `<a class="${cls}" href="${esc(FORM_URL)}" target="_blank" rel="noopener">신청서 작성하기</a>` : '';

const S = {
  user: null, mid: null, admin: false, member: null, members: [], intros: { received: [], sent: [] },
  all: [], allContacts: {}, withdrawn: new Set(), imp: null, adminQ: '',
  view: 'boot', loginTab: 'login', form: null,
  filter: { q: '', ind: 'all', helpMe: false }, netSel: null,
  unsubMember: null, net: null, withdrawing: false, lastStatus: undefined
};

/* ---------- 공통 조각 ---------- */
let sealN = 0;
function seal(size, inv) {
  const id = 'seal' + (++sealN);
  const bg = inv ? 'var(--crimson-ink)' : 'var(--crimson)', fg = inv ? 'var(--crimson)' : 'var(--crimson-ink)';
  return `<svg class="seal" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><path id="${id}" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0"/></defs><circle cx="50" cy="50" r="48" style="fill:${bg}"/><circle cx="50" cy="50" r="43.5" style="fill:none;stroke:${fg};stroke-width:.8;opacity:.6"/><circle cx="50" cy="50" r="26" style="fill:none;stroke:${fg};stroke-width:.8;opacity:.6"/><text style="fill:${fg};font-family:var(--mono);font-size:7.4px;letter-spacing:1.3px"><textPath href="#${id}">KYUNG HEE · BRAND MBA · EST. 1998 ·</textPath></text><text x="50" y="58.5" text-anchor="middle" style="fill:${fg};font-family:var(--display);font-size:23px;font-weight:700">BM</text></svg>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); }, 5200);
}

let lastFocus = null;
function openModal(html) {
  const m = $('#modal');
  if (m.hidden) lastFocus = document.activeElement;
  m.innerHTML = `<div class="m-back" data-act="close"></div><div class="m-panel" role="dialog" aria-modal="true" tabindex="-1"><button class="m-x" data-act="close" aria-label="닫기">×</button>${html}</div>`;
  m.hidden = false; document.body.style.overflow = 'hidden';
  m.querySelector('.m-panel').focus();
}
function closeModal() {
  const m = $('#modal');
  if (m.hidden) return;
  m.hidden = true; m.innerHTML = ''; document.body.style.overflow = '';
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function errMsg(e) {
  const M = {
    'auth/invalid-email': '이메일 주소 형식을 확인해 주세요.',
    'auth/missing-password': '비밀번호를 입력해 주세요.',
    'auth/email-already-in-use': '이미 비밀번호를 만든 이메일입니다. 로그인하거나 비밀번호 재설정을 눌러 주세요.',
    'auth/weak-password': '비밀번호는 8자 이상으로 정해 주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다. 처음이라면 ‘처음 로그인’에서 비밀번호를 만들어 주세요.',
    'auth/wrong-password': '비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/too-many-requests': '시도가 너무 많아 잠시 막혔습니다. 몇 분 뒤 다시 시도해 주세요.',
    'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해 주세요.',
    'auth/popup-blocked': '브라우저가 로그인 창을 막았습니다. 팝업을 허용한 뒤 다시 시도해 주세요.',
    'auth/requires-recent-login': '보안을 위해 다시 로그인한 뒤 시도해 주세요.',
    'auth/user-mismatch': '지금 로그인한 계정으로 다시 인증해 주세요.',
    'permission-denied': '권한이 없습니다. 이메일 인증 상태나 운영진 권한을 확인해 주세요.',
    'unavailable': '서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.',
    'intro/exists': '이미 이 동문에게 소개 요청을 보냈습니다.'
  };
  return M[e && e.code] || '문제가 생겼습니다. 잠시 뒤 다시 시도해 주세요.';
}
function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = text || '처리 중…'; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}

/* ---------- 화면 ---------- */
const V = {};

V.boot = () => `<div class="boot" role="status"><span class="spinner" aria-hidden="true"></span>불러오는 중</div>`;

V.setup = () => `<div class="wrap narrow"><section class="card pend">
  <p class="eyebrow-k">설정 필요</p>
  <h1>Firebase 설정값이 아직 없습니다</h1>
  <p class="sub"><code>public/js/config.js</code>에 Firebase 콘솔에서 복사한 설정값을 넣은 뒤 다시 배포해 주세요. 순서는 README.md에 있습니다.</p>
</section></div>`;

V.login = () => {
  const t = S.loginTab;
  return `<div class="wrap login">
  <section class="login-intro" aria-labelledby="lt">
    ${seal(84)}
    <p class="eyebrow">KYUNG HEE BRAND MBA · SINCE 1998</p>
    <h1 id="lt">경희 브랜드MBA<br>동문 라운지</h1>
    <p class="lead">1기부터 지금까지, 브랜드를 만드는 사람들이 서로를 찾는 곳입니다. 신청서를 내고 운영진이 명부에 등록한 동문만 들어올 수 있습니다.</p>
    <ol class="flow">
      <li><b>신청서 제출</b><span>구글 폼</span></li>
      <li><b>운영진 등록</b><span>동문 여부 확인</span></li>
      <li><b>처음 로그인</b><span>신청서 이메일로 비밀번호 만들기</span></li>
      <li><b>라운지 이용</b><span>지도, 명부, 소개 요청</span></li>
    </ol>
    ${FORM_URL ? `<p class="hint">아직 신청서를 내지 않으셨나요? ${formLink('linkish')}</p>` : ''}
  </section>
  <section class="login-box card" aria-label="로그인">
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected="${t === 'login'}" data-act="tab" data-tab="login">로그인</button>
      <button role="tab" aria-selected="${t === 'activate'}" data-act="tab" data-tab="activate">처음 로그인</button>
    </div>
    ${t === 'login' ? `<form id="login-form" class="stack" novalidate>
      <div class="field"><label for="li-email">이메일</label><input id="li-email" type="email" autocomplete="username" required></div>
      <div class="field"><label for="li-pw">비밀번호</label><input id="li-pw" type="password" autocomplete="current-password" required></div>
      <p class="ferr" id="li-err" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">로그인</button>
      <button class="linklike" type="button" data-act="forgot">비밀번호를 잊으셨나요?</button>
    </form>` : `<form id="act-form" class="stack" novalidate>
      <p class="hint">신청서에 적은 <b>라운지 로그인 이메일</b>로 비밀번호를 만듭니다. 인증 메일의 링크를 누르면 바로 들어갈 수 있어요.</p>
      <div class="field"><label for="ac-email">신청서에 적은 이메일</label><input id="ac-email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="ac-pw">새 비밀번호 <small>8자 이상</small></label><input id="ac-pw" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="field"><label for="ac-pw2">비밀번호 확인</label><input id="ac-pw2" type="password" autocomplete="new-password" required></div>
      <p class="ferr" id="ac-err" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">비밀번호 만들고 인증 메일 받기</button>
    </form>`}
    ${ENABLE_GOOGLE ? `<p class="or">또는</p><button class="btn btn-ghost btn-block" type="button" data-act="google">Google 계정으로 계속하기</button><p class="mini">신청서에 Gmail을 적었다면 바로 쓸 수 있습니다.</p>` : ''}
    <p class="mini"><a href="privacy.html" target="_blank" rel="noopener">개인정보처리방침</a></p>
  </section>
</div>`;
};

V.verify = () => `<div class="wrap narrow"><section class="card pend" aria-labelledby="vt">
  <p class="eyebrow-k">처음 로그인 · 이메일 인증</p>
  <h1 id="vt">인증 메일을 보냈습니다</h1>
  <p class="sub"><b>${esc(S.user.email)}</b> 메일함에서 인증 링크를 누른 뒤, 아래 버튼을 눌러 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</p>
  <div class="row-btns">
    <button class="btn btn-primary" data-act="verified">인증을 마쳤어요</button>
    <button class="btn btn-ghost" data-act="resend">인증 메일 다시 보내기</button>
  </div>
  <button class="linklike" data-act="logout">다른 이메일로 로그인</button>
</section></div>`;

V.notyet = () => `<div class="wrap narrow"><section class="card pend" aria-labelledby="nt">
  <p class="eyebrow-k">명부 등록 전</p>
  <h1 id="nt">이 이메일은 아직 명부에 없습니다</h1>
  <p class="sub"><b>${esc(S.user.email)}</b>(으)로 로그인했어요. 신청서에 적은 이메일과 같은지 확인해 주세요. 신청서를 이미 냈다면 운영진이 등록하는 대로 이 화면이 라운지로 바뀝니다.</p>
  <ol class="steps">
    <li><b>신청서 제출</b><span>구글 폼</span></li>
    <li class="now"><b>운영진 등록</b><span>보통 며칠 안에</span></li>
    <li><b>라운지 이용</b><span>등록 후 바로</span></li>
  </ol>
  <div class="row-btns">${S.admin ? '<a class="btn btn-primary" href="#/admin">운영진 화면 열기</a>' : ''}${formLink(S.admin ? 'btn btn-ghost' : 'btn btn-primary')}<button class="btn btn-ghost" data-act="logout">다른 이메일로 로그인</button></div>
</section></div>`;

V.hidden = () => `<div class="wrap narrow"><section class="card pend" aria-labelledby="ht">
  <p class="eyebrow-k">명부에서 내려감</p>
  <h1 id="ht">지금은 라운지를 이용할 수 없습니다</h1>
  <p class="sub">운영진이 명부에서 잠시 내린 상태입니다. 궁금한 점은 동문회 단체방이나 운영진에게 문의해 주세요.</p>
  <div class="row-btns">${S.admin ? '<a class="btn btn-primary" href="#/admin">운영진 화면 열기</a>' : ''}<button class="btn btn-ghost" data-act="logout">로그아웃</button></div>
</section></div>`;

V.form = () => {
  const f = S.form;
  const inp = (k, label, type, attrs = '') => `<div class="field"><label for="f-${k}">${label}</label><input id="f-${k}" data-key="${k}" type="${type}" value="${esc(f[k])}" ${attrs}><p class="ferr" id="e-${k}"></p></div>`;
  const grp = (k, label, dict, max, single) => {
    const btns = Object.entries(dict).map(([val, lab]) => {
      const on = single ? f[k] === val : f[k].includes(val);
      return `<button type="button" class="pick" data-act="pick" data-val="${val}" aria-pressed="${on}">${esc(lab)}</button>`;
    }).join('');
    return `<div class="field"><span class="label" id="lb-${k}">${label}${single ? '' : ` <small id="cnt-${k}">${f[k].length}/${max}</small>`}</span><div class="picks" role="group" aria-labelledby="lb-${k}" data-key="${k}" data-group="${k}" data-max="${max}"${single ? ' data-single="1"' : ''} tabindex="-1">${btns}</div><p class="ferr" id="e-${k}"></p></div>`;
  };
  return `<div class="wrap narrow">
  <header class="page-head">
    <p class="eyebrow-k">프로필 수정</p>
    <h1>내 프로필 고치기</h1>
    <p class="sub">바꾼 내용은 명부와 네트워크 지도에 바로 반영됩니다.</p>
  </header>
  <form id="pf" novalidate>
    <section class="fs" aria-labelledby="fs1"><h2 id="fs1">기본 정보</h2>
      <div class="g2">
        ${inp('name', '이름', 'text', 'autocomplete="name" maxlength="20"')}
        ${inp('cohort', '기수', 'text', 'inputmode="numeric" maxlength="2"')}
      </div>
      <div class="field"><span class="label">로그인 이메일</span><p class="static">${esc(S.user.email)}</p><p class="mini">이메일을 바꾸려면 운영진에게 요청해 주세요.</p></div>
    </section>
    <section class="fs" aria-labelledby="fs2"><h2 id="fs2">지금 하는 일</h2>
      <div class="g2">
        ${inp('org', '회사·소속', 'text', 'maxlength="40"')}
        ${inp('title', '직무·직책', 'text', 'maxlength="40"')}
      </div>
      ${grp('industry', '업종', IND, 1, true)}
      ${grp('fn', '직무 분야', FN, 1, true)}
    </section>
    <section class="fs" aria-labelledby="fs3"><h2 id="fs3">동문과 주고받을 것</h2>
      <p class="hint">두 항목은 같은 목록에서 고릅니다. 내가 필요한 것을 다른 동문이 줄 수 있으면 네트워크 지도에 선이 생깁니다.</p>
      ${grp('offer', '내가 줄 수 있는 것', HELP, MAX_PICK, false)}
      ${grp('need', '내가 필요한 것', HELP, MAX_PICK, false)}
      ${inp('intro', '한 줄 소개 <small>선택 · 최대 60자</small>', 'text', 'maxlength="60" placeholder="동문들에게 보일 한 문장"')}
    </section>
    <section class="fs" aria-labelledby="fs4"><h2 id="fs4">연락처 공개</h2>
      ${inp('phone', '휴대폰 <small>선택</small>', 'tel', 'maxlength="20" autocomplete="tel" placeholder="010-0000-0000"')}
      <label class="check"><input type="checkbox" id="f-share" data-key="share" ${f.share ? 'checked' : ''}><span>승인된 동문에게 내 이메일과 휴대폰 공개<small>끄면 소개 요청을 내가 수락한 동문에게만 보입니다.</small></span></label>
    </section>
    <div class="form-foot">
      <p class="err-sum" id="err-sum" role="alert"></p>
      <button type="button" class="btn btn-ghost" data-act="cancel-edit">취소</button>
      <button class="btn btn-primary" type="submit" id="pf-submit">저장하기</button>
    </div>
  </form>
</div>`;
};

V.net = () => `<div class="wrap wide">
  <header class="page-head split">
    <div><p class="eyebrow-k">네트워크 지도</p><h1>나와 이어지는 동문</h1></div>
    <p class="sub">점 하나가 동문 한 명입니다. 선은 한쪽이 필요한 것을 다른 쪽이 줄 수 있는 두 사람이고, 빛이 흐르는 방향이 도움이 가는 방향이에요.</p>
  </header>
  <div id="net-root"></div>
</div>`;

V.dir = () => {
  const f = S.filter;
  return `<div class="wrap">
  <header class="page-head"><p class="eyebrow-k">동문 명부</p><h1>누가 어디서 무슨 일을 하고 있을까요</h1></header>
  <div class="toolbar">
    <label><span class="sr-only">동문 검색</span><input id="dir-q" type="search" placeholder="이름, 회사, 직책, 기수로 찾기" value="${esc(f.q)}"></label>
    <div class="filters" role="group" aria-label="업종으로 거르기">
      <button class="pick" data-act="ind" data-val="all" aria-pressed="${f.ind === 'all'}">전체</button>
      ${Object.entries(IND).map(([k, v]) => `<button class="pick" data-act="ind" data-val="${k}" aria-pressed="${f.ind === k}">${esc(v)}</button>`).join('')}
    </div>
    <label class="toggle"><input type="checkbox" id="dir-help" ${f.helpMe ? 'checked' : ''}>나에게 도움 줄 수 있는 동문만 보기</label>
  </div>
  <p class="count" id="dir-count" aria-live="polite"></p>
  <div class="dir-grid" id="dir-list"></div>
</div>`;
};
function dirCard(u) {
  const self = u.uid === S.mid, h = self ? [] : helps(u, S.member);
  return `<button class="dcard" data-act="profile" data-id="${u.uid}">
    <span class="dtop"><span>${esc(IND[u.industry] || '')}</span><span class="coh">${u.cohort}기</span></span>
    <span class="dname">${esc(u.name)}${self ? '<span class="me-tag">나</span>' : ''}</span>
    <span class="drole">${esc(u.org)} · ${esc(u.title)}</span>
    <span class="mini">줄 수 있는 것</span>
    ${tags(u.offer)}
    ${h.length ? `<span class="dmatch">내게 필요한 ${esc(HELP[h[0]])} 도움 가능</span>` : ''}
  </button>`;
}
function renderDirList() {
  const box = $('#dir-list'); if (!box) return;
  const f = S.filter, q = f.q.trim().toLowerCase();
  const L = S.members.filter(u => {
    if (f.ind !== 'all' && u.industry !== f.ind) return false;
    if (f.helpMe && (u.uid === S.mid || !helps(u, S.member).length)) return false;
    if (q) {
      const hay = [u.name, u.org, u.title, IND[u.industry], FN[u.fn], u.cohort + '기', u.intro, ...labels(u.offer), ...labels(u.need)].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.cohort - b.cohort || a.name.localeCompare(b.name, 'ko'));
  $('#dir-count').textContent = `동문 ${S.members.length}명 중 ${L.length}명`;
  box.innerHTML = L.length ? L.map(dirCard).join('') : '<p class="empty">조건에 맞는 동문이 없습니다. 검색어나 업종을 바꿔 보세요.</p>';
}

V.intros = () => {
  const by = (a, b) => ms(b.createdAt) - ms(a.createdAt);
  const R = S.intros.received.slice().sort(by), Sn = S.intros.sent.slice().sort(by);
  const who = id => S.members.find(m => m.uid === id);
  const badge = st => ({ pending: '<span class="badge warn">대기 중</span>', accepted: '<span class="badge ok">수락됨</span>', declined: '<span class="badge">거절됨</span>' }[st] || '');
  const recv = i => `<article class="icard">
    <header><b>${esc(i.fromName)}</b><span>${i.fromCohort}기</span>${badge(i.status)}<time>${when(i.createdAt)}</time></header>
    <p class="imsg">${esc(i.message)}</p>
    ${i.status === 'pending' ? `<div class="row-btns"><button class="btn btn-primary btn-sm" data-act="accept" data-id="${esc(i.id)}">수락하고 연락처 공개</button><button class="btn btn-ghost btn-sm" data-act="decline" data-id="${esc(i.id)}">거절</button>${who(i.from) ? `<button class="btn btn-ghost btn-sm" data-act="profile" data-id="${esc(i.from)}">프로필 보기</button>` : ''}</div>` : ''}
    ${i.status === 'accepted' ? `<div class="contact" data-contact="${esc(i.from)}"><span class="muted">연락처 불러오는 중</span></div>` : ''}
  </article>`;
  const sent = i => { const m = who(i.to); return `<article class="icard">
    <header><b>${m ? esc(m.name) : '동문'}</b>${m ? `<span>${m.cohort}기</span>` : ''}${badge(i.status)}<time>${when(i.createdAt)}</time></header>
    <p class="imsg">${esc(i.message)}</p>
    ${i.status === 'accepted' ? `<div class="contact" data-contact="${esc(i.to)}"><span class="muted">연락처 불러오는 중</span></div>` : ''}
    ${i.status === 'pending' ? `<div class="row-btns"><button class="btn btn-ghost btn-sm" data-act="cancel-intro" data-id="${esc(i.id)}">요청 취소</button></div>` : ''}
    ${i.status === 'declined' ? `<div class="row-btns"><span class="muted">이번에는 연결되지 않았습니다.</span><button class="btn btn-ghost btn-sm" data-act="cancel-intro" data-id="${esc(i.id)}">목록에서 지우기</button></div>` : ''}
  </article>`; };
  return `<div class="wrap narrow">
  <header class="page-head"><p class="eyebrow-k">소개 요청</p><h1>동문과 연결되는 곳</h1>
  <p class="sub">요청을 수락하면 두 사람의 이메일과 휴대폰이 서로에게 공개됩니다. 새 요청은 메일로 알려드리지 않으니 가끔 들러 확인해 주세요.</p></header>
  <section class="isec" aria-labelledby="ir"><h2 id="ir">받은 요청 <span class="muted">${R.length}</span></h2>${R.length ? R.map(recv).join('') : '<p class="empty">아직 받은 요청이 없습니다.</p>'}</section>
  <section class="isec" aria-labelledby="is"><h2 id="is">보낸 요청 <span class="muted">${Sn.length}</span></h2>${Sn.length ? Sn.map(sent).join('') : '<p class="empty">지도나 명부에서 동문을 골라 소개 요청을 보내 보세요.</p>'}</section>
</div>`;
};

V.me = () => {
  const u = S.member, others = S.members.filter(o => o.uid !== u.uid);
  const inn = others.filter(o => helps(o, u).length).length, out = others.filter(o => helps(u, o).length).length;
  const no = `BM-${String(u.cohort).padStart(2, '0')}-${S.mid.slice(0, 4).toUpperCase()}`;
  return `<div class="wrap">
  <header class="page-head"><p class="eyebrow-k">내 프로필</p><h1>${esc(u.name)}</h1></header>
  <div class="me-grid">
    <div class="mcard" role="img" aria-label="${esc(u.name)} 동문증, ${u.cohort}기, ${esc(IND[u.industry] || '')}, 회원번호 ${no}">
      <div class="mc-top">${seal(52, true)}<p class="mc-eyebrow">BRAND MBA<br>ALUMNI</p></div>
      <div><p class="mc-name">${esc(u.name)}</p><p class="mc-meta">${u.cohort}기 · ${esc(IND[u.industry] || '')}</p><p class="mc-no">${no}</p></div>
    </div>
    <section class="card me-body" aria-label="프로필 정보">
      <dl class="kv">
        <dt>회사·직책</dt><dd>${esc(u.org)} · ${esc(u.title)}</dd>
        <dt>업종 · 직무</dt><dd>${esc(IND[u.industry] || '')} · ${esc(FN[u.fn] || '')}</dd>
        <dt>줄 수 있는 것</dt><dd>${tags(u.offer)}</dd>
        <dt>필요한 것</dt><dd>${tags(u.need)}</dd>
        <dt>한 줄 소개</dt><dd>${u.intro ? esc(u.intro) : '<span class="muted">비어 있음</span>'}</dd>
        <dt>연락처</dt><dd data-mycontact><span class="muted">불러오는 중</span></dd>
      </dl>
      <div class="row-btns"><button class="btn btn-ghost" data-act="edit-profile">프로필 고치기</button><button class="btn btn-ghost" data-act="logout">로그아웃</button></div>
    </section>
  </div>
  <section class="card me-links"><p><b>${inn}명</b>이 내가 필요한 것을 줄 수 있고, 나는 <b>${out}명</b>에게 도움을 줄 수 있습니다.</p><a class="btn btn-primary" href="#/net" data-act="center-me">지도에서 보기</a></section>
  <section class="danger"><h2>탈퇴</h2><p class="hint">탈퇴하면 프로필, 연락처, 주고받은 소개 요청이 바로 삭제되고 되돌릴 수 없습니다. 운영진이 신청서 응답도 지웁니다.</p><button class="btn btn-danger-ghost" data-act="withdraw">라운지 탈퇴하기</button></section>
</div>`;
};

/* ---------- 운영진 화면 ---------- */
V.admin = () => {
  const A = S.all.filter(u => u.status === 'approved'), Hd = S.all.filter(u => u.status === 'hidden');
  const counts = Object.keys(IND).map(k => [k, A.filter(u => u.industry === k).length]).filter(c => c[1]);
  const mx = Math.max(1, ...counts.map(c => c[1]));
  return `<div class="wrap">
  <header class="page-head"><p class="eyebrow-k">운영진</p><h1>명부 관리</h1>
  <p class="sub">구글 폼 신청서 응답을 가져와 명부에 올립니다. 명부에 오른 동문은 신청서에 적은 이메일로 ‘처음 로그인’을 하면 바로 들어올 수 있습니다.</p></header>
  <div class="tiles">
    <div class="card tile"><span>명부에 오른 동문</span><b>${A.length}<small>명</small></b></div>
    <div class="card tile"><span>명부에서 내린 동문</span><b>${Hd.length}<small>명</small></b></div>
    <div class="card tile"><span>탈퇴 기록</span><b>${S.withdrawn.size}<small>건</small></b></div>
  </div>

  <section class="card imp" aria-labelledby="ai">
    <div class="sec-head"><h2 id="ai">신청서 가져오기</h2></div>
    <ol class="howto">
      <li>신청서 응답 구글 시트에서 등록할 사람의 <b>승인</b> 칸을 체크합니다.</li>
      <li>시트 전체를 선택해 복사(머리글 행 포함)한 뒤 아래 칸에 붙여넣거나, <b>파일 → 다운로드 → 쉼표로 구분된 값(.csv)</b>으로 받은 파일을 올립니다.</li>
      <li>미리보기를 확인하고 등록합니다. 이미 등록된 동문은 기본으로 건너뜁니다.</li>
    </ol>
    <div class="field"><label for="imp-text">시트 붙여넣기</label><textarea id="imp-text" rows="5" placeholder="구글 시트에서 머리글 행까지 복사해 붙여넣기"></textarea></div>
    <div class="row-btns imp-opts">
      <label class="btn btn-ghost btn-sm file-btn">CSV 파일 올리기<input type="file" id="imp-file" accept=".csv,text/csv,text/plain" hidden></label>
      <label class="check"><input type="checkbox" id="imp-over"><span>이미 등록된 동문도 시트 내용으로 덮어쓰기</span></label>
      <label class="check"><input type="checkbox" id="imp-rejoin"><span>탈퇴했던 동문도 다시 등록</span></label>
    </div>
    <div class="row-btns"><button class="btn btn-primary" data-act="imp-preview">미리보기</button></div>
    <div id="imp-result" aria-live="polite">${S.imp ? impHTML(S.imp) : ''}</div>
  </section>

  <section class="adm-sec" aria-labelledby="al">
    <div class="sec-head"><h2 id="al">동문 목록</h2><span class="muted">${S.all.length}명</span><button class="btn btn-ghost btn-sm push" data-act="reload-admin">새로고침</button></div>
    <label><span class="sr-only">동문 찾기</span><input id="adm-q" type="search" placeholder="이름, 이메일, 회사, 기수로 찾기" value="${esc(S.adminQ)}"></label>
    <div class="arows" id="adm-list"></div>
  </section>

  <div class="two">
    <section class="card dist" aria-labelledby="ad"><h2 id="ad">업종 분포</h2>
      ${counts.length ? counts.map(([k, c]) => `<div class="drow"><span>${esc(IND[k])}</span><span class="dbar"><i style="width:${(c / mx * 100).toFixed(1)}%"></i></span><b>${c}</b></div>`).join('') : '<p class="hint">아직 명부에 오른 동문이 없습니다.</p>'}
    </section>
    <section class="card backup" aria-labelledby="ab"><h2 id="ab">명부 백업</h2>
      <p class="hint">무료 플랜에는 자동 백업이 없어서 한 달에 한 번 전체 명부를 엑셀용 파일로 받아 둡니다. 연락처가 들어 있으니 운영진만 보는 곳에 두고, 새 백업을 받으면 이전 파일은 지워 주세요.</p>
      <div><button class="btn btn-ghost" data-act="backup">엑셀용 파일 내려받기</button></div>
    </section>
  </div>
  <p class="hint">운영진 추가와 해제는 Firebase 콘솔의 admins 컬렉션에서 합니다. README.md를 참고하세요.</p>
</div>`;
};
function renderAdminList() {
  const box = $('#adm-list'); if (!box) return;
  const q = S.adminQ.trim().toLowerCase();
  const L = S.all.filter(u => {
    if (!q) return true;
    const c = S.allContacts[u.uid] || {};
    return [u.name, u.org, u.title, u.cohort + '기', c.email].join(' ').toLowerCase().includes(q);
  }).sort((a, b) => (a.status === b.status ? 0 : a.status === 'hidden' ? -1 : 1) || a.cohort - b.cohort || a.name.localeCompare(b.name, 'ko'));
  box.innerHTML = L.length ? L.slice(0, 300).map(u => {
    const c = S.allContacts[u.uid] || {};
    return `<div class="arow">
      <div class="a-who"><b>${esc(u.name)}</b><span>${u.cohort}기</span>${u.status === 'hidden' ? ' <span class="badge warn">내림</span>' : ''}<small>${esc(c.email || '')}${c.phone ? ' · ' + esc(c.phone) : ''}</small></div>
      <div class="a-job">${esc(u.org)} · ${esc(u.title)}</div>
      <div class="a-ind">${esc(IND[u.industry] || '')}</div>
      <div class="a-date">${u.status === 'hidden' ? '' : '등록 ' + when(u.createdAt)}</div>
      <div class="a-act">${u.status === 'hidden'
        ? `<button class="btn btn-ghost btn-sm" data-act="unhide" data-id="${u.uid}">다시 올리기</button>`
        : `<button class="btn btn-ghost btn-sm" data-act="hide" data-id="${u.uid}">명부에서 내리기</button>`}</div>
    </div>`;
  }).join('') + (L.length > 300 ? `<p class="hint">${L.length - 300}명 더 있음. 검색으로 찾아 주세요.</p>` : '')
    : '<p class="empty">찾는 동문이 없습니다.</p>';
}

/* ---------- 신청서 가져오기 ---------- */
// CSV(쉼표)와 시트 복사(탭) 모두 읽습니다. 따옴표 안의 줄바꿈·쉼표도 처리.
function parseTable(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = first.includes('\t') ? '\t' : ',';
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); out.push(row); }
  return out.filter(r => r.some(c => String(c).trim() !== ''));
}
const squash = s => String(s || '').replace(/\s+/g, '').toLowerCase();
const keyOf = (dict, label) => Object.keys(dict).find(k => squash(dict[k]) === squash(label)) || null;
const truthy = v => /^(true|o|y|yes|예|승인|v|✓|✔|1|☑)$/i.test(String(v || '').trim());

async function buildImport(text, opts) {
  const table = parseTable(text);
  if (table.length < 2) return { fatal: '머리글 행과 응답이 함께 들어 있는지 확인해 주세요.' };
  const head = table[0].map(h => String(h).trim());
  const idx = {};
  Object.entries(COL).forEach(([k, title]) => { const i = head.findIndex(h => squash(h) === squash(title)); if (i >= 0) idx[k] = i; });
  const required = ['name', 'cohort', 'email', 'org', 'title', 'industry', 'fn'];
  const missing = required.filter(k => idx[k] == null).map(k => COL[k]);
  if (missing.length) return { fatal: `시트에서 이 열을 찾지 못했습니다: ${missing.join(', ')}. 질문 제목이 바뀌었는지 확인해 주세요.` };
  const hasApprove = idx.approve != null;
  const cell = (r, k) => idx[k] == null ? '' : String(r[idx[k]] ?? '').trim();
  const multi = (r, k, errs) => {
    const raw = cell(r, k); if (!raw) return [];
    const keys = [];
    raw.split(/\s*,\s*/).filter(Boolean).forEach(lab => { const key = keyOf(HELP, lab); if (key) { if (!keys.includes(key)) keys.push(key); } else errs.push(`${COL[k]}: ‘${lab}’은(는) 목록에 없음`); });
    if (keys.length > MAX_PICK) errs.push(`${COL[k]}: ${MAX_PICK}개까지만 고를 수 있음`);
    return keys.slice(0, MAX_PICK);
  };
  const rows = [];
  for (let n = 1; n < table.length; n++) {
    const r = table[n], errs = [];
    const email = api.normEmail(cell(r, 'email'));
    const name = cell(r, 'name'), cohortRaw = cell(r, 'cohort').replace(/기$/, ''), cohort = parseInt(cohortRaw, 10);
    if (!name) errs.push('이름 없음'); else if (name.length > 20) errs.push('이름이 20자를 넘음');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.push('로그인 이메일 형식 오류');
    if (!/^\d{1,2}$/.test(cohortRaw) || cohort < 1 || cohort > 80) errs.push('기수 오류');
    const org = cell(r, 'org').slice(0, 40), title = cell(r, 'title').slice(0, 40);
    if (!org) errs.push('회사·소속 없음');
    if (!title) errs.push('직무·직책 없음');
    const industry = keyOf(IND, cell(r, 'industry')), fn = keyOf(FN, cell(r, 'fn'));
    if (!industry) errs.push(`업종 ‘${cell(r, 'industry')}’ 확인 필요`);
    if (!fn) errs.push(`직무 분야 ‘${cell(r, 'fn')}’ 확인 필요`);
    const offer = multi(r, 'offer', errs), need = multi(r, 'need', errs);
    if (idx.agreeMap != null && !cell(r, 'agreeMap').includes(AGREE)) errs.push('명부 공개 동의 없음');
    if (idx.agreePriv != null && !cell(r, 'agreePriv').includes(AGREE)) errs.push('개인정보 동의 없음');
    let phone = cell(r, 'phone').slice(0, 20);
    if (/^1\d{8,9}$/.test(phone)) phone = '0' + phone; // 시트가 앞자리 0을 지운 경우
    const share = squash(cell(r, 'share')) === squash(SHARE_YES);
    const intro = cell(r, 'intro').slice(0, 60);
    rows.push({ line: n + 1, name, cohort, email, approved: hasApprove ? truthy(cell(r, 'approve')) : true, errs,
      profile: { name, cohort, industry, fn, org, title, offer, need, intro }, contact: { email, phone, share } });
  }
  await Promise.all(rows.map(async r => { r.mid = r.errs.length && !r.email.includes('@') ? null : await api.memberId(r.email); }));
  // 같은 이메일이 여러 번이면 마지막 응답을 씀
  const lastByMid = new Map();
  rows.forEach(r => { if (r.mid) lastByMid.set(r.mid, r); });
  const existing = new Map(S.all.map(m => [m.uid, m]));
  rows.forEach(r => {
    if (r.errs.length) { r.action = 'error'; return; }
    if (lastByMid.get(r.mid) !== r) { r.action = 'dup'; return; }
    if (!r.approved) { r.action = 'unapproved'; return; }
    if (S.withdrawn.has(r.mid) && !opts.rejoin) { r.action = 'withdrawn'; return; }
    const ex = existing.get(r.mid);
    if (ex) { r.existing = { status: ex.status, createdAt: ex.createdAt }; r.action = opts.over ? 'update' : 'exists'; return; }
    r.rejoin = S.withdrawn.has(r.mid);
    r.action = 'create';
  });
  return { rows, hasApprove };
}
const ACT = {
  create: ['새로 등록', 'ok'], update: ['덮어쓰기', 'ok'], exists: ['이미 등록됨 · 건너뜀', ''],
  unapproved: ['승인 체크 안 됨 · 건너뜀', ''], withdrawn: ['탈퇴한 동문 · 시트에서 이 행을 지워 주세요', 'warn'],
  dup: ['같은 이메일의 이전 응답 · 마지막 응답 사용', ''], error: ['오류', 'err']
};
function impHTML(imp) {
  if (imp.fatal) return `<p class="imp-fatal">${esc(imp.fatal)}</p>`;
  if (imp.done) return `<p class="imp-done">${imp.done}</p>`;
  const c = a => imp.rows.filter(r => r.action === a).length;
  const go = c('create') + c('update');
  const order = ['error', 'withdrawn', 'create', 'update', 'exists', 'unapproved', 'dup'];
  const rows = imp.rows.slice().sort((a, b) => order.indexOf(a.action) - order.indexOf(b.action) || a.line - b.line);
  return `<div class="imp-sum">
      <span><b>${c('create')}</b> 새로 등록</span><span><b>${c('update')}</b> 덮어쓰기</span>
      <span><b>${c('exists') + c('unapproved') + c('dup')}</b> 건너뜀</span>
      ${c('withdrawn') ? `<span class="w"><b>${c('withdrawn')}</b> 탈퇴</span>` : ''}${c('error') ? `<span class="e"><b>${c('error')}</b> 오류</span>` : ''}
    </div>
    ${imp.hasApprove ? '' : '<p class="hint">시트에 ‘승인’ 열이 없어 오류 없는 모든 응답을 등록 대상으로 봤습니다.</p>'}
    <div class="imp-table"><table>
      <thead><tr><th scope="col">행</th><th scope="col">이름</th><th scope="col">기수</th><th scope="col">로그인 이메일</th><th scope="col">처리</th></tr></thead>
      <tbody>${rows.map(r => `<tr class="${ACT[r.action][1]}"><td class="num">${r.line}</td><td>${esc(r.name || '—')}</td><td class="num">${Number.isFinite(r.cohort) ? r.cohort + '기' : '—'}</td><td>${esc(r.email || '—')}</td><td>${ACT[r.action][0]}${r.errs.length ? `<small>${esc(r.errs.join(' · '))}</small>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="row-btns">${go ? `<button class="btn btn-primary" data-act="imp-run">${go}명 명부에 올리기</button>` : '<span class="muted">등록할 응답이 없습니다.</span>'}<button class="btn btn-ghost" data-act="imp-clear">지우기</button></div>`;
}

/* ---------- 모달 ---------- */
function introWith(id) {
  return { s: S.intros.sent.find(i => i.to === id), r: S.intros.received.find(i => i.from === id) };
}
function profileHTML(u) {
  const self = u.uid === S.mid, h = self ? [] : helps(u, S.member), g = self ? [] : helps(S.member, u);
  const { s, r } = introWith(u.uid);
  const linked = (s && s.status === 'accepted') || (r && r.status === 'accepted');
  let cta = '';
  if (!self) {
    if (linked) cta = '<span class="badge ok">연결됨</span>';
    else if (s && s.status === 'pending') cta = '<span class="badge warn">소개 요청 보냄 · 답 기다리는 중</span>';
    else if (r && r.status === 'pending') cta = `<a class="btn btn-primary" href="#/intros" data-act="close">받은 요청 확인하기</a>`;
    else if (!s) cta = `<button class="btn btn-primary" data-act="intro" data-id="${u.uid}">소개 요청하기</button>`;
  }
  return `<div class="pm-head">
    <p class="dtop"><span>${esc(IND[u.industry] || '')} · ${esc(FN[u.fn] || '')}</span><span class="coh">${u.cohort}기</span></p>
    <h2>${esc(u.name)}${self ? '<span class="me-tag">나</span>' : ''}</h2>
    <p class="drole">${esc(u.org)} · ${esc(u.title)}</p>
  </div>
  ${u.intro ? `<p class="intro">${esc(u.intro)}</p>` : ''}
  <dl class="kv"><dt>줄 수 있는 것</dt><dd>${tags(u.offer)}</dd><dt>필요한 것</dt><dd>${tags(u.need)}</dd></dl>
  ${self ? '' : `<div class="rel">
    ${h.length ? `<p>이 동문은 내가 필요한 <b>${esc(labels(h).join(', '))}</b> 쪽으로 도움을 줄 수 있습니다.</p>` : ''}
    ${g.length ? `<p>나는 이 동문이 필요한 <b>${esc(labels(g).join(', '))}</b> 쪽으로 도움을 줄 수 있습니다.</p>` : ''}
    ${!h.length && !g.length ? '<p>아직 서로 겹치는 항목은 없습니다. 같은 업종이나 기수로 먼저 인사해 보세요.</p>' : ''}
  </div>`}
  <div class="contact" data-contact="${u.uid}"><span class="muted">연락처 확인 중</span></div>
  <div class="row-btns"><a class="btn btn-ghost" href="#/net" data-act="map-of" data-id="${u.uid}">지도에서 보기</a>${cta}</div>`;
}
// 운영진은 규칙상 모든 연락처를 읽을 수 있지만, 일반 화면에서는 동문과 같은 기준으로만 보여줍니다.
function contactVisible(id, c) {
  if (!c) return false;
  if (id === S.mid || c.share) return true;
  return S.intros.sent.some(i => i.to === id && i.status === 'accepted')
    || S.intros.received.some(i => i.from === id && i.status === 'accepted');
}
function contactHTML(c, visible) {
  if (!c || !visible) return '<span class="mini">연락처</span><span class="muted">비공개 · 소개 요청이 수락되면 서로 공개됩니다</span>';
  return `<span class="mini">연락처</span><code>${esc(c.email)}</code>${c.phone ? `<code>${esc(c.phone)}</code>` : ''}<button class="btn btn-ghost btn-sm" data-act="copy" data-text="${esc(c.email)}">이메일 복사</button>`;
}
async function fillContacts(scope) {
  const boxes = [...scope.querySelectorAll('[data-contact]')];
  await Promise.all(boxes.map(async b => {
    const id = b.dataset.contact, c = await api.getContact(id);
    if (document.contains(b)) b.innerHTML = contactHTML(c, contactVisible(id, c));
  }));
}
function openProfile(id) {
  const u = S.members.find(x => x.uid === id);
  if (!u) return;
  openModal(profileHTML(u));
  fillContacts($('#modal'));
}
function openIntro(id) {
  const u = S.members.find(x => x.uid === id);
  if (!u || id === S.mid) return;
  const me = S.member, h = helps(u, me), g = helps(me, u);
  const why = h.length ? `${HELP[h[0]]} 쪽으로 조언을 듣고 싶어서 연락드립니다.` : g.length ? `${HELP[g[0]]} 쪽으로 도움을 드릴 수 있을 것 같아 연락드립니다.` : '라운지에서 프로필을 보고 인사드리고 싶어 연락드립니다.';
  const msg = `안녕하세요, ${me.cohort}기 ${me.name}입니다. ${why} 편하실 때 짧게 통화나 커피 한잔 가능할까요?`;
  openModal(`<div class="pm-head"><h2>${esc(u.name)} 동문에게 소개 요청</h2></div>
    <p class="hint">상대가 수락하면 두 사람의 연락처가 서로에게 공개됩니다. 상대는 다음에 라운지에 들어올 때 요청을 보게 됩니다.</p>
    <div class="field"><label for="intro-msg">보낼 메시지 <small>최대 500자</small></label><textarea id="intro-msg" rows="5" maxlength="500">${esc(msg)}</textarea><p class="ferr" id="intro-err" role="alert"></p></div>
    <div class="row-btns"><button class="btn btn-primary" data-act="send-intro" data-id="${id}">요청 보내기</button><button class="btn btn-ghost" data-act="close">취소</button></div>`);
}
function openWithdraw() {
  const pw = api.usesPassword(S.user);
  openModal(`<div class="pm-head"><h2>라운지 탈퇴</h2></div>
    <p>탈퇴하면 프로필, 연락처, 주고받은 소개 요청이 모두 바로 삭제되고 되돌릴 수 없습니다.</p>
    ${pw ? '<div class="field"><label for="wd-pw">비밀번호 확인</label><input id="wd-pw" type="password" autocomplete="current-password"></div>' : '<p class="hint">탈퇴하기를 누르면 확인을 위해 Google 로그인 창이 한 번 더 뜹니다.</p>'}
    <label class="check"><input type="checkbox" id="wd-ok"><span>모든 정보가 삭제되는 것을 확인했습니다.</span></label>
    <p class="ferr" id="wd-err" role="alert"></p>
    <div class="row-btns"><button class="btn btn-danger" data-act="withdraw-go">탈퇴하기</button><button class="btn btn-ghost" data-act="close">취소</button></div>`);
}

/* ---------- 상단 바와 이동 ---------- */
const NAV = [['net', '네트워크 지도'], ['dir', '동문 명부'], ['intros', '소개 요청'], ['me', '내 프로필']];
const APPROVED_VIEWS = ['net', 'dir', 'intros', 'me', 'admin'];
const approved = () => !!(S.member && S.member.status === 'approved');
function renderBar() {
  const bar = $('#bar');
  if (!S.user || ['login', 'setup', 'boot'].includes(S.view)) { bar.hidden = true; bar.innerHTML = ''; return; }
  bar.hidden = false;
  const ok = approved();
  const newReq = S.intros.received.filter(i => i.status === 'pending').length;
  const items = (ok ? NAV : []).concat(S.admin && S.mid ? [['admin', '운영진']] : []);
  const cur = S.view === 'form' ? 'me' : S.view;
  bar.innerHTML = `<div class="wrap wide bar-in">
    <a class="brand" href="${ok ? '#/net' : '#'}" aria-label="라운지 처음 화면">${seal(36)}<span><b>BM 동문 라운지</b><small>경희대학교 경영대학원 브랜드매니지먼트전공</small></span></a>
    <nav class="nav" aria-label="라운지 메뉴">${items.map(([k, l]) => `<a href="#/${k}"${cur === k ? ' aria-current="page"' : ''}>${l}${k === 'intros' && newReq ? `<span class="dot-n" aria-label="새 요청 ${newReq}건">${newReq}</span>` : ''}</a>`).join('')}</nav>
    <div class="who">${S.member ? `<span class="who-name">${esc(S.member.name)} <span>${S.member.cohort}기</span></span>` : `<span class="who-name">${esc(S.user.email)}</span>`}<button class="btn btn-ghost btn-sm" data-act="logout">로그아웃</button></div>
  </div>`;
}
const hashView = () => { const h = location.hash.replace(/^#\/?/, ''); return APPROVED_VIEWS.includes(h) ? h : 'net'; };
function nav(v) { if (location.hash === '#/' + v) show(v); else location.hash = '#/' + v; }
const outsideView = () => (S.member && S.member.status === 'hidden') ? 'hidden' : 'notyet';

function destroyNet() { if (S.net) { S.net.destroy(); S.net = null; } }
let renderToken = 0;
async function show(v) {
  const tok = ++renderToken;
  if (v === 'admin' && !S.admin) v = approved() ? 'net' : outsideView();
  destroyNet();
  S.view = v;
  renderBar();
  if (v === 'admin' || v === 'intros') {
    $('#app').innerHTML = V.boot();
    try {
      if (v === 'admin') await loadAdmin();
      else S.intros = await api.listIntros(S.mid);
    } catch (e) { console.error(e); toast(errMsg(e)); }
    if (tok !== renderToken) return;
    renderBar();
  }
  $('#app').innerHTML = V[v]();
  window.scrollTo(0, 0);
  if (v === 'dir') renderDirList();
  if (v === 'intros') fillContacts($('#app'));
  if (v === 'me') fillMyContact();
  if (v === 'admin') renderAdminList();
  if (v === 'net') {
    S.net = mountNetwork($('#net-root'), {
      members: S.members, meUid: S.mid, dict: { IND, FN, HELP }, initialSel: S.netSel,
      onProfile: openProfile, onIntro: openIntro, onSelect: id => { S.netSel = id; }
    });
  }
}
async function loadAdmin() {
  const d = await api.loadAdminData();
  S.all = d.members; S.allContacts = d.contacts; S.withdrawn = d.withdrawn;
  if (approved()) S.members = S.all.filter(m => m.status === 'approved');
}
function rerenderAdmin() { if (S.view !== 'admin') return; $('#app').innerHTML = V.admin(); renderAdminList(); }
async function fillMyContact() {
  const box = document.querySelector('[data-mycontact]'); if (!box) return;
  const c = await api.getContact(S.mid);
  if (!document.contains(box)) return;
  box.innerHTML = c ? `${esc(c.email)}${c.phone ? ' · ' + esc(c.phone) : ''} <span class="badge ${c.share ? 'ok' : ''}">${c.share ? '동문에게 공개' : '소개 수락 시에만 공개'}</span>` : '<span class="muted">정보 없음</span>';
}

/* ---------- 로그인 상태에 따라 길 안내 ---------- */
function formFromMember(m, c) {
  return { name: m.name, cohort: String(m.cohort), org: m.org, title: m.title, industry: m.industry, fn: m.fn,
    offer: (m.offer || []).slice(), need: (m.need || []).slice(), intro: m.intro || '', phone: (c && c.phone) || '', share: !!(c && c.share) };
}

async function onAuth(u) {
  if (S.withdrawing) return;
  if (S.unsubMember) { S.unsubMember(); S.unsubMember = null; }
  closeModal(); destroyNet();
  Object.assign(S, { user: u, mid: null, admin: false, member: null, members: [], intros: { received: [], sent: [] }, all: [], allContacts: {}, withdrawn: new Set(), imp: null, form: null, netSel: null, lastStatus: undefined });
  if (!u) { S.loginTab = 'login'; show('login'); return; }
  if (api.usesPassword(u) && !u.emailVerified) { show('verify'); return; }
  $('#app').innerHTML = V.boot();
  try { await api.refreshUser(); } catch (e) { console.warn(e); }
  S.mid = await api.memberId(u.email);
  S.admin = await api.checkAdmin(u.uid);
  S.unsubMember = api.watchMember(S.mid, onMember, e => { console.error(e); toast(errMsg(e)); });
}

async function onMember(m) {
  const prev = S.lastStatus, status = m ? m.status : 'none';
  S.member = m;
  if (prev === status) {
    // 상태는 그대로, 내용만 바뀜(프로필 수정)
    if (m && status === 'approved') { const i = S.members.findIndex(x => x.uid === m.uid); if (i >= 0) S.members[i] = m; }
    renderBar();
    return;
  }
  S.lastStatus = status;
  if (status === 'approved') {
    try {
      S.members = await api.listApproved();
      S.intros = await api.listIntros(S.mid);
    } catch (e) { console.error(e); toast(errMsg(e)); }
    if (S.view === 'form') S.form = null;
    show(hashView());
    if (prev === 'none' || prev === 'hidden') toast(`명부에 등록되었습니다. ${m.name} 동문, 라운지에 오신 것을 환영합니다.`);
    return;
  }
  if (S.admin && location.hash === '#/admin') { if (S.view !== 'admin') show('admin'); else renderBar(); return; }
  show(outsideView());
}

/* ---------- 프로필 저장 ---------- */
function setErr(k, msg) { const e = document.getElementById('e-' + k); if (e) e.textContent = msg; }
function pick(b) {
  const g = b.closest('.picks'), k = g.dataset.group, v = b.dataset.val, f = S.form;
  if (!f) return;
  if (g.dataset.single) {
    f[k] = v;
    g.querySelectorAll('.pick').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.val === v)));
  } else {
    const arr = f[k], i = arr.indexOf(v), max = +g.dataset.max;
    if (i >= 0) arr.splice(i, 1);
    else { if (arr.length >= max) { setErr(k, `최대 ${max}개까지 고를 수 있습니다.`); return; } arr.push(v); }
    b.setAttribute('aria-pressed', String(arr.includes(v)));
    const c = document.getElementById('cnt-' + k); if (c) c.textContent = `${arr.length}/${max}`;
  }
  setErr(k, ''); g.setAttribute('aria-invalid', 'false');
}
async function submitProfile() {
  const f = S.form, E = {};
  const cohortStr = String(f.cohort).trim(), c = parseInt(cohortStr, 10);
  if (!f.name.trim()) E.name = '이름을 적어 주세요.';
  if (!/^\d{1,2}$/.test(cohortStr) || c < 1 || c > 80) E.cohort = '기수를 숫자로 적어 주세요.';
  if (!f.org.trim()) E.org = '회사나 소속을 적어 주세요.';
  if (!f.title.trim()) E.title = '직무나 직책을 적어 주세요.';
  if (!f.industry) E.industry = '업종을 하나 골라 주세요.';
  if (!f.fn) E.fn = '직무 분야를 하나 골라 주세요.';
  if (f.phone.trim() && !/^[0-9+\-\s()]{7,20}$/.test(f.phone.trim())) E.phone = '숫자와 하이픈으로 적어 주세요.';
  ['name', 'cohort', 'org', 'title', 'industry', 'fn', 'phone'].forEach(k => {
    setErr(k, E[k] || '');
    const t = document.querySelector(`#pf [data-key="${k}"]`); if (t) t.setAttribute('aria-invalid', E[k] ? 'true' : 'false');
  });
  const n = Object.keys(E).length;
  $('#err-sum').textContent = n ? `${n}개 항목을 확인해 주세요.` : '';
  if (n) { const first = document.querySelector('#pf [aria-invalid="true"]'); if (first) { first.focus(); first.scrollIntoView({ block: 'center' }); } return; }

  const profile = { name: f.name.trim(), cohort: c, industry: f.industry, fn: f.fn, org: f.org.trim(), title: f.title.trim(), offer: f.offer.slice(), need: f.need.slice(), intro: f.intro.trim() };
  const btn = $('#pf-submit');
  busy(btn, true, '저장하는 중…');
  try {
    await api.saveProfile(S.mid, profile, { phone: f.phone.trim(), share: !!f.share });
    S.form = null;
    Object.assign(S.member, profile);
    const i = S.members.findIndex(x => x.uid === S.mid); if (i >= 0) Object.assign(S.members[i], profile);
    nav('me');
    toast('프로필을 저장했습니다.');
  } catch (e) {
    console.error(e);
    busy(btn, false);
    $('#err-sum').textContent = errMsg(e);
  }
}

/* ---------- 백업 ---------- */
function downloadCSV() {
  const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const head = ['이름', '기수', '상태', '업종', '직무 분야', '회사·소속', '직무·직책', '줄 수 있는 것', '필요한 것', '한 줄 소개', '로그인 이메일', '휴대폰', '연락처 공개', '동의 버전', '등록일'];
  const st = { approved: '명부', hidden: '내림' };
  const d = ts => (ts && ts.toDate ? ts.toDate().toISOString().slice(0, 10) : '');
  const lines = S.all.slice().sort((a, b) => a.cohort - b.cohort).map(r => { const c = S.allContacts[r.uid] || {}; return [r.name, r.cohort, st[r.status] || r.status, IND[r.industry], FN[r.fn], r.org, r.title,
    labels(r.offer).join(', '), labels(r.need).join(', '), r.intro, c.email, c.phone, c.share ? '공개' : '비공개', c.consent ? c.consent.version : '', d(r.createdAt)].map(cell).join(','); });
  const blob = new Blob(['﻿' + [head.map(cell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `bm-lounge-backup-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  try {
    switch (a) {
      case 'tab': S.loginTab = b.dataset.tab; show('login'); break;
      case 'forgot': {
        const em = ($('#li-email') || {}).value || '';
        if (!em.trim()) { $('#li-err').textContent = '비밀번호를 재설정할 이메일을 먼저 적어 주세요.'; $('#li-email').focus(); break; }
        await api.resetPassword(em);
        toast('비밀번호 재설정 메일을 보냈습니다. 메일함과 스팸함을 확인해 주세요.');
        break;
      }
      case 'google': await api.signInGoogle(); break;
      case 'verified': {
        busy(b, true, '확인하는 중…');
        const u = await api.refreshUser();
        busy(b, false);
        if (u && u.emailVerified) onAuth(u);
        else toast('아직 인증되지 않았습니다. 메일의 인증 링크를 눌렀는지 확인해 주세요.');
        break;
      }
      case 'resend': await api.resendVerification(); toast('인증 메일을 다시 보냈습니다.'); break;
      case 'logout': await api.logout(); break;
      case 'pick': pick(b); break;
      case 'edit-profile': {
        const c = await api.getContact(S.mid);
        S.form = formFromMember(S.member, c); show('form');
        break;
      }
      case 'cancel-edit': S.form = null; nav('me'); break;
      case 'ind':
        S.filter.ind = b.dataset.val;
        document.querySelectorAll('[data-act="ind"]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        renderDirList();
        break;
      case 'profile': openProfile(id); break;
      case 'intro': openIntro(id); break;
      case 'send-intro': {
        const msg = $('#intro-msg').value.trim();
        if (!msg) { $('#intro-err').textContent = '메시지를 적어 주세요.'; break; }
        busy(b, true, '보내는 중…');
        try {
          await api.sendIntro({ uid: S.mid, name: S.member.name, cohort: S.member.cohort }, id, msg);
        } catch (err) { busy(b, false); $('#intro-err').textContent = errMsg(err); break; }
        S.intros.sent.push({ id: api.introId(S.mid, id), from: S.mid, to: id, message: msg, status: 'pending', createdAt: null });
        const u = S.members.find(x => x.uid === id);
        closeModal();
        toast(`${u ? u.name : ''} 동문에게 소개 요청을 보냈습니다. 상대가 수락하면 연락처가 서로 공개됩니다.`);
        break;
      }
      case 'accept': case 'decline': {
        busy(b, true);
        await api.respondIntro(id, a === 'accept' ? 'accepted' : 'declined');
        toast(a === 'accept' ? '수락했습니다. 이제 서로의 연락처가 보입니다.' : '요청을 거절했습니다.');
        show('intros');
        break;
      }
      case 'cancel-intro': busy(b, true); await api.removeIntro(id); show('intros'); break;
      case 'copy': {
        const text = b.dataset.text;
        try { await navigator.clipboard.writeText(text); toast('복사했습니다.'); }
        catch { toast(text); }
        break;
      }
      case 'map-of': S.netSel = id; closeModal(); if (location.hash === '#/net') { e.preventDefault(); show('net'); } break;
      case 'center-me': S.netSel = S.mid; break;
      case 'close': closeModal(); break;
      case 'withdraw': openWithdraw(); break;
      case 'withdraw-go': {
        const pwEl = $('#wd-pw'), err = $('#wd-err');
        if (pwEl && !pwEl.value) { err.textContent = '비밀번호를 입력해 주세요.'; break; }
        if (!$('#wd-ok').checked) { err.textContent = '확인란에 체크해 주세요.'; break; }
        busy(b, true, '삭제하는 중…');
        S.withdrawing = true;
        try {
          await api.reauth(pwEl ? pwEl.value : '');
          if (S.unsubMember) { S.unsubMember(); S.unsubMember = null; }
          await api.withdraw(S.mid);
        } catch (err2) {
          S.withdrawing = false; busy(b, false); err.textContent = errMsg(err2); break;
        }
        S.withdrawing = false;
        closeModal();
        await onAuth(null);
        toast('탈퇴했습니다. 그동안 함께해 주셔서 감사합니다.');
        break;
      }
      /* 운영진 */
      case 'hide': case 'unhide': {
        if (a === 'hide' && !b.dataset.armed) { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 내림'; break; }
        busy(b, true);
        const next = a === 'hide' ? 'hidden' : 'approved';
        await api.setStatus(id, next);
        const m = S.all.find(x => x.uid === id);
        if (m) m.status = next;
        if (approved()) S.members = S.all.filter(x => x.status === 'approved');
        rerenderAdmin();
        toast(`${m ? m.name : ''} 동문을 ${next === 'hidden' ? '명부에서 내렸습니다.' : '다시 명부에 올렸습니다.'}`);
        break;
      }
      case 'imp-preview': {
        const text = $('#imp-text').value;
        if (!text.trim()) { S.imp = { fatal: '시트 내용을 붙여넣거나 CSV 파일을 올려 주세요.' }; $('#imp-result').innerHTML = impHTML(S.imp); break; }
        busy(b, true, '확인하는 중…');
        S.imp = await buildImport(text, { over: $('#imp-over').checked, rejoin: $('#imp-rejoin').checked });
        busy(b, false);
        $('#imp-result').innerHTML = impHTML(S.imp);
        break;
      }
      case 'imp-run': {
        if (!S.imp || !S.imp.rows) break;
        const items = S.imp.rows.filter(r => r.action === 'create' || r.action === 'update')
          .map(r => ({ mid: r.mid, profile: r.profile, contact: r.contact, existing: r.action === 'update' ? r.existing : null, rejoin: !!r.rejoin }));
        busy(b, true, '올리는 중…');
        await api.importMembers(items, (d, t) => { b.textContent = `올리는 중… ${d}/${t}`; });
        const created = items.filter(i => !i.existing).length, updated = items.length - created;
        S.imp = { done: `${created}명을 새로 명부에 올렸고 ${updated}명을 덮어썼습니다. 이 동문들은 신청서에 적은 이메일로 ‘처음 로그인’을 하면 바로 들어올 수 있어요.` };
        await loadAdmin();
        rerenderAdmin();
        toast(`${items.length}명을 명부에 올렸습니다.`);
        break;
      }
      case 'imp-clear': S.imp = null; $('#imp-result').innerHTML = ''; $('#imp-text').value = ''; break;
      case 'reload-admin': show('admin'); break;
      case 'backup': busy(b, true, '파일 만드는 중…'); await loadAdmin(); downloadCSV(); busy(b, false); break;
    }
  } catch (err) {
    console.error(err);
    busy(b, false);
    toast(errMsg(err));
  }
});

['input', 'change'].forEach(type => document.addEventListener(type, e => {
  const t = e.target;
  if (S.form && t.dataset && t.dataset.key && t.closest('#pf') && t.tagName === 'INPUT') {
    S.form[t.dataset.key] = t.type === 'checkbox' ? t.checked : t.value;
    if (t.getAttribute('aria-invalid') === 'true') { t.setAttribute('aria-invalid', 'false'); setErr(t.dataset.key, ''); }
  }
  // 검색창은 input 에서만 다시 그림. change(포커스가 빠질 때)에서도 그리면 카드 첫 클릭이 사라짐
  if (t.id === 'dir-q' && type === 'input') { S.filter.q = t.value; renderDirList(); }
  if (t.id === 'dir-help' && type === 'change') { S.filter.helpMe = t.checked; renderDirList(); }
  if (t.id === 'adm-q' && type === 'input') { S.adminQ = t.value; renderAdminList(); }
  if (t.id === 'imp-file' && type === 'change' && t.files && t.files[0]) {
    const r = new FileReader();
    r.onload = () => { $('#imp-text').value = String(r.result || ''); toast(`${t.files[0].name}을(를) 불러왔습니다. 미리보기를 눌러 주세요.`); };
    r.readAsText(t.files[0], 'utf-8');
  }
}));

document.addEventListener('submit', async e => {
  e.preventDefault();
  const id = e.target.id, btn = e.target.querySelector('[type="submit"]');
  if (id === 'login-form') {
    const em = $('#li-email').value.trim(), pw = $('#li-pw').value, err = $('#li-err');
    if (!em || !pw) { err.textContent = '이메일과 비밀번호를 입력해 주세요.'; return; }
    busy(btn, true, '로그인하는 중…');
    try { await api.signIn(em, pw); } catch (x) { busy(btn, false); err.textContent = errMsg(x); }
  } else if (id === 'act-form') {
    const em = $('#ac-email').value.trim(), p1 = $('#ac-pw').value, p2 = $('#ac-pw2').value, err = $('#ac-err');
    let msg = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) msg = '이메일 주소를 확인해 주세요.';
    else if (p1.length < 8) msg = '비밀번호는 8자 이상이어야 합니다.';
    else if (p1 !== p2) msg = '두 비밀번호가 서로 다릅니다.';
    err.textContent = msg;
    if (msg) return;
    busy(btn, true, '만드는 중…');
    try { await api.activate(em, p1); } catch (x) { busy(btn, false); err.textContent = errMsg(x); }
  } else if (id === 'pf') {
    submitProfile();
  }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('hashchange', () => {
  if (S.view === 'form' || !S.user || !S.mid) return;
  if (approved()) show(hashView());
  else if (S.admin && location.hash === '#/admin') show('admin'); // 명부에 없는 운영진도 운영진 화면은 열 수 있음
  else if (S.view === 'admin') show(outsideView());
});

/* ---------- 시작 ---------- */
if (!api.configured) { S.view = 'setup'; $('#app').innerHTML = V.setup(); }
else { $('#app').innerHTML = V.boot(); api.watchAuth(onAuth); }
