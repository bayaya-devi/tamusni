(() => {
  const locale=document.body.dataset.locale||'fr';
  const words={fr:['Publicité','Contenu sponsorisé','Publicité désactivée selon vos préférences.'],en:['Advertisement','Sponsored content','Ads disabled by your preferences.'],ar:['إعلان','محتوى برعاية','الإعلانات معطلة حسب تفضيلاتك.'],es:['Publicidad','Contenido patrocinado','Anuncios desactivados según tus preferencias.'],pt:['Publicidade','Conteúdo patrocinado','Anúncios desativados nas suas preferências.']}[locale];
  if(!words)return;
  function loadAdsense(client){
    if(document.querySelector('script[data-tamusni-adsense]'))return;
    const script=document.createElement('script');script.async=true;script.crossOrigin='anonymous';script.dataset.tamusniAdsense='true';script.src=`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;document.head.append(script);
  }
  for(const slot of document.querySelectorAll('[data-ad-slot]')){
    const placement=slot.dataset.adSlot;
    window.TamusniApi.request(`/api/ads?placement=${encodeURIComponent(placement)}`).then(response=>response.json()).then(({item})=>{
      if(!item)return;
      slot.classList.add('has-campaign');
      const disclosure=document.createElement('small');disclosure.className='ad-disclosure';disclosure.textContent=item.ad_type==='sponsored'?words[1]:words[0];
      if(item.provider==='adsense'){
        function render(){slot.replaceChildren(disclosure);const ad=document.createElement('ins');ad.className='adsbygoogle';ad.style.display='block';ad.dataset.adClient=item.adsense_client;ad.dataset.adSlot=item.adsense_slot;ad.dataset.adFormat=item.adsense_format||'auto';ad.dataset.fullWidthResponsive='true';slot.append(ad);loadAdsense(item.adsense_client);try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch{}}
        let consent='';try{consent=localStorage.getItem('tamusni-cookie-consent')||''}catch{}
        if(consent==='accepted')render();else{const note=document.createElement('p');note.textContent=words[2];slot.replaceChildren(disclosure,note);addEventListener('tamusni-consent-changed',event=>{if(event.detail==='accepted')render();});}
        return;
      }
      const link=document.createElement('a');link.href=item.target_url;link.target='_blank';link.rel=item.ad_type==='affiliate'?'sponsored nofollow noopener':'sponsored noopener';
      if(item.image_url){const image=document.createElement('img');image.src=item.image_url;image.alt='';image.loading='lazy';link.append(image);}
      const title=document.createElement('strong');title.textContent=item.headline||'';const description=document.createElement('span');description.textContent=item.body||'';
      link.append(title,description);link.addEventListener('click',()=>{navigator.sendBeacon('/api/ads',new Blob([JSON.stringify({id:item.id})],{type:'application/json'}));});
      slot.replaceChildren(disclosure,link);
    }).catch(()=>{});
  }
})();
