if(window.opener){
  window.opener.postMessage({type:'siyadah-oauth-result',connectionId:document.body.dataset.oauthConnection||''},window.location.origin);
  window.close();
}
