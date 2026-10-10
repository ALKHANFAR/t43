# Adaptive Experience Engine — تدقيق 10 أكتوبر 2026

هذه لقطة أدلة قبل التنفيذ. المرجع المعتمد من المؤسس وAGENTS هو ALKHANFAR/t43؛ VF مصدر مقارنة، لا بديل تلقائي. لم يتغير الإنتاج.

## النسخ والنشر

| المرجع | SHA | الدليل والحالة |
| --- | --- | --- |
| t43 فرع التوحيد | b6fba4b0b123657f957d002feee12c5732ee5c27 | PR62 مفتوح، draft، غير مدمج، mergeable=false |
| t43 الخدمة siyadah-direct-ui | aaf2db17cd1ff36707310c3d7d55bdcf60391e99 | Railway deployment ce86e9f6-bfbd-4bd2-8449-75eb285f7822 SUCCESS؛ مصدر codex/abo-38-isolation-gate-20261001 |
| VF الخدمة siyadah-vf | 03f97290c7977e1b8f67b39b96ba49b2026446f3 | Railway deployment 0c7e6e4d-2264-4dff-b53b-237099436c14 SUCCESS؛ مصدر main |
| VF عزل QA | 5fbda5a1ac7b8c5b990ee8e244c6409aab01957b | PR33 draft وغير مدمج؛ نتائج الاختبارات المذكورة في PR ليست تشغيلًا مستقلًا هنا |

فُحصت قائمة فروع codex: 73 في t43 وفرع عزل في VF، وطلبات الدمج المفتوحة ذات الصلة. ليست هذه مراجعة سطرية لكل فرع تاريخي. PR37/38/44 تحتوي إصلاحات أقدم تمت مراجعة نقل أجزاء منها في PR62؛ لا تُدمج مرة ثانية اعتمادًا على عنوان PR.

## مصفوفة الكود

| الميزة | دليل t43 | دليل VF المنشور | القرار |
| --- | --- | --- | --- |
| تخطيط DeepSeek | server.mjs: deepseekReply، ask، modelTools | lib/chat-engine/legacy.mjs: createLegacyAdapter، startTurn، DEFAULT_MODEL | إعادة استخدام حلقة t43؛ لا إضافة نموذج أو محرك موازٍ |
| سياق الشركة والموظف والتاريخ | server.mjs: selectKnowledgeContext، conversationMemory؛ lib/cumulative-memory.mjs | محرك gateway يستقبل context/history/employee | الحفاظ على الاسترجاع الموجود؛ ليس إرسال التاريخ كله |
| MCP الأصلي | lib/activepieces-mcp.mjs: discoverMcpCatalog، initialize، nextCursor | lib/activepieces-mcp.mjs: rpc وcallNative | الحفاظ على كتالوج t43 ودليله؛ لا تحويل أدواته إلى قوالب مغلقة |
| ربط دون صفحة AP | t43 OAuth مشروع الشركة؛ probe معزول | lib/activepieces-native-auth.mjs: tokenFor، projectId/expiry checks، single-flight | ميزة VF مستقلة تحتاج port وعزل حي؛ ليست شرطًا لبناء renderer |
| الموافقات | lib/activepieces-mcp.mjs: prepare/consume، tenant/conversation/expiry | lib/approvals/approvals.mjs: consumeChat، inputFingerprint، standing limits | الحفاظ على المسار الحالي؛ لا ادعاء أن عقد VF الأقوى موجود في t43 |
| منع تكرار الأثر | lib/company-effect-lock.mjs؛ هوية الطلب وقراءة التشغيل | lib/effects/ledger.mjs: atomic claim، effectKey؛ lib/requests/dispatcher.mjs: SKIP LOCKED | لا نقل منظومة SQL ضمن تعديل UI؛ مقارنة مستقلة قبل الدمج |
| عرض الموظف | lib/chat-ui.mjs: chatUiForResponse؛ app/chat.js: siyAdaptiveUi | واجهة الموظف والتعليمات والتشغيل موجودة، وليست محرك UI مولّد مثبتًا | تمديد الموجود |
| عرض النتائج والموافقة | app/chat.js: siyReplyHtml، siyBuilderProposalHtml، siyResultRow | lib/customer-reply.mjs: verifiedRunReply/approvedToolReply | إعادة استخدام؛ لا تصنيع إيصالات من نص النموذج |
| اختيار شكل العرض بالنموذج | app/reply-view.js وتعديل prompt محليان، غير مختبرين عند بدء التدقيق | لا دليل في ملفات محرك VF المقروءة على عقد Adaptive UI مماثل | توحيد في عقد صغير مشترك بدل إضافة renderer آخر |
| قياس الاستدعاءات | server.mjs: chat_model_usage يسجل tokens/cache/latency | gateway.mjs: usage + meter.tokens | ينقص t43 ربط request/company/model والتسعير المؤرخ؛ لا اختلاق تكلفة فعلية |
| بث تجربة UI | استعلام حالة طلب موجود؛ لا بث UI تدريجي مثبت | dispatcher داخلي ليس SSE للواجهة | مؤجل؛ لا تسمية polling/animation بثًا |

الفهرس في VF يحوي 55 ميزة، لكنه يحمل نصوص حالة وروابط t43 قديمة؛ حالة الفهرس وحدها ليست إثبات نشر. قُرئت ملفات MCP/native-auth/gateway/legacy/approvals/effects/dispatcher/customer-reply عند SHA المنشور أعلاه. الفجوات العامة غير المقروءة بعمق تبقى غير مصنفة.

## أصغر معمارية قابلة للمراجعة

حلقة DeepSeek الحالية → رد نصي أو عقد عرض اختياري → parser مشترك في الخادم والمتصفح → renderer DOM آمن → تفاعل محلي يجهز إدخالًا حرًا أو يفتح تفاصيل → واجهات سيادة الموجودة. الموافقة والنتيجة من الخادم، لا من JSON النموذج. نفس المسار للشاتين؛ لا سيناريو خاص للمبيعات.

المكونات أنواع عرض، وليست قائمة نيات أو قائمة أدوات. العميل يستطيع تعديل الخطة والأدوات والسلوك بالكلام. الاقتراح الاستباقي لا ينفذ ولا يوسع النطاق تلقائيًا. لا React migration، ولا قاعدة بيانات UI جديدة، ولا executor جديد.

## الحذف

احذف فقط تجربة عقد SiyadahReplyV1 المحلية عند استبدالها بالعقد الموحد؛ مخاطر 1/10 لأنها لم تُرفع ولم ينشر لها مستهلك. لا تحذف الموافقة أو الإيصالات أو حالات الطلب أو الكتالوج. لا يوجد مبرر مثبت لحذف محرك VF أو بيانات العملاء. درجات المخاطر تقدير هندسي وليست احتمالًا إحصائيًا.

## بوابات الإثبات

اختبارات العقد والواجهة ليست إثبات اختيار النموذج الصحيح أو أداء موظف حي. المطلوب بعد النموذج: طلبات AR/EN متنوعة، 20 تفاعلًا محليًا مع قياس الشبكة، إعادة التحميل، عزل A/B، موافقة فعل محدد، و100 رحلة قبل/بعد بتكلفة مزود فعلية وقياس أول نتيجة مفيدة. بيانات Railway تعرض أسماء أسرار فقط؛ لم تُقرأ قيم ولم تُنفذ أدوات حية خلال التدقيق.


فحص server.mjs في VF المنشور يثبت الربط: createNativeMcpAuth مع native_mcp_auth؛ gateway الجديد فقط عند engine_interface وapprovals_v2، ويختار chat_engine للشركة (legacy/native)، وإلا يبقى deepseekReply. async_dispatch أيضًا خلف علم. وجود هذه الوحدات لا يثبت تفعيل الأعلام عند العميل؛ لم تُقرأ قيم الأعلام أو تُغيّر. لذلك نقل VF كله ضمن تعديل الواجهة قد يضيف مسارات تنفيذ متعددة؛ القرار نقل الميزات المحددة لاحقًا بعقود واختبارات، لا دمج خوادم عشوائي.
