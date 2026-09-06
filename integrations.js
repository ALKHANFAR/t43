window.addEventListener("DOMContentLoaded",function(){
  "use strict";

  /* CSP-safe: استبدال الشعار بحرفين عند فشل التحميل */
  document.addEventListener("error",function(e){ var img=e.target; if(!(img&&img.tagName==="IMG"&&img.dataset.fb)) return;
    var n=(img.closest(".card,.tl")||{}).querySelector ? (img.closest(".card,.tl").querySelector(".card__n,.tl__n")||{}).textContent||"" : "";
    var ini=n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•"; img.replaceWith(document.createTextNode(ini)); },true);
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var lang="en", cat="all", q="", shown=36;
  var CAT_EN={"التواصل":"Communication","المبيعات والعملاء":"Sales & CRM","المحاسبة":"Accounting","المدفوعات":"Payments","التجارة الإلكترونية":"Commerce","دعم العملاء":"Customer support","التسويق":"Marketing","النماذج":"Forms & surveys","المحتوى والملفات":"Content & files","الإنتاجية":"Productivity","البيانات والتقارير":"Data & reporting","الموارد البشرية":"HR","الذكاء الاصطناعي":"AI models","أدوات المطوّرين":"Developer tools","أخرى":"Other"};
  var ORDER=["التواصل","المبيعات والعملاء","المحاسبة","المدفوعات","التجارة الإلكترونية","دعم العملاء","التسويق","النماذج","المحتوى والملفات","الإنتاجية","البيانات والتقارير","الموارد البشرية","الذكاء الاصطناعي","أدوات المطوّرين","أخرى"];
  var P=(window.PIECES||[]).map(function(p){return {s:p[0],n:p[1],d:p[2],c:p[3],logo:p[4]}});
  var FEATURED=["whatsapp","gmail","google-sheets","google-calendar","hubspot","zoho-crm","zoho-books","wafeq","shopify","woocommerce","slack","microsoft-outlook","notion","airtable","zendesk","intercom","stripe","linkedin","instagram-business","telegram-bot","cal-com","calendly","google-drive","typeform"];
  var rank={}; FEATURED.forEach(function(s,i){rank[s]=i});
  P.sort(function(a,b){ var ra=rank[a.s]!==undefined?rank[a.s]:999, rb=rank[b.s]!==undefined?rank[b.s]:999; return ra-rb || a.n.localeCompare(b.n); });

  function t(el){ el.textContent = lang==="ar" ? el.dataset.ar : el.dataset.en; }
  function paint(){
    document.documentElement.lang=lang; document.documentElement.dir=lang==="ar"?"rtl":"ltr";
    $$("[data-en]").forEach(t);
    $("#q").placeholder = lang==="ar" ? $("#q").dataset.phAr : $("#q").dataset.phEn;
    $("#langBtn").textContent = lang==="ar" ? "EN" : "عربي";
    renderSide(); render();
  }
  function renderSide(){
    var counts={}; P.forEach(function(p){counts[p.c]=(counts[p.c]||0)+1});
    var h='<h2 class="sr">'+(lang==="ar"?"التصنيفات":"Categories")+'</h2>';
    h+='<button class="cat" data-c="all" aria-pressed="'+(cat==="all")+'">'+(lang==="ar"?"الكل":"All")+'<small>'+P.length+'</small></button>';
    ORDER.forEach(function(c){ if(!counts[c]) return; h+='<button class="cat" data-c="'+c+'" aria-pressed="'+(cat===c)+'">'+(lang==="ar"?c:CAT_EN[c])+'<small>'+counts[c]+'</small></button>'; });
    $("#side").innerHTML=h;
  }
  function card(p){
    var ini=p.n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•";
    return '<div class="card"><span class="card__i"><img src="'+p.logo+'" alt="" loading="lazy" data-fb="1"></span>'+
      '<div><div class="card__n">'+p.n+'</div><div class="card__d" title="'+(p.d||"").replace(/"/g,"&quot;")+'">'+(p.d||"")+'</div><div class="card__c">'+(lang==="ar"?p.c:CAT_EN[p.c])+'</div></div></div>';
  }
  function render(){
    var f=P.filter(function(p){ return (cat==="all"||p.c===cat) && (!q||(p.n+" "+p.d+" "+p.s).toLowerCase().indexOf(q)>-1); });
    $("#count").textContent=f.length;
    $("#countL").textContent = lang==="ar" ? (q?"نتيجة لـ «"+q+"»":"أداة") : (q?"results for “"+q+"”":"tools");
    $("#grid").innerHTML = f.length ? f.slice(0,shown).map(card).join("") : '<div class="empty">'+(lang==="ar"?"ما لقيناها في الكتالوج — اطلبها ونبنيها لك.":"Not in the catalog yet — request it and we build it.")+'</div>';
    var m=$("#more"); if(f.length>shown){ m.style.display="block"; m.textContent=(lang==="ar"?"اعرض المزيد — باقي ":"Show more — ")+(f.length-shown)+(lang==="ar"?"":" left"); } else m.style.display="none";
  }
  $("#side").addEventListener("click",function(e){ var b=e.target.closest(".cat"); if(!b) return; cat=b.dataset.c; shown=36; renderSide(); render(); window.scrollTo({top:$(".lay").offsetTop-80,behavior:"smooth"}); });
  $("#q").addEventListener("input",function(){ q=this.value.trim().toLowerCase(); shown=36; render(); });
  $("#more").addEventListener("click",function(){ shown+=36; render(); });
  $("#langBtn").addEventListener("click",function(){ lang=lang==="ar"?"en":"ar"; paint(); });
  document.addEventListener("keydown",function(e){ if(e.key==="/"&&document.activeElement!==$("#q")){ e.preventDefault(); $("#q").focus(); } });
  if(/[\u0600-\u06FF]/.test(navigator.language)||new URLSearchParams(location.search).get("lang")==="ar"||location.hash==="#ar") lang="ar";
  paint();
});
