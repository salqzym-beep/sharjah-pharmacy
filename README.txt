صيدلية الشارقة – مشروع Vercel Blob

الملفات: index.html و admin.html و api/upload.js و package.json

خطوات النشر:
1. ارفع كل ملفات المشروع إلى مستودع GitHub المرتبط بمشروع Vercel، مع الحفاظ على مجلد api.
2. في Vercel افتح Storage وأنشئ Blob Store واربطه بالمشروع. عادةً يضاف BLOB_READ_WRITE_TOKEN تلقائياً.
3. إذا لم يظهر المتغير، أضفه من Settings > Environment Variables بالاسم BLOB_READ_WRITE_TOKEN وقيمة التوكن من Blob.
4. أعد Deploy ثم افتح /admin.html وجرب رفع صورة منتج.

ملاحظة: Blob يجعل الصور مرفوعة وروابطها مشتركة للزوار، لكن بيانات المنتجات والأقسام نفسها لا تزال localStorage في متصفح لوحة الإدارة. مشاركة بيانات المنتجات عبر جميع الزوار تحتاج قاعدة بيانات مشتركة.
