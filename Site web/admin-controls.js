(function(){
  function el(tag,text){var node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node}
  function request(method,body){return{method:method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}}
  async function api(url,options){var response=await window.TamusniApi.request(url,options);var data=await response.json().catch(function(){return{error:'Réponse invalide'}});if(!response.ok)throw new Error(data.error||'Opération impossible');return data}
  var topics=['Intelligence artificielle','Innovation','Robotique','Cybersécurité','Espace'];

  function activate(name){document.querySelectorAll('[data-admin-tab]').forEach(function(tab){tab.classList.toggle('is-active',tab.dataset.adminTab===name)});document.querySelectorAll('[data-admin-panel]').forEach(function(panel){panel.classList.toggle('is-active',panel.dataset.adminPanel===name)})}
  function addPanel(name,label,title){var tab=el('button',label);tab.dataset.adminTab=name;tab.onclick=function(){activate(name)};document.querySelector('.admin-tabs').append(tab);var panel=el('section');panel.className='admin-panel';panel.dataset.adminPanel=name;panel.append(el('h2',title));document.querySelector('main').insertBefore(panel,document.getElementById('logout'));return panel}
  function topicSelect(value){var select=el('select');select.name='preferredTopic';topics.forEach(function(topic){var option=el('option',topic);option.value=topic;option.selected=topic===value;select.append(option)});return select}
  function checkbox(label,checked){var wrap=el('label');var input=document.createElement('input');input.type='checkbox';input.checked=Boolean(checked);wrap.append(input,document.createTextNode(' '+label));return{wrap:wrap,input:input}}

  function setTypeGuidance(){var form=document.getElementById('content-form'),type=form.elements.type.value,guide=document.getElementById('content-type-guide');var messages={article:'Article : titre, sous-titre, image, contenu écrit détaillé et rubrique.',brief:'Brève : titre, sous-titre, image, information courte et rubrique.',video:'Vidéo : titre, sous-titre, URL vidéo, description et rubrique.',interview:'Interview : titre, sous-titre, image ou vidéo, interview écrite et rubrique.'};guide.textContent=messages[type]||messages.article}

  function installContentDeletion(){
    var box=document.getElementById('content-list'), ids={}; if(!box)return;
    async function refresh(){var data=await api('/api/admin/content');data.items.forEach(function(item){ids[item.slug]=item.id});Array.prototype.forEach.call(box.querySelectorAll('.admin-row'),function(row){if(row.querySelector('[data-content-delete]'))return;var link=row.querySelector('a[href^="/articles/"]');if(!link)return;var slug=link.getAttribute('href').split('/').filter(Boolean).pop(),id=ids[slug];if(!id)return;var controls=row.querySelector('.row-controls')||row;var button=el('button','Supprimer');button.dataset.contentDelete='true';button.onclick=async function(){if(!confirm('Supprimer définitivement ce contenu ?'))return;button.disabled=true;try{await api('/api/admin/content',request('DELETE',{id:id}));row.remove()}catch(error){alert(error.message)}finally{button.disabled=false}};controls.append(button)});}
    var timer;new MutationObserver(function(){clearTimeout(timer);timer=setTimeout(function(){refresh().catch(function(){})},60)}).observe(box,{childList:true,subtree:true});refresh().catch(function(){});
  }

  function accountForm(){
    var form=el('form');form.className='editor';form.id='admin-create-account';
    var name=el('input');name.name='name';name.required=true;name.minLength=2;var nameLabel=el('label','Nom complet');nameLabel.append(name);
    var email=el('input');email.name='email';email.type='email';email.required=true;var emailLabel=el('label','E-mail');emailLabel.append(email);
    var password=el('input');password.name='password';password.type='password';password.minLength=6;password.required=true;var passwordLabel=el('label','Mot de passe initial');passwordLabel.append(password);
    var topicLabel=el('label','Rubrique préférée');topicLabel.append(topicSelect(topics[0]));
    var accountAds=checkbox('Autoriser les contenus sponsorisés dans le compte',false), emailAds=checkbox('Autoriser les e-mails sponsorisés',false);
    var submit=el('button','Créer le compte');submit.type='submit';submit.className='wide';var status=el('p');status.className='wide';status.setAttribute('role','status');
    form.append(nameLabel,emailLabel,passwordLabel,topicLabel,accountAds.wrap,emailAds.wrap,submit,status);
    form.onsubmit=async function(event){event.preventDefault();submit.disabled=true;try{await api('/api/admin/users',request('POST',{name:name.value,email:email.value,password:password.value,preferredTopic:topicLabel.querySelector('select').value,sponsoredInApp:accountAds.input.checked,sponsoredEmail:emailAds.input.checked}));form.reset();status.textContent='Compte créé.';loadAccounts(form.parentNode.querySelector('[data-account-list]'));}catch(error){status.textContent=error.message}finally{submit.disabled=false}};
    return form;
  }

  function accountRow(item,list){
    var row=el('article');row.className='admin-row';var fields=el('div');fields.className='editor';
    var name=el('input');name.value=item.name;name.setAttribute('aria-label','Nom');var email=el('input');email.type='email';email.value=item.email;email.setAttribute('aria-label','E-mail');var topic=topicSelect(item.preferred_topic||topics[0]);
    var accountAds=checkbox('Compte sponsorisé',item.sponsored_in_app),emailAds=checkbox('E-mail sponsorisé',item.sponsored_email);var meta=el('small',(item.role==='ADMIN'?'Administrateur':'Utilisateur')+' · '+(item.is_banned?'Suspendu':'Actif')+' · créé le '+new Date(item.created_at).toLocaleDateString('fr-FR'));
    fields.append(name,email,topic,accountAds.wrap,emailAds.wrap,meta);var controls=el('div');controls.className='row-controls';
    if(item.role!=='ADMIN'){
      var save=el('button','Enregistrer');save.onclick=async function(){save.disabled=true;try{await api('/api/admin/users',request('PATCH',{id:item.id,action:'update',name:name.value,email:email.value,preferredTopic:topic.value,sponsoredInApp:accountAds.input.checked,sponsoredEmail:emailAds.input.checked}));await loadAccounts(list)}catch(error){alert(error.message)}finally{save.disabled=false}};
      var ban=el('button',item.is_banned?'Réactiver':'Bannir');ban.onclick=async function(){ban.disabled=true;try{await api('/api/admin/users',request('PATCH',{id:item.id,action:item.is_banned?'unban':'ban'}));await loadAccounts(list)}catch(error){alert(error.message)}finally{ban.disabled=false}};
      var remove=el('button','Supprimer');remove.onclick=async function(){if(!confirm('Supprimer définitivement ce compte et ses données associées ?'))return;remove.disabled=true;try{await api('/api/admin/users',request('DELETE',{id:item.id}));row.remove()}catch(error){alert(error.message)}finally{remove.disabled=false}};controls.append(save,ban,remove);
    } else controls.append(el('small','Compte administrateur protégé'));
    row.append(fields,controls);return row;
  }

  async function loadAccounts(box){var data=await api('/api/admin/users');box.innerHTML='';if(!data.items.length){box.append(el('p','Aucun compte créé pour le moment.'));return}data.items.forEach(function(item){box.append(accountRow(item,box))})}
  async function loadReports(box){var data=await api('/api/admin/reports');box.innerHTML='';if(!data.items.length){box.append(el('p','Aucun signalement pour le moment.'));return}data.items.forEach(function(item){var row=el('article');row.className='admin-row';var info=el('div');info.append(el('strong',item.target_type+' · '+item.target_id),el('p',item.reason+(item.details?' — '+item.details:'')),el('small','Signalé par '+item.reporter_name+' · '+item.reporter_email));var select=document.createElement('select');['open','reviewing','closed'].forEach(function(status){var option=el('option',status==='open'?'Ouvert':status==='reviewing'?'En cours':'Clos');option.value=status;option.selected=item.status===status;select.append(option)});select.onchange=async function(){try{await api('/api/admin/reports',request('PATCH',{id:item.id,status:select.value}))}catch(error){alert(error.message)}};row.append(info,select);box.append(row)})}

  function init(){var form=document.getElementById('content-form');if(!form||document.getElementById('admin-account-controls'))return;var type=form.elements.type;[['brief','Brève'],['interview','Interview']].forEach(function(entry){var option=el('option',entry[1]);option.value=entry[0];type.append(option)});var guide=el('p');guide.id='content-type-guide';guide.style.cssText='margin:0 0 16px;color:var(--muted);font-size:13px';form.before(guide);type.addEventListener('change',setTypeGuidance);setTypeGuidance();installContentDeletion();var accounts=addPanel('accounts','Comptes','Comptes utilisateurs');accounts.id='admin-account-controls';accounts.append(el('h3','Créer un compte utilisateur'),accountForm(),el('h3','Gérer les comptes'));var accountList=el('div');accountList.className='admin-list';accountList.dataset.accountList='true';accounts.append(accountList);var reports=addPanel('reports','Signalements','Signalements utilisateurs');var reportList=el('div');reportList.className='admin-list';reports.append(reportList);loadAccounts(accountList).catch(function(error){accountList.textContent=error.message});loadReports(reportList).catch(function(error){reportList.textContent=error.message})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
