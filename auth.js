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
    if(session?.provider_token&&!lastProviderToken){lastProviderToken=session.provider_token;storeProviderToken(session.provider_token)}
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
    // Open synchronously from the click so browsers don't treat the auth window as a popup.
    let authPopup=null;
    if(button.dataset.watchlistAuth==="signin"){
      authPopup=window.open("about:blank","watchlist-discord-auth","popup=yes,width=520,height=720,resizable=yes,scrollbars=yes");
    }
    try{
      if(!client)client=await loadClient().then(lib=>lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
      if(button.dataset.watchlistAuth==="signin"){
        const callbackUrl=new URL(window.location.href);
        callbackUrl.searchParams.set("watchlist_oauth_popup","1");
        const options={redirectTo:callbackUrl.origin+callbackUrl.pathname+callbackUrl.search,scopes:"identify guilds"};
        if(authPopup){
          options.skipBrowserRedirect=true;
          const {data,error}=await client.auth.signInWithOAuth({provider:"discord",options});
          if(error)throw error;
          if(!data?.url)throw new Error("Discord did not return an authorization URL.");
          authPopup.location.href=data.url;
        }else{
          // Preserve a working sign-in path if the browser blocks popups.
          const {error}=await client.auth.signInWithOAuth({provider:"discord",options:{redirectTo:window.location.origin+window.location.pathname,scopes:"identify guilds"}});
          if(error)throw error;
        }
      }else{
        const {error}=await client.auth.signOut();if(error)throw error;if(typeof window.watchlistClearFilterPersistence==="function")window.watchlistClearFilterPersistence();paint(null);
      }
    }catch(error){if(authPopup&&!authPopup.closed)authPopup.close();showError(error);button.disabled=false;}
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
    // Discord rotates refresh tokens. The latest token returned by our endpoint is canonical;
    // the provider_refresh_token still present in the Supabase session can be stale.
    const refreshToken=storedProviderRefreshToken()||data?.session?.provider_refresh_token;
    if(!refreshToken)return null;
    const response=await fetch("/api/discord-token",{
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

const reauthNeeded=()=>Object.assign(new Error("Discord needs you to sign in again to list your servers."),{code:"DISCORD_REAUTH_NEEDED"});

window.WATCHLIST_FETCH_DISCORD_GUILDS=async function(){
  if(!client)throw new Error("Authentication is still loading. Please try again.");
  const {data,error}=await client.auth.getSession();if(error)throw error;
  if(!data?.session?.user)throw new Error("Please sign in with Discord first.");
  let token=lastProviderToken||storedProviderToken()||data.session.provider_token;
  if(!token)token=await refreshDiscordProviderToken();
  if(!token)throw reauthNeeded();
  const get=t=>fetch("https://discord.com/api/users/@me/guilds",{headers:{Authorization:"Bearer "+t}});
  let response=await get(token);
  if(response.status===401||response.status===403){
    token=await refreshDiscordProviderToken();
    if(token)response=await get(token);
  }
  if(response.status===401||response.status===403){
    lastProviderToken=null;storeProviderToken(null);
    throw reauthNeeded();
  }
  if(!response.ok)throw new Error("Could not load your Discord servers (HTTP "+response.status+").");
  return response.json();
};

// Must be called directly from a click so the popup isn't blocked.
// Resolves once the popup finishes; rejects if it's closed early.
window.WATCHLIST_REAUTH_DISCORD=function(){
  const authPopup=window.open("about:blank","watchlist-discord-auth","popup=yes,width=520,height=720,resizable=yes,scrollbars=yes");
  if(!client)return Promise.reject(new Error("Authentication is still loading. Please try again."));
  const popupUrl=new URL(window.location.href);popupUrl.searchParams.set("watchlist_oauth_popup","1");
  const redirectTo=authPopup?popupUrl.origin+popupUrl.pathname+popupUrl.search:window.location.origin+window.location.pathname+window.location.search;
  return client.auth.signInWithOAuth({provider:"discord",options:{redirectTo,scopes:"identify guilds",skipBrowserRedirect:!!authPopup}}).then(({data,error})=>{
    if(error)throw error;
    if(!authPopup)return new Promise(()=>{}); // full-page redirect is underway
    if(!data?.url)throw new Error("Discord did not return an authorization URL.");
    authPopup.location.href=data.url;
    return new Promise((resolve,reject)=>{
      let finished=false;
      const finish=(ok,err)=>{if(finished)return;finished=true;window.removeEventListener("message",onMsg);clearInterval(timer);ok?resolve():reject(err)};
      const onMsg=e=>{
        if(e.origin!==window.location.origin||e.data?.type!=="watchlist-discord-auth-complete")return;
        lastProviderToken=null;storeProviderToken(null); // force use of the fresh refresh token
        finish(true);
      };
      window.addEventListener("message",onMsg);
      const timer=setInterval(()=>{if(authPopup.closed)setTimeout(()=>finish(false,new Error("Discord sign-in was closed before it finished.")),400)},500);
    });
  }).catch(e=>{if(authPopup&&!authPopup.closed)authPopup.close();throw e});
};

  // FIXED SECTION: Rely purely on onAuthStateChange to handle initial session discovery and URL token parsing.
  loadClient().then(lib=>{
    client=lib.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    window.WATCHLIST_SUPABASE_CLIENT=client;
    
    client.auth.onAuthStateChange((event, session)=>{
      paint(session?.user || null,session);
      // A fresh OAuth sign-in supersedes any provider tokens cached from an earlier session.
      if(event==="SIGNED_IN"){
        if(session?.provider_token){lastProviderToken=session.provider_token;storeProviderToken(session.provider_token)}
        if(session?.provider_refresh_token)storeProviderRefreshToken(session.provider_refresh_token);
      }
      
      // Clean up the URL hash parameters once successfully signed in so they don't linger in the browser address bar
      if(event === "SIGNED_IN") {
        const currentUrl=new URL(window.location.href);
        // The popup shares Supabase's persisted session with the opener; notify it and close.
        if(currentUrl.searchParams.get("watchlist_oauth_popup")==="1"){
          if(window.opener){try{window.opener.postMessage({type:"watchlist-discord-auth-complete"},"*")}catch(error){}}
          window.close();
          return;
        }
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
