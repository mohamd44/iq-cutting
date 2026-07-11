/* ============================================================
   auth.js — نظام المصادقة الكامل
   يدعم: تسجيل الدخول بالبريد/كلمة المرور، رقم الهاتف + OTP,
   حساب جديد، نسيت كلمة المرور
   يعمل كسكريبت عادي — بدون ES modules
   ============================================================ */

/* ---------------- حالة المصادقة ---------------- */
var currentUser = null;
var userProfile = null;

/* ---------------- عناصر الواجهة ---------------- */
var authScreen = document.getElementById('authScreen');
var appContent = document.getElementById('appContent');

/* ---------------- أقسام نموذج تسجيل الدخول ---------------- */
var emailSection = document.getElementById('emailSection');
var phoneSection = document.getElementById('phoneSection');
var registerSection = document.getElementById('registerSection');
var resetSection = document.getElementById('resetSection');
var phoneVerifySection = document.getElementById('phoneVerifySection');

/* ---------------- أزرار التبديل ---------------- */
var btnShowEmail = document.getElementById('btnShowEmail');
var btnShowPhone = document.getElementById('btnShowPhone');
var btnShowRegister = document.getElementById('btnShowRegister');

/* ---------------- حقول البريد الإلكتروني ---------------- */
var emailInput = document.getElementById('authEmail');
var passInput = document.getElementById('authPass');
var btnLogin = document.getElementById('btnLogin');
var btnReset = document.getElementById('btnReset');

/* ---------------- حقول الهاتف ---------------- */
var phoneInput = document.getElementById('authPhone');
var btnSendOtp = document.getElementById('btnSendOtp');
var otpInput = document.getElementById('authOtp');
var btnVerifyOtp = document.getElementById('btnVerifyOtp');
var confirmationResult = null;

/* ---------------- حقول التسجيل ---------------- */
var regNameInput = document.getElementById('regName');
var regEmailInput = document.getElementById('regEmail');
var regPassInput = document.getElementById('regPass');
var regPass2Input = document.getElementById('regPass2');
var btnRegister = document.getElementById('btnRegister');

/* ---------------- حقول استعادة كلمة المرور ---------------- */
var resetEmailInput = document.getElementById('resetEmail');
var btnSendReset = document.getElementById('btnSendReset');

/* ---------------- رسالة الحالة ---------------- */
var authMsg = document.getElementById('authMsg');

/* ---------------- تبديل الأقسام ---------------- */
function showSection(section) {
  var sections = [emailSection, phoneSection, registerSection, resetSection, phoneVerifySection];
  for (var i = 0; i < sections.length; i++) {
    if (sections[i]) sections[i].classList.add('hidden');
  }
  if (section) section.classList.remove('hidden');
  clearMsg();
}

function clearMsg() {
  if (authMsg) { authMsg.textContent = ''; authMsg.className = 'auth-msg'; }
}

function showMsg(text, isError) {
  if (!authMsg) return;
  authMsg.textContent = text;
  authMsg.className = 'auth-msg' + (isError ? ' error' : ' success');
}

/* ---------------- تبديل طرق تسجيل الدخول ---------------- */
function setActiveBtn(activeBtn) {
  var btns = [btnShowEmail, btnShowPhone, btnShowRegister];
  for (var i = 0; i < btns.length; i++) {
    if (btns[i]) btns[i].classList.remove('active');
  }
  if (activeBtn) activeBtn.classList.add('active');
}

if (btnShowEmail) btnShowEmail.addEventListener('click', function() {
  setActiveBtn(btnShowEmail); showSection(emailSection);
});
if (btnShowPhone) btnShowPhone.addEventListener('click', function() {
  setActiveBtn(btnShowPhone); showSection(phoneSection);
});
if (btnShowRegister) btnShowRegister.addEventListener('click', function() {
  setActiveBtn(btnShowRegister); showSection(registerSection);
});
if (btnReset) btnReset.addEventListener('click', function() { showSection(resetSection); });

/* ---------------- تحميل reCAPTCHA للهاتف ---------------- */
var recaptchaVerifier = null;
function ensureRecaptcha() {
  if (recaptchaVerifier) return;
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptchaContainer', {
    size: 'invisible'
  }, auth);
}

/* ---------------- تسجيل الدخول بالبريد الإلكتروني ---------------- */
if (btnLogin) btnLogin.addEventListener('click', function() {
  var email = (emailInput.value || '').trim();
  var pass = passInput.value || '';
  if (!email || !pass) { showMsg('أدخل البريد الإلكتروني وكلمة المرور', true); return; }
  btnLogin.disabled = true; btnLogin.textContent = 'جارٍ الدخول…';
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() { showMsg('✓ تم تسجيل الدخول بنجاح', false); })
    .catch(function(e) {
      var msgs = {
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/invalid-email': 'البريد الإلكتروني غير صالح',
        'auth/too-many-requests': 'تم حظر الحساب مؤقتاً بسبب محاولات كثيرة',
        'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة'
      };
      showMsg(msgs[e.code] || 'خطأ في تسجيل الدخول: ' + e.message, true);
    })
    .finally(function() { btnLogin.disabled = false; btnLogin.textContent = 'دخول'; });
});

/* ---------------- تسجيل الدخول بالهاتف ---------------- */
if (btnSendOtp) btnSendOtp.addEventListener('click', function() {
  var phone = (phoneInput.value || '').trim();
  if (!phone) { showMsg('أدخل رقم الهاتف', true); return; }
  btnSendOtp.disabled = true;
  ensureRecaptcha();
  auth.signInWithPhoneNumber(phone, recaptchaVerifier)
    .then(function(result) {
      confirmationResult = result;
      showSection(phoneVerifySection);
      showMsg('تم إرسال رمز التحقق — أدخل الرمز المكون من 6 أرقام', false);
    })
    .catch(function(e) {
      var msgs = {
        'auth/invalid-phone-number': 'رقم الهاتف غير صالح — استخدم الرمز الدولي مثال: +963...',
        'auth/too-many-requests': 'تم حظر هذا الرقم مؤقتاً',
        'auth/captcha-check-failed': 'فشل التحقق من reCAPTCHA'
      };
      showMsg(msgs[e.code] || 'خطأ في إرسال الرمز: ' + e.message, true);
      try { recaptchaVerifier.render(); } catch(_) {}
    })
    .finally(function() { btnSendOtp.disabled = false; });
});

/* ---------------- التحقق من OTP ---------------- */
if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', function() {
  var otp = (otpInput.value || '').trim();
  if (!otp || otp.length < 4) { showMsg('أدخل رمز التحقق', true); return; }
  if (!confirmationResult) { showMsg('أرسل الرمز أولاً', true); return; }
  btnVerifyOtp.disabled = true;
  confirmationResult.confirm(otp)
    .then(function() { showMsg('✓ تم تسجيل الدخول بنجاح', false); })
    .catch(function() { showMsg('رمز التحقق غير صحيح — حاول مرة أخرى', true); })
    .finally(function() { btnVerifyOtp.disabled = false; });
});

/* ---------------- إنشاء حساب جديد ---------------- */
if (btnRegister) btnRegister.addEventListener('click', function() {
  var name = (regNameInput.value || '').trim();
  var email = (regEmailInput.value || '').trim();
  var pass = regPassInput.value || '';
  var pass2 = regPass2Input.value || '';

  if (!name || !email || !pass) { showMsg('أدخل جميع الحقول المطلوبة', true); return; }
  if (pass.length < 6) { showMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل', true); return; }
  if (pass !== pass2) { showMsg('كلمتا المرور غير متطابقتين', true); return; }

  btnRegister.disabled = true; btnRegister.textContent = 'جارٍ الإنشاء…';
  auth.createUserWithEmailAndPassword(email, pass)
    .then(function(cred) {
      return cred.user.updateProfile({ displayName: name }).then(function() {
        return createNewUserDoc(cred.user.uid, { email: email, displayName: name });
      });
    })
    .then(function() { showMsg('✓ تم إنشاء الحساب بنجاح', false); })
    .catch(function(e) {
      var msgs = {
        'auth/email-already-in-use': 'هذا البريد الإلكتروني مستخدم بالفعل',
        'auth/invalid-email': 'البريد الإلكتروني غير صالح',
        'auth/weak-password': 'كلمة المرور ضعيفة جداً'
      };
      showMsg(msgs[e.code] || 'خطأ في إنشاء الحساب: ' + e.message, true);
    })
    .finally(function() { btnRegister.disabled = false; btnRegister.textContent = 'إنشاء حساب'; });
});

/* ---------------- نسيت كلمة المرور ---------------- */
if (btnSendReset) btnSendReset.addEventListener('click', function() {
  var email = (resetEmailInput.value || '').trim();
  if (!email) { showMsg('أدخل البريد الإلكتروني', true); return; }
  btnSendReset.disabled = true;
  auth.sendPasswordResetEmail(email)
    .then(function() { showMsg('✓ تم إرسال رابط استعادة كلمة المرور إلى بريدك', false); })
    .catch(function(e) {
      var msgs = {
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/invalid-email': 'البريد الإلكتروني غير صالح'
      };
      showMsg(msgs[e.code] || 'خطأ: ' + e.message, true);
    })
    .finally(function() { btnSendReset.disabled = false; });
});

/* ---------------- تسجيل الخروج ---------------- */
function logout() {
  return auth.signOut().then(function() {
    currentUser = null;
    userProfile = null;
  }).catch(function() {});
}

/* ---------------- إنشاء مستند المستخدم في Firestore ---------------- */
function createNewUserDoc(uid, data) {
  var ref = db.collection('users').doc(uid);
  return ref.get().then(function(snap) {
    if (!snap.exists) {
      return ref.set({
        uid: uid,
        email: (data && data.email) || '',
        phone: '',
        displayName: (data && data.displayName) || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        subscriptionStatus: 'trial',
        trialStart: firebase.firestore.FieldValue.serverTimestamp(),
        freeServiceChoice: null,
        entitlements: [],
        role: 'user'
      });
    }
  }).catch(function(e) { console.error('خطأ في إنشاء مستند المستخدم:', e); });
}

/* ---------------- تحميل بيانات المستخدم من Firestore ---------------- */
function loadUserDoc(uid) {
  var ref = db.collection('users').doc(uid);
  return ref.get().then(function(snap) {
    if (snap.exists) return Object.assign({ id: snap.id }, snap.data());
    return null;
  }).catch(function(e) {
    console.error('خطأ في تحميل بيانات المستخدم:', e);
    return null;
  });
}

/* ---------------- إظهار/إخفاء الشاشات ---------------- */
function showAppForUser(user, profile) {
  var authScr = document.getElementById('authScreen');
  var appCnt = document.getElementById('appContent');
  var badge = document.getElementById('userBadge');
  var badgeName = document.getElementById('userBadgeName');
  var badgeStatus = document.getElementById('userBadgeStatus');

  if (authScr) authScr.classList.add('hidden');
  if (appCnt) appCnt.classList.remove('hidden');
  if (badge) badge.classList.remove('hidden');
  if (badgeName) badgeName.textContent = profile.displayName || user.email || user.phoneNumber || 'مستخدم';

  if (badgeStatus) {
    var statusMap = {
      trial: 'تجربة مجانية',
      subscribed: 'اشتراك نشط',
      free_service: 'خدمة مجانية',
      expired: 'منتهي الصلاحية'
    };
    badgeStatus.textContent = statusMap[profile.subscriptionStatus] || profile.subscriptionStatus;
  }

  window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: user, profile: profile } }));

  if (profile.role === 'admin' && typeof initAdmin === 'function') {
    initAdmin(profile);
    showAdminButton(profile);
  }
}

function showAuthScreenFn() {
  var authScr = document.getElementById('authScreen');
  var appCnt = document.getElementById('appContent');
  var badge = document.getElementById('userBadge');
  if (authScr) authScr.classList.remove('hidden');
  if (appCnt) appCnt.classList.add('hidden');
  if (badge) badge.classList.add('hidden');
  window.dispatchEvent(new CustomEvent('auth:logout'));
}

/* ---------------- مراقبة حالة المصادقة ---------------- */
function watchAuth() {
  auth.onAuthStateChanged(function(user) {
    if (user) {
      currentUser = user;
      loadUserDoc(user.uid).then(function(profile) {
        userProfile = profile;
        if (!userProfile) {
          userProfile = {
            uid: user.uid,
            email: user.email || '',
            phone: user.phoneNumber || '',
            displayName: user.displayName || '',
            createdAt: new Date().toISOString(),
            subscriptionStatus: 'trial',
            trialStart: new Date().toISOString(),
            freeServiceChoice: null,
            entitlements: [],
            role: 'user'
          };
          return createNewUserDoc(user.uid, userProfile);
        }
      }).then(function() {
        if (userProfile) showAppForUser(user, userProfile);
      });
    } else {
      currentUser = null;
      userProfile = null;
      showAuthScreenFn();
    }
  });
}

/* ---------------- زر الخروج ---------------- */
var btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.addEventListener('click', function() {
    if (confirm('هل تريد تسجيل الخروج؟')) { logout(); }
  });
}

/* ---------------- بدء مراقبة الحالة ---------------- */
watchAuth();
