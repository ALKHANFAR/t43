(function(){
  "use strict";
  var $=function(id){return document.getElementById(id)};
  var stage=$("stage");

  /* ---------- المشاهد: مصدر الحقيقة ---------- */
  var SCENES=[
    {id:"s0",name:"الفرق",     start:0,   end:8,   dark:true},
    {id:"s1",name:"جملة وحدة", start:8,   end:34,  dark:false},
    {id:"s3",name:"ثلاث شركات",start:34,  end:64,  dark:false},
    {id:"s4",name:"السيطرة",   start:64,  end:82,  dark:false},
    {id:"s5",name:"المساءلة",  start:82,  end:98,  dark:false},
    {id:"s6",name:"المعرفة",   start:98,  end:114, dark:false},
    {id:"s8",name:"الختام",    start:114, end:120, dark:true}
  ];
  var TOTAL=120, t=0, playing=false, last=null, prevT=-1, curScene=null;
  function clamp(v,a,b){return Math.min(Math.max(v,a),b)}
  function seg(t,a,b){return clamp((t-a)/(b-a),0,1)}
  function ease(p){return 1-Math.pow(1-p,3)}
  function on(id,v){var e=$(id); if(e) e.classList.toggle("in",!!v)}
  function typeInto(id,cid,text,t0,dur,t){ var p=seg(t,t0,t0+dur); $(id).textContent=text.slice(0,Math.floor(p*text.length)); $(cid).style.display=(t>=t0&&p<1)?"inline-block":"none"; }
  function count(el,t0,dur,t){ var to=+el.dataset.to; el.textContent=Math.round(to*ease(seg(t,t0,t0+dur))); }

  /* ---------- الصوت المولّد ---------- */
  var AC=null,master=null;
  function initAudio(){ if(AC) return; try{ AC=new (window.AudioContext||window.webkitAudioContext)(); master=AC.createGain(); master.gain.value=.9; master.connect(AC.destination);}catch(e){} }
  function noise(dur){ var b=AC.createBuffer(1,AC.sampleRate*dur,AC.sampleRate),d=b.getChannelData(0); for(var i=0;i<d.length;i++) d[i]=Math.random()*2-1; var s=AC.createBufferSource(); s.buffer=b; return s; }
  function click(hz){ if(!AC) return; var s=noise(.02),f=AC.createBiquadFilter(),g=AC.createGain(); f.type="highpass"; f.frequency.value=hz||3200; g.gain.value=.05; s.connect(f); f.connect(g); g.connect(master); s.start(); }
  function thud(){ if(!AC) return; var o=AC.createOscillator(),g=AC.createGain(); o.frequency.setValueAtTime(95,AC.currentTime); o.frequency.exponentialRampToValueAtTime(42,AC.currentTime+.28); g.gain.setValueAtTime(.12,AC.currentTime); g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.3); o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime+.32); click(1800); }
  function whoosh(){ if(!AC) return; var s=noise(.65),f=AC.createBiquadFilter(),g=AC.createGain(); f.type="bandpass"; f.Q.value=1.2; f.frequency.setValueAtTime(240,AC.currentTime); f.frequency.exponentialRampToValueAtTime(1500,AC.currentTime+.3); f.frequency.exponentialRampToValueAtTime(200,AC.currentTime+.65); g.gain.setValueAtTime(.0001,AC.currentTime); g.gain.exponentialRampToValueAtTime(.12,AC.currentTime+.2); g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+.65); s.connect(f); f.connect(g); g.connect(master); s.start(); }
  function chord(fs,dur,vol){ if(!AC) return; fs.forEach(function(f){ var o=AC.createOscillator(),g=AC.createGain(); o.frequency.value=f; g.gain.setValueAtTime(.0001,AC.currentTime); g.gain.exponentialRampToValueAtTime(vol/fs.length,AC.currentTime+.35); g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+dur); o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime+dur+.05); }); }
  function tone(hz,dur,vol){ if(!AC) return; var o=AC.createOscillator(),g=AC.createGain(); o.frequency.value=hz; g.gain.setValueAtTime(vol,AC.currentTime); g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+dur); o.connect(g); g.connect(master); o.start(); o.stop(AC.currentTime+dur); }

  var CUES=[
    {t:3.2,fn:thud},{t:8,fn:whoosh},
    {t:17.2,fn:function(){tone(880,.08,.05)}},{t:18.9,fn:thud},{t:19.9,fn:thud},{t:20.9,fn:thud},
    {t:24.6,fn:function(){tone(660,.1,.06);setTimeout(function(){tone(990,.14,.06)},110)}},
    {t:34,fn:whoosh},
    {t:37.4,fn:thud},{t:39,fn:thud},{t:40.6,fn:function(){tone(660,.1,.06);setTimeout(function(){tone(990,.14,.06)},110)}},{t:44,fn:function(){tone(1250,.05,.04)}},
    {t:47.4,fn:thud},{t:49,fn:thud},{t:50.6,fn:function(){tone(660,.1,.06);setTimeout(function(){tone(990,.14,.06)},110)}},{t:54,fn:function(){tone(1250,.05,.04)}},
    {t:57.4,fn:thud},{t:59,fn:thud},{t:60.6,fn:function(){tone(1250,.06,.05)}},
    {t:64,fn:whoosh},{t:67,fn:thud},{t:70.5,fn:thud},{t:76,fn:function(){tone(660,.1,.06);setTimeout(function(){tone(990,.14,.06)},110)}},
    {t:82,fn:whoosh},{t:90.5,fn:function(){tone(880,.08,.05)}},
    {t:98,fn:whoosh},{t:105,fn:function(){tone(660,.1,.06);setTimeout(function(){tone(990,.14,.06)},110)}},{t:107,fn:thud},
    {t:114,fn:whoosh},{t:115,fn:function(){chord([261.6,329.6,392,523.2],4,.22)}}
  ];
  /* نقرات الكتابة: تُطلق حسب تقدّم النص */
  var TYPES=[{id:"typed",t0:10,dur:6,hz:2400},{id:"q1",t0:34.6,dur:2.2,hz:2400},{id:"q2",t0:44.6,dur:2.2,hz:2400},{id:"q3",t0:54.6,dur:2.2,hz:2400},{id:"typed2",t0:84,dur:3.2,hz:2400},{id:"typed3",t0:101,dur:1.6,hz:2400}];
  var lastLen={};

  /* ---------- الرسم: كل شيء دالة في t ---------- */
  var S1="أبي أحد يتابع كل عميل جديد خلال خمس دقائق، ويطالب بالفواتير اللي تأخرت أكثر من سبعة أيام، ويرد على أسئلة الدعم المتكررة.";
  var S5="ليش سعد ما تابع خالد الدوسري؟";
  var Q1="تابع كل عميل يترك سلته وذكّره برابط الدفع.";
  var Q2="ذكّر كل مريض قبل موعده بيوم، وإذا اعتذر اعرض عليه أقرب موعد.";
  var Q3="طالبي بالفواتير اللي تأخرت أكثر من 7 أيام، وارفعي لي اللي تعدّت 30.";
  var S6="ufuq.sa";

  function render(t){
    var sc=SCENES.filter(function(s){return t>=s.start&&t<s.end})[0]||SCENES[SCENES.length-1];
    if(sc!==curScene){
      SCENES.forEach(function(s){ var e=$(s.id); if(s===sc){ e.classList.remove("on"); void e.offsetWidth; e.classList.add("on"); } else e.classList.remove("on"); });
      stage.classList.toggle("dark",sc.dark);
      $("hudN").textContent=("0"+(SCENES.indexOf(sc)+1)).slice(-2); $("hudS").textContent=sc.name;
      if(curScene && playing){ var w=$("wipe"); w.classList.remove("go"); void w.offsetWidth; w.classList.add("go"); setTimeout(function(){w.classList.remove("go")},700); }
      curScene=sc;
    }
    /* s0 */
    on("s0logo",t>0.6);
    /* s1 */
    on("s1me",t>=9.5); typeInto("typed","caret",S1,10,6,t);
    on("s1ai",t>=17.2); on("p1",t>=18.9); on("p2",t>=19.9); on("p3",t>=20.9); on("s1ap",t>=22.2);
    $("apBtn").classList.toggle("press",t>=24.4&&t<24.9);
    on("s1sys",t>=25); on("e1",t>=25.6); on("e2",t>=26.1); on("e3",t>=26.6); on("h1",t>=27.2);
    $("c1").classList.toggle("in",t>=28&&t<34);
    /* s3 — ثلاث شركات، كل واحدة 10 ثوانٍ بنفس الإيقاع */
    [[34,"vg1","q1","cq1",Q1,["a1","a2","a3"],"vc1"],[44,"vg2","q2","cq2",Q2,["b1","b2","b3"],"vc2"],[54,"vg3","q3","cq3",Q3,["d1","d2","d3"],"vc3"]].forEach(function(v){
      var t0=v[0], live=t>=t0&&t<t0+10; $(v[1]).classList.toggle("on",live);
      typeInto(v[2],v[3],v[4],t0+.6,2.2,t);
      on(v[5][0],t>=t0+3.4); on(v[5][1],t>=t0+5); on(v[5][2],t>=t0+6.6); on(v[6],t>=t0+8);
    });
    $("c3").classList.toggle("in",t>=61&&t<64);
    /* s4 */
    var kp=$("s4").querySelectorAll(".kpi .v"); for(var i=0;i<kp.length;i++) count(kp[i],65+i*.15,1.6,t);
    on("k1",t>=67); on("k2",t>=70.5); $("okBtn").classList.toggle("press",t>=75.8&&t<76.3);
    $("c4").classList.toggle("in",t>=72&&t<82);
    /* s5 */
    on("s5me",t>=83.5); typeInto("typed2","caret2",S5,84,3.2,t); on("s5ai",t>=88.6); $("c5").classList.toggle("in",t>=92&&t<98);
    /* s6 */
    on("s6h",t>=98.8); on("s6f",t>=100); typeInto("typed3","caret3",S6,101,1.6,t);
    var st=$("s6s"); st.classList.toggle("in",t>=103); st.classList.toggle("busy",t>=103&&t<105); st.classList.toggle("ok",t>=105);
    $("s6tx").innerHTML = t>=105 ? "<b>شركة الأفق</b> — حلول توصيل للمطاعم في الرياض وجدة<small>قرأنا 14 صفحة · 4 خدمات · الأسعار · 9 أسئلة شائعة · صوت مباشرة وواثقة</small>" : "نقرأ ufuq.sa…<small>الصفحات، الخدمات، الأسعار، الأسئلة الشائعة</small>";
    on("s6k",t>=107); var kv=$("s6k").querySelectorAll(".v"); for(var j=0;j<kv.length;j++) count(kv[j],107.2+j*.15,1.4,t);
    $("c6").classList.toggle("in",t>=109.5&&t<114);
    /* s8 */
    on("s8logo",t>=114.6); on("s8sub",t>=116.5);

    /* المشغّل */
    $("fi").style.width=(t/TOTAL*100)+"%"; $("kn").style.left=(t/TOTAL*100)+"%";
    $("tc").textContent=fmt(t)+" / "+fmt(TOTAL);
  }
  function fmt(s){ s=Math.floor(s); return ("0"+Math.floor(s/60)).slice(-2)+":"+("0"+(s%60)).slice(-2); }

  function fire(prev,now){
    if(!AC||!playing) return;
    CUES.forEach(function(c){ if(prev<c.t&&c.t<=now&&now-prev<.5) c.fn(); });
    TYPES.forEach(function(ty){ var el=$(ty.id); var L=el.textContent.length; if(now>=ty.t0&&now<=ty.t0+ty.dur+.1&&L!==lastLen[ty.id]){ if(L>(lastLen[ty.id]||0)) click(ty.hz); lastLen[ty.id]=L; } });
  }

  /* ---------- الحلقة ---------- */
  function loop(ts){
    if(playing){ if(last!=null){ var prev=t; t=clamp(t+(ts-last)/1000,0,TOTAL); render(t); fire(prev,t); if(t>=TOTAL) pause(); } last=ts; }
    requestAnimationFrame(loop);
  }
  function play(){ initAudio(); if(AC&&AC.state==="suspended") AC.resume(); if(t>=TOTAL) t=0; playing=true; last=null; $("icP").style.display="none"; $("icQ").style.display="block"; $("poster").classList.add("hide"); armCinema(); }
  function pause(){ playing=false; $("icP").style.display="block"; $("icQ").style.display="none"; stage.classList.remove("cinema"); }
  function seek(v){ t=clamp(v,0,TOTAL); lastLen={}; render(t); }

  /* وضع السينما */
  var cin=null; function armCinema(){ clearTimeout(cin); stage.classList.remove("cinema"); if(playing) cin=setTimeout(function(){ stage.classList.add("cinema"); },2600); }
  stage.addEventListener("mousemove",armCinema);

  /* أحداث */
  $("poster").addEventListener("click",play);
  $("play").addEventListener("click",function(e){ e.stopPropagation(); playing?pause():play(); });
  stage.addEventListener("click",function(e){ if(e.target.closest("#player")||e.target.closest("#poster")) return; playing?pause():play(); });
  $("tl").addEventListener("click",function(e){ e.stopPropagation(); var r=this.getBoundingClientRect(); seek((e.clientX-r.left)/r.width*TOTAL); });
  $("full").addEventListener("click",function(e){ e.stopPropagation(); if(document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen&&stage.requestFullscreen(); });
  document.addEventListener("keydown",function(e){
    if(e.code==="Space"){ e.preventDefault(); playing?pause():play(); }
    if(e.key==="ArrowLeft") seek(t-5); if(e.key==="ArrowRight") seek(t+5);
    if(e.key==="f"||e.key==="F") $("full").click(); if(e.key==="r"||e.key==="R") seek(0);
  });
  SCENES.forEach(function(s,i){ if(i){ var n=document.createElement("span"); n.className="nt"; n.style.left=(s.start/TOTAL*100)+"%"; $("tl").querySelector(".tr").appendChild(n);} });

  /* تحجيم المسرح */
  function fit(){ var s=Math.min((window.innerWidth-24)/960,(window.innerHeight-24)/540); if(document.fullscreenElement) s=Math.min(window.innerWidth/960,window.innerHeight/540); stage.style.transform="scale("+s+")"; $("viewport").style.width=(960*s)+"px"; $("viewport").style.height=(540*s)+"px"; }
  window.addEventListener("resize",fit); document.addEventListener("fullscreenchange",fit); fit();

  render(0); requestAnimationFrame(loop);
})();
