/* ============================================================
   firestore-db.js — عمليات قاعدة البيانات (Firestore Compat)
   يعمل كسكريبت عادي — بدون ES modules
   ============================================================ */

/* ===========================================================
   إدارة المستخدمين
   =========================================================== */

function fsGetUser(uid) {
  return db.collection('users').doc(uid).get().then(function(snap) {
    return snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
  }).catch(function(e) { console.error('fsGetUser:', e); return null; });
}

function fsGetAllUsers(maxLimit) {
  maxLimit = maxLimit || 100;
  return db.collection('users').orderBy('createdAt', 'desc').limit(maxLimit).get()
    .then(function(snap) {
      return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
    }).catch(function(e) { console.error('fsGetAllUsers:', e); return []; });
}

function fsUpdateUserSubscription(uid, status, extraData) {
  var data = { subscriptionStatus: status };
  if (extraData) Object.assign(data, extraData);
  return db.collection('users').doc(uid).update(data)
    .then(function() { return true; })
    .catch(function(e) { console.error('fsUpdateUserSubscription:', e); return false; });
}

function fsToggleUserAccount(uid, disabled) {
  return db.collection('users').doc(uid).update({ disabled: !!disabled })
    .then(function() { return true; })
    .catch(function(e) { console.error('fsToggleUserAccount:', e); return false; });
}

function fsDeleteUser(uid) {
  return db.collection('users').doc(uid).delete()
    .then(function() { return true; })
    .catch(function(e) { console.error('fsDeleteUser:', e); return false; });
}

/* ===========================================================
   نظام التجربة المجانية (3 أيام)
   =========================================================== */

function fsIsTrialExpired(userProfile) {
  if (!userProfile || !userProfile.trialStart) return true;
  if (userProfile.subscriptionStatus === 'subscribed') return false;
  if (userProfile.subscriptionStatus === 'free_service') return false;
  var start = userProfile.trialStart && userProfile.trialStart.toDate
    ? userProfile.trialStart.toDate()
    : new Date(userProfile.trialStart);
  var now = new Date();
  var diffMs = now - start;
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > 3;
}

function fsTrialDaysLeft(userProfile) {
  if (!userProfile || !userProfile.trialStart) return 0;
  if (userProfile.subscriptionStatus === 'subscribed') return Infinity;
  if (userProfile.subscriptionStatus === 'free_service') return Infinity;
  var start = userProfile.trialStart && userProfile.trialStart.toDate
    ? userProfile.trialStart.toDate()
    : new Date(userProfile.trialStart);
  var now = new Date();
  var diffMs = now - start;
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(3 - diffDays));
}

/* ===========================================================
   الإحصائيات (للمدير)
   =========================================================== */

function fsGetStats() {
  return fsGetAllUsers(500).then(function(users) {
    var now = new Date();
    var activeTrial = 0, subscribed = 0, freeService = 0, expired = 0, thisMonth = 0;
    users.forEach(function(u) {
      var status = u.subscriptionStatus || 'expired';
      if (status === 'subscribed') subscribed++;
      else if (status === 'free_service') freeService++;
      else if (status === 'trial') {
        if (!fsIsTrialExpired(u)) activeTrial++;
        else expired++;
      } else expired++;

      var created = u.createdAt && u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
      if (created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear()) {
        thisMonth++;
      }
    });
    return { total: users.length, activeTrial: activeTrial, subscribed: subscribed,
             freeService: freeService, expired: expired, thisMonth: thisMonth };
  }).catch(function(e) {
    console.error('fsGetStats:', e);
    return { total: 0, activeTrial: 0, subscribed: 0, freeService: 0, expired: 0, thisMonth: 0 };
  });
}

function fsGetUserCount() {
  return db.collection('users').get().then(function(snap) {
    return snap.size;
  }).catch(function(e) { console.error('fsGetUserCount:', e); return 0; });
}
