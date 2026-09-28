/* Supabase Discord authentication and lightweight profile UI. */
(()=>{
  const config=window.WATCHLIST_SUPABASE_CONFIG;
  if(!config?.url||!config?.publishableKey)return;
  const loadClient=()=>new Promise((resolve,reject)=>{
    if(window.supabase?.createClient)return resolve(window.supabase);
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload=()=>window.supabase?.createClient?resolve(window.supabase):reject(new Error("Supabase client did not load"));
    script.onerror=()=>reject(new Error("Could not load Supabase client"));
    document.head.appendChild(script);
  });
  let client=null;
  const style=document.createElement("style");
  style.textContent=`
    .auth-control{display:flex;align-items:center;gap:9px;margin-left:14px}
    .auth-signin,.auth-signout{border:1px solid var(--line2);background:var(--panel);color:var(--text);border-radius:8px;padding:8px 11px;font:inherit;font-size:13px;cursor:pointer}
    .auth-profile{display:flex;align-items:center;gap:8px;color:var(--text);font-size:13px}
    .auth-avatar{width:30px;height:30px;object-fit:cover;border-radius:50%;background:var(--panel2);border:1px solid var(--line2)}
    .auth-error{position:fixed;right:18px;bottom:18px;z-index:9999;max-width:360px;background:#321d20;color:#ffe4e4;border:1px solid #87464d;border-radius:9px;padding:12px 15px;font-size:13px}
    @media(max-width:760px){.auth-control{margin-left:0}.auth-signout{padding:6px 8px}.auth-profile span{display:none}}
  `;
  document.head.appendChild(style);
  function showError(error){
    document.querySelector(".auth-error")?.remove();
    const box=document.createElement("div");box.className="auth-error";box.setAttribute("role","alert");
    box.textContent=error?.message||"Authentication failed. Please try again.";
    document.body.appendChild(box);setTimeout(()=>box.remove(),7000);
  }
  function profileMarkup(user){
    if(!user)return '<button class="auth-signin" type="button" data-watchlist-auth="signin">Sign in with Discord</button>';
    const meta=user.user_metadata||{};
    const name=meta.global_name||meta.full_name||meta.name||meta.user_name||meta.preferred_username||"Discord user";
    const avatar=meta.avatar_url||meta.picture||"";
    return '<div class="auth-profile">'+(avatar?'<img class="auth-avatar" referrerpolicy="no-referrer" src="'+String(avatar).replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'" alt="">':'<span class="auth-avatar" aria-hidden="true"></span>')+'<span>'+String(name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</span></div><button class="auth-signout" type="button" data-watchlist-auth="signout">Sign out</button>';
  }
  function paint(user){
    const old=document.querySelector(".auth-control");if(old)old.remove();
    const meta=user?.user_metadata||{};
    const profile=user?{name:meta.global_name||meta.full_name||meta.name||meta.user_name||meta.preferred_username||"Discord user",avatar:meta.avatar_url||meta.picture||""}:null;
    window.WATCHLIST_AUTH_PROFILE=profile;
    window.WATCHLIST_AUTHENTICATED=!!user;
    if(typeof window.watchlistAuthIdentityChanged==="function")window.watchlistAuthIdentityChanged(profile);
    const host=document.querySelector(".topbar");
    if(!host)return;
    const control=document.createElement("div");control.className="auth-control";control.innerHTML=profileMarkup(user);
    host.appendChild(control);
  }
  document.addEventListener("click",async event=>{
    const button=event.target.closest("[data-watchlist-auth]");if(!button)return;
    button.disabled=true;
    try{
      if(!client)client=await loadClient().then(lib=>lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
      if(button.dataset.watchlistAuth==="signin"){
        const {error}=await client.auth.signInWithOAuth({provider:"discord",options:{redirectTo:window.location.origin+window.location.pathname}});
        if(error)throw error;
      }else{
        const {error}=await client.auth.signOut();if(error)throw error;paint(null);
      }
    }catch(error){showError(error);button.disabled=false;}
  });
  loadClient().then(lib=>{
    client=lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client.auth.getSession();
  }).then(({data,error})=>{
    if(error)throw error;
    paint(data.session?.user||null);
    client.auth.onAuthStateChange((_event,session)=>paint(session?.user||null));
  }).catch(showError);
})();
