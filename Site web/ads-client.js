(function(){
  function loadAdsenseScript(client){
    if(document.querySelector('script[data-tamusni-adsense]'))return;
    var script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.dataset.tamusniAdsense='true';script.src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client='+encodeURIComponent(client);document.head.append(script);
  }
  document.querySelectorAll('[data-ad-slot]').forEach(async function(slot){
    var placement=slot.dataset.adSlot;
    try{
      var response=await fetch('/api/ads?placement='+encodeURIComponent(placement));var data=await response.json();if(!data.item)return;var item=data.item;
      slot.innerHTML='';slot.classList.add('has-campaign','ad-type-'+(item.ad_type||'native'));
      if(item.provider==='adsense'){
        function renderAdsense(){slot.innerHTML='';var disclosure=document.createElement('small');disclosure.textContent='Publicité';var ad=document.createElement('ins');ad.className='adsbygoogle';ad.style.display='block';ad.dataset.adClient=item.adsense_client;ad.dataset.adSlot=item.adsense_slot;ad.dataset.adFormat=item.adsense_format||'auto';ad.dataset.fullWidthResponsive='true';slot.append(disclosure,ad);loadAdsenseScript(item.adsense_client);setTimeout(function(){try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(_){}},0)}
        var consent='';try{consent=localStorage.getItem('tamusni-cookie-consent')||''}catch(_){}if(consent==='accepted')renderAdsense();else{var notice=document.createElement('small');notice.textContent='Publicité désactivée selon vos préférences.';slot.append(notice);window.addEventListener('tamusni-consent-changed',function(event){if(event.detail==='accepted')renderAdsense()},{once:true})}return;
      }
      var labels={display:'Publicité',native:'Publicité native',sponsored:'Contenu sponsorisé',affiliate:'Lien affilié',house:'À découvrir sur TAMUSNI'};var link=document.createElement('a');link.href=item.target_url;link.target='_blank';link.rel=(item.ad_type==='affiliate'?'sponsored nofollow noopener':'sponsored noopener');link.dataset.adId=item.id;var label=document.createElement('small');label.textContent=(labels[item.ad_type]||'Publicité')+' · '+item.advertiser;var title=document.createElement('strong');title.textContent=item.headline;var copy=document.createElement('span');copy.textContent=item.body||'';if(item.image_url){var image=document.createElement('img');image.src=item.image_url;image.alt='Visuel publicitaire de '+item.advertiser;link.append(image)}link.append(label,title,copy);link.onclick=function(){navigator.sendBeacon('/api/ads',new Blob([JSON.stringify({id:item.id})],{type:'application/json'}))};slot.append(link)
    }catch(_){}
  })
})();
