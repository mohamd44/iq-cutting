/* ============================================================
   admin.js — لوحة تحكم المدير
   تظهر فقط للمستخدمين الذين role == "admin"
   يعمل كسكريبت عادي — بدون ES modules
   ============================================================ */

var adminPanel = null;
var adminUserProfile = null;

function initAdmin(userProfile) {
  adminUserProfile = userProfile;
  if (!userProfile || userProfile.role !== 'admin') return;
  createAdminPanel();
}

function createAdminPanel() {
  var old = document.getElementById('adminPanel');
  if (old) old.remove();

  adminPanel = document.createElement('div');
  adminPanel.id = 'adminPanel';
  adminPanel.className = 'admin-panel hidden';
  adminPanel.innerHTML = '<div class="admin-card">' +
    '<div class="admin-header">' +
    '<h2>⚙️ لوحة تحكم المدير</h2>' +
    '<button id="btnCloseAdmin" class="btn btn-danger btn-sm">✕ إغلاق</button>' +
    '</div>' +
    '<div id="adminStats" class="admin-stats"></div>' +
    '<div class="admin-section">' +
    '<h3>المستخدمون</h3>' +
    '<div id="adminUsersList" class="admin-users-list"><p class="hint">جارٍ تحميل البيانات…</p></div>' +
    '</div></div>';

  document.body.appendChild(adminPanel);

  document.getElementById('btnCloseAdmin').addEventListener('click', function() {
    adminPanel.classList.add('hidden');
  });

  loadAdminData();
}

function loadAdminData() {
  fsGetStats().then(function(stats) {
    var statsEl = document.getElementById('adminStats');
    if (statsEl) {
      statsEl.innerHTML = '<div class="admin-stat"><div class="v">' + stats.total + '</div><div class="l">إجمالي المستخدمين</div></div>' +
        '<div class="admin-stat"><div class="v">' + stats.activeTrial + '</div><div class="l">في التجربة</div></div>' +
        '<div class="admin-stat"><div class="v">' + stats.subscribed + '</div><div class="l">مشتركون</div></div>' +
        '<div class="admin-stat"><div class="v">' + stats.freeService + '</div><div class="l">خدمة مجانية</div></div>' +
        '<div class="admin-stat"><div class="v">' + stats.thisMonth + '</div><div class="l">جدد هذا الشهر</div></div>';
    }

    return fsGetAllUsers(200);
  }).then(function(users) {
    var listEl = document.getElementById('adminUsersList');
    if (!listEl) return;

    if (!users || !users.length) {
      listEl.innerHTML = '<p class="hint">لا يوجد مستخدمون بعد</p>';
      return;
    }

    listEl.innerHTML = '';
    var statusColors = { trial: '#f59e0b', subscribed: '#16a34a', free_service: '#0ea5e9', expired: '#dc2626' };
    var statusLabels = { trial: 'تجربة', subscribed: 'مشترك', free_service: 'مجاني', expired: 'منتهي' };

    users.forEach(function(u) {
      var row = document.createElement('div');
      row.className = 'admin-user-row';
      var status = u.subscriptionStatus || 'expired';
      var color = statusColors[status] || '#94a3b8';
      var label = statusLabels[status] || status;

      row.innerHTML = '<div class="admin-user-info">' +
        '<span class="admin-user-name">' + escapeAdmin(u.displayName || u.email || u.phone || u.id) + '</span>' +
        '<span class="admin-user-email">' + escapeAdmin(u.email || '') + '</span>' +
        '<span class="admin-user-status" style="background:' + color + '20;color:' + color + '">' + label + '</span>' +
        (u.disabled ? '<span class="admin-user-status" style="background:#fecaca;color:#dc2626">معطّل</span>' : '') +
        '</div>' +
        '<div class="admin-user-actions">' +
        '<select class="admin-status-select" data-uid="' + u.id + '">' +
        '<option value="trial"' + (status === 'trial' ? ' selected' : '') + '>تجربة</option>' +
        '<option value="subscribed"' + (status === 'subscribed' ? ' selected' : '') + '>مشترك</option>' +
        '<option value="free_service"' + (status === 'free_service' ? ' selected' : '') + '>خدمة مجانية</option>' +
        '<option value="expired"' + (status === 'expired' ? ' selected' : '') + '>منتهي</option>' +
        '</select>' +
        '<button class="btn btn-sm admin-btn-toggle" data-uid="' + u.id + '" data-disabled="' + (u.disabled ? 'false' : 'true') + '">' +
        (u.disabled ? 'تفعيل' : 'تعطيل') + '</button>' +
        '<button class="btn btn-sm btn-danger admin-btn-delete" data-uid="' + u.id + '">حذف</button>' +
        '</div>';
      listEl.appendChild(row);
    });

    listEl.querySelectorAll('.admin-status-select').forEach(function(sel) {
      sel.addEventListener('change', function(e) {
        var uid = e.target.dataset.uid;
        var newStatus = e.target.value;
        fsUpdateUserSubscription(uid, newStatus).then(function() {
          adminToast('✓ تم تحديث حالة المستخدم');
          loadAdminData();
        });
      });
    });

    listEl.querySelectorAll('.admin-btn-toggle').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var uid = e.target.dataset.uid;
        var disable = e.target.dataset.disabled === 'true';
        if (!confirm(disable ? 'هل تريد تعطيل هذا الحساب؟' : 'هل تريد تفعيل هذا الحساب؟')) return;
        fsToggleUserAccount(uid, disable).then(function() {
          adminToast(disable ? '✓ تم تعطيل الحساب' : '✓ تم تفعيل الحساب');
          loadAdminData();
        });
      });
    });

    listEl.querySelectorAll('.admin-btn-delete').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        var uid = e.target.dataset.uid;
        if (!confirm('هل تريد حذف هذا المستخدم نهائياً؟ لا يمكن التراجع!')) return;
        fsDeleteUser(uid).then(function() {
          adminToast('✓ تم حذف المستخدم');
          loadAdminData();
        });
      });
    });
  }).catch(function(e) {
    console.error('خطأ في تحميل بيانات المدير:', e);
  });
}

function escapeAdmin(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showAdminButton(userProfile) {
  if (!userProfile || userProfile.role !== 'admin') return;
  var headerActions = document.querySelector('.header-actions');
  if (!headerActions) return;
  if (document.getElementById('btnAdmin')) return;

  var btn = document.createElement('button');
  btn.id = 'btnAdmin';
  btn.className = 'btn';
  btn.textContent = '⚙️ لوحة المدير';
  btn.addEventListener('click', function() {
    if (adminPanel) {
      adminPanel.classList.toggle('hidden');
      if (!adminPanel.classList.contains('hidden')) loadAdminData();
    }
  });

  var btnLogout = document.getElementById('btnLogout');
  if (btnLogout) headerActions.insertBefore(btn, btnLogout);
  else headerActions.appendChild(btn);
}

function adminToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._tm);
  t._tm = setTimeout(function() { t.classList.add('hidden'); }, 2600);
}
