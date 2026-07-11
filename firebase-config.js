/* ============================================================
   firebase-config.js — تهيئة Firebase (_compat — بدون modules)
   يعمل مباشرة في المتصفح دون سيرفر
   ============================================================ */

// Firebase SDK — يتم تحميله عبر <script> عادية في index.html
// لا نحتاج import — firebase متاح كـ عالمي (global)

// مفاتيح مشروع Firebase
var firebaseConfig = {
  apiKey: "AIzaSyA2qqRMztv8OVSJDTAKLE6uv1bWCGP8kGk",
  authDomain: "iq-cutting-624c8.firebaseapp.com",
  projectId: "iq-cutting-624c8",
  storageBucket: "iq-cutting-624c8.firebasestorage.app",
  messagingSenderId: "482702110817",
  appId: "1:482702110817:web:5222700e0ce69466543a20",
  measurementId: "G-9NP8JF4ETG"
};

// تهيئة Firebase
firebase.initializeApp(firebaseConfig);

// تصدير خدمات Firebase كمتغيرات عالمية
var auth = firebase.auth();
var db = firebase.firestore();
