(function(){
  var form=document.querySelector('[data-auth-form]');
  if(!form)return;
  var message=document.getElementById('form-message');
  function showMfaStep(text){form.dataset.endpoint='/api/auth/mfa-login';form.innerHTML='<label>Code à six chiffres<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label><button type="submit">Vérifier le code</button><p class="message" id="form-message" role="status"></p>';message=form.querySelector('#form-message');message.textContent=text||'Ouvrez votre application d’authentification.';form.querySelector('input').focus()}
  form.addEventListener('submit',async function(event){
    event.preventDefault();var button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Traitement…';
    var body=Object.fromEntries(new FormData(form).entries());
    try{var response=await fetch(form.dataset.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var result=await response.json();if(!response.ok)throw new Error(result.error||'Opération impossible.');if(result.mfaRequired){showMfaStep(result.message);return}if(form.hasAttribute('data-no-redirect')){message.textContent=result.message||'Demande enregistrée.';button.disabled=false;return}message.textContent='Succès. Redirection…';location.href=result.redirect||'/compte/';}
    catch(error){message.textContent=error.message||'Opération impossible.';button.disabled=false;}
  });
  var oauthBox=document.createElement('div');oauthBox.innerHTML='<div class="oauth-divider">ou</div><div class="oauth-buttons"><button class="oauth-button" type="button" data-provider="google" disabled>Continuer avec Google</button></div><p class="oauth-note" id="oauth-note">Connexion Google en attente de configuration.</p>';form.parentNode.appendChild(oauthBox);
  fetch('/api/config').then(function(response){return response.json()}).then(function(config){var button=oauthBox.querySelector('[data-provider="google"]');button.disabled=!config.oauth.google;button.onclick=function(){location.href='/api/auth/oauth?provider=google'};if(config.oauth.google)document.getElementById('oauth-note').textContent='Connexion sécurisée via Google.'}).catch(function(){});
  var hash=new URLSearchParams(location.hash.slice(1));var accessToken=hash.get('access_token');if(accessToken){history.replaceState(null,'',location.pathname);fetch('/api/auth/oauth-session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:accessToken})}).then(async function(response){var result=await response.json();if(!response.ok)throw new Error(result.error);if(result.mfaRequired){showMfaStep(result.message);return}location.href=result.redirect}).catch(function(error){message.textContent=error.message})}
})();
