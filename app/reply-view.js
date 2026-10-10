(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.SiyadahReplyView=factory();
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  var limits={chars:12000,blocks:6,items:40,text:2000,title:160};
  var string=function(value,max){return typeof value==='string'&&value.trim()&&value.length<=max;};
  function envelope(raw){
    if(typeof raw!=='string'||raw.length>limits.chars)return null;
    try{var value=JSON.parse(raw);return value&&value.schema_version==='1'?value:null;}catch(error){return null;}
  }
  function fallback(raw){var value=envelope(raw);return value&&string(value.fallback_text,6000)?value.fallback_text:null;}
  function parse(raw){
    var value=envelope(raw);
    if(!value||!string(value.fallback_text,6000)||!Array.isArray(value.blocks)||!value.blocks.length||value.blocks.length>limits.blocks)return null;
    if(Object.keys(value).some(function(k){return !['schema_version','fallback_text','blocks'].includes(k);}))return null;
    var blocks=[];
    for(var block of value.blocks){
      if(!block||Object.keys(block).some(function(k){return !['type','title','items'].includes(k);})||!string(block.title,limits.title)||!Array.isArray(block.items)||!block.items.length||block.items.length>limits.items)return null;
      if(block.type==='table'){
        if(!block.items.every(function(row){return Array.isArray(row)&&row.length===2&&row.every(function(cell){return typeof cell==='string'&&cell.length<=limits.text;});}))return null;
      }else if(['plan','form','suggestion'].includes(block.type)){
        if(block.type==='suggestion'&&block.items.length!==1)return null;
        if(!block.items.every(function(item){return string(item,limits.text);}))return null;
      }else return null;
      blocks.push({type:block.type,title:block.title,items:block.items});
    }
    return {schema_version:'1',fallback_text:value.fallback_text,blocks:blocks};
  }
  function render(document,view,english){
    var section=document.createElement('section');section.className='adaptive-view';section.setAttribute('data-view-key',JSON.stringify(view));
    var heading=document.createElement('h3');heading.textContent=view.title;heading.dir='auto';section.appendChild(heading);
    if(view.type==='table'){
      var region=document.createElement('div');region.className='reply-table';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',view.title);
      var table=document.createElement('table'),body=document.createElement('tbody');
      view.items.forEach(function(row){var tr=document.createElement('tr');row.forEach(function(cell,index){var td=document.createElement(index?'td':'th');td.textContent=cell;td.dir='auto';if(!index)td.scope='row';tr.appendChild(td);});body.appendChild(tr);});
      table.appendChild(body);region.appendChild(table);section.appendChild(region);
    }else if(view.type==='plan'){
      var details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=english?'Review the proposed plan':'راجع الخطة المقترحة';details.appendChild(summary);
      var list=document.createElement('ol');view.items.forEach(function(item){var li=document.createElement('li');li.textContent=item;li.dir='auto';list.appendChild(li);});details.appendChild(list);section.appendChild(details);
    }else if(view.type==='suggestion'){
      var text=document.createElement('p');text.textContent=view.items[0];text.dir='auto';section.appendChild(text);
      var button=document.createElement('button');button.type='button';button.className='lnk';button.setAttribute('data-reply-suggestion',view.items[0]);button.textContent=english?'Discuss this suggestion':'ناقش هذا الاقتراح';section.appendChild(button);
      var dismiss=document.createElement('button');dismiss.type='button';dismiss.className='lnk';dismiss.setAttribute('data-reply-dismiss','');dismiss.textContent=english?'Keep my original request':'خلّنا على طلبي';section.appendChild(dismiss);
    }else{
      view.items.forEach(function(item,index){var label=document.createElement('label');label.textContent=item;label.className='adaptive-field';var input=document.createElement('textarea');input.className='ctrl';input.rows=2;input.dir='auto';input.setAttribute('data-reply-field',item);input.setAttribute('data-field-index',String(index));label.appendChild(input);section.appendChild(label);});
      var note=document.createElement('p');note.textContent=english?'You can answer freely in chat. Do not enter passwords or access tokens.':'تقدر تجاوب بحرية في الشات. لا تدخل كلمات مرور أو رموز وصول.';section.appendChild(note);
      var button=document.createElement('button');button.type='button';button.className='lnk';button.setAttribute('data-reply-compose','');button.textContent=english?'Prepare my reply':'جهّز ردي';section.appendChild(button);
    }
    return section.outerHTML;
  }
  function localize(node,english){
    var summary=node.querySelector('summary');if(summary)summary.textContent=english?'Review the proposed plan':'راجع الخطة المقترحة';
    var compose=node.querySelector('[data-reply-compose]');if(compose){compose.textContent=english?'Prepare my reply':'جهّز ردي';node.querySelector('p').textContent=english?'You can answer freely in chat. Do not enter passwords or access tokens.':'تقدر تجاوب بحرية في الشات. لا تدخل كلمات مرور أو رموز وصول.';}
    var suggest=node.querySelector('[data-reply-suggestion]');if(suggest)suggest.textContent=english?'Discuss this suggestion':'ناقش هذا الاقتراح';
    var dismiss=node.querySelector('[data-reply-dismiss]');if(dismiss)dismiss.textContent=english?'Keep my original request':'خلّنا على طلبي';
  }
  return {parse:parse,fallback:fallback,render:render,localize:localize};
});
