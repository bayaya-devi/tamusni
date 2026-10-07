(() => {
  try { if(localStorage.getItem('tamusni-cookie-consent'))return; } catch {}
  const locale=document.body.dataset.locale||'fr';
  const style=document.createElement('style');style.textContent='.consent-banner{position:fixed;z-index:200;inset:auto 18px 18px;width:min(640px,calc(100% - 36px));margin:auto;padding:20px 22px;border:1px solid #bfc7d5;border-radius:16px;background:rgba(17,26,46,.96);color:#f8fafc;box-shadow:0 20px 60px rgba(0,0,0,.22);font:400 14px/1.55 Inter,Arial,sans-serif;backdrop-filter:blur(16px)}.consent-banner h2{margin:0 0 8px;color:#f8fafc;font:700 18px/1.3 Inter,Arial,sans-serif}.consent-banner p{margin:0 0 15px;color:#dce1e8}.consent-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.consent-actions button,.consent-actions a{min-height:44px;padding:10px 13px;border:1px solid #bfc7d5;border-radius:10px;background:transparent;color:#f8fafc;font:600 13px Inter,Arial,sans-serif;text-decoration:none;cursor:pointer}.consent-actions button:nth-child(2){border-color:#2563eb;background:#2563eb}.consent-actions :is(button,a):hover{border-color:#80a7ff;color:#fff}.consent-actions :is(button,a):focus-visible{outline:3px solid #80a7ff;outline-offset:3px}';document.head.append(style);
  const translations={
    fr:['Préférences de confidentialité','TAMUSNI utilise les données nécessaires au fonctionnement. Avec votre accord, Google AdSense peut charger des technologies publicitaires facultatives.','Refuser','Accepter les publicités','En savoir plus'],
    ar:['تفضيلات الخصوصية','تستخدم تاموسني البيانات اللازمة لعمل الموقع. بموافقتك، يمكن لـ Google AdSense تحميل تقنيات إعلانية اختيارية.','رفض','قبول الإعلانات','اعرف المزيد'],
    en:['Privacy preferences','TAMUSNI uses data necessary to operate. With your consent, Google AdSense may load optional advertising technologies.','Decline','Accept ads','Learn more'],
    es:['Preferencias de privacidad','TAMUSNI utiliza los datos necesarios para funcionar. Con tu consentimiento, Google AdSense puede cargar tecnologías publicitarias opcionales.','Rechazar','Aceptar anuncios','Más información'],
    pt:['Preferências de privacidade','A TAMUSNI utiliza os dados necessários para funcionar. Com o seu consentimento, o Google AdSense pode carregar tecnologias publicitárias opcionais.','Recusar','Aceitar anúncios','Saiba mais']
  }[locale];
  const banner=document.createElement('aside');banner.className='consent-banner';banner.setAttribute('aria-label',translations[0]);
  const heading=document.createElement('h2');heading.textContent=translations[0];const description=document.createElement('p');description.textContent=translations[1];
  const actions=document.createElement('div');actions.className='consent-actions';
  function action(label,value){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>{try{localStorage.setItem('tamusni-cookie-consent',value)}catch{}dispatchEvent(new CustomEvent('tamusni-consent-changed',{detail:value}));banner.remove();});return button;}
  actions.append(action(translations[2],'necessary'),action(translations[3],'accepted'));
  const details=document.createElement('a');details.href=`/${locale}/cookies/`;details.textContent=translations[4];actions.append(details);
  banner.append(heading,description,actions);document.body.append(banner);
})();
