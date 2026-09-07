/* ==========================================================================
   الخطة والاستخدام — عقد واحد يقود لوحة «الخطة والاستخدام» واللافتات
   state: trial | active | near | over | pastdue
   ========================================================================== */
var PLAN={ name:"Business", price:499, list:998, period:"شهري", renews:"1 أكتوبر", days:9, state:"active",
           actions:{used:2410, limit:3000}, employees:{used:3, limit:4}, autoReload:false,
           invoices:[{m:"سبتمبر 2026", total:"573.85", url:"#"},{m:"أغسطس 2026", total:"573.85", url:"#"}],
           payment:"مدى •• 4321", vat:"3xxxxxxxxxxxxx3", cr:"1xxxxxxxxx" };

/* ==========================================================================
   بيانات تجريبية
   ========================================================================== */
var EMPS = [
  { id:"saad", n:"سعد", r:"متابعة المبيعات", ini:"س", on:true, wait:1, since:"شغّال منذ 12 يومًا",
    k:[["14","ليد تابعه"],["5","مواعيد حجزها"],["3 د","زمن الرد"]],
    waits:[{t:"محمد العتيبي يطلب خصم 15%.",s:"ما وعدته بشيء.",a:["وافق على الخصم","ارفض بلطف"]}],
    log:[["14:52","حجزت موعدًا مع أحمد الغامدي، الثلاثاء 11:00."],["14:12","رديت على ليد من إنستغرام خلال 3 دقائق."],["12:40","ليدان غير مناسبين — أوقفت المتابعة."],["09:15","متابعة ثانية لـ 6 ليدات ما ردوا."]],
    auto:1, tone:0, hours:"8 ص – 10 م",
    rules:[["ما أعطي خصمًا بدون موافقتك",true],["ما أحجز أكثر من 6 مواعيد باليوم",true],["أتابع الليد 3 مرات كحد أقصى",true],["أرد خارج ساعات العمل",false]],
    tools:["واتساب بزنس","Gmail","تقويم Google","HubSpot"],
    instr:"تابع كل عميل جديد خلال خمس دقائق. اسأله عن حجم فريقه ووش يحتاج بالضبط. إذا كان جاهزًا احجز له موعدًا معي. إذا بارد تابعه بلطف بدون إلحاح. لا تعد بأي شيء عن الأسعار.",
    how:["أرد على الليد الجديد خلال 5 دقائق برسالة تذكر طلبه بالذات","أسأل سؤالين للتأهيل: حجم الفريق والاحتياج","الجاهز أحجز له من تقويمك وأرسل له الرابط","البارد أتابعه 3 مرات بفواصل يومين ثم أتوقف","أي سؤال عن السعر أحوّله لك"] },
  { id:"noura", n:"نورة", r:"تحصيل الفواتير", ini:"ن", on:true, wait:0, since:"شغّالة منذ 12 يومًا",
    k:[["9","فواتير تابعتها"],["41ك","حُصّل هذا الأسبوع"],["6","متأخرة باقية"]],
    waits:[],
    log:[["14:30","ذكّرت النخبة بفاتورة 4302 — 9 أيام تأخير."],["13:47","وصل سداد 4288. أوقفت التذكير."],["11:05","تذكير أول على 4 فواتير."],["09:00","حدّثت تقرير السيولة."]],
    auto:0, tone:0, hours:"9 ص – 6 م",
    rules:[["ما أهدد بإجراء قانوني أبدًا",true],["أتوقف فور وصول السداد",true],["أرفع لك أي فاتورة تجاوزت 30 يومًا",true],["أتواصل عبر الجوال إضافة للبريد",false]],
    tools:["قيود","Google Sheets","Gmail"],
    instr:"طالبي بالفواتير اللي تأخرت أكثر من سبعة أيام. ابدئي لطيفة وزيدي الجدية كل أسبوع. أول ما يسدد العميل توقفي فورًا. لا تهددي بأي إجراء قانوني.",
    how:["أراجع الفواتير كل صباح 9:00","بعد 7 أيام: تذكير لطيف بالبريد","بعد 14 يومًا: تذكير أوضح مع رقم الفاتورة والمبلغ","بعد 21 يومًا: طلب مباشر لموعد سداد","بعد 30 يومًا: أرفعها لك وأتوقف"] },
  { id:"fahad", n:"فهد", r:"دعم العملاء", ini:"ف", on:true, wait:2, since:"شغّال منذ 12 يومًا",
    k:[["28","رسالة رد عليها"],["93%","حلّها بنفسه"],["18 ث","زمن الرد"]],
    waits:[{t:"عميل يطلب تعويضًا عن تأخير شحنة.",s:"اعتذرت. التعويض قرارك.",a:["عوّضه 10%","اعتذر فقط"]},{t:"سؤال ما عندي جوابه.",s:"وعدته بالرد خلال ساعة.",a:["اكتب الجواب","أضفها للمعرفة"]}],
    log:[["14:38","صعّدت لك شكوى شحنة — يطلب تعويضًا."],["13:20","7 أسئلة عن الاسترجاع — حُلّت."],["11:48","4 استفسارات أسعار."],["09:30","«هل فيه تطبيق؟» تكرر 5 مرات — يستاهل جوابًا."]],
    auto:1, tone:1, hours:"24 ساعة",
    rules:[["ما أعد بتعويض أو استرجاع بدون موافقتك",true],["أصعّد أي عميل غاضب فورًا",true],["أجاوب من قاعدة المعرفة فقط",true],["أرد بالإنجليزي إذا كتب العميل بالإنجليزي",true]],
    tools:["واتساب بزنس","شات الموقع","Gmail","قاعدة المعرفة"],
    instr:"رد على أسئلة العملاء من قاعدة المعرفة فقط. إذا ما تعرف الجواب قل «بنرجع لك» وارفعها لي. أي عميل غاضب أو يطلب تعويضًا صعّده لي فورًا مع ملخص.",
    how:["أرد خلال ثوانٍ من الأسعار والسياسات المرفوعة","ما أخترع جوابًا مو موجود في المعرفة","أرفع لك أي سؤال جديد مع اقتراح إضافته","العميل الغاضب يوصلك خلال دقيقة مع ملخص جاهز","أرد بلغة العميل: عربي أو إنجليزي"] },
  { id:"reem", n:"ريم", r:"التسويق", ini:"ر", on:false, wait:1, since:"متوقفة — تحتاج ربط حساب",
    k:[["—","منشور مجدول"],["—","بريدية"],["—","تفاعل"]],
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
    var n=(img.closest(".card,.tl")||{}).querySelector ? (img.closest(".card,.tl").querySelector(".card__n,.tl__n")||{}).textContent||"" : "";
    var ini=n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•"; img.replaceWith(document.createTextNode(ini)); },true);
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var who="siyadah", chatId=null, live={}, eth={};
  var AUTON=["ينفّذ ويبلغك","يستأذنك أولًا","يقترح فقط"], TONE=["رسمي","ودّي"];

  function emp(id){ return EMPS.filter(function(e){return e.id===id})[0]; }
  function isEmp(){ return who!=="siyadah"&&who!=="tools"; }
  function avHtml(id){ return (id==="siyadah"||!emp(id)) ? '<span class="drop"></span>' : emp(id).ini; }
  function name(id){ return (id==="siyadah"||!emp(id)) ? "سيادة" : emp(id).n; }
  function fmt(n){ return String(n).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
  function now(){ var d=new Date(); return ("0"+d.getHours()).slice(-2)+":"+("0"+d.getMinutes()).slice(-2); }

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
    $("#hqNone").hidden=any||!q;
  }

  /* --- الشريط العلوي + المحرر --- */
  function renderBar(){
    $("#whoAv").innerHTML = who==="tools" ? '<svg class="ic" viewBox="0 0 24 24" style="width:12px;height:12px"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 01-12 0V8zM12 17v4"/></svg>' : avHtml(who);
    $("#whoN").textContent = who==="tools" ? "الأدوات" : (isEmp() ? name(who)+" · "+emp(who).r : "سيادة");
    $(".comp").style.display = who==="tools" ? "none" : "";
    $("#input").placeholder = isEmp() ? "اكتب ل"+name(who)+"…" : "اكتب لسيادة…";
  }

  /* --- الرسائل --- */
  function planHtml(){
    return '<div class="plan"><div class="plan__h"><span class="drop"></span>الخطة</div>'+
      '<div class="prow"><b>سعد · متابعة المبيعات</b><span>يرد على كل ليد خلال 5 دقائق، يؤهّله، ويحجز موعدًا للجاهزين. واتساب، البريد، التقويم.</span></div>'+
      '<div class="prow"><b>نورة · تحصيل الفواتير</b><span>تذكّر بعد 7 أيام، تصعّد النبرة أسبوعيًا، وتتوقف فور السداد. الفوترة، الجداول.</span></div>'+
      '<div class="prow"><b>فهد · دعم العملاء</b><span>يجاوب من أسعارك وسياساتك ويصعّد الحساس مع ملخص. واتساب، شات الموقع.</span></div></div>'+
      '<div class="approve"><button type="button" class="bt" data-approve="1">وافق وشغّل <span class="drop"></span></button><button type="button" class="bt bt--line" data-editplan="1">عدّل الخطة</button><small>توقفه متى تبي.</small></div>';
  }
  function waitHtml(w){
    return '<p>'+w.t+'<small>'+w.s+'</small></p><div class="wait__a"><button type="button" class="bts">'+I.check+w.a[0]+'</button><button type="button" class="bts bts--line">'+I.x+w.a[1]+'</button></div>';
  }
  function msgHtml(m, w){
    if(m.me) return '<div class="m m--me"><div class="m__b">'+m.t+'<span class="m__t">'+m.at+'</span></div></div>';
    var body = m.wait ? waitHtml(m.wait) : (m.t.indexOf("<p>")===0? m.t : '<p>'+m.t+'</p>') + (m.plan? planHtml():'');
    return '<div class="m m--ai"><span class="m__av">'+avHtml(w)+'</span><div class="m__b">'+body+
      '<span class="m__t">'+name(w)+' · '+m.at+'</span><div class="act"><button type="button">'+I.copy+'نسخ</button><button type="button">'+I.why+'ليش؟</button></div></div></div>';
  }
  function renderThread(){
    var t=$("#thread");
    if(who==="tools"){ t.innerHTML=toolsHtml(); bindTools(); return; }
    if(isEmp()){ var e=emp(who);
      t.innerHTML='<div class="col">'+pinHtml(e)+'<div id="instrWrap" hidden>'+instrHtml(e)+'</div>'+empThread(who).map(function(m){return msgHtml(m,who)}).join("")+'</div>';
      t.scrollTop=t.scrollHeight; return;
    }
    var msgs = chatId ? CHATS[chatId].msgs : (live.siyadah||[]);
    if(!msgs.length){
      t.innerHTML='<div class="empty"><span class="drop"></span><h1>وش تبي فريقك يسوي؟</h1>'+
        '<p>قول اللي تبيه. سيادة تبني الفريق، وتوريك الخطة قبل ما يتحرك شيء.</p>'+
        '<div class="cards">'+SUGG.siyadah.map(function(s){return '<button type="button" class="cardq"><small>'+I[s[0]]+s[1]+'</small>'+s[2]+'</button>'}).join("")+'</div></div>';
      return;
    }
    t.innerHTML='<div class="col">'+msgs.map(function(m){return msgHtml(m, chatId? CHATS[chatId].with : who)}).join("")+'</div>';
    t.scrollTop=t.scrollHeight;
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
  function summary(e){ return "اليوم: "+e.k.map(function(k){return k[0]+" "+k[1]}).join(" · ")+(e.wait?" · "+e.wait+" ينتظر قرارك":""); }
  function pinHtml(e){
    return '<div class="pin"><span class="av">'+e.ini+'</span><div class="pin__t"><p class="pin__n">'+e.n+' <span>· '+e.r+'</span></p><div class="pin__s">'+summary(e)+'</div></div>'+
      '<div class="pin__c">'+(e.wait?'<span class="pill">ينتظر قرارك '+e.wait+'</span>':'')+
      '<span class="swl" style="font-size:.8rem;color:var(--ash)"><span id="onLbl">'+(e.on?'شغّال':'متوقف')+'</span><button type="button" class="sw" id="onSw" role="switch" aria-checked="'+e.on+'" aria-label="تشغيل '+e.n+'"></button></span>'+
      '<button type="button" class="link" id="instrTgl" aria-expanded="false" aria-controls="instrWrap">التعليمات</button></div></div>';
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
  /* حدوده — جُمل عادية بدل أزرار: الصلاحية، النبرة، الساعات، الخطوط الحمراء، الأدوات */
  function limitsHtml(e){
    var red=e.rules.filter(function(r){return r[1]}).map(function(r){return r[0]});
    return '<div class="card__h" style="border-block-start:1px solid var(--hair)">'+I.shield+'<b>حدوده</b><span class="cnt">تسري فورًا</span></div>'+
      '<div class="card__b"><p>صلاحيته: '+AUTON[e.auto]+'. نبرته: '+TONE[e.tone]+'. يشتغل: '+e.hours+'.</p>'+
      '<p>خطوطه الحمراء: '+red.join('، ')+'.</p>'+
      '<p>أدواته: '+e.tools.join('، ')+' — ولا شيء غيرها.</p></div>';
  }
  function instrHtml(e){
    return '<div class="card"><div class="card__h">'+I.pen+'<b>تعليماته</b><span class="cnt">بكلماتك</span></div>'+
      '<div class="card__b"><textarea class="instr" id="instr" aria-label="تعليمات '+e.n+'">'+e.instr+'</textarea>'+
      '<div class="instr__f" id="instrF"><span>عدّل بكلماتك. توريك الفرق قبل ما يسري.</span><button type="button" class="bts" id="instrSave">حدّث '+e.n+'</button></div></div>'+
      limitsHtml(e)+
      '<div class="card__h" style="border-block-start:1px solid var(--hair)"><b>كيف فهمها '+e.n+'</b><span class="cnt">كذا يشتغل فعلًا</span></div>'+
      '<div class="card__b"><ul class="how">'+e.how.map(function(h){return '<li>'+h+'</li>'}).join("")+'</ul></div>'+
      '<details class="adv"><summary>'+I.code+'النص الكامل</summary><div class="card__b" style="padding-block-start:0">'+
      '<div class="prompt">'+promptOf(e)+'</div>'+
      '<div class="vers"><span>النسخة 3 · اليوم</span><button type="button" class="link" id="instrPrev">استرجع النسخة السابقة</button></div>'+
      '</div></details></div>';
  }

  /* ---------- الإرسال ---------- */
  function isBuild(t){ return /أبي|أبغى|ابن|وظّف|وظف|موظف|يتابع|يطارد|يطالب|يرد على/.test(t); }
  function send(text){
    text=(text||"").trim(); if(!text||who==="tools") return;
    var list, w=who;
    if(isEmp()) list=empThread(who);
    else {
      list = chatId ? CHATS[chatId].msgs : (live.siyadah=live.siyadah||[]);
      if(!chatId && !list.length){ // أول رسالة تنشئ محادثة في السجل
        var id="n"+Date.now(); CHATS[id]={with:"siyadah",t:text.slice(0,32),when:"today",msgs:list}; chatId=id; live.siyadah=null;
      }
    }
    list.push({me:true,t:text,at:now()});
    if(!isEmp()) renderSide();
    $("#input").value=""; $("#input").style.height="auto"; renderThread();
    setTimeout(function(){
      if(w==="siyadah"&&isBuild(text)) list.push({me:false,plan:true,at:now(),t:"جهّزت ثلاثة. هذي خطتهم — ما يتحرك شيء قبل موافقتك:"});
      else list.push({me:false,at:now(),t:"<p>وصل. أجهّز لك الخطة، وما يتحرك شيء قبل موافقتك.</p>"});
      if(who===w) renderThread();
    },650);
  }
  function reply(list,html){ list.push({me:false,at:now(),t:html}); renderThread(); }

  /* --- الأحداث --- */
  $("#send").addEventListener("click",function(){ send($("#input").value); });
  $("#input").addEventListener("keydown",function(e){ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(this.value);} });
  $("#input").addEventListener("input",function(){ this.style.height="auto"; this.style.height=Math.min(this.scrollHeight,160)+"px"; });

  function go(w,c){ who=w; chatId=c||null; renderSide(); renderBar(); renderThread(); }
  function newChat(){ live={}; go("siyadah"); $("#input").focus(); }
  $("#emps").addEventListener("click",function(e){ var b=e.target.closest(".emp"); if(!b) return; go(b.dataset.emp); $("#input").focus(); });
  $(".side__scroll").addEventListener("click",function(e){ var b=e.target.closest(".hist"); if(!b||!b.dataset.chat) return; go("siyadah",b.dataset.chat); });
  $("#newChat").addEventListener("click",newChat);
  $("#hq").addEventListener("input",filterHist);

  /* كل نقرة داخل المحادثة — مستمع واحد */
  $("#thread").addEventListener("click",function(e){
    var t=e.target, list;
    var c=t.closest(".cardq"); if(c){ send(c.lastChild.textContent); return; }
    if(t.closest("[data-approve]")){ list = chatId ? CHATS[chatId].msgs : live.siyadah; if(!list) return;
      list.push({me:true,t:"وافق وشغّل",at:now()}); reply(list,"<p>شغّلتهم. سعد ونورة وفهد يشتغلون من الحين — وأول شيء يحتاج قرارك يوصلك هنا.</p>"); return; }
    if(t.closest("[data-editplan]")){ $("#input").placeholder="وش تعدّل في الخطة؟"; $("#input").focus(); return; }
    if(t.closest("#instrTgl")){ var w=$("#instrWrap"), b=$("#instrTgl"); w.hidden=!w.hidden; b.setAttribute("aria-expanded",String(!w.hidden)); if(!w.hidden){ $("#thread").scrollTop=0; $("#instr").focus(); } return; }
    if(t.closest("#onSw")){ var sw=$("#onSw"), en=emp(who), v=sw.getAttribute("aria-checked")==="true"; sw.setAttribute("aria-checked",String(!v)); en.on=!v; $("#onLbl").textContent=en.on?"شغّال":"متوقف"; renderSide(); return; }
    if(t.closest("#instrSave")){ var en2=emp(who); en2.instr=$("#instr").value.trim();
      $("#instrF").innerHTML='<span style="color:var(--ok)">وصل. الفرق تحت في المحادثة.</span>';
      list=empThread(who); list.push({me:true,t:"حدّث تعليماتك: «"+en2.instr.slice(0,90)+(en2.instr.length>90?"…":"")+"»",at:now()});
      reply(list,"<p>قرأته. وش يتغير عندي:</p><p><b>يضاف:</b> …<br><b>يُحذف:</b> …<br><b>يبقى:</b> خطوطي الحمراء.</p><p>أطبّقه؟</p>"); return; }
    if(t.closest("#instrPrev")){ var v2=$(".vers"); v2.innerHTML='<span style="color:var(--ok)">رجعت النسخة 2 · قبل 4 أيام. النسخة 3 محفوظة لو غيّرت رأيك.</span>'; return; }
    var m=t.closest("#more"); if(m){ tshown+=24; renderThread(); return; }
    var cc=t.closest("[data-c]"); if(cc){
      picked=TOOLS.filter(function(x){return x.s===cc.dataset.c})[0];
      $("#mI").innerHTML='<img src="'+picked.logo+'" alt="" crossorigin="anonymous" referrerpolicy="no-referrer" style="width:26px;height:26px;object-fit:contain">'; $("#mN").textContent=picked.n; $("#mD").textContent="بعد الربط يقدر موظفوك يستخدمون "+picked.n+". "+picked.d+".";
      openModal();
    }
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
  var SUG={"linkedin":"تحتاجه ريم","hubspot":"يحتاجه سعد","wafeq":"تحتاجه نورة","cal-com":"يحتاجه سعد","instagram-business":"تحتاجه ريم"};
  var TOOLS=(window.PIECES||[]).map(function(p){ return {s:p[0],n:p[1],d:p[5]||p[2],en:p[2],c:p[3],logo:p[4],on:!!ON[p[0]],by:ON[p[0]]||"",sug:SUG[p[0]]||""}; });
  var SOON=["قيود","سلة","زد","فودكس","ميسر","Unifonic","تابي","دفترة"];
  var tq="", tshown=24, picked=null;
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
  function openModal(){ modalOpener=document.activeElement; $("#modal").classList.add("on"); var f=$("#mGo")||$("#mX"); if(f) f.focus(); }
  function closeModal(){ $("#modal").classList.remove("on"); var back=(modalOpener&&document.contains(modalOpener))?modalOpener:$("#tq"); if(back&&back.focus) back.focus(); modalOpener=null; }
  $("#mX").addEventListener("click",closeModal);
  $("#modal").addEventListener("click",function(e){ if(e.target===this) closeModal(); });
  /* shared Tab trap for dialogs */
  function trapTab(e,root){ if(e.key!=="Tab") return; var f=$$("button,[href],input,textarea,select,[tabindex]:not([tabindex=\"-1\"])",root).filter(function(x){return !x.disabled&&x.offsetParent!==null}); if(!f.length) return; var a=f[0],z=f[f.length-1]; if(e.shiftKey&&document.activeElement===a){ e.preventDefault(); z.focus(); } else if(!e.shiftKey&&document.activeElement===z){ e.preventDefault(); a.focus(); } }
  $("#modal").addEventListener("keydown",function(e){ trapTab(e,$("#modal")); });
  $("#mGo").addEventListener("click",function(){ if(picked){picked.on=true;picked.by="بانتظار تعيين موظف";} closeModal(); $("#toolsCnt").textContent=TOOLS.filter(function(t){return t.on}).length+" مربوطة"; renderThread(); });
  function openTools(){ go("tools"); }
  $("#toolsLink").addEventListener("click",openTools);

  /* ---------- قائمة الحساب ---------- */
  var pop=$("#pop");
  $("#meBtn").addEventListener("click",function(e){ e.stopPropagation(); pop.classList.toggle("on"); });
  document.addEventListener("click",function(e){ pop.classList.remove("on");
    var b=e.target.closest("[data-open]"); if(!b) return; if(b.dataset.open==="tools") openTools(); else openSheet(b.dataset.open); });

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

  /* الخطة والاستخدام — كل شيء من PLAN */
  function srow(l,body){ return '<div class="srow"><div>'+l+'</div><div>'+body+'</div></div>'; }
  function renderPlan(){
    var p=PLAN, st=p.state, pct=Math.min(100,Math.round(p.actions.used/p.actions.limit*100));
    var used='<span class="num">'+fmt(p.actions.used)+' / '+fmt(p.actions.limit)+'</span> إجراء';
    var h='';
    if(st==="trial") h+=srow('الخطة','<div>تجربة · باقي '+p.days+' أيام · '+used+'</div><div class="acts"><button type="button" class="lnk lnk--fill">اختر خطتك</button></div>');
    else h+=srow('الخطة','<div><span class="price">'+p.name+' · <span class="num">'+p.price+'</span> ر.س/شهر<s class="num">'+p.list+'</s></span><span class="tag">الوصول المبكر</span></div>'+
      '<div class="acts"><button type="button" class="lnk lnk--fill">ترقية</button><button type="button" class="lnk">إدارة</button><small>'+(st==="pastdue"?'فشل الدفع — حدّث البطاقة':'يتجدد '+p.renews)+'</small></div>');
    h+=srow('الاستخدام','<div class="use'+(st==="near"?' use--warn':(st==="over"?' use--bad':''))+'" role="progressbar" aria-label="الإجراءات المستخدمة" aria-valuemin="0" aria-valuemax="'+p.actions.limit+'" aria-valuenow="'+p.actions.used+'"><i style="width:'+pct+'%"></i></div>'+
      '<small>'+used+' · '+(st==="over"?'نفد الرصيد — ':'')+'يتجدد خلال '+p.days+' أيام</small>'+
      '<div class="acts"><button type="button" class="lnk'+(st==="over"?' lnk--fill':'')+'">أضف رصيدًا</button><span class="swl"><button type="button" class="swm" id="autoSw" role="switch" aria-checked="'+p.autoReload+'" aria-label="تعبئة تلقائية"></button>تعبئة تلقائية عند النفاد</span></div>');
    h+=srow('الموظفون','<span class="num">'+p.employees.used+' / '+p.employees.limit+'</span><div class="acts"><button type="button" class="lnk">وظّف موظفًا</button></div>');
    h+=srow('الفواتير','<ul class="inv">'+p.invoices.map(function(i){return '<li><span>'+i.m+'</span><small><span class="num">'+i.total+'</span> ر.س شامل الضريبة</small><a href="'+i.url+'">PDF</a></li>'}).join("")+'</ul>');
    h+=srow('الدفع','<div>'+p.payment+' <button type="button" class="lnk" style="margin-inline-start:8px">تغيير</button></div>'+
      '<div class="acts"><small>الرقم الضريبي <span class="num">'+p.vat+'</span> · السجل التجاري <span class="num">'+p.cr+'</span></small><button type="button" class="lnk">تعديل</button></div>');
    $("#pane-plan").innerHTML=h;
    $("#setPlanSum").textContent=(st==="trial"?"تجربة":p.name)+" · "+fmt(p.actions.used)+" / "+fmt(p.actions.limit)+" إجراء";
    /* اللافتة فوق المحادثة + الشارة في صف الحساب */
    var b=$("#pban");
    if(st==="over"){ b.hidden=false; b.className="pban"; b.innerHTML='<span>توقف التنفيذ حتى التجديد أو إضافة رصيد.</span><button type="button" class="lnk" data-open="plan">أضف رصيدًا</button>'; }
    else if(st==="pastdue"){ b.hidden=false; b.className="pban pban--bad"; b.innerHTML='<span>فشل الدفع · 7 أيام قبل الإيقاف.</span><button type="button" class="lnk" data-open="plan">حدّث البطاقة</button>'; }
    else b.hidden=true;
    var pill=$("#mePill"); pill.hidden=st!=="near"; pill.textContent=pct+"% من الإجراءات";
  }
  window.renderPlan=renderPlan; /* للنموذج: غيّر PLAN.state ثم renderPlan() */

  /* ---------- لوحة المفاتيح ---------- */
  document.addEventListener("keydown",function(e){
    var tag=document.activeElement.tagName, typing=tag==="INPUT"||tag==="TEXTAREA", mod=e.metaKey||e.ctrlKey, k=e.key.toLowerCase();
    if(e.key==="Escape"){ closeSheet(); pop.classList.remove("on"); if($("#modal").classList.contains("on")) closeModal();
      if($("#app").classList.contains("open")&&mobile()){ $("#app").classList.remove("open"); $("#openSide").setAttribute("aria-expanded","false"); $("#openSide").focus(); } return; }
    if(mod&&k==="k"){ e.preventDefault(); $("#app").classList.remove("closed"); if(mobile()) setDrawer(true); $("#hq").focus(); $("#hq").select(); return; }
    if(mod&&e.shiftKey&&k==="o"){ e.preventDefault(); closeSheet(); newChat(); return; }
    if(e.key==="/"&&!typing&&!mod){ e.preventDefault(); openTools(); setTimeout(function(){ var q=$("#tq"); if(q) q.focus(); },30); }
  });

  renderSide(); renderBar(); renderThread(); renderPlan();
})();
