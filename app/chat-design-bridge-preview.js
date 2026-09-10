(()=>{'use strict';
 const endpoint='https://activepieces-p8l1-455.up.railway.app/api/v1/webhooks/vtIB0yqpB3lMK3ykTSTgN/sync';
 let requests;try{requests=new Set(JSON.parse(sessionStorage.getItem('siyadah_design_requests')||'[]'));}catch{requests=new Set();}
 async function send(body){const token=localStorage.getItem('siyadah_token');if(!token)throw Error('سجل الدخول لإكمال الطلب.');const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});const data=await r.json();if(token!==localStorage.getItem('siyadah_token'))throw Error('تغيرت الجلسة.');if(!r.ok||!data.ok)throw Error('تعذر التحقق من طلب بناء الموظف.');return data;}
 window.SIYADAH_DESIGN_REQUEST=async body=>{
  if(body.op==='message'&&!body.employee_id){requests.add(body.request_id);sessionStorage.setItem('siyadah_design_requests',JSON.stringify([...requests].slice(-100)));const d=await send({op:'design_start',goal:body.message,request_id:body.request_id,conversation_id:body.conversation_id,from_chat:true});return {ok:true,work_id:'design_'+d.id,work_status:'running',conversation_id:d.conversation_id,reply:'أراجع رسالتك وسياق شركتك.'};}
  if(body.op==='work'&&(body.work_id?.startsWith('design_')||requests.has(body.request_id)))return send({op:'design_status',...(body.work_id?{id:body.work_id.slice(7)}:{request_id:body.request_id})});
  return undefined;
 };
})();
