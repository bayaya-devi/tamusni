(function(){
  "use strict";
  var api=window.TamusniApi;var placement=document.querySelector("[data-business-campaign]");if(!api||!placement)return;
  var storageKey="tamusni-business-visitor";var visitor=localStorage.getItem(storageKey);if(!visitor){visitor=crypto.randomUUID();localStorage.setItem(storageKey,visitor);}
  var payload=function(type){return JSON.stringify({campaignId:placement.dataset.businessCampaign,eventType:type,visitorId:visitor,pagePath:placement.dataset.businessPage||location.pathname,locale:document.body.dataset.locale||"fr",deviceClass:matchMedia("(max-width: 760px)").matches?"mobile":"desktop"});};
  var sent=false,timer=null;var observer=new IntersectionObserver(function(entries){var visible=entries.some(function(entry){return entry.isIntersecting&&entry.intersectionRatio>=.5;});if(visible&&!sent&&!timer)timer=setTimeout(function(){sent=true;api.request("/api/business/delivery",{method:"POST",headers:{"Content-Type":"application/json"},body:payload("impression"),keepalive:true}).catch(function(){});},1000);else if(!visible&&timer){clearTimeout(timer);timer=null;}},{threshold:[.5]});observer.observe(placement);
  placement.querySelector("[data-business-click]")?.addEventListener("click",function(){api.request("/api/business/delivery",{method:"POST",headers:{"Content-Type":"application/json"},body:payload("click"),keepalive:true}).catch(function(){});});
})();
