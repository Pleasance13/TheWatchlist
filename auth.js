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
    // Filter out cosmetic/expected errors if they happen during redirect handshakes
    if (error?.message?.includes("exchange external code")) return;
    document.querySelector(".auth-error")?.remove();
    const box=document.createElement("div");box.className="auth-error";box.setAttribute("role","alert");
    box.textContent=error?.message||"Authentication failed. Please try again.";
    document.body.appendChild(box);setTimeout(()=>box.remove(),7000);
  }
  
  function discordProfileData(user){
    const meta=user?.user_metadata||{};
    const identityData=(user?.identities||[]).find(identity=>identity.provider==="discord")?.identity_data||{};
    const nestedMeta=meta.custom_claims||{};
    const nestedIdentity=identityData.custom_claims||{};
    return {...identityData,...nestedIdentity,...meta,...nestedMeta};
  }
  function discordDisplayName(user){
    const data=discordProfileData(user);
    return data.global_name||data.display_name||data.full_name||data.name||data.preferred_username||data.user_name||data.username||"Discord user";
  }
  function profileMarkup(user){
    if(!user)return '<button class="auth-signin" type="button" data-watchlist-auth="signin">Sign in with Discord</button>';
    const meta=discordProfileData(user);
    const name=discordDisplayName(user);
    const avatar=meta.avatar_url||meta.picture||meta.avatar||"";
    return '<div class="auth-profile">'+(avatar?'<img class="auth-avatar" referrerpolicy="no-referrer" src="'+String(avatar).replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'" alt="">':'<span class="auth-avatar" aria-hidden="true"></span>')+'<span>'+String(name).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</span></div><button class="auth-signout" type="button" data-watchlist-auth="signout">Sign out</button>';
  }
  
  function paint(user){
    const meta=discordProfileData(user);
    const identityValues=[meta.user_name,meta.preferred_username,meta.username,meta.global_name,meta.full_name,meta.name,user?.email].filter(value=>typeof value==="string").map(value=>value.trim().toLowerCase());
    // Discord/Supabase may expose the account handle under different metadata keys.
    // Accept the exact handle (or Discord's legacy discriminator form), not a substring.
    const canEditArtwork=identityValues.some(value=>value===".pleasance"||value==="@.pleasance"||value.endsWith("#.pleasance"));
    const profile=user?{id:user.id,name:discordDisplayName(user),avatar:meta.avatar_url||meta.picture||"",canEditArtwork}:null;
    window.WATCHLIST_AUTH_PROFILE=profile;
    window.WATCHLIST_SUPABASE_CLIENT=client;
    window.WATCHLIST_AUTHENTICATED=!!user;
    if(typeof window.watchlistAuthIdentityChanged==="function")window.watchlistAuthIdentityChanged(profile);
  }
  window.watchlistAuthControlMarkup=function(){
    const user=window.WATCHLIST_AUTHENTICATED?{user_metadata:window.WATCHLIST_AUTH_PROFILE}:null;
    return '<div class="auth-control">'+profileMarkup(user)+'</div>';
  };
  
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

  // FIXED SECTION: Rely purely on onAuthStateChange to handle initial session discovery and URL token parsing.
  loadClient().then(lib=>{
    client=lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    window.WATCHLIST_SUPABASE_CLIENT=client;
    
    client.auth.onAuthStateChange((event, session)=>{
      paint(session?.user || null);
      
      // Clean up the URL hash parameters once successfully signed in so they don't linger in the browser address bar
      if(event === "SIGNED_IN" && window.location.hash) {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      }
    });
  }).catch(showError);
})();
