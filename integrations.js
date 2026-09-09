window.addEventListener("DOMContentLoaded",function(){
  "use strict";

  /* CSP-safe: استبدال الشعار بحرفين عند فشل التحميل */
  document.addEventListener("error",function(e){ var img=e.target; if(!(img&&img.tagName==="IMG"&&img.dataset.fb)) return;
    var n=(img.closest(".card,.tl")||{}).querySelector ? (img.closest(".card,.tl").querySelector(".card__n,.tl__n")||{}).textContent||"" : "";
    var ini=n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•"; img.replaceWith(document.createTextNode(ini)); },true);
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var lang="en", cat="all", q="", shown=36;
  /* تصنيف عالمي معتمد (على نمط Zapier/G2) — أسماء إنجليزية قياسية + عربية احترافية، مرتّبة بأولوية الأعمال */
  var CAT_EN={"الذكاء الاصطناعي":"AI Tools","المبيعات والعملاء":"Sales & CRM","التسويق":"Marketing","دعم العملاء":"Customer Support","التواصل":"Communication","الإنتاجية":"Productivity","المحاسبة":"Accounting & Finance","المدفوعات":"Payments","التجارة الإلكترونية":"E-commerce","المحتوى والملفات":"Files & Content","البيانات والتقارير":"Analytics & Data","النماذج":"Forms & Surveys","الموارد البشرية":"HR & Recruiting","أدوات المطوّرين":"Developer Tools","أخرى":"Other"};
  var CAT_AR={"الذكاء الاصطناعي":"الذكاء الاصطناعي","المبيعات والعملاء":"المبيعات وإدارة العملاء","التسويق":"التسويق والإعلان","دعم العملاء":"دعم العملاء والخدمة","التواصل":"التواصل والمراسلة","الإنتاجية":"الإنتاجية والتعاون","المحاسبة":"المحاسبة والمالية","المدفوعات":"المدفوعات","التجارة الإلكترونية":"التجارة الإلكترونية","المحتوى والملفات":"الملفات والمحتوى","البيانات والتقارير":"التحليلات والبيانات","النماذج":"النماذج والاستبيانات","الموارد البشرية":"الموارد البشرية والتوظيف","أدوات المطوّرين":"أدوات المطوّرين","أخرى":"أخرى"};
  var ORDER=["الذكاء الاصطناعي","المبيعات والعملاء","التسويق","دعم العملاء","التواصل","الإنتاجية","المحاسبة","المدفوعات","التجارة الإلكترونية","المحتوى والملفات","البيانات والتقارير","النماذج","الموارد البشرية","أدوات المطوّرين","أخرى"];
  var ic=function(p){return '<svg class="cat__ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';};
  var CAT_ICON={
    "الذكاء الاصطناعي":ic('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="3.2"/>'),
    "المبيعات والعملاء":ic('<path d="M3 17l5-5 3 3 7-7"/><path d="M14 8h5v5"/>'),
    "التسويق":ic('<path d="M4 11v3a1 1 0 001 1h2l3 4V6L7 10H5a1 1 0 00-1 1z"/><path d="M15 8a4 4 0 010 8"/>'),
    "دعم العملاء":ic('<path d="M4 13a8 8 0 0116 0"/><path d="M4 13v3a2 2 0 002 2M20 13v3M4 16h2v-4H4zM18 16h2v-4h-2z"/>'),
    "التواصل":ic('<path d="M21 11.5a8.4 8.4 0 01-9 8.4 9 9 0 01-3.5-.7L3 21l1.3-4.5A8.4 8.4 0 013.6 11.5 8.4 8.4 0 0112 3a8.4 8.4 0 019 8.5z"/>'),
    "الإنتاجية":ic('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>'),
    "المحاسبة":ic('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5M16 15h.01"/>'),
    "المدفوعات":ic('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>'),
    "التجارة الإلكترونية":ic('<path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2M9 20a1 1 0 100 2 1 1 0 000-2zM18 20a1 1 0 100 2 1 1 0 000-2z"/>'),
    "المحتوى والملفات":ic('<path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V8z"/>'),
    "البيانات والتقارير":ic('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    "النماذج":ic('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h5M8 12h8M8 16h8"/>'),
    "الموارد البشرية":ic('<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0112 0M17 11l2 2 3-3"/>'),
    "أدوات المطوّرين":ic('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
    "أخرى":ic('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>')
  };
  function catAr(c){ return CAT_AR[c]||c; }
  function catLabel(c){ return lang==="ar"?catAr(c):(CAT_EN[c]||c); }
  var P=(window.PIECES||[]).map(function(p){return {s:p[0],n:p[1],d:p[2],da:p[5]||p[2],c:p[3],logo:p[4]}});
  function desc(p){ return lang==="ar" ? p.da : p.d; }
  var FEATURED=["whatsapp","gmail","google-sheets","google-calendar","google-drive","hubspot","zoho-crm","zoho-books","wafeq","xero","quickbooks","shopify","woocommerce","slack","microsoft-outlook","microsoft-teams","microsoft-excel-365","notion","airtable","zendesk","intercom","freshdesk","stripe","linkedin","instagram-business","facebook-pages","facebook-leads","telegram-bot","twilio","cal-com","calendly","typeform","jotform","google-forms","tally","mailchimp","sendgrid","pipedrive","salesforce","odoo","monday","clickup","trello","asana","wordpress","dropbox","google-docs","zoom","openai","claude","google-gemini","respond-io","instasent","square"];
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
    var allIc=ic('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>');
    h+='<button class="cat" data-c="all" aria-pressed="'+(cat==="all")+'">'+allIc+'<span>'+(lang==="ar"?"الكل":"All")+'</span><small>'+P.length+'</small></button>';
    ORDER.forEach(function(c){ if(!counts[c]) return; h+='<button class="cat" data-c="'+c+'" aria-pressed="'+(cat===c)+'">'+(CAT_ICON[c]||'')+'<span>'+catLabel(c)+'</span><small>'+counts[c]+'</small></button>'; });
    $("#side").innerHTML=h;
  }
  function card(p){
    var ini=p.n.replace(/[^A-Za-z0-9\u0600-\u06FF]/g,"").slice(0,2)||"•";
    return '<div class="card"><span class="card__i"><img src="'+p.logo+'" alt="" loading="lazy" crossorigin="anonymous" referrerpolicy="no-referrer" data-fb="1"></span>'+
      '<div><div class="card__n">'+p.n+'</div><div class="card__d" dir="'+(lang==="ar"?"rtl":"ltr")+'" title="'+(desc(p)||"").replace(/"/g,"&quot;")+'">'+(desc(p)||"")+'</div><div class="card__c">'+catLabel(p.c)+'</div></div></div>';
  }
  function render(){
    var f=P.filter(function(p){ return (cat==="all"||p.c===cat) && (!q||(p.n+" "+p.d+" "+p.da+" "+p.s).toLowerCase().indexOf(q)>-1); });
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
  if(/^ar\b/i.test(navigator.language||"")||new URLSearchParams(location.search).get("lang")==="ar"||location.hash==="#ar") lang="ar";
  paint();
});
