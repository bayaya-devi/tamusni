(() => {
  'use strict';

  const locale = document.body.dataset.locale || 'fr';
  const labels = {
    fr: { ad: 'Publicité', sponsored: 'Contenu sponsorisé' },
    en: { ad: 'Advertisement', sponsored: 'Sponsored content' },
    ar: { ad: 'إعلان', sponsored: 'محتوى برعاية' },
    es: { ad: 'Publicidad', sponsored: 'Contenido patrocinado' },
    pt: { ad: 'Publicidade', sponsored: 'Conteúdo patrocinado' }
  }[locale] || { ad: 'Advertisement', sponsored: 'Sponsored content' };
  const slots = [...document.querySelectorAll('[data-ad-slot]')];
  let started = false;

  function loadAdsense(client) {
    if (document.querySelector('script[data-tamusni-adsense]')) return;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.tamusniAdsense = 'true';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    document.head.append(script);
  }

  function renderAdSense(slot, item, disclosure) {
    slot.replaceChildren(disclosure);
    const ad = document.createElement('ins');
    ad.className = 'adsbygoogle';
    ad.style.display = 'block';
    ad.dataset.adClient = item.adsense_client;
    ad.dataset.adSlot = item.adsense_slot;
    ad.dataset.adFormat = item.adsense_format || 'auto';
    ad.dataset.fullWidthResponsive = 'true';
    slot.append(ad);
    slot.classList.add('has-campaign');
    loadAdsense(item.adsense_client);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
  }

  function renderDirect(slot, item, disclosure) {
    const link = document.createElement('a');
    link.href = item.target_url;
    link.target = '_blank';
    link.rel = item.ad_type === 'affiliate' ? 'sponsored nofollow noopener' : 'sponsored noopener';
    if (item.image_url) {
      const image = document.createElement('img');
      image.src = item.image_url;
      image.alt = '';
      image.loading = 'lazy';
      link.append(image);
    }
    const title = document.createElement('strong');
    title.textContent = item.headline || '';
    const description = document.createElement('span');
    description.textContent = item.body || '';
    link.append(title, description);
    link.addEventListener('click', () => {
      navigator.sendBeacon('/api/ads', new Blob([JSON.stringify({ id: item.id })], { type: 'application/json' }));
    });
    slot.replaceChildren(disclosure, link);
    slot.classList.add('has-campaign');
  }

  function start(detail) {
    if (started || !detail?.advertising) return;
    started = true;
    for (const slot of slots) {
      const placement = slot.dataset.adSlot;
      window.TamusniApi.request(`/api/ads?placement=${encodeURIComponent(placement)}`)
        .then(response => response.json())
        .then(({ item }) => {
          if (!item) return;
          const disclosure = document.createElement('small');
          disclosure.className = 'ad-disclosure';
          disclosure.textContent = item.ad_type === 'sponsored' ? labels.sponsored : labels.ad;
          if (item.provider === 'adsense') renderAdSense(slot, item, disclosure);
          else renderDirect(slot, item, disclosure);
        })
        .catch(() => {});
    }
  }

  window.addEventListener('tamusni-consent-ready', event => start(event.detail));
  start(window.TamusniConsent?.getState?.());
})();
