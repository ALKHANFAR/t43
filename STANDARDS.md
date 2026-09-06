# سيادة — تقرير الامتثال للمعايير (6 سبتمبر 2026 · v1.0.0)

كل نتيجة هنا مُنتجة بأداة، لا بتقدير. الأوامر قابلة لإعادة التشغيل.

## 1) الوصولية — WCAG 2.1 AA (axe-core 4.x)
| الصفحة | مخالفات | فحوصات ناجحة |
|---|---|---|
| index.html | **0** | 43 |
| ar.html | **0** | 43 |
| integrations.html | **0** | 30 |
| privacy.html | **0** | 17 |
| app/chat.html | **0** | 24 |
| app/onboard.html | **0** | 22 |

القواعد المفحوصة: wcag2a, wcag2aa, wcag21a, wcag21aa, best-practice. تشمل: المعالم (landmarks)، التسميات، أسماء الروابط، ترتيب العناوين، التباين، السمات lang/dir.

## 2) تباين الألوان — WCAG 2.1
| الاستخدام | النسبة | المستوى |
|---|---|---|
| حبر على أبيض `#0A0A0A` | 19.8:1 | AAA |
| نص ثانوي `#767674` | 4.55:1 | AA |
| الأخضر `#0B844B` على أبيض | 4.76:1 | AA |
| الأخضر `#40E799` على أسود | 12.4:1 | AAA |
| رمادي `#A5A5A2` على أسود | 8.0:1 | AAA |

## 3) صحة HTML — WHATWG (html-validate recommended)
كل الصفحات السبع: **0 أخطاء**.

## 4) الأمان — OWASP Secure Headers (في .htaccess)
> **تنبيه:** هذه الرؤوس تُطبَّق على استضافة Apache (cPanel) فقط. GitHub Pages يتجاهل `.htaccess`، فعند النشر عليه لا تُرسل هذه الرؤوس من الخادم.

HSTS (preload) · **CSP صارمة: `script-src 'self'` بلا `unsafe-inline` — كل السكربتات ملفات خارجية ولا معالجات مضمّنة** · قائمة مصادر صريحة · X-Content-Type-Options · X-Frame-Options · Referrer-Policy · Permissions-Policy · COOP · إجبار HTTPS · منع تحميل CSV/LOG · إخفاء X-Powered-By · `/.well-known/security.txt` (RFC 9116).
النموذج: honeypot + تحقق خادم + تنقية المدخلات + منع التكرار. لا reCAPTCHA (لا بيانات لطرف ثالث).

## 5) الخصوصية — PDPL السعودي + GDPR
صفر متتبعات، صفر كوكيز طرف ثالث. سطر موافقة صريح عند التسجيل. سياسة خصوصية ثنائية اللغة تذكر: ما يُجمع، لماذا، أين، الحقوق (اطلاع/تصحيح/حذف خلال 30 يومًا)، وتعهد عدم التدريب على البيانات.

## 6) SEO — الأساسيات الكاملة
title · description · canonical · hreflang (en/ar/x-default) · Open Graph + Twitter Card بصورتين 1200×630 · h1 واحد لكل صفحة · lang+dir · sitemap.xml مع بدائل اللغة · robots.txt · 404 مخصصة · manifest + أيقونات.

## 7) الأداء — ميزانية النقل (gzip)
| الصفحة | مضغوطة |
|---|---|
| index.html | 56 KB |
| ar.html | 57 KB |
| integrations.html + pieces.js | 45 + 24 KB |
| app/chat.html | 89 KB |

بدون أي إطار عمل، بدون jQuery، بدون خط أيقونات. الخطوط بـ `display=swap` و preconnect. الشعارات lazy. `pieces.js` بـ defer. ضغط وتخزين مؤقت من الخادم.

## 8) التدويل — i18n
RTL/LTR بخصائص منطقية (`inline-start/end`) لا `left/right`. خطان لكل لغة. أرقام tabular. `hreflang` متبادل.

## 9) المستودع — معايير الهندسة
LICENSE · SECURITY.md (سياسة إبلاغ) · CHANGELOG.md (Keep a Changelog + SemVer) · .editorconfig · `.nojekyll` · قالب Issues ·
**CI على GitHub Actions**: كل push يشغّل فحص JS + صحة HTML + تدقيق WCAG، ويفشل البناء عند أي مخالفة.
لا PHP، لا أسرار، لا كلمات مرور في المستودع.

## إعادة التشغيل
```bash
npm install
npm test        # lint:js + validate (WHATWG) + a11y (WCAG 2.1 AA)
```
نفس الأمر يعمل تلقائيًا في GitHub Actions مع كل تعديل.
