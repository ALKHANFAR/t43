/* ==========================================================================
   بيانات تجريبية
   ========================================================================== */
var EMPS = [
  { id:"saad", n:"سعد", r:"متابعة المبيعات", ini:"س", on:true, wait:1, since:"شغّال منذ 12 يومًا",
    k:[["14","ليد تابعه"],["5","موعد حجزه"],["3 د","زمن الرد"]],
    kpis:[{v:"14",l:"ليد تابعه اليوم",d:"+3 عن أمس"},{v:"5",l:"موعد حجزه",d:"+2 عن أمس"},{v:"3",s:"د",l:"متوسط زمن الرد",d:"أسرع بـ 40 ثانية"},{v:"31",s:"%",l:"تحوّل ليد ← موعد",d:"+4% هذا الأسبوع"}],
    week:[8,11,9,13,10,12,14],
    waits:[{t:"محمد العتيبي يطلب خصم 15%.",s:"ما وعدته بشيء.",a:["وافق على الخصم","ارفض بلطف"]}],
    log:[["14:52","حجزت موعدًا مع أحمد الغامدي، الثلاثاء 11:00."],["14:12","رديت على ليد من إنستغرام خلال 3 دقائق."],["12:40","ليدان غير مناسبين — أوقفت المتابعة."],["09:15","متابعة ثانية لـ 6 ليدات ما ردوا."]],
    auto:1, tone:0, hours:"8 ص – 10 م",
    rules:[["ما أعطي خصمًا بدون موافقتك",true],["ما أحجز أكثر من 6 مواعيد باليوم",true],["أتابع الليد 3 مرات كحد أقصى",true],["أرد خارج ساعات العمل",false]],
    tools:["واتساب بزنس","Gmail","تقويم Google","HubSpot"],
    instr:"تابع كل عميل جديد خلال خمس دقائق. اسأله عن حجم فريقه ووش يحتاج بالضبط. إذا كان جاهزًا احجز له موعدًا معي. إذا بارد تابعه بلطف بدون إلحاح. لا تعد بأي شيء عن الأسعار.",
    how:["أرد على الليد الجديد خلال 5 دقائق برسالة تذكر طلبه بالذات","أسأل سؤالين للتأهيل: حجم الفريق والاحتياج","الجاهز أحجز له من تقويمك وأرسل له الرابط","البارد أتابعه 3 مرات بفواصل يومين ثم أتوقف","أي سؤال عن السعر أحوّله لك"] },
  { id:"noura", n:"نورة", r:"تحصيل الفواتير", ini:"ن", on:true, wait:0, since:"شغّالة منذ 12 يومًا",
    k:[["9","فاتورة تابعتها"],["41ك","حُصّل هذا الأسبوع"],["6","متأخرة باقية"]],
    kpis:[{v:"9",l:"فاتورة تابعتها",d:"−2 عن أمس"},{v:"41",s:"ك",l:"حُصّل هذا الأسبوع",d:"+12ك عن الماضي"},{v:"6",l:"فاتورة متأخرة باقية",d:"كانت 11"},{v:"4",s:"يوم",l:"متوسط التأخير",d:"كان 9 أيام"}],
    week:[3,5,4,7,6,8,9], waits:[],
    log:[["14:30","ذكّرت النخبة بفاتورة 4302 — 9 أيام تأخير."],["13:47","وصل سداد 4288. أوقفت التذكير."],["11:05","تذكير أول على 4 فواتير."],["09:00","حدّثت تقرير السيولة."]],
    auto:0, tone:0, hours:"9 ص – 6 م",
    rules:[["ما أهدد بإجراء قانوني أبدًا",true],["أتوقف فور وصول السداد",true],["أرفع لك أي فاتورة تجاوزت 30 يومًا",true],["أتواصل عبر الجوال إضافة للبريد",false]],
    tools:["قيود","Google Sheets","Gmail"],
    instr:"طالبي بالفواتير اللي تأخرت أكثر من سبعة أيام. ابدئي لطيفة وزيدي الجدية كل أسبوع. أول ما يسدد العميل توقفي فورًا. لا تهددي بأي إجراء قانوني.",
    how:["أراجع الفواتير كل صباح 9:00","بعد 7 أيام: تذكير لطيف بالبريد","بعد 14 يومًا: تذكير أوضح مع رقم الفاتورة والمبلغ","بعد 21 يومًا: طلب مباشر لموعد سداد","بعد 30 يومًا: أرفعها لك وأتوقف"] },
  { id:"fahad", n:"فهد", r:"دعم العملاء", ini:"ف", on:true, wait:2, since:"شغّال منذ 12 يومًا",
    k:[["28","رسالة رد عليها"],["93%","حلّها بنفسه"],["18 ث","زمن الرد"]],
    kpis:[{v:"28",l:"رسالة رد عليها اليوم",d:"+9 عن أمس"},{v:"26",l:"حلّها بدون تدخلك",d:"93% من المجموع"},{v:"18",s:"ث",l:"متوسط زمن الرد",d:"ثابت"},{v:"2",l:"صعّدها لك",d:"تنتظر قرارك",dn:true}],
    week:[19,22,17,25,21,24,28],
    waits:[{t:"عميل يطلب تعويضًا عن تأخير شحنة.",s:"اعتذرت. التعويض قرارك.",a:["عوّضه 10%","اعتذر فقط"]},{t:"سؤال ما عندي جوابه.",s:"وعدته بالرد خلال ساعة.",a:["اكتب الجواب","أضفها للمعرفة"]}],
    log:[["14:38","صعّدت لك شكوى شحنة — يطلب تعويضًا."],["13:20","7 أسئلة عن الاسترجاع — حُلّت."],["11:48","4 استفسارات أسعار."],["09:30","«هل فيه تطبيق؟» تكرر 5 مرات — يستاهل جوابًا."]],
    auto:1, tone:1, hours:"24 ساعة",
    rules:[["ما أعد بتعويض أو استرجاع بدون موافقتك",true],["أصعّد أي عميل غاضب فورًا",true],["أجاوب من قاعدة المعرفة فقط",true],["أرد بالإنجليزي إذا كتب العميل بالإنجليزي",true]],
    tools:["واتساب بزنس","شات الموقع","Gmail","قاعدة المعرفة"],
    instr:"رد على أسئلة العملاء من قاعدة المعرفة فقط. إذا ما تعرف الجواب قل «بنرجع لك» وارفعها لي. أي عميل غاضب أو يطلب تعويضًا صعّده لي فورًا مع ملخص.",
    how:["أرد خلال ثوانٍ من الأسعار والسياسات المرفوعة","ما أخترع جوابًا مو موجود في المعرفة","أرفع لك أي سؤال جديد مع اقتراح إضافته","العميل الغاضب يوصلك خلال دقيقة مع ملخص جاهز","أرد بلغة العميل: عربي أو إنجليزي"] },
  { id:"reem", n:"ريم", r:"التسويق", ini:"ر", on:false, wait:1, since:"متوقفة — تحتاج ربط حساب",
    k:[["—","منشور مجدول"],["—","بريدية"],["—","تفاعل"]],
    kpis:[{v:"—",l:"منشور مجدول"},{v:"—",l:"رسالة بريدية"},{v:"—",l:"تفاعل هذا الأسبوع"},{v:"—",l:"زيارات من المحتوى"}],
    week:[0,0,0,0,0,0,0],
    waits:[{t:"أحتاج لينكدإن عشان أبدأ.",s:"التقويم جاهز، بانتظارك.",a:["اربط لينكدإن","شوف التقويم"]}],
    log:[["أمس","جهّزت تقويم محتوى مبدئيًا لأسبوعين."],["أمس","كتبت 3 مسودات منشورات بصوت العلامة لتراجعها."]],
    auto:2, tone:1, hours:"—",
    rules:[["ما أنشر أي شيء قبل موافقتك",true],["ما أذكر أسعارًا في المنشورات",true],["ما أرد على التعليقات",true],["أنشر يوميًا",false]],
    tools:["لينكدإن (غير مربوط)","إكس (غير مربوط)"],
    instr:"جهّزي تقويم محتوى شهري عن خدماتنا. اكتبي المنشورات بصوتنا: مباشر وبدون مبالغة. ما تنشرين أي شيء قبل ما أوافق عليه.",
    how:["أبني تقويمًا شهريًا من خدماتكم وأسئلة عملائكم","أكتب المسودات وأرسلها لك للمراجعة","أنشر فقط اللي وافقت عليه، في الوقت المجدول","أعطيك تقريرًا أسبوعيًا: وش اشتغل ووش لا"] }
];

var CHATS = {
  "c1": { with:"siyadah", t:"بناء فريق المتابعة والتحصيل", when:"today", msgs:[
    { me:true,  t:"أبي أحد يتابع كل عميل جديد خلال خمس دقائق، ويطالب بالفواتير اللي تأخرت أكثر من سبعة أيام، ويرد على أسئلة الدعم المتكررة على طول.", at:"14:28" },
    { me:false, plan:true, t:"جهّزت ثلاثة. هذي خطتهم — ما يتحرك شيء قبل موافقتك:", at:"14:29" },
    { me:true,  t:"ممتاز، بس خلّ سعد ما يعطي خصومات بدون ما يرجع لي.", at:"14:31" },
    { me:false, t:"<p>صار. خط أحمر لسعد: <b>«ما أعطي خصمًا بدون موافقتك»</b>. أي طلب خصم يوصلك أنت.</p><p>الثلاثة جاهزون. أشغّلهم؟</p>", at:"14:31" }
  ]},
  "c2": { with:"siyadah", t:"وش سوّى الفريق اليوم؟", when:"today", msgs:[
    { me:true, t:"وش سوّى الفريق اليوم؟", at:"09:02" },
    { me:false, t:"<p><b>37 إجراء</b> حتى الحين.</p><p>سعد: 14 ليدًا، 5 مواعيد. نورة: 9 فواتير، ووصل 18,500. فهد: 28 رسالة، صعّد لك اثنتين.</p><p>ينتظرك شيء واحد: عميل يطلب تعويضًا. تشوفه؟</p>", at:"09:02" }
  ]},
  "c3": { with:"siyadah", t:"وضع شركة النخبة", when:"yesterday", msgs:[
    { me:true, t:"وش وضع شركة النخبة؟ لهم فاتورة قديمة.", at:"14:40" },
    { me:false, t:"<p>نورة تابعتها: فاتورة <b>4302</b> بقيمة 18,500 — متأخرة 9 أيام. أرسلت تذكيرين ولم يردوا.</p><p>إذا ما سددوا خلال 5 أيام ترتفع لك تلقائيًا حسب قاعدة الـ 30 يومًا. تبي نورة تتصل بهم بدل البريد؟</p>", at:"14:41" }
  ]},
  "c4": { with:"siyadah", t:"أكثر سؤال يتكرر على الدعم", when:"yesterday", msgs:[
    { me:true, t:"وش أكثر سؤال يجي فهد؟", at:"13:30" },
    { me:false, t:"<p>هذا الأسبوع: <b>«هل فيه تطبيق جوال؟»</b> — تكرر 5 مرات وما عنده جواب له في قاعدة المعرفة.</p><p>لو تعطيني الجواب بسطر واحد أضيفه لفهد ويرد عليه مباشرة من الحين.</p>", at:"13:30" }
  ]},
  "c5": { with:"siyadah", t:"ربط واتساب بزنس", when:"week", msgs:[
    { me:true, t:"اربط واتساب بزنس", at:"11:10" },
    { me:false, t:"<p>تم. رقمكم مربوط وسعد وفهد يقدرون يرسلون ويستقبلون منه.</p>", at:"11:12" }
  ]},
  "c6": { with:"siyadah", t:"ليش سعد ما تابع خالد؟", when:"week", msgs:[
    { me:true, t:"ليش سعد ما تابع خالد الدوسري؟", at:"16:20" },
    { me:false, t:"<p>تابعه مرتين وما رد. حسب قاعدتك يتابع 3 مرات كحد أقصى، والثالثة مجدولة بكرة 10:00.</p>", at:"16:20" }
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
var CHIPS = {
  siyadah:["وش صار اليوم؟","وظّف موظف جديد","وش ينتظرني؟"],
  saad:["كم ليد بارد عندنا؟","أوقف المتابعة مع خالد","غيّر نبرتك لأكثر رسمية"],
  noura:["وش الفواتير الأخطر؟","أرسلي لي تقرير السيولة","خفّفي النبرة مع النخبة"],
  fahad:["وش صعّدت لي؟","أضف جوابًا للمعرفة","كم عميل غاضب اليوم؟"],
  reem:["وريني المسودات","اربطي لينكدإن","وش موضوع الأسبوع؟"]
};

/* ==========================================================================
   العرض
   ========================================================================== */
var I = {
  clock:  '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  chart:  '<svg class="ic" viewBox="0 0 24 24"><path d="M4 19h16M7 16V10M12 16V6M17 16v-4"/></svg>',
  shield: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/></svg>',
  pen:    '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20l4-1L19 8l-3-3L5 16l-1 4z"/><path d="M14 7l3 3"/></svg>',
  hand:   '<svg class="ic" viewBox="0 0 24 24"><path d="M8 13V6a1.5 1.5 0 013 0v6M11 12V4.5a1.5 1.5 0 013 0V12M14 12V6a1.5 1.5 0 013 0v8.5c0 3.5-2.5 6-6 6-2.5 0-4-1-5.5-3L4 15.5a1.4 1.4 0 012-2l2 2"/></svg>',
  key:    '<svg class="ic" viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 6l2 2M13 9l2 2"/></svg>',
  wave:   '<svg class="ic" viewBox="0 0 24 24"><path d="M4 12h2l2-5 3 10 3-8 2 3h4"/></svg>',
  ban:    '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>',
  plug:   '<svg class="ic" viewBox="0 0 24 24"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4"/></svg>',
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
    var n=(img.closest(".card,.tl")||{}).querySelector ? (img.closest(".card,.tl").querySelector(".card__n,.tl__n")||{}).textContent||"" : "";
    var ini=n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•"; img.replaceWith(document.createTextNode(ini)); },true);
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var who="siyadah", chatId=null, live={};
  var AUTON=["ينفّذ ويبلغك","يستأذنك أولًا","يقترح فقط"], TONE=["رسمي","ودّي"], WL=["س","أ","ن","ث","ر","خ","اليوم"];

  function emp(id){ return EMPS.filter(function(e){return e.id===id})[0]; }
  function avHtml(id){ return (id==="siyadah"||!emp(id)) ? '<span class="drop"></span>' : emp(id).ini; }
  function name(id){ return (id==="siyadah"||!emp(id)) ? "سيادة" : emp(id).n; }

  /* --- الجانب --- */
  function renderSide(){
    $("#emps").innerHTML = EMPS.map(function(e){
      return '<button class="emp" data-emp="'+e.id+'" aria-current="'+(who===e.id)+'"><span class="av">'+e.ini+'</span>'+
        '<span class="emp__n">'+e.n+'<small>'+e.r+'</small></span>'+
        '<span style="display:flex;align-items:center;gap:6px">'+(e.wait?'<span class="badge">'+e.wait+'</span>':'')+'<span class="dot'+(e.on?'':' dot--off')+'"></span></span></button>';
    }).join("");
    var g={today:"",yesterday:"",week:""};
    Object.keys(CHATS).forEach(function(id){ var c=CHATS[id];
      g[c.when]+='<button class="hist" data-chat="'+id+'" aria-current="'+(chatId===id)+'">'+c.t+'</button>';
    });
    $("#histToday").innerHTML=g.today; $("#histYest").innerHTML=g.yesterday; $("#histWeek").innerHTML=g.week;
  }

  /* --- الشريط العلوي --- */
  function renderBar(){
    var isEmp = who!=="siyadah";
    $("#whoAv").innerHTML = who==="tools" ? '<svg class="ic" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4"/></svg>' : avHtml(who);
    $("#whoN").textContent = who==="tools" ? "الأدوات" : (isEmp ? name(who)+" · "+emp(who).r : "سيادة");
    $(".comp").style.display = isEmp ? "none" : "";
    $("#chips").innerHTML = CHIPS.siyadah.map(function(c){return '<button class="chip">'+c+'</button>'}).join("");
    $$(".chip").forEach(function(b){ b.addEventListener("click",function(){ send(b.textContent); }); });
  }

  /* --- الرسائل --- */
  function planHtml(){
    return '<div class="plan"><div class="plan__h"><span class="drop"></span>الخطة</div>'+
      '<div class="prow"><b>سعد · متابعة المبيعات</b><span>يرد على كل ليد خلال 5 دقائق، يؤهّله، ويحجز موعدًا للجاهزين. واتساب، البريد، التقويم.</span></div>'+
      '<div class="prow"><b>نورة · تحصيل الفواتير</b><span>تذكّر بعد 7 أيام، تصعّد النبرة أسبوعيًا، وتتوقف فور السداد. الفوترة، الجداول.</span></div>'+
      '<div class="prow"><b>فهد · دعم العملاء</b><span>يجاوب من أسعارك وسياساتك ويصعّد الحساس مع ملخص. واتساب، شات الموقع.</span></div></div>'+
      '<div class="approve"><button class="bt">وافق وشغّل <span class="drop"></span></button><button class="bt bt--line">عدّل الخطة</button><small>توقفه متى تبي.</small></div>';
  }
  function msgHtml(m, w){
    if(m.me) return '<div class="m m--me"><div class="m__b">'+m.t+'<span class="m__t">'+m.at+'</span></div></div>';
    var body = (m.t.indexOf("<p>")===0? m.t : '<p>'+m.t+'</p>') + (m.plan? planHtml():'');
    return '<div class="m m--ai"><span class="m__av">'+avHtml(w)+'</span><div class="m__b">'+body+
      '<span class="m__t">'+name(w)+' · '+m.at+'</span><div class="act"><button>'+I.copy+'نسخ</button><button>'+I.why+'ليش؟</button></div></div></div>';
  }
  function renderThread(){
    var t=$("#thread");
    if(who==="tools"){ t.innerHTML=toolsHtml(); bindTools(); return; }
    if(who!=="siyadah"){ t.innerHTML=dashHtml(emp(who)); t.scrollTop=0; bindDash(); return; }
    var msgs = chatId ? CHATS[chatId].msgs : (live[who]||[]);
    if(!msgs.length){
      t.innerHTML='<div class="empty"><span class="drop"></span><h1>وش تبي فريقك يسوي؟</h1>'+
        '<p>قول اللي تبيه. سيادة تبني الفريق، وتوريك الخطة قبل ما يتحرك شيء.</p>'+
        '<div class="cards">'+SUGG.siyadah.map(function(s){return '<button class="cardq"><small>'+I[s[0]]+s[1]+'</small>'+s[2]+'</button>'}).join("")+'</div></div>';
      $$(".cardq",t).forEach(function(b){ b.addEventListener("click",function(){ send(b.lastChild.textContent); }); });
      return;
    }
    t.innerHTML='<div class="col">'+msgs.map(function(m){return msgHtml(m, chatId? CHATS[chatId].with : who)}).join("")+'</div>';
    t.scrollTop=t.scrollHeight;
  }

  function dashHtml(e){
    var maxW=Math.max.apply(null,e.week.concat([1]));
    var h='<div class="dash">';
    h+='<div class="dh"><span class="av">'+e.ini+'</span><div><h1 class="dh__n">'+e.n+'</h1><p class="dh__r">'+e.r+' · '+e.since+'</p></div>'+
       '<div class="dh__c"><div class="swx"><span>'+(e.on?'شغّال':'متوقف')+'</span><button class="sw" role="switch" aria-checked="'+e.on+'"></button></div><span class="dh__m">إيقافه فوري.</span></div></div>';
    h+='<div class="kpis">'+e.kpis.map(function(k){return '<div class="kpi"><div class="kpi__v num">'+k.v+(k.s?'<small>'+k.s+'</small>':'')+'</div><div class="kpi__l">'+k.l+'</div>'+(k.d?'<div class="kpi__d'+(k.dn?' dn':'')+'">'+k.d+'</div>':'')+'</div>'}).join("")+'</div>';
    if(e.waits.length) h+='<div class="card card--warn"><div class="card__h">'+I.hand+'<b>ينتظر قرارك</b><span class="cnt">'+e.waits.length+'</span></div><div class="card__b">'+
       e.waits.map(function(w){return '<div class="wait"><div class="wait__t">'+w.t+'<small>'+w.s+'</small></div><div class="wait__a"><button class="bts">'+I.check+w.a[0]+'</button><button class="bts bts--line">'+I.x+w.a[1]+'</button></div></div>'}).join("")+'</div></div>';
    h+='<div class="two"><div class="card"><div class="card__h">'+I.clock+'<b>اليوم</b><span class="cnt">'+e.log.length+' إجراء</span></div><div class="card__b"><ul class="log">'+
       e.log.map(function(l){return '<li><time>'+l[0]+'</time><span>'+l[1]+'</span></li>'}).join("")+'</ul></div></div>'+
       '<div class="card"><div class="card__h">'+I.chart+'<b>آخر 7 أيام</b><span class="cnt">'+e.kpis[0].l+'</span></div><div class="card__b"><div class="week">'+
       e.week.map(function(v){return '<i style="height:'+Math.max(4,Math.round(v/maxW*100))+'%"></i>'}).join("")+'</div><div class="week__l">'+WL.map(function(d){return '<span>'+d+'</span>'}).join("")+'</div></div></div></div>';
    h+='<div class="card" style="margin-block-start:16px"><div class="card__h">'+I.shield+'<b>حدوده</b><span class="cnt">أنت ترسمها، وتسري فورًا</span></div><div class="ctl">'+
       '<div><div class="ctl__l">'+I.key+'صلاحيته</div><div class="seg">'+AUTON.map(function(a,i){return '<button aria-pressed="'+(i===e.auto)+'">'+a+'</button>'}).join("")+'</div></div>'+
       '<div><div class="ctl__l">'+I.wave+'النبرة</div><div class="seg">'+TONE.map(function(t,i){return '<button aria-pressed="'+(i===e.tone)+'">'+t+'</button>'}).join("")+'</div><div class="ctl__l" style="margin-block-start:12px">'+I.clock+'متى يشتغل</div><div style="font-family:var(--f-display);font-size:.92rem">'+e.hours+'</div></div>'+
       '<div><div class="ctl__l">'+I.ban+'خطوطه الحمراء</div>'+e.rules.map(function(r){return '<div class="rule'+(r[1]?'':' off')+'"><span class="chk"></span>'+r[0]+'</div>'}).join("")+'</div>'+
       '<div><div class="ctl__l">'+I.plug+'أدواته</div><div class="tools">'+e.tools.map(function(t){return '<span class="tool"><i style="'+(t.indexOf("غير")>-1?'background:var(--ash-2)':'')+'"></i>'+t+'</span>'}).join("")+'</div><div class="ctl__l" style="margin-block-start:12px;color:var(--ash-2)">ولا شيء غيرها.</div></div></div></div>';
    h+=instrHtml(e);
    return h+'</div>';
  }
  function promptOf(e){
    var lines=[
      "<span class='k'># الهوية</span>",
      "أنت "+e.n+"، "+e.r+" في شركة الأفق (حلول توصيل للمطاعم في الرياض وجدة).",
      "تتحدث بصوت الشركة. النبرة: "+TONE[e.tone]+". اللغة: عربي، أو إنجليزي إذا كتب العميل بالإنجليزي.",
      "",
      "<span class='k'># تعليمات صاحب العمل (بكلماته)</span>",
      e.instr,
      "",
      "<span class='k'># خطوط حمراء — لا تُخالف مهما طلب العميل</span>"
    ].concat(e.rules.filter(function(r){return r[1]}).map(function(r){return "- "+r[0]})).concat([
      "",
      "<span class='k'># الصلاحية</span>",
      AUTON[e.auto]+". ساعات العمل: "+e.hours+".",
      "",
      "<span class='k'># الأدوات المتاحة</span>",
      e.tools.join("، ")+". لا تصل لأي شيء خارجها.",
      "",
      "<span class='k'># التصعيد</span>",
      "أي شيء خارج التعليمات: توقف، لخّصه في سطرين، وارفعه."
    ]);
    return lines.join("\n");
  }
  function instrHtml(e){
    return '<div class="card" style="margin-block-start:16px"><div class="card__h">'+I.pen+'<b>تعليماته</b><span class="cnt">بكلماتك</span></div>'+
      '<div class="card__b"><textarea class="instr" id="instr">'+e.instr+'</textarea>'+
      '<div class="instr__f"><span>عدّل بكلماتك. توريك الفرق قبل ما يسري.</span><button class="bts" id="instrSave">حدّث '+e.n+'</button></div></div>'+
      '<div class="card__h" style="border-block-start:1px solid var(--hair)"><b>كيف فهمها '+e.n+'</b><span class="cnt">كذا يشتغل فعلًا</span></div>'+
      '<div class="card__b"><ul class="how">'+e.how.map(function(h){return '<li>'+h+'</li>'}).join("")+'</ul></div>'+
      '<details class="adv"><summary>'+I.code+'النص الكامل</summary><div class="card__b" style="padding-block-start:0">'+
      '<div class="prompt">'+promptOf(e)+'</div>'+
      '<div class="vers"><button class="ver ver--cur">النسخة 3 · اليوم</button><button class="ver">النسخة 2 · قبل 4 أيام</button><button class="ver">النسخة 1 · التأسيس</button><button class="ver" style="margin-inline-start:auto">عدّل النص يدويًا</button></div>'+
      '<div class="warn">أي تعديل هنا نسخة جديدة. ترجع للسابقة بضغطة.</div>'+
      '</div></details></div>';
  }
  function bindDash(){
    var sv=$("#instrSave"); if(sv) sv.addEventListener("click",function(){
      var e=emp(who); e.instr=$("#instr").value.trim();
      $(".instr__f").innerHTML='<span style="color:var(--ok)">وصل. الفرق بانتظارك في المحادثة.</span>';
      var id="n"+Date.now();
      CHATS[id]={with:"siyadah",t:"تحديث تعليمات "+e.n,when:"today",msgs:[
        {me:true,t:"حدّث تعليمات "+e.n+": «"+e.instr.slice(0,90)+(e.instr.length>90?"…":"")+"»",at:now()},
        {me:false,at:now(),t:"<p>قرأته. وش يتغير عند "+e.n+":</p><p><b>يضاف:</b> …<br><b>يُحذف:</b> …<br><b>يبقى:</b> خطوطه الحمراء.</p><p>أطبّقه؟</p>"}]};
      renderSide();
    });
    var t=$("#thread"), e=emp(who);
    var sw=$(".swx .sw",t); if(sw) sw.addEventListener("click",function(){ var v=this.getAttribute("aria-checked")==="true"; this.setAttribute("aria-checked",!v); e.on=!v; $(".swx span",t).textContent=e.on?"شغّال":"متوقف"; renderSide(); });
    $$(".seg",t).forEach(function(seg){ $$("button",seg).forEach(function(b){ b.addEventListener("click",function(){ $$("button",seg).forEach(function(x){x.setAttribute("aria-pressed","false")}); b.setAttribute("aria-pressed","true"); }); }); });
  }

  function now(){ var d=new Date(); return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); }
  function send(text){
    text=(text||"").trim(); if(!text) return;
    var list = chatId ? CHATS[chatId].msgs : (live.siyadah=live.siyadah||[]);
    var w = "siyadah";
    list.push({me:true,t:text,at:now()});
    if(!chatId && list.length===1){ // أول رسالة تنشئ محادثة في السجل
      var id="n"+Date.now(); CHATS[id]={with:"siyadah",t:text.slice(0,32),when:"today",msgs:list}; chatId=id; live.siyadah=null; renderSide();
    }
    $("#input").value=""; $("#input").style.height="auto"; renderThread();
    setTimeout(function(){
      list.push({me:false,at:now(),t:"<p>وصل. أجهّز لك الخطة، وما يتحرك شيء قبل موافقتك.</p>"});
      renderThread();
    },650);
  }

  /* --- الأحداث --- */
  $("#send").addEventListener("click",function(){ send($("#input").value); });
  $("#input").addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(this.value);} });
  $("#input").addEventListener("input",function(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,160)+"px"; });

  $("#emps").addEventListener("click",function(e){ var b=e.target.closest(".emp"); if(!b) return; who=b.dataset.emp; chatId=null; renderSide(); renderBar(); renderThread(); });
  $(".side__scroll").addEventListener("click",function(e){ var b=e.target.closest(".hist"); if(!b||!b.dataset.chat) return; chatId=b.dataset.chat; who="siyadah"; renderSide(); renderBar(); renderThread(); });
  $("#newChat").addEventListener("click",function(){ chatId=null; who="siyadah"; live={}; renderSide(); renderBar(); renderThread(); $("#input").focus(); });

  /* القائمة الجانبية */
  $("#closeSide").addEventListener("click",function(){ $("#app").classList.add("closed"); $("#app").classList.remove("open"); $("#openSide").setAttribute("aria-expanded","false"); if(mobile()) $("#openSide").focus(); });
  var mobile=function(){ return window.matchMedia("(max-width:820px)").matches; };
  function setDrawer(open){ $("#app").classList.toggle("open",open); $("#openSide").setAttribute("aria-expanded",open?"true":"false"); if(open&&mobile()){ var first=$(".side button,.side a"); if(first) first.focus(); } }
  $("#openSide").addEventListener("click",function(){ $("#app").classList.remove("closed"); setDrawer(!$("#app").classList.contains("open")); });
  $("#scrim").addEventListener("click",function(){ setDrawer(false); $("#openSide").focus(); });
  /* mobile drawer: picking anything in the sidebar closes it */
  $(".side").addEventListener("click",function(e){ if(e.target.closest("button,a")&&mobile()) setTimeout(function(){ setDrawer(false); },0); });

  /* ---------- الأدوات — الكتالوج الكامل (الحقيقي يجي من Activepieces /v1/pieces) ---------- */
  /* الكتالوج الحقيقي من pieces.js: [slug, name, description, category, logo] */
  var ON ={"gmail":"سعد · نورة · فهد","google-sheets":"نورة","google-calendar":"سعد","whatsapp":"سعد · فهد"};
  var SUG={"linkedin":"تحتاجه ريم","hubspot":"يحتاجه سعد","wafeq":"تحتاجه نورة","cal-com":"يحتاجه سعد","instagram-business":"تحتاجه ريم"};
  var TOOLS=(window.PIECES||[]).map(function(p){ return {s:p[0],n:p[1],d:p[2],c:p[3],logo:p[4],on:!!ON[p[0]],by:ON[p[0]]||"",sug:SUG[p[0]]||""}; });
  var CATS=["الكل","المربوطة","مقترحة لك"].concat(
    ["التواصل","المبيعات والعملاء","المحاسبة","المدفوعات","التجارة الإلكترونية","دعم العملاء","التسويق","النماذج","المحتوى والملفات","الإنتاجية","البيانات والتقارير","الموارد البشرية","الذكاء الاصطناعي","أدوات المطوّرين","أخرى"]);
  var SOON=["قيود","سلة","زد","فودكس","ميسر","Unifonic","تابي","دفترة"];
  var tcat="الكل", tq="", tshown=24, picked=null;
  function tcard(t){
    var st=t.on?'<span class="st"><i></i>مربوطة</span>':(t.sug?'<span class="st st--w">'+t.sug+'</span>':'');
    var ini=t.n.replace(/[^A-Za-z\u0600-\u06FF0-9]/g,"").slice(0,2)||"•";
    return '<div class="tl'+(t.on?' tl--on':'')+'"><span class="tl__i"><img src="'+t.logo+'" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1"></span><div><div class="tl__n">'+t.n+'</div>'+
      '<div class="tl__d">'+(t.d||t.c)+(t.on?'<br><span class="who" style="direction:rtl">يستخدمها: '+t.by+'</span>':'')+'</div>'+
      '<div class="tl__f">'+(t.on?'<button class="lnk">إدارة</button>':'<button class="lnk lnk--fill" data-c="'+t.s+'">اربط</button>')+st+'</div></div></div>';
  }
  function tgrid(a,e){ return a.length?'<div class="tgrid">'+a.map(tcard).join("")+'</div>':'<div class="tempty">'+e+'</div>'; }
  function toolsHtml(){
    var f=TOOLS.filter(function(t){return !tq||(t.n+" "+t.d+" "+t.s+" "+t.c).toLowerCase().indexOf(tq)>-1});
    var h='<div class="tools"><h1>الأدوات</h1><p class="sub">'+TOOLS.length+' أداة. اربط اللي تستخدمه، وموظفوك يشتغلون فيه — ولا يوصل موظف لأداة ما ربطتها أنت.</p>'+
      '<div class="tsearch"><span class="drop"></span><input id="tq" placeholder="ابحث… واتساب، قيود، HubSpot" value="'+tq+'"><kbd>/</kbd></div>'+
      '<div class="cats">'+CATS.map(function(c){return '<button class="cat" aria-pressed="'+(c===tcat)+'">'+c+'</button>'}).join("")+'</div>';
    if(tcat==="الكل"&&!tq){
      var on=f.filter(function(t){return t.on}),sug=f.filter(function(t){return t.sug&&!t.on}),rest=f.filter(function(t){return !t.on&&!t.sug});
      h+='<div class="tsec"><b>المربوطة</b>'+on.length+'</div>'+tgrid(on,"ما ربطت شيئًا بعد");
      h+='<div class="tsec"><b>مقترحة لك</b>حسب موظفيك</div>'+tgrid(sug,"—");
      h+='<div class="tsec"><b>كل الأدوات</b>'+TOOLS.length+'</div>'+tgrid(rest.slice(0,tshown),"—");
      if(rest.length>tshown) h+='<button class="more" id="more">اعرض المزيد — باقي '+(rest.length-tshown)+'</button>';
      h+='<div class="soon"><div><b>أدوات سعودية نبنيها لك</b>مو في الكتالوج بعد — نضيفها لك على الطلب.<div class="chips">'+SOON.map(function(x){return '<span>'+x+'</span>'}).join("")+'</div></div><button class="lnk" data-req="1">اطلب أداة</button></div>';
    } else {
      var sub=tcat==="الكل"?f:tcat==="المربوطة"?f.filter(function(t){return t.on}):tcat==="مقترحة لك"?f.filter(function(t){return t.sug}):f.filter(function(t){return t.c===tcat});
      h+='<div class="tsec"><b>'+(tq?'نتائج «'+tq+'»':tcat)+'</b>'+sub.length+'</div>'+tgrid(sub.slice(0,tshown),"ما لقيناها في الكتالوج — اطلبها ونبنيها لك.");
      if(sub.length>tshown) h+='<button class="more" id="more">اعرض المزيد — باقي '+(sub.length-tshown)+'</button>';
    }
    return h+'</div>';
  }
  function bindTools(){
    var t=$("#thread");
    var q=$("#tq",t); q.addEventListener("input",function(){ tq=this.value.trim().toLowerCase(); var pos=this.selectionStart; renderThread(); var nq=$("#tq"); nq.focus(); nq.setSelectionRange(pos,pos); });
    $(".cats",t).addEventListener("click",function(e){ var b=e.target.closest(".cat"); if(!b) return; tcat=b.textContent; tshown=24; renderThread(); });
    if(t.dataset.toolsBound) return; t.dataset.toolsBound="1";
    t.addEventListener("click",function(e){
      var m=e.target.closest("#more"); if(m){ tshown+=24; renderThread(); return; }
      var c=e.target.closest("[data-c]"); if(!c) return;
      picked=TOOLS.filter(function(x){return x.s===c.dataset.c})[0];
      $("#mI").innerHTML='<img src="'+picked.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:26px;height:26px;object-fit:contain">'; $("#mN").textContent=picked.n; $("#mD").textContent="بعد الربط يقدر موظفوك يستخدمون "+picked.n+". "+picked.d+".";
      openModal();
    });
  }
  /* dialog: focus in, trap Tab, Escape closes, focus returns to the opener */
  var modalOpener=null;
  function openModal(){ modalOpener=document.activeElement; $("#modal").classList.add("on"); var f=$("#mGo")||$("#mX"); if(f) f.focus(); }
  function closeModal(){ $("#modal").classList.remove("on"); var back=(modalOpener&&document.contains(modalOpener))?modalOpener:$("#tq"); if(back&&back.focus) back.focus(); modalOpener=null; }
  $("#mX").addEventListener("click",closeModal);
  $("#modal").addEventListener("click",function(e){ if(e.target===this) closeModal(); });
  /* shared Tab trap for dialogs */
  function trapTab(e,root){ if(e.key!=="Tab") return; var f=$$("button,[href],input,textarea,select,[tabindex]:not([tabindex=\"-1\"])",root).filter(function(x){return !x.disabled&&x.offsetParent!==null}); if(!f.length) return; var a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } }
  $("#modal").addEventListener("keydown",function(e){ trapTab(e,$("#modal")); });
  $("#mGo").addEventListener("click",function(){ if(picked){picked.on=true;picked.by="بانتظار تعيين موظف";} closeModal(); $("#toolsCnt").textContent=TOOLS.filter(function(t){return t.on}).length+" مربوطة"; renderThread(); });
  function openTools(){ who="tools"; chatId=null; renderSide(); renderBar(); renderThread(); }
  $("#toolsLink").addEventListener("click",openTools);
  document.addEventListener("keydown",function(e){ if(e.key==="/"&&document.activeElement.tagName!=="INPUT"&&document.activeElement.tagName!=="TEXTAREA"){ e.preventDefault(); openTools(); setTimeout(function(){ var q=$("#tq"); if(q) q.focus(); },30); } });

  /* ---------- قائمة الحساب ---------- */
  var pop=$("#pop");
  $("#meBtn").addEventListener("click",function(e){ e.stopPropagation(); pop.classList.toggle("on"); });
  document.addEventListener("click",function(){ pop.classList.remove("on"); });
  pop.addEventListener("click",function(e){ var b=e.target.closest("[data-open]"); if(!b) return; if(b.dataset.open==="tools") openTools(); else openSheet(b.dataset.open); pop.classList.remove("on"); });

  /* ---------- اللوحة ---------- */
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
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"){ closeSheet(); pop.classList.remove("on"); if($("#modal").classList.contains("on")) closeModal(); if($("#app").classList.contains("open")&&window.matchMedia("(max-width:820px)").matches){ $("#app").classList.remove("open"); $("#openSide").setAttribute("aria-expanded","false"); $("#openSide").focus(); } } });
  $$(".swm").forEach(function(b){ b.addEventListener("click",function(){ this.setAttribute("aria-checked", this.getAttribute("aria-checked")!=="true"); }); });
  $$(".srow .seg").forEach(function(seg){ $$("button",seg).forEach(function(b){ b.addEventListener("click",function(){ $$("button",seg).forEach(function(x){x.setAttribute("aria-pressed","false")}); b.setAttribute("aria-pressed","true"); }); }); });

  renderSide(); renderBar(); renderThread();
})();
