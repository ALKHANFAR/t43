/* ORCHESTRATOR CONTRACT — the real backend will emit these over SSE from POST /message.
   The simulator below plays the same events with realistic delays; wiring the backend = replacing playEvents' source.

   {t:"say", text, why?}                          رسالة من سيادة — تنكشف كلمة كلمة مثل باقي الردود
   {t:"step", emp, tool, label, why?, ms}         صف خطوة في التتبع: شعار الأداة (أو حرف الموظف) + مؤشر حي → ✓ بعد ms
   {t:"handoff", from, to, text}                  تسليم بين موظفين: حرفاهما وسهم ← بينهما ثم النص (مثل: سعد ← نورة)
   {t:"await", card:{title, context, recommend,
                     options:[{label, events}]}}  يوقف التشغيل — بطاقة قرار؛ الاختيار يرسل رسالة منك ويكمل بأحداث الخيار
   {t:"preview", to, channel, text, editHint?}    يوقف التشغيل — معاينة الرسالة الصادرة حرفيًا مع [أرسل] و[عدّل]
   {t:"result", emp, tool, summary, before?,
                after?, reversible?, hold?}       صف نتيجة ✓ — hold: مهلة 7 ث مع «تراجع» قبل ما ترسل فعليًا؛
                                                  reversible: رابط «تراجع» 7 ث بعد التنفيذ؛ و«الأثر» يفتح الإيصال
   {t:"done", text?}                              سطر الختام — يطفي «يشتغل الآن…»
   للمحاكي فقط (مو من عقد الشبكة): options[].fx دالة محلية تُنفَّذ عند الاختيار،
   وresult.sent أحداث تُشغَّل بعد ما يرسل الـ hold فعليًا. */

/* ==========================================================================
   التسعير — مصدر واحد لكل الأرقام (الخطة، الرصيد المسبق، اللافتات)
   ========================================================================== */
var PRICING={ name:"الأعمال", price:499, list:998, actions:3000, credits:{price:100, actions:500} };

/* ==========================================================================
   الخطة والاستخدام — عقد واحد يقود لوحة «الخطة والاستخدام» واللافتات
   state: trial | active | near | over | pastdue
   ========================================================================== */
var PLAN={ name:PRICING.name, price:PRICING.price, list:PRICING.list, period:"شهري", renews:"1 أكتوبر", days:9, state:"active",
           actions:{used:2410, limit:PRICING.actions}, credit:{sar:0, actions:0}, employees:{used:3, limit:4}, autoReload:false,
           due:"573.85",
           invoices:[{m:"سبتمبر 2026", total:"573.85", url:"#"},{m:"أغسطس 2026", total:"573.85", url:"#"}],
           payment:"مدى •• 4321", vat:"3001•••••••03", cr:"10•••••••4" };

/* ==========================================================================
   ACTIONS — مصدر الحقيقة الوحيد: كل نتيجة نُفّذت (ما أُلغيت) تدخل هنا،
   ومنها يقرأ إيصال «الأثر» ويزيد عدّاد الخطة إجراءً لكل نتيجة
   ========================================================================== */
var ACTIONS=[];

/* ==========================================================================
   بيانات تجريبية
   tools: معرّفات الأدوات (slug) من الكتالوج — الاسم العربي والشعار من TN + TOOLS
   kpi: أربعة أرقام لكل موظف {v القيمة, l العنوان, t التغيّر عن الأسبوع الماضي, ok اتجاه جيد}
   ========================================================================== */
var EMPS = [
  { id:"saad", n:"سعد", r:"متابعة المبيعات", ini:"س", f:false, on:true, wait:1, since:"شغّال منذ 12 يوم", ver:3,
    kpi:[{v:"14",l:"ليدات اليوم",t:"+18%",ok:true},{v:"3 د",l:"ردّ خلال",t:"−2 د",ok:true},{v:"5",l:"مواعيد محجوزة",t:"+2",ok:true},{v:"64%",l:"نسبة التأهيل",t:"+6%",ok:true}],
    waits:[{t:"محمد العتيبي يطلب خصم 15%.",s:"ما وعدته بشيء.",a:["وافق على الخصم","ارفض بلطف"],
            r:["تم. أرسلت لمحمد العتيبي خصم 15% وحدّثت الفاتورة.","تم. اعتذرت لمحمد العتيبي بلطف وثبّت السعر — وعرضت عليه مكالمة معك لو حب يناقش."]}],
    log:[["14:52","حجزت موعدًا مع أحمد الغامدي، الثلاثاء 11:00."],["14:12","رديت على ليد من إنستغرام خلال 3 دقائق."],["12:40","ليدان غير مناسبين — أوقفت المتابعة."],["09:15","متابعة ثانية لـ 6 ليدات ما ردوا — خالد الدوسري منهم."]],
    auto:1, tone:0, hours:"8 ص – 10 م",
    rules:[["ما أعطي خصمًا بدون موافقتك",true],["ما أحجز أكثر من 6 مواعيد باليوم",true],["أتابع الليد 3 مرات كحد أقصى",true],["أرد خارج ساعات العمل",false]],
    tools:["whatsapp","hubspot","google-calendar"],
    instr:"تابع كل عميل جديد خلال خمس دقائق. اسأله عن حجم فريقه ووش يحتاج بالضبط. إذا كان جاهزًا احجز له موعدًا معي. إذا بارد تابعه بلطف بدون إلحاح. لا تعد بأي شيء عن الأسعار.",
    how:["أرد على الليد الجديد خلال 5 دقائق برسالة تذكر طلبه بالذات","أسأل سؤالين للتأهيل: حجم الفريق والاحتياج","الجاهز أحجز له من تقويمك وأرسل له الرابط","البارد أتابعه 3 مرات بفواصل يومين ثم أتوقف","أي سؤال عن السعر أحوّله لك"],
    v:{ hi:"على طول.", q:"أكمّل على نفس الوتيرة، ولا أركّز على اللي ما ردوا؟", ack:"وصلت. بس عشان أضبطها صح:", ackq:"تبيها قاعدة دائمة، ولا لهذه المرة بس؟",
        why:{ subj:"خالد الدوسري", act:"تابعته مرتين وما رد", log:3, rule:2, extra:"والثالثة مجدولة بكرة 10:00 — ما أراسل بعد 10 مساءً حسب ساعات عملي", retry:"تبيني أعيد المحاولة الحين؟" },
        pause:"طيب، وقفت. ما أراسل أحد لين تقول كمّل — والليدات اللي وصلت أحفظها لك.", resume:"رجعت أشتغل. أبدأ باللي ما ردوا؟" } },
  { id:"noura", n:"نورة", r:"تحصيل الفواتير", ini:"ن", f:true, on:true, wait:0, since:"شغّالة منذ 12 يوم", ver:3,
    kpi:[{v:"9",l:"فواتير متابَعة",t:"+3",ok:true},{v:"41,200",l:"مبالغ حُصّلت (ر.س)",t:"+12%",ok:true},{v:"11",l:"متوسط أيام التأخير",t:"−3 أيام",ok:true},{v:"0",l:"تصعيدات لك",t:"—"}],
    waits:[],
    log:[["14:30","ذكّرت النخبة بفاتورة 4302 — 9 أيام تأخير."],["13:47","وصل سداد 4288. أوقفت التذكير."],["11:05","تذكير أول على 4 فواتير."],["09:00","حدّثت تقرير السيولة."]],
    auto:0, tone:0, hours:"9 ص – 6 م",
    rules:[["ما أهدد بإجراء قانوني أبدًا",true],["أتوقف فور وصول السداد",true],["أرفع لك أي فاتورة تجاوزت 30 يومًا",true],["أتواصل عبر الجوال إضافة للبريد",false]],
    tools:["wafeq","google-sheets","whatsapp"],
    instr:"طالبي بالفواتير اللي تأخرت أكثر من سبعة أيام. ابدئي لطيفة وزيدي الجدية كل أسبوع. أول ما يسدد العميل توقفي فورًا. لا تهددي بأي إجراء قانوني.",
    how:["أراجع الفواتير كل صباح 9:00","بعد 7 أيام: تذكير لطيف بالبريد","بعد 14 يومًا: تذكير أوضح مع رقم الفاتورة والمبلغ","بعد 21 يومًا: طلب مباشر لموعد سداد","بعد 30 يومًا: أرفعها لك وأتوقف"],
    v:{ hi:"بالأرقام:", q:"أرفع لك النخبة الحين، ولا أنتظر قاعدة الـ 30 يوم؟", ack:"وصلني. أبي أتأكد قبل ما أطبّق:", ackq:"يشمل كل الفواتير، ولا عميل بعينه؟",
        why:{ subj:"فاتورة 4302", act:"ذكّرت النخبة مرتين وما ردوا", log:0, rule:2, extra:"وهي عند 9 أيام فقط — فما زالت في جدولي", retry:"تبيني أعيد المحاولة بالجوال؟" },
        pause:"وقفت. ما أرسل أي تذكير لين ترجعني — والمدفوعات اللي توصل أسجلها.", resume:"رجعت. أبدأ بالفواتير اللي تجاوزت 14 يوم؟" } },
  { id:"fahad", n:"فهد", r:"دعم العملاء", ini:"ف", f:false, on:true, wait:2, since:"شغّال منذ 12 يوم", ver:3,
    kpi:[{v:"28",l:"محادثات اليوم",t:"+9%",ok:true},{v:"93%",l:"حُلّت بدون تدخل",t:"+4%",ok:true},{v:"18 ث",l:"زمن الرد",t:"−5 ث",ok:true},{v:"2",l:"تصعيدات",t:"−1",ok:true}],
    waits:[{t:"عميل يطلب تعويضًا عن تأخير شحنة.",s:"اعتذرت. التعويض قرارك.",a:["عوّضه 10%","اعتذر فقط"],
            r:["تم. عوّضت العميل 10% على طلبه الجاي وأبلغته — وسجّلتها في الطلب.","تم. اعتذرت له باسم الشركة بدون تعويض، وأقفلت المحادثة بلطف."]},
           {t:"سؤال ما عندي جوابه.",s:"وعدته بالرد خلال ساعة.",a:["اكتب الجواب","أضفها للمعرفة"],
            r:["تم. رديت على العميل بجوابك خلال الوعد، وأضفته لقاعدة المعرفة عشان ما يرجع لك.","تم. أضفت السؤال لقائمة «ناقص في المعرفة» — يوصلك تذكير تكتب جوابه."]}],
    log:[["14:38","صعّدت لك شكوى شحنة — يطلب تعويضًا."],["13:20","7 أسئلة عن الاسترجاع — حُلّت."],["11:48","4 استفسارات أسعار."],["09:30","«هل فيه تطبيق؟» تكرر 5 مرات — يستاهل جوابًا."]],
    auto:1, tone:1, hours:"24/7",
    rules:[["ما أعد بتعويض أو استرجاع بدون موافقتك",true],["أصعّد أي عميل غاضب فورًا",true],["أجاوب من قاعدة المعرفة فقط",true],["أرد بالإنجليزي إذا كتب العميل بالإنجليزي",true]],
    tools:["whatsapp","gmail","site-chat"],
    instr:"رد على أسئلة العملاء من قاعدة المعرفة فقط. إذا ما تعرف الجواب قل «بنرجع لك» وارفعها لي. أي عميل غاضب أو يطلب تعويضًا صعّده لي فورًا مع ملخص.",
    how:["أرد خلال ثوانٍ من الأسعار والسياسات المرفوعة","ما أخترع جوابًا مو موجود في المعرفة","أرفع لك أي سؤال جديد مع اقتراح إضافته","العميل الغاضب يوصلك خلال دقيقة مع ملخص جاهز","أرد بلغة العميل: عربي أو إنجليزي"],
    v:{ hi:"أبشر.", q:"تبي أرسل لك ملخص الاثنتين اللي تنتظرك؟", ack:"وصلت، وحاضر. بس أتأكد:", ackq:"هذا لكل العملاء، ولا لحالة معيّنة؟",
        why:{ subj:"شكوى الشحنة", act:"صعّدتها لك بدل ما أرد بنفسي", log:0, rule:0, extra:"والعميل عنده اعتذار مني من أول رسالة", retry:"تبيني أعيد المحاولة برد اعتذار بدون تعويض؟" },
        pause:"تمام، وقفت. الرسائل الجديدة تنتظر في الصندوق ولا أرد عليها لين ترجعني.", resume:"رجعت. عندي 3 رسائل انتظرت — أبدأ فيها؟" } },
  { id:"reem", n:"ريم", r:"التسويق", ini:"ر", f:true, on:false, wait:1, since:"متوقفة — تحتاج ربط حساب", ver:3,
    kpi:[{v:"0",l:"منشورات هذا الأسبوع",t:"—"},{v:"0",l:"مجدولة",t:"—"},{v:"—",l:"تفاعل",t:"—"},{v:"3",l:"أفكار تنتظر موافقتك",t:"+3",ok:true}],
    waits:[{t:"أحتاج لينكدإن عشان أبدأ.",s:"التقويم جاهز، بانتظارك.",a:["اربط لينكدإن","شوف التقويم"],
            r:["تم. لينكدإن مربوط — أول منشور يوصلك للمراجعة بكرة 9:00.","هذا التقويم: الأحد قصة عميل، الثلاثاء نصيحة تشغيلية، الخميس رقم من الميدان. أسبوعان جاهزان."]}],
    log:[["أمس","جهّزت تقويم محتوى مبدئيًا لأسبوعين."],["أمس","كتبت 3 مسودات منشورات بصوت العلامة لتراجعها."]],
    auto:2, tone:1, hours:"—",
    rules:[["ما أنشر أي شيء قبل موافقتك",true],["ما أذكر أسعارًا في المنشورات",true],["ما أرد على التعليقات",true],["أنشر يوميًا",false]],
    tools:["linkedin","instagram-business","google-docs"],
    instr:"جهّزي تقويم محتوى شهري عن خدماتنا. اكتبي المنشورات بصوتنا: مباشر وبدون مبالغة. ما تنشرين أي شيء قبل ما أوافق عليه.",
    how:["أبني تقويمًا شهريًا من خدماتكم وأسئلة عملائكم","أكتب المسودات وأرسلها لك للمراجعة","أنشر فقط اللي وافقت عليه، في الوقت المجدول","أعطيك تقريرًا أسبوعيًا: وش اشتغل ووش لا"],
    v:{ hi:"بسرعة:", q:"أرسل لك المسودات الثلاث تراجعها؟", ack:"فكرة. خلّيني أفهمها صح:", ackq:"تبيها في كل المنشورات، ولا في هذا الأسبوع بس؟",
        why:{ subj:"المنشورات", act:"ما نشرت شيء", log:1, rule:0, extra:"والمسودات الثلاث عندك من أمس", retry:"تبيني أعيد إرسالها لك؟" },
        pause:"وقفت. التقويم محفوظ ما يروح.", resume:"رجعت — بس أحتاج لينكدإن مربوط عشان أنشر فعليًا." } }
];

/* أسماء الأدوات بالعربي حسب المعرّف — شات الموقع أداة مدمجة (بدون كتالوج) */
var TN={ "whatsapp":"واتساب", "hubspot":"HubSpot", "google-calendar":"التقويم", "wafeq":"قيود/Wafeq", "google-sheets":"Google Sheets", "http":"اتصال ويب",
         "gmail":"Gmail", "linkedin":"لينكدإن", "instagram-business":"إنستغرام", "google-docs":"Google Docs", "site-chat":"شات الموقع" };

/* ==========================================================================
   الذاكرة الحيّة — كل سطر له مصدر: من وين تعلّمته سيادة
   القواعد الجديدة من محادثات التعديل تنضاف هنا، والحذف من الإعدادات › الذاكرة
   ========================================================================== */
var MEM=[{k:"العمولة",v:"12%",src:"من محادثة 3 سبتمبر"},
         {k:"وقت التواصل",v:"ما نراسل العملاء بعد 8 مساءً",src:"قاعدة منك"},
         {k:"صوت العلامة",v:"مباشر وبدون مبالغة",src:"من الإعداد الأول"},
         {k:"لغة الرد",v:"بلغة العميل: عربي أو إنجليزي",src:"قاعدة لفهد"}];

var CHATS = {
  "c1": { with:"siyadah", t:"بناء فريق المتابعة والتحصيل", when:"today", msgs:[
    { me:true,  t:"أبي أحد يتابع كل عميل جديد خلال خمس دقائق، ويطالب بالفواتير اللي تأخرت أكثر من سبعة أيام، ويرد على أسئلة الدعم المتكررة على طول.", at:"14:28" },
    { me:false, plan:true, t:"جهّزت ثلاثة. هذي خطتهم — ما يتحرك شيء قبل موافقتك:", at:"14:29", why:"قسمت طلبك لثلاث مهام مستقلة (متابعة، تحصيل، دعم) لأن لكل واحدة أدوات وقواعد مختلفة." },
    { me:true,  t:"ممتاز، بس خلّ سعد ما يعطي خصومات بدون ما يرجع لي.", at:"14:31" },
    { me:false, t:"<p>صار. خط أحمر لسعد: <b>«ما أعطي خصمًا بدون موافقتك»</b>. أي طلب خصم يوصلك أنت.</p><p>الثلاثة جاهزون. أشغّلهم؟</p>", at:"14:31", why:"الخصومات تمس السعر — وقاعدتك: «لا تعد بأي شيء عن الأسعار»." }
  ]},
  "c2": { with:"siyadah", t:"وش سوّى الفريق اليوم؟", when:"today", msgs:[
    { me:true, t:"وش سوّى الفريق اليوم؟", at:"09:02" },
    { me:false, t:"<p><b>37 إجراء</b> حتى الحين.</p><p>سعد: 14 ليدًا، 5 مواعيد. نورة: 9 فواتير، ووصل 18,500. فهد: 28 رسالة، صعّد لك اثنتين.</p><p>ينتظرك شيء واحد: عميل يطلب تعويضًا. تشوفه؟</p>", at:"09:02", why:"الأرقام من سجل الموظفين الثلاثة اليوم — ما فيه تقدير." }
  ]},
  "c3": { with:"siyadah", t:"وضع شركة النخبة", when:"yesterday", msgs:[
    { me:true, t:"وش وضع شركة النخبة؟ لهم فاتورة قديمة.", at:"14:40" },
    { me:false, t:"<p>نورة تابعتها: فاتورة <b>4302</b> بقيمة 18,500 — متأخرة 9 أيام. أرسلت تذكيرين ولم يردوا.</p><p>إذا ما سددوا خلال 5 أيام ترتفع لك تلقائيًا حسب قاعدة الـ 30 يومًا. تبي نورة تتصل بهم بدل البريد؟</p>", at:"14:41", why:"قاعدة نورة: «أرفع لك أي فاتورة تجاوزت 30 يومًا»." }
  ]},
  "c4": { with:"siyadah", t:"أكثر سؤال يتكرر على الدعم", when:"yesterday", msgs:[
    { me:true, t:"وش أكثر سؤال يجي فهد؟", at:"13:30" },
    { me:false, t:"<p>هذا الأسبوع: <b>«هل فيه تطبيق جوال؟»</b> — تكرر 5 مرات وما عنده جواب له في قاعدة المعرفة.</p><p>لو تعطيني الجواب بسطر واحد أضيفه لفهد ويرد عليه مباشرة من الحين.</p>", at:"13:30", why:"فهد يجاوب من قاعدة المعرفة فقط — السؤال اللي ما له جواب يرتفع لك." }
  ]},
  "c5": { with:"siyadah", t:"ربط واتساب بزنس", when:"week", msgs:[
    { me:true, t:"اربط واتساب بزنس", at:"11:10" },
    { me:false, t:"<p>تم. رقمكم مربوط وسعد وفهد يقدرون يرسلون ويستقبلون منه.</p>", at:"11:12", why:"سعد وفهد هم اللي أدواتهم تشمل واتساب — نورة تستخدم البريد." }
  ]},
  "c6": { with:"siyadah", t:"ليش سعد ما تابع خالد؟", when:"week", msgs:[
    { me:true, t:"ليش سعد ما تابع خالد الدوسري؟", at:"16:20" },
    { me:false, t:"<p>تابعه مرتين وما رد. حسب قاعدتك يتابع 3 مرات كحد أقصى، والثالثة مجدولة بكرة 10:00.</p>", at:"16:20", why:"قاعدة سعد: «أتابع الليد 3 مرات كحد أقصى»." }
  ]}
};

var SUGG = {
  siyadah: [
    ["build","ابنِ", "أبي أحد يتابع الليدات ويطارد الفواتير"],
    ["ask","اسأل", "وش صار اليوم؟"],
    ["edit","عدّل", "خلّ الردود أكثر رسمية"],
    ["link","اربط", "اربط واتساب"]
  ]
};

/* ==========================================================================
   العرض
   ========================================================================== */
var I = {
  shield: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/></svg>',
  pen:    '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/></svg>',
  copy:   '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 011-1h10"/></svg>',
  why:    '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"/></svg>',
  check:  '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  x:      '<svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  code:   '<svg class="ic" viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  build:  '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6"/></svg>',
  ask:    '<svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4V5z"/></svg>',
  edit:   '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z"/></svg>',
  link:   '<svg class="ic" viewBox="0 0 24 24"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>'
};

(function(){
  "use strict";

  /* CSP-safe: استبدال الشعار بحرفين عند فشل التحميل */
  document.addEventListener("error",function(e){ var img=e.target; if(!(img&&img.tagName==="IMG"&&img.dataset.fb)) return;
    var host=img.closest(".card,.tl,.chip"), n=host ? ((host.querySelector(".card__n,.tl__n,.chip__n")||{}).textContent||"") : "";
    var ini=n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•"; img.replaceWith(document.createTextNode(ini)); },true);
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  /* Interface language is independent of company knowledge and conversation language. */
  var locale=(function(){try{return (sessionStorage.getItem("siyadah_locale")||localStorage.getItem("siyadah_locale"))==="en"?"en":"ar";}catch(e){return "ar";}})();
  var nativeLabels=new WeakMap();
  function ui(ar,en){return locale==="en"?en:ar;}
  function loadErrorCopy(){return ui("تعذّر تحميل بيانات حسابك. أعد تحميل الصفحة للمحاولة.","Could not load your account. Reload the page to try again.");}
  function applyLocale(){
    document.documentElement.lang=locale;
    document.documentElement.dir=locale==="en"?"ltr":"rtl";
    $$('[data-en]').forEach(function(node){
      if(!nativeLabels.has(node))nativeLabels.set(node,node.textContent);
      node.textContent=locale==="en"?node.dataset.en:nativeLabels.get(node);
    });
    [["data-en-placeholder","placeholder"],["data-en-aria-label","aria-label"],["data-en-value","value"],["data-en-title","title"]].forEach(function(pair){
      $$('['+pair[0]+']').forEach(function(node){
        var key='siyAr'+pair[1].replace(/[^a-z]/g,'');
        if(!(key in node.dataset))node.dataset[key]=pair[1]==="value"?node.value:(node.getAttribute(pair[1])||"");
        var value=locale==="en"?node.getAttribute(pair[0]):node.dataset[key];
        if(pair[1]==="value")node.value=value;else node.setAttribute(pair[1],value);
      });
    });
    var toggle=$("#localeToggle");if(toggle)toggle.setAttribute("aria-label",ui("التحويل إلى الإنجليزية","Switch to Arabic"));
  }
  function changeLocale(){
    var knowledgeOpen=$("#memList")&&!$("#memList").hidden;
    var knowledgeDraft=knowledgeOpen&&$("#kbEdit")&&!$("#kbEdit").hidden?{topic:$("#kbTopic").value,value:$("#kbValue").value,key:$("#kbEdit").dataset.key,status:$("#kbStatus").textContent}:null;
    locale=locale==="ar"?"en":"ar";
    try{sessionStorage.setItem("siyadah_locale",locale);}catch(e){}
    if(window.__SIY_LOAD_ERROR__&&live.siyadah&&live.siyadah[0]&&live.siyadah[0].uiLoadError)live.siyadah[0].t="<p>"+esc(loadErrorCopy())+"</p>";
    applyLocale();renderSide();renderBar();renderThread();renderPlan();toolsCount();refreshLiveLabels();siyRefreshBuilderConnection();
    if(knowledgeOpen){renderMem();if(knowledgeDraft){var form=$("#kbEdit");form.hidden=false;form.dataset.key=knowledgeDraft.key;$("#kbTopic").value=knowledgeDraft.topic;$("#kbValue").value=knowledgeDraft.value;$("#kbStatus").textContent=knowledgeDraft.status;}}
    if($("#pal")&&!$("#pal").hidden)renderPal();
    if($("#modal").classList.contains("on")&&picked){
      if(rc&&$("#mOk")){ $("#mOk").textContent=rc.methods[rc.index].type==="OAUTH2"?ui('سجّل الدخول عبر ','Sign in with ')+rc.tool.n:ui('احفظ الاتصال','Save connection');var selector=$("#mf0");if(selector&&selector.tagName==='SELECT'&&selector.options[0])selector.options[0].textContent=ui('اختر…','Select…'); }
      else if(picked.connection){var c=picked.connection;$("#mD").textContent=(c.status==='ERROR'?ui('الاتصال فيه خطأ','Connection needs attention'):ui('الاتصال محفوظ؛ اختبر مهمة فعلية للتأكد من النتيجة','Connection saved. Run a real task to verify the outcome'))+ui(' · يستخدمها: ',' · Used by: ')+usersOf(picked.s);var check=$("[data-revalidate]",$("#mF")),disconnect=$("[data-disconnect]",$("#mF")),reconnect=$("[data-reconnect]",$("#mF"));if(check)check.textContent=ui('اختبر الاتصال','Check connection');if(disconnect)disconnect.textContent=ui('افصل','Disconnect');if(reconnect)reconnect.textContent=ui('أعد ربط Google','Reconnect Google');}
    }
  }
  document.addEventListener("click",function(event){if(event.target.closest("#localeToggle"))changeLocale();});
  applyLocale();
  var who="siyadah", chatId=null, live={}, eth={}, pendAns=null;
  var PRES={}, pendEdit=null; /* PRES: مين يشتغل الآن · pendEdit: معاينة قيد التعديل في المحرر */
  var PULSE={}, kpiOpen=null, proFired=false; /* PULSE: نبضة شارة المبادرة · kpiOpen: مين أرقامه مفتوحة · proFired: نورة بادرت */
  var AUTON=["ينفّذ ويبلغك","يستأذنك أولًا","يقترح فقط"], TONE=["رسمي","ودّي"];
  var reduced=function(){ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; };

  function emp(id){ return EMPS.filter(function(e){return e.id===id})[0]; }
  function isEmp(){ return who!=="siyadah"&&who!=="tools"; }
  /* قائمة الرسائل المعروضة حاليًا — يقارنها المحاكي قبل ما يعيد الرسم */
  function curList(){ if(who==="tools") return null; if(isEmp()) return empThread(who); return chatId?CHATS[chatId].msgs:(live.siyadah||null); }
  function avHtml(id){ return (id==="siyadah"||!emp(id)) ? '<span class="drop"></span>' : esc(emp(id).ini); }
  function name(id){ return (id==="siyadah"||!emp(id)) ? ui("سيادة","Siyadah") : emp(id).n; }
  function fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
  function now(){ return siyClock(new Date()); }
  function siyClock(date){ return date.toLocaleTimeString("en-GB",{timeZone:"Asia/Riyadh",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}); }
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function customerText(value){
    return String(value||"")
      .replace(/@[a-z0-9-]+\/(?:piece-)?[A-Za-z0-9_-]+/gi,"أداة العمل")
      .replace(/active.?pieces/gi,"مساحة العمل")
      .replace(/\bMCP\b/gi,"")
      .replace(/\bFlow\b/gi,"طريقة العمل")
      .replace(/فلو/g,"طريقة العمل")
      .replace(/مسودة معطلة/g,"موظف قيد التجهيز")
      .replace(/Verified disabled draft; execution and commercial result remain unproved\.?/gi,"تم تجهيز طريقة العمل؛ التشغيل والنتيجة التجارية لم يثبتا بعد.")
      .replace(/Execution is not proved\.?/gi,"التشغيل لم يثبت بعد.")
      .replace(/\s{2,}/g," ").trim();
  }
  function acceptanceLabel(row){
    var labels=locale==='en'?{draft_readback:'Work plan saved',flow_valid:'Work plan valid',connection_ready:'Tool ready',execution_run:'Real run completed',provider_result:'Provider result received',commercial_result:'Business outcome verified'}:{draft_readback:"تم تجهيز طريقة العمل",flow_valid:"طريقة العمل سليمة",connection_ready:"الأداة جاهزة",execution_run:"اكتمل اختبار فعلي",provider_result:"وصلت نتيجة الخدمة",commercial_result:"ظهرت نتيجة أعمال مثبتة"};
    return labels[row&&row.key]||customerText(row&& (row.label||row.key));
  }
  function siyRefsHtml(items,note){
    var refs=(items||[]).filter(function(x){return x&&typeof x[1]==="string"&&/^[A-Za-z0-9_-]+$/.test(x[1]);});
    if(!window.__SIY_REAL__||!refs.length) return "";
    var refNames=locale==='en'?{'الطلب':'Request','المهمة':'Task','التشغيل':'Run','النتيجة':'Result','طريقة العمل':'Work plan','الموظف':'Employee','النسخة المنشورة':'Published version','اختبار التهيئة':'Test run'}:{};
    return '<details class="siyrefs"><summary>'+ui('الدليل التقني','Technical evidence')+'</summary>'+(note?'<p>'+esc(note)+'</p>':'')+'<div class="siyrefs__list">'+refs.map(function(x){return '<span>'+esc(refNames[x[0]]||customerText(x[0]))+' <code>'+esc(x[1])+'</code></span>';}).join("")+'</div></details>';
  }
  /* عنوان المحادثة: قصّ عند حدود الكلمة */
  function title(t){ if(t.length<=32) return t; var c=t.slice(0,32), i=c.lastIndexOf(" "); return (i>12?c.slice(0,i):c).replace(/[،,.؟?!:]+$/,"")+"…"; }

  /* --- الجانب --- */
  function renderSide(){
    /* حالة الصف: يشتغل الآن → نقطة نابضة · فيه شارة → الشارة فقط · شغّال → نقطة · متوقف → لا شيء والاسم باهت */
    $("#emps").innerHTML = EMPS.map(function(e){
      var st = PRES[e.id] ? '<span class="dot dot--live" title="'+ui('يشتغل الآن','Working now')+'"></span>' : (e.wait ? '' : (e.on ? '<span class="dot"></span>' : ''));
      return '<button type="button" class="emp'+(e.on?'':' emp--dim')+'" data-emp="'+esc(e.id)+'" aria-current="'+(who===e.id)+'"><span class="av">'+esc(e.ini)+'</span>'+
        '<span class="emp__n">'+esc(e.n)+'<small>'+esc(e.r)+'</small></span>'+
        '<span style="display:flex;align-items:center;gap:6px">'+(e.wait?'<span class="badge'+(PULSE[e.id]?' badge--new':'')+'">'+e.wait+'</span>':'')+st+'</span></button>';
    }).join("");
    var g={today:"",yesterday:"",week:""};
    Object.keys(CHATS).forEach(function(id){ var c=CHATS[id];
      g[c.when]+='<button type="button" class="hist" data-chat="'+esc(id)+'" aria-current="'+(chatId===id)+'">'+esc(c.t)+'</button>';
    });
    $("#histToday").innerHTML=g.today; $("#histYest").innerHTML=g.yesterday; $("#histWeek").innerHTML=g.week;
    filterHist();
  }
  /* بحث السجل: يخفي المحادثات اللي ما تطابق، ويخفي عنوان المجموعة الفاضية */
  function filterHist(){
    var q=($("#hq").value||"").trim().toLowerCase(), any=false;
    $$(".hist[data-chat]").forEach(function(b){ var hit=!q||b.textContent.toLowerCase().indexOf(q)>-1; b.hidden=!hit; if(hit) any=true; });
    [["#hgToday","#histToday"],["#hgYest","#histYest"],["#hgWeek","#histWeek"]].forEach(function(p){ $(p[0]).hidden=!$$(".hist:not([hidden])",$(p[1])).length; });
    $("#hqNone").hidden=any||!q||palOpen;
  }

  /* --- الشريط العلوي + المحرر --- */
  function renderBar(){
    $("#whoAv").innerHTML = who==="tools" ? '<svg class="ic" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4"/></svg>' : avHtml(who);
    $("#whoN").textContent = who==="tools" ? ui("الأدوات","Tools") : (isEmp() ? name(who)+" · "+emp(who).r : name("siyadah"));
    $(".comp").style.display = who==="tools" ? "none" : "";
    $("#input").placeholder = isEmp() ? ui("اكتب ل","Message ")+name(who)+"…" : ui("اكتب لسيادة…","Message Siyadah…");
    var lv=$("#whoLive"); if(lv){lv.hidden=!(isEmp()&&PRES[who]);lv.textContent=ui('يشتغل الآن…','Working now…');}
  }

  /* --- الرسائل --- */
  function planHtml(m){
    var ok=!!m.approved;
    return '<div class="plan nr"><div class="plan__h"><span class="drop"></span>الخطة</div>'+
      '<div class="prow"><b>سعد · متابعة المبيعات</b><span>يرد على كل ليد خلال 5 دقائق، يؤهّله، ويحجز موعدًا للجاهزين. واتساب، البريد، التقويم.</span></div>'+
      '<div class="prow"><b>نورة · تحصيل الفواتير</b><span>تذكّر بعد 7 أيام، تصعّد النبرة أسبوعيًا، وتتوقف فور السداد. الفوترة، الجداول.</span></div>'+
      '<div class="prow"><b>فهد · دعم العملاء</b><span>يجاوب من أسعارك وسياساتك ويصعّد الحساس مع ملخص. واتساب، شات الموقع.</span></div></div>'+
      '<div class="approve nr"><button type="button" class="bt" data-approve="1"'+(ok?' disabled':'')+'>'+(ok?I.check+'شغّالين':'وافق وشغّل <span class="drop"></span>')+'</button>'+
      '<button type="button" class="bt bt--line" data-editplan="1"'+(ok?' disabled':'')+'>عدّل الخطة</button><small>'+(ok?'بدأوا الساعة '+m.approvedAt:'توقفه متى تبي.')+'</small></div>';
  }
  function waitHtml(m){
    var w=m.wait;
    if(m.done) return '<p>'+w.t+'</p><div class="done">'+I.check+'<span>'+m.done.a+'</span><small>'+m.done.at+'</small></div>';
    return '<p>'+w.t+'<small>'+w.s+'</small></p><div class="wait__a">'+w.a.map(function(a,j){
      return '<button type="button" class="bts'+(j?' bts--line':'')+'" data-decide="'+j+'">'+(j?I.x:I.check)+a+'</button>'; }).join("")+'</div>';
  }
  function diffHtml(m){
    var d=m.diff;
    return '<div class="diff nr"><div class="diff__r diff__r--add"><b>يضاف</b><span>'+esc(d.add)+'</span></div>'+
      '<div class="diff__r diff__r--del"><b>يُحذف</b><span>'+(d.del?esc(d.del):'لا شيء')+'</span></div>'+
      '<div class="diff__f">'+(m.saved?I.check+'<span>حُفظت · النسخة '+m.saved+'</span>':'<button type="button" class="bts" data-save="1">حفظ</button><span>تسري من الرسالة الجاية</span>')+'</div></div>';
  }
  function whyOf(m,w){
    if(m.why) return m.why;
    if(w==="siyadah"||!emp(w)) return "بنيته على تعليماتك وقواعد الفريق — ولا يتحرك شيء قبل موافقتك.";
    var e=emp(w), r=e.rules.filter(function(x){return x[1]})[0];
    return "حسب تعليماتك"+(r?" وقاعدتي: «"+r[0]+"»":"")+" — كل حركة أسويها راجعة لسطر كتبته أنت.";
  }
  function msgHtml(m, w, i){
    if(m.me) return '<div class="m m--me" data-mi="'+i+'"><div class="m__b" dir="auto">'+esc(m.t)+'<span class="m__t">'+m.at+'</span></div></div>';
    if(m.typing){
      var scan=m.toolScan&&Array.isArray(m.toolScan.items)?m.toolScan.items:[];
      return '<div class="m m--ai" data-mi="'+i+'"><span class="m__av">'+avHtml(w)+'</span><div class="m__b"><div class="think" role="status" aria-live="polite"><span class="typing" aria-label="'+ui('يعمل…','Processing…')+'"><i></i><i></i><i></i></span><b>'+esc(window.__SIY_REAL__?ui('الطلب قيد المعالجة…','Processing your request…'):(m.progress||ui('أفهم طلبك…','Understanding your request…')))+'</b>'+
        (!window.__SIY_REAL__&&scan.length?'<div class="toolscan" aria-label="'+ui('فحص الأدوات','Checking tools')+'">'+scan.map(function(t){return '<span><img src="'+esc(t.logo)+'" alt=""><small>'+esc(t.n)+'</small></span>';}).join('')+'</div><small class="scanmeta">'+ui('راجعت ','Checked ')+'<span class="num">'+(m.toolScan.count||scan.length)+'</span> '+ui('أداة من كتالوج سيادة','tools from Siyadah’s catalog')+'</small>':'')+
        '</div></div></div>';
    }
    if(m.trace) return '<div class="m m--ai" data-mi="'+i+'"><span class="m__av">'+avHtml(w)+'</span><div class="m__b"><div class="tr">'+
      m.trace.map(function(r,ri){return trHtml(r,ri)}).join("")+'</div><span class="m__t">'+esc(name(w))+' · '+m.at+'</span></div></div>';
    var body = m.wait ? waitHtml(m) : ((m.t||"").indexOf("<p>")===0? m.t : '<p>'+m.t+'</p>') + (m.plan? planHtml(m):'') + (m.diff? diffHtml(m):'');
    return '<div class="m m--ai'+(m.reveal?' m--rev':'')+'" data-mi="'+i+'"><span class="m__av">'+avHtml(w)+'</span><div class="m__b"><div class="m__c" dir="auto">'+body+'</div>'+
      '<span class="m__t">'+esc(name(w))+' · '+m.at+'</span>'+
      siyRequestStateHtml(m.requestState,m.partialActionResult)+
      '<div class="act"><button type="button" data-copy="1">'+I.copy+ui('نسخ','Copy')+'</button>'+(!window.__SIY_REAL__||m.why?'<button type="button" data-why="1" aria-expanded="false">'+I.why+ui('ليش؟','Why?')+'</button>':'')+'</div>'+
      (!window.__SIY_REAL__||m.why?'<p class="whyl" hidden>'+esc(whyOf(m,w))+'</p>':'')+'</div></div>';
  }
  /* ---------- افتتاحية «اليوم» — ثلاثة أسطر من البيانات + رقاقتا اقتراح ---------- */
  function cw(n){ return {1:"واحد",2:"اثنان",3:"ثلاثة",4:"أربعة",5:"خمسة"}[n]||('<span class="num">'+n+'</span>'); }
  function openerHtml(){
    if(window.__SIY_REAL__) return '<div class="m m--ai"><div class="m__b"><div class="m__c" dir="auto"><p>'+esc(window.__SIY_LOAD_ERROR__||ui("وش هدفك اليوم؟ اكتب طلبك هنا، أو اختر موظفًا من فريقك.","What would you like to achieve today? Write your request here, or choose someone from your team."))+'</p></div></div></div>';
    var h=new Date().getHours(), greet=(h>=5&&h<12)?"صباح الخير.":"مساء الخير.";
    var n=EMPS.reduce(function(a,e){return a+e.log.length;},0)+ACTIONS.length;
    var X=EMPS.reduce(function(a,e){return a+e.wait;},0);
    var parts=EMPS.filter(function(e){return e.wait>0;}).sort(function(a,b){return b.wait-a.wait;})
                  .map(function(e){return cw(e.wait)+" عند "+e.n;}).join(" و");
    var wline=!X ? "وما فيه شيء ينتظرك."
      : X===1 ? "وينتظرك قرار "+parts+"."
      : X===2 ? "وينتظرك قراران: "+parts+"."
      : "وينتظرك <span class=\"num\">"+X+"</span> قرارات: "+parts+".";
    var fe=EMPS.filter(function(e){return e.waits.length;})[0];
    var l3=fe ? "أقربها لك: "+fe.waits[0].t.replace(/\.$/,"")+" — عند "+fe.n+". تبدأ فيها؟" : "تبي ملخص أمس؟";
    return '<div class="m m--ai"><span class="m__av"><span class="drop"></span></span><div class="m__b"><div class="m__c">'+
      '<p>'+greet+'</p>'+
      '<p>فريقك سوّى <span class="num">'+n+'</span> إجراء من أمس لليوم، '+wline+'</p>'+
      '<p>'+l3+'</p></div>'+
      '<span class="m__t">سيادة · '+now()+'</span></div></div>'+
      '<div class="opchips"><button type="button" class="opch" data-op="waits">شوف اللي ينتظرني</button>'+
      '<button type="button" class="opch" data-op="yest">وش صار أمس؟</button></div>';
  }
  function yestText(){
    var tot=EMPS.reduce(function(a,e){return a+e.log.length;},0);
    return 'باختصار — <span class="num">'+tot+'</span> حركة مسجّلة من أمس لليوم، وآخر سطر من كل واحد:<br>'+
      EMPS.map(function(e){return '<b>'+esc(e.n)+':</b> '+e.log[0][1];}).join('<br>');
  }
  function renderThread(){
    var t=$("#thread"), scroll=t.scrollTop, nearEnd=t.scrollHeight-t.clientHeight-scroll<80; t.classList.toggle("thread--emp",isEmp());
    if(who==="tools"){ t.innerHTML=toolsHtml(); bindTools(); return; }
    var savedPanel=window.__SIY_REAL__&&t.siyEmployee===who&&t.siyEmployeeGeneration===siyGeneration?$("#instrWrap"):null, savedFocus=savedPanel&&savedPanel.contains(document.activeElement)?document.activeElement:null, savedSelection=savedFocus&&savedFocus.id==='instr'?[savedFocus.selectionStart,savedFocus.selectionEnd,savedFocus.selectionDirection]:null;
    var list, w;
    if(isEmp()){ var e=emp(who); list=empThread(who); w=who;
      t.innerHTML='<div class="col'+(window.__SIY_REAL__&&e.draft&&!list.length?' col--draft':'')+'">'+pinHtml(e)+'<div id="instrWrap" hidden>'+instrHtml(e)+'</div>'+list.map(function(m,i){return msgHtml(m,who,i)}).join("")+(window.__SIY_REAL__&&e.draft&&!list.length?'<div class="emp-start"><span class="drop" aria-hidden="true"></span><button type="button" id="reviewStart" aria-expanded="false" aria-controls="instrWrap">'+ui('راجع التعليمات','Review instructions')+'</button></div>':'')+siyEmployeeProofHtml(e,list)+'</div>';
    } else {
      list = chatId ? CHATS[chatId].msgs : (live.siyadah||[]); w = chatId? CHATS[chatId].with : who;
      if(!list.length){ /* افتتاحية «اليوم»: سيادة تبدأ الكلام — كل أرقامها محسوبة من البيانات لحظتها */
        t.innerHTML='<div class="col">'+openerHtml()+'</div>';
        return;
      }
      t.innerHTML='<div class="col">'+list.map(function(m,i){return msgHtml(m, w, i)}).join("")+'</div>';
    }
    if(savedPanel&&isEmp()){var freshPanel=$("#instrWrap"),freshApply=freshPanel.querySelector('#instrApply'),savedApply=savedPanel.querySelector('#instrApply');if(freshApply&&!savedApply)savedPanel.querySelector('#instrF').appendChild(freshApply);else if(!freshApply&&savedApply)savedApply.remove();freshPanel.replaceWith(savedPanel);var toggle=$("#instrTgl")||$("#reviewStart");if(toggle)toggle.setAttribute('aria-expanded',String(!savedPanel.hidden));if(savedFocus){savedFocus.focus({preventScroll:true});if(savedSelection)savedFocus.setSelectionRange(savedSelection[0],savedSelection[1],savedSelection[2]);}}
    t.siyEmployee=isEmp()?who:null;t.siyEmployeeGeneration=siyGeneration;
    var follow=t.siyList!==list||nearEnd||(list.length>t.siyCount&&list[list.length-1].me);
    t.siyList=list; t.siyCount=list.length; t.scrollTop=follow?t.scrollHeight:scroll;
    list.forEach(function(m,i){ if(m.reveal){ m.reveal=false; reveal($('.m[data-mi="'+i+'"]')); } });
  }
  /* كشف الرد كلمة كلمة (~25ms) — يتخطى الحركة لمن يفضّل تقليلها */
  function reveal(el){
    if(!el) return;
    if(reduced()){ el.classList.remove("m--rev"); return; }
    var c=$(".m__c",el), words=[], tw=document.createTreeWalker(c,NodeFilter.SHOW_TEXT,null), nodes=[], n;
    while((n=tw.nextNode())) if(n.nodeValue.trim()&&!n.parentNode.closest(".nr")) nodes.push(n);
    nodes.forEach(function(tn){ var frag=document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(function(p){ if(!p) return; if(/^\s+$/.test(p)) frag.appendChild(document.createTextNode(p)); else { var s=document.createElement("span"); s.className="w"; s.textContent=p; frag.appendChild(s); words.push(s); } });
      tn.parentNode.replaceChild(frag,tn); });
    /* حسب الوقت المنقضي (~25ms للكلمة) — يلحق لو تباطأ المؤقت في تبويب مخفي */
    var k=0, start=Date.now(), th=$("#thread"), tm=setInterval(function(){
      var to=Math.min(words.length, Math.floor((Date.now()-start)/25));
      while(k<to){ words[k++].classList.add("on"); }
      th.scrollTop=th.scrollHeight;
      if(k>=words.length){ clearInterval(tm); $$(".nr",el).forEach(function(x){ x.classList.add("on"); }); el.classList.remove("m--rev"); }
    },25);
  }

  /* ---------- صفحة الموظف = محادثة معه ---------- */
  /* أول رسائل المحادثة: سجل اليوم (الأقدم أولًا) ثم اللي ينتظر قرارك */
  function empThread(id){
    if(window.__SIY_REAL__&&chatId&&CHATS[chatId]&&CHATS[chatId].emp===id) return CHATS[chatId].msgs;
    if(!eth[id]){ var e=emp(id), m=[];
      e.log.slice().reverse().forEach(function(l){ m.push({me:false,t:esc(l[1]),at:esc(l[0])}); });
      e.waits.forEach(function(w){ m.push({me:false,wait:w,at:"ينتظر قرارك"}); });
      eth[id]=m; }
    return eth[id];
  }
  function toolOf(s){ if(s==="site-chat") return {s:s,n:TN[s],on:!window.__SIY_REAL__,builtin:true}; return TOOLS.filter(function(t){return t.s===s})[0]||{s:s,n:TN[s]||s,on:false}; }
  function chipHtml(s){
    var t=toolOf(s), n=TN[s]||t.n;
    return '<span class="chip'+(t.on?'':' chip--off')+'">'+(t.builtin?'<svg class="gi" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.5-.7L3 21l1.3-4.5A8.4 8.4 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>':'<img src="'+t.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1">')+
      '<span class="chip__n">'+esc(n)+'</span>'+(t.on?'<i></i>':'<button type="button" class="link" data-c="'+esc(s)+'" aria-label="'+ui('اربط ','Connect ')+esc(n)+'">'+ui('اربط','Connect')+'</button>')+'</span>';
  }
  function pinHtml(e){
    var f=e.f;
    var metrics=window.__SIY_REAL__?'':
      '<div class="kline"><span>اليوم: '+e.kpi.map(function(k){ return k.l.replace(/اليوم/,"").trim()+' <b class="num">'+k.v+'</b>'; }).join(' · ')+'</span>'+
      '<button type="button" class="link" id="kpiTgl" aria-expanded="'+(kpiOpen===e.id)+'" aria-controls="kpiWrap">التفاصيل</button></div>'+
      '<div class="kpis" id="kpiWrap"'+(kpiOpen===e.id?'':' hidden')+'>'+e.kpi.map(function(k){ return '<div class="kpi"><span class="kpi__v num">'+k.v+'</span><span class="kpi__l">'+k.l+'<span class="kpi__t'+(k.ok?' kpi__t--ok':'')+'" title="عن الأسبوع الماضي">'+k.t+'</span></span></div>'; }).join("")+'</div>';
    return '<div class="pin"><div class="pin__r1"><span class="av">'+esc(e.ini)+'</span><div class="pin__t"><p class="pin__n">'+esc(e.n)+' <span>· '+esc(e.r)+'</span> <button type="button" class="pinbtn tip" id="renameBtn" data-tip="'+(window.__SIY_REAL__?ui('قريبًا','Coming soon'):ui('إعادة تسمية','Rename'))+'" aria-label="'+ui('إعادة تسمية ','Rename ')+esc(e.n)+'"'+(window.__SIY_REAL__?' disabled':'')+'><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1L18 7l-3-3L5 15l-1 5z"/><path d="M13 6l3 3"/></svg></button></p><div class="pin__s">'+esc(window.__SIY_REAL__&&siyActivationResumeNotice&&siyActivationResumeNotice.employeeId===e.id?siyActivationResumeNotice.message:locale==='en'&&window.__SIY_REAL__?(e.draft?'Saved draft · Tools not connected':e.on?'Recorded as active · Execution unverified':'Recorded as paused'):e.since)+'</div>'+(e.draft?'':siyRefsHtml([['الموظف',e.id],['طريقة العمل',e.flowId]]))+'</div>'+
      '<div class="pin__c">'+(e.wait?'<span class="pill">ينتظر قرارك '+e.wait+'</span>':'')+
      '<span class="swl" style="font-size:.8rem;color:var(--ash)"><span id="onLbl">'+(window.__SIY_REAL__?((siyEmployeeStatePending[e.id]||(siyActivationResumeNotice?.busy&&siyActivationResumeNotice.employeeId===e.id))?ui('جارٍ التحقق من تغيير الحالة…','Verifying status…'):(e.draft?ui('بانتظار الربط','Needs connection'):e.on?ui('نشط في السجل','Recorded as active'):ui('متوقف في السجل','Recorded as paused'))):(e.on?(f?ui('شغّالة','Active'):ui('شغّال','Active')):(f?ui('متوقفة','Paused'):ui('متوقف','Paused'))))+'</span><button type="button" class="sw" id="onSw" role="switch"'+((siyEmployeeStatePending[e.id]||(siyActivationResumeNotice?.busy&&siyActivationResumeNotice.employeeId===e.id))?' disabled aria-busy="true"':e.draft?' disabled title="'+ui('اربط الأدوات واختبرها قبل التشغيل','Connect and test tools before activation')+'"':'')+' aria-checked="'+e.on+'" aria-label="'+(e.draft?ui('التشغيل متاح بعد ربط الأدوات واختبارها','Activation available after connecting and testing tools'):ui('تشغيل ','Activate ')+esc(e.n))+'"></button></span></div></div>'+
      metrics+
      (e.draft?'<div class="pin__r3"><button type="button" class="link" id="draftTools">'+ui('الأدوات والربط','Tools & connections')+'</button></div>':'<div class="pin__r3"><span class="pin__k">'+ui(f?'أدواتها':'أدواته','Tools')+'</span>'+e.tools.map(chipHtml).join("")+
      '<span class="mchip tip" data-tip="'+ui('ساعات العمل','Working hours')+(e.hours&&e.hours!=="—"?": "+esc(e.hours):"")+'"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4l3 2"/></svg>'+(e.hours&&e.hours!=="—"?'<span>'+esc(e.hours)+'</span>':'')+'</span>'+
      '<span class="mchip tip" data-tip="'+(window.__SIY_REAL__?ui('الصلاحيات المسجلة؛ تطبيقها أثناء التشغيل غير مؤكد','Permissions are recorded; runtime enforcement is unverified'):ui((f?'تستأذنك':'يستأذنك')+' في القرارات الحساسة','Asks before sensitive decisions'))+'"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg></span>'+
      '<button type="button" class="link" id="instrTgl" aria-expanded="false" aria-controls="instrWrap">'+ui('التعليمات','Instructions')+'</button></div>')+'</div>';
  }
  function toolNames(e){ return e.tools.map(function(s){return TN[s]||s}).join("، "); }
  function promptOf(e){
    var lines=[
      "<span class='k'># الهوية</span>",
      "أنت "+e.n+"، "+e.r+" في شركة الأفق (حلول توصيل للمطاعم في الرياض وجدة).",
      "تتحدث بصوت الشركة. النبرة: "+TONE[e.tone]+". اللغة: عربي، أو إنجليزي إذا كتب العميل بالإنجليزي.",
      "",
      "<span class='k'># تعليمات صاحب العمل (بكلماته)</span>",
      esc(e.instr),
      "",
      "<span class='k'># خطوط حمراء — لا تُخالف مهما طلب العميل</span>"
    ].concat(e.rules.filter(function(r){return r[1]}).map(function(r){return "- "+r[0]})).concat([
      "",
      "<span class='k'># الصلاحية</span>",
      AUTON[e.auto]+". ساعات العمل: "+e.hours+".",
      "",
      "<span class='k'># الأدوات المتاحة</span>",
      toolNames(e)+". لا تصل لأي شيء خارجها.",
      "",
      "<span class='k'># التصعيد</span>",
      "أي شيء خارج التعليمات: توقف، لخّصه في سطرين، وارفعه."
    ]);
    return lines.join("\n");
  }
  /* حدوده — جُمل عادية بدل أزرار: الصلاحية، النبرة، الساعات، الخطوط الحمراء، الأدوات */
  function limitsHtml(e){
    var red=e.rules.filter(function(r){return r[1]}).map(function(r){return r[0]});
    return '<div class="card__h" style="border-block-start:1px solid var(--hair)">'+I.shield+'<b>حدوده</b><span class="cnt">تسري فورًا</span></div>'+
      '<div class="card__b"><p>صلاحيته: '+AUTON[e.auto]+'. نبرته: '+TONE[e.tone]+'. يشتغل: '+e.hours+'.</p>'+
      '<p>خطوطه الحمراء: '+red.join('، ')+'.</p>'+
      '<p>أدواته: '+toolNames(e)+' — ولا شيء غيرها.</p></div>';
  }
  function instrHtml(e){
    if(window.__SIY_REAL__){
      var savedRules=e.rules.filter(function(r){return r[1];}).map(function(r){return esc(r[0]);});
      var instructionSource=e.instrSource==='owner'?ui('تعديلك','Your edit'):e.instrSource==='manual_setup'?ui('مسودة أولية','Initial draft'):ui('دور الموظف ومعرفة الشركة','Employee role and company knowledge');
      return '<div class="card"><div class="card__h">'+I.pen+'<b>'+ui('تعليمات المحادثة','Conversation instructions')+'</b><span class="cnt">'+ui('نسخة ','Version ')+e.instrVersion+' · '+instructionSource+'</span></div>'+
        '<div class="card__b"><div id="publishedInstr" aria-live="polite"></div><textarea class="instr" id="instr" maxlength="12000" aria-label="'+ui('تعليمات ','Instructions for ')+esc(e.n)+'">'+esc(e.instr)+'</textarea>'+
        '<div class="instr__f" id="instrF"><span>'+ui('تُحفظ لسياق المحادثة؛ تطبيقها على طريقة العمل يحتاج مراجعة واختبارًا.','Saved for conversation context; applying them to the workflow requires review and testing.')+'</span><button type="button" class="bts" id="instrSave">'+ui('حفظ التعليمات','Save instructions')+'</button>'+(e.flowId?'<button type="button" class="bts bts--line" id="instrApply">'+ui('راجع وطبّق على طريقة العمل','Review and apply to workflow')+'</button>':'')+'</div></div>'+
        '<div class="card__h">'+I.shield+'<b>حدوده</b><span class="cnt">من السجل</span></div>'+
        '<div class="card__b"><p>الصلاحية المسجلة: '+esc(e.auto===null?'غير محددة':AUTON[e.auto])+'.</p>'+
        '<p>القيود المسجلة: '+(savedRules.length?savedRules.join('، '):'غير محددة')+'.</p>'+
        '<p>الأدوات المذكورة في السجل: '+esc(toolNames(e)||'غير محددة')+'.</p>'+
        '<p>هذه إعدادات محفوظة؛ تطبيق الاستئذان والقيود أثناء التشغيل لم يُتحقق منه هنا.</p></div></div>'+(e.draft?siyRefsHtml([['الموظف',e.id],['طريقة العمل',e.flowId]]):'');
    }
    return '<div class="card"><div class="card__h">'+I.pen+'<b>تعليماته</b><span class="cnt">بكلماتك</span></div>'+
      '<div class="card__b"><textarea class="instr" id="instr" aria-label="تعليمات '+esc(e.n)+'">'+esc(e.instr)+'</textarea>'+
      '<div class="instr__f" id="instrF"><span>عدّل بكلماتك. توريك الفرق قبل ما يسري.</span><button type="button" class="bts" id="instrSave">حدّث '+esc(e.n)+'</button></div></div>'+
      limitsHtml(e)+
      '<div class="card__h" style="border-block-start:1px solid var(--hair)"><b>كيف فهمها '+esc(e.n)+'</b><span class="cnt">كذا يشتغل فعلًا</span></div>'+
      '<div class="card__b"><ul class="how">'+e.how.map(function(h){return '<li>'+h+'</li>'}).join("")+'</ul></div>'+
      '<details class="adv"><summary>'+I.code+'النص الكامل</summary><div class="card__b" style="padding-block-start:0">'+
      '<div class="prompt">'+promptOf(e)+'</div>'+
      '<div class="vers"><span>النسخة '+e.ver+' · اليوم</span><button type="button" class="link" id="instrPrev">استرجع النسخة السابقة</button></div>'+
      '</div></details></div>';
  }

  /* ---------- ردود الموظف: موجّه نوايا صغير بصوت كل موظف ---------- */
  function lastLog(e,n){ return e.log.slice(0,n).map(function(l){return '<span class="num">'+l[0]+'</span> '+l[1]}).join("<br>"); }
  function statusReply(e){
    var k=e.kpi.map(function(x){ return x.l+' <b class="num">'+x.v+'</b>'+(x.t&&x.t!=="—"?' <span class="num">('+x.t+')</span>':''); }).join("، ");
    return { t:'<p>'+e.v.hi+' اليوم: '+k+'.</p><p>آخر ثلاث حركات:<br>'+lastLog(e,3)+'</p><p>'+e.v.q+'</p>',
             why:"الأرقام من عدّاد اليوم وسجلي — التغيّر مقارنة بنفس اليوم من الأسبوع الماضي." };
  }
  function whyReply(e,text){
    var W=e.v.why, m=text.match(/(?:تابعت|تابعتي|ذكّرت|ذكرت|رديت|أرسلت|ارسلت|راسلت|نشرت|صعّدت|صعدت|حجزت|أوقفت|اوقفت)\s*(?:على|لـ|مع|عن)?\s*([^؟?.،!]+)/);
    var subj=(m&&m[1]?m[1].trim():"")||(text.match(/\d{3,}/)||[])[0]||W.subj;
    var rule=e.rules[W.rule][0], log=e.log.filter(function(l){ return subj.split(/\s+/).some(function(t){ return t.length>2&&l[1].indexOf(t)>-1; }); })[0]||e.log[W.log];
    return { t:'<p>'+subj+' — '+W.act+'. آخر سطر في سجلي: «<span class="num">'+log[0]+'</span> '+log[1].replace(/\.$/,"")+'». قاعدتك: «'+rule+'»، '+W.extra+'.</p><p>'+W.retry+'</p>',
             why:"قاعدتك: «"+rule+"» — من تعليماتك، وسجلي فيه الوقت." };
  }
  /* فهد يستشهد: الجواب من قاعدة المعرفة يجي بذيل «من: … · ثقة …» — والذيل يظهر فقط لما يكون الجواب فعلًا من المعرفة */
  function refundReply(){
    return { t:'<p>سياستنا: استرجاع كامل خلال 14 يوم إذا المنتج بحالته — بعدها استبدال أو رصيد.</p>'+
               '<p class="cite nr">من: سياسة الاسترجاع · ثقة <span class="num">96%</span></p>',
             why:"الجواب حرفيًا من ملف سياسة الاسترجاع في قاعدة المعرفة — ما غيّرت فيه." };
  }
  /* ثقة منخفضة: ما يخمّن — يرفعها لك بطاقة «ينتظر قرارك» بنفس آلية الانتظارات والشارة */
  function shipReply(e){
    var w={t:"سؤال عن الشحن ما عندي جوابه.",s:"رفعته لك بدل ما أخمّن.",a:["اكتب الجواب","أضفها للمعرفة"],
           r:["تم. رديت على العميل بجوابك، وأضفته لقاعدة المعرفة عشان ما يرجع لك.","تم. أضفتها لقائمة «ناقص في المعرفة» — يوصلك تذكير تكتب جوابها."]};
    e.waits.push(w); e.wait++;
    empThread(e.id).push({me:false,wait:w,at:"ينتظر قرارك"});
    renderSide();
    return { t:'<p>ما عندي جواب موثوق عن الشحن (ثقة <span class="num">41%</span>) — رفعتها لك بدل ما أخمّن.</p>',
             why:"قاعدتي: أجاوب من قاعدة المعرفة فقط — والشحن ما له صفحة فيها، فالتخمين مو خيار." };
  }
  function adjustReply(e,text){
    var add=text.replace(/[.!؟?]+$/,"").trim(), del="", hours=null;
    var tm=text.match(/بعد\s*(?:الساعة\s*)?(\d{1,2})\s*(مساءً|مساء|م\b|صباحًا|صباحا|ص\b)?/);
    if(tm){ var h=tm[1], pm=!tm[2]||/م/.test(tm[2]); add="ما "+(e.f?"ترسلين":"ترسل")+" أي رسالة بعد الساعة "+h+(pm?" مساءً":" صباحًا")+"."; if(pm){ hours=e.hours.replace(/–.*$/,"– "+h+" م"); del="ساعات العمل: "+e.hours; } }
    else if(/نبرة|النبرة/.test(text)){ var formal=/رسمي|جدّي|جدي/.test(text); add="النبرة: "+(formal?"رسمية.":"ودّية."); del="النبرة: "+TONE[e.tone]; }
    else if(/^(لا|ما)\s/.test(add)) add=add+".";
    else add=add+".";
    var line="صار. "+(hours?"أوقف الإرسال بعد "+tm[1]+" مساءً وأؤجّل الباقي للصباح.":"أطبّقها من الرسالة الجاية.");
    return { t:'<p>'+line+' هذا اللي يتغير في تعليماتي:</p>', diff:{add:add,del:del,hours:hours}, why:"غيّرت سطرًا واحدًا في تعليماتي — والخطوط الحمراء ما تتأثر." };
  }
  function needReply(e){
    var off=e.tools.filter(function(s){return !toolOf(s).on});
    if(!off.length) return { t:'<p>كل أدواتي مربوطة'+(e.wait?' — اللي ناقصني بس قرارك على اللي فوق ('+e.wait+').':'.')+'</p><p>تبي أضيف أداة؟</p>', why:"أدواتي: "+toolNames(e)+" — وكلها مربوطة." };
    return { t:'<p>ناقصني '+off.map(function(s){ return (TN[s]||s)+' <button type="button" class="link nr" data-c="'+s+'">اربط</button>'; }).join(" و")+' — بدونها أشتغل جزئيًا.</p><p>تربطها الحين وأكمّل؟</p>',
             why:"ما أوصل لأي أداة ما ربطتها أنت." };
  }
  function pauseReply(e,on){
    if(window.__SIY_REAL__) return {t:"<p>تغيير التشغيل غير متاح بعد؛ حالة الموظف لم تتغير.</p>"};
    e.on=on; renderSide(); siyPatch(e.n,"status",on?"نشط":"متوقف");
    return { t:'<p>'+(on?e.v.resume:e.v.pause)+'</p>', why:on?"شغّلتني من المحادثة — نفس مفتاح التشغيل فوق.":"وقّفتني من المحادثة — نفس مفتاح التشغيل فوق." };
  }
  function fallbackReply(e,text){
    var s=text.length>48?text.slice(0,48).replace(/\s\S*$/,"")+"…":text;
    return { t:'<p>'+e.v.ack+' «'+esc(s)+'» — '+e.v.ackq+'</p>', why:"ما نفّذت شيء بعد — أسأل قبل ما أفترض." };
  }
  function empReply(e,text){
    var t=text.trim(), short=t.split(/\s+/).length<=4;
    if(short&&/(^|\s)(وقف|توقف|توقّف|وقّف|أوقف|اوقف)(\s|$)/.test(t)) return pauseReply(e,false);
    if(short&&/(^|\s)(كمّل|كمل|رجّع|رجع|شغّل|شغل|اشتغل|ارجع)(\s|$)/.test(t)) return pauseReply(e,true);
    if(/ليش|ليه|وش السبب|لماذا/.test(t)) return whyReply(e,t);
    if(e.id==="fahad"&&/استرجاع|الاسترجاع|سياسة|refund/i.test(t)) return refundReply();
    if(e.id==="fahad"&&/شحن|الشحن|توصيل/.test(t)) return shipReply(e);
    if(/خلّ|خلي|خلّي|غيّر|غير |لا ترسل|ما ترسل|أوقف|اوقف|زد |زيد|قلّل|قلل|بعد الساعة|بعد \d|نبرة/.test(t)) return adjustReply(e,t);
    if(/وش تحتاج|محتاج|ناقصك|تحتاج/.test(t)) return needReply(e);
    if(/وش صار|اليوم|وين وصلنا|تقرير|وش سوّيت|وش سويت|ملخص|الوضع/.test(t)) return statusReply(e);
    return fallbackReply(e,t);
  }
  /* يكتب… ثم يكشف الرد */
  function typeReply(e,list,build){
    var ty={me:false,typing:true,at:""}; list.push(ty); if(who===e.id) renderThread();
    setTimeout(function(){ var r=typeof build==="function"?build():build; r.me=false; r.at=now(); r.reveal=true;
      var i=list.indexOf(ty); if(i>-1) list.splice(i,1,r); else list.push(r); if(who===e.id) renderThread(); }, 600+Math.round(Math.random()*300));
  }

  /* ---------- الإرسال ---------- */
  function isBuild(t){ return /أبي|أبغى|ابن|وظّف|وظف|موظف|يتابع|يطارد|يطالب|يرد على/.test(t); }
  function send(text){
    text=(text||"").trim(); if(!text) return;
    if(window.__SIY_REAL__){
      if(window.__SIY_LOAD_ERROR__){ window.alert(loadErrorCopy()); return; }
    }
    /* معاينة قيد التعديل: إرسال النص من المحرر = إعادة اعتماد وتكملة التشغيل */
    if(pendEdit){ var pe=pendEdit; pendEdit=null; var pl=pe.ctx.list;
      pe.row.text=text; pe.row.state="approved"; pe.row.at=now();
      pl.push({me:true,t:text,at:now()});
      $("#input").value=""; $("#input").style.height="auto";
      if(curList()===pl) renderThread();
      pe.ctx.next(); return; }
    if(who==="tools") return;
    $("#input").focus();
    var list, w=who;
    if(isEmp()){ var e=emp(who); list=empThread(who); list.push({me:true,t:text,at:now()});
      $("#input").value=""; $("#input").style.height="auto"; renderThread();
      if(pendAns&&pendAns.who===who){ var p=pendAns; pendAns=null; resolveWait(e,list,p.mi,"كتبت الجواب",list[p.mi].wait.r[0],true); return; }
      if(window.__SIY_REAL__){ siyChatReal(e,text,list); return; } /* رد فعلي من الخلفية */
      typeReply(e,list,function(){ return empReply(e,text); }); return; }
    list = chatId ? CHATS[chatId].msgs : (live.siyadah=live.siyadah||[]);
    if(!window.__SIY_REAL__ && !chatId && !list.length){ // السجل التجريبي فقط؛ الهوية الحقيقية يصدرها الخادم
      var id="n"+Date.now(); CHATS[id]={with:"siyadah",t:title(text),when:"today",msgs:list}; chatId=id; live.siyadah=null;
    }
    list.push({me:true,t:text,at:now()});
    renderSide();
    $("#input").value=""; $("#input").style.height="auto"; renderThread();
    if(window.__SIY_REAL__){
      siyMessage(text,list,null); return;
    }
    setTimeout(function(){
      if(w==="siyadah"&&/وش تعرف|ايش تعرف|تعرف عنا|الذاكرة/.test(text)) list.push({me:false,at:now(),t:memHtml(),why:"كل سطر في الذاكرة له مصدر — محادثة أو قاعدة كتبتها أنت."});
      else if(w==="siyadah"&&isBuild(text)) list.push({me:false,plan:true,at:now(),t:"جهّزت ثلاثة. هذي خطتهم — ما يتحرك شيء قبل موافقتك:"});
      else list.push({me:false,at:now(),t:"<p>وصل. أجهّز لك الخطة، وما يتحرك شيء قبل موافقتك.</p>"});
      if(who===w) renderThread();
    },650);
  }
  /* الذاكرة الحيّة: سيادة تسرد اللي تحفظه — سطر لكل معلومة مع مصدرها */
  function memHtml(){
    if(!MEM.length) return "<p>الذاكرة فاضية للحين — أي قاعدة تحفظها من المحادثات تنحفظ هنا.</p>";
    return '<p>هذا اللي أحفظه عنكم:</p><p>'+MEM.map(function(m){
      return '<b>'+esc(m.k)+':</b> '+esc(m.v)+' <span class="msrc">· '+esc(m.src)+'</span>';
    }).join('<br>')+'</p><p>تعدّلها من الإعدادات › الذاكرة.</p>';
  }
  function reply(list,html){ list.push({me:false,at:now(),t:html}); renderThread(); }
  /* قرار على بطاقة «ينتظر قرارك» */
  function resolveWait(e,list,mi,label,conf,skipMe,evs){
    var m=list[mi]; if(!m||m.done) return;
    m.done={a:label,at:now()}; e.wait=Math.max(0,e.wait-1); e.log.unshift([now(),conf]);
    if(!skipMe) list.push({me:true,t:label,at:now()});
    renderSide(); renderThread();
    if(evs){ playEvents(list,evs); return; } /* قرار حساس: معاينة ثم مهلة تراجع بدل التأكيد المباشر */
    typeReply(e,list,{t:'<p>'+conf+'</p>', why:"قرارك أنت — نفّذته حرفيًا وسجّلته في سجلي بالوقت."});
  }

  /* ==========================================================================
     محرك التنفيذ — محاكي عقد الأوركسترا (شوف العقد أعلى الملف)
     playEvents يشغّل مصفوفة أحداث داخل قائمة رسائل: يبني رسالة تتبّع واحدة
     تتكدس فيها الخطوات، ويوقف عند await/preview لين تقرر أنت.
     ========================================================================== */
  function pres(id){ PRES={}; if(id) PRES[id]=1; renderSide(); renderBar(); }
  function toolMeta(s){ return TOOLS.filter(function(x){return x.s===s})[0]; }
  function trIco(toolS,empId){
    var t=toolS?toolMeta(toolS):null;
    if(t&&t.logo) return '<span class="tr-i"><img src="'+t.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1"></span>';
    var e=emp(empId); return '<span class="tr-i">'+(e?e.ini:"•")+'</span>';
  }
  /* صف واحد من التتبع: خطوة / تسليم / قرار / معاينة / نتيجة */
  function trHtml(r,ri){
    var at=r.at?'<span class="tr-t num">'+r.at+'</span>':'';
    if(r.k==="step")
      return '<div class="tr-s" data-ri="'+ri+'">'+trIco(r.tool,r.emp)+'<span class="tr-l">'+esc(r.label)+'</span>'+
        (r.state==="run"?'<span class="tr-spin" role="img" aria-label="جارٍ التنفيذ"></span>':'<span class="tr-ok" role="img" aria-label="تمت">'+I.check+'</span>'+at)+
        (r.why?'<button type="button" class="tr-xb" data-trwhy="1" aria-expanded="'+String(!!r.whyOpen)+'">ليش؟</button>':'')+
        (r.why&&r.whyOpen?'<span class="tr-whyl">'+esc(r.why)+'</span>':'')+'</div>';
    if(r.k==="handoff"){
      var fe=emp(r.from), te=emp(r.to);
      return '<div class="tr-h" data-ri="'+ri+'" aria-label="تسليم من '+(fe?fe.n:'')+' إلى '+(te?te.n:'')+'">'+
        '<span class="tr-av" title="'+(fe?fe.n:'')+'">'+(fe?fe.ini:'؟')+'</span><span class="tr-arr" aria-hidden="true">←</span>'+
        '<span class="tr-av" title="'+(te?te.n:'')+'">'+(te?te.ini:'؟')+'</span><span class="tr-l">'+esc(r.text)+'</span></div>';
    }
    if(r.k==="await"){
      if(r.chosen) return '<div class="tr-res" data-ri="'+ri+'">'+I.check+'<span>'+esc(r.chosen.label)+'</span><small class="num">'+r.chosen.at+'</small></div>';
      var c=r.card;
      return '<div class="tr-aw" data-ri="'+ri+'"><b class="tr-awt">'+esc(c.title)+'</b><p>'+esc(c.context)+'</p><p class="tr-rec">'+esc(c.recommend)+'</p>'+
        '<div class="wait__a">'+c.options.map(function(o,j){ return '<button type="button" class="bts'+(j?' bts--line':'')+'" data-opt="'+j+'">'+esc(o.label)+'</button>'; }).join("")+'</div></div>';
    }
    if(r.k==="preview"){
      var f;
      if(r.state==="pend") f='<div class="wait__a"><button type="button" class="bts" data-pv="send">'+I.check+'أرسل</button><button type="button" class="bts bts--line" data-pv="edit">عدّل</button></div>';
      else if(r.state==="edit") f='<div class="pv-f">'+esc(r.editHint||"عدّل النص في المحرر تحت وأرسله — التشغيل واقف لين تعتمده.")+'</div>';
      else f='<div class="tr-res">'+I.check+'<span>اعتمدت الإرسال</span><small class="num">'+r.at+'</small></div>';
      return '<div class="pv" data-ri="'+ri+'"><div class="pv-h">'+trIco(r.channel,null)+'<span>إلى: '+esc(r.to)+'</span></div><blockquote class="pv-q">'+esc(r.text)+'</blockquote>'+f+'</div>';
    }
    if(r.k==="result"){
      if(r.state==="cancelled") return '<div class="tr-res" data-ri="'+ri+'"><span aria-hidden="true">↩</span><span>تراجعت — ما انرسل شيء.</span><small class="num">'+r.at+'</small></div>';
      if(r.state==="hold"){
        var el=Math.min(6900,Date.now()-r.holdStart);
        return '<div class="tr-r" data-ri="'+ri+'">'+trIco(r.tool,r.emp)+'<span class="tr-l">'+esc(r.summary)+'</span>'+
          '<span class="tr-hnote">تُرسل خلال 7 ث</span><button type="button" class="link" data-hcancel="1">تراجع</button>'+
          '<div class="tr-hold" aria-hidden="true"><i style="animation-delay:-'+el+'ms"></i></div></div>';
      }
      var undo='';
      if(r.undone) undo='<span class="tr-und">↩ تراجعت</span>';
      else if(r.undoable&&Date.now()<r.undoUntil) undo='<button type="button" class="link" data-undo="1">تراجع</button>';
      var rc='';
      if(r.rcOpen){
        var e3=emp(r.emp), a=ACTIONS.filter(function(x){return x.id===r.actionId})[0]||r;
        rc='<div class="rc"><div class="rc-r"><b>الأداة</b><span>'+esc(TN[r.tool]||r.tool||"داخلي")+'</span></div>'+
           '<div class="rc-r"><b>الوقت</b><span class="num">'+(a.at||"")+'</span></div>'+
           '<div class="rc-r"><b>من نفّذ</b><span>'+(e3?e3.n:"سيادة")+'</span></div>'+
           (a.before?'<div class="rc-r"><b>قبل</b><span class="rc-bef">'+esc(a.before)+'</span></div>':'')+
           (a.after?'<div class="rc-r"><b>بعد</b><span>'+esc(a.after)+'</span></div>':'')+'</div>';
      }
      return '<div class="tr-r" data-ri="'+ri+'"><span class="tr-ok" role="img" aria-label="نُفّذ">'+I.check+'</span><span class="tr-l">'+esc(r.summary)+'</span>'+at+undo+
        '<button type="button" class="tr-xb" data-rc="1" aria-expanded="'+String(!!r.rcOpen)+'">الأثر</button>'+rc+'</div>';
    }
    return '';
  }
  /* المشغّل نفسه — استبدال المحاكي بالباك إند = تغذية next() من SSE بدل المصفوفة */
  function playEvents(list,evs,onEnd){
    if(window.__SIY_REAL__){ siyUnsupported(); return; } /* هذا المحرك للعرض التجريبي فقط */
    var ctx={list:list,evs:evs.slice(),i:0,trace:null};
    function vis(){ return curList()===list; }
    function draw(){ if(vis()) renderThread(); }
    function delay(ms,fn){ setTimeout(fn,reduced()?0:ms); }
    function row(r){ if(!ctx.trace){ ctx.trace={me:false,trace:[],at:now()}; list.push(ctx.trace); } ctx.trace.trace.push(r); }
    /* النتيجة صارت فعلية: تدخل ACTIONS ويزيد عدّاد الخطة */
    function land(r){
      r.state="sent"; r.at=now(); r.actionId="a"+(ACTIONS.length+1);
      ACTIONS.push({id:r.actionId,emp:r.emp,tool:r.tool,summary:r.summary,before:r.before||"",after:r.after||"",at:r.at,reversible:!!r.reversible,undone:false});
      PLAN.actions.used++; renderPlan();
      if(r.undoable){ r.undoUntil=Date.now()+7000; setTimeout(function(){ if(!r.undone&&r.undoable){ r.undoable=false; draw(); } },7000); }
    }
    function next(){
      if(ctx.i>=ctx.evs.length){ pres(null); if(onEnd) onEnd(); return; }
      var e=ctx.evs[ctx.i++];
      if(e.t==="say"){ ctx.trace=null;
        list.push({me:false,t:"<p>"+e.text+"</p>",at:now(),reveal:true,why:e.why}); draw();
        delay(500+e.text.split(/\s+/).length*25,next); return; }
      if(e.t==="step"){ pres(e.emp);
        var s={k:"step",emp:e.emp,tool:e.tool,label:e.label,why:e.why,state:"run"}; row(s); draw();
        delay(e.ms||1000,function(){ s.state="done"; s.at=now(); draw(); delay(250,next); }); return; }
      if(e.t==="handoff"){ row({k:"handoff",from:e.from,to:e.to,text:e.text}); draw(); delay(700,next); return; }
      if(e.t==="await"){ row({k:"await",card:e.card,_ctx:ctx}); draw(); return; } /* يوقف — الاختيار يكمل */
      if(e.t==="preview"){ row({k:"preview",to:e.to,channel:e.channel,text:e.text,editHint:e.editHint,state:"pend",_ctx:ctx}); draw(); return; } /* يوقف */
      if(e.t==="result"){ pres(e.emp);
        var r={k:"result",emp:e.emp,tool:e.tool,summary:e.summary,before:e.before,after:e.after,reversible:!!e.reversible,undoable:!!e.reversible,_ctx:ctx};
        row(r);
        if(e.hold&&!reduced()){ /* مهلة التراجع: الشريط ينزف 7 ث ثم يرسل فعليًا */
          r.state="hold"; r.holdStart=Date.now(); draw();
          r._tm=setTimeout(function(){ if(r.state!=="hold") return; land(r); draw();
            if(e.sent&&e.sent.length) playEvents(list,e.sent); },7000);
          delay(300,next); return;
        }
        if(e.hold) r.undoable=true; /* حركة مخفّضة: يرسل فورًا مع رابط تراجع فقط */
        land(r); draw();
        if(e.sent&&e.sent.length) Array.prototype.splice.apply(ctx.evs,[ctx.i,0].concat(e.sent));
        delay(450,next); return; }
      if(e.t==="done"){ ctx.trace=null; pres(null);
        if(e.text) list.push({me:false,t:"<p>"+e.text+"</p>",at:now(),reveal:true});
        draw(); delay(300,next); return; }
      next();
    }
    ctx.next=next;
    delay(350,next);
    return ctx;
  }
  /* السيناريو الرئيسي: الموافقة على الخطة تشغّل الفريق الثلاثة قدّامك */
  function buildEvents(){
    return [
      {t:"say",text:"أشغّلهم الحين — وتشوف كل خطوة قدامك:"},
      {t:"step",emp:"saad",tool:"hubspot",label:"يقرأ الليدات الجدد من HubSpot",ms:1200,why:"أول سطر في تعليماته: «تابع كل عميل جديد خلال خمس دقائق»."},
      {t:"result",emp:"saad",tool:"hubspot",summary:"3 ليدات دخلوا جدول المتابعة",before:"بدون متابعة",after:"متابعة خلال 5 دقائق",reversible:true},
      {t:"step",emp:"noura",tool:"wafeq",label:"تراجع الفواتير المتأخرة في قيود",ms:1400,why:"قاعدتها: «أرفع لك أي فاتورة تجاوزت 30 يومًا» — تفحص قبل ما تتصرف."},
      {t:"await",card:{ title:"فاتورة النخبة — 18,500 ر.س عمرها 31 يوم",
        context:"تجاوزت قاعدة الـ 30 يوم، فما أتصرف بدون إذنك.",
        recommend:"التوصية: اتصال شخصي من نورة أفضل من بريد رابع.",
        options:[
          {label:"خلها تتصل",events:[
            {t:"preview",to:"شركة النخبة",channel:"whatsapp",text:"مرحبًا، معك نورة من [شركتك]. بخصوص فاتورة 4302 بمبلغ 18,500 ر.س — نبي نتفق على موعد سداد يناسبكم هالأسبوع."},
            {t:"result",emp:"noura",tool:"whatsapp",summary:"أُرسلت رسالة السداد للنخبة",hold:true}]},
          {label:"بريد أخير",events:[
            {t:"result",emp:"noura",tool:"gmail",summary:"أُرسل التذكير الأخير بالبريد",hold:true}]},
          {label:"أجّلها لي",fx:function(){ var n=emp("noura"); n.wait++; renderSide(); },events:[
            {t:"say",text:"تمام، حطيتها في «ينتظر قرارك» عند نورة."}]}
        ]}},
      {t:"handoff",from:"saad",to:"noura",text:"حجزت موعد أحمد الغامدي الثلاثاء — جهّزي له عرض السعر قبلها."},
      {t:"result",emp:"noura",tool:"google-sheets",summary:"عرض السعر انجدول قبل الموعد",reversible:true},
      {t:"step",emp:"fahad",tool:"whatsapp",label:"يربط قنوات الدعم ويحمّل قاعدة المعرفة",ms:1200,why:"من خطته: يجاوب من قاعدة المعرفة فقط — فيحمّلها قبل ما يفتح القنوات."},
      {t:"result",emp:"fahad",tool:"site-chat",summary:"جاهز يرد على الموقع وواتساب"},
      {t:"done",text:"الثلاثة شغّالون. أول تقرير يوصلك الساعة 6، وأي قرار حساس يوقف عندك مثل ما شفت."}
    ];
  }
  /* رابط العرض #run=collect: خطوتا نورة (المراجعة ثم بطاقة القرار) في محادثتها */
  function collectEvents(){ var b=buildEvents(); return [b[3],b[4]]; }

  /* ==========================================================================
     نورة تبادر — مرة واحدة لكل تحميل: شارة +1 بنبضة، سجل جديد تحت «اليوم»،
     ورسالة منها في محادثتها مع بطاقة قرار بثلاثة خيارات (نفس آلية await)
     ========================================================================== */
  var PRO_INV=[["4295","مجموعة البناء الأولى","18,900","34 يوم"],
               ["4301","مؤسسة المدار التجارية","12,300","32 يوم"],
               ["4307","شركة الرواد للتموين","10,500","31 يوم"]];
  function clearNouraBadge(){ var n=emp("noura"); n.wait=Math.max(0,n.wait-1); renderSide(); }
  /* مسار «ابدئي»: سحب الفواتير → معاينة أول تذكير جاد → إرسال بمهلة تراجع → الختام */
  function proStartEvents(){
    return [
      {t:"step",emp:"noura",tool:"wafeq",label:"تسحب الفواتير الثلاث من قيود",ms:1300,why:"قاعدتك: أرفع لك أي فاتورة تجاوزت 30 يومًا — والثلاث تجاوزتها."},
      {t:"preview",to:"مجموعة البناء الأولى",channel:"gmail",
       text:"مساء الخير، معكم نورة من شركة الأفق. فاتورتكم 4295 بمبلغ 18,900 ر.س تعدّت 30 يومًا رغم تذكيرين سابقين. نحتاج موعد سداد محدد خلال ثلاثة أيام عمل — وإذا عندكم ملاحظة على الفاتورة علّموني اليوم وأحلها معكم."},
      {t:"result",emp:"noura",tool:"gmail",summary:"أُرسل أول تذكير جاد (1 من 3)",hold:true,
       sent:[{t:"say",text:"الباقيتان على نفس النمط خلال ساعة — وأوقف أي وحدة تسدد فورًا."},{t:"done"}]}
    ];
  }
  function proactiveEvents(){
    var startOpt=function(){ return {label:"ابدئي",fx:clearNouraBadge,events:proStartEvents()}; };
    return [
      {t:"say",text:"صباح الخير. 3 فواتير تعدّت 30 يوم — مجموعها 41,700 ر.س. أبدأ التذكير الجاد اليوم، ولا تشوفها الأول؟",
       why:"قاعدتك عندي: أرفع لك أي فاتورة تجاوزت 30 يومًا — الثلاث وصلت حدّها اليوم."},
      {t:"await",card:{ title:"3 فواتير تعدّت 30 يوم",
        context:"مجموعها 41,700 ر.س — والتذكيرات اللطيفة خلصت كلها.",
        recommend:"التوصية: أبدأ التذكير الجاد اليوم، وأوقف عن أي وحدة تسدد فورًا.",
        options:[ startOpt(),
          {label:"وريني إياها",events:[
            {t:"say",text:PRO_INV.map(function(i){ return 'فاتورة <span class="num">'+i[0]+'</span> — '+i[1]+' — <span class="num">'+i[2]+'</span> ر.س — عمرها '+i[3]; }).join('<br>')+'<br>أبدأ؟'},
            {t:"await",card:{ title:"أبدأ التذكير الجاد؟", context:"نفس الثلاث فوق — أبدأ بالأكبر مبلغًا.", recommend:"التوصية: نبدأ اليوم قبل ما تكبر الأعمار.",
              options:[ startOpt() ]}}]},
          {label:"أجّليه",fx:clearNouraBadge,events:[
            {t:"say",text:"تمام، أجّلته لبكرة الصباح — وما راح أزعجك فيه اليوم."},{t:"done"}]}
        ]}}
    ];
  }
  function triggerProactive(openThread){
    if(window.__SIY_REAL__) return; /* الحساب الحقيقي: لا مبادرات وهمية */
    if(proFired) return; proFired=true;
    var n=emp("noura"); if(!n) return; n.wait++; PULSE.noura=1;
    CHATS["pn1"]={with:"noura",emp:"noura",t:"3 فواتير تعدّت 30 يوم",when:"today",msgs:[]};
    renderSide();
    setTimeout(function(){ PULSE={}; renderSide(); },3800); /* النبضة مرة واحدة ثم تهدأ */
    playEvents(empThread("noura"),proactiveEvents());
    if(openThread) go("noura");
  }

  /* --- الأحداث --- */
  $("#send").addEventListener("click",function(){ send($("#input").value); });
  $("#input").addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(this.value);} });
  $("#input").addEventListener("input",function(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,160)+"px"; });

  function go(w,c){ who=w; chatId=c||null; kpiOpen=null; renderSide(); renderBar(); renderThread();refreshLiveLabels(); if(window.__SIY_REAL__&&emp(w))siyResumePendingActivation(w); }
  function newChat(){ live={}; go("siyadah"); $("#input").focus(); }
  $("#emps").addEventListener("click",function(e){ var b=e.target.closest(".emp"); if(!b) return; go(b.dataset.emp); $("#input").focus(); });
  $(".side__scroll").addEventListener("click",function(e){ var b=e.target.closest(".hist"); if(!b||!b.dataset.chat) return;
    var c=CHATS[b.dataset.chat]; if(c&&c.emp){ go(c.emp,window.__SIY_REAL__?b.dataset.chat:null); $("#input").focus(); return; } /* مبادرة موظف: سجلّها يفتح محادثته */
    go("siyadah",b.dataset.chat); });
  $("#newChat").addEventListener("click",newChat);
  $("#hq").addEventListener("input",function(){ filterHist(); if(palOpen) renderPal(); });

  /* كل نقرة داخل المحادثة — مستمع واحد */
  $("#thread").addEventListener("click",function(e){
    var t=e.target, list, mEl=t.closest(".m"), mi=mEl?+mEl.dataset.mi:-1;
    if(t.closest("[data-siy-retry]")){ var retryList=curList(); if(retryList&&retryList[mi]&&retryList[mi].siyRetry) retryList[mi].siyRetry(); return; }
    if(t.closest("[data-retry-tools]")){ realTools(); return; }
    if(t.closest("[data-siy-approval]")){ var approvalList=curList(), approvalRow=approvalList&&approvalList[mi]; siyDecideBuilder(approvalRow,t.closest("[data-siy-approval]").dataset.siyApproval); return; }
    if(window.__SIY_REAL__ && t.closest("#instrPrev,[data-save],[data-approve],[data-decide],[data-opt],[data-pv],[data-hcancel],[data-undo]")){ siyUnsupported(); return; }
    if(t.closest("#renameBtn")){ renameEmp(); return; }
    var toolDetails=t.closest("[data-tool-details]"); if(toolDetails){ openToolDetails(toolDetails.dataset.toolDetails); return; }
    if(t.closest("[data-request-tool]")){ newChat(); var requestInput=$("#input"); requestInput.value="أحتاج أداة غير موجودة في القائمة: "; requestInput.focus(); return; }
    var c=t.closest(".cardq"); if(c){ send(c.lastChild.textContent); return; }
    /* رقاقتا الافتتاحية: «شوف اللي ينتظرني» تفتح صاحب أكثر الانتظارات · «وش صار أمس؟» رد قصير من السجلات */
    var opb=t.closest(".opch");
    if(opb){
      if(opb.dataset.op==="waits"){ var best=EMPS.reduce(function(a,e){return e.wait>a.wait?e:a;},EMPS[0]); go(best.id); $("#input").focus(); }
      else{ var L0=live.siyadah=live.siyadah||[]; L0.push({me:true,t:"وش صار أمس؟",at:now()}); renderThread();
            playEvents(L0,[{t:"say",text:yestText(),why:"الملخص من سجل كل موظف — كل سطر له وقت."}]); }
      return; }
    if(t.closest("[data-approve]")){ var ab=t.closest("[data-approve]"); if(ab.disabled) return; list = chatId ? CHATS[chatId].msgs : live.siyadah; if(!list||!list[mi]) return;
      list[mi].approved=true; list[mi].approvedAt=now(); ab.disabled=true;
      list.push({me:true,t:"وافق وشغّل",at:now()}); renderThread();
      playEvents(list,buildEvents()); return; } /* الموافقة تشغّل الفريق — تتبّع حي خطوة خطوة */
    if(t.closest("[data-editplan]")){ if(t.closest("[data-editplan]").disabled) return; $("#input").placeholder="وش تعدّل في الخطة؟"; $("#input").focus(); return; }
    /* صفوف التتبع الحي: ليش الخطوة / خيار القرار / المعاينة / مهلة التراجع / التراجع / الأثر */
    var trBtn=t.closest("[data-trwhy],[data-opt],[data-pv],[data-hcancel],[data-undo],[data-rc]");
    if(trBtn&&mEl){
      var Lc=curList(), tmsg=Lc&&Lc[mi]; if(!tmsg||!tmsg.trace) return;
      var riEl=trBtn.closest("[data-ri]"), rr=riEl&&tmsg.trace[+riEl.dataset.ri]; if(!rr) return;
      if(trBtn.hasAttribute("data-trwhy")){ rr.whyOpen=!rr.whyOpen; renderThread(); return; }
      if(trBtn.hasAttribute("data-rc")){ rr.rcOpen=!rr.rcOpen; renderThread(); return; }
      if(trBtn.hasAttribute("data-opt")){ if(rr.chosen) return; var oj=+trBtn.dataset.opt, op=rr.card.options[oj]; if(!op) return;
        $$("button",trBtn.parentNode).forEach(function(b){ b.disabled=true; });
        rr.chosen={label:op.label,at:now()};
        rr._ctx.list.push({me:true,t:op.label,at:now()});
        if(op.fx) op.fx();
        Array.prototype.splice.apply(rr._ctx.evs,[rr._ctx.i,0].concat(op.events||[]));
        renderThread(); rr._ctx.next(); return; }
      if(trBtn.dataset.pv==="send"){ if(rr.state!=="pend") return; rr.state="approved"; rr.at=now(); renderThread(); rr._ctx.next(); return; }
      if(trBtn.dataset.pv==="edit"){ if(rr.state!=="pend") return; rr.state="edit"; pendEdit={row:rr,ctx:rr._ctx};
        renderThread(); var inp2=$("#input"); inp2.value=rr.text; inp2.style.height="auto"; inp2.style.height=Math.min(inp2.scrollHeight,160)+"px"; inp2.focus(); return; }
      if(trBtn.hasAttribute("data-hcancel")){ if(rr.state!=="hold") return; rr.state="cancelled"; rr.at=now(); if(rr._tm) clearTimeout(rr._tm); renderThread(); return; }
      if(trBtn.hasAttribute("data-undo")){ if(rr.undone||rr.state!=="sent") return; rr.undone=true;
        ACTIONS.forEach(function(x){ if(x.id===rr.actionId) x.undone=true; }); renderThread(); return; }
      return; }
    /* إجراءات الرسالة: نسخ / ليش؟ */
    if(t.closest("[data-copy]")){ var cb=t.closest("[data-copy]"), txt=$(".m__c",mEl).textContent.replace(/\s+/g," ").trim();
      try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(function(){}); }catch(err){}
      var old=cb.innerHTML; cb.innerHTML=I.check+'نُسخ'; cb.disabled=true; setTimeout(function(){ cb.innerHTML=old; cb.disabled=false; },1200); return; }
    if(t.closest("[data-why]")){ var wb=t.closest("[data-why]"), wl=$(".whyl",mEl); wl.hidden=!wl.hidden; wb.setAttribute("aria-expanded",String(!wl.hidden)); return; }
    /* قرار من بطاقة «ينتظر قرارك» */
    var d=t.closest("[data-decide]"); if(d){ if(d.disabled||!isEmp()) return; var en=emp(who); list=empThread(who); var wm=list[mi], j=+d.dataset.decide, a=wm.wait.a[j], conf=wm.wait.r[j];
      if(/^اربط/.test(a)){ var slug=a.indexOf("لينكدإن")>-1?"linkedin":a.indexOf("إنستغرام")>-1?"instagram-business":null; if(slug){ openConnect(slug); } return; }
      $$("button",d.parentNode).forEach(function(b){ b.disabled=true; });
      /* خصم سعد: يمر على معاينة الرسالة ثم مهلة تراجع 7 ث قبل ما يوصل العميل */
      if(a==="وافق على الخصم"&&who==="saad"){
        resolveWait(en,list,mi,a,conf,false,[
          {t:"preview",to:"محمد العتيبي",channel:"whatsapp",text:"أبشر أستاذ محمد — تم اعتماد خصم 15% على فاتورتك الحالية. المبلغ بعد الخصم: 15,725 ر.س."},
          {t:"result",emp:"saad",tool:"whatsapp",summary:"أُرسل اعتماد الخصم لمحمد العتيبي",hold:true,
           sent:[{t:"say",text:conf,why:"قرارك أنت — نفّذته حرفيًا وسجّلته في سجلي بالوقت."}]}
        ]); return; }
      if(a==="اكتب الجواب"){ pendAns={who:who,mi:mi}; var inp=$("#input"); inp.value="الجواب: "; inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); return; }
      if(a==="شوف التقويم"){ list.push({me:true,t:a,at:now()}); renderThread(); typeReply(en,list,{t:'<p>'+conf+'</p><p>أرسله لك في Google Docs؟</p>', why:"التقويم من تعليماتك: خدماتكم وأسئلة عملائكم."}); return; }
      resolveWait(en,list,mi,a,conf); return; }
    /* حفظ فرق التعليمات */
    if(t.closest("[data-save]")){ if(!isEmp()) return; var es=emp(who); list=empThread(who); var dm=list[mi]; if(!dm||!dm.diff||dm.saved) return;
      es.instr=(es.instr.replace(/\s+$/,"")+" "+dm.diff.add).trim(); if(dm.diff.hours) es.hours=dm.diff.hours; if(/النبرة: رسمية/.test(dm.diff.add)) es.tone=0; else if(/النبرة: ودّية/.test(dm.diff.add)) es.tone=1;
      es.ver++; dm.saved=es.ver; es.log.unshift([now(),"حدّثت تعليماتي (النسخة "+es.ver+"): "+dm.diff.add]);
      siyPatch(es.n,"instructions",es.instr); if(es.tone!=null) siyPatch(es.n,"tone",es.tone===0?"رسمي":"ودّي");
      MEM.push({k:"قاعدة ل"+es.n,v:dm.diff.add,src:"من محادثة اليوم"}); renderMem(); /* القاعدة الجديدة تدخل الذاكرة الحيّة */
      renderThread(); typeReply(es,list,{t:'<p>حفظت. تسري من الرسالة الجاية — وحفظتها في الذاكرة.</p>', why:"النسخة "+es.ver+" من تعليماتي — تقدر ترجع للي قبلها من «التعليمات»، والقاعدة صارت في الإعدادات › الذاكرة."}); return; }
    /* «التفاصيل»: يفتح مربعات الأرقام الأربعة بدون إعادة رسم — ويرجع مطويًا مع كل زيارة */
    if(t.closest("#kpiTgl")){ var kw=$("#kpiWrap"), kb=$("#kpiTgl"); kw.hidden=!kw.hidden; kb.setAttribute("aria-expanded",String(!kw.hidden)); kpiOpen=kw.hidden?null:who; return; }
    if(t.closest("#draftTools")){ openTools(); return; }
    if(t.closest("#reviewStart")){ var draftWrap=$("#instrWrap"), review=$("#reviewStart");draftWrap.hidden=!draftWrap.hidden;review.setAttribute('aria-expanded',String(!draftWrap.hidden));if(!draftWrap.hidden){$("#thread").scrollTop=0;$("#instr").focus();if(window.__SIY_REAL__)siyReadPublishedInstructions(emp(who));}return; }
    if(t.closest("#instrTgl")){ var w=$("#instrWrap"), b=$("#instrTgl"); w.hidden=!w.hidden; b.setAttribute("aria-expanded",String(!w.hidden)); if(!w.hidden){ $("#thread").scrollTop=0; $("#instr").focus();if(window.__SIY_REAL__)siyReadPublishedInstructions(emp(who)); } return; }
    if(t.closest("#onSw")){ if(window.__SIY_REAL__){ siySetEmployeeState(emp(who)); return; } var sw=$("#onSw"), eo=emp(who), v=sw.getAttribute("aria-checked")==="true"; sw.setAttribute("aria-checked",String(!v)); eo.on=!v; $("#onLbl").textContent=eo.on?(eo.f?"شغّالة":"شغّال"):(eo.f?"متوقفة":"متوقف"); renderSide(); siyPatch(eo.n,"status",eo.on?"نشط":"متوقف"); return; }
    if(window.__SIY_REAL__&&t.closest("#instrApply")){
      var current=emp(who), note=$("#instrF").firstChild;
      if(!current||!current.flowId)return;
      if($("#instrSave").disabled||$("#instr").value.trim()!==current.instr){note.textContent=ui('احفظ تعديلك أولًا، ثم اطلب تطبيق التعليمات المحفوظة.','Save your changes first, then request applying the saved instructions.');return;}
      var composer=$("#input");if(composer.value.trim()){note.textContent=ui("لديك رسالة لم ترسلها. أرسلها أو احفظ نصها قبل تجهيز طلب التعليمات.","You have an unsent message. Send it or save its text before preparing the instruction request.");composer.focus();return;}composer.value=ui('راجع التعليمات المحفوظة لهذا الموظف وطبّقها على طريقة عمله المرتبطة، ثم اختبر التغييرات وأخبرني بما تأكدت منه.','Review this employee’s saved instructions and apply them to the linked workflow, then test the changes and report what you verified.');composer.focus();$("#thread").scrollTop=$("#thread").scrollHeight;return;
    }
    if(t.closest("#instrSave")){ var e2=emp(who), nv=$("#instr").value.trim(); if(!nv||nv===e2.instr){ $("#instrF").firstChild.textContent="ما تغيّر شيء."; return; }
      if(window.__SIY_REAL__){ siySaveEmployeeInstructions(e2,nv); return; }
      var os=e2.instr.split(/(?<=[.؟!])\s+/), ns=nv.split(/(?<=[.؟!])\s+/), add=ns.filter(function(s){return os.indexOf(s)<0}).join(" "), del=os.filter(function(s){return ns.indexOf(s)<0}).join(" ");
      e2.instr=nv; e2.ver++; siyPatch(e2.n,"instructions",nv);
      list=empThread(who); list.push({me:true,t:"حدّث تعليماتك: «"+(nv.length>90?nv.slice(0,90).replace(/\s\S*$/,"")+"…":nv)+"»",at:now()});
      list.push({me:false,at:now(),t:"<p>قرأته. هذا اللي تغيّر عندي — والخطوط الحمراء كما هي:</p>",diff:{add:add||"—",del:del},saved:e2.ver,why:"النسخة "+e2.ver+" — الفرق سطرًا بسطر مع النسخة "+(e2.ver-1)+"."});
      renderThread(); typeReply(e2,list,{t:'<p>حفظت. تسري من الرسالة الجاية.</p>', why:"النسخة "+e2.ver+" من تعليماتي."}); return; }
    if(t.closest("#instrPrev")){ var e3=emp(who); if(e3.ver>1){ e3.ver--; } var v2=$(".vers"); v2.innerHTML='<span style="color:var(--ok)">رجعت النسخة '+e3.ver+' · قبل 4 أيام. النسخة '+(e3.ver+1)+' محفوظة لو غيّرت رأيك.</span>'; return; }
    var m=t.closest("#more"); if(m){ tshown+=24; renderThread(); return; }
    if(t.closest("#allTgl")){ allOpen=true; renderThread(); return; } /* «اعرض الكل» — قسم الكل مطوي افتراضيًا */
    var cc=t.closest("[data-c]"); if(cc){ openConnect(cc.dataset.c); }
  });

  /* القائمة الجانبية */
  $("#closeSide").addEventListener("click",function(){ $("#app").classList.add("closed"); $("#app").classList.remove("open"); $("#openSide").setAttribute("aria-expanded","false"); if(mobile()) $("#openSide").focus(); });
  var mobile=function(){ return window.matchMedia("(max-width:820px)").matches; };
  function setDrawer(open){ $("#app").classList.toggle("open",open); $("#openSide").setAttribute("aria-expanded",open?"true":"false"); if(open&&mobile()){ var first=$(".side button,.side a"); if(first) first.focus(); } }
  $("#openSide").addEventListener("click",function(){ $("#app").classList.remove("closed"); setDrawer(!$("#app").classList.contains("open")); });
  $("#scrim").addEventListener("click",function(){ setDrawer(false); $("#openSide").focus(); });
  /* mobile drawer: picking anything in the sidebar closes it (except the search box and the shortcuts list) */
  $(".side").addEventListener("click",function(e){ if(e.target.closest("button,a")&&!e.target.closest("#keysBtn,#keys")&&mobile()) setTimeout(function(){ setDrawer(false); },0); });
  $("#keysBtn").addEventListener("click",function(){ var k=$("#keys"); k.hidden=!k.hidden; this.setAttribute("aria-expanded",String(!k.hidden)); });

  /* ---------- الأدوات — كتالوج سيادة ---------- */
  /* [slug, name, description EN, category, logo, description AR] */
  var ON ={"gmail":"سعد · نورة · فهد","google-sheets":"نورة","google-calendar":"سعد","whatsapp":"سعد · فهد"};
  var SUG={"linkedin":"تحتاجه ريم","hubspot":"يحتاجه سعد","wafeq":"تحتاجه نورة","cal-com":"يحتاجه سعد","instagram-business":"تحتاجه ريم","google-docs":"تحتاجه ريم"};
  var TOOLS=(window.PIECES||[]).filter(function(p){return !/active.?pieces/i.test(p[1]);}).map(function(p){ return {s:p[0],n:p[1],d:p[5]||p[2],en:p[2],c:p[3],logo:p[4],on:!!ON[p[0]],by:ON[p[0]]||"",connection:null,sug:window.SIYADAH_REAL_ACCOUNT===true?"":(SUG[p[0]]||"")}; });
  var SOON=["سلة","زد","فودكس","ميسر","Unifonic","تابي","دفترة"];
  var tq="", tshown=24, picked=null, allOpen=false; /* allOpen: قسم «الكل» مطوي افتراضيًا */
  function hasConnection(t){ return window.__SIY_REAL__?!!t.connection:t.on; }
  /* مين يستخدم الأداة: من أدوات الموظفين، وإلا من الاقتراحات */
  function usersOf(s){ var tool=TOOLS.find(function(t){return t.s===s}),flowIds=tool&&tool.connection&&tool.connection.flowIds||[]; var u=EMPS.filter(function(e){return e.tools.indexOf(s)>-1||flowIds.includes(e.flowId)}).map(function(e){return e.n}); if(u.length) return u.join(" · "); if(window.__SIY_REAL__) return ui("بانتظار تعيين موظف","No employee assigned"); var g=SUG[s]; return g?g.replace(/^(يحتاجه|تحتاجه)\s+/,""):ui("بانتظار تعيين موظف","No employee assigned"); }
  function tcard(t){
    var linked=hasConnection(t),assigned=t.connection&&EMPS.some(function(e){return (t.connection.flowIds||[]).includes(e.flowId)}),state=t.connection?(t.connection.status==='ERROR'?ui('فيها خطأ','Needs attention'):assigned?ui('ضمن موظف','Assigned'):ui('محفوظة','Saved')):(linked?ui('جاهزة','Ready'):''),st=linked?'<span class="st"><i></i>'+state+'</span>':(t.sug?'<span class="st st--w">'+t.sug+'</span>':'');
    return '<div class="tl'+(t.on?' tl--on':'')+'"><span class="tl__i"><img src="'+t.logo+'" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1"></span><div><div class="tl__n">'+t.n+'</div>'+
      '<div class="tl__d">'+(locale==='en'?t.en:(t.d||t.c))+(linked?'<br><span class="who">'+ui('يستخدمها: ','Used by: ')+t.by+'</span>':'')+'</div>'+
      '<div class="tl__f">'+(linked?'<button type="button" class="lnk" data-tool-details="'+esc(t.s)+'">'+ui('التفاصيل','Details')+'</button>':'<button type="button" class="lnk lnk--fill" data-c="'+t.s+'">'+ui('اربط','Connect')+'</button>')+st+'</div></div></div>';
  }
  function tgrid(a,e){ return a.length?'<div class="tgrid">'+a.map(tcard).join("")+'</div>':'<div class="tempty">'+e+'</div>'; }
  function toolsHtml(){
    var f=TOOLS.filter(function(t){return !tq||(t.n+" "+t.d+" "+t.en+" "+t.s+" "+t.c).toLowerCase().indexOf(tq)>-1});
    var h='<div class="tools"><h1>'+ui('الأدوات','Tools')+'</h1><p class="sub">'+TOOLS.length+ui(' أداة. اربط اللي تستخدمه، وموظفوك يشتغلون فيه — ولا يوصل موظف لأداة ما ربطتها أنت.',' tools. Connect the ones you use. Employees only access tools you connect.')+'</p>'+
      '<div class="tsearch"><span class="drop"></span><input id="tq" placeholder="'+ui('ابحث… واتساب، قيود، HubSpot','Search… WhatsApp, Wafeq, HubSpot')+'" aria-label="'+ui('ابحث في الأدوات','Search tools')+'" value="'+esc(tq)+'"><kbd>/</kbd></div>';
    if(window.__SIY_TOOLS_ERROR__)h+='<p class="mf__e" role="alert">'+ui('تعذّر تحميل حالة الاتصالات.','Could not load connection status.')+' <button type="button" class="lnk" data-retry-tools="1">'+ui('أعد المحاولة','Try again')+'</button></p>';
    if(!tq){
      var on=f.filter(hasConnection),sug=f.filter(function(t){return t.sug&&!hasConnection(t)}),rest=f.filter(function(t){return !hasConnection(t)&&!t.sug});
      h+='<div class="tsec"><b>'+ui('الاتصالات المحفوظة','Saved connections')+'</b>'+on.length+'</div>'+tgrid(on,ui("ما حفظت اتصالًا بعد","No saved connections yet"));
      if(sug.length) h+='<div class="tsec"><b>'+ui('مقترحة لك','Suggested')+'</b>'+ui('حسب فريقك الحالي','For your current team')+'</div>'+tgrid(sug,"—");
      h+='<div class="tsec"><b>'+ui('الكل','All')+'</b>'+TOOLS.length+'</div>';
      if(allOpen){ h+=tgrid(rest.slice(0,tshown),"—");
        if(rest.length>tshown) h+='<button type="button" class="more" id="more">'+ui('اعرض المزيد — باقي ','Show more — ')+(rest.length-tshown)+'</button>'; }
      else h+='<button type="button" class="more" id="allTgl">'+ui('اعرض الكل','Show all')+' (<span class="num">'+TOOLS.length+'</span>)</button>';
      h+='<div class="soon"><div><b>'+ui('أدوات سعودية نبنيها لك','Saudi tools built for you')+'</b>'+ui('مو في الكتالوج بعد — نضيفها لك على الطلب.','Not in the catalog yet. Request one and we can add it.')+'<div class="chips">'+SOON.map(function(x){return '<span>'+x+'</span>'}).join("")+'</div></div><button type="button" class="lnk" data-request-tool="1">'+ui('اطلب أداة','Request a tool')+'</button></div>';
    } else {
      h+='<div class="tsec"><b>'+ui('نتائج «','Results for “')+esc(tq)+ui('»','”')+'</b>'+f.length+'</div>'+tgrid(f.slice(0,tshown),ui("ما لقيناها في الكتالوج — اطلبها ونبنيها لك.","Not in the catalog. Request it and we can build it."));
      if(f.length>tshown) h+='<button type="button" class="more" id="more">'+ui('اعرض المزيد — باقي ','Show more — ')+(f.length-tshown)+'</button>';
    }
    return h+'</div>';
  }
  function bindTools(){
    var q=$("#tq"); q.addEventListener("input",function(){ tq=this.value.trim().toLowerCase(); tshown=24; var pos=this.selectionStart; renderThread(); var nq=$("#tq"); nq.focus(); nq.setSelectionRange(pos,pos); });
  }
  /* dialog: focus in, trap Tab, Escape closes, focus returns to the opener */
  var modalOpener=null;
  function openConnect(slug){ picked=TOOLS.filter(function(x){return x.s===slug})[0]; if(!picked) return;
    $("#mI").innerHTML='<img src="'+picked.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:26px;height:26px;object-fit:contain">'; $("#mN").textContent=picked.n; $("#mD").textContent=ui("بعد الربط يقدر موظفوك يستخدمون ","Once connected, your employees can use ")+picked.n+". "+(locale==='en'?picked.en:picked.d)+".";
    $("#mF").hidden=true; $("#mF").innerHTML=""; $("#mGo").hidden=false; $("#mGo").disabled=false; $("#mGo").textContent=ui("اربط","Connect");
    openModal(); if(window.__SIY_REAL__) realConnect(picked); }
  function openToolDetails(slug){ picked=TOOLS.filter(function(x){return x.s===slug&&hasConnection(x);})[0]; if(!picked) return;
    $("#mI").innerHTML='<img src="'+picked.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:26px;height:26px;object-fit:contain">'; $("#mN").textContent=picked.n;
    if(window.__SIY_REAL__){ var c=picked.connection,status=c&&c.status==='ERROR'?ui("الاتصال فيه خطأ","Connection needs attention"):ui("الاتصال محفوظ؛ اختبر مهمة فعلية للتأكد من النتيجة","Connection saved. Run a real task to verify the outcome");
      $("#mD").textContent=status+ui(" · يستخدمها: "," · Used by: ")+usersOf(picked.s); $("#mGo").hidden=true; $("#mF").hidden=false; $("#mF").innerHTML='<p class="mf__m">'+esc(c&&c.displayName||picked.n)+'</p>'+(picked.s==='gmail'?'<p class="mf__m">'+ui('إعادة الربط تستبدل حساب Google المستخدم للرسائل القادمة داخل شركتك.','Reconnecting replaces the Google account used for future emails in your company.')+'</p>':'')+'<p class="mf__e" id="mE" role="alert" hidden></p><div class="mbox__a">'+(picked.s==='gmail'?'<button type="button" class="lnk" data-reconnect="1">'+ui('أعد ربط Google','Reconnect Google')+'</button>':'')+'<button type="button" class="lnk" data-revalidate="1">'+ui('اختبر الاتصال','Check connection')+'</button><button type="button" class="lnk" data-disconnect="1">'+ui('افصل','Disconnect')+'</button></div>'; }
    else { $("#mF").hidden=true; $("#mGo").hidden=false; $("#mGo").disabled=true; $("#mGo").textContent=ui("جاهزة","Ready"); } openModal(); }
  function openModal(){ modalOpener=document.activeElement; $("#modal").classList.add("on"); $("#mX").focus(); }
  function closeModal(){ if(oauthOff)oauthOff(); rc=null; $("#modal").classList.remove("on"); var back=(modalOpener&&document.contains(modalOpener))?modalOpener:($("#tq")||$("#input")); if(back&&back.focus) back.focus(); modalOpener=null; }
  $("#mX").addEventListener("click",closeModal);
  $("#modal").addEventListener("click",function(e){ if(e.target===this) closeModal(); });
  /* shared Tab trap for dialogs */
  function trapTab(e,root){ if(e.key!=="Tab") return; var f=$$("button,[href],input,textarea,select,[tabindex]:not([tabindex=\"-1\"])",root).filter(function(x){return !x.disabled&&x.offsetParent!==null}); if(!f.length) return; var a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } }
  $("#modal").addEventListener("keydown",function(e){ trapTab(e,$("#modal")); });
  $("#mGo").addEventListener("click",function(){
    if(window.__SIY_REAL__){ realConnect(picked); return; }
    if(picked){ picked.on=true; picked.by=usersOf(picked.s); picked.sug="";
      /* ربط من بطاقة ريم «اربط لينكدإن» يحسم البطاقة */
      if(who==="reem"&&picked.s==="linkedin"){ var e=emp(who), list=empThread(who), i=-1; list.forEach(function(m,k){ if(i<0&&m.wait&&!m.done&&/^اربط/.test(m.wait.a[0])) i=k; });
        if(i>-1){ e.on=true; e.since="شغّالة منذ الحين"; resolveWait(e,list,i,"اربط لينكدإن",list[i].wait.r[0]); } }
    }
    closeModal(); $("#toolsCnt").textContent=TOOLS.filter(function(t){return t.on}).length+" مربوطة"; renderThread(); });

  var rc=null,oauthOff=null;
  function toolsCount(){ if(window.__SIY_TOOLS_ERROR__){$("#toolsCnt").textContent=ui("حالة الربط غير متاحة","Connection status unavailable");return;} if(window.__SIY_REAL__&&!window.__SIY_TOOLS_LOADED__){$("#toolsCnt").textContent=ui('لم يتم التحقق من الاتصالات','Connections not verified');return;} var count=TOOLS.filter(function(t){return window.__SIY_REAL__?!!t.connection:t.on;}).length; $("#toolsCnt").textContent=count+ui(window.__SIY_REAL__?(count===1?" اتصال محفوظ":" اتصالات محفوظة"):" مربوطة",window.__SIY_REAL__?(count===1?" saved connection":" saved connections"):" connected"); }
  function integration(body){ return siyPost("/siyadah-api/v1/integrations",body); }
  function rcMsg(message){ var e=$("#mE"); if(e){e.textContent=message||"";e.hidden=!message;} }
  function rcBox(html){ $("#mF").hidden=false; $("#mF").innerHTML=html; $("#mGo").hidden=true; }
  async function realTools(){
    if(!window.__SIY_REAL__)return;
    try{ var data=await integration({op:"list"}); window.__SIY_TOOLS_ERROR__=""; window.__SIY_TOOLS_LOADED__=true; TOOLS.forEach(function(t){t.on=false;t.connection=null;t.by="";}); (data.connections||[]).forEach(function(c){var t=TOOLS.find(function(x){return x.s===c.slug;});if(t){t.connection=c;t.on=c.status==='ACTIVE';t.by=usersOf(t.s);t.sug="";}}); }
    catch(error){ window.__SIY_TOOLS_ERROR__=error.message||"تعذّر تحميل الاتصالات."; }
    toolsCount(); if(who==="tools")renderThread();
  }
  function rcField(field,index){
    if(field.type==="markdown")return '<p class="mf__m">'+esc(field.description||field.label||"")+'</p>';
    var id="mf"+index,a=' id="'+id+'"'+(field.required?' aria-required="true"':'')+(field.description?' aria-describedby="'+id+'d"':''),label=esc(field.label||field.name)+(field.required?' *':''),description=field.description?'<small id="'+id+'d">'+esc(field.description)+'</small>':'';
    if(field.type==="checkbox")return '<div class="mf__f"><label class="mf__c"><input type="checkbox"'+a+(field.defaultValue?' checked':'')+'> '+label+'</label>'+description+'</div>';
    var control=(field.type==="dropdown"||field.type==="multiselect")?'<select'+a+(field.type==="multiselect"?' multiple':'')+'><option value="">'+ui('اختر…','Select…')+'</option>'+(field.options||[]).map(function(option,j){return '<option value="'+j+'"'+((field.type==='multiselect'?Array.isArray(field.defaultValue)&&field.defaultValue.includes(option.value):field.defaultValue===option.value)?' selected':'')+'>'+esc(option.label)+'</option>';}).join("")+'</select>':field.type==="textarea"?'<textarea rows="3"'+a+'></textarea>':'<input type="'+(field.type==="password"?'password':field.type==="number"?'number':'text')+'" autocomplete="off" dir="ltr"'+a+' value="'+esc(field.defaultValue==null?'':field.defaultValue)+'">';
    return '<div class="mf__f"><label for="'+id+'">'+label+'</label>'+control+description+'</div>';
  }
  function rcRender(focusTabs){
    var method=rc.methods[rc.index],off=method.available===false,html="";
    if(rc.methods.length>1)html+='<div class="mf__seg" role="group" aria-label="'+ui('طريقة الربط','Connection method')+'">'+rc.methods.map(function(item,index){return '<button type="button" class="lnk'+(index===rc.index?' lnk--fill':'')+'" data-method="'+index+'" aria-pressed="'+(index===rc.index)+'">'+esc(item.displayName||item.type)+'</button>';}).join("")+'</div>';
    if(method.description)html+='<p class="mf__m">'+esc(method.description)+'</p>'; if(off)html+='<p class="mf__e">'+esc(method.message||ui("طريقة الربط غير متاحة حاليًا.","This connection method is currently unavailable."))+'</p>';else html+=(method.fields||[]).map(rcField).join("");
    html+='<p class="mf__e" id="mE" role="alert" hidden></p><div class="mbox__a"><button type="submit" class="lnk lnk--fill" id="mOk"'+(off?' disabled':'')+'>'+(method.type==="OAUTH2"?ui('سجّل الدخول عبر ','Sign in with ')+esc(rc.tool.n):ui('احفظ الاتصال','Save connection'))+'</button></div>';rcBox('<form novalidate>'+html+'</form>');
    var focus=focusTabs?$("[data-method=\""+rc.index+"\"]",$("#mF")):$("[id^=mf]",$("#mF"));if(focus)focus.focus();
  }
  async function workspaceAuthorizationStatus(){
    var abort=new AbortController(),timeout=setTimeout(function(){abort.abort();},12000),response;
    try{response=await fetch("/siyadah-api/v1/mcp/status",{method:"GET",credentials:"include",signal:abort.signal});}finally{clearTimeout(timeout);}
    if(!response.ok)throw new Error(ui("تعذّر التحقق من تفويض مساحة الشركة.","Could not check workspace authorization."));
    var data=await response.json();
    if(!data||data.ok!==true||!["authorization_required","authorization_stored","project_required"].includes(data.state))throw new Error(ui("لم تصل حالة تفويض مؤكدة.","Workspace authorization status is unverified."));
    return data;
  }
  function workspaceAuthorizationControl(required){
    return '<p class="mf__m">'+(required?ui('تحتاج مساحة الشركة موافقة لاستخدام أدواتها. ربط حساب الأداة خطوة منفصلة.','Your workspace needs authorization to use its tools. Connecting an app account is a separate step.'):ui('تفويض مساحة الشركة محفوظ؛ جاهزية الأدوات تحتاج تحققًا عند الاستخدام.','Workspace authorization is saved; tool readiness needs verification when used.'))+'</p><button type="button" class="lnk" data-workspace-connect>'+ui(required?'اسمح باستخدام أدوات الشركة':'أعد تفويض مساحة الشركة',required?'Authorize workspace tools':'Authorize workspace again')+'</button>';
  }
  async function authorizeWorkspace(){
    if(!rc)return;var tool=rc.tool,button=$("[data-workspace-connect]",$("#mF"));
    var popup=window.open("about:blank","siyadah_workspace_oauth","width=520,height=680");
    if(!popup){rcBox('<p class="mf__e" role="alert">'+ui('اسمح بالنوافذ المنبثقة، ثم أعد المحاولة.','Allow pop-ups and try again.')+'</p>'+workspaceAuthorizationControl(true));return;}
    if(button)button.disabled=true;var stopped=false,pollTimer,expiryTimer;
    var stop=function(){stopped=true;clearTimeout(pollTimer);clearTimeout(expiryTimer);try{popup.close();}catch(ignore){}if(oauthOff===stop)oauthOff=null;};
    if(oauthOff)oauthOff();oauthOff=stop;
    function failed(message){stop();if(rc&&rc.tool===tool)rcBox('<p class="mf__e" role="alert">'+esc(message)+'</p>'+workspaceAuthorizationControl(true));}
    expiryTimer=setTimeout(function(){failed(ui('انتهت مهلة الموافقة. أعد المحاولة عند الاستعداد.','Authorization timed out. Try again when ready.'));},10*60*1000);
    try{
      var started=await siyPost("/siyadah-api/v1/mcp/connect",{});
      if(stopped||!rc||rc.tool!==tool)return;
      if(started.state!=="authorization_required"||! /^[a-f0-9]{64}$/.test(started.authorizationRevision||""))throw new Error(ui("لم تبدأ محاولة موافقة جديدة.","A new authorization attempt was not started."));
      var destination=new URL(started.authorizationUrl);if(destination.protocol!=="https:")throw new Error(ui('صفحة الموافقة غير صالحة.','The authorization page is invalid.'));
      popup.location.replace(destination.toString());
      rcBox('<p class="mf__m" role="status">'+ui('أكمل الموافقة في النافذة المنبثقة باستخدام بريد حسابك في سيادة، واختر مشروع شركتك. لم نتأكد من جاهزية الأدوات بعد.','Complete authorization in the pop-up using your Siyadah account email and select your company workspace. Tool readiness is not verified yet.')+'</p>');
      async function poll(){
        if(stopped)return;
        if(popup.closed){failed(ui('أُغلقت نافذة الموافقة؛ لم يتم تأكيد حفظ التفويض.','The pop-up closed; saved authorization was not confirmed.'));return;}
        try{
          var status=await workspaceAuthorizationStatus();
          if(stopped||!rc||rc.tool!==tool)return;
          if(status.state==="authorization_stored"&&status.grantRevision===started.authorizationRevision){stop();await realConnect(tool);return;}
          pollTimer=setTimeout(poll,2000);
        }catch(error){failed(error.message);}
      }
      pollTimer=setTimeout(poll,2000);
    }catch(error){failed(error.message||ui('لم تكتمل الموافقة. أعد المحاولة.','Authorization did not complete. Try again.'));}
  }
  async function realConnect(tool){
    rc={tool:tool,methods:[],index:0};rcBox('<p class="mf__m">'+ui('أجهّز طرق الربط الآمنة…','Preparing secure connection methods…')+'</p>');
    var authorizationStored=false;
    try{
      var status=await workspaceAuthorizationStatus();if(!rc||rc.tool!==tool)return;
      authorizationStored=status.state==="authorization_stored";
      if(!authorizationStored){rcBox(workspaceAuthorizationControl(true));return;}
      var data=await integration({op:"methods",piece:tool.s});if(!rc||rc.tool!==tool)return;if(data.noAuth){rcBox('<p class="mf__m">'+ui('هذه الأداة لا تحتاج حسابًا أو مفتاحًا. تصبح جاهزة عند استخدامها داخل مهمة.','This tool needs no account or key. It becomes available when used in a task.')+'</p>'+workspaceAuthorizationControl(false));return;}rc.methods=data.methods||[];if(!rc.methods.length)throw new Error(ui("لا توجد طريقة ربط لهذه الأداة.","No connection method is available for this tool."));rcRender();$("#mF form").insertAdjacentHTML("beforeend",workspaceAuthorizationControl(false));
    }catch(error){if(rc&&rc.tool===tool)rcBox('<p class="mf__e" role="alert">'+esc(error.message||ui("تعذّر تجهيز الربط.","Could not prepare the connection."))+'</p>'+(authorizationStored?workspaceAuthorizationControl(false):''));}
  }
  function rcValues(method){var values={};for(var i=0;i<(method.fields||[]).length;i++){var field=method.fields[i];if(field.type==="markdown")continue;var el=$("#mf"+i),value=field.type==="multiselect"?Array.from(el.selectedOptions).filter(function(option){return option.value!=="";}).map(function(option){return field.options[+option.value].value;}):field.type==="checkbox"?el.checked:field.type==="dropdown"?(el.value===""?"":field.options[+el.value].value):field.type==="number"?(el.value===""?"":Number(el.value)):el.value.trim();if(field.required&&(value===""||value==null||Array.isArray(value)&&!value.length)){rcMsg(ui("أكمل «","Complete “")+(field.label||field.name)+ui("» أولًا.","” first."));el.focus();return null;}if(value!=="")values[field.name]=value;}return values;}
  async function rcPost(payload){var tool=rc.tool,button=$("#mOk");button.disabled=true;rcMsg("");try{var data=await integration(payload);tool.connection=data.connection;tool.on=data.connection.status==='ACTIVE';tool.by=usersOf(tool.s);tool.sug="";rc=null;closeModal();toolsCount();renderThread();if(tool.on)siyResumePendingActivation();}catch(error){button=$("#mOk");if(button)button.disabled=false;rcMsg(error.message||ui("تعذّر الربط. راجع البيانات وحاول مرة ثانية.","Could not connect. Check the details and try again."));}}
  function oauthResult(data){if(data&&typeof data==="object"&&data.data)data=data.data;if(data&&typeof data==="object"&&data.code)return {code:String(data.code),state:String(data.state||"")};if(data&&typeof data==="object")data=data.url;var code=typeof data==="string"&&/[?&#]code=([^&#]+)/.exec(data),state=typeof data==="string"&&/[?&#]state=([^&#]+)/.exec(data);return {code:code?decodeURIComponent(code[1].replace(/\+/g," ")):"",state:state?decodeURIComponent(state[1].replace(/\+/g," ")):""};}
  async function rcOAuth(values){
    var tool=rc.tool,button=$("#mOk"),popup=window.open("about:blank","siyadah_oauth","width=520,height=680");
    if(!popup){rcMsg(ui("المتصفح منع نافذة الدخول. اسمح بها وحاول مرة ثانية.","Your browser blocked the sign-in window. Allow pop-ups and try again."));return;}
    button.disabled=true;rcMsg(ui("أجهّز صفحة الدخول…","Preparing sign-in…"));
    try{
      var started=await integration({op:"oauth_start",piece:tool.s,methodId:rc.methods[rc.index].id,methodFingerprint:rc.methods[rc.index].fingerprint,values:values});
      if(popup.closed)throw new Error(ui("أغلقت نافذة الدخول. أعد المحاولة.","The sign-in window was closed. Try again."));
      if(oauthOff)oauthOff();
      var timer=setTimeout(function(){if(oauthOff)oauthOff();try{popup.close();}catch(ignore){}button=$("#mOk");if(button)button.disabled=false;rcMsg(ui("استغرقت العملية وقتًا طويلًا. أعد المحاولة.","This is taking too long. Try again."));},10*60*1000);
      async function on(event){
        if(event.origin!==started.allowedOrigin||event.source!==popup)return;
        if(started.provider==="cloud"){
          var posted=oauthResult(event.data);
          if(!posted.code)return;
          oauthOff();try{popup.close();}catch(ignore){}
          try{var finished=await integration({op:"oauth_finish",attempt:started.attempt,code:decodeURIComponent(posted.code)});await realTools();if(!window.__SIY_TOOLS_ERROR__&&tool.connection?.id===finished.connection?.id&&tool.connection.status==='ACTIVE'){rc=null;closeModal();renderThread();siyResumePendingActivation();return;}}catch(error){rcMsg(error.message||ui("لم يكتمل الربط. حاول مرة ثانية.","The connection could not be completed. Try again."));}
          button=$("#mOk");if(button)button.disabled=false;return;
        }
        if(event.data?.type!=="siyadah-oauth-result")return;
        oauthOff();try{popup.close();}catch(ignore){}
        if(event.data.connectionId){await realTools();if(!window.__SIY_TOOLS_ERROR__&&tool.connection?.id===event.data.connectionId&&tool.connection.status==='ACTIVE'){rc=null;closeModal();renderThread();siyResumePendingActivation();return;}}
        button=$("#mOk");if(button)button.disabled=false;rcMsg(ui("لم يثبت حفظ الاتصال في مشروع شركتك. أعد المحاولة أو تواصل معنا.","The connection was not saved in your company's project. Try again or contact us."));
      }
      window.addEventListener("message",on);
      oauthOff=function(){clearTimeout(timer);window.removeEventListener("message",on);oauthOff=null;};
      popup.location.replace(started.authorizationUrl);
      rcMsg(ui("أكمل تسجيل الدخول في النافذة المنبثقة…","Complete sign-in in the pop-up window…"));
    }catch(error){try{popup.close();}catch(ignore){}button=$("#mOk");if(button)button.disabled=false;rcMsg(error.message||ui("تعذّر بدء تسجيل الدخول.","Could not start sign-in."));}
  }
  $("#mF").addEventListener("click",async function(event){
    if(event.target.closest("[data-workspace-connect]")){event.preventDefault();authorizeWorkspace();return;}
    var method=event.target.closest("[data-method]");if(method&&rc){rc.index=+method.dataset.method;rcRender(true);return;}
    var reconnect=event.target.closest("[data-reconnect]");if(reconnect&&picked?.s==='gmail'&&picked.connection){realConnect(picked);return;}
    var test=event.target.closest("[data-revalidate]"),disconnect=event.target.closest("[data-disconnect]");if(!picked||!picked.connection||(!test&&!disconnect))return;event.target.disabled=true;rcMsg("");try{if(test){var data=await integration({op:"revalidate",connection_id:picked.connection.id});picked.connection=data.connection;picked.on=data.connection.status==='ACTIVE';$("#mD").textContent=(data.connection.status==='ERROR'?ui("الاتصال فيه خطأ","Connection needs attention"):ui("تم التحقق من بيانات الربط؛ نتيجة الاستخدام تحتاج مهمة فعلية","Connection details verified. A real task is needed to verify the outcome"))+ui(" · يستخدمها: "," · Used by: ")+usersOf(picked.s);event.target.disabled=false;}else{await integration({op:"disconnect",connection_id:picked.connection.id});picked.connection=null;picked.on=false;closeModal();toolsCount();renderThread();}}catch(error){event.target.disabled=false;rcMsg(error.message||ui("لم يتم تأكيد العملية.","The action could not be confirmed."));}
  });
  $("#mF").addEventListener("submit",function(event){event.preventDefault();var method=rc&&rc.methods[rc.index],values=method&&rcValues(method);if(!method||values===null)return;if(method.type==="OAUTH2")rcOAuth(values);else rcPost({op:"connect",piece:rc.tool.s,type:method.type,methodId:method.id,methodFingerprint:method.fingerprint,values:values});});
  function openTools(){ allOpen=false; tshown=24; go("tools"); }
  $("#toolsLink").addEventListener("click",openTools);

  /* ---------- قائمة الحساب ---------- */
  var pop=$("#pop");
  $("#meBtn").addEventListener("click",function(e){ e.stopPropagation(); pop.classList.toggle("on"); if(pop.classList.contains("on")) siyRefreshBuilderConnection(); });
  var builderConnectBtn=$("#builderConnectBtn");
  if(builderConnectBtn) builderConnectBtn.addEventListener("click",function(){ pop.classList.remove("on"); openTools(); });
  var lo=$("#logoutBtn"); if(lo) lo.addEventListener("click",function(){
    if(lo.disabled)return;lo.disabled=true;lo.setAttribute("aria-busy","true");$("#logoutStatus").textContent="";
    fetch((window.SIYADAH_AUTH_BASE||"/siyadah-api")+"/v1/auth/logout",{method:"POST",credentials:"include"})
      .then(function(response){if(!response.ok)throw new Error("logout_failed");siyStopPolling();location.replace("../auth.html");})
      .catch(function(){lo.disabled=false;lo.removeAttribute("aria-busy");$("#logoutStatus").textContent=ui("تعذّر تسجيل الخروج. حاول مرة أخرى.","Could not sign out. Try again.");pop.classList.add("on");});
  });
  document.addEventListener("click",function(e){ pop.classList.remove("on");
    if(palOpen&&!e.target.closest("#hq,#pal")) closePal();
    var b=e.target.closest("[data-open]"); if(!b) return; if(b.dataset.open==="tools") openTools(); else openSheet(b.dataset.open); });

  /* ---------- ⌘K — لوحة أوامر صغيرة تحت حقل البحث ---------- */
  var palOpen=false, palIdx=0, palItems=[];
  function palList(){
    var q=($("#hq").value||"").trim().toLowerCase();
    var base=[{l:"محادثة جديدة",s:"⌘ ⇧ O",run:newChat}]
      .concat(EMPS.map(function(e){ return {l:e.n,s:e.r,run:function(){ go(e.id); $("#input").focus(); }}; }))
      .concat([{l:"الأدوات",s:"/",run:openTools},{l:"الإعدادات",s:"",run:function(){ openSheet("settings"); }},{l:"الخطة",s:"الاستخدام والفواتير",run:function(){ openSheet("plan"); }}]);
    var hist=Object.keys(CHATS).map(function(id){ var c=CHATS[id]; return {l:c.t,s:"محادثة",run:function(){ if(c.emp){ go(c.emp,window.__SIY_REAL__?id:null); } else go("siyadah",id); }}; });
    var hit=function(x){ return !q||(x.l+" "+x.s).toLowerCase().indexOf(q)>-1; };
    return base.filter(hit).concat(hist.filter(hit)).slice(0,10);
  }
  function renderPal(){
    palItems=palList(); if(palIdx>=palItems.length) palIdx=0;
    var p=$("#pal");
    p.innerHTML=palItems.length?palItems.map(function(x,i){ return '<button type="button" class="pal__o" data-i="'+i+'" tabindex="-1" aria-current="'+(i===palIdx)+'"><span>'+x.l+'</span><small>'+x.s+'</small></button>'; }).join(""):'<div class="pal__none">'+ui('ما فيه شيء بهذا الاسم.','No matches found.')+'</div>';
  }
  function openPal(){ palOpen=true; palIdx=0; $("#pal").hidden=false; renderPal(); filterHist(); }
  function closePal(){ if(!palOpen) return; palOpen=false; $("#pal").hidden=true; filterHist(); }
  function runPal(i){ var x=palItems[i]; if(!x) return; closePal(); $("#hq").value=""; filterHist(); if(mobile()) setDrawer(false); x.run(); }
  $("#pal").addEventListener("mousedown",function(e){ e.preventDefault(); }); /* يبقي التركيز في حقل البحث */
  $("#pal").addEventListener("click",function(e){ var b=e.target.closest(".pal__o"); if(b) runPal(+b.dataset.i); });
  $("#pal").addEventListener("mousemove",function(e){ var b=e.target.closest(".pal__o"); if(!b) return; var i=+b.dataset.i; if(i!==palIdx){ palIdx=i; renderPal(); } });
  $("#hq").addEventListener("keydown",function(e){
    if(!palOpen){ if(e.key==="ArrowDown"&&this.value.trim()){ e.preventDefault(); openPal(); } return; }
    if(e.key==="ArrowDown"){ e.preventDefault(); palIdx=(palIdx+1)%Math.max(1,palItems.length); renderPal(); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); palIdx=(palIdx-1+Math.max(1,palItems.length))%Math.max(1,palItems.length); renderPal(); }
    else if(e.key==="Enter"){ e.preventDefault(); runPal(palIdx); }
    else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closePal(); }
  });
  $("#hq").addEventListener("blur",function(){ setTimeout(function(){ if(palOpen&&!$("#pal").contains(document.activeElement)&&document.activeElement!==$("#hq")) closePal(); },120); });

  /* ---------- اللوحة: الإعدادات + الخطة ---------- */
  var sheet=$("#sheet"), sheetOpener=null;
  function openSheet(pane){
    $$(".sheet__h .tab").forEach(function(t){ t.setAttribute("aria-current", t.dataset.pane===pane ? "true" : "false"); });
    $$(".sheet .pane").forEach(function(p){ p.classList.toggle("on", p.id==="pane-"+pane); });
    if(!sheet.classList.contains("on")) sheetOpener=document.activeElement;
    sheet.classList.add("on"); $("#sheetX").focus();
  }
  function closeSheet(){ if(!sheet.classList.contains("on")) return; sheet.classList.remove("on"); var back=(sheetOpener&&document.contains(sheetOpener)&&sheetOpener.offsetParent!==null)?sheetOpener:$("#meBtn"); if(back) back.focus(); sheetOpener=null; }
  $(".sheet__h").addEventListener("click",function(e){ var t=e.target.closest(".tab"); if(t) openSheet(t.dataset.pane); });
  $("#sheetX").addEventListener("click",closeSheet);
  sheet.addEventListener("click",function(e){ if(e.target===sheet) closeSheet(); });
  sheet.addEventListener("keydown",function(e){ trapTab(e,sheet); });
  sheet.addEventListener("click",function(e){ var b=e.target.closest(".swm"); if(!b) return; if(window.__SIY_REAL__){ siyUnsupported(); return; } var v=b.getAttribute("aria-checked")!=="true"; b.setAttribute("aria-checked",String(v)); if(b.id==="autoSw") PLAN.autoReload=v; });

  /* الذاكرة في الإعدادات: «إدارة» تفتح القائمة داخل الصف نفسه، وكل سطر يُحذف بـ × */
  function siyKnowledgeTime(value){
    var date=new Date(value);return value&&Number.isFinite(date.getTime())?esc(date.toLocaleString(locale==='en'?'en-US':'ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'medium',timeStyle:'short'})):ui('وقت غير محدد','Time unavailable');
  }
  function renderMem(){
    var el=$("#memList"); if(!el) return;
    if(window.__SIY_REAL__){
      var knowledge=window.__SIY_DASH__&&window.__SIY_DASH__.owned_knowledge;
      if(!knowledge){el.innerHTML='<p>'+ui('لم تصل المعرفة المحفوظة بعد.','Saved knowledge is not available yet.')+'</p>';return;}
      var facts=knowledge.facts;
      el.innerHTML='<p>'+ui('المعرفة المحفوظة','Saved knowledge')+' · '+(knowledge.coverage==='partial'?ui('تغطية جزئية','Partial coverage'):ui('تغطية جيدة','Good coverage'))+(Number.isFinite(knowledge.coverageScore)?' '+knowledge.coverageScore+ui('٪','%'):'')+(knowledge.knowledgeVersion?ui(' · الإصدار ',' · version ')+knowledge.knowledgeVersion:'')+'</p>'+
        (knowledge.lastSuccessAt?'<p class="msrc">'+ui('آخر تحديث ناجح: ','Last successful update: ')+siyKnowledgeTime(knowledge.lastSuccessAt)+'</p>':'')+
        (knowledge.lastError?'<p class="msrc">'+ui('تعذّر آخر تحديث؛ المعروض آخر معلومات محفوظة.','The latest update failed. Showing the last saved knowledge.')+'</p>':'')+
        (facts.length?'<ul class="mem">'+facts.map(function(f){
          var source=(locale==='en'?{user:'Your messages',company_website:'Company website',external:'External source'}:{user:'من رسائلك',company_website:'موقع الشركة',external:'مصدر خارجي'})[f.sourceKind]||ui('مصدر غير محدد','Source unknown');
          var certainty=(locale==='en'?{user_confirmed:'Confirmed by you',observed:'Observed',uncertain:'Uncertain'}:{user_confirmed:'أكدها المستخدم',observed:'معلومة مرصودة',uncertain:'غير مؤكدة'})[f.certainty]||ui('درجة التأكد غير محددة','Confidence unknown');
          var topics={pricing:'الأسعار والتكاليف',price:'السعر',services:'الخدمات',service:'الخدمة',products:'المنتجات',product:'المنتج',availability:'التوفر',contact:'التواصل',contacts:'التواصل',company:'الشركة',company_profile:'تعريف الشركة',profile:'تعريف الشركة',constraints:'القيود',policy:'السياسات',policies:'السياسات',faq:'الأسئلة الشائعة',faqs:'الأسئلة الشائعة'};
          var topicsEn={pricing:'Pricing and costs',price:'Price',services:'Services',service:'Service',products:'Products',product:'Product',availability:'Availability',contact:'Contact',contacts:'Contact',company:'Company',company_profile:'Company profile',profile:'Company profile',constraints:'Constraints',policy:'Policies',policies:'Policies',faq:'FAQ',faqs:'FAQ'};
          var topic=Object.prototype.hasOwnProperty.call(topics,f.topic)?(locale==='en'?topicsEn[f.topic]:topics[f.topic]):(/[\u0600-\u06ff]/.test(f.topic||'')?f.topic:ui('معلومة عن الشركة','Company information'));
          var value=typeof f.evidenceQuote==='string'&&f.evidenceQuote.trim()?f.evidenceQuote:(typeof f.value==='string'?f.value:JSON.stringify(f.value));
          return '<li><b>'+esc(topic)+':</b><span class="v">'+esc(value)+'</span>'+
            '<span class="msrc">'+source+(f.sourceUrl?' · '+esc(f.sourceUrl):'')+' · '+certainty+' · '+siyKnowledgeTime(f.observedAt)+'</span><button type="button" class="lnk" data-kedit="'+knowledge.facts.indexOf(f)+'">'+ui('صحّح','Correct')+'</button></li>';
        }).join('')+'</ul>':'<p>'+ui('لا توجد حقائق محفوظة بعد.','No saved facts yet.')+'</p>')+
        '<div class="acts"><button type="button" class="lnk" id="kbAdd">'+ui('أضف معلومة','Add information')+'</button></div><div id="kbEdit" hidden style="margin-top:10px"><label>'+ui('نوع المعلومة','Information type')+'<select class="ctrl" id="kbTopic"><option value="company_profile">'+ui('عن الشركة','About the company')+'</option><option value="services">'+ui('الخدمات','Services')+'</option><option value="products">'+ui('المنتجات','Products')+'</option><option value="target_customers">'+ui('العملاء المستهدفون','Target customers')+'</option><option value="pricing">'+ui('الأسعار','Pricing')+'</option><option value="faq">'+ui('الأسئلة الشائعة','FAQ')+'</option><option value="policies">'+ui('السياسات','Policies')+'</option><option value="contact">'+ui('التواصل','Contact')+'</option><option value="brand">'+ui('صوت الشركة','Brand voice')+'</option></select></label><label>'+ui('المعلومة','Information')+'<textarea class="ctrl" id="kbValue" rows="3" maxlength="1200"></textarea></label><div class="acts"><button type="button" class="lnk lnk--fill" id="kbSave">'+ui('احفظ','Save')+'</button><button type="button" class="lnk" id="kbCancel">'+ui('إلغاء','Cancel')+'</button></div><p class="msrc" id="kbStatus" role="status"></p></div>';
      return;
    }
    el.innerHTML=MEM.length?'<ul class="mem">'+MEM.map(function(m,i){
      return '<li><b>'+esc(m.k)+':</b><span class="v">'+esc(m.v)+'</span><span class="msrc">'+esc(m.src)+'</span>'+
        '<button type="button" class="mx" data-mdel="'+i+'" aria-label="احذف: '+esc(m.k)+'">×</button></li>';
    }).join("")+'</ul>':'<p style="font-size:.85rem;color:var(--ash);margin:10px 0 0">الذاكرة فاضية.</p>';
  }
  sheet.addEventListener("click",function(e){
    if(window.__SIY_REAL__&&e.target.closest("#hireFromPlan")){ closeSheet(); newChat(); $("#input").placeholder="صف مهمة الموظف الذي تريد إنشاءه…"; return; }
    if(window.__SIY_REAL__&&e.target.closest("#settingsSave")){ siySaveSettings();return; }
    var exportButton=e.target.closest("#exportBtn"); if(exportButton){ if(window.__SIY_REAL__) siyExportCustomer(exportButton); else siyUnsupported(); return; }
    var tg=e.target.closest("#memTgl");
    if(tg){ var L=$("#memList"); L.hidden=!L.hidden; tg.setAttribute("aria-expanded",String(!L.hidden)); if(!L.hidden) renderMem(); return; }
    var dx=e.target.closest("[data-mdel]");
    if(dx&&window.__SIY_REAL__){ siyUnsupported(); return; }
    if(dx){ MEM.splice(+dx.dataset.mdel,1); renderMem(); return; }
    var add=e.target.closest("#kbAdd"),edit=e.target.closest("[data-kedit]");
    if(window.__SIY_REAL__&&(add||edit)){
      var form=$("#kbEdit"),knowledge=window.__SIY_DASH__&&window.__SIY_DASH__.owned_knowledge,fact=edit&&knowledge&&knowledge.facts[Number(edit.dataset.kedit)];
      var select=$("#kbTopic"),hasTopic=fact&&Array.prototype.some.call(select.options,function(option){return option.value===fact.topic;});
      form.hidden=false;form.dataset.key=fact&&fact.key||"";select.value=hasTopic?fact.topic:"company_profile";$("#kbValue").value=fact?(typeof fact.value==='string'?fact.value:JSON.stringify(fact.value)):"";$("#kbStatus").textContent="";$("#kbValue").focus();return;
    }
    if(e.target.closest("#kbCancel")){ $("#kbEdit").hidden=true;return; }
    if(window.__SIY_REAL__&&e.target.closest("#kbSave")){ siySaveKnowledge();return; }
    var sb=e.target.closest("[data-sub]");
    if(sb){ sb.textContent="قريبًا — الاشتراك المبكر"; sb.disabled=true;
      var note=sb.parentNode.querySelector(".sub-note"); if(!note){ note=document.createElement("small"); note.className="sub-note"; note.style.cssText="display:block;margin-top:6px;color:var(--ash)"; note.textContent="الدفع (مدى/فيزا) قيد التفعيل — تواصل معنا للترقية في الوصول المبكر."; sb.parentNode.appendChild(note); } }
  });

  /* الخطة والاستخدام — كل شيء من PLAN + PRICING */
  function srow(l,body){ return '<div class="srow"><div>'+l+'</div><div>'+body+'</div></div>'; }
  function renderPlan(){
    if(window.__SIY_REAL__){
      var loaded=Boolean(window.__SIY_DASH__)&&!window.__SIY_LOAD_ERROR__;
      var team=loaded?EMPS.map(function(e){return '<p>'+esc(e.n)+' · '+esc(e.r)+'<small>'+ui(e.draft?'مسودة محفوظة':e.on?'نشط في السجل':'متوقف في السجل',e.draft?'Saved draft':e.on?'Recorded as active':'Recorded as paused')+'</small></p>';}).join(''):'';
      $('#pane-plan').innerHTML=srow(ui('فريقك','Your team'),(loaded?'<div><span class="num">'+EMPS.length+'</span> '+ui('موظف مسجل','employees recorded')+'</div>'+team:'<div>'+ui('تعذّر تحميل الفريق؛ أعد تحميل الصفحة.','Could not load your team. Reload the page.')+'</div>')+'<div class="acts"><button type="button" class="lnk" id="hireFromPlan">'+ui('وظّف موظفًا','Create employee')+'</button></div>')+
        srow(ui('الفوترة','Billing'),'<small>'+ui('بيانات الاشتراك والاستخدام غير متاحة.','Subscription and usage data unavailable.')+'</small>');
      $('#setPlanSum').textContent=loaded?EMPS.length+' '+ui('موظف مسجل','employees recorded'):ui('الفريق غير متاح','Team unavailable');
      $('#pban').hidden=true; $('#mePill').hidden=true;
      return;
    }
    var p=PLAN, st=p.state, C=PRICING.credits, usedN=st==="over"?Math.max(p.actions.used,p.actions.limit):p.actions.used, pct=Math.min(100,Math.round(usedN/p.actions.limit*100));
    var used='<span class="num">'+fmt(usedN)+' / '+fmt(p.actions.limit)+'</span> إجراء';
    var h='';
    if(st==="trial") h+=srow('الخطة','<div>تجربة · تنتهي خلال <span class="num">'+p.days+'</span> أيام · '+used+'</div><div class="acts"><button type="button" class="lnk lnk--fill" data-sub="1">اختر خطتك</button></div>');
    else h+=srow('الخطة','<div><span class="price">'+p.name+' · <span class="num">'+p.price+'</span> ر.س / شهر <s class="num">'+p.list+'</s></span><span class="tag">الوصول المبكر</span></div>'+
      '<div class="acts"><button type="button" class="lnk">إدارة الاشتراك</button>'+
      (st==="pastdue"?'<small>المستحق <span class="num">'+p.due+'</span> ر.س</small><button type="button" class="lnk lnk--fill">أعد المحاولة</button>':'<small>يتجدد '+p.renews+'</small>')+'</div>');
    h+=srow('الاستخدام','<div class="use'+(st==="near"?' use--warn':(st==="over"?' use--bad':''))+'" role="progressbar" aria-label="الإجراءات المستخدمة" aria-valuemin="0" aria-valuemax="'+p.actions.limit+'" aria-valuenow="'+usedN+'"><i style="width:'+pct+'%"></i></div>'+
      '<small>'+used+' · '+(st==="over"?'نفد رصيد الشهر · ':'')+(st==="trial"?'تنتهي التجربة خلال ':'يتجدد خلال ')+'<span class="num">'+p.days+'</span> أيام</small>'+
      '<div class="acts"><span class="swl"><button type="button" class="swm" id="autoSw" role="switch" aria-checked="'+p.autoReload+'" aria-label="تعبئة تلقائية"></button>تعبئة تلقائية عند النفاد</span></div>');
    h+=srow('الرصيد المسبق','<div>الرصيد المسبق: <span class="num">'+p.credit.sar+'</span> ر.س (<span class="num">'+p.credit.actions+'</span> إجراء)</div>'+
      '<div class="acts"><button type="button" class="lnk'+(st==="over"?' lnk--fill':'')+'">أضف رصيدًا</button><small><span class="num">'+C.price+'</span> ر.س = <span class="num">'+C.actions+'</span> إجراء</small></div>');
    h+=srow('الموظفون','<span class="num">'+p.employees.used+' / '+p.employees.limit+'</span><div class="acts"><button type="button" class="lnk">وظّف موظفًا</button></div>');
    if(st!=="trial"){
      h+=srow('الفواتير','<ul class="inv">'+p.invoices.map(function(i){return '<li><span>'+i.m+'</span><small><span class="num">'+i.total+'</span> ر.س شامل الضريبة</small><a href="'+i.url+'">PDF</a></li>'}).join("")+'</ul>');
      h+=srow('الدفع','<div>'+p.payment+' <button type="button" class="lnk" style="margin-inline-start:8px">تغيير</button></div>'+
        '<div class="acts"><small>الرقم الضريبي <span class="num">'+p.vat+'</span> · السجل التجاري <span class="num">'+p.cr+'</span></small><button type="button" class="lnk">تعديل</button></div>');
    }
    $("#pane-plan").innerHTML=h;
    $("#setPlanSum").textContent=(st==="trial"?"تجربة":p.name)+" · "+fmt(usedN)+" / "+fmt(p.actions.limit)+" إجراء";
    /* اللافتة فوق المحادثة + الشارة في صف الحساب */
    var b=$("#pban");
    if(st==="over"){ b.hidden=false; b.className="pban"; b.innerHTML='<span>نفد رصيد الشهر — توقف التنفيذ حتى التجديد أو إضافة رصيد.</span><button type="button" class="lnk" data-open="plan">أضف رصيدًا</button>'; }
    else if(st==="pastdue"){ b.hidden=false; b.className="pban pban--bad"; b.innerHTML='<span>فشل الدفع · المستحق <span class="num">'+p.due+'</span> ر.س · 7 أيام قبل الإيقاف.</span><button type="button" class="lnk" data-open="plan">أعد المحاولة</button>'; }
    else b.hidden=true;
    var pill=$("#mePill"); pill.hidden=st!=="near"; pill.textContent=pct+"% من الإجراءات";
  }
  window.renderPlan=renderPlan; /* للنموذج: غيّر PLAN.state ثم renderPlan() */

  /* ---------- لوحة المفاتيح ---------- */
  document.addEventListener("keydown",function(e){
    var tag=document.activeElement.tagName, typing=tag==="INPUT"||tag==="TEXTAREA", mod=e.metaKey||e.ctrlKey, k=e.key.toLowerCase();
    if(e.key==="Escape"){ closeSheet(); pop.classList.remove("on"); closePal(); if($("#modal").classList.contains("on")) closeModal();
      if($("#app").classList.contains("open")&&mobile()){ $("#app").classList.remove("open"); $("#openSide").setAttribute("aria-expanded","false"); $("#openSide").focus(); } return; }
    if(mod&&k==="k"){ e.preventDefault(); $("#app").classList.remove("closed"); if(mobile()) setDrawer(true); $("#hq").focus(); $("#hq").select(); openPal(); return; }
    if(mod&&e.shiftKey&&k==="o"){ e.preventDefault(); closeSheet(); newChat(); return; }
    if(e.key==="/"&&!typing&&!mod){ e.preventDefault(); openTools(); setTimeout(function(){ var q=$("#tq"); if(q) q.focus(); },30); }
  });

  /* نطاق الشركة يأتي من جلسة HttpOnly على الخادم فقط. */
  var SIY_GATEWAY=window.SIYADAH_CHAT_GATEWAY||"/siyadah-api/v1/chat",SIY_ONBOARDING="/siyadah-api/v1/onboarding";
  var siyPolls={}, siyGeneration=0, siyEmployeeStatePending={};
  function siyBuilderState(text,connected){ var node=$("#builderConnectState"); if(!node) return; node.textContent=text==='مساحة شركتك'?ui('مساحة شركتك','Your workspace'):text; node.classList.toggle("apstate--ok",connected===true); }
  function siyRefreshBuilderConnection(){
    siyBuilderState("مساحة شركتك",true);
  }
  function siyStopPolling(){ siyGeneration++;siyActivationResumeBusy=false;siyActivationResumeNotice=null; Object.keys(siyPolls).forEach(function(k){ clearTimeout(siyPolls[k]); }); siyPolls={}; }
  function siyAccessError(text){var e=new Error(text);e.noRetry=true;return e;}
  async function siyPost(url,body,timeoutMs){
    if(!/^(https:\/\/|\/)/.test(url)) throw siyAccessError(ui("اتصال سيادة لم يُجهّز بعد.","Siyadah connection is not configured yet."));
    var abort=new AbortController(), timer=setTimeout(function(){abort.abort();},timeoutMs||60000);
    try{
      var response=await fetch(url,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:abort.signal});
      if(response.status===401){location.replace("../auth.html");throw siyAccessError(ui("انتهت جلستك. سجّل الدخول من جديد.","Your session ended. Sign in again."));}
      if(response.status===403) throw siyAccessError(ui("تعذّر التحقق من صلاحية هذا الطلب لحسابك.","This request could not be authorized for your account."));
      if(!response.ok){
        if(url==="/siyadah-api/v1/integrations"&&body.op==="disconnect"&&response.status===409){
          var failure=await response.json().catch(function(){return null;});
          if(failure&&failure.error==="connection_in_use")throw new Error(ui("الاتصال مستخدم في مهمة. أوقف المهمة أو تواصل مع الدعم قبل فصله.","A task still uses this connection. Stop the task or contact support before disconnecting."));
          if(failure&&failure.error==="connection_usage_unknown")throw new Error(ui("تعذّر التأكد من المهام المرتبطة بالاتصال. بقي نشطًا؛ حاول مجددًا أو تواصل مع الدعم.","Could not verify tasks linked to this connection. It remains active; try again or contact support."));
        }
        throw new Error(ui("تعذّر الاتصال بالخادم. أعد المحاولة.","Could not reach the server. Try again."));
      }
      var data=await response.json();
      if(!data||data.ok!==true) throw new Error(ui("تعذّر إتمام الطلب. لم يتم تأكيد نجاحه.","The request was not confirmed as complete."));
      if(body.op==="work"&&!(data.request_status==="not_observed"&&data.work_status==="unknown")&&!(data.request_status==="succeeded"&&data.work_status==="not_started"&&["conversation_reply","employee_draft"].includes(data.outcome_kind))&&!["queued","running","succeeded","failed","awaiting_input","cancelled"].includes(data.work_status)) throw new Error(ui("وصلت حالة عمل غير مكتملة؛ لم نتأكد من النتيجة.","The work status is incomplete; the outcome is unverified."));
      return data;
    }catch(e){ if(e.name==="AbortError") throw new Error(ui("تأخر الرد. أعد المحاولة بنفس الطلب للتحقق من حالته.","The response timed out. Check the same request to verify its status.")); throw e; }
    finally{clearTimeout(timer);}
  }
  function siyRequest(body,timeoutMs){return siyPost(SIY_GATEWAY,body,timeoutMs);}
  async function siySaveKnowledge(){
    var form=$("#kbEdit"),button=$("#kbSave"),status=$("#kbStatus"),value=$("#kbValue").value.trim();if(!value){status.textContent=ui("اكتب المعلومة أولًا.","Enter the information first.");return;}
    button.disabled=true;status.textContent=ui("جارٍ الحفظ…","Saving…");
    try{
      await siyPost(SIY_ONBOARDING,{op:'add_knowledge',topic:$("#kbTopic").value,key:form.dataset.key||undefined,value:value});
      var data=await siyRequest({op:'hydrate'});siyMerge(data,false);renderMem();status=$("#kbStatus");if(status)status.textContent=ui("تم الحفظ في إصدار جديد.","Saved in a new version.");
    }catch(error){status.textContent=error.message||ui("تعذّر حفظ المعلومة.","Could not save the information.");}finally{button=$("#kbSave");if(button)button.disabled=false;}
  }
  function siySettingsWords(value){ return String(value||"").split(/[،,\n]/).map(function(item){return item.trim();}).filter(Boolean).slice(0,40); }
  async function siySaveSettings(){
    var button=$("#settingsSave"),status=$("#settingsStatus");if(!button||button.disabled)return;
    button.disabled=true;status.textContent=ui("جارٍ الحفظ…","Saving…");
    try{
      var data=await siyPost(SIY_ONBOARDING,{op:'update_company_settings',voice:$("#companyVoice").value,language:$("#companyLanguage").value,dialect:$("#companyDialect").value,preferredWords:siySettingsWords($("#preferredWords").value),forbiddenWords:siySettingsWords($("#forbiddenWords").value)});
      siyMerge({company_settings:{...data.settings,version:data.version}},false);status=$("#settingsStatus");if(status)status.textContent=ui("تم الحفظ · الإصدار ","Saved · version ")+data.version;
    }catch(error){status.textContent=error.message||ui("تعذّر حفظ الإعدادات.","Could not save settings.");}finally{button=$("#settingsSave");if(button)button.disabled=false;}
  }
  async function siySetEmployeeState(e){
    if(!e||typeof e.id!=="string"||!e.id||typeof e.flowId!=="string"||!e.flowId||siyEmployeeStatePending[e.id]) return;
    var id=e.id, flowId=e.flowId, status=e.on?'disabled':'active', generation=siyGeneration;
    siyEmployeeStatePending[id]=true; siyDraw();
    try{
      var data=await siyRequest({op:'employee_state',employee_id:id,status:status},210000);
      if(generation!==siyGeneration) return;
      if(data.state_verified!==true||!data.employee||data.employee.recordId!==id||data.employee.flowId!==flowId||data.employee.status!==status) throw new Error("لم يصل تأكيد مطابق لحالة الموظف.");
      siyMerge({employee:data.employee},false);
    }catch(error){
      if(generation===siyGeneration) window.alert(ui("لم نتأكد من تغيير حالة الموظف. المعروض آخر حالة مؤكدة؛ حدّث الصفحة للتحقق.","Employee status change was not verified. The last confirmed status is shown; reload to check."));
    }finally{
      delete siyEmployeeStatePending[id]; if(generation===siyGeneration) siyDraw();
    }
  }
  async function siyReadPublishedInstructions(e){
    var target=$("#publishedInstr");if(!e||!target)return;var readId=target.siyReadId=(target.siyReadId||0)+1;
    target.textContent=ui('نقرأ تعليمات طريقة العمل المنشورة…','Reading published workflow instructions…');
    try{
      var generation=siyGeneration,data=await siyRequest({op:'employee_instructions',employee_id:e.id,read_published:true}),p=data.published_instructions;
      if(generation!==siyGeneration||!target.isConnected||who!==e.id||$("#publishedInstr")!==target||target.siyReadId!==readId)return;
      if(!p||p.flow_id!==e.flowId||!['verified','not_published','unavailable'].includes(p.read_status))throw new Error();
      if(p.read_status!=='verified'){target.textContent=p.read_status==='not_published'?ui('لا توجد نسخة منشورة لطريقة العمل.','The workflow has no published version.'):ui('تعذّرت قراءة تعليمات طريقة العمل المنشورة.','Published workflow instructions could not be read.');return;}
      if(!/^[A-Za-z0-9]{21}$/.test(p.flow_id)||!/^[A-Za-z0-9]{21}$/.test(p.published_version_id)||!['ENABLED','DISABLED'].includes(p.flow_status)||!Array.isArray(p.steps)||p.steps.some(function(step){return !step||typeof step.prompt!=='string';}))throw new Error();
      var steps=p.steps.filter(function(step){return step&&typeof step.prompt==='string';});
      target.innerHTML='<b>'+ui('تعليمات طريقة العمل المنشورة','Published workflow instructions')+'</b><p>'+ui('هذه قراءة للنسخة المنشورة؛ ليست إثباتًا لنتيجة تنفيذ.','This reads the published version; it does not prove an execution result.')+(p.flow_status==='DISABLED'?ui(' طريقة العمل متوقفة.',' The workflow is disabled.'):'')+'</p>'+steps.map(function(step){return '<details class="adv"><summary>'+esc(step.display_name||step.name||step.step_name||ui('خطوة الذكاء الاصطناعي','AI step'))+'</summary><div class="prompt">'+esc(step.prompt)+'</div>'+(step.agent_instructions_unverified===true?'<p>'+ui('هذا مدخل مهمة للوكيل؛ تعليمات الوكيل المحفوظ نفسه لم تُتحقق هنا.','This is the agent’s task input; the saved agent’s own instructions are unverified here.')+'</p>':'')+'</details>';}).join('')+(steps.length?'':'<p>'+ui('لا توجد تعليمات خطوات ذكاء اصطناعي قابلة للعرض في هذه النسخة.','This version has no AI-step instructions available to display.')+'</p>')+siyRefsHtml([[ui('طريقة العمل','Workflow'),p.flow_id],[ui('النسخة المنشورة','Published version'),p.published_version_id]]);
    }catch(error){if(target.isConnected&&who===e.id&&$("#publishedInstr")===target&&target.siyReadId===readId)target.textContent=ui('تعذّرت قراءة تعليمات طريقة العمل المنشورة. أعد فتح التعليمات للمحاولة.','Published workflow instructions could not be read. Reopen instructions to retry.');}
  }
  async function siySaveEmployeeInstructions(e,instructions){
    var button=$("#instrSave"),note=$("#instrF").firstChild,previous=e.instr,generation=siyGeneration,flowId=e.flowId;
    if(button.disabled)return;
    button.disabled=true;button.textContent=ui("جارٍ الحفظ…","Saving…");note.textContent=ui("أحفظها داخل مساحة شركتك وأتحقق من القراءة…","Saving in your workspace and verifying the result…");
    try{
      var data=await siyRequest({op:'employee_instructions',employee_id:e.id,instructions:instructions});
      if(generation!==siyGeneration)return;
      if(data.instruction_scope!=='conversation'||!data.instructions_verified||!data.employee||data.employee.recordId!==e.id||data.employee.instructions!==instructions)throw new Error(ui('لم تتطابق قراءة التعليمات بعد الحفظ.','Saved instructions could not be verified.'));
      var current=emp(e.id);if(!current||current.flowId!==flowId)throw new Error(ui('تغيّر الموظف أثناء الحفظ؛ أعد التحقق من تعليماته.','The employee changed while saving; check the instructions again.'));
      current.instr=e.instr=data.employee.instructions;current.instrSource=e.instrSource=data.employee.instructionSource;current.instrVersion=e.instrVersion=data.employee.instructionVersion;e.ver+=1;note.textContent=ui("حُفظت للمحادثة · النسخة ","Saved for conversation · version ")+e.instrVersion+ui(". تطبيقها على طريقة العمل لم يُتحقق منه.",". Application to the workflow is not verified.");button.textContent=ui("تم الحفظ","Saved");
    }catch(error){e.instr=previous;note.textContent=error.message||ui("تعذّر حفظ التعليمات.","Could not save instructions.");button.textContent=ui("أعد المحاولة","Try again");}
    finally{button.disabled=false;}
  }
  async function siyExportCustomer(button){
    if(button.disabled) return;
    button.disabled=true; button.setAttribute('aria-busy','true');
    var generation=siyGeneration, url=null, link=null;
    try{
      var response=await siyRequest({op:'export'});
      if(generation!==siyGeneration) return;
      var bundle=response.export;
      if(!bundle||bundle.schemaVersion!==1||bundle.kind!=='siyadah_customer_bundle'||!bundle.company||typeof bundle.company!=='object'||Array.isArray(bundle.company)) throw new Error('لم يصل ملف عميل صالح للتنزيل.');
      var filename=typeof response.filename==='string'?response.filename:'';
      if(!/^[^\\/:*?"<>|\u0000-\u001f]{1,160}\.json$/i.test(filename)) filename='siyadah-customer.json';
      url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json;charset=utf-8'}));
      link=document.createElement('a'); link.href=url; link.download=filename; link.hidden=true; document.body.appendChild(link); link.click();
    }catch(error){ if(generation===siyGeneration) window.alert(error.message||ui('تعذّر تنزيل ملف العميل.','Could not download the customer file.')); }
    finally{
      if(link) link.remove(); if(url) URL.revokeObjectURL(url);
      button.disabled=false; button.removeAttribute('aria-busy');
    }
  }
  function siyReplyHtml(text){
    // Provider text stays verbatim; escape before adding our own formatting tags.
    function inline(value){ return esc(value).replace(/\*\*([^*\n]+)\*\*/g,"<strong>$1</strong>").replace(/`([^`\n]+)`/g,"<code>$1</code>"); }
    function cells(line){ return line.trim().replace(/^\|/,"").replace(/\|$/,"").split(/(?<!\\)\|/).map(function(cell){return cell.trim().replace(/\\\|/g,"|");}); }
    var trimmed=String(text||'').trim();
    var jsonStart=trimmed.search(/\n\s*[\[{]/);
    if(jsonStart>0){
      var intro=trimmed.slice(0,jsonStart).trim(),tail=trimmed.slice(jsonStart).trim();
      try{var suffix=JSON.parse(tail);if(suffix&&typeof suffix==='object')return siyReplyHtml(intro)+siyReplyHtml(tail);}catch(error){}
    }
    if((trimmed[0]==='{'&&trimmed.at(-1)==='}')||(trimmed[0]==='['&&trimmed.at(-1)===']')){
      try{
        var parsed=JSON.parse(trimmed), rows=Array.isArray(parsed)?parsed:(parsed&&typeof parsed==='object'&&Object.keys(parsed).length===1&&Array.isArray(Object.values(parsed)[0])?Object.values(parsed)[0]:null);
        if(rows&&rows.length&&rows.length<=50&&rows.every(function(row){return row&&typeof row==='object'&&!Array.isArray(row)&&Object.values(row).every(function(v){return v===null||['string','number','boolean'].includes(typeof v);});})){
          var keys=Array.from(new Set(rows.flatMap(function(row){return Object.keys(row);}))).slice(0,12);
          return '<div class="reply-table" role="region" tabindex="0" aria-label="'+ui('نتيجة منظمة','Structured result')+'"><table><thead><tr>'+keys.map(function(key){return '<th scope="col">'+esc(key)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+keys.map(function(key){return '<td dir="auto">'+esc(row[key]===undefined||row[key]===null?'':String(row[key]))+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>';
        }
      }catch(error){}
    }
    var lines=String(text||"").replace(/\r\n?/g,"\n").split("\n"), blocks=[], plain=[];
    function flush(){ if(plain.length){blocks.push('<p>'+plain.map(inline).join('<br>')+'</p>');plain=[];} }
    for(var i=0;i<lines.length;i++){
      var header=cells(lines[i]), divider=i+1<lines.length?cells(lines[i+1]):[];
      if(header.length>1&&divider.length===header.length&&divider.every(function(cell){return /^:?-{3,}:?$/.test(cell);})){
        flush(); var rows=[]; i+=2;
        while(i<lines.length&&lines[i].includes('|')){var row=cells(lines[i]);if(row.length!==header.length)break;rows.push(row);i++;}i--;
        blocks.push('<div class="reply-table" role="region" tabindex="0" aria-label="'+ui('جدول النتيجة','Result table')+'"><table><thead><tr>'+header.map(function(cell){return '<th scope="col">'+inline(cell)+'</th>';}).join('')+'</tr></thead><tbody>'+rows.map(function(row){return '<tr>'+row.map(function(cell){return '<td dir="auto">'+inline(cell)+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div>');
      }else if(!lines[i].trim()){flush();}else{plain.push(lines[i]);}
    }
    flush(); return blocks.join('');
  }
  function siyMessageTime(value){
    if(!value) return "";
    var text=String(value), date=/^\d{4}-\d{2}-\d{2}T/.test(text)?new Date(text):null;
    return date&&Number.isFinite(date.getTime())?siyClock(date):esc(text);
  }
  function siyMerge(data, restore){
    if(Array.isArray(data.team)){
      var mapped=data.team.map(mapEmployee).filter(Boolean); EMPS.length=0; mapped.forEach(function(e){EMPS.push(e);});
      if(!window.__SIY_REAL__) TOOLS.forEach(function(t){ var users=EMPS.filter(function(e){return e.tools.indexOf(t.s)>-1;}); t.on=users.length>0; t.by=users.map(function(e){return e.n;}); });
    }
    if(data.employee){ var employee=mapEmployee(data.employee,EMPS.length); if(employee){ var ix=EMPS.findIndex(function(e){return e.id===employee.id;}); if(ix<0) EMPS.push(employee); else {if(EMPS[ix].instrVersion>employee.instrVersion){employee.instr=EMPS[ix].instr;employee.instrSource=EMPS[ix].instrSource;employee.instrVersion=EMPS[ix].instrVersion;}EMPS[ix]=employee;} } }
    if(Array.isArray(data.memory)){ MEM.length=0; data.memory.forEach(function(m){MEM.push({k:m.topic,v:m.fact,src:m.source||m.added_at||""});}); }
    var dash=window.__SIY_DASH__||{};
    if(data.owned_knowledge!==undefined){
      var knowledge=data.owned_knowledge;
      dash.owned_knowledge=knowledge&&knowledge.schemaVersion===1&&typeof knowledge.companyId==='string'&&knowledge.companyId&&Array.isArray(knowledge.facts)&&knowledge.facts.every(function(f){return f&&typeof f==='object'&&f.value!==undefined;})?knowledge:null;
    }
    if(data.outcome_kind!=='employee_ready'&&Array.isArray(data.recent_work)) dash.recent_work=data.recent_work;
    if(data.company_settings&&typeof data.company_settings==='object'){
      dash.company_settings=data.company_settings;
      var settings=data.company_settings,voice=$("#companyVoice"),language=$("#companyLanguage"),dialect=$("#companyDialect"),preferred=$("#preferredWords"),forbidden=$("#forbiddenWords");
      if(voice)voice.value=String(settings.voice||"");if(language)language.value=["ar","en","auto"].includes(settings.language)?settings.language:"ar";if(dialect)dialect.value=String(settings.dialect||"");
      if(preferred)preferred.value=Array.isArray(settings.preferredWords)?settings.preferredWords.join("، "):"";if(forbidden)forbidden.value=Array.isArray(settings.forbiddenWords)?settings.forbiddenWords.join("، "):"";
    }
    EMPS.forEach(function(e){
      var verified=(dash.recent_work||[]).some(function(r){
        return r.employeeId===e.id && r.flowId===e.flowId && r.status==='succeeded' &&
          typeof r.runId==='string' && /^[A-Za-z0-9_-]+$/.test(r.runId) &&
          typeof r.recordId==='string' && /^[A-Za-z0-9_-]+$/.test(r.recordId);
      });
      if(verified){ e.draft=false; e.since=(e.on?'':'متوقف — ')+'آخر تشغيل ناجح ونتيجته محفوظة'; }
    });
    if(typeof data.work_count==="number") dash.work_count=data.work_count;
    if(data.brain!==undefined){dash.brain=data.brain; window.__SIY_BRAIN__=data.brain;}
    var companyName=typeof data.company==="string"?data.company:(data.company&&typeof data.company.name==="string"?data.company.name:"");
    if(companyName){dash.company=companyName; siyIdentity(companyName,dash.brain);}
    window.__SIY_DASH__=dash; window.__SIY_EMPTY__=EMPS.length===0;
    if($("#memList")&&!$("#memList").hidden) renderMem();
    PLAN.employees.used=EMPS.length; PLAN.actions.used=typeof dash.work_count==="number"?dash.work_count:null;
    if(restore&&Array.isArray(data.conversations)) data.conversations.forEach(function(c){
      if(typeof c.id!=="string"||!c.id||!Array.isArray(c.messages)) return;
      var messages=c.messages.filter(function(m){return ["user","assistant"].includes(m.role)&&typeof m.content==="string";}).map(function(m){return {me:m.role==="user",t:m.role==="user"?m.content:siyReplyHtml(m.content),at:siyMessageTime(m.at)};});
      messages.siyConversationId=c.id;
      CHATS[c.id]={with:c.employee_id||"siyadah",emp:c.employee_id||null,t:String(c.title||"محادثة سيادة"),when:"today",msgs:messages};
      if(c.employee_id&&emp(c.employee_id)) eth[c.employee_id]=messages;
    });
    if(restore&&Array.isArray(data.pending_work)) data.pending_work.forEach(function(work){
      if(typeof work.work_id!=="string"||!work.work_id||!["queued","running"].includes(work.work_status)) return;
      var convo=CHATS[work.conversation_id]; if(!convo) return;
      var row=siyResultRow(work); convo.msgs.push(row); siyPoll(work.work_id,convo.msgs,row,0);
    });
    if(isEmp()&&!emp(who)) {who="siyadah";chatId=null;}
    refreshLiveLabels();
  }
  function siyRememberConversation(data,list,employeeId,text){
    if(typeof data.conversation_id!=="string"||!data.conversation_id) return;
    var id=data.conversation_id; list.siyConversationId=id;
    if(!CHATS[id]) CHATS[id]={with:employeeId||"siyadah",emp:employeeId||null,t:title(text),when:"today",msgs:list};
    if(!employeeId&&curList()===list){chatId=id;live.siyadah=null;}
  }
  function siyDraw(){ renderSide(); renderBar(); renderThread(); renderPlan();refreshLiveLabels(); }
  var siyActivationResumeBusy=false, siyActivationResumeNotice=null;
  async function siyResumePendingActivation(employeeId){
    if(!window.__SIY_REAL__||siyActivationResumeBusy)return;
    var generation=siyGeneration;
    siyActivationResumeBusy=true;siyActivationResumeNotice={employeeId:employeeId||null,busy:true,message:ui('نتحقق من جاهزية الموظف للتجربة والتفعيل…','Checking employee readiness for testing and activation…')};
    siyBuilderState(siyActivationResumeNotice.message,false);refreshLiveLabels();if(employeeId&&who===employeeId)siyDraw();
    try{
      var result=await siyRequest({op:"resume_employee_activation",...(employeeId?{employee_id:employeeId}:{})},210000);
      if(generation!==siyGeneration)return;
      if(result.activation_status==='active'&&result.employee&&result.employee.status==='active'&&!!emp(result.employee.recordId)&&!!result.employee.flowId&&emp(result.employee.recordId).flowId===result.employee.flowId&&(!employeeId||result.employee.recordId===employeeId)){siyMerge({employee:result.employee},false);siyActivationResumeNotice=null;siyBuilderState(ui('مساحة شركتك','Your workspace'),true);siyDraw();if(who===result.employee.recordId&&!$('#instrWrap')?.hidden)siyReadPublishedInstructions(emp(who));}
      else if(result.activation_status==='pending'&&typeof result.message==='string'&&result.message&&(!employeeId||!result.employee_id||result.employee_id===employeeId)){siyActivationResumeNotice={employeeId:result.employee_id||employeeId||null,busy:false,message:result.message};siyBuilderState(result.message,false);siyDraw();}
      else if(result.activation_status==='none'){siyActivationResumeNotice=null;siyBuilderState(ui('مساحة شركتك','Your workspace'),true);if(employeeId&&who===employeeId)siyDraw();}
      else throw new Error(ui('لم نتأكد من نتيجة التفعيل.','Activation outcome is unverified.'));
    }catch(error){if(generation===siyGeneration){siyActivationResumeNotice={employeeId:employeeId||null,busy:false,message:error.message||ui('تعذّر التحقق من التفعيل. أعد فتح الموظف للمحاولة.','Could not check activation. Reopen the employee to retry.')};siyBuilderState(siyActivationResumeNotice.message,false);if(employeeId&&who===employeeId)siyDraw();}}
    finally{if(generation===siyGeneration){siyActivationResumeBusy=false;refreshLiveLabels();}}
  }
  function siyDraftReadinessHtml(readiness){
    if(!readiness||readiness.schema!=="SiyadahDraftReadinessV1"||!Array.isArray(readiness.checks)) return "";
    var passed=readiness.checks.filter(function(row){return row&&row.passed===true;});
    var blocked=readiness.checks.filter(function(row){return row&&row.passed!==true;});
    var ready=readiness.can_claim_draft_10_of_10===true;
    var title=ready?ui("الموظف جاهز للربط والاختبار","Employee ready for connection and testing"):ui("جاهزية الموظف: ","Employee readiness: ")+esc(readiness.score||passed.length+"/10");
    return '<div style="margin-top:10px;padding:10px;border:1px solid var(--hair);border-radius:10px">'+
      '<b>'+title+'</b><div class="msrc">'+esc(customerText(readiness.claim||""))+'</div>'+
      (ready?'<div class="msrc">'+ui('الخطوة التالية: اربط الأدوات المطلوبة، ثم نختبر التشغيل والنتيجة.','Next: connect the required tools, then test execution and its outcome.')+'</div>':'')+
      (blocked.length?'<details><summary>'+ui('وش باقي ليبدأ العمل؟','What remains before work starts?')+'</summary><div class="msrc">'+blocked.map(function(row){return '• '+esc(acceptanceLabel(row));}).join('<br>')+'</div></details>':'')+
      '</div>';
  }
  function siyAcceptanceHtml(acceptance){
    if(!acceptance||!["SiyadahFlowAcceptanceV1","SiyadahFlowAcceptanceV2"].includes(acceptance.schema)||!Array.isArray(acceptance.checks)) return "";
    var passed=acceptance.checks.filter(function(row){return row&&row.passed===true;});
    var blocked=acceptance.checks.filter(function(row){return row&&row.passed!==true;});
    var title=acceptance.can_claim_10_of_10===true?ui("العمل مكتمل ومثبت","Work completed and verified"):ui("حالة العمل: ","Work status: ")+esc(acceptance.score||passed.length+"/10");
    return siyDraftReadinessHtml(acceptance.draft_readiness)+'<div style="margin-top:10px;padding:10px;border:1px solid var(--hair);border-radius:10px">'+
      '<b>'+title+'</b><div class="msrc">'+esc(customerText(acceptance.claim||""))+'</div>'+
      (passed.length?'<div class="msrc">✓ '+passed.map(function(row){return esc(acceptanceLabel(row));}).join(' · ')+'</div>':'')+
      (blocked.length?'<details><summary>'+ui('وش باقي؟','What remains?')+'</summary><div class="msrc">'+blocked.map(function(row){return '• '+esc(acceptanceLabel(row));}).join('<br>')+'</div></details>':'')+
      '</div>';
  }
  function siyBuilderProposalHtml(data){
    if(!data||!data.approval||data.approval.required!==true||typeof data.approval.approval_id!=="string") return "";
    if(data.approval.kind==='tool_action')return '<div class="plan nr" style="margin-top:10px"><div class="plan__h"><span class="drop"></span>'+ui('إجراء يحتاج موافقتك','Action needs your approval')+'</div><div class="prow"><b>'+ui('الإجراء','Action')+'</b><span>'+esc(customerText(data.approval.summary||''))+'</span></div><details><summary>'+ui('راجع بيانات الإجراء كاملة','Review exact action inputs')+'</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(data.approval.details||'')+'</pre></details></div>'+
      '<div class="approve nr"><button type="button" class="bt" data-siy-approval="approve">'+I.check+ui('وافق على الإجراء','Approve action')+'</button><button type="button" class="bt bt--line" data-siy-approval="reject">'+ui('إلغاء','Cancel')+'</button></div>';
    var plan=data.flow_plan&&typeof data.flow_plan==="object"?data.flow_plan:{};
    var trigger=plan.trigger&&typeof plan.trigger==="object"?plan.trigger:{};
    var steps=Array.isArray(plan.steps)?plan.steps:[];
    var triggerText=customerText(trigger.display_name||trigger.label||ui("الوقت أو الحدث الذي تحدده","The time or event you choose"));
    var stepRows=steps.map(function(step,index){
      var text=customerText(step.display_name||step.label||ui("إجراء ","Action ")+(index+1));
      return '<div class="prow"><b>'+ui('الخطوة ','Step ')+(index+1)+'</b><span>'+esc(text)+'</span></div>';
    }).join("");
    return '<div class="plan nr" style="margin-top:10px"><div class="plan__h"><span class="drop"></span>'+ui('خطة عمل الموظف','Employee work plan')+'</div>'+
      (plan.name?'<div class="prow"><b>'+ui('الاسم','Name')+'</b><span>'+esc(plan.name)+'</span></div>':'')+
      '<div class="prow"><b>'+ui('يبدأ عندما','Starts when')+'</b><span>'+esc(triggerText)+'</span></div>'+stepRows+
      '<div class="prow"><b>'+ui('الحالة','Status')+'</b><span>'+ui('قيد التجهيز · لن يبدأ العمل قبل الاختبار','In preparation · work starts after testing')+'</span></div></div>'+
      '<div class="approve nr"><button type="button" class="bt" data-siy-approval="approve">'+I.check+ui('ابدأ التجهيز','Start preparation')+'</button>'+
      '<button type="button" class="bt bt--line" data-siy-approval="reject">'+ui('إلغاء','Cancel')+'</button></div>';
  }
  function siyRequestStateHtml(state,partialActionResult){
    var labels={queued:ui('بانتظار التنفيذ','Queued'),running:ui('قيد التنفيذ','In progress'),failed:ui('تعذّر الطلب','Request failed'),unknown:ui('النتيجة غير مؤكدة','Outcome unverified'),awaiting_input:ui('بانتظارك','Needs your input'),cancelled:ui('أُلغي الطلب','Request cancelled')};
    if(state==='unknown'&&partialActionResult===true)labels.unknown=ui('اكتمل إجراء؛ نتيجة الطلب كاملة غير مؤكدة','An action completed; the full request outcome is unverified');
    return labels[state]?'<span class="request-state" data-state="'+state+'" role="status">'+labels[state]+'</span>':'';
  }
  function siyReadinessReceipt(data){
    var r=data.readiness_receipt,e=data.employee;
    return r&&e&&e.status==='active'&&typeof r.employee_id==='string'&&r.employee_id===e.recordId&&r.flow_id===e.flowId&&r.test_environment==='TESTING'&&[r.flow_id,r.published_version_id,r.test_run_id].every(function(id){return typeof id==='string'&&/^[0-9A-Za-z]{21}$/.test(id);})&&(!Object.prototype.hasOwnProperty.call(r,'used_mock_trigger_data')||typeof r.used_mock_trigger_data==='boolean')?r:null;
  }
  function siyDraftReceipt(data){
    var r=data.draft_receipt;
    return data.outcome_kind==='flow_draft_saved'&&data.request_status==='succeeded'&&data.work_status==='succeeded'&&r&&r.status==='DRAFT'&&typeof r.flow_id==='string'&&/^[0-9A-Za-z]{21}$/.test(r.flow_id)&&(!data.flow_id||data.flow_id===r.flow_id)&&(!data.employee?.flowId||data.employee.flowId===r.flow_id)&&typeof r.version_id==='string'&&r.version_id.length>0&&r.version_id.length<=100&&(!Object.prototype.hasOwnProperty.call(r,'used_mock_trigger_data')||typeof r.used_mock_trigger_data==='boolean')&&(!Object.prototype.hasOwnProperty.call(r,'test_run_id')||r.test_environment==='TESTING'&&/^[0-9A-Za-z]{21}$/.test(r.test_run_id))?r:null;
  }
  function siyResultRow(data){
    var state=data.work_status, kind=data.outcome_kind, text=data.reply,ready=siyReadinessReceipt(data),savedDraft=siyDraftReceipt(data);
    if(kind==='employee_ready'){var complete=ready&&data.request_status==='succeeded'&&state==='succeeded';if(!complete)state='unknown';if(!text)text=complete?ui('اختبرنا طريقة العمل وفعّلناها. لم تُثبت نتيجة مهمة إنتاجية بعد.','We tested and activated the workflow. A production task result is not verified yet.'):ui('لم نتأكد من اختبار طريقة العمل وتفعيلها.','Workflow testing and activation are unverified.');}
    if(!text&&kind==='conversation_reply'&&state==='not_started') text=ui('اكتملت معالجة السؤال دون تشغيل أداة، لكن تفاصيل الرد غير متاحة.','The question was processed without running a tool, but the reply details are unavailable.');
    if(!text&&kind==='tool_result'&&state==='succeeded') text=ui('اكتمل استدعاء الأداة، لكن تفاصيل النتيجة غير متاحة.','The tool action completed, but the result details are unavailable.');
    if(!text&&kind==='employee_draft'&&state==='not_started') text=ui('حُفظت مسودة الموظف. لم يبدأ تشغيل أدواته.','The employee draft was saved. Its tools have not run.');
    if(!text&&savedDraft)text=savedDraft.test_run_id?ui('حُفظت المسودة واجتازت اختبار التهيئة. لم تُنشر أو تُشغّل إنتاجيًا.','The draft was saved and passed a configuration test. It was not published or run in production.'):ui('حُفظت المسودة ولم تُنشر أو تُشغّل إنتاجيًا.','The draft was saved and was not published or run in production.');
    if(!text&&data.request_status==='not_observed'&&state==='unknown') text=ui('لم نتأكد من نتيجة الطلب. لم نعد تنفيذه.','The request outcome is unverified. We did not run it again.');
    if(!text) text=(locale==='en'?{queued:'Request received, awaiting execution.',running:'Work in progress.',succeeded:'The run is recorded; verify the tool result.',failed:'Work could not be completed. Review the result details.',awaiting_input:'Work needs more information from you.',cancelled:'Request cancelled.'}:{queued:"تم استلام الطلب، بانتظار التنفيذ.",running:"العمل قيد التنفيذ.",succeeded:"سُجّل التشغيل؛ تحقّق من نتيجة الأداة.",failed:"تعذّر إكمال العمل. راجع تفاصيل النتيجة.",awaiting_input:"العمل ينتظر معلومات إضافية منك.",cancelled:"أُلغي الطلب."})[state]||ui("وصل الرد دون تفاصيل إضافية.","Response received without further details.");
    var noExecution=["conversation_reply","employee_draft","employee_ready","flow_draft_saved","unverified"].includes(kind),records=(noExecution?[]:Array.isArray(data.recent_work)?data.recent_work:[]).filter(function(r){return !!data.work_id&&r.work_id===data.work_id&&!!data.conversation_id&&r.conversation_id===data.conversation_id;});
    var scoped=records.filter(function(r){return r.conversation_id;});
    var readiness=ready?siyRefsHtml([['طريقة العمل',ready.flow_id],['النسخة المنشورة',ready.published_version_id],['اختبار التهيئة',ready.test_run_id]],ui('اختبار تهيئة (TESTING)، وليس تنفيذ مهمة إنتاجية.','Configuration test (TESTING), not a production task.')+(ready.used_mock_trigger_data===true?ui(' استخدم بيانات مشغّل تجريبية.',' Used mock trigger data.'):'')):'';
    var draftProof=savedDraft?siyRefsHtml([['طريقة العمل',savedDraft.flow_id]].concat(savedDraft.test_run_id?[['اختبار التهيئة',savedDraft.test_run_id]]:[]),ui('مسودة داخل مساحة شركتك؛ لم تُنشر أو تُشغّل إنتاجيًا.','Draft in your workspace; not published or run in production.')+(savedDraft.used_mock_trigger_data===true?ui(' استخدم الاختبار بيانات مشغّل تجريبية.',' The test used mock trigger data.'):'')):'';
    var verifiedRun=kind==='tool_result'&&state==='succeeded'&&data.request_status==='succeeded'&&typeof data.run_id==='string'&&/^[0-9A-Za-z]{21}$/.test(data.run_id)&&typeof data.flow_id==='string'&&/^[0-9A-Za-z]{21}$/.test(data.flow_id)?siyRefsHtml([['التشغيل',data.run_id],['طريقة العمل',data.flow_id]],ui('نتيجة تشغيل هذا الطلب مؤكدة من سجل التنفيذ.','This request’s run was verified from the execution record.')):'';
    var draft=!savedDraft&&data.draft&&data.flow_id?siyRefsHtml([['طريقة العمل',data.flow_id],['المهمة',data.work_id]]):'';
    var receipts=Array.isArray(data.tool_receipts)?data.tool_receipts.filter(function(r){return r&&typeof r.name==='string'&&['returned','error'].includes(r.status);}).slice(0,80):[];
    var partialActionResult=state==='unknown'&&receipts.some(function(r){return r.name==='ap_run_action'&&r.status==='returned'&&r.outcome==='action_completed'&&typeof r.run_id==='string'&&/^[0-9A-Za-z]{21}$/.test(r.run_id);})&&receipts.some(function(r){return r.status==='error'||r.effect_attempted===true&&r.outcome!=='action_completed';});
    var tools=receipts.length?'<details class="plan nr" style="margin-top:10px"><summary>'+ui('استدعاءات الأدوات','Tool calls')+' · '+receipts.length+'</summary>'+receipts.map(function(r,i){var run=r.name==='ap_run_action'&&typeof r.run_id==='string'&&/^[0-9A-Za-z]{21}$/.test(r.run_id)?r.run_id:'';return '<div class="prow"><b>'+(i+1)+'</b><span>'+esc(r.name)+' · '+(r.status==='error'?ui('تعذّر الاستدعاء','Call failed'):run&&r.outcome==='action_completed'?ui('اكتمل استدعاء الإجراء','Action completed'):ui('أعادت ردًا','Returned a response'))+(run?'<small>'+ui('مرجع الإجراء: ','Action run: ')+'<code>'+esc(run)+'</code></small>':'')+(r.output_limited===true?'<small>'+ui('اختصرت الخدمة بعض الحقول؛ اطلب نطاقًا أضيق لعرضها كاملة.','The service shortened some fields; request a narrower scope to display them in full.')+'</small>':'')+'</span></div>';}).join('')+'<p>'+ui('رد الأداة وحده لا يثبت نتيجة الخدمة.','A tool response alone does not prove the provider outcome.')+'</p></details>':'';
    return {me:false,at:now(),requestState:state,partialActionResult:partialActionResult,t:siyReplyHtml(text)+readiness+draftProof+verifiedRun+tools+siyBuilderProposalHtml(data)+siyAcceptanceHtml(data.acceptance)+(scoped.length?siyWorkHtml(scoped,ui('نتائج هذا الطلب','Results for this request')):'')+siyLegacyProofHtml(records)+draft,workId:data.work_id||null,proofIds:records.map(function(r){return r.recordId;}),builderApproval:data.approval&&data.approval.required===true?{id:data.approval.approval_id,conversationId:data.conversation_id}:null};
  }
  async function siyDecideBuilder(row,decision){
    if(!row||!row.builderApproval||row.siyInFlight) return;
    var requestId=row.siyApprovalRequestId||(row.siyApprovalRequestId=crypto.randomUUID());
    row.siyInFlight=true; row.t=siyReplyHtml(decision==='approve'?ui('جارٍ تنفيذ الإجراء داخل مساحة شركتك…','Running the action in your workspace…'):ui('جارٍ إلغاء الإجراء…','Cancelling the action…')); siyDraw();
    try{
      var data=await siyRequest({op:'approve',request_id:requestId,conversation_id:row.builderApproval.conversationId,approval_id:row.builderApproval.id,decision:decision});
      siyMerge(data,false);
      Object.assign(row,siyResultRow(data)); row.siyInFlight=false; siyDraw();
    }catch(error){ row.siyInFlight=false; row.t=siyReplyHtml(ui('نتحقق من نتيجة القرار بنفس الطلب، دون إعادة تشغيل الأداة.','Checking this decision with the same request, without running the tool again.')); siyDraw(); siyPoll('request_'+requestId,curList(),row,0); }
  }
  function siyPoll(workId,list,row,attempt){
    var generation=siyGeneration;
    siyPolls[workId]=setTimeout(async function(){
      if(generation!==siyGeneration) return;
      try{
        var data=await siyRequest({op:"work",work_id:workId});
        if(generation!==siyGeneration) return;
        siyMerge(data,false); var updated=siyResultRow(data); Object.assign(row,updated); siyDraw();
        if(data.auto_activate_after_connection===true)siyResumePendingActivation();
        if(["queued","running"].includes(data.work_status)) siyPoll(workId,list,row,attempt+1); else delete siyPolls[workId];
      }catch(e){
        if(generation!==siyGeneration) return;
        row.t=siyReplyHtml(e.noRetry?e.message:ui("تعذّر تحديث حالة العمل. سنعيد التحقق دون إعادة التنفيذ.","Could not update work status. We will check again without running it twice.")); siyDraw();
        if(e.noRetry) delete siyPolls[workId]; else siyPoll(workId,list,row,attempt+1);
      }
    },attempt<3?2000:5000);
  }
  function siyMessage(text,list,employeeId){
    var request={op:"message",message:text,conversation_id:list.siyConversationId||null,employee_id:employeeId||null,request_id:crypto.randomUUID()};
    if(list.siyLatestRequestId) request.prior_request_id=list.siyLatestRequestId;
    list.siyLatestRequestId=request.request_id;
    var row={me:false,typing:true,at:"",requestId:request.request_id}; list.push(row); siyDraw();
    var generation=siyGeneration;
    async function submit(refresh){
      if(row.siyInFlight) return; row.siyInFlight=true; row.typing=true; row.siyRetry=null; siyDraw();
      try{
        var data=await siyRequest(refresh?{op:'work',request_id:request.request_id,conversation_id:request.conversation_id}:request); if(generation!==siyGeneration) return;
        if(data.request_status==='not_observed'&&!data.reply) throw new Error(ui('لم نتأكد من نتيجة الطلب. لم نعد تنفيذه. تحقق من حالته دون إرسال طلب جديد.','The request outcome is unverified. We did not run it again. Check its status without sending a new request.'));
        siyRememberConversation(data,list,employeeId,text); siyMerge(data,false);
        Object.assign(row,siyResultRow(data)); row.typing=false; row.siyInFlight=false; siyDraw();
        if(data.auto_activate_after_connection===true)siyResumePendingActivation();
        if(data.request_status==='not_observed'){
          row.t+='<button type="button" class="lnk" data-siy-retry="1">'+ui('تحقق من حالة الطلب','Check request status')+'</button>';
          row.siyRetry=function(){submit(true);}; siyDraw();
        }
        if(data.work_id&&["queued","running"].includes(data.work_status)) siyPoll(data.work_id,list,row,0);
      }catch(e){
        if(generation!==siyGeneration) return;
        row.typing=false; row.siyInFlight=false; row.requestState="unknown"; row.t=siyReplyHtml(e.message||ui("تعذّر الاتصال","Could not connect"))+'<button type="button" class="lnk" data-siy-retry="1">'+ui('تحقق من حالة الطلب','Check request status')+'</button>';
        row.siyRetry=function(){submit(true);}; siyDraw(); // Read-only lookup of the original request; never redispatch after uncertainty.
      }
    }
    submit();
  }
  /* لا نغيّر بيانات الحساب الحقيقي قبل ربط كتابة موثقة وقراءة تؤكدها. */
  function siyUnsupported(){ window.alert(ui("هذا التعديل غير متاح بعد. لم يتم تغيير أي بيانات أو تشغيل.","This change is not available yet. No data was changed or action run.")); }
  function siyPatch(){ if(window.__SIY_REAL__) siyUnsupported(); }
  function renameEmp(){
    if(window.__SIY_REAL__){ siyUnsupported(); return; }
    var e=emp(who); if(!e) return;
    var nn=(window.prompt("الاسم الجديد للموظف:",e.n)||"").trim(); if(!nn||nn===e.n) return;
    e.n=nn; e.ini=nn.slice(0,1)||e.ini; renderSide(); renderBar(); renderThread();
  }
  /* بطاقات أداء فعلية من جدول المحادثات — أرقام حقيقية لكل موظف بدل "—" */
  function kpiFrom(s){ var t=(s.last_at||"").slice(11,16)||"—";
    return [ {v:String(s.messages||0),l:"رسائل",t:"—"}, {v:String(s.client_msgs||0),l:"من العملاء",t:"—"},
             {v:String(s.replies||0),l:"ردود",t:"—"}, {v:t,l:"آخر نشاط",t:"—"} ]; }
  function siyChatReal(e,text,list){ siyMessage(text,list,e.id); }
  /* سجل العمل الفعلي من جدول الإثبات (recent_work في رد الـDashboard) */
  function siyEmployeeProofHtml(e,list){
    if(!window.__SIY_REAL__) return "";
    var proofs=((window.__SIY_DASH__&&window.__SIY_DASH__.recent_work)||[]).filter(function(r){
      return r.employeeId===e.id&&r.flowId===e.flowId&&r.recordId&&r.runId&&
        (!r.conversation_id||r.conversation_id===list.siyConversationId)&&
        !list.some(function(m){return Array.isArray(m.proofIds)&&m.proofIds.includes(r.recordId);});
    });
    return proofs.length?'<div class="m m--ai"><span class="m__av">'+avHtml(e.id)+'</span><div class="m__b"><div class="m__c">'+(proofs.some(function(r){return r.conversation_id;})?siyWorkHtml(proofs.filter(function(r){return r.conversation_id;}),ui('سجل تشغيل في هذه المحادثة — غير مربوط برسالة محددة','Run history in this conversation — not linked to a specific message')):'')+siyLegacyProofHtml(proofs)+'</div></div></div>':"";
  }
  function siyLegacyProofHtml(records){
    var legacy=records.filter(function(r){return !r.conversation_id;});
    return legacy.length?siyWorkHtml(legacy,ui('نشاط سابق للموظف — غير مرتبط بهذه المحادثة','Earlier employee activity — unrelated to this conversation')):'';
  }
  function siyWorkStatus(value){ return (locale==='en'?{succeeded:'Completed',failed:'Failed',running:'In progress',queued:'Queued',awaiting_input:'Needs information',cancelled:'Cancelled'}:{succeeded:"مكتملة",failed:"تعذّرت",running:"قيد العمل",queued:"بانتظار البدء",awaiting_input:"تنتظر معلومات",cancelled:"ملغاة"})[value]||ui("غير مؤكدة","Unverified"); }
  function siyWorkHtml(records,label){ var d=window.__SIY_DASH__, w=Array.isArray(records)?records:(d&&d.recent_work)||[];
    if(!w.length) return '<p>'+ui('ما فيه عمل مسجّل بعد — أول ما يشتغل فريقك، كل نتيجة تنكتب هنا بإثباتها.','No work recorded yet. Verified results will appear here when your team runs.')+'</p>';
    return '<p>'+esc(label||ui('آخر عمل فعلي للفريق','Latest verified team work'))+' (<span class="num">'+(Array.isArray(records)?w.length:(d.work_count||w.length))+'</span>):</p>'+w.map(function(x){
      return '<div style="margin:8px 0;padding-inline-start:10px;border-inline-start:2px solid var(--hair)"><b>'+esc(x.subject||ui("مهمة","Task"))+'</b>'+
        (x.priority?' <span class="msrc">· '+esc(x.priority)+'</span>':'')+
        (x.message?'<div>'+esc(x.message)+'</div>':'')+
        '<div class="msrc">'+(x.status==='succeeded'&&x.recordId&&x.runId&&x.flowId?'✓ ':'')+esc(siyWorkStatus(x.status))+(x.proof?' · '+esc(customerText(x.proof)):'')+'</div>'+siyRefsHtml([['الطلب',x.work_id||x.workId],['التشغيل',x.runId],['النتيجة',x.recordId],['طريقة العمل',x.flowId]])+'</div>';
    }).join("");
  }
  var TOOL_SLUG={ "واتساب بزنس":"whatsapp","واتساب":"whatsapp","التقويم":"google-calendar","Wafeq":"wafeq","قيود/Wafeq":"wafeq","HTTP":"http","اتصال ويب":"http",
    "شات الموقع":"site-chat","Gmail":"gmail","لينكدإن":"linkedin","إنستغرام":"instagram-business",
    "Google Sheets":"google-sheets","Google Docs":"google-docs","HubSpot":"hubspot" };
  function siyTone(t){ return /رسمي/.test(t||"")?0:1; }
  function siyAuto(a){ if(/يستأذن/.test(a||"")) return 1; if(/يقترح/.test(a||"")) return 2; if(/ينف[ّ]?ذ/.test(a||"")) return 0; return null; }
  function mapEmployee(m,i){
    if(!m||typeof m.recordId!=="string"||!m.recordId) return null;
    var rules=(Array.isArray(m.rules)?m.rules:[]).map(function(r){return [String(r),true];}); if(!rules.length&&!window.__SIY_REAL__) rules=[["يشتغل ضمن تعليماتك",true]];
    var role=String(m.role||"موظف"), displayName=String(m.name||"موظف"), draft=window.__SIY_REAL__&&m.status==='disabled'&&(!Array.isArray(m.tools)||m.tools.length===0)&&!m.lastRunId;
    return { id:m.recordId, flowId:m.flowId||null, n:displayName, r:role, ini:String(m.initial||displayName.slice(0,1)),
      f:i%2===1, on:/^(نشط|active)$/i.test(String(m.status||"").trim()), draft:draft, wait:0, waits:[],
      since:(draft?'مسودة محفوظة · الأدوات غير متصلة':/^(نشط|active)$/i.test(String(m.status||"").trim())?"مسجل كنشط — التشغيل لم يُتحقق منه":"مسجل كمتوقف"), ver:Number(m.knowledgeVersion)||1,
      kpi:[{v:"—",l:"مهام اليوم",t:"—"},{v:"—",l:"قيد التنفيذ",t:"—"},{v:"—",l:"مكتملة",t:"—"},{v:"—",l:"بانتظارك",t:"—"}],
      log:window.__SIY_REAL__?[]:[["—","بيانات الموظف من سجل الشركة. نتائج التنفيذ تظهر في سجل العمل."]], auto:siyAuto(m.autonomy), autonomy:typeof m.autonomy==="string"?m.autonomy:"", tone:siyTone(m.tone), hours:"—",
      rules:rules, tools:(Array.isArray(m.tools)?m.tools:[]).map(function(t){return TOOL_SLUG[t]||String(t);}),
      instr:m.instructions||"", instrSource:m.instructionSource||'company_profile', instrVersion:Number(m.instructionVersion)||1, instrUpdatedAt:m.instructionUpdatedAt||null, how:(Array.isArray(m.how)?m.how:[]),
      v:{ hi:"أبشر.", q:"أكمّل على نفس النهج؟", ack:"وصلني. أتأكد قبل ما أطبّق:", ackq:"قاعدة دائمة، ولا لهالمرة بس؟",
          why:{ subj:role, act:"اشتغلت حسب تعليماتك وقواعدك", log:0, rule:0, extra:"وكل حركة راجعة لسطر كتبته أنت", retry:"أعيد المحاولة الحين؟" },
          pause:"وقفت. ما أتحرك لين ترجعني.", resume:"رجعت أشتغل." } };
  }
  function siyIdentity(co,brain){
    try{ var sm=document.querySelector("#meBtn .me__n small"); if(sm) sm.textContent=co+ui(" · نسخة الوصول المبكر"," · Early access");
      var av=document.querySelector("#meBtn .av"); if(av) av.textContent=co.slice(0,1);
      var ni=$("#companyNameField"); if(ni){ni.value=co; ni.readOnly=true; ni.title=ui("من سجل الشركة؛ التعديل غير متاح هنا","From your company record; editing is unavailable here");}
      var di=$("#companyDescriptionField"); if(di){di.value=(brain&&brain.description)||""; di.readOnly=true; di.title=ui("من سجل الشركة؛ التعديل غير متاح هنا","From your company record; editing is unavailable here");}
      var profile=document.querySelector("#meBtn .me__n"); if(profile&&profile.firstChild&&profile.firstChild.nodeType===3) profile.firstChild.textContent=ui("حسابك","Your account");
    }catch(e){}
  }
  function refreshLiveLabels(){
    if(!window.__SIY_REAL__)return;
    var sm=$("#meBtn .me__n small");if(sm)sm.textContent=(window.__SIY_DASH__&&window.__SIY_DASH__.company||ui('حسابك','Your account'))+ui(' · نسخة الوصول المبكر',' · Early access');
    var profile=$("#meBtn .me__n");if(profile&&profile.firstChild&&profile.firstChild.nodeType===3)profile.firstChild.textContent=ui('حسابك','Your account');
    var dataDescription=$("#dataDescription");if(dataDescription)dataDescription.textContent=ui('ملف شركتك ومعرفتها ونتائجها','Your company profile, knowledge and results');
    var deletion=$("#deleteAccountBtn");if(deletion)deletion.textContent=ui('حذف الحساب — غير متاح','Delete account — unavailable');
    var consent=$(".comp__f"),notice=siyActivationResumeNotice;if(consent)consent.textContent=notice&&(!notice.employeeId||notice.employeeId===who)?notice.message:ui('تظهر حالة كل طلب ونتيجته بعد التحقق.','Request status and results appear after verification.');
    var attachment=$("#attachBtn");if(attachment&&attachment.disabled){attachment.title=ui('إرفاق الملفات غير متاح حاليًا','File attachments are currently unavailable');attachment.setAttribute('aria-label',attachment.title);}
    [$("#companyNameField"),$("#companyDescriptionField")].forEach(function(input){if(input&&input.readOnly)input.title=ui('من سجل الشركة؛ التعديل غير متاح هنا','From your company record; editing is unavailable here');});
    var notification=$("#notificationSwitch");if(notification){notification.setAttribute('aria-label',ui('الإشعارات غير متاحة حاليًا','Notifications are currently unavailable'));var row=notification.closest('.srow'),caption=row&&row.querySelector('small');if(caption)caption.textContent=ui('لم تُفعّل قنوات الإشعارات','Notification channels are not enabled');var label=notification.nextSibling;if(label&&label.nodeType===3)label.textContent=ui('الإشعارات غير متاحة حاليًا','Notifications are currently unavailable');}
    var memory=$("#memTgl");if(memory){var summary=memory.parentNode;if(summary.firstChild&&summary.firstChild.nodeType===3)summary.firstChild.textContent=ui('المعرفة المحفوظة في حسابك ','Saved knowledge in your account ');var caption=summary.parentNode.querySelector('small');if(caption)caption.textContent=ui('المعلومات المتاحة لمستشار سيادة وموظفيك','Information available to Siyadah and your employees');}
  }
  function siyClearDemo(){
    window.__SIY_REAL__=true; window.__SIY_EMPTY__=false; document.body.classList.add("chat-real");
    window.__SIY_BRAIN__=null; window.__SIY_DASH__=null; window.__SIY_STATS__=null;
    EMPS.length=0; MEM.length=0; ACTIONS.length=0;
    var notification=document.querySelector('#notificationSwitch');
    if(notification){
      notification.disabled=true; notification.setAttribute('aria-checked','false'); notification.setAttribute('aria-label','الإشعارات غير متاحة حاليًا');
      var notificationRow=notification.closest('.srow'), notificationCaption=notificationRow&&notificationRow.querySelector('small');
      if(notificationCaption) notificationCaption.textContent='لم تُفعّل قنوات الإشعارات';
      var notificationText=notification.nextSibling; if(notificationText&&notificationText.nodeType===3) notificationText.textContent='الإشعارات غير متاحة حاليًا';
    }
    var dataDescription=document.querySelector('#dataDescription'); if(dataDescription) dataDescription.textContent='ملف شركتك ومعرفتها ونتائجها';
    var attachment=document.querySelector('#attachBtn'); if(attachment){attachment.disabled=true;attachment.title='إرفاق الملفات غير متاح حاليًا';attachment.setAttribute('aria-label',attachment.title);}
    var deletion=document.querySelector('#deleteAccountBtn'); if(deletion){deletion.disabled=true;deletion.textContent='حذف الحساب — غير متاح';}
    var consent=document.querySelector('.comp__f'); if(consent) consent.textContent='تظهر حالة كل طلب ونتيجته بعد التحقق.';
    var memoryToggle=document.querySelector('#memTgl');
    if(memoryToggle){ var memorySummary=memoryToggle.parentNode; if(memorySummary.firstChild&&memorySummary.firstChild.nodeType===3) memorySummary.firstChild.textContent='المعرفة المحفوظة في حسابك '; var memoryCaption=memorySummary.parentNode.querySelector('small'); if(memoryCaption) memoryCaption.textContent='المعلومات المتاحة لمستشار سيادة وموظفيك'; }
    Object.keys(CHATS).forEach(function(k){ delete CHATS[k]; });
    live={}; eth={}; PRES={}; PULSE={}; pendAns=null; pendEdit=null;
    if(typeof TOOLS!=="undefined") TOOLS.forEach(function(t){ t.on=false; t.by=[]; t.sug=""; });
    window.__SIY_TOOLS_LOADED__=false;
    var count=$("#toolsCnt"); if(count) count.textContent=ui("لم يتم التحقق من الاتصالات","Connections not verified");
    PLAN.state="unknown"; PLAN.actions.used=null; PLAN.employees.used=0;
    PLAN.credit={sar:0,actions:0}; PLAN.invoices=[]; PLAN.payment=""; PLAN.vat=""; PLAN.cr="";
  }
  function siyHydrate(done){
    if(window.SIYADAH_REAL_ACCOUNT!==true){done();return;}
    siyClearDemo(); siyIdentity("حسابك",null);
    window.__SIY_LOAD_ERROR__="تعذّر تحميل بيانات حسابك. أعد تحميل الصفحة للمحاولة.";
    var finished=false, timer=setTimeout(function(){finish(null);},15000);
    function finish(data){
      if(finished)return;finished=true;clearTimeout(timer);
      if(data&&data.ok===true&&Array.isArray(data.team)){
        siyMerge(data,true); window.__SIY_LOAD_ERROR__="";
      }
      done();
      if(data&&data.ok===true&&Array.isArray(data.team))siyResumePendingActivation();
    }
    siyRequest({op:"hydrate"}).then(finish).catch(function(){finish(null);});
  }

  /* روابط مباشرة (للنموذج والعروض): #e=saad · #say=وش صار اليوم؟ · #plan=trial|near|over|pastdue · #pal=1 · #tools=1
     وللعروض الحية: #run=build (يوافق على خطة c1 ويشغّل الفريق) · #run=collect (خطوتا نورة عند نورة) · #run=proactive (نورة تبادر فورًا) */
  var ranDemo={};
  function route(){ var h=location.hash.slice(1); if(!h) return; var q=new URLSearchParams(h);
    if(!window.__SIY_REAL__ && q.get("plan")){ PLAN.state=q.get("plan"); renderPlan(); openSheet("plan"); }
    if(q.get("tools")) openTools();
    if(window.__SIY_REAL__&&q.get("tool")){openTools();setTimeout(function(){openConnect(q.get("tool"));},0);}
    if(q.get("e")&&emp(q.get("e"))) go(q.get("e"));
    if(q.get("say")){ if(window.__SIY_REAL__){ go("siyadah"); $("#input").value=q.get("say"); $("#input").focus(); } else setTimeout(function(){ send(q.get("say")); },200); }
    if(q.get("pal")){ $("#hq").value=q.get("pal")==="1"?"":q.get("pal"); $("#hq").focus(); openPal(); }
    if(!window.__SIY_REAL__ && q.get("run")==="build"&&!ranDemo.build){ ranDemo.build=true;
      go("siyadah","c1");
      var L=CHATS.c1.msgs, pm=L.filter(function(m){return m.plan})[0];
      if(pm&&!pm.approved){ pm.approved=true; pm.approvedAt=now(); L.push({me:true,t:"وافق وشغّل",at:now()}); renderThread(); playEvents(L,buildEvents()); } }
    if(!window.__SIY_REAL__ && q.get("run")==="collect"&&!ranDemo.collect){ ranDemo.collect=true;
      go("noura"); playEvents(empThread("noura"),collectEvents()); }
    if(!window.__SIY_REAL__ && q.get("run")==="proactive"&&!ranDemo.proactive){ ranDemo.proactive=true; triggerProactive(true); } /* للعروض: نورة تبادر فورًا وتنفتح محادثتها */
  }
  function siyBoot(){
    /* حساب جديد بلا فريق: رسالة ترحيب واضحة تدعوه لبناء فريقه — بدل أي بيانات تجريبية */
    if(window.__SIY_REAL__ && window.__SIY_LOAD_ERROR__){
      live.siyadah=[{me:false,at:now(),uiLoadError:true,t:"<p>"+esc(loadErrorCopy())+"</p>"}];
    }
    if(window.__SIY_REAL__ && window.__SIY_EMPTY__){
      var co=(window.__SIY_DASH__&&window.__SIY_DASH__.company)||"";
      live.siyadah=[{me:false,at:now(),
        t:'<p>'+ui('أهلًا بك في ','Welcome to ')+'<b>'+esc(co||ui('سيادة','Siyadah'))+'</b>.</p><p>'+ui('وش هدفك اليوم؟ اكتب طلبك، ونبدأ من المعلومات والأدوات المتاحة لشركتك.','What would you like to achieve today? Write your request, and we will use the information and tools available to your company.')+'</p><p><a href="onboard.html">'+ui('أضف ملف شركتك لتخصيص الاقتراحات','Add your company profile for tailored suggestions')+'</a></p>'}];
    }
    renderSide(); renderBar(); renderThread(); renderPlan(); refreshLiveLabels(); if(window.__SIY_REAL__)realTools();
    route(); window.addEventListener("hashchange",route);
    /* المبادرة التلقائية للعرض التجريبي فقط — الحساب الحقيقي لا يُظهر مبادرات وهمية */
    if(!window.__SIY_REAL__) setTimeout(function(){ triggerProactive(false); }, reduced()?0:6000);
  }
  siyHydrate(siyBoot);
})();
