(function(){
  "use strict";
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var step=1, TOTAL=6, picked={}, timers=[];
  var AR=["١","٢","٣","٤","٥","٦"];

  var ROLES={
    sales:  {n:"سعد", ini:"س", r:"متابعة المبيعات", brief:"تابع كل عميل جديد خلال خمس دقائق. اسأله وش يحتاج، وإذا كان جاهزًا احجز له موعدًا معي.", rules:["ما يعطي خصمًا بدون موافقتك","يتابع 3 مرات ثم يتوقف"], tools:["واتساب بزنس","التقويم"]},
    inv:    {n:"نورة", ini:"ن", r:"تحصيل الفواتير", brief:"طالبي بالفواتير اللي تأخرت أكثر من سبعة أيام. لطيفة أولًا، وتوقفي فور السداد.", rules:["ما تهدد بإجراء قانوني","تتوقف فور السداد"], tools:["البريد","الجداول"]},
    support:{n:"فهد", ini:"ف", r:"دعم العملاء", brief:"رد على أسئلة العملاء المتكررة. إذا ما تعرف الجواب قل «بنرجع لك» وارفعها لي.", rules:["يجاوب من معرفتك فقط","يصعّد الغاضب فورًا"], tools:["واتساب بزنس","شات الموقع"]},
    mkt:    {n:"ريم", ini:"ر", r:"التسويق", brief:"جهّزي منشورًا كل يومين عن خدماتنا بصوتنا. ما تنشرين شيئًا قبل ما أوافق.", rules:["ما تنشر قبل موافقتك","ما تذكر أسعارًا"], tools:["لينكدإن"]}
  };
  var CONNS=[
    {n:"واتساب بزنس", i:"W", d:"يرسل ويستقبل من رقمكم"},
    {n:"Gmail", i:"G", d:"البريد"},
    {n:"تقويم Google", i:"C", d:"يحجز المواعيد"}
  ];

  /* نتيجة قراءة الموقع — في المنصة الحقيقية تجي من خدمة الزحف في الخلفية */
  var SITE=null, siteTimer=null;
  function readSite(url){
    var st=$("#siteSt"), tx=$("#siteTx");
    st.style.display="flex"; st.className="site busy"; tx.innerHTML="نقرأ "+url+"…<small>الصفحات، الخدمات، الأسعار، الأسئلة الشائعة</small>";
    clearTimeout(siteTimer);
    siteTimer=setTimeout(function(){
      SITE={pages:14, services:4, faqs:9, pricing:true, tone:"مباشرة وواثقة", name:"شركة الأفق", what:"حلول توصيل للمطاعم في الرياض وجدة"};
      st.className="site ok";
      tx.innerHTML="<b>"+SITE.name+"</b> — "+SITE.what+"<small>قرأنا 14 صفحة · 4 خدمات · الأسعار · 9 أسئلة شائعة · صوت "+SITE.tone+"</small>";
      $("#co").value=SITE.name; $("#what").value=SITE.what; $("#coWrap").style.display="none";
      $("#next").disabled=false;
    }, 2200);
  }
  $("#site").addEventListener("change",function(){ var v=this.value.trim(); if(v.length>3) readSite(v.replace(/^https?:\/\//,"")); });
  $("#noSite").addEventListener("click",function(){ var a=$("#alts"); a.classList.toggle("on"); this.textContent=a.classList.contains("on")?"عندي موقع":"ما عندي موقع"; });
  function readAlt(src){
    var st=$("#siteSt"), tx=$("#siteTx"), label={ig:"حسابك", li:"صفحتكم", file:"ملفك", text:"كلماتك", none:""}[src];
    clearTimeout(siteTimer);
    if(src!=="none"){ st.style.display="flex"; st.className="site busy"; tx.innerHTML="نقرأ "+label+"…"; }
    siteTimer=setTimeout(function(){
      SITE = src==="ig"  ? {pages:48, pagesL:"منشورًا قُرئ", services:3, faqs:6, tone:"ودّية وقريبة", name:"شركة الأفق", what:"حلول توصيل للمطاعم في الرياض وجدة", from:"حسابك"}
           : src==="li"  ? {pages:1,  pagesL:"صفحة شركة",   services:4, faqs:0, tone:"مهنية",       name:"شركة الأفق", what:"حلول توصيل للمطاعم في الرياض وجدة", from:"لينكدإن"}
           : src==="file"? {pages:1,  pagesL:"ملف قُرئ",   services:4, faqs:0, tone:"رسمية",       name:"شركة الأفق", what:"حلول توصيل للمطاعم", from:"ملفك"}
           : src==="text"? {pages:3,  pagesL:"أسطر كتبتها", services:1, faqs:1, tone:"مباشرة",      name:"", what:($("#lines3").value.split("\n")[0]||"").slice(0,70), from:"كلماتك"}
           :               null;
      if(!SITE){ st.style.display="none"; $("#coWrap").style.display="block"; $("#co").focus(); $("#next").disabled=!$("#co").value.trim(); return; }
      st.className="site ok";
      tx.innerHTML="<b>"+(SITE.name||"شركتك")+"</b>"+(SITE.what?" — "+SITE.what:"")+"<small>قرأنا "+SITE.from+" · "+SITE.services+" خدمات · "+(SITE.faqs? SITE.faqs+" أسئلة · ":"بدون أسئلة شائعة — فهد يسألك أول ما يحتاج · ")+"صوت "+SITE.tone+"</small>";
      $("#what").value=SITE.what||"";
      if(SITE.name){ $("#co").value=SITE.name; $("#coWrap").style.display="none"; $("#next").disabled=false; }
      else { $("#coWrap").style.display="block"; $("#co").focus(); $("#next").disabled=!$("#co").value.trim(); }
    }, src==="none"?0:1800);
  }
  $("#alts").addEventListener("click",function(e){ var b=e.target.closest("[data-src]"); if(!b) return; if(b.dataset.src==="none"){ clearTimeout(siteTimer); readAlt("none"); } else readAlt(b.dataset.src); });
  $("#site").addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); this.dispatchEvent(new Event("change")); } });

  function chosen(){ return Object.keys(picked).filter(function(k){return picked[k]}); }
  function first(){ return ROLES[chosen()[0]||"sales"]; }

  function show(){
    $$(".step").forEach(function(s){ s.classList.toggle("on", +s.dataset.step===step); });
    $("#stepLbl").textContent = step<6 ? AR[step-1]+" من ٥" : "جاهز";
    $("#prog").style.width = (Math.min(step,5)/5*100)+"%";
    $("#back").style.visibility = (step===1||step===4||step===6) ? "hidden":"visible";
    var nx=$("#next"), sp=$("#sp");
    sp.textContent="";
    if(step===1){ nx.innerHTML='التالي <span class="drop"></span>'; nx.disabled=!(SITE||$("#co").value.trim()); }
    if(step===2){ nx.innerHTML='التالي <span class="drop"></span>'; nx.disabled=!chosen().length; }
    if(step===3){ nx.innerHTML='ابنِ الفريق <span class="drop"></span>'; nx.disabled=false;
      if(!$("#brief").value.trim()) $("#brief").value = chosen().map(function(k){return ROLES[k].brief}).join("\n\n") + (SITE? "\n\nعرّف عنّا من موقعنا، وجاوب على الأسئلة من اللي فيه.":""); }
    if(step===4){ nx.innerHTML='وافق وشغّل <span class="drop"></span>'; nx.disabled=true; runBuild(); }
    if(step===5){ nx.innerHTML='شغّل '+first().n+' <span class="drop"></span>'; nx.disabled=false; sp.innerHTML='<button class="btn btn--ghost" id="skip">أربط بعدين</button>'; renderConns(); $("#skip").addEventListener("click",function(){ step=6; show(); }); }
    if(step===6){ nx.innerHTML='ادخل المنصة <span class="drop"></span>'; nx.disabled=false;
      var f=first(); $("#doneAv").textContent=f.ini; $("#doneH").textContent=f.n+(f.ini==="ن"||f.ini==="ر"?" شغّالة.":" شغّال."); }
    window.scrollTo({top:0,behavior:"smooth"});
  }

  /* ---------- البناء ---------- */
  function runBuild(){
    timers.forEach(clearTimeout); timers=[];
    var co=$("#co").value.trim()||"شركتك", roles=chosen().map(function(k){return ROLES[k]});
    var lines=[["قرأت طلبك وفهمت "+roles.length+(roles.length===1?" دورًا":" أدوار")]]
      .concat(SITE? [["قرأت "+(SITE.from||"موقعك")+" — "+SITE.pages+" "+(SITE.pagesL||"صفحة")],["استخرجت "+SITE.services+" خدمات"+(SITE.faqs?" و"+SITE.faqs+" أسئلة شائعة":"")],["بنيت قاعدة المعرفة"]] : [["عرّفت "+co+" وما تقدمه"],["قاعدة المعرفة تبدأ فاضية وتكبر من أسئلة عملائك"]])
      .concat(roles.map(function(r){return ["أبني "+r.n+" — "+r.r]}))
      .concat([["أضبط الخطوط الحمراء لكل واحد"],["أجهّز الخطة لموافقتك"]]);
    $("#lines").innerHTML=lines.map(function(l){return '<div class="line"><span class="drop"></span>'+l[0]+'<span class="st">…</span></div>'}).join("");
    var els=$$(".line"), sec=0, clock=$("#clock");
    var tick=setInterval(function(){ sec++; clock.textContent="00:"+("0"+sec).slice(-2); },1000); timers.push(tick);
    els.forEach(function(el,i){
      timers.push(setTimeout(function(){ el.classList.add("on"); },200+i*520));
      timers.push(setTimeout(function(){ el.classList.add("done"); $(".st",el).textContent="تم"; },700+i*520));
    });
    timers.push(setTimeout(function(){
      clearInterval(tick);
      $("#h4").textContent="هذي الخطة. ما يتحرك شيء قبل موافقتك.";
      $("#s4").textContent=(SITE?"قاعدة المعرفة جاهزة من "+(SITE.from||"موقعك")+". ":"قاعدة المعرفة تكبر مع الأسئلة. ")+"كل موظف: وش يسوي، وخطوطه الحمراء، وأدواته. تعدّل أي شيء بعدين بجملة.";
      $("#build").style.display="none";
      $("#plan").style.display="block";
      $("#plan").innerHTML=(SITE? '<div class="kb"><div class="kb__h"><span class="drop"></span><b>قاعدة المعرفة</b>من '+(SITE.from||"موقعك")+' — جاهزة</div>'+
        '<div class="kb__g"><div><div class="kb__v">'+SITE.services+'</div><div class="kb__l">خدمات بوصفها وأسعارها</div></div><div><div class="kb__v">'+SITE.faqs+'</div><div class="kb__l">أسئلة شائعة بأجوبتها</div></div><div><div class="kb__v">'+SITE.pages+'</div><div class="kb__l">'+(SITE.pagesL||"صفحة قُرئت")+'</div></div></div>'+
        '<div class="kb__f">صوت علامتك: <b>'+SITE.tone+'</b> — موظفوك يتكلمون كذا. فهد يجاوب من هنا، وسعد يعرّف الشركة منها.</div></div>' : '')+
        '<div class="plan">'+roles.map(function(r){return '<div class="prow"><span class="av">'+r.ini+'</span><div><b>'+r.n+' · '+r.r+'</b><p>'+r.brief+'</p><div class="rules">'+r.rules.map(function(x){return '<span>'+x+'</span>'}).join("")+r.tools.map(function(x){return '<span style="color:var(--accent);border-color:rgba(11,132,75,.3)">'+x+'</span>'}).join("")+'</div></div></div>'}).join("")+'</div>'+
        '<div class="note"><span class="drop"></span>تقدر توقف أي موظف بضغطة، في أي وقت.</div>';
      $("#next").disabled=false;
    }, 900+els.length*520));
  }

  /* ---------- الربط ---------- */
  function renderConns(){
    $("#conns").innerHTML=CONNS.map(function(c,i){return '<div class="conn'+(c.ok?' ok':'')+'"><span class="av">'+c.i+'</span><div><b>'+c.n+'</b><span>'+c.d+'</span></div>'+
      (c.ok?'<span class="st"><span class="drop" style="width:9px"></span>مربوط</span>':'<button class="btn" style="padding:9px 16px;font-size:.86rem" data-i="'+i+'">اربط</button>')+'</div>'}).join("");
    $$("#conns [data-i]").forEach(function(b){ b.addEventListener("click",function(){ CONNS[b.dataset.i].ok=true; renderConns(); }); });
  }

  /* ---------- الأحداث ---------- */
  $("#next").addEventListener("click",function(){
    if(step===6){ window.location.href="chat.html"; return; }
    step++; show();
  });
  $("#back").addEventListener("click",function(){ if(step>1){ step--; show(); } });
  $("#co").addEventListener("input",function(){ if(step===1) $("#next").disabled=!this.value.trim(); });
  $("#opts").addEventListener("click",function(e){ var b=e.target.closest(".opt"); if(!b) return;
    picked[b.dataset.v]=!picked[b.dataset.v]; b.setAttribute("aria-pressed",picked[b.dataset.v]); $("#next").disabled=!chosen().length; });
  document.addEventListener("keydown",function(e){ if(e.key==="Enter"&&document.activeElement.tagName!=="TEXTAREA"&&!$("#next").disabled){ e.preventDefault(); $("#next").click(); } });

  show();
})();
