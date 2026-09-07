(function(){
  "use strict";
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var step=1, TOTAL=4, timers=[], roles=[];

  /* الأدوار — تُستنتج من جملتك بالكلمات المفتاحية؛ إذا ما طابق شيء نبني الأربعة */
  var ROLES={
    sales:  {n:"سعد", ini:"س", r:"متابعة المبيعات", brief:"تابع كل عميل جديد خلال خمس دقائق. اسأله وش يحتاج، وإذا كان جاهزًا احجز له موعدًا معي.", rules:["ما يعطي خصمًا بدون موافقتك","يتابع 3 مرات ثم يتوقف"], tools:["واتساب بزنس","التقويم"]},
    inv:    {n:"نورة", ini:"ن", r:"تحصيل الفواتير", brief:"طالبي بالفواتير اللي تأخرت أكثر من سبعة أيام. لطيفة أولًا، وتوقفي فور السداد.", rules:["ما تهدد بإجراء قانوني","تتوقف فور السداد"], tools:["البريد","الجداول"]},
    support:{n:"فهد", ini:"ف", r:"دعم العملاء", brief:"رد على أسئلة العملاء المتكررة. إذا ما تعرف الجواب قل «بنرجع لك» وارفعها لي.", rules:["يجاوب من معرفتك فقط","يصعّد الغاضب فورًا"], tools:["واتساب بزنس","شات الموقع"]},
    mkt:    {n:"ريم", ini:"ر", r:"التسويق", brief:"جهّزي منشورًا كل يومين عن خدماتنا بصوتنا. ما تنشرين شيئًا قبل ما أوافق.", rules:["ما تنشر قبل موافقتك","ما تذكر أسعارًا"], tools:["لينكدإن"]}
  };
  var KEYS=[["sales",/مبيعات|عملاء/],["inv",/فواتير|تحصيل/],["support",/دعم/],["mkt",/تسويق/]];
  function derive(text){ var r=KEYS.filter(function(k){return k[1].test(text)}).map(function(k){return k[0]}); return r.length? r : ["sales","inv","support","mkt"]; }

  /* نتيجة قراءة الموقع — في المنصة الحقيقية تجي من خدمة الزحف في الخلفية */
  var SITE=null, siteTimer=null;
  function readSite(url){
    var st=$("#siteSt"), tx=$("#siteTx");
    st.style.display="flex"; st.className="site busy"; tx.innerHTML="نقرأ "+url+"…<small>الصفحات، الخدمات، الأسعار، الأسئلة الشائعة</small>";
    clearTimeout(siteTimer);
    siteTimer=setTimeout(function(){
      SITE={pages:14, pagesL:"صفحة", services:4, faqs:9, tone:"مباشرة وواثقة", name:"شركة الأفق", what:"حلول توصيل للمطاعم في الرياض وجدة", from:"موقعك"};
      st.className="site ok";
      tx.innerHTML="<b>"+SITE.name+"</b> — "+SITE.what+"<small>قرأنا 14 صفحة · 4 خدمات · الأسعار · 9 أسئلة شائعة · صوت "+SITE.tone+"</small>";
      $("#next").disabled=false;
    }, 2200);
  }
  /* بدون موقع: ثلاثة أسطر بكلماتك تكفي */
  function readLines(){
    var what=($("#lines3").value.split("\n")[0]||"").trim().slice(0,70);
    SITE={pages:3, pagesL:"أسطر كتبتها", services:1, faqs:1, tone:"مباشرة", name:$("#co").value.trim()||"شركتك", what:what, from:"كلماتك"};
  }
  function noSiteOn(){ return $("#alts").classList.contains("on"); }
  function step1Ready(){ return noSiteOn() ? !!$("#lines3").value.trim() : !!SITE; }
  $("#site").addEventListener("change",function(){ var v=this.value.trim(); if(v.length>3) readSite(v.replace(/^https?:\/\//,"")); });
  $("#site").addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); this.dispatchEvent(new Event("change")); } });
  $("#noSite").addEventListener("click",function(){ var a=$("#alts"), on=!a.classList.contains("on"); a.classList.toggle("on",on); this.setAttribute("aria-expanded",String(on)); this.textContent=on?"عندي موقع":"ما عندي موقع";
    if(on){ clearTimeout(siteTimer); $("#siteSt").style.display="none"; SITE=null; $("#lines3").focus(); } $("#next").disabled=!step1Ready(); });
  $("#lines3").addEventListener("input",function(){ if(step===1) $("#next").disabled=!step1Ready(); });
  $("#brief").addEventListener("input",function(){ if(step===2) $("#next").disabled=!this.value.trim(); });

  function first(){ return ROLES[roles[0]||"sales"]; }

  function show(){
    $$(".step").forEach(function(s){ s.classList.toggle("on", +s.dataset.step===step); });
    $("#stepLbl").textContent = step+" من "+TOTAL;
    $("#prog").style.width = (step/TOTAL*100)+"%";
    var nx=$("#next"), bk=$("#back");
    bk.style.visibility = (step===2||step===3) ? "visible":"hidden";
    bk.textContent = step===3 ? "عدّل" : "رجوع";
    if(step===1){ nx.innerHTML='التالي <span class="drop"></span>'; nx.disabled=!step1Ready(); }
    if(step===2){ nx.innerHTML='ابنِ الفريق <span class="drop"></span>'; nx.disabled=!$("#brief").value.trim(); $("#brief").focus(); }
    if(step===3){ nx.innerHTML='وافق وشغّل <span class="drop"></span>'; nx.disabled=true; runBuild(); }
    if(step===4){ nx.innerHTML='ادخل المنصة <span class="drop"></span>'; nx.disabled=false;
      var f=first(); $("#doneAv").textContent=f.ini; $("#doneH").textContent=f.n+(f.ini==="ن"||f.ini==="ر"?" شغّالة.":" شغّال."); }
    window.scrollTo({top:0,behavior:"smooth"});
  }

  /* ---------- البناء ---------- */
  function runBuild(){
    timers.forEach(clearTimeout); timers=[];
    $("#build").style.display=""; $("#plan").style.display="none";
    $("#h3").textContent="لحظة… أقرأ طلبك."; $("#s3").textContent="أبني الموظفين — وأوريك الخطة قبل ما يتحرك شيء."; $("#clock").textContent="00:00";
    var co=SITE?SITE.name:"شركتك", rs=roles.map(function(k){return ROLES[k]});
    var lines=[["قرأت طلبك وفهمت "+rs.length+(rs.length===1?" دورًا":" أدوار")]]
      .concat(SITE? [["قرأت "+SITE.from+" — "+SITE.pages+" "+SITE.pagesL],["استخرجت "+SITE.services+" خدمات"+(SITE.faqs?" و"+SITE.faqs+" أسئلة شائعة":"")],["بنيت قاعدة المعرفة"]] : [["عرّفت "+co+" وما تقدمه"],["قاعدة المعرفة تبدأ فاضية وتكبر من أسئلة عملائك"]])
      .concat(rs.map(function(r){return ["أبني "+r.n+" — "+r.r]}))
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
      $("#h3").textContent="هذي الخطة. ما يتحرك شيء قبل موافقتك.";
      $("#s3").textContent=(SITE?"قاعدة المعرفة جاهزة من "+SITE.from+". ":"قاعدة المعرفة تكبر مع الأسئلة. ")+"كل موظف: وش يسوي، وخطوطه الحمراء، وأدواته. تعدّل أي شيء بعدين بجملة.";
      $("#build").style.display="none";
      $("#plan").style.display="block";
      $("#plan").innerHTML=(SITE? '<div class="kb"><div class="kb__h"><span class="drop"></span><b>قاعدة المعرفة</b>من '+SITE.from+' — جاهزة</div>'+
        '<div class="kb__g"><div><div class="kb__v">'+SITE.services+'</div><div class="kb__l">خدمات بوصفها وأسعارها</div></div><div><div class="kb__v">'+SITE.faqs+'</div><div class="kb__l">أسئلة شائعة بأجوبتها</div></div><div><div class="kb__v">'+SITE.pages+'</div><div class="kb__l">'+SITE.pagesL+'</div></div></div>'+
        '<div class="kb__f">صوت علامتك: <b>'+SITE.tone+'</b> — موظفوك يتكلمون كذا.</div></div>' : '')+
        '<div class="plan">'+rs.map(function(r){return '<div class="prow"><span class="av">'+r.ini+'</span><div><b>'+r.n+' · '+r.r+'</b><p>'+r.brief+'</p><div class="rules">'+r.rules.map(function(x){return '<span>'+x+'</span>'}).join("")+r.tools.map(function(x){return '<span style="color:var(--accent);border-color:rgba(11,132,75,.3)">'+x+'</span>'}).join("")+'</div></div></div>'}).join("")+'</div>'+
        '<div class="note"><span class="drop"></span>تقدر توقف أي موظف بضغطة، في أي وقت. الأدوات يطلبها كل موظف وقت ما يحتاجها.</div>';
      $("#next").disabled=false;
    }, 900+els.length*520));
  }

  /* ---------- الأحداث ---------- */
  $("#next").addEventListener("click",function(){
    if(step===4){ window.location.href="chat.html"; return; }
    if(step===1&&noSiteOn()) readLines();
    if(step===2) roles=derive($("#brief").value);
    step++; show();
  });
  $("#back").addEventListener("click",function(){ if(step>1){ timers.forEach(clearTimeout); timers=[]; step--; show(); } });
  document.addEventListener("keydown",function(e){ if(e.key==="Enter"&&document.activeElement.tagName!=="TEXTAREA"&&!$("#next").disabled){ e.preventDefault(); $("#next").click(); } });

  show();
})();
