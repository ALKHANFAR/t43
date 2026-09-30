(function(){
  "use strict";
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var step=1,TOTAL=4,PROFILE=null,SUGGESTIONS=[],SELECTED=null,CREATED=null,busy=false;
  var TOPIC_LABELS={company_profile:'تعريف الشركة',industry:'القطاع',services:'الخدمات',products:'المنتجات',target_customers:'العملاء',pricing:'الأسعار',faq:'الأسئلة الشائعة',policies:'السياسات',contact:'التواصل',locations:'الفروع',hours:'ساعات العمل',brand:'صوت العلامة',case_studies:'قصص العملاء',social:'القنوات',delivery:'التوصيل'};

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  async function api(payload){
    var response=await fetch('/siyadah-api/v1/onboarding',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    var data=await response.json().catch(function(){return {};});
    if(!response.ok||data.ok!==true)throw new Error(data.message||'تعذّر إكمال الخطوة. حاول مرة ثانية.');
    return data;
  }
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  function normalizeUrl(value){
    var raw=String(value||'').trim();if(!/^https?:\/\//i.test(raw))raw='https://'+raw;
    var url=new URL(raw);if(!/^https?:$/.test(url.protocol))throw new Error('اكتب رابط موقع صالح.');return url.toString();
  }
  function noSiteOn(){return $('#alts').classList.contains('on');}
  function step1Ready(){return noSiteOn()?!!$('#lines3').value.trim():!!PROFILE;}
  function setBusy(value,label){busy=value;$('#next').disabled=value;$('#site').disabled=value;$('#noSite').disabled=value;if(label){$('#next').textContent=label;$('#live').textContent=label;}}

  function siteState(kind,title,detail){
    var st=$('#siteSt');st.style.display='flex';st.className='site '+kind;
    st.innerHTML='<span class="drop"></span><div><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></div>';
  }
  async function finishEnrichment(data){
    for(var attempt=0;data.status==='processing'&&attempt<100;attempt++){
      await wait(attempt<2?2000:3000);data=await api({op:'check_company_enrichment'});
      siteState('busy','نتحقق من كل معلومة',data.creditsUsed?'استخدم البحث '+data.creditsUsed+' رصيدًا حتى الآن':'نطابق الاقتباسات مع صفحاتها الأصلية');
    }
    if(data.status!=='ready'||!data.profile)throw new Error('البحث العميق ما زال مستمرًا. أعد المحاولة بعد قليل.');
    PROFILE=data.profile;SUGGESTIONS=data.suggestions||[];
    return data;
  }
  async function readSite(value){
    var url;try{url=normalizeUrl(value);}catch(error){siteState('',error.message,'');PROFILE=null;show();return;}
    PROFILE=null;SUGGESTIONS=[];SELECTED=null;setBusy(true,'نبحث بعمق…');siteState('busy','نبحث في '+new URL(url).hostname,'لن نحفظ معلومة بلا مصدر واقتباس واضح');
    try{
      await finishEnrichment(await api({op:'enrich_company',website_url:url}));
      siteState('ok',PROFILE.companyName||new URL(url).hostname,PROFILE.factCount+' حقائق مثبتة من '+PROFILE.pagesRead+' صفحات · لم نعتمد '+PROFILE.rejectedClaims+' ادعاءات بلا دليل كافٍ');
    }catch(error){PROFILE=null;siteState('',error.message,'لم نحفظ نتيجة غير مكتملة.');}
    finally{setBusy(false);show();}
  }
  async function resumeExistingCompany(){
    setBusy(true,'نراجع تقدمك…');
    try{
      await finishEnrichment(await api({op:'check_company_enrichment'}));
      step=2;show();
    }catch(error){/* لا يوجد ملف جاهز بعد؛ ابدأ من رابط الموقع أو الوصف. */}
    finally{setBusy(false);show();}
  }
  async function readLines(){
    setBusy(true,'نجهّز ملف شركتك…');
    try{
      var data=await api({op:'describe_company',name:$('#co').value.trim(),description:$('#lines3').value.trim()});PROFILE=data.profile;SUGGESTIONS=data.suggestions||[];return true;
    }catch(error){window.alert(error.message);return false;}
    finally{setBusy(false);}
  }

  function companySummary(){
    if(!PROFILE)return '';
    var areas=(PROFILE.knowledgeAreas||[]).map(function(topic){return '<span>'+esc(TOPIC_LABELS[topic]||topic)+'</span>';}).join('');
    var meta=[PROFILE.industry,PROFILE.brandTone].filter(Boolean).map(function(value){return '<span>'+esc(value)+'</span>';}).join('')+areas;
    return '<div class="kb"><div class="kb__h"><span class="drop"></span><b>'+esc(PROFILE.companyName||'شركتك')+'</b><span>بصمة مثبتة قابلة للتعديل</span></div>'+
      '<div class="kb__body"><div class="coverage" style="--coverage:'+Number(PROFILE.coverageScore||0)+'"><strong>'+esc(PROFILE.coverageScore||0)+'٪</strong></div><div><p class="kb__summary">'+esc(PROFILE.summary||'يمكنك إكمال معلومات الشركة وتصحيحها لاحقًا من قاعدة المعرفة.')+'</p><div class="kb__meta">'+meta+'</div></div></div>'+
      '<div class="kb__g"><div><div class="kb__v">'+esc(PROFILE.pagesRead||0)+'</div><div class="kb__l">صفحات راجعناها</div></div><div><div class="kb__v">'+esc(PROFILE.factCount||0)+'</div><div class="kb__l">حقائق مثبتة</div></div><div><div class="kb__v">v'+esc(PROFILE.knowledgeVersion||1)+'</div><div class="kb__l">إصدار المعرفة</div></div></div>'+
      '<div class="kb__f"><span class="drop"></span>كل حقيقة معها مصدر واقتباس. استبعدنا '+esc(PROFILE.rejectedClaims||0)+' بلا دليل كافٍ.</div></div>';
  }
  function renderSuggestions(){
    var selected=SUGGESTIONS.find(function(item){return item.id===SELECTED;});
    $('#plan').innerHTML='<div class="plan">'+SUGGESTIONS.slice(0,3).map(function(item,index){
      var pressed=SELECTED===item.id;
      return '<button type="button" class="prow rolepick" data-suggestion="'+esc(item.id)+'" aria-pressed="'+pressed+'"><span class="av">'+esc(item.name.slice(0,1))+'</span><div><b>'+esc(item.name)+' · '+esc(item.title)+(index===0?'<span class="rank">أفضل بداية</span>':'')+'</b><p>'+esc(item.goal)+'</p><div class="fit"><i style="--fit:'+Number(item.confidence||0)+'%"></i><span>'+esc(item.confidence)+'٪</span></div></div></button>';
    }).join('')+'</div>'+(selected?'<div class="choice"><b>لماذا '+esc(selected.name)+'؟</b><p>'+esc(selected.reason)+'</p><small>سيقرأ: '+(selected.knowledgeTopics||[]).slice(0,3).map(function(topic){return esc(TOPIC_LABELS[topic]||topic);}).join(' · ')+'</small></div>':'')+'<div class="note"><span class="drop"></span>الموظف الذي تختاره سيظهر في فريقك، ولن يبدأ العمل حتى تختبره.</div>';
  }
  function show(){
    $$('.step').forEach(function(section){section.classList.toggle('on',+section.dataset.step===step);});
    $('#stepLbl').textContent=step+' من '+TOTAL;$('#prog').style.width=(step/TOTAL*100)+'%';
    var next=$('#next'),back=$('#back');back.style.visibility=(step===2||step===3)?'visible':'hidden';back.textContent='رجوع';
    if(step===1){next.innerHTML='التالي <span class="drop"></span>';next.disabled=busy||!step1Ready();}
    if(step===2){$('#companyRead').innerHTML=companySummary();next.innerHTML='اعرض اقتراحاتي <span class="drop"></span>';next.disabled=busy;$('#brief').focus();}
    if(step===3){renderSuggestions();var picked=SUGGESTIONS.find(function(item){return item.id===SELECTED;});next.innerHTML=(picked?'جهّز '+esc(picked.name):'اختر موظفًا')+' <span class="drop"></span>';next.disabled=busy||!SELECTED;}
    if(step===4){next.innerHTML='افتح مساحة الموظف <span class="drop"></span>';next.disabled=false;if(CREATED){$('#doneAv').textContent=CREATED.initial;$('#doneH').textContent=CREATED.name+' جاهز للخطوة التالية.';$('#doneKnowledge').textContent='الإصدار '+esc(CREATED.knowledgeVersion||PROFILE&&PROFILE.knowledgeVersion||1);}}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  $('#site').addEventListener('change',function(){if(this.value.trim().length>3)readSite(this.value);});
  $('#site').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}});
  $('#noSite').addEventListener('click',function(){
    var alternatives=$('#alts'),on=!alternatives.classList.contains('on');alternatives.classList.toggle('on',on);this.setAttribute('aria-expanded',String(on));this.textContent=on?'عندي موقع':'ما عندي موقع';
    if(on){$('#siteSt').style.display='none';PROFILE=null;SUGGESTIONS=[];$('#lines3').focus();}show();
  });
  $('#lines3').addEventListener('input',show);
  $('#plan').addEventListener('click',function(event){var button=event.target.closest('[data-suggestion]');if(!button)return;SELECTED=button.dataset.suggestion;show();});
  $('#next').addEventListener('click',async function(){
    if(busy)return;
    if(step===4){window.location.href='chat.html';return;}
    if(step===1){if(noSiteOn()&&!await readLines())return;step=2;show();return;}
    if(step===2){
      setBusy(true,'نرتب الاقتراحات…');
      try{var data=await api({op:'recommend_employees',goal:$('#brief').value.trim()});SUGGESTIONS=data.suggestions||SUGGESTIONS;SELECTED=null;step=3;}
      catch(error){window.alert(error.message);}finally{setBusy(false);show();}return;
    }
    if(step===3){
      setBusy(true,'نجهّز الموظف…');
      try{var selected=await api({op:'select_employee',suggestion_id:SELECTED});CREATED=selected.employee;step=4;}
      catch(error){window.alert(error.message);}finally{setBusy(false);show();}
    }
  });
  $('#back').addEventListener('click',function(){if(!busy&&step>1){step--;show();}});
  $('#logoutBtn').addEventListener('click',async function(){
    var button=this;if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');$('#logoutStatus').textContent='';
    try{
      var response=await fetch('/siyadah-api/v1/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!response.ok)throw new Error('logout_failed');
      window.location.replace('../auth.html');
    }catch(error){button.disabled=false;button.removeAttribute('aria-busy');$('#logoutStatus').textContent='تعذّر تسجيل الخروج. حاول مرة أخرى.';}
  });
  document.addEventListener('keydown',function(event){if(event.key==='Enter'&&document.activeElement.tagName!=='TEXTAREA'&&!$('#next').disabled){event.preventDefault();$('#next').click();}});
  show();
  resumeExistingCompany();
})();
