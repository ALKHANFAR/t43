# Siyadah AI

موقع سيادة ونموذج المنصة. ملفات ثابتة فقط — لا خادم، لا قاعدة بيانات، لا أسرار.

| المسار | المحتوى |
|---|---|
| `/` | الموقع: `index.html` (EN) · `ar.html` (AR) · `integrations.html` · `demo.html` · `privacy.html` |
| `/app` | نموذج المنصة: `onboard.html` (الإعداد الأول) · `chat.html` (التطبيق) · `README.md` مواصفة المطوّر |
| `STANDARDS.md` | تقرير المعايير: WCAG AA، HTML صالح، رؤوس الأمان، PDPL/GDPR، SEO |

## النشر
- **GitHub Pages:** Settings → Pages → `main` / root. جاهز خلال دقيقة.
- **استضافة عادية:** ارفع كل شيء في `public_html` بما فيه `.htaccess` و `.well-known/` (ملفات مخفية — على ماك: `Cmd+Shift+.`).

## التسجيلات
النموذج يرسل مباشرة إلى ويب هوك Activepieces، والفلو يحفظ التسجيل في جدول ويرسل إشعارًا بالبريد للفريق.
الرابط والإعدادات في بلوك `CONFIG` أول `index.js` و `ar.js`. لا يحتاج أي ملف على الخادم.

## ملاحظات
- `pieces.js` في الجذر هو كتالوج الأدوات (717 أداة، شعار + وصف لكل أداة) وتستخدمه `integrations.html` و `app/chat.html`.
- الخطوط مستضافة محليًا في `fonts/` (لا طلبات لـ Google Fonts).
- `.htaccess` يعمل على Apache فقط (cPanel). على GitHub Pages يُتجاهل بلا ضرر.
