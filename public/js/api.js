// Firebase 연결과 데이터 읽기·쓰기를 모아 둔 파일입니다.
// 화면 코드(app.js)는 여기 있는 함수만 씁니다.
//
// 동문 ID(mid) = 로그인 이메일(소문자)의 SHA-256 값.
// 운영진이 구글 폼 응답을 가져올 때 이 ID로 등록하고,
// 동문이 같은 이메일로 처음 로그인하면 자동으로 자기 기록과 연결됩니다.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup,
  reauthenticateWithCredential, reauthenticateWithPopup, EmailAuthProvider, deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  getDocs, onSnapshot, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig, POLICY_VERSION } from './config.js';

export const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = configured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
if (auth) auth.languageCode = 'ko'; // 인증·재설정 메일을 한국어로

// 내 컴퓨터에서 시험할 때만: http://localhost:5000/?emulator 로 열면 실제 데이터 대신 에뮬레이터에 연결
if (app && ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).has('emulator')) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

/* ---------- 동문 ID ---------- */
export const normEmail = e => String(e || '').trim().toLowerCase();
export async function memberId(email) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normEmail(email)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- 로그인 ---------- */
export const watchAuth = cb => onAuthStateChanged(auth, cb);
export const usesPassword = u => !!u && u.providerData.some(p => p.providerId === 'password');

async function sendVerify(user) {
  try {
    await sendEmailVerification(user, { url: location.origin + location.pathname });
  } catch (e) {
    // 도메인이 아직 '승인된 도메인'에 없으면 돌아올 주소 없이 다시 보냅니다.
    if (/continue-uri|unauthorized-domain/.test(e.code || '')) await sendEmailVerification(user);
    else throw e;
  }
}
// 처음 로그인: 신청서에 적은 이메일로 비밀번호를 만들고 인증 메일을 받습니다.
export async function activate(email, pw) {
  const cred = await createUserWithEmailAndPassword(auth, normEmail(email), pw);
  await sendVerify(cred.user);
  return cred.user;
}
export const resendVerification = () => sendVerify(auth.currentUser);
export const signIn = (email, pw) => signInWithEmailAndPassword(auth, normEmail(email), pw);
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const resetPassword = email => sendPasswordResetEmail(auth, normEmail(email));
export const logout = () => signOut(auth);
export async function refreshUser() {
  const u = auth.currentUser;
  if (!u) return null;
  await u.reload();
  await u.getIdToken(true); // 인증 완료 상태를 서버 규칙에 바로 반영
  return auth.currentUser;
}
export async function checkAdmin(uid) {
  try { return (await getDoc(doc(db, 'admins', uid))).exists(); } catch { return false; }
}

/* ---------- 내 기록 ---------- */
export function watchMember(mid, cb, onError) {
  return onSnapshot(doc(db, 'members', mid), { includeMetadataChanges: true }, snap => {
    if (snap.metadata.hasPendingWrites) return; // 서버가 확인한 값만 반영
    cb(snap.exists() ? { uid: mid, ...snap.data() } : null);
  }, onError);
}

const PROFILE_KEYS = ['name', 'cohort', 'industry', 'fn', 'org', 'title', 'offer', 'need', 'intro'];
const pickProfile = p => Object.fromEntries(PROFILE_KEYS.map(k => [k, p[k]]));

export async function saveProfile(mid, profile, contact) {
  const b = writeBatch(db);
  b.update(doc(db, 'members', mid), { ...pickProfile(profile), updatedAt: serverTimestamp() });
  b.update(doc(db, 'contacts', mid), { phone: contact.phone || '', share: !!contact.share });
  await b.commit();
}

/* ---------- 동문 목록·연락처 ---------- */
const rows = snap => snap.docs.map(d => ({ uid: d.id, ...d.data() }));
export const listApproved = async () =>
  rows(await getDocs(query(collection(db, 'members'), where('status', '==', 'approved'))));

// 공개를 허락했거나 소개 요청이 수락된 경우에만 읽힙니다(운영진은 전부). 아니면 null.
export async function getContact(mid) {
  try {
    const s = await getDoc(doc(db, 'contacts', mid));
    return s.exists() ? s.data() : null;
  } catch { return null; }
}

/* ---------- 소개 요청 ---------- */
export const introId = (from, to) => `${from}_${to}`;
export async function sendIntro(me, toMid, message) {
  const ref = doc(db, 'intros', introId(me.uid, toMid));
  const ex = await getDoc(ref);
  if (ex.exists()) throw Object.assign(new Error('exists'), { code: 'intro/exists' });
  await setDoc(ref, {
    from: me.uid, to: toMid, fromName: me.name, fromCohort: me.cohort,
    message, status: 'pending', createdAt: serverTimestamp()
  });
}
export async function listIntros(mid) {
  const col = collection(db, 'intros');
  const [r, s] = await Promise.all([
    getDocs(query(col, where('to', '==', mid))),
    getDocs(query(col, where('from', '==', mid)))
  ]);
  const map = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { received: map(r), sent: map(s) };
}
export const respondIntro = (id, status) =>
  updateDoc(doc(db, 'intros', id), { status, respondedAt: serverTimestamp() });
export const removeIntro = id => deleteDoc(doc(db, 'intros', id));

/* ---------- 운영진 ---------- */
export async function loadAdminData() {
  const [m, c, w] = await Promise.all([
    getDocs(collection(db, 'members')), getDocs(collection(db, 'contacts')), getDocs(collection(db, 'withdrawn'))
  ]);
  return {
    members: rows(m),
    contacts: Object.fromEntries(c.docs.map(d => [d.id, d.data()])),
    withdrawn: new Set(w.docs.map(d => d.id))
  };
}
export const setStatus = (mid, status) =>
  updateDoc(doc(db, 'members', mid), { status, updatedAt: serverTimestamp() });

// 신청서 가져오기. items: [{ mid, profile, contact:{email,phone,share}, existing, rejoin }]
export async function importMembers(items, onProgress) {
  let done = 0;
  for (let i = 0; i < items.length; i += 150) {
    const b = writeBatch(db);
    items.slice(i, i + 150).forEach(it => {
      b.set(doc(db, 'members', it.mid), {
        ...pickProfile(it.profile),
        status: it.existing ? it.existing.status : 'approved',
        createdAt: it.existing && it.existing.createdAt ? it.existing.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      b.set(doc(db, 'contacts', it.mid), {
        email: normEmail(it.contact.email), phone: it.contact.phone || '', share: !!it.contact.share,
        consent: { map: true, privacy: true, version: POLICY_VERSION, at: serverTimestamp(), via: 'google-form' }
      });
      if (it.rejoin) b.delete(doc(db, 'withdrawn', it.mid));
    });
    await b.commit();
    done = Math.min(items.length, i + 150);
    if (onProgress) onProgress(done, items.length);
  }
}

/* ---------- 탈퇴 ---------- */
export async function reauth(password) {
  const u = auth.currentUser;
  if (usesPassword(u)) await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
  else await reauthenticateWithPopup(u, new GoogleAuthProvider());
}
// 프로필·연락처·소개 요청을 지우고, 다시 가져오기로 되살아나지 않게 탈퇴 표시를 남긴 뒤 로그인 계정을 삭제합니다.
export async function withdraw(mid) {
  const u = auth.currentUser;
  const { received, sent } = await listIntros(mid);
  const b = writeBatch(db);
  [...received, ...sent].forEach(i => b.delete(doc(db, 'intros', i.id)));
  b.delete(doc(db, 'contacts', mid));
  b.delete(doc(db, 'members', mid));
  b.set(doc(db, 'withdrawn', mid), { at: serverTimestamp() });
  await b.commit();
  await deleteUser(u);
}
