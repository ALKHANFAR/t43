# سيادة — تقرير الامتثال للمعايير (7 سبتمبر 2026 · v1.5.1)

كل رقم هنا مُنتَج بأداة قابلة لإعادة التشغيل (`npm test`)، وكل حدّ للأداة مذكور صراحة. ما لا تقيسه الأدوات مكتوب على أنه غير مقيس.

## 1) الوصولية — WCAG 2.1 AA

فحصان مستقلان:

**أ) Lighthouse داخل Chrome حقيقي** (`npm run a11y:chrome`) — يشمل التباين الفعلي والتركيز والأدوار.

| الصفحة | Accessibility | فحوصات فاشلة |
|---|---|---|
| index.html | **100** | 0 |
| ar.html | **100** | 0 |
| integrations.html | **100** | 0 |
| demo.html | **100** | 0 |
| privacy.html | **100** | 0 |
| 404.html | **100** | 0 |
| app/chat.html | **100** | 0 |
| app/onboard.html | **100** | 0 |

**ب) axe-core في jsdom** (`npm run a11y`) — فحص بنيوي سريع: 0 مخالفات على الصفحات الست الرئيسية.
حدّ الأداة: jsdom بلا canvas، لذا لا يستطيع axe هنا حساب `color-contrast` ويُبلّغ عنه كـ "incomplete" بدل إخفائه. التباين مغطّى فعليًا بالفحص (أ) وبالجدول أدناه.

خارج نطاق الأدوات ومُعالَج يدويًا: نافذة ربط الأداة في `app/chat.html` تنقل التركيز داخلها، تحبس Tab، تُغلق بـ Escape، وتعيد التركيز للزر الفاتح. لا يوجد `outline:none` بلا بديل مرئي.

## 2) تباين الألوان — WCAG 2.1 (محسوب من القيم الفعلية في CSS)

نفس القيم مستخدمة في الصفحات الثماني كلها، بما فيها حالات لا يراها Lighthouse لأنها مخفية وقت الفحص (مشاهد الديمو قبل التشغيل).

| الاستخدام | الزوج | النسبة | المستوى |
|---|---|---|---|
| نص أساسي | `#0A0A0A` على `#FFFFFF` | 19.8:1 | AAA |
| نص ثانوي `--ash` | `#6E6E6C` على `#FFFFFF` | 5.1:1 | AA |
| نص ثانوي على الخلفية الفاتحة | `#6E6E6C` على `#F7F7FB` | 4.8:1 | AA |
| نص ثانوي في التطبيق `--ash-2` | `#6F6F6D` على `#FFFFFF` | 5.0:1 | AA |
| placeholder الحقول | `#757575` على `#FFFFFF` | 4.6:1 | AA |
| الأخضر على أبيض / أبيض على الأخضر | `#0B844B` ↔ `#FFFFFF` | 4.8:1 | AA |
| الأخضر الفاتح على أسود | `#40E799` على `#0A0A0A` | 12.4:1 | AAA |
| رمادي على أسود | `#A5A5A2` على `#0A0A0A` | 8.0:1 | AAA |
| وسوم قسم التكلفة على أسود | `#8C8C8A` على `#0A0A0A` | 5.9:1 | AA |
| رسائل الخطأ | `#B03A2E` على `#FFFFFF` | 6.0:1 | AA |
| حدود حقول الإدخال (غير نصي، 3:1) | `#8A8A88` على `#FFFFFF` | 3.5:1 | AA |

## 3) صحة HTML — WHATWG (html-validate)

`html-validate:recommended` على الصفحات الثماني: **0 أخطاء**.
القواعد المُطفأة في `.htmlvalidate.json` هي قواعد أسلوب فقط، وليست قواعد صحة أو وصولية:
`no-inline-style`, `no-trailing-whitespace`, `long-title`, `attribute-boolean-style`, `void-style`, `no-raw-characters`, `attr-quotes`, `require-sri` (لا سكربتات أو أنماط خارجية), `prefer-button`.
كل `<button>` في HTML الثابت يحمل `type` صريحًا (الأزرار المولّدة بـ JS خارج أي `<form>`)، ولا أدوار ARIA زائدة.

## 4) الأمان

**رؤوس الأمان** (في `.htaccess`): HSTS preload · CSP بـ `script-src 'self'` بلا `unsafe-inline` (كل السكربتات ملفات خارجية، لا معالجات مضمّنة) · `font-src 'self'` · X-Content-Type-Options · X-Frame-Options · Referrer-Policy · Permissions-Policy · COOP · إجبار HTTPS · إخفاء X-Powered-By · `/.well-known/security.txt` (RFC 9116).

> **حدّ مهم:** هذه الرؤوس تُرسَل فقط عند الاستضافة على Apache (cPanel). **GitHub Pages يتجاهل `.htaccess` ولا يرسل أيًّا منها.** إذا كان النشر على GitHub Pages فالحماية الفعلية هي: لا سكربتات مضمّنة، لا موارد طرف ثالث، لا أسرار. لتفعيل الرؤوس فعليًا انقل الاستضافة إلى Cloudflare Pages أو Netlify (`_headers`).

**النموذج:** honeypot + تحقق في المتصفح + تحقق داخل فلو Activepieces. لا reCAPTCHA. رابط الويب هوك عام بطبيعته (يُستدعى من المتصفح) ولا يحميه من الإرسال الآلي إلا الفلو نفسه.

## 5) الخصوصية — PDPL السعودي + GDPR

صفر متتبعات، صفر كوكيز. الخطوط والشعار مستضافة محليًا (لا يُرسَل IP الزائر إلى Google Fonts).
**الاستثناء الوحيد أثناء التصفح:** شعارات الأدوات في صفحة التكاملات ولوحة الأدوات داخل التطبيق تُحمَّل من `cdn.activepieces.com` بطلبات بلا كوكيز وبلا referrer (`crossorigin="anonymous" referrerpolicy="no-referrer"`)، أي أن الـ CDN يرى IP الزائر فقط. عدا ذلك، الطلب الوحيد لطرف ثالث يحدث عند إرسال نموذج التسجيل (إلى Activepieces Cloud). سياسة الخصوصية ثنائية اللغة تذكر: ما يُجمع، لماذا، أين، الحقوق (اطلاع/تصحيح/حذف خلال 30 يومًا)، وتعهد عدم التدريب على البيانات.

## 6) SEO

title · description بطول مناسب · canonical واحد لكل صفحة · hreflang متبادل (en/ar/x-default) على الصفحتين الرئيسيتين · Open Graph + Twitter Card بصورتين 1200×630 · h1 واحد لكل صفحة مفهرسة (privacy فيها h1 لكل لغة، والديمو h1 لكل مشهد) · lang+dir · JSON-LD صالح (Organization, SoftwareApplication, FAQPage) · sitemap.xml · robots.txt · 404 مخصصة · manifest + أيقونات.
صفحات التطبيق (`app/*`) موسومة `noindex`. لا صفحات مكررة (أُزيلت نسخ `app/demo.*` و `app/pieces.js`).

## 7) الأداء — ميزانية النقل (gzip)

| الصفحة | HTML | JS | صور وخطوط (تُحمَّل مرة ثم cache لكل الصفحات) |
|---|---|---|---|
| index.html | 13 KB | 5 KB (site.js) | الشعار 30 KB + Jost/Inter |
| ar.html | 14 KB | 5 KB (site.js) | الشعار + Readex Pro/IBM Plex Sans Arabic |
| integrations.html | 4 KB | 2 + 27 KB (كتالوج 712 أداة) | الشعار + Jost/Inter |
| demo.html | 8 KB | 4 KB | الشعار + Readex Pro |
| app/chat.html | 9 KB | 12 + 27 KB (الكتالوج) | الشعار + Readex Pro/IBM Plex |
| app/onboard.html | 6 KB | 4 KB | الشعار + Readex Pro/IBM Plex |

بدون إطار عمل، بدون jQuery، بدون خط أيقونات. الشعار والأيقونة ملفان في `assets/` بدل base64 مضمّن (كان يضاعف حجم كل صفحة ولا يُخزَّن مؤقتًا). الخطوط محلية (Jost و Inter و Readex Pro كخطوط متغيرة: ملف واحد لكل عائلة/subset) مع `preload` للخط الحرج والشعار و `font-display:swap`، فلا يوجد مورد خارجي يحجب الرسم. كل `<script>` بـ `defer`. الشعارات lazy.
درجات Lighthouse (mobile emulation, headless Chrome) في الجدول أدناه. غير مقيس هنا: Core Web Vitals على أجهزة حقيقية.

| الصفحة | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| index.html | 99 | 100 | 100 | 100 |
| ar.html | 99 | 100 | 100 | 100 |
| integrations.html | 98 | 100 | 100 | 100 |
| demo.html | 97 | 100 | 100 | 100 |
| privacy.html | 98 | 100 | 100 | 100 |
| 404.html | 100 | 100 | 100 | — (noindex) |
| app/chat.html | 95 | 100 | 100 | — (noindex) |
| app/onboard.html | 99 | 100 | 100 | — (noindex) |

CLS = 0 على كل الصفحات (ar.html: 0.01)، TBT = 0 ms. صفحات التطبيق و404 موسومة `noindex` عمدًا، لذلك لا تنطبق عليها درجة SEO.

## 8) التدويل — i18n

`ar.html` مبنية بالكامل بخصائص منطقية (`inline-start/end`, `block-start/end`). خطان لكل لغة. الأرقام المختلطة مثل 24/7 داخل `dir="ltr"`. `hreflang` متبادل. صفحة التكاملات تبدّل اللغة والاتجاه في المكان.

## 9) المستودع — معايير الهندسة

LICENSE · SECURITY.md · CHANGELOG.md (Keep a Changelog + SemVer) · .editorconfig · .nvmrc · `.nojekyll` · قالب Issues · `package-lock.json` متتبَّع.
**CI (GitHub Actions):** `npm ci` من ملف القفل + cache، ثم `npm test` = فحص JS + سلامة الكتالوج + صحة HTML + axe (jsdom) + Lighthouse في Chrome. يفشل البناء عند أي مخالفة.
لا PHP، لا أسرار، لا كلمات مرور في المستودع. كتالوج الأدوات (`pieces.js`) ملف واحد بـ 712 أداة، لكل منها شعار ووصف من سطر واحد، ويتحقق منه `npm run catalog` في CI (لا وصف فارغ أو مبتور، والشعارات من مصدر واحد).

## إعادة التشغيل
```bash
npm ci
npm test
```
`a11y:chrome` يحتاج Chrome مثبتًا على الجهاز (موجود على ubuntu-latest في GitHub Actions).
