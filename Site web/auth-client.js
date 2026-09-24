(function(){
  var form=document.querySelector('[data-auth-form]');
  if(!form)return;
  var message=document.getElementById('form-message');
  form.addEventListener('submit',async function(event){
    event.preventDefault();var button=form.querySelector('button[type="submit"]');button.disabled=true;message.textContent='Traitement…';
    var body=Object.fromEntries(new FormData(form).entries());
    try{var response=await fetch(form.dataset.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});var result=await response.json();if(!response.ok)throw new Error(result.error||'Opération impossible.');if(form.hasAttribute('data-no-redirect')){message.textContent=result.message||'Demande enregistrée.';button.disabled=false;return}message.textContent='Succès. Redirection…';location.href=result.redirect||'/compte/';}
    catch(error){message.textContent=error.message||'Opération impossible.';button.disabled=false;}
  });
})();
