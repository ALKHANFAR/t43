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
var TN={ "whatsapp":"واتساب", "hubspot":"HubSpot", "google-calendar":"التقويم", "wafeq":"قيود/Wafeq", "google-sheets":"Google Sheets",
         "gmail":"Gmail", "linkedin":"لينكدإن", "instagram-business":"إنستغرام", "google-docs":"Google Docs", "site-chat":"شات الموقع" };

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
  var who="siyadah", chatId=null, live={}, eth={}, pendAns=null;
  var AUTON=["ينفّذ ويبلغك","يستأذنك أولًا","يقترح فقط"], TONE=["رسمي","ودّي"];
  var reduced=function(){ return window.matchMedia("(prefers-reduced-motion: reduce)").matches; };

  function emp(id){ return EMPS.filter(function(e){return e.id===id})[0]; }
  function isEmp(){ return who!=="siyadah"&&who!=="tools"; }
  function avHtml(id){ return (id==="siyadah"||!emp(id)) ? '<span class="drop"></span>' : emp(id).ini; }
  function name(id){ return (id==="siyadah"||!emp(id)) ? "سيادة" : emp(id).n; }
  function fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
  function now(){ var d=new Date(); return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); }
  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  /* عنوان المحادثة: قصّ عند حدود الكلمة */
  function title(t){ if(t.length<=32) return t; var c=t.slice(0,32), i=c.lastIndexOf(" "); return (i>12?c.slice(0,i):c).replace(/[،,.؟?!:]+$/,"")+"…"; }

  /* --- الجانب --- */
  function renderSide(){
    $("#emps").innerHTML = EMPS.map(function(e){
      return '<button type="button" class="emp" data-emp="'+e.id+'" aria-current="'+(who===e.id)+'"><span class="av">'+e.ini+'</span>'+
        '<span class="emp__n">'+e.n+'<small>'+e.r+'</small></span>'+
        '<span style="display:flex;align-items:center;gap:6px">'+(e.wait?'<span class="badge">'+e.wait+'</span>':'')+'<span class="dot'+(e.on?'':' dot--off')+'"></span></span></button>';
    }).join("");
    var g={today:"",yesterday:"",week:""};
    Object.keys(CHATS).forEach(function(id){ var c=CHATS[id];
      g[c.when]+='<button type="button" class="hist" data-chat="'+id+'" aria-current="'+(chatId===id)+'">'+c.t+'</button>';
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
    $("#whoN").textContent = who==="tools" ? "الأدوات" : (isEmp() ? name(who)+" · "+emp(who).r : "سيادة");
    $(".comp").style.display = who==="tools" ? "none" : "";
    $("#input").placeholder = isEmp() ? "اكتب ل"+name(who)+"…" : "اكتب لسيادة…";
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
    if(m.me) return '<div class="m m--me" data-mi="'+i+'"><div class="m__b">'+esc(m.t)+'<span class="m__t">'+m.at+'</span></div></div>';
    if(m.typing) return '<div class="m m--ai" data-mi="'+i+'"><span class="m__av">'+avHtml(w)+'</span><div class="m__b"><span class="typing" aria-label="يكتب…"><i></i><i></i><i></i></span></div></div>';
    var body = m.wait ? waitHtml(m) : ((m.t||"").indexOf("<p>")===0? m.t : '<p>'+m.t+'</p>') + (m.plan? planHtml(m):'') + (m.diff? diffHtml(m):'');
    return '<div class="m m--ai'+(m.reveal?' m--rev':'')+'" data-mi="'+i+'"><span class="m__av">'+avHtml(w)+'</span><div class="m__b"><div class="m__c">'+body+'</div>'+
      '<span class="m__t">'+name(w)+' · '+m.at+'</span>'+
      '<div class="act"><button type="button" data-copy="1">'+I.copy+'نسخ</button><button type="button" data-why="1" aria-expanded="false">'+I.why+'ليش؟</button></div>'+
      '<p class="whyl" hidden>'+whyOf(m,w)+'</p></div></div>';
  }
  function renderThread(){
    var t=$("#thread"); t.classList.toggle("thread--emp",isEmp());
    if(who==="tools"){ t.innerHTML=toolsHtml(); bindTools(); return; }
    var list, w;
    if(isEmp()){ var e=emp(who); list=empThread(who); w=who;
      t.innerHTML='<div class="col">'+pinHtml(e)+'<div id="instrWrap" hidden>'+instrHtml(e)+'</div>'+list.map(function(m,i){return msgHtml(m,who,i)}).join("")+'</div>';
    } else {
      list = chatId ? CHATS[chatId].msgs : (live.siyadah||[]); w = chatId? CHATS[chatId].with : who;
      if(!list.length){
        t.innerHTML='<div class="empty"><span class="drop"></span><h1>وش تبي فريقك يسوي؟</h1>'+
          '<p>قول اللي تبيه. سيادة تبني الفريق، وتوريك الخطة قبل ما يتحرك شيء.</p>'+
          '<div class="cards">'+SUGG.siyadah.map(function(s){return '<button type="button" class="cardq"><small>'+I[s[0]]+s[1]+'</small>'+s[2]+'</button>'}).join("")+'</div></div>';
        return;
      }
      t.innerHTML='<div class="col">'+list.map(function(m,i){return msgHtml(m, w, i)}).join("")+'</div>';
    }
    t.scrollTop=t.scrollHeight;
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
    if(!eth[id]){ var e=emp(id), m=[];
      e.log.slice().reverse().forEach(function(l){ m.push({me:false,t:l[1],at:l[0]}); });
      e.waits.forEach(function(w){ m.push({me:false,wait:w,at:"ينتظر قرارك"}); });
      eth[id]=m; }
    return eth[id];
  }
  function toolOf(s){ if(s==="site-chat") return {s:s,n:TN[s],on:true,builtin:true}; return TOOLS.filter(function(t){return t.s===s})[0]||{s:s,n:TN[s]||s,on:false}; }
  function chipHtml(s){
    var t=toolOf(s), n=TN[s]||t.n;
    return '<span class="chip'+(t.on?'':' chip--off')+'">'+(t.builtin?'<span class="drop" style="width:9px"></span>':'<img src="'+t.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1">')+
      '<span class="chip__n">'+n+'</span>'+(t.on?'<i></i>':'<button type="button" class="link" data-c="'+s+'" aria-label="اربط '+n+'">اربط</button>')+'</span>';
  }
  function pinHtml(e){
    var f=e.f;
    return '<div class="pin"><div class="pin__r1"><span class="av">'+e.ini+'</span><div class="pin__t"><p class="pin__n">'+e.n+' <span>· '+e.r+'</span></p><div class="pin__s">'+e.since+'</div></div>'+
      '<div class="pin__c">'+(e.wait?'<span class="pill">ينتظر قرارك '+e.wait+'</span>':'')+
      '<span class="swl" style="font-size:.8rem;color:var(--ash)"><span id="onLbl">'+(e.on?(f?'شغّالة':'شغّال'):(f?'متوقفة':'متوقف'))+'</span><button type="button" class="sw" id="onSw" role="switch" aria-checked="'+e.on+'" aria-label="تشغيل '+e.n+'"></button></span></div></div>'+
      '<div class="kpis">'+e.kpi.map(function(k){ return '<div class="kpi"><span class="kpi__v num">'+k.v+'</span><span class="kpi__l">'+k.l+'<span class="kpi__t'+(k.ok?' kpi__t--ok':'')+'" title="عن الأسبوع الماضي">'+k.t+'</span></span></div>'; }).join("")+'</div>'+
      '<div class="pin__r3"><span class="pin__k">'+(f?'أدواتها':'أدواته')+'</span>'+e.tools.map(chipHtml).join("")+
      '<span class="pin__meta">ساعات العمل: '+e.hours+' · '+(f?'تستأذنك':'يستأذنك')+' في القرارات الحساسة</span>'+
      '<button type="button" class="link" id="instrTgl" aria-expanded="false" aria-controls="instrWrap">التعليمات</button></div></div>';
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
    return '<div class="card"><div class="card__h">'+I.pen+'<b>تعليماته</b><span class="cnt">بكلماتك</span></div>'+
      '<div class="card__b"><textarea class="instr" id="instr" aria-label="تعليمات '+e.n+'">'+esc(e.instr)+'</textarea>'+
      '<div class="instr__f" id="instrF"><span>عدّل بكلماتك. توريك الفرق قبل ما يسري.</span><button type="button" class="bts" id="instrSave">حدّث '+e.n+'</button></div></div>'+
      limitsHtml(e)+
      '<div class="card__h" style="border-block-start:1px solid var(--hair)"><b>كيف فهمها '+e.n+'</b><span class="cnt">كذا يشتغل فعلًا</span></div>'+
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
    e.on=on; renderSide();
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
    text=(text||"").trim(); if(!text||who==="tools") return;
    var list, w=who;
    if(isEmp()){ var e=emp(who); list=empThread(who); list.push({me:true,t:text,at:now()});
      $("#input").value=""; $("#input").style.height="auto"; renderThread();
      if(pendAns&&pendAns.who===who){ var p=pendAns; pendAns=null; resolveWait(e,list,p.mi,"كتبت الجواب",list[p.mi].wait.r[0],true); return; }
      typeReply(e,list,function(){ return empReply(e,text); }); return; }
    list = chatId ? CHATS[chatId].msgs : (live.siyadah=live.siyadah||[]);
    if(!chatId && !list.length){ // أول رسالة تنشئ محادثة في السجل
      var id="n"+Date.now(); CHATS[id]={with:"siyadah",t:title(text),when:"today",msgs:list}; chatId=id; live.siyadah=null;
    }
    list.push({me:true,t:text,at:now()});
    renderSide();
    $("#input").value=""; $("#input").style.height="auto"; renderThread();
    setTimeout(function(){
      if(w==="siyadah"&&isBuild(text)) list.push({me:false,plan:true,at:now(),t:"جهّزت ثلاثة. هذي خطتهم — ما يتحرك شيء قبل موافقتك:"});
      else list.push({me:false,at:now(),t:"<p>وصل. أجهّز لك الخطة، وما يتحرك شيء قبل موافقتك.</p>"});
      if(who===w) renderThread();
    },650);
  }
  function reply(list,html){ list.push({me:false,at:now(),t:html}); renderThread(); }
  /* قرار على بطاقة «ينتظر قرارك» */
  function resolveWait(e,list,mi,label,conf,skipMe){
    var m=list[mi]; if(!m||m.done) return;
    m.done={a:label,at:now()}; e.wait=Math.max(0,e.wait-1); e.log.unshift([now(),conf]);
    if(!skipMe) list.push({me:true,t:label,at:now()});
    renderSide(); renderThread();
    typeReply(e,list,{t:'<p>'+conf+'</p>', why:"قرارك أنت — نفّذته حرفيًا وسجّلته في سجلي بالوقت."});
  }

  /* --- الأحداث --- */
  $("#send").addEventListener("click",function(){ send($("#input").value); });
  $("#input").addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(this.value);} });
  $("#input").addEventListener("input",function(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,160)+"px"; });

  function go(w,c){ who=w; chatId=c||null; renderSide(); renderBar(); renderThread(); }
  function newChat(){ live={}; go("siyadah"); $("#input").focus(); }
  $("#emps").addEventListener("click",function(e){ var b=e.target.closest(".emp"); if(!b) return; go(b.dataset.emp); $("#input").focus(); });
  $(".side__scroll").addEventListener("click",function(e){ var b=e.target.closest(".hist"); if(!b||!b.dataset.chat) return; go("siyadah",b.dataset.chat); });
  $("#newChat").addEventListener("click",newChat);
  $("#hq").addEventListener("input",function(){ filterHist(); if(palOpen) renderPal(); });

  /* كل نقرة داخل المحادثة — مستمع واحد */
  $("#thread").addEventListener("click",function(e){
    var t=e.target, list, mEl=t.closest(".m"), mi=mEl?+mEl.dataset.mi:-1;
    var c=t.closest(".cardq"); if(c){ send(c.lastChild.textContent); return; }
    if(t.closest("[data-approve]")){ var ab=t.closest("[data-approve]"); if(ab.disabled) return; list = chatId ? CHATS[chatId].msgs : live.siyadah; if(!list||!list[mi]) return;
      list[mi].approved=true; list[mi].approvedAt=now(); ab.disabled=true;
      list.push({me:true,t:"وافق وشغّل",at:now()}); reply(list,"<p>شغّلتهم. سعد ونورة وفهد يشتغلون من الحين — وأول شيء يحتاج قرارك يوصلك هنا.</p>"); return; }
    if(t.closest("[data-editplan]")){ if(t.closest("[data-editplan]").disabled) return; $("#input").placeholder="وش تعدّل في الخطة؟"; $("#input").focus(); return; }
    /* إجراءات الرسالة: نسخ / ليش؟ */
    if(t.closest("[data-copy]")){ var cb=t.closest("[data-copy]"), txt=$(".m__c",mEl).textContent.replace(/\s+/g," ").trim();
      try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(function(){}); }catch(err){}
      var old=cb.innerHTML; cb.innerHTML=I.check+'نُسخ'; cb.disabled=true; setTimeout(function(){ cb.innerHTML=old; cb.disabled=false; },1200); return; }
    if(t.closest("[data-why]")){ var wb=t.closest("[data-why]"), wl=$(".whyl",mEl); wl.hidden=!wl.hidden; wb.setAttribute("aria-expanded",String(!wl.hidden)); return; }
    /* قرار من بطاقة «ينتظر قرارك» */
    var d=t.closest("[data-decide]"); if(d){ if(d.disabled||!isEmp()) return; var en=emp(who); list=empThread(who); var wm=list[mi], j=+d.dataset.decide, a=wm.wait.a[j], conf=wm.wait.r[j];
      if(/^اربط/.test(a)){ var slug=a.indexOf("لينكدإن")>-1?"linkedin":a.indexOf("إنستغرام")>-1?"instagram-business":null; if(slug){ openConnect(slug); } return; }
      $$("button",d.parentNode).forEach(function(b){ b.disabled=true; });
      if(a==="اكتب الجواب"){ pendAns={who:who,mi:mi}; var inp=$("#input"); inp.value="الجواب: "; inp.focus(); inp.setSelectionRange(inp.value.length,inp.value.length); return; }
      if(a==="شوف التقويم"){ list.push({me:true,t:a,at:now()}); renderThread(); typeReply(en,list,{t:'<p>'+conf+'</p><p>أرسله لك في Google Docs؟</p>', why:"التقويم من تعليماتك: خدماتكم وأسئلة عملائكم."}); return; }
      resolveWait(en,list,mi,a,conf); return; }
    /* حفظ فرق التعليمات */
    if(t.closest("[data-save]")){ if(!isEmp()) return; var es=emp(who); list=empThread(who); var dm=list[mi]; if(!dm||!dm.diff||dm.saved) return;
      es.instr=(es.instr.replace(/\s+$/,"")+" "+dm.diff.add).trim(); if(dm.diff.hours) es.hours=dm.diff.hours; if(/النبرة: رسمية/.test(dm.diff.add)) es.tone=0; else if(/النبرة: ودّية/.test(dm.diff.add)) es.tone=1;
      es.ver++; dm.saved=es.ver; es.log.unshift([now(),"حدّثت تعليماتي (النسخة "+es.ver+"): "+dm.diff.add]);
      renderThread(); typeReply(es,list,{t:'<p>حفظت. تسري من الرسالة الجاية.</p>', why:"النسخة "+es.ver+" من تعليماتي — تقدر ترجع للي قبلها من «التعليمات»."}); return; }
    if(t.closest("#instrTgl")){ var w=$("#instrWrap"), b=$("#instrTgl"); w.hidden=!w.hidden; b.setAttribute("aria-expanded",String(!w.hidden)); if(!w.hidden){ $("#thread").scrollTop=0; $("#instr").focus(); } return; }
    if(t.closest("#onSw")){ var sw=$("#onSw"), eo=emp(who), v=sw.getAttribute("aria-checked")==="true"; sw.setAttribute("aria-checked",String(!v)); eo.on=!v; $("#onLbl").textContent=eo.on?(eo.f?"شغّالة":"شغّال"):(eo.f?"متوقفة":"متوقف"); renderSide(); return; }
    if(t.closest("#instrSave")){ var e2=emp(who), nv=$("#instr").value.trim(); if(!nv||nv===e2.instr){ $("#instrF").firstChild.textContent="ما تغيّر شيء."; return; }
      var os=e2.instr.split(/(?<=[.؟!])\s+/), ns=nv.split(/(?<=[.؟!])\s+/), add=ns.filter(function(s){return os.indexOf(s)<0}).join(" "), del=os.filter(function(s){return ns.indexOf(s)<0}).join(" ");
      e2.instr=nv; e2.ver++;
      list=empThread(who); list.push({me:true,t:"حدّث تعليماتك: «"+(nv.length>90?nv.slice(0,90).replace(/\s\S*$/,"")+"…":nv)+"»",at:now()});
      list.push({me:false,at:now(),t:"<p>قرأته. هذا اللي تغيّر عندي — والخطوط الحمراء كما هي:</p>",diff:{add:add||"—",del:del},saved:e2.ver,why:"النسخة "+e2.ver+" — الفرق سطرًا بسطر مع النسخة "+(e2.ver-1)+"."});
      renderThread(); typeReply(e2,list,{t:'<p>حفظت. تسري من الرسالة الجاية.</p>', why:"النسخة "+e2.ver+" من تعليماتي."}); return; }
    if(t.closest("#instrPrev")){ var e3=emp(who); if(e3.ver>1){ e3.ver--; } var v2=$(".vers"); v2.innerHTML='<span style="color:var(--ok)">رجعت النسخة '+e3.ver+' · قبل 4 أيام. النسخة '+(e3.ver+1)+' محفوظة لو غيّرت رأيك.</span>'; return; }
    var m=t.closest("#more"); if(m){ tshown+=24; renderThread(); return; }
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

  /* ---------- الأدوات — الكتالوج الكامل (الحقيقي يجي من Activepieces /v1/pieces) ---------- */
  /* الكتالوج الحقيقي من pieces.js: [slug, name, description EN, category, logo, description AR] */
  var ON ={"gmail":"سعد · نورة · فهد","google-sheets":"نورة","google-calendar":"سعد","whatsapp":"سعد · فهد"};
  var SUG={"linkedin":"تحتاجه ريم","hubspot":"يحتاجه سعد","wafeq":"تحتاجه نورة","cal-com":"يحتاجه سعد","instagram-business":"تحتاجه ريم","google-docs":"تحتاجه ريم"};
  var TOOLS=(window.PIECES||[]).map(function(p){ return {s:p[0],n:p[1],d:p[5]||p[2],en:p[2],c:p[3],logo:p[4],on:!!ON[p[0]],by:ON[p[0]]||"",sug:SUG[p[0]]||""}; });
  var SOON=["سلة","زد","فودكس","ميسر","Unifonic","تابي","دفترة"];
  var tq="", tshown=24, picked=null;
  /* مين يستخدم الأداة: من أدوات الموظفين، وإلا من الاقتراحات */
  function usersOf(s){ var u=EMPS.filter(function(e){return e.tools.indexOf(s)>-1}).map(function(e){return e.n}); if(u.length) return u.join(" · "); var g=SUG[s]; return g?g.replace(/^(يحتاجه|تحتاجه)\s+/,""):"بانتظار تعيين موظف"; }
  function tcard(t){
    var st=t.on?'<span class="st"><i></i>مربوطة</span>':(t.sug?'<span class="st st--w">'+t.sug+'</span>':'');
    return '<div class="tl'+(t.on?' tl--on':'')+'"><span class="tl__i"><img src="'+t.logo+'" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1"></span><div><div class="tl__n">'+t.n+'</div>'+
      '<div class="tl__d">'+(t.d||t.c)+(t.on?'<br><span class="who">يستخدمها: '+t.by+'</span>':'')+'</div>'+
      '<div class="tl__f">'+(t.on?'<button type="button" class="lnk">إدارة</button>':'<button type="button" class="lnk lnk--fill" data-c="'+t.s+'">اربط</button>')+st+'</div></div></div>';
  }
  function tgrid(a,e){ return a.length?'<div class="tgrid">'+a.map(tcard).join("")+'</div>':'<div class="tempty">'+e+'</div>'; }
  function toolsHtml(){
    var f=TOOLS.filter(function(t){return !tq||(t.n+" "+t.d+" "+t.en+" "+t.s+" "+t.c).toLowerCase().indexOf(tq)>-1});
    var h='<div class="tools"><h1>الأدوات</h1><p class="sub">'+TOOLS.length+' أداة. اربط اللي تستخدمه، وموظفوك يشتغلون فيه — ولا يوصل موظف لأداة ما ربطتها أنت.</p>'+
      '<div class="tsearch"><span class="drop"></span><input id="tq" placeholder="ابحث… واتساب، قيود، HubSpot" aria-label="ابحث في الأدوات" value="'+tq+'"><kbd>/</kbd></div>';
    if(!tq){
      var on=f.filter(function(t){return t.on}),sug=f.filter(function(t){return t.sug&&!t.on}),rest=f.filter(function(t){return !t.on&&!t.sug});
      h+='<div class="tsec"><b>المربوطة</b>'+on.length+'</div>'+tgrid(on,"ما ربطت شيئًا بعد");
      h+='<div class="tsec"><b>مقترحة لك</b>حسب موظفيك</div>'+tgrid(sug,"—");
      h+='<div class="tsec"><b>الكل</b>'+TOOLS.length+'</div>'+tgrid(rest.slice(0,tshown),"—");
      if(rest.length>tshown) h+='<button type="button" class="more" id="more">اعرض المزيد — باقي '+(rest.length-tshown)+'</button>';
      h+='<div class="soon"><div><b>أدوات سعودية نبنيها لك</b>مو في الكتالوج بعد — نضيفها لك على الطلب.<div class="chips">'+SOON.map(function(x){return '<span>'+x+'</span>'}).join("")+'</div></div><button type="button" class="lnk">اطلب أداة</button></div>';
    } else {
      h+='<div class="tsec"><b>نتائج «'+tq+'»</b>'+f.length+'</div>'+tgrid(f.slice(0,tshown),"ما لقيناها في الكتالوج — اطلبها ونبنيها لك.");
      if(f.length>tshown) h+='<button type="button" class="more" id="more">اعرض المزيد — باقي '+(f.length-tshown)+'</button>';
    }
    return h+'</div>';
  }
  function bindTools(){
    var q=$("#tq"); q.addEventListener("input",function(){ tq=this.value.trim().toLowerCase(); tshown=24; var pos=this.selectionStart; renderThread(); var nq=$("#tq"); nq.focus(); nq.setSelectionRange(pos,pos); });
  }
  /* dialog: focus in, trap Tab, Escape closes, focus returns to the opener */
  var modalOpener=null;
  function openConnect(slug){ picked=TOOLS.filter(function(x){return x.s===slug})[0]; if(!picked) return;
    $("#mI").innerHTML='<img src="'+picked.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:26px;height:26px;object-fit:contain">'; $("#mN").textContent=picked.n; $("#mD").textContent="بعد الربط يقدر موظفوك يستخدمون "+picked.n+". "+picked.d+".";
    openModal(); }
  function openModal(){ modalOpener=document.activeElement; $("#modal").classList.add("on"); var f=$("#mGo")||$("#mX"); if(f) f.focus(); }
  function closeModal(){ $("#modal").classList.remove("on"); var back=(modalOpener&&document.contains(modalOpener))?modalOpener:($("#tq")||$("#input")); if(back&&back.focus) back.focus(); modalOpener=null; }
  $("#mX").addEventListener("click",closeModal);
  $("#modal").addEventListener("click",function(e){ if(e.target===this) closeModal(); });
  /* shared Tab trap for dialogs */
  function trapTab(e,root){ if(e.key!=="Tab") return; var f=$$("button,[href],input,textarea,select,[tabindex]:not([tabindex=\"-1\"])",root).filter(function(x){return !x.disabled&&x.offsetParent!==null}); if(!f.length) return; var a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } }
  $("#modal").addEventListener("keydown",function(e){ trapTab(e,$("#modal")); });
  $("#mGo").addEventListener("click",function(){
    if(picked){ picked.on=true; picked.by=usersOf(picked.s); picked.sug="";
      /* ربط من بطاقة ريم «اربط لينكدإن» يحسم البطاقة */
      if(who==="reem"&&picked.s==="linkedin"){ var e=emp(who), list=empThread(who), i=-1; list.forEach(function(m,k){ if(i<0&&m.wait&&!m.done&&/^اربط/.test(m.wait.a[0])) i=k; });
        if(i>-1){ e.on=true; e.since="شغّالة منذ الحين"; resolveWait(e,list,i,"اربط لينكدإن",list[i].wait.r[0]); } }
    }
    closeModal(); $("#toolsCnt").textContent=TOOLS.filter(function(t){return t.on}).length+" مربوطة"; renderThread(); });
  function openTools(){ go("tools"); }
  $("#toolsLink").addEventListener("click",openTools);

  /* ---------- قائمة الحساب ---------- */
  var pop=$("#pop");
  $("#meBtn").addEventListener("click",function(e){ e.stopPropagation(); pop.classList.toggle("on"); });
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
    var hist=Object.keys(CHATS).map(function(id){ var c=CHATS[id]; return {l:c.t,s:"محادثة",run:function(){ go("siyadah",id); }}; });
    var hit=function(x){ return !q||(x.l+" "+x.s).toLowerCase().indexOf(q)>-1; };
    return base.filter(hit).concat(hist.filter(hit)).slice(0,10);
  }
  function renderPal(){
    palItems=palList(); if(palIdx>=palItems.length) palIdx=0;
    var p=$("#pal");
    p.innerHTML=palItems.length?palItems.map(function(x,i){ return '<button type="button" class="pal__o" data-i="'+i+'" tabindex="-1" aria-current="'+(i===palIdx)+'"><span>'+x.l+'</span><small>'+x.s+'</small></button>'; }).join(""):'<div class="pal__none">ما فيه شيء بهذا الاسم.</div>';
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
  sheet.addEventListener("click",function(e){ var b=e.target.closest(".swm"); if(!b) return; var v=b.getAttribute("aria-checked")!=="true"; b.setAttribute("aria-checked",String(v)); if(b.id==="autoSw") PLAN.autoReload=v; });

  /* الخطة والاستخدام — كل شيء من PLAN + PRICING */
  function srow(l,body){ return '<div class="srow"><div>'+l+'</div><div>'+body+'</div></div>'; }
  function renderPlan(){
    var p=PLAN, st=p.state, C=PRICING.credits, usedN=st==="over"?Math.max(p.actions.used,p.actions.limit):p.actions.used, pct=Math.min(100,Math.round(usedN/p.actions.limit*100));
    var used='<span class="num">'+fmt(usedN)+' / '+fmt(p.actions.limit)+'</span> إجراء';
    var h='';
    if(st==="trial") h+=srow('الخطة','<div>تجربة · تنتهي خلال <span class="num">'+p.days+'</span> أيام · '+used+'</div><div class="acts"><button type="button" class="lnk lnk--fill">اختر خطتك</button></div>');
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

  renderSide(); renderBar(); renderThread(); renderPlan();

  /* روابط مباشرة (للنموذج والعروض): #e=saad · #say=وش صار اليوم؟ · #plan=trial|near|over|pastdue · #pal=1 · #tools=1 */
  function route(){ var h=location.hash.slice(1); if(!h) return; var q=new URLSearchParams(h);
    if(q.get("plan")){ PLAN.state=q.get("plan"); renderPlan(); openSheet("plan"); }
    if(q.get("tools")) openTools();
    if(q.get("e")&&emp(q.get("e"))) go(q.get("e"));
    if(q.get("say")) setTimeout(function(){ send(q.get("say")); },200);
    if(q.get("pal")){ $("#hq").value=q.get("pal")==="1"?"":q.get("pal"); $("#hq").focus(); openPal(); }
  }
  route(); window.addEventListener("hashchange",route);
})();
