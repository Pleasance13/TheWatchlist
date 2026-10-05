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
  let lastProviderToken=null;
  const providerTokenStorageKey="watchlist-discord-provider-token";
  function storedProviderToken(){try{return sessionStorage.getItem(providerTokenStorageKey)||null}catch(error){return null}}
  function storeProviderToken(token){try{if(token)sessionStorage.setItem(providerTokenStorageKey,token);else sessionStorage.removeItem(providerTokenStorageKey)}catch(error){}}
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
  
  function paint(user,session=null){
    if(session?.provider_token){lastProviderToken=session.provider_token;storeProviderToken(session.provider_token)}
    if(session?.provider_refresh_token)storeProviderRefreshToken(session.provider_refresh_token);
    else if(user&&!lastProviderToken)lastProviderToken=storedProviderToken();
    if(!user){lastProviderToken=null;storeProviderToken(null);storeProviderRefreshToken(null)}
    const meta=discordProfileData(user);
    const identityValues=[meta.user_name,meta.preferred_username,meta.username,meta.global_name,meta.full_name,meta.name,].filter(value=>typeof value==="string").map(value=>value.trim().toLowerCase());
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
        const {error}=await client.auth.signInWithOAuth({provider:"discord",options:{redirectTo:window.location.origin+window.location.pathname,scopes:"identify guilds"}});
        if(error)throw error;
      }else{
        const {error}=await client.auth.signOut();if(error)throw error;if(typeof window.watchlistClearFilterPersistence==="function")window.watchlistClearFilterPersistence();paint(null);
      }
    }catch(error){showError(error);button.disabled=false;}
  });

  const providerRefreshTokenStorageKey="watchlist-discord-provider-refresh-token";
  function storedProviderRefreshToken(){
    try{return localStorage.getItem(providerRefreshTokenStorageKey)||null}catch(error){return null}
  }
  function storeProviderRefreshToken(token){
    try{if(token)localStorage.setItem(providerRefreshTokenStorageKey,token);else localStorage.removeItem(providerRefreshTokenStorageKey)}catch(error){}
  }
  function captureProviderTokens(session){
    if(session?.provider_refresh_token)storeProviderRefreshToken(session.provider_refresh_token);
    if(session?.provider_token){lastProviderToken=session.provider_token;storeProviderToken(session.provider_token)}
  }

  async function refreshDiscordProviderToken(){
    if(!client)throw new Error("Authentication is still loading. Please try again.");
    const {data,error}=await client.auth.getSession();if(error)throw error;
    const refreshToken=data?.session?.provider_refresh_token||storedProviderRefreshToken();
    if(!refreshToken)return null;
    const response=await fetch("/api/discord-token.js",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({refresh_token:refreshToken})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok||!payload.access_token)return null;
    lastProviderToken=payload.access_token;
    storeProviderToken(payload.access_token);
    if(payload.refresh_token)storeProviderRefreshToken(payload.refresh_token);
    return payload.access_token;
  }

  async function refreshDiscordAccess(){
    const refreshed=await refreshDiscordProviderToken();
    if(refreshed)return refreshed;
    if(!client)throw new Error("Authentication is still loading. Please try again.");
    const {data,error}=await client.auth.getSession();if(error)throw error;
    if(!data?.session?.user)throw new Error("Please sign in with Discord first.");
    const reauthKey="watchlist-discord-reauth-in-progress";
    if(sessionStorage.getItem(reauthKey)==="1"){
      sessionStorage.removeItem(reauthKey);
      throw new Error("Discord server access could not be restored. Please sign in with Discord again.");
    }
    sessionStorage.setItem(reauthKey,"1");
    const {error:oauthError}=await client.auth.signInWithOAuth({provider:"discord",options:{redirectTo:window.location.origin+window.location.pathname+window.location.search,scopes:"identify guilds"}});
    if(oauthError){sessionStorage.removeItem(reauthKey);throw oauthError}
    throw new Error("Refreshing Discord server access…");
  }

  window.WATCHLIST_FETCH_DISCORD_GUILDS=async function(){
    if(!client)throw new Error("Authentication is still loading. Please try again.");
    const {data,error}=await client.auth.getSession();if(error)throw error;
    let token=data?.session?.provider_token||lastProviderToken||storedProviderToken();
    if(!token)token=await refreshDiscordProviderToken();
    if(!token)return refreshDiscordAccess();
    let response=await fetch("https://discord.com/api/users/@me/guilds",{headers:{Authorization:"Bearer "+token}});
    if(response.status===401||response.status===403){
      token=await refreshDiscordProviderToken();
      if(token)response=await fetch("https://discord.com/api/users/@me/guilds",{headers:{Authorization:"Bearer "+token}});
    }
    if(response.status===401||response.status===403){
      lastProviderToken=null;storeProviderToken(null);
      throw new Error("Discord server access has expired. Please sign in with Discord again to refresh server access.");
    }
    if(!response.ok)throw new Error("Could not load your Discord servers (HTTP "+response.status+").");
    return response.json();
  };

  // FIXED SECTION: Rely purely on onAuthStateChange to handle initial session discovery and URL token parsing.
  loadClient().then(lib=>{
    client=lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    window.WATCHLIST_SUPABASE_CLIENT=client;
    
    client.auth.onAuthStateChange((event, session)=>{
      paint(session?.user || null,session);
      
      // Clean up the URL hash parameters once successfully signed in so they don't linger in the browser address bar
      if(event === "SIGNED_IN") {
        const currentUrl=new URL(window.location.href);
        currentUrl.hash="";
        // OAuth returns to the app entry point. Replace it so browser Back starts
        // with in-app navigation rather than the transient Discord callback URL.
        const page=currentUrl.searchParams.get("page")||"watchlist";
        if(!currentUrl.searchParams.get("movie"))currentUrl.searchParams.set("page",page);
        window.history.replaceState(null, document.title, currentUrl.pathname + currentUrl.search);
      }
    });
  }).catch(showError);
})();
