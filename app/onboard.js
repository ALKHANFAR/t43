(function(){
  "use strict";
  var $=function(s,c){return (c||document).querySelector(s)};
  var $$=function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};
  var step=1,TOTAL=4,PROFILE=null,SUGGESTIONS=[],SELECTED=null,CREATED=null,busy=false;
  var requested=new URLSearchParams(location.search).get('lang');
  var locale=requested==='en'||requested==='ar'?requested:(sessionStorage.getItem('siyadah_locale')==='en'?'en':'ar');
  var TOPIC_LABELS={
    ar:{company_profile:'تعريف الشركة',industry:'القطاع',services:'الخدمات',products:'المنتجات',target_customers:'العملاء',pricing:'الأسعار',faq:'الأسئلة الشائعة',policies:'السياسات',contact:'التواصل',locations:'الفروع',hours:'ساعات العمل',brand:'صوت العلامة',case_studies:'قصص العملاء',social:'القنوات',delivery:'التوصيل'},
    en:{company_profile:'Company profile',industry:'Industry',services:'Services',products:'Products',target_customers:'Customers',pricing:'Pricing',faq:'FAQs',policies:'Policies',contact:'Contact',locations:'Locations',hours:'Hours',brand:'Brand voice',case_studies:'Case studies',social:'Channels',delivery:'Delivery'}
  };
  var COPY={
    ar:{startSite:'ابدأ من موقع شركتك.',startSiteSub:'نستخرج ما يحتاجه موظفك الأول، مع مصدر كل معلومة.',startNoSite:'عرّفنا بشركتك.',startNoSiteSub:'اسمها وما تقدمه يكفيان لنبدأ.',noSite:'ما عندي موقع',hasSite:'عندي موقع',next:'التالي',back:'رجوع',suggestions:'اعرض اقتراحاتي',choose:'اختر موظفًا',prepare:'جهّز ',workspace:'افتح مساحة العمل',version:'الإصدار ',stepOf:' من ',best:'أفضل بداية',why:'لماذا ',reads:'سيقرأ: ',note:'الموظف الذي تختاره سيظهر في فريقك، ولن يبدأ العمل حتى تختبره.',company:'شركتك',fromSite:'من موقعك · راجعها',siteEmpty:'لم نجد معلومات كافية · أضفها لاحقًا',fromDescription:'من وصفك · راجعه',siteNoFacts:'يمكنك إضافة معلومات الشركة وتصحيحها لاحقًا.',descriptionFooter:'هذه المعلومات من وصفك، ويمكنك تعديلها لاحقًا.',summaryFallback:'يمكنك إكمال معلومات الشركة وتصحيحها لاحقًا من قاعدة المعرفة.',pages:'صفحات راجعناها',facts:'معلومات محفوظة',knowledgeVersion:'إصدار المعرفة',coverage:'تغطية معلومات الشركة: ',unavailable:'غير متاحة',researching:'نبحث بعمق…',reviewing:'نراجع تقدمك…',preparingProfile:'نجهّز ملف شركتك…',arranging:'نرتب الاقتراحات…',preparingEmployee:'نجهّز الموظف…',checking:'نتحقق من كل معلومة',matching:'نطابق الاقتباسات مع صفحاتها الأصلية',reading:'نبحث في ',sourcePromise:'لن نحفظ معلومة بلا مصدر واقتباس واضح',incomplete:'لم نحفظ نتيجة غير مكتملة.',validUrl:'اكتب رابط موقع صالح.',stillProcessing:'البحث العميق ما زال مستمرًا. أعد المحاولة بعد قليل.',genericError:'تعذّر إكمال الخطوة. حاول مرة ثانية.',logoutError:'تعذّر تسجيل الخروج. حاول مرة أخرى.'},
    en:{startSite:'Start with your company website.',startSiteSub:'We gather what your first employee needs, with a source for each fact.',startNoSite:'Tell us about your company.',startNoSiteSub:'Its name and what it does are enough to begin.',noSite:"I don't have a website",hasSite:'I have a website',next:'Continue',back:'Back',suggestions:'See suggestions',choose:'Choose an employee',prepare:'Prepare ',workspace:'Open workspace',version:'Version ',stepOf:' of ',best:'Best starting point',why:'Why ',reads:'Will use: ',note:'Your choice will appear on your team. It will not work until you test it.',company:'Your company',fromSite:'From your website · review it',siteEmpty:'Not enough information yet · add it later',fromDescription:'From your description · review it',siteNoFacts:'You can add or correct company information later.',descriptionFooter:'This comes from your description. You can edit it later.',summaryFallback:'You can add and correct company information later.',pages:'Pages reviewed',facts:'Saved facts',knowledgeVersion:'Knowledge version',coverage:'Company knowledge coverage: ',unavailable:'unavailable',researching:'Researching…',reviewing:'Checking your progress…',preparingProfile:'Preparing your company profile…',arranging:'Finding suggestions…',preparingEmployee:'Preparing your employee…',checking:'Checking each fact',matching:'Matching quotes to their source pages',reading:'Reading ',sourcePromise:'We keep only facts supported by a source and quote.',incomplete:'We did not save an incomplete result.',validUrl:'Enter a valid website URL.',stillProcessing:'Research is still running. Try again shortly.',genericError:'We could not complete this step. Try again.',logoutError:'Could not log out. Try again.'}
  };
  var ROLE_EN={sales_leads:{name:'Saad',title:'Lead specialist',goal:'Captures leads, follows up, and flags qualified opportunities.'},customer_support:{name:'Fahad',title:'Customer support',goal:'Answers from company knowledge and escalates unanswered requests.'},marketing:{name:'Reem',title:'Marketing employee',goal:'Drafts content in your company voice, grounded in its offers.'},operations:{name:'Layan',title:'Operations employee',goal:'Organizes incoming requests and recurring operational work.'}};
  function t(key){return COPY[locale][key];}
  function clearStepError(){var node=$('#stepError');node.hidden=true;node.textContent='';}
  function showStepError(error){var node=$('#stepError');node.textContent=error&&error.message||t('genericError');node.hidden=false;}
  function topic(topicKey){return TOPIC_LABELS[locale][topicKey]||topicKey;}
  function role(item,field){return locale==='en'&&ROLE_EN[item.roleKey]&&ROLE_EN[item.roleKey][field]||item[field]||'';}
  function applyLocale(){
    document.documentElement.lang=locale;document.documentElement.dir=locale==='en'?'ltr':'rtl';
    document.title=locale==='en'?'Siyadah — Your first employee':'سيادة — أول موظف لك';
    $$('[data-en]').forEach(function(el){if(!el.dataset.ar)el.dataset.ar=el.textContent;el.textContent=locale==='en'?el.dataset.en:el.dataset.ar;});
    $$('[data-en-placeholder]').forEach(function(el){if(!el.dataset.arPlaceholder)el.dataset.arPlaceholder=el.placeholder;el.placeholder=locale==='en'?el.dataset.enPlaceholder:el.dataset.arPlaceholder;});
    $$('[data-en-aria-label]').forEach(function(el){if(!el.dataset.arAriaLabel)el.dataset.arAriaLabel=el.getAttribute('aria-label');el.setAttribute('aria-label',locale==='en'?el.dataset.enAriaLabel:el.dataset.arAriaLabel);});
    $('#langAr').setAttribute('aria-pressed',String(locale==='ar'));$('#langEn').setAttribute('aria-pressed',String(locale==='en'));
    var alternative=noSiteOn();$('#siteEntry').hidden=alternative;$('#startTitle').textContent=t(alternative?'startNoSite':'startSite');$('#startSub').textContent=t(alternative?'startNoSiteSub':'startSiteSub');$('#noSite').textContent=t(alternative?'hasSite':'noSite');
    if(!$('#stepError').hidden)$('#stepError').textContent=t('genericError');
    if(PROFILE&&$('#siteSt').style.display!=='none'&&step===1)siteState('ok',PROFILE.companyName||$('#site').value,PROFILE.factCount+' '+(locale==='en'?'facts from ':'معلومات من ')+PROFILE.pagesRead+' '+(locale==='en'?'pages':'صفحات'));
    show();
  }

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  async function api(payload){
    var response=await fetch('/siyadah-api/v1/onboarding',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    var data=await response.json().catch(function(){return {};});
    if(!response.ok||data.ok!==true)throw new Error(locale==='en'?t('genericError'):(data.message||t('genericError')));
    return data;
  }
  function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  function normalizeUrl(value){
    var raw=String(value||'').trim();if(!/^https?:\/\//i.test(raw))raw='https://'+raw;
    var url;try{url=new URL(raw);}catch(error){throw new Error(t('validUrl'));}if(!/^https?:$/.test(url.protocol))throw new Error(t('validUrl'));return url.toString();
  }
  function noSiteOn(){return $('#alts').classList.contains('on');}
  function step1Ready(){return noSiteOn()?!!$('#lines3').value.trim()&&!!$('#co').value.trim():!!PROFILE;}
  function setBusy(value,label){busy=value;$('#next').disabled=value;$('#site').disabled=value;$('#noSite').disabled=value;$('#live').textContent=value?(label||''):'';if(label)$('#next').textContent=label;}

  function siteState(kind,title,detail){
    var st=$('#siteSt');st.style.display='flex';st.className='site '+kind;
    st.innerHTML='<span class="drop"></span><div><b>'+esc(title)+'</b><small>'+esc(detail)+'</small></div>';
  }
  async function finishEnrichment(data){
    for(var attempt=0;data.status==='processing'&&attempt<100;attempt++){
      await wait(attempt<2?2000:3000);data=await api({op:'check_company_enrichment'});
      siteState('busy',t('checking'),data.creditsUsed?(locale==='en'?'Research credits used: '+data.creditsUsed:'استخدم البحث '+data.creditsUsed+' رصيدًا حتى الآن'):t('matching'));
    }
    if(data.status!=='ready'||!data.profile)throw new Error(t('stillProcessing'));
    PROFILE=data.profile;SUGGESTIONS=data.suggestions||[];
    return data;
  }
  async function readSite(value){
    var url;try{url=normalizeUrl(value);}catch(error){siteState('',error.message,'');PROFILE=null;show();return;}
    PROFILE=null;SUGGESTIONS=[];SELECTED=null;setBusy(true,t('researching'));siteState('busy',t('reading')+new URL(url).hostname,t('sourcePromise'));
    try{
      await finishEnrichment(await api({op:'enrich_company',website_url:url}));
      siteState('ok',PROFILE.companyName||new URL(url).hostname,PROFILE.factCount+' '+(locale==='en'?'facts from ':'معلومات من ')+PROFILE.pagesRead+' '+(locale==='en'?'pages':'صفحات'));
    }catch(error){PROFILE=null;siteState('',error.message,t('incomplete'));}
    finally{setBusy(false);show();}
  }
  async function resumeExistingCompany(){
    setBusy(true,t('reviewing'));
    try{
      await finishEnrichment(await api({op:'check_company_enrichment'}));
      step=2;show();
    }catch(error){/* لا يوجد ملف جاهز بعد؛ ابدأ من رابط الموقع أو الوصف. */}
    finally{setBusy(false);show();}
  }
  async function readLines(){
    setBusy(true,t('preparingProfile'));
    try{
      var data=await api({op:'describe_company',name:$('#co').value.trim(),description:$('#lines3').value.trim()});PROFILE=data.profile;SUGGESTIONS=data.suggestions||[];return true;
    }catch(error){showStepError(error);return false;}
    finally{setBusy(false);show();}
  }

  function companySummary(){
    if(!PROFILE)return '';
    var areas=(PROFILE.knowledgeAreas||[]).map(function(key){return '<span>'+esc(topic(key))+'</span>';}).join('');
    var meta=[PROFILE.industry,PROFILE.brandTone].filter(Boolean).map(function(value){return '<span>'+esc(value)+'</span>';}).join('')+areas;
    var sourced=Number(PROFILE.pagesRead||0)>0,verified=Number(PROFILE.factCount||0)>0;
    var status=sourced?(verified?t('fromSite'):t('siteEmpty')):t('fromDescription');
    var footer=sourced?(verified?(locale==='en'?'Reviewed '+esc(PROFILE.pagesRead||0)+' pages. Excluded '+esc(PROFILE.rejectedClaims||0)+' unsupported claims.':'راجعنا '+esc(PROFILE.pagesRead||0)+' صفحات. استبعدنا '+esc(PROFILE.rejectedClaims||0)+' معلومات بلا مصدر كافٍ.'):t('siteNoFacts')):t('descriptionFooter');
    return '<div class="kb"><div class="kb__h"><span class="drop"></span><b>'+esc(PROFILE.companyName||t('company'))+'</b><span>'+status+'</span></div>'+
      '<div class="kb__body"><div class="coverage" role="img" aria-label="'+t('coverage')+(verified?esc(PROFILE.coverageScore||0)+'%':t('unavailable'))+'" style="--coverage:'+(verified?Math.min(100,Math.max(0,Number(PROFILE.coverageScore||0))):0)+'"><strong>'+(verified?esc(PROFILE.coverageScore||0)+'%':'—')+'</strong></div><div><p class="kb__summary">'+esc(PROFILE.summary||t('summaryFallback'))+'</p><div class="kb__meta">'+meta+'</div></div></div>'+
      '<div class="kb__g"><div><div class="kb__v">'+esc(PROFILE.pagesRead||0)+'</div><div class="kb__l">'+t('pages')+'</div></div><div><div class="kb__v">'+esc(PROFILE.factCount||0)+'</div><div class="kb__l">'+t('facts')+'</div></div><div><div class="kb__v">v'+esc(PROFILE.knowledgeVersion||1)+'</div><div class="kb__l">'+t('knowledgeVersion')+'</div></div></div>'+
      '<div class="kb__f"><span class="drop"></span>'+footer+'</div></div>';
  }
  function renderSuggestions(){
    var selected=SUGGESTIONS.find(function(item){return item.id===SELECTED;});
    $('#plan').innerHTML='<div class="plan">'+SUGGESTIONS.slice(0,3).map(function(item,index){
      var pressed=SELECTED===item.id;
      return '<button type="button" class="prow rolepick" data-suggestion="'+esc(item.id)+'" aria-pressed="'+pressed+'"><span class="av">'+esc(role(item,'name').slice(0,1))+'</span><div><b>'+esc(role(item,'name'))+' · '+esc(role(item,'title'))+(index===0?'<span class="rank">'+t('best')+'</span>':'')+'</b><p>'+esc(role(item,'goal'))+'</p><div class="fit"><i style="--fit:'+Number(item.confidence||0)+'%"></i><span>'+esc(item.confidence)+'%</span></div></div></button>';
    }).join('')+'</div>'+(selected?'<div class="choice"><b>'+t('why')+esc(role(selected,'name'))+(locale==='en'?'?':'؟')+'</b><p>'+esc(locale==='en'?englishReason(selected):selected.reason)+'</p><small>'+t('reads')+(selected.knowledgeTopics||[]).slice(0,3).map(function(key){return esc(topic(key));}).join(' · ')+'</small></div>':'')+'<div class="note"><span class="drop"></span>'+t('note')+'</div>';
  }
  function englishReason(item){
    var matched=(item.knowledgeTopics||[]).filter(function(key){return (PROFILE&&PROFILE.knowledgeAreas||[]).includes(key);}).slice(0,3).map(topic);
    return matched.length?'Suggested because your company covers '+matched.join(', ')+'.':'A starting point based on your current company profile.';
  }
  function show(){
    $$('.step').forEach(function(section){section.classList.toggle('on',+section.dataset.step===step);});
    $('#stepLbl').textContent=step+t('stepOf')+TOTAL;$('#prog').style.width=(step/TOTAL*100)+'%';
    var next=$('#next'),back=$('#back');back.style.visibility=(step===2||step===3)?'visible':'hidden';back.textContent=t('back');
    if(step===1){next.innerHTML=t('next')+' <span class="drop"></span>';next.disabled=busy||!step1Ready();}
    if(step===2){$('#companyRead').innerHTML=companySummary();next.innerHTML=t('suggestions')+' <span class="drop"></span>';next.disabled=busy;$('#brief').focus();}
    if(step===3){renderSuggestions();var picked=SUGGESTIONS.find(function(item){return item.id===SELECTED;});next.innerHTML=(picked?t('prepare')+esc(role(picked,'name')):t('choose'))+' <span class="drop"></span>';next.disabled=busy||!SELECTED;}
    if(step===4){next.innerHTML=t('workspace')+' <span class="drop"></span>';next.disabled=false;if(CREATED){$('#doneAv').textContent=locale==='en'&&ROLE_EN[SELECTED]?ROLE_EN[SELECTED].name.slice(0,1):CREATED.initial;$('#doneKnowledge').textContent=t('version')+esc(CREATED.knowledgeVersion||PROFILE&&PROFILE.knowledgeVersion||1);}}
    window.scrollTo({top:0,behavior:'smooth'});
  }

  $('#site').addEventListener('change',function(){if(this.value.trim().length>3)readSite(this.value);});
  $('#site').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();this.dispatchEvent(new Event('change'));}});
  $('#noSite').addEventListener('click',function(){
    clearStepError();
    var alternatives=$('#alts'),on=!alternatives.classList.contains('on');alternatives.classList.toggle('on',on);this.setAttribute('aria-expanded',String(on));this.textContent=t(on?'hasSite':'noSite');
    $('#siteEntry').hidden=on;$('#startTitle').textContent=t(on?'startNoSite':'startSite');$('#startSub').textContent=t(on?'startNoSiteSub':'startSiteSub');
    if(on){$('#siteSt').style.display='none';PROFILE=null;SUGGESTIONS=[];$('#lines3').focus();}else{$('#site').focus();}show();
  });
  $('#lines3').addEventListener('input',function(){clearStepError();show();});
  $('#co').addEventListener('input',function(){clearStepError();show();});
  $('#brief').addEventListener('input',clearStepError);
  $('#plan').addEventListener('click',function(event){var button=event.target.closest('[data-suggestion]');if(!button)return;clearStepError();SELECTED=button.dataset.suggestion;show();});
  $('#next').addEventListener('click',async function(){
    if(busy)return;
    clearStepError();
    if(step===4){window.location.href='chat.html'+(CREATED&&CREATED.recordId?'#e='+encodeURIComponent(CREATED.recordId):'');return;}
    if(step===1){if(noSiteOn()&&!await readLines())return;step=2;show();return;}
    if(step===2){
      setBusy(true,t('arranging'));
      try{var data=await api({op:'recommend_employees',goal:$('#brief').value.trim()});SUGGESTIONS=data.suggestions||SUGGESTIONS;SELECTED=null;step=3;}
      catch(error){showStepError(error);}finally{setBusy(false);show();}return;
    }
    if(step===3){
      setBusy(true,t('preparingEmployee'));
      try{var selected=await api({op:'select_employee',suggestion_id:SELECTED});CREATED=selected.employee;step=4;}
      catch(error){showStepError(error);}finally{setBusy(false);show();}
    }
  });
  $('#back').addEventListener('click',function(){if(!busy&&step>1){clearStepError();step--;show();}});
  $('#logoutBtn').addEventListener('click',async function(){
    var button=this;if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');$('#logoutStatus').textContent='';
    try{
      var response=await fetch('/siyadah-api/v1/auth/logout',{method:'POST',credentials:'same-origin'});
      if(!response.ok)throw new Error('logout_failed');
      window.location.replace('../auth.html');
    }catch(error){button.disabled=false;button.removeAttribute('aria-busy');$('#logoutStatus').textContent=t('logoutError');}
  });
  $('#langAr').addEventListener('click',function(){locale='ar';sessionStorage.setItem('siyadah_locale',locale);applyLocale();});
  $('#langEn').addEventListener('click',function(){locale='en';sessionStorage.setItem('siyadah_locale',locale);applyLocale();});
  $('#co').addEventListener('keydown',function(event){
    if(event.key==='Enter'&&!event.isComposing&&!$('#next').disabled){event.preventDefault();$('#next').click();}
  });
  applyLocale();
  resumeExistingCompany();
})();
