/* ============================================================
   access-control.js — نظام الصلاحيات والاشتراكات
   يعمل كسكريبت عادي — بدون ES modules
   ============================================================ */

/* ---------------- قائمة الخدمات المتاحة ---------------- */
var SERVICES = {
  cutting:   { name: 'تحسين قص الألواح', icon: '🪚', free: true },
  design:    { name: 'توليد التصاميم',    icon: '🎨', free: false },
  cost:      { name: 'تقدير التكلفة',     icon: '💰', free: false },
  schedule:  { name: 'جدول المواعيد',     icon: '📅', free: false },
  inventory: { name: 'الجرد والمخزون',    icon: '📦', free: false },
  profit:    { name: 'الربح والخسارة',    icon: '📊', free: false },
  clients:   { name: 'قاعدة العملاء',     icon: '👥', free: false },
  vr:        { name: 'عرض VR',           icon: '🥽', free: false },
  admin:     { name: 'لوحة المدير',       icon: '⚙️', free: false }
};

var ALWAYS_FREE = ['cutting'];
var WHATSAPP_LINK = 'https://wa.me/963991414270';

function checkAccess(serviceName, userProfile) {
  if (ALWAYS_FREE.indexOf(serviceName) !== -1) return true;
  if (!userProfile) return false;
  if (userProfile.role === 'admin') return true;
  var status = userProfile.subscriptionStatus || 'expired';
  if (status === 'subscribed') return true;
  if (status === 'trial' && !fsIsTrialExpired(userProfile)) return true;
  if (status === 'free_service') {
    return userProfile.freeServiceChoice === serviceName;
  }
  return false;
}

function getAccessInfo(userProfile) {
  if (!userProfile) return { status: 'none', label: 'غير مسجل', color: '#dc2626' };
  if (userProfile.role === 'admin') return { status: 'admin', label: 'مدير النظام', color: '#7c3aed' };
  var status = userProfile.subscriptionStatus || 'expired';
  if (status === 'subscribed') return { status: 'subscribed', label: 'اشتراك نشط', color: '#16a34a' };
  if (status === 'trial') {
    if (fsIsTrialExpired(userProfile)) return { status: 'expired', label: 'انتهت التجربة المجانية', color: '#dc2626' };
    var days = fsTrialDaysLeft(userProfile);
    return { status: 'trial', label: 'تجربة مجانية — ' + days + ' يوم متبقي', color: '#f59e0b' };
  }
  if (status === 'free_service') {
    var svc = SERVICES[userProfile.freeServiceChoice];
    return { status: 'free_service', label: 'خدمة مجانية: ' + (svc ? svc.name : userProfile.freeServiceChoice), color: '#0ea5e9' };
  }
  return { status: 'expired', label: 'منتهي الصلاحية', color: '#dc2626' };
}
