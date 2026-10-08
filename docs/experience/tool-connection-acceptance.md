# قبول تجربة ربط الأدوات

لقطة مصدر وقراءة مزود بتاريخ 8 أكتوبر 2026. هذا سجل قبول للعمل، وليس معاينة أو إثبات إطلاق. أساس الإنتاج المفحوص: `17818bf`؛ تغييرات حراسة auth وrevalidate محلية في `d3a618f` و`591bbef` حتى يثبت نشرها.

## الرحلة والدليل المطلوب

| الشاشة / حالة العميل | المصدر القائم | القضية | الدليل الحاضر | ما ينقص للقبول |
| --- | --- | --- | --- | --- |
| قائمة الأدوات / متاحة للاكتشاف | `app/chat.js:realTools`، `lib/pilot-tool-discovery.mjs` | ABO-40/50 | كتالوج واجهة؛ discovery الحقيقي عبر MCP؛ REST القديم مغلق | البحث حسب حاجة التاجر، وليس تحويل كل عنصر كتالوج إلى قدرة منفذة |
| الربط / تجهيز الطريقة | `app/chat.js:realConnect`، `lib/tool-connections.mjs:metadata` | ABO-61/69 | native schema لمشروع الشركة؛ خطأ عند غياب التفويض | فشل قابل للمحاولة دون فقد سياق الموظف أو طلبه |
| الربط / طريقة غير مدعومة | `app/chat.js:rcRender`، `lib/tool-connections.mjs:supportedFields` | ABO-61 | local test يمنع controls غير المدعومة وPOST تجاوزها | تجربة Chrome لأسباب عدم الإتاحة، وقرار native dynamic options عند الحاجة |
| الربط / انتظار الموافقة | `app/chat.js:rcOauth`، `lib/tool-connections.mjs:oauthStart` | ABO-61/67 | محاولة مقيدة بالشركة والجلسة ومدة؛ تحقق source/origin في الرد | كشف إغلاق النافذة مبكرًا، مسار إلغاء/مهلة ثم استئناف الطلب دون إعادة أثر |
| الربط / اتصال محفوظ | `app/chat.js:realTools/rcPost`، `lib/tool-connections.mjs:publicConnection` | ABO-61 | Personal Project: Gmail/Slack/Google Sheets PROJECT exclusive ACTIVE؛ 0 Flows، جرد مكتمل | scope الفعل ونتيجة مزود فعلية؛ لا تستخدم ACTIVE مرادفًا لكل الصلاحيات أو التنفيذ |
| الربط / اتصال يحتاج انتباه | `app/chat.js:data-revalidate`، `lib/tool-connections.mjs:revalidate` | ABO-61/63 | حراسة exact id+piece محليًا؛ عرض ERROR حاضر | كل status غير ACTIVE يجب ألا يوصف تحققًا ناجحًا؛ إعادة ربط بخطوة واضحة |
| الموظف / الإذن باستعمال الأداة | `lib/tool-connections.mjs:assertOwnedExternal` | ABO-67 | اتصال ACTIVE حصري للشركة قبل فعل منفرد | سياسة موظف دائمة محفوظة ومفروضة، سحب وانتهاء الإذن |
| الموظف / النتيجة | `app/chat.js:siyResumePendingActivation`؛ إيصالات التشغيل القائمة | ABO-48/69 | نتيجة Asana مثبتة لشريحة قبول سابقة | لكل مهمة: flow/version/run/provider/customer result؛ اختبار كتابة مع موافقة ملائمة |
| فصل أداة غير مستخدمة | `lib/tool-connections.mjs:disconnect` | ABO-63 | source guard لجرد DRAFT/LOCKED كامل ثم DELETE | تجربة اتصال QA معزول وقراءة مستقلة بعد الفصل |
| فصل أداة تستخدمها مهمة | PR38 `codex/abo63-confirmed-disconnect-20261004` | ABO-63 | كود فرع سابق واختبارات؛ PR OPEN غير منشور | تكييف العقد الحالي، توقف مؤكد، فشل جزئي صادق، ثم تجربة حية معزولة |

## مراجعة كل حالة في Chrome

- [ ] العنوان يوضح الأداة والمرحلة؛ زر رئيسي واحد مناسب للحالة.
- [ ] loading لا يتسبب في طلب ثانٍ؛ زر الانتظار يتغير نصه ويعلن حالة الانتظار لقارئ الشاشة.
- [ ] خطأ الشبكة، التفويض المفقود، عدم دعم الطريقة، ومزود يرفض الحساب لها فعل تالٍ محدد.
- [ ] إلغاء OAuth أو إغلاق النافذة يبقي الموظف والطلب والمسودة؛ العودة تعيد المحاولة الآمنة.
- [ ] بيانات الاتصال المحفوظة، سياسة الموظف، وآخر نتيجة تشغيل تظهر كحقائق منفصلة.
- [ ] لا نجاح عند status غير ACTIVE، ولا provider outcome من revalidate وحده.
- [ ] consent scopes المعروضة هي المطلوبة، لا ضمان أن كل إجراء مسموح أو نجح.
- [ ] RTL/LTR والجوال والكيبورد وترتيب focus والعودة للزر الأول بعد غلق النافذة تعمل.
- [ ] فصل الأداة يصرح بالمهام التي ستتوقف؛ الفشل الجزئي لا يعرض نجاحًا عامًا.
- [ ] سجل الإثبات لكل اختبار: السيناريو، commit/deployment، الشركة المعزولة، flow/run، الحالة النهائية، النتيجة المرئية. لا أسرار ولا بيانات حساب في التقرير.

## تكييف PR38 دون إعادة بناء

1. لا تستبدل الملف القديم كاملًا: النسخة الحالية أصبحت تعتمد `ap_setup_guide` من native MCP؛ وأضيف `assertOwnedExternal` وcloud OAuth وإكمال attempts القديمة والتحقق exact revalidate. احتفظ بها.
2. انقل فرق dependency map و`confirmInUse` وnative `CHANGE_STATUS` فقط إلى lifecycle الحالي. راجع server writer لتقبّل confirmation صريحة، وUI writer لعرض الأثر والتأكيد.
3. راجع نتيجة pause exact flowId مع project/status، وليس project/status فقط في الفرع القديم. اقرأ الربط والاعتماد مجددًا قبل DELETE؛ حدد التعامل مع تدفق نشر متزامن كخطر قبول منفصل.
4. إذا فشل pause لاحق أو DELETE، احتفظ بالاتصال واعرض المهام التي توقفت بالفعل؛ لا تعِد تشغيلها تلقائيًا. اختبر repeat/partial/foreign/unknown inventory.
5. حدث العقد والفهرس وسجل ABO-63؛ لا تعتبر نقل الكود قبولًا حيًا.

## مراجع التصميم — بحث Exa، مصادر أصلية

- [Microsoft: human-centered design](https://learn.microsoft.com/en-us/agents/design-guidelines/human-centered-design): بداية واضحة، تعديل وتصحيح من السياق، تعافٍ لا يفرض بدء الرحلة مجددًا.
- [Microsoft: foundational agent customization](https://learn.microsoft.com/en-us/agents/design-guidelines/foundational-customizations-for-agents): هوية وغرض وبدايات مفيدة؛ إعادة المستخدم إلى سياقه وسجل محادثاته.
- [Microsoft Design: agent UX](https://microsoft.design/articles/ux-design-for-agents/): حالة وأفعال مرئية وتحكم مفهوم، عمل الخلفية يظهر عند حاجة المستخدم.
- [Linear: March 2026 refresh](https://linear.app/now/behind-the-latest-design-refresh): إعطاء محتوى المهمة الوزن الأعلى، تنقل أقل بروزًا، وأزرار وأيقونات ومواقع متسقة. هذا اتجاه للتصميم، وليس تبني مكونات Linear.
