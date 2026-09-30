function normalizeWarningLabel(value){
  return String(value||"").trim().toLowerCase().replace(/\s+/g," ")
    .split(" ").map(word=>word.split(/([/-])/).map(part=>part==="/"||part==="-"?part:part?part[0].toUpperCase()+part.slice(1):"").join("")).join(" ");
}
function dedupeWarnings(values){
  const unique=new Map();
  (Array.isArray(values)?values:[]).forEach(value=>{
    const label=normalizeWarningLabel(value);
    const key=label.toLowerCase();
    if(label&&!unique.has(key))unique.set(key,label);
  });
  return [...unique.values()];
}

const fallback=(t,y)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#25282d"/><rect x="30" y="30" width="440" height="690" rx="12" fill="#17191c" stroke="#4a4f57"/><text x="250" y="350" fill="#e8e4da" font-family="Arial" font-size="38" font-weight="bold" text-anchor="middle">${t}</text><text x="250" y="400" fill="#9298a1" font-family="Arial" font-size="24" text-anchor="middle">${y}</text></svg>`)}`;

const movies=[];
let savedSeenStatus={};
let baseScores={};
let stateVotesPlaceholder={};
let movieReviews={};
let watchedMovies=[];
let watchedAttendance={};
let currentUser=window.WATCHLIST_CURRENT_USER||"Guest";
let currentProfile=window.WATCHLIST_AUTH_PROFILE||null;
let votesByUser={};
let userProfiles={};
try{localStorage.removeItem("watchlist-added-movies");localStorage.removeItem("watchlist-removed-movies");localStorage.removeItem("watchlist-seen-status");localStorage.removeItem("watchlist-votes");localStorage.removeItem("watchlist-votes-by-user");localStorage.removeItem("watchlist-reviews");localStorage.removeItem("watchlist-watched-movies");localStorage.removeItem("watchlist-watched-attendance");localStorage.removeItem("watchlist-suggestion-notes")}catch(error){}

function userKey(name){return String(name||"Guest").trim().toLowerCase()}
function identityIdForName(name){
  const target=String(name||"").trim();
  if(!target)return null;
  if(currentProfile?.id&&target.toLowerCase()===String(currentUser||"").trim().toLowerCase())return currentProfile.id;
  for(const profile of Object.values(userProfiles||{})){
    if(profile?.id&&String(profile.name||"").trim().toLowerCase()===target.toLowerCase())return profile.id;
  }
  for(const entry of Object.values(votesByUser||{})){
    if(entry?.id&&String(entry.name||"").trim().toLowerCase()===target.toLowerCase())return entry.id;
  }
  return null;
}
function stableIdentityKey(name){const raw=String(name||"").trim();if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw))return raw;return identityIdForName(raw)||userKey(raw)}
function identityDisplayName(key,profiles={},votes={}){
  const k=String(key||"");
  const direct=profiles[k]||votes[k];
  if(direct?.name)return direct.name;
  for(const profile of Object.values(profiles||{})){if(profile?.id===k)return profile.name||k}
  for(const entry of Object.values(votes||{})){if(entry?.id===k)return entry.name||k}
  if(currentProfile?.id===k)return currentUser;
  return k;
}
function decodeIdentityMap(map={}){
  const out={};
  Object.entries(map||{}).forEach(([key,value])=>{
    const name=value?.name||identityDisplayName(key,map,{});
    const stable=value?.id||key;
    out[userKey(name)]={...value,id:value?.id||stable,name};
  });
  return out;
}
function serializeIdentityMap(map={}){
  const out={};
  Object.entries(map||{}).forEach(([key,value])=>{
    const name=value?.name||key;
    const stable=value?.id||stableIdentityKey(name);
    if(!stable)return;
    out[stable]={...value,id:value?.id||stable,name:value?.name||name};
  });
  return out;
}
function serializeMovieIdentities(movie){
  const copy={...movie};
  ["suggestedBy","addedBy"].forEach(field=>{
    const idField=field+"Id";
    let identityId=copy[idField]||null;
    if(!identityId&&copy[field])identityId=stableIdentityKey(copy[field]);
    if(identityId){
      copy[idField]=identityId;
      // Keep the legacy field populated with the stable account ID in storage.
      copy[field]=identityId;
    }
  });
  if(copy.voterResponses&&typeof copy.voterResponses==="object"){
    const responses={};
    Object.entries(copy.voterResponses).forEach(([name,answer])=>{
      const key=stableIdentityKey(name);
      if(key)responses[key]=answer;
    });
    copy.voterResponses=responses;
  }
  if(Array.isArray(copy.voters))copy.voters=copy.voters.map(v=>Array.isArray(v)?[stableIdentityKey(v[0]),v[1]]:v);
  if(Array.isArray(copy.watchedBy))copy.watchedBy=copy.watchedBy.map(name=>stableIdentityKey(name));
  delete copy.seen;
  return copy;
}
function deserializeMovieIdentities(movie,profiles={},votes={}){
  const copy={...movie};
  ["suggestedBy","addedBy"].forEach(field=>{
    const idField=field+"Id";
    let identityId=copy[idField]||null;
    if(!identityId&&copy[field]&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(copy[field]))){
      identityId=String(copy[field]);
    }
    if(!identityId&&copy[field])identityId=stableIdentityKey(copy[field]);
    if(identityId){
      copy[idField]=identityId;
      copy[field]=identityDisplayName(identityId,profiles,votes);
    }
  });
  if(copy.voterResponses&&typeof copy.voterResponses==="object"){
    const responses={};
    Object.entries(copy.voterResponses).forEach(([key,answer])=>{
      responses[identityDisplayName(key,profiles,votes)]=answer;
    });
    copy.voterResponses=responses;
  }
  if(Array.isArray(copy.voters))copy.voters=copy.voters.map(v=>Array.isArray(v)?[identityDisplayName(v[0],profiles,votes),v[1]]:v);
  if(Array.isArray(copy.watchedBy))copy.watchedBy=copy.watchedBy.map(key=>identityDisplayName(key,profiles,votes));
  return copy;
}
function serializeReviews(reviews={}){
  const out={};
  Object.entries(reviews||{}).forEach(([movieId,reviewers])=>{
    if(!reviewers||typeof reviewers!=="object"){out[movieId]=reviewers;return}
    out[movieId]={};
    Object.entries(reviewers).forEach(([name,review])=>{out[movieId][stableIdentityKey(name)]=review});
  });
  return out;
}
function deserializeReviews(reviews={},profiles={},votes={}){
  const out={};
  Object.entries(reviews||{}).forEach(([movieId,reviewers])=>{
    if(!reviewers||typeof reviewers!=="object"){out[movieId]=reviewers;return}
    out[movieId]={};
    Object.entries(reviewers).forEach(([key,review])=>{out[movieId][identityDisplayName(key,profiles,votes)]=review});
  });
  return out;
}
function serializeAttendance(attendance={}){
  const out={};
  Object.entries(attendance||{}).forEach(([movieId,names])=>{
    out[movieId]=Array.isArray(names)?names.map(stableIdentityKey):names;
  });
  return out;
}
function deserializeAttendance(attendance={},profiles={},votes={}){
  const out={};
  Object.entries(attendance||{}).forEach(([movieId,names])=>{
    out[movieId]=Array.isArray(names)?names.map(key=>identityDisplayName(key,profiles,votes)):names;
  });
  return out;
}
function currentAvatar(){return currentProfile?.avatar||""}
function avatarFor(name){return userProfiles[userKey(name)]?.avatar||((name===currentUser)?currentAvatar():"")}
function avatarMarkup(name,extra=""){const url=avatarFor(name);return url?'<img class="avatar '+extra+'" src="'+escapeHtml(url)+'" alt="" referrerpolicy="no-referrer">':'<span class="avatar '+extra+'" aria-hidden="true">'+escapeHtml(String(name||"?").slice(0,2).toUpperCase())+'</span>'}
window.watchlistAuthIdentityChanged=function(profile){
  currentProfile=profile||null;
  currentUser=profile?.name||"Guest";
  window.WATCHLIST_CURRENT_USER=currentUser;
  window.WATCHLIST_AUTHENTICATED=!!profile;
  if(!serverUsers.includes(currentUser)&&currentUser!=="Guest")serverUsers.push(currentUser);
  if(currentUser!=="Guest"){userProfiles[userKey(currentUser)]={id:currentProfile?.id||null,name:currentUser,avatar:currentProfile?.avatar||""};try{localStorage.setItem("watchlist-user-profiles",JSON.stringify(userProfiles))}catch(error){}}
  if(currentUser!=="Guest"){activeServer=null;loadUserSettings().then(()=>loadServerContext()).catch(error=>console.warn("Could not load user settings:",error.message||error));}
  state.votes=currentUser==="Guest"?{}:(votesByUser[stableIdentityKey(currentUser)]?.votes||votesByUser[userKey(currentUser)]?.votes||{});
  if(typeof render==="function")render();
};
let removedMovieIds=[];try{removedMovieIds=JSON.parse(localStorage.getItem("watchlist-removed-movies")||"[]")}catch(error){removedMovieIds=[]}for(let i=movies.length-1;i>=0;i--){if(removedMovieIds.includes(movies[i].id))movies.splice(i,1)}
let serverUsers=[];
const displaySettingKeys=["showSynopsis","showRatings","showNote","showTrailer","showCast","showStreamingLinks"];
const defaultUserSettings={showSynopsis:true,showRatings:true,showNote:true,showTrailer:true,showCast:true,showStreamingLinks:true,contentWarningsEnabled:true,warningCategories:[],view:"list",posterSize:2,activeServer:null};
async function saveUserSettings(){
  if(currentUser==="Guest")return;
  const client=window.WATCHLIST_SUPABASE_CLIENT;if(!client)return;
  const data={showSynopsis:Boolean(state.showSynopsis),showRatings:Boolean(state.showRatings),showNote:Boolean(state.showNote),showTrailer:Boolean(state.showTrailer),showCast:Boolean(state.showCast),showStreamingLinks:Boolean(state.showStreamingLinks),contentWarningsEnabled:Boolean(contentWarningsEnabled),warningCategories:[...savedWarningCategories],view:state.view==="grid"?"grid":"list",posterSize:Math.max(1,Math.min(4,Math.round(Number(state.posterSize)||2))),activeServer:activeServer?{guild_id:activeServer.guild_id,guild_name:activeServer.guild_name,guild_icon_url:activeServer.guild_icon_url||null}:null};
  const {error}=await client.from("watchlist_user_settings").upsert({user_id:currentProfile?.id,data,updated_at:new Date().toISOString()});
  if(error)console.warn("Could not save user settings:",error.message||error);
}
async function loadUserSettings(){
  if(currentUser==="Guest")return;
  const client=window.WATCHLIST_SUPABASE_CLIENT;if(!client)return;
  const {data,error}=await client.from("watchlist_user_settings").select("data").eq("user_id",currentProfile?.id).maybeSingle();
  if(error){console.warn("Could not load user settings:",error.message||error);return}
  const saved=(data?.data&&typeof data.data==="object")?data.data:defaultUserSettings;
  displaySettingKeys.forEach(key=>{state[key]=typeof saved[key]==="boolean"?saved[key]:defaultUserSettings[key]});
  contentWarningsEnabled=typeof saved.contentWarningsEnabled==="boolean"?saved.contentWarningsEnabled:true;
  savedWarningCategories=Array.isArray(saved.warningCategories)?saved.warningCategories:[];
  state.view=saved.view==="grid"?"grid":"list";
  state.posterSize=Math.max(1,Math.min(4,Math.round(Number(saved.posterSize)||2)));
  activeServer=saved.activeServer&&saved.activeServer.guild_id?{guild_id:saved.activeServer.guild_id,guild_name:saved.activeServer.guild_name||"",guild_icon_url:saved.activeServer.guild_icon_url||null}:null;
  try{if(activeServer)localStorage.setItem("watchlist-active-server",JSON.stringify(activeServer));else localStorage.removeItem("watchlist-active-server")}catch(error){}
  try{localStorage.setItem("watchlist-warning-categories",JSON.stringify(savedWarningCategories));localStorage.setItem("watchlist-content-warnings-enabled",String(contentWarningsEnabled));localStorage.setItem("watchlist-display-settings",JSON.stringify(Object.fromEntries(displaySettingKeys.map(key=>[key,state[key]]))));}catch(error){}
} const warningGroups=[{name:"Violence & gore",categories:["Violence","Gore","Blood","Torture","Body horror","Dismemberment","Weapons","War"]},{name:"Animals",categories:["Animal death","Animal cruelty","Animal injury","Harm to animals"]},{name:"Sexual content",categories:["Sexual content","Nudity","Sexual assault","Rape","Sexual exploitation"]},{name:"Death & self-harm",categories:["Death","Child death","Suicide","Self-harm","Suicide/self-harm"]},{name:"Other disturbing content",categories:["Drug use","Drug overdose","Child abuse","Disturbing imagery","Medical trauma","Abduction/kidnapping","Psychological distress"]}]; const warningCategories=warningGroups.flatMap(group=>group.categories); let savedWarningCategories=[]; try{savedWarningCategories=JSON.parse(localStorage.getItem("watchlist-warning-categories")||"[]")}catch(error){savedWarningCategories=[]}let contentWarningsEnabled=true;try{const savedContentWarnings=localStorage.getItem("watchlist-content-warnings-enabled");if(savedContentWarnings!==null)contentWarningsEnabled=savedContentWarnings==="true"}catch(error){}let savedDisplaySettings={};try{const parsedDisplaySettings=JSON.parse(localStorage.getItem("watchlist-display-settings")||"{}");displaySettingKeys.forEach(key=>{if(typeof parsedDisplaySettings[key]==="boolean")savedDisplaySettings[key]=parsedDisplaySettings[key]})}catch(error){savedDisplaySettings={}}
function routeFromLocation(){
  const params=new URLSearchParams(window.location.search);
  const movieId=params.get("movie");
  if(movieId)return {nav:"detail",detail:movieId};
  const page=params.get("page");
  return {nav:["watchlist","history","people","settings"].includes(page)?page:"watchlist",detail:null};
}
function routeUrl(nav,detail=null){
  const url=new URL(window.location.href);
  url.search="";
  url.hash="";
  if(nav==="detail"&&detail)url.searchParams.set("movie",String(detail));
  else url.searchParams.set("page",nav);
  return url.pathname+url.search;
}
function applyRoute({replace=false}={}){
  const route=routeFromLocation();
  state.nav=route.nav;
  state.detail=route.detail;
  const target=routeUrl(state.nav,state.detail);
  if(replace||window.location.search!==target.slice(target.indexOf("?")))window.history.replaceState(null,document.title,target);
}
function navigateRoute(nav,detail=null,{replace=false}={}){
  const target=routeUrl(nav,detail);
  if(window.location.pathname+window.location.search!==target){
    if(replace)window.history.replaceState(null,document.title,target);
    else window.history.pushState(null,document.title,target);
  }
  state.nav=nav;
  state.detail=detail;
  render();
}
const state={nav:"watchlist",view:"list",search:"",filter:"all",posterSize:2,showSynopsis:true,showRatings:false,showNote:true,showTrailer:false,showCast:true,showStreamingLinks:true,...savedDisplaySettings,detail:null,detailSections:{cast:true,streaming:true,trailer:true},showFilters:false,genreFilters:[],yearFrom:"",yearTo:"",interestUsers:[],interestLevel:"",seenMode:"seen",seenUsers:[],rewatchStatus:"",watchedWith:"",suggestedBy:"",votes:stateVotesPlaceholder||{},removeMovieId:null,addMovieOpen:false,addMovieQuery:"",addMovieResults:[],addMovieSelection:null,addMovieLoading:false,addMovieError:"",attendanceOpen:false,attendanceMovieId:null,attendanceSelected:[],assetEditorOpen:false,assetMovieId:null,assetLoading:false,assetError:"",assetSections:{frontLogo:true,detailLogo:true,frontImage:true,backStill:true},assetLanguageGroups:{},assetPreviewFlipped:false,noteEditorOpen:false,noteEditorMovieId:null};
const voteWeights={must:3.5,interested:3,watch:1,no:0};
const POSITIVE_INTEREST_RESPONSES=new Set(["must","interested","watch"]);
function positiveInterestCount(m){return Object.values(m.voterResponses||{}).filter(answer=>POSITIVE_INTEREST_RESPONSES.has(String(answer||"").toLowerCase())).length}
function calculateMovieScore(m){
  const responses=Object.values(m.voterResponses||{});
  const responseScore=responses.reduce((sum,answer)=>sum+(voteWeights[String(answer||"").toLowerCase()]||0),0);
  // A small group-size bump rewards movies that attract broad positive interest.
  const responseCountBump=positiveInterestCount(m)*0.25;
  return (Number(baseScores[m.id])||0)+responseScore+responseCountBump;
}
movies.forEach(m=>{
  if(state.votes[m.id])m.score=calculateMovieScore(m);
  const ownerId=m.suggestedById||m.addedById;
  if(ownerId){
    const ownerName=identityDisplayName(ownerId,userProfiles,votesByUser);
    if(ownerName&&ownerName!==ownerId)m.suggestedBy=m.suggestedBy||ownerName;
    if(ownerName&&ownerName!==ownerId)m.addedBy=m.addedBy||ownerName;
  }
  if(!m.suggestedBy&&m.addedBy)m.suggestedBy=m.addedBy;
  if(!m.addedBy&&m.suggestedBy)m.addedBy=m.suggestedBy;
});
window.addEventListener("popstate",()=>{applyRoute();render();window.scrollTo({top:0,behavior:"smooth"});});
const app=document.querySelector("#app");
let savedCaseAssets={};
let assetEditorDirty=false;
try{savedCaseAssets=JSON.parse(localStorage.getItem("watchlist-case-assets")||"{}");}catch(error){savedCaseAssets={}}
// Temporary UI gate: once Discord auth exists, replace this with the authenticated Josh/Discord user ID check.
function canEditCaseAssets(){return !!window.WATCHLIST_AUTHENTICATED&&window.WATCHLIST_AUTH_PROFILE?.canEditArtwork===true}
function caseAssets(m){return savedCaseAssets[m.id]||{}}
function movieLogoPath(m,preferred){
  const a=caseAssets(m);
  return preferred||a.frontLogoPath||m.logoPath||m.tmdbAssets?.logos?.find(x=>x.isoLanguage==='en'||!x.isoLanguage)?.filePath||m.tmdbAssets?.logos?.[0]?.filePath||null;
}
function detailLogoPath(m){
  const a=caseAssets(m);
  return a.detailLogoPath||m.logoPath||m.tmdbAssets?.logos?.find(x=>x.isoLanguage==='en'||!x.isoLanguage)?.filePath||m.tmdbAssets?.logos?.[0]?.filePath||null;
}
let activeServer=null;
try{activeServer=JSON.parse(localStorage.getItem("watchlist-active-server")||"null")}catch(error){activeServer=null}
let globalSeenByUser={};
// Seen state is server-authoritative. Legacy localStorage values are intentionally ignored.
try{localStorage.removeItem("watchlist-global-seen")}catch(error){}

async function loadServerMembers(){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client||!activeServer?.guild_id)return;
  const {data,error}=await client.from("watchlist_server_memberships").select("user_id,guild_id,display_name,avatar_url").eq("guild_id",activeServer.guild_id);
  if(error){console.warn("Could not load server members:",error.message||error);return}
  const uniqueMembers=new Map();(data||[]).forEach(row=>{const prior=uniqueMembers.get(row.user_id);if(!prior||row.display_name===currentUser)uniqueMembers.set(row.user_id,row)});const members=[...uniqueMembers.values()];serverUsers=[...new Set(members.map(row=>row.display_name).filter(Boolean))];if(currentUser!=="Guest"&&!serverUsers.includes(currentUser))serverUsers.unshift(currentUser);members.forEach(row=>{userProfiles[userKey(row.display_name)]={id:row.user_id,name:row.display_name,avatar:row.avatar_url||""}});
}

async function loadGlobalSeen(){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client||currentUser==="Guest")return;
  const {data,error}=await client.from("watchlist_global_seen").select("data").eq("id","seen").maybeSingle();
  if(error){console.warn("Could not load global seen state:",error.message||error);return}
  const rawSeen=data?.data&&typeof data.data==="object"?data.data:{};
  globalSeenByUser={};
  Object.entries(rawSeen).forEach(([key,value])=>{
    if(!value||typeof value!=="object")return;
    // Seen state is keyed only by the authenticated account UUID.
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(key)))return;
    globalSeenByUser[String(key)]=value;
  });
  try{localStorage.removeItem("watchlist-global-seen")}catch(error){}
  movies.forEach(m=>{
    m.seen=Object.keys(globalSeenByUser).filter(user=>globalSeenByUser[user]?.[m.id]).map(user=>identityDisplayName(user,userProfiles,votesByUser));
  });
}
async function persistGlobalSeen(){
  // The row is shared by all users; never overwrite it with a stale client-side snapshot.
  // Individual writes go through the row-locking RPC and are merged server-side.
  await loadGlobalSeen();
}
async function setSeenForAccount(userId,movieId,seen){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client||!userId||!movieId)throw new Error("Missing authenticated client, user, or movie.");
  const {data,error}=await client.rpc("watchlist_set_global_seen",{
    p_movie_id:String(movieId),p_seen:Boolean(seen)
  });
  if(error)throw error;
  return data;
}
async function migrateCurrentUserIdentity(){
  if(currentUser==="Guest"||!currentProfile?.id)return false;
  const newKey=userKey(currentUser), accountId=currentProfile.id, avatar=currentProfile.avatar||"";
  const profileEntries={...userProfiles};
  const aliases=new Set(Object.entries(profileEntries).filter(([key,p])=>key!==newKey&&(p?.id===accountId||(avatar&&p?.avatar===avatar))).map(([key])=>key));
  Object.entries(votesByUser).forEach(([key,entry])=>{if(key!==newKey&&(entry?.id===accountId||(avatar&&entry?.avatar===avatar)))aliases.add(key)});
  const aliasNames=new Set([...aliases].flatMap(key=>[key,profileEntries[key]?.name,votesByUser[key]?.name,key]).filter(Boolean).map(userKey));
  const mergedVotes={...(votesByUser[newKey]?.votes||{})};
  aliases.forEach(key=>Object.assign(mergedVotes,votesByUser[key]?.votes||{}));
  votesByUser[newKey]={...(votesByUser[newKey]||{}),id:accountId,name:currentUser,avatar,votes:mergedVotes};
  aliases.forEach(key=>delete votesByUser[key]);
  const mergedSeen={...(globalSeenByUser[newKey]||{})};
  aliases.forEach(key=>Object.assign(mergedSeen,globalSeenByUser[key]||{}));
  Object.keys(globalSeenByUser).forEach(key=>{if(key!==newKey&&aliasNames.has(userKey(key))){Object.assign(mergedSeen,globalSeenByUser[key]||{});delete globalSeenByUser[key]}});
  globalSeenByUser[newKey]=mergedSeen;
  const canonicalName=name=>aliasNames.has(userKey(name))?currentUser:name;
  movies.forEach(m=>{
    if(m.suggestedBy){
      m.suggestedBy=canonicalName(m.suggestedBy);
      if(userKey(m.suggestedBy)===userKey(currentUser))m.suggestedById=accountId;
    }else if(m.suggestedById===accountId){
      m.suggestedBy=currentUser;
    }
    if(m.addedBy){
      m.addedBy=canonicalName(m.addedBy);
      if(userKey(m.addedBy)===userKey(currentUser))m.addedById=accountId;
    }else if(m.addedById===accountId){
      m.addedBy=currentUser;
    }
    const responseMap=m.voterResponses||{}, combined={};
    Object.entries(responseMap).forEach(([name,answer])=>{const canonical=canonicalName(name);if(canonical===currentUser){if(!combined[canonical]||answer)combined[canonical]=answer}else combined[canonical]=answer});
    Object.assign(combined,mergedVotes[m.id]?{[currentUser]:mergedVotes[m.id]}:{});
    m.voterResponses=combined;
    const voterMap=new Map();(m.voters||[]).forEach(v=>{if(Array.isArray(v)){const name=canonicalName(v[0]);if(!voterMap.has(name)||name===currentUser)voterMap.set(name,[name,v[1]])}});
    Object.entries(combined).forEach(([name,answer])=>voterMap.set(name,[name,({must:"must",interested:"green",watch:"yellow",no:"red"})[answer]||answer]));
    m.voters=[...voterMap.values()];
    if(Array.isArray(m.seen))m.seen=[...new Set(m.seen.map(canonicalName))];
    if(Array.isArray(m.watchedBy))m.watchedBy=[...new Set(m.watchedBy.map(canonicalName))];
  });
  Object.keys(movieReviews).forEach(id=>{const obj=movieReviews[id];if(!obj||typeof obj!=="object")return;const value=obj[newKey]||[...aliases].map(k=>obj[k]).find(Boolean);aliases.forEach(k=>delete obj[k]);Object.keys(obj).forEach(k=>{if(aliasNames.has(userKey(k))){if(!obj[currentUser]&&obj[k])obj[currentUser]=obj[k];delete obj[k]}});if(value)obj[newKey]=value});
  Object.keys(watchedAttendance).forEach(id=>{if(Array.isArray(watchedAttendance[id]))watchedAttendance[id]=[...new Set(watchedAttendance[id].map(canonicalName))]});
  serverUsers=[...new Set(serverUsers.map(canonicalName))];
  Object.keys(userProfiles).forEach(key=>{if(aliases.has(key))delete userProfiles[key]});
  userProfiles[newKey]={...(userProfiles[newKey]||{}),id:accountId,name:currentUser,avatar};
  try{const client=window.WATCHLIST_SUPABASE_CLIENT;if(client)await client.from("watchlist_server_memberships").update({display_name:currentUser,avatar_url:avatar,updated_at:new Date().toISOString()}).eq("user_id",accountId)}catch(error){console.warn("Could not update renamed server membership:",error.message||error)}
  state.votes=mergedVotes;
  try{localStorage.setItem("watchlist-user-profiles",JSON.stringify(userProfiles));localStorage.setItem("watchlist-votes-by-user",JSON.stringify(votesByUser));localStorage.setItem("watchlist-global-seen",JSON.stringify(globalSeenByUser))}catch(error){}
  return aliases.size>0||aliasNames.size>0;
}
async function loadServerContext(){
  if(currentUser==="Guest")return;
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client)return;
  try{
    if(!activeServer){
      const {data}=await client.from("watchlist_connected_servers").select("guild_id,guild_name,guild_icon_url").eq("user_id",currentProfile?.id).maybeSingle();
      if(data){
        activeServer={guild_id:data.guild_id,guild_name:data.guild_name,guild_icon_url:data.guild_icon_url};
        try{localStorage.setItem("watchlist-active-server",JSON.stringify(activeServer))}catch(error){}
      }
    }
    if(activeServer){await loadServerMembers();await loadSharedWatchlist();await loadGlobalSeen();if(await migrateCurrentUserIdentity()){await persistSharedWatchlist();await persistGlobalSeen();}}
    render();
  }catch(error){console.warn("Could not load server context:",error.message||error);render()}
}

let sharedSyncChannel=null;
let sharedSyncApplying=false;
let sharedSyncLoaded=false;
let sharedSyncTimer=null;

function sharedSnapshot(){
  return {
    serverId:activeServer?.guild_id||null,
    serverName:activeServer?.guild_name||"",
    movies: movies.map(serializeMovieIdentities),
    votesByUser: serializeIdentityMap(votesByUser),
    movieReviews: serializeReviews(movieReviews),
    watchedMovies: [...watchedMovies],
    watchedAttendance: serializeAttendance(watchedAttendance),
    removedMovieIds: [...removedMovieIds],
    caseAssets: {...savedCaseAssets},
    userProfiles: serializeIdentityMap(userProfiles)
  };
}
function sharedApply(data){
  if(!data||typeof data!=="object")return;
  sharedSyncApplying=true;
  const incomingProfiles=data.userProfiles&&typeof data.userProfiles==="object"?data.userProfiles:{};
  const incomingVotes=data.votesByUser&&typeof data.votesByUser==="object"?data.votesByUser:{};
  userProfiles=decodeIdentityMap(incomingProfiles);
  votesByUser=decodeIdentityMap(incomingVotes);
  if(Array.isArray(data.movies)){
    movies.splice(0,movies.length,...data.movies.map(m=>{
      const decoded=deserializeMovieIdentities(m,incomingProfiles,incomingVotes);
      return {...decoded,seen:Object.keys(globalSeenByUser).filter(name=>globalSeenByUser[name]?.[decoded.id]),voters:Array.isArray(decoded.voters)?decoded.voters.map(v=>Array.isArray(v)?[...v]:v):[]};
    }));
  }
  movieReviews=deserializeReviews(data.movieReviews&&typeof data.movieReviews==="object"?data.movieReviews:{},incomingProfiles,incomingVotes);
  watchedMovies=Array.isArray(data.watchedMovies)?[...data.watchedMovies]:[];
  watchedAttendance=deserializeAttendance(data.watchedAttendance&&typeof data.watchedAttendance==="object"?data.watchedAttendance:{},incomingProfiles,incomingVotes);
  removedMovieIds=Array.isArray(data.removedMovieIds)?[...data.removedMovieIds]:[];
  savedCaseAssets=data.caseAssets&&typeof data.caseAssets==="object"?data.caseAssets:{};
  // Resolve every stored response to one canonical account name before rendering.
  const canonicalByKey={};const canonicalById={};
  Object.entries(userProfiles).forEach(([key,profile])=>{if(profile?.id){canonicalByKey[key]=profile.name||key;canonicalById[profile.id]=profile.name||key}});
  Object.entries(votesByUser).forEach(([key,entry])=>{if(entry?.id){canonicalByKey[key]=canonicalById[entry.id]||entry.name||key;canonicalById[entry.id]=canonicalByKey[key]}});
  movies.forEach(m=>{
    const source=(m.voterResponses&&typeof m.voterResponses==="object")?m.voterResponses:{}, combined={};
    Object.entries(source).forEach(([name,answer])=>{const key=userKey(name),profile=userProfiles[key],id=profile?.id||votesByUser[key]?.id;const canonical=id?(canonicalById[id]||profile?.name||votesByUser[key]?.name||name):(canonicalByKey[key]||name);if(answer&&(!combined[canonical]||canonical===currentUser))combined[canonical]=answer});
    Object.entries(votesByUser).forEach(([key,entry])=>{const answer=entry?.votes?.[m.id];if(!answer)return;const id=entry?.id||userProfiles[key]?.id;const canonical=id?(canonicalById[id]||entry.name||userProfiles[key]?.name||key):(entry.name||userProfiles[key]?.name||key);combined[canonical]=answer});
    m.voterResponses=combined;m.voters=Object.entries(combined).map(([name,answer])=>[name,({must:"must",interested:"green",watch:"yellow",no:"red"})[answer]||answer]);
    m.score=calculateMovieScore(m);
  });
  savedSeenStatus=Object.fromEntries(movies.map(m=>[m.id,Object.keys(globalSeenByUser).filter(name=>globalSeenByUser[name]?.[m.id])]));
  watchedMovies.forEach(id=>{const m=movies.find(x=>x.id===id);if(m){m.watched=true;m.watchedBy=watchedAttendance[id]||m.watchedBy||[]}});
  // The in-memory identity map is name-keyed for UI compatibility, while
  // persisted records are UUID-keyed. Resolve the active user's votes by the
  // embedded stable ID/name instead of looking up only the current map key.
  const currentAccountId=currentProfile?.id||null;
  const currentVoteEntry=Object.values(votesByUser).find(entry=>{
    if(!entry||typeof entry!=="object")return false;
    if(currentAccountId&&entry.id===currentAccountId)return true;
    return String(entry.name||"").trim().toLowerCase()===String(currentUser||"").trim().toLowerCase();
  });
  state.votes=currentUser==="Guest"?{}:{...(currentVoteEntry?.votes||{})};
  // Keep the group score derived from all canonical responses, not the active user's local vote.
  sharedSyncApplying=false;
  sharedSyncLoaded=true;
  try{
    localStorage.setItem("watchlist-votes-by-user",JSON.stringify(votesByUser));
    localStorage.setItem("watchlist-user-profiles",JSON.stringify(userProfiles));
  }catch(error){}
  render();
}
async function loadSharedWatchlist(){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client||currentUser==="Guest")return;
  try{
    const sharedId=activeServer?.guild_id?"server:"+activeServer.guild_id:"watchlist";
    const {data,error}=await client.from("watchlist_shared_state").select("data").eq("id",sharedId).maybeSingle();
    if(error)throw error;
    if(data?.data){sharedApply(data.data);}
    else{
      let initial={serverId:activeServer?.guild_id||null,serverName:activeServer?.guild_name||"",movies:[],votesByUser:{},movieReviews:{},watchedMovies:[],watchedAttendance:{},removedMovieIds:[],caseAssets:{},userProfiles:{}};
      if(activeServer?.guild_id){
        const {data:existingServers}=await client.from("watchlist_shared_state").select("id").like("id","server:%").limit(1);
        if(!(existingServers||[]).length){
          const {data:legacy}=await client.from("watchlist_shared_state").select("data").eq("id","watchlist").maybeSingle();
          if(legacy?.data)initial=legacy.data;
        }
      }
      await client.from("watchlist_shared_state").upsert({id:sharedId,data:initial,updated_by:currentProfile?.id||null});
      sharedSyncLoaded=true;
    }
    if(sharedSyncChannel)client.removeChannel(sharedSyncChannel);
    sharedSyncChannel=client.channel("watchlist-shared-state-"+(activeServer?.guild_id||"watchlist")).on("postgres_changes",{event:"*",schema:"public",table:"watchlist_shared_state"},payload=>{
      if(payload.new?.data&&!sharedSyncApplying&&payload.new.id===(activeServer?.guild_id?"server:"+activeServer.guild_id:"watchlist"))sharedApply(payload.new.data);
    }).subscribe();
  }catch(error){console.warn("Shared watchlist sync unavailable:",error.message||error)}
}
let sharedSyncSavePromise=Promise.resolve();
async function persistSharedWatchlist(){
  if(sharedSyncApplying||currentUser==="Guest")return;
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client)return;

  // Queue writes instead of debouncing them. A rapid series of vote changes must
  // never leave an older in-flight save able to overwrite the final state.
  const local=sharedSnapshot();
  const sharedId=activeServer?.guild_id?"server:"+activeServer.guild_id:"watchlist";
  sharedSyncSavePromise=sharedSyncSavePromise.then(async()=>{
    try{
      const latest=await client.from("watchlist_shared_state").select("data").eq("id",sharedId).maybeSingle();
      if(latest.error)throw latest.error;
      const remote=latest.data?.data&&typeof latest.data.data==="object"?latest.data.data:{};
      const merged={...remote,...local,
        votesByUser:{...(remote.votesByUser||{}),...(local.votesByUser||{})},
        movieReviews:{...(remote.movieReviews||{}),...(local.movieReviews||{})},
        watchedAttendance:{...(remote.watchedAttendance||{}),...(local.watchedAttendance||{})},
        userProfiles:{...(remote.userProfiles||{}),...(local.userProfiles||{})},
        removedMovieIds:[...new Set([...(remote.removedMovieIds||[]),...(local.removedMovieIds||[])])],
        caseAssets:{...(remote.caseAssets||{}),...(local.caseAssets||{})}
      };
      const {error}=await client.from("watchlist_shared_state").upsert({
        id:sharedId,
        data:merged,
        updated_by:currentProfile?.id||null
      });
      if(error)throw error;
    }catch(error){
      console.warn("Could not save shared watchlist state:",error.message||error);
    }
  }).catch(error=>console.warn("Could not queue shared watchlist state:",error.message||error));
  return sharedSyncSavePromise;
}
function saveCaseAssets(sync=true){try{localStorage.setItem("watchlist-case-assets",JSON.stringify(savedCaseAssets));}catch(error){}if(sync)persistSharedWatchlist();}
function assetDraft(m){
  const a=caseAssets(m);
  const num=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
  return {
    frontLogoPath:movieLogoPath(m)||null,
    frontLogoSize:num(a.frontLogoSize,22),
    frontLogoBottom:num(a.frontLogoBottom,6),
    frontLogoVisible:a.frontLogoVisible!==false,
    detailLogoPath:a.detailLogoPath||m.logoPath||(m.tmdbAssets?.logos?.[0]?.filePath)||null,
    frontImagePath:a.frontImagePath!==undefined?a.frontImagePath:(m.textlessPosterPath||m.posterPath||null),
    frontImageX:num(a.frontImageX,50),
    frontImageY:num(a.frontImageY,50),
    backStillPath:a.backStillPath!==undefined?a.backStillPath:(m.backdropPath||null),
    backStillX:num(a.backStillX,50),
    backStillY:num(a.backStillY,50)
  }
}

function currentVote(id){return state.votes[id]||null}
function voterEntries(m){const byName=new Map();Object.entries(m.voterResponses||{}).forEach(([name,answer])=>{const color=({must:"must",interested:"green",watch:"yellow",no:"red"})[answer]||answer;byName.set(name,[name,color,responseLabel(answer)])});(m.voters||[]).forEach(([name,color])=>{if(!byName.has(name))byName.set(name,[name,color,({green:"Interested",yellow:"I'd Watch",red:"Not Interested",must:"Must Watch"})[color]||"No response"])});const mine=currentVote(m.id);if(mine)byName.set(currentUser,[currentUser,({must:"must",interested:"green",watch:"yellow",no:"red"})[mine],responseLabel(mine)]);return [...byName.values()]}

function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function responseLabel(k){return ({must:"Must Watch",interested:"Interested",watch:"I'd Watch",no:"Not Interested"})[k]||"No response"}
function rankOf(m){const ranked=movies.filter(x=>!x.watched&&!isUpcomingMovie(x)).slice().sort((a,b)=>b.score-a.score);const n=ranked.findIndex(x=>x.id===m.id);return n>=0?n+1:"—"}
function rankSticker(rank,extraClass=""){if(!Number.isFinite(Number(rank))||Number(rank)<1||Number(rank)>5)return "";const n=Number(rank);return `<span class="rank-sticker rank-sticker-${n} ${extraClass}" aria-label="Rank #${n}" style="--sticker-index:${n-1}"><span class="rank-sticker-number">#${n}</span>${n===1?'<span class="rank-sticker-shine" aria-hidden="true"></span>':""}</span>`}
function header(){return `<header class="topbar"><div class="header-prism" aria-hidden="true"><img src="thewatchlist-prism.svg" alt=""></div><button class="brand" onclick="location.href=routeUrl('watchlist');return false" aria-label="Go to Watchlist"><img class="brand-logo" src="thewatchlist-logo.svg" alt="The Watchlist"></button><nav class="nav">${["watchlist","history","people","settings"].map(x=>`<button class="${state.nav===x?"active":""}" onclick="location.href=routeUrl('${x}');return false"><span>${x[0].toUpperCase()+x.slice(1)}</span></button>`).join("")}</nav>${window.watchlistAuthControlMarkup?window.watchlistAuthControlMarkup():""}</header>`}function genreList(){return [...new Set(movies.flatMap(m=>(m.genre||"").split(/\s*[·,/&]\s*/).map(x=>x.trim()).filter(Boolean)))].sort()}
function filterActive(key){const v=state[key];return Array.isArray(v)?v.length>0:Boolean(v)}
function filterChip(label,key){return filterActive(key)?`<button class="filter-clear" title="Clear ${label}" aria-label="Clear ${label}" onclick="clearOneFilter('${key}')">×</button>`:""}
function userOptions(users,selected,placeholder){return `<option value="">${placeholder}</option>${users.map(p=>`<option value="${p}" ${selected===p?"selected":""}>${p===currentUser?p+" (you)":p}</option>`).join("")}`}
function advancedFilterPanel(historyMode=false){
 if(!state.showFilters)return "";
 const genres=genreList(),years=movies.map(m=>Number(m.year)).filter(y=>Number.isFinite(y)&&y>0),minYear=years.length?Math.min(...years):1888,maxYear=years.length?Math.max(...years):new Date().getFullYear();
 const suggesters=[...new Set(movies.map(m=>m.suggestedBy||m.addedBy||(m.note?"Josh":"")).filter(Boolean))].sort();
 const canonicalIdentity=name=>{const key=userKey(name),profile=userProfiles[key],id=profile?.id||votesByUser[key]?.id;if(id){const member=serverUsers.find(n=>userProfiles[userKey(n)]?.id===id);if(member)return member;const known=Object.values(userProfiles).find(p=>p?.id===id&&p.name);if(known?.name)return known.name}const avatar=profile?.avatar||votesByUser[key]?.avatar;if(avatar){const match=serverUsers.find(n=>n!==name&&(userProfiles[userKey(n)]?.avatar===avatar||votesByUser[userKey(n)]?.avatar===avatar));if(match)return match;if(currentProfile?.avatar===avatar)return currentUser}return name};
 const seenUsers=[...new Set([...movies.flatMap(m=>m.seen||[]),...serverUsers].map(canonicalIdentity))].filter(Boolean).sort((a,b)=>a===currentUser?-1:b===currentUser?1:a.localeCompare(b));
 const selected=state.genreFilters||[];
 const yearFromValue=Number(state.yearFrom)||minYear,yearToValue=Number(state.yearTo)||maxYear,yearFromPct=(yearFromValue-minYear)/(maxYear-minYear||1)*100,yearToPct=(yearToValue-minYear)/(maxYear-minYear||1)*100,yearTrack=`linear-gradient(to right,#555b65 0%,#555b65 ${yearFromPct}%,#aeb4be ${yearFromPct}%,#aeb4be ${yearToPct}%,#555b65 ${yearToPct}%,#555b65 100%)`;
 const interestOptions=[["any","Any interest"],["must","Must watch"],["interested","Interested"],["watch","I'd watch"],["no","Not interested"],["none","No answer"]];
 const multi=(items,arr,handler)=>items.map(p=>`<label class="filter-choice ${handler==="toggleInterestUser"||handler==="toggleSeenUser"?"filter-user-choice":""}"><input type="checkbox" value="${p}" ${arr.includes(p)?"checked":""} onchange="${handler}(this.value,this.checked)"><span>${p===currentUser?p+" (you)":p}</span></label>`).join("");
 return `<div class="filter-panel">
 <button class="filter-all filter-option-button" onclick="closeFilterDropdowns();clearAllFilters()">All movies</button>
 <div class="filter-control"><details class="filter-dropdown" data-filter-id="genre"><summary>Genre(s) ${selected.length?`<span class="filter-count">${selected.length}</span>`:""}</summary><div class="filter-menu"><div class="filter-options">${multi(genres,selected,"toggleGenre")}</div></div></details>${filterChip("Genre(s)","genreFilters")}</div>
 <div class="filter-control"><details class="filter-dropdown" data-filter-id="year"><summary>Release year (range)</summary><div class="filter-menu year-range-menu"><div class="year-range-values"><span>From: <b id="year-from-label">${state.yearFrom||minYear}</b></span><span>To: <b id="year-to-label">${state.yearTo||maxYear}</b></span></div><div class="dual-range" style="--range-fill:${yearTrack}"><input aria-label="From year" type="range" min="${minYear}" max="${maxYear}" step="1" value="${state.yearFrom||minYear}" oninput="previewYearRange('from',this)" onchange="setYear('from',this.value)"><input aria-label="To year" type="range" min="${minYear}" max="${maxYear}" step="1" value="${state.yearTo||maxYear}" oninput="previewYearRange('to',this)" onchange="setYear('to',this.value)"></div><small>Available years: ${minYear}–${maxYear}</small></div></details>${filterActive("yearFrom")||filterActive("yearTo")?'<button class="filter-clear" title="Clear release year range" aria-label="Clear release year range" onclick="clearOneFilter(\'yearFrom\')">×</button>':""}</div>
 <div class="filter-control"><details class="filter-dropdown" data-filter-id="suggested"><summary>Suggested by</summary><div class="filter-menu"><select class="filter-select" onchange="setSuggestedBy(this.value)">${userOptions(suggesters,state.suggestedBy,"Any user")}</select></div></details>${filterChip("Suggested by","suggestedBy")}</div>
 ${historyMode?"":`<div class="filter-control"><details class="filter-dropdown" data-filter-id="interest"><summary>Interest level</summary><div class="filter-menu"><div class="filter-two-col"><label>User(s)<details class="filter-dropdown filter-nested" data-filter-id="interest-users"><summary>${state.interestUsers.length?state.interestUsers.length+" selected":"Choose users"}</summary><div class="filter-options">${multi(serverUsers,state.interestUsers,"toggleInterestUser")}</div></details></label><label>Interest<select onchange="setInterestLevel(this.value)"><option value="">Choose level</option>${interestOptions.map(([v,l])=>`<option value="${v}" ${state.interestLevel===v?"selected":""}>${l}</option>`).join("")}</select></label></div></div></details>${filterActive("interestUsers")||filterActive("interestLevel")?'<button class="filter-clear" title="Clear interest filters" aria-label="Clear interest filters" onclick="clearOneFilter(\'interestUsers\')">×</button>':""}</div>
 `}<div class="filter-control"><details class="filter-dropdown" data-filter-id="seen"><summary>Seen by</summary><div class="filter-menu"><div class="filter-two-col seen-filter-fields"><label>Seen status<select onchange="setSeenMode(this.value)"><option value="seen" ${state.seenMode==="seen"?"selected":""}>Seen by</option><option value="not" ${state.seenMode==="not"?"selected":""}>Not seen by</option></select></label><label>User(s)<details class="filter-dropdown filter-nested" data-filter-id="seen-users"><summary>${state.seenUsers.length?state.seenUsers.length+" selected":"Choose users"}</summary><div class="filter-options">${multi(seenUsers,state.seenUsers,"toggleSeenUser")}</div></details></label></div></div></details>${filterActive("seenUsers")||state.seenMode==="not"?'<button class="filter-clear" title="Clear seen filters" aria-label="Clear seen filters" onclick="clearOneFilter(\'seenUsers\')">×</button>':""}</div>
 ${historyMode?"":`<div class="filter-control"><details class="filter-dropdown" data-filter-id="rewatch"><summary>Set for rewatch</summary><div class="filter-menu"><select class="filter-select rewatch-select" aria-label="Set for rewatch" onchange="setRewatchStatus(this.value)"><option value="" ${!state.rewatchStatus?"selected":""}>Choose status</option><option value="yes" ${state.rewatchStatus==="yes"?"selected":""}>Yes</option><option value="no" ${state.rewatchStatus==="no"?"selected":""}>No</option></select></div></details>${filterChip("Set to rewatch","rewatchStatus")}</div>`}
 </div>`
}

function toolbar(historyMode=false){return `<div class="toolbar"><input id="search" class="search" placeholder="Search movies..." value="${state.search}"><button class="icon ${state.view==="list"?"active":""}" onclick="setView('list')"><svg class="toolbar-icon-svg list-icon-svg" viewBox="0 0 18 18" aria-hidden="true"><circle cx="3" cy="4" r="1.15"></circle><circle cx="3" cy="9" r="1.15"></circle><circle cx="3" cy="14" r="1.15"></circle><path d="M7 4h9M7 9h9M7 14h9"></path></svg><span>List</span></button><button class="icon ${state.view==="grid"?"active":""}" onclick="setView('grid')"><svg class="toolbar-icon-svg" viewBox="0 0 18 18" aria-hidden="true">${Array.from({length:9},(_,i)=>`<rect x="${(i%3)*6+1}" y="${Math.floor(i/3)*6+1}" width="4" height="4" rx=".7"></rect>`).join("")}</svg><span>Grid</span></button><button class="ghost filter-button ${state.showFilters?"active":""}" aria-pressed="${state.showFilters}" onclick="toggleFilters()"><svg class="filter-icon-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 4.5h15L12 10.5v4.1l-3.9 1.9v-6Z"></path></svg><span>Filters</span></button>${state.view==="grid"?`<input class="range" id="sizeRange" type="range" min="1" max="4" step="1" value="${state.posterSize}" aria-label="Poster size">`:""}</div>${advancedFilterPanel(historyMode)}`}
function stack(v){return `<div class="stack">${v.map(([n,c,label])=>{const tip=`${n}${label?" · "+label:""}`,url=avatarFor(n);return `<div class="ring ${c}" title="${escapeHtml(tip)}" aria-label="${escapeHtml(tip)}">${url?`<img src="${escapeHtml(url)}" alt="" referrerpolicy="no-referrer">`:escapeHtml(n.slice(0,2).toUpperCase())}</div>`}).join("")}</div>`}
function seenButton(m,compact=false){const seen=m.seen.includes(currentUser);return `<button class="seen-button ${seen?"on":"off"} ${compact?"seen-button-compact":""}" data-movie-id="${m.id}" onclick="event.stopPropagation();toggleSeen(this.dataset.movieId)" aria-label="${seen?"Mark as not seen":"Mark as seen"}"><span class="seen-icon" aria-hidden="true"></span><span>${seen?"Seen":"Not seen"}</span></button>`}
function responseButtons(m,compact=false){const mine=currentVote(m.id);return `<div class="quick-votes ${compact?"compact":""}" onclick="event.stopPropagation()">${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([k,l])=>`<button class="quick-vote quick-${k} ${mine===k?"selected":""}" onclick="vote('${m.id}','${k}')" title="${l}" aria-label="${l}">${compact?({must:"Must Watch",interested:"Interested",watch:"I'd Watch",no:"Not Interested"}[k]):l}</button>`).join("")}</div>`}

function listView(items,historyMode=false,showRank=true){const globalRanks=new Map(movies.filter(x=>!x.watched&&!isUpcomingMovie(x)).slice().sort((a,b)=>b.score-a.score).map((m,i)=>[m.id,i+1]));return `<div class="list">${items.map((m,i)=>{const mine=currentVote(m.id),rank=globalRanks.get(m.id)||"—";return `<article class="row ${mine==="no"?"not-interested-row":""} ${historyMode?"history-row":""}" data-movie-id="${m.id}">${historyMode?"":`<div class="rank">${showRank?(rank<=5?rankSticker(rank,"list-rank-sticker"):`#${rank}`):""}</div>`}<div class="list-vhs" aria-hidden="true"><div class="vhs-stage">${caseFaces(m,"","list-vhs-inner")}</div></div><div onclick="openMovie('${m.id}')" style="cursor:pointer"><div class="title">${m.title}</div><div class="meta">${m.year} · ${m.genre} · ${m.director}</div>${historyMode?"":responseButtons(m,true)}</div><div>${historyMode?stack((m.watchedBy||[]).map(n=>[n,"watched","Watched"])):stack(voterEntries(m))}</div>${seenButton(m)}</article>`}).join("")}</div>`}

function caseFaces(m, backHtml, extraClass="",showRank=true){
  const assets=caseAssets(m);
  const poster=m.posterPath&&window.TMDB?TMDB.image(m.posterPath,"w500"):fallback(m.title,m.year);
  const defaultPoster=m.textlessPosterPath&&window.TMDB?TMDB.image(m.textlessPosterPath,"w500"):poster;
  const frontPath=assets.frontImagePath||m.textlessPosterPath||m.posterPath||null;
  const frontImage=frontPath&&window.TMDB?TMDB.image(frontPath,"w500"):defaultPoster;
  const backPath=assets.backStillPath||m.backdropPath||m.posterPath||null;
  const backdrop=backPath&&window.TMDB?TMDB.image(backPath,"w780"):poster;
  const logoPath=movieLogoPath(m,assets.frontLogoPath);
  const logo=logoPath&&window.TMDB?TMDB.image(logoPath,"w300"):"";
  const logoMarkup=logo?`<img class="vhs-logo" src="${logo}" alt="" aria-hidden="true">`:`<div class="vhs-logo-fallback">${m.title}</div>`;
  const frontLogo=`<div class="vhs-front-logo${assets.frontLogoVisible===false?" asset-logo-hidden":""}" style="--front-logo-size:${Number.isFinite(Number(assets.frontLogoSize))?Number(assets.frontLogoSize):22}%;--front-logo-bottom:${Number.isFinite(Number(assets.frontLogoBottom))?Number(assets.frontLogoBottom):6}%;--front-logo-image:url("${logo}")" aria-hidden="true">${logoMarkup}</div>`;
  const spineMarkup=logo?`<img class="vhs-spine-logo" src="${logo}" alt="" aria-hidden="true">`:`<span class="spine-label">${m.title}</span>`;
  const style=`--poster-art:url("${frontImage}");--backdrop-art:url("${backdrop}")`;
  const objectPosition=`object-position:${Number.isFinite(Number(assets.frontImageX))?100-Number(assets.frontImageX):50}% ${Number.isFinite(Number(assets.frontImageY))?Number(assets.frontImageY):50}%`;
  return `<div class="vhs-inner ${extraClass}" style="${style}">
    <div class="vhs-front">${m.watched||!showRank?"":rankSticker(rankOf(m))}<img src="${frontImage}" alt="${m.title}" style="${objectPosition}">${frontLogo}</div>
    <div class="vhs-back"><img class="vhs-back-art" src="${backdrop}" alt="" aria-hidden="true" style="object-position:${Number.isFinite(Number(assets.backStillX))?100-Number(assets.backStillX):50}% ${Number.isFinite(Number(assets.backStillY))?Number(assets.backStillY):50}%"><div class="vhs-back-scroll">${logo&&window.TMDB?`<div class="vhs-back-logo">${logoMarkup}</div>`:""}${backHtml}</div></div>
    <div class="vhs-side vhs-right">${spineMarkup}</div>
    <div class="vhs-side vhs-left">${spineMarkup}</div><div class="vhs-side vhs-top"></div><div class="vhs-side vhs-bottom"></div>
  </div>`;
}
function externalRatings(m){
  const rt=m.rottenTomatoesRating??m.rottenTomatoesScore??m.rtScore??m.rottenTomatoes;
  const imdb=m.imdbRating??m.imdbScore;
  const parts=[];
  if(rt!==undefined&&rt!==null&&rt!==""&&rt!=="N/A")parts.push(`<strong>Rotten Tomatoes</strong> ${String(rt).endsWith("%")?"":""}${rt}${String(rt).endsWith("%")?"":"%"}`);
  if(imdb!==undefined&&imdb!==null&&imdb!==""&&imdb!=="N/A")parts.push(`<strong>IMDb</strong> ${imdb}/10`);
  return parts.length?`<div class="external-ratings">${parts.map(x=>`<span class="pill">${x}</span>`).join("")}</div>`:"";
}
function backContent(m){
  const genres=Array.isArray(m.genre)?m.genre.filter(Boolean):String(m.genre||"").split(/\\s*[·,]\s*/).filter(Boolean);
  const directors=Array.isArray(m.director)?m.director.filter(Boolean):String(m.director||"").split(/\\s*,\s*/).filter(Boolean);
  const yearRated=[m.year,m.rating?`Rated ${escapeHtml(m.rating)}`:""].filter(Boolean).join(" · ");
  const directorRuntime=[directors.join(", "),m.runtime].filter(Boolean).join(" · ");
  const rt=m.rottenTomatoesRating??m.rottenTomatoesScore??m.rtScore??m.rottenTomatoes;
  const imdb=m.imdbRating??m.imdbScore;
  const scores=state.showRatings?`
    ${rt&&rt!=="N/A"?`<div class="back-score"><strong>RT</strong> ${escapeHtml(String(rt).endsWith("%")?rt:rt+"%")}</div>`:""}
    ${imdb&&imdb!=="N/A"?`<div class="back-score"><strong>IMDb</strong> ${escapeHtml(imdb)}/10</div>`:""}
  `:"";
  const warnings=contentWarningsEnabled?dedupeWarnings(m.warnings).filter(w=>savedWarningCategories.includes(String(w).toLowerCase())).map(w=>`<span class="detail-warning-badge">⚠ ${escapeHtml(w)}</span>`).join(""):"";
  return `
    ${yearRated?`<div class="meta back-year-rated">${yearRated}</div>`:""}
    ${genres.length?`<div class="meta back-genres">${genres.map(escapeHtml).join(" · ")}</div>`:""}
    ${directorRuntime?`<div class="meta back-director-runtime">${escapeHtml(directorRuntime)}</div>`:""}
    ${state.showSynopsis&&m.synopsis?`<p class="back-synopsis">${escapeHtml(m.synopsis)}</p>`:""}
    ${scores}
    ${warnings?`<div class="back-warnings">${warnings}</div>`:""}
  `;
}
function caseArticle(m,extra="",showRank=true){const notInterested=currentVote(m.id)==="no";return `<article class="vhs ${extra} ${notInterested?"not-interested-card":""}" data-vhs="${m.id}" data-movie-id="${m.id}"><div class="vhs-stage" onclick="toggleCase(event,this.parentElement)">${caseFaces(m,backContent(m),showRank)}</div><div class="grid-title-line"><div class="grid-title" data-open-movie="${m.id}" onclick="event.stopPropagation();openMovie(this.dataset.openMovie)">${m.title}</div>${seenButton(m,true)}</div><div class="grid-meta" data-open-movie="${m.id}" onclick="event.stopPropagation();openMovie(this.dataset.openMovie)">${m.year} · ${m.genre}</div>${responseButtons(m,true)}</article>`}
function gridView(items,historyMode=false,showRank=true){return `<div class="grid" style="--grid-cols:${[12,8,6,5][state.posterSize-1]||8}">${items.map(m=>caseArticle(m,historyMode?"history-movie":"",showRank)).join("")}</div>`}
function applyAdvancedFilters(items,historyMode=false){
 let a=items.slice();
 const genres=state.genreFilters||[];
 if(genres.length)a=a.filter(m=>genres.every(g=>(m.genre||"").split(/\s*[·,/&]\s*/).map(x=>x.trim()).includes(g)));
 if(state.yearFrom)a=a.filter(m=>Number(m.year)>=Number(state.yearFrom));
 if(state.yearTo)a=a.filter(m=>Number(m.year)<=Number(state.yearTo));
 if(!historyMode&&state.interestUsers?.length&&state.interestLevel)a=a.filter(m=>state.interestUsers.every(p=>{
   const answer=personVote(m,p);
   if(state.interestLevel==="any")return ["must","interested","watch"].includes(answer);
   if(state.interestLevel==="none")return answer===null;
   return answer===state.interestLevel;
 }));
 if(state.seenUsers?.length)a=a.filter(m=>{const seen=state.seenUsers.map(p=>(m.seen||[]).includes(p));return state.seenMode==="not"?seen.every(v=>!v):seen.every(Boolean)});
 if(!historyMode&&state.rewatchStatus)a=a.filter(m=>Boolean(m.setToRewatch)=== (state.rewatchStatus==="yes"));
 if(state.suggestedBy)a=a.filter(m=>(m.suggestedBy||m.addedBy||(m.note?"Josh":""))===state.suggestedBy);
 return a;
}

function isUpcomingMovie(m){
  const now=new Date();
  const releaseDate=m.releaseDate?new Date(m.releaseDate):null;
  if(!releaseDate||Number.isNaN(releaseDate.getTime()))return !Number(m.year)||!Number.isFinite(Number(m.year))||Number(m.year)>now.getFullYear();
  if(releaseDate>now)return true;
  const digitalDate=m.tmdbDigitalReleaseDate?new Date(m.tmdbDigitalReleaseDate):null;
  const physicalDate=m.tmdbPhysicalReleaseDate?new Date(m.tmdbPhysicalReleaseDate):null;
  const hasReleasedPostTheatricalDate=[digitalDate,physicalDate].some(date=>date&&!Number.isNaN(date.getTime())&&date<=now);
  const hasFuturePostTheatricalDate=[digitalDate,physicalDate].some(date=>date&&!Number.isNaN(date.getTime())&&date>now);
  const hasStreamingAvailability=Array.isArray(m.tmdbStreaming)&&m.tmdbStreaming.some(provider=>["flatrate","free","ads","rent","buy"].includes(provider.type));
  if(hasReleasedPostTheatricalDate||hasStreamingAvailability)return false;
  if(hasFuturePostTheatricalDate)return true;
  // A theatrically released movie with no post-theatrical release yet stays in
  // Upcoming until TMDB reports a digital, physical, or streaming release.
  return true;
}
function upcomingSection(items){if(!items.length)return '';return '<section class="upcoming-section"><h2 class="upcoming-heading">Upcoming releases</h2>'+(state.view==='list'?listView(items,false,false):gridView(items,false,false))+'</section>'}
function watchlist(){
 const base=movies.filter(m=>!m.watched&&((m.title+' '+m.genre).toLowerCase().includes(state.search.toLowerCase())));
 const a=applyAdvancedFilters(base);const released=a.filter(m=>!isUpcomingMovie(m)).sort((x,y)=>(Number(y.score)||0)-(Number(x.score)||0));const upcoming=a.filter(isUpcomingMovie).sort((x,y)=>(Number(y.score)||0)-(Number(x.score)||0)||(new Date(x.releaseDate||"9999-12-31")-new Date(y.releaseDate||"9999-12-31"))||x.title.localeCompare(y.title));
 const count=a.length;const hasFilters=(state.genreFilters||[]).length>0||Boolean(state.yearFrom||state.yearTo||state.suggestedBy)||(state.interestUsers||[]).length>0||Boolean(state.interestLevel)||(state.seenUsers||[]).length>0||state.seenMode==='not'||Boolean(state.rewatchStatus);
 const countText=hasFilters&&count!==base.length?count+' movies narrowed down from '+base.length+' with filters.':count+' movies waiting for a movie night.';
 const mainContent=(released.length?(state.view==='list'?listView(released,false,true):gridView(released,false,true)):'')+upcomingSection(upcoming);
 return '<div class="hero"><div><div class="eyebrow">'+escapeHtml((activeServer?.guild_name||"YOUR SERVER").toUpperCase())+'\'S MOVIE LIBRARY</div><h1>Watchlist</h1><p class="sub">'+countText+'</p></div><button class="primary" onclick="openAddMovie()">＋ Add movie</button></div>'+toolbar()+(count?mainContent:'<div class="empty">Nothing matches those filters.</div>');
}
function history(){let a=movies.filter(m=>m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));a=applyAdvancedFilters(a,true);return `<div class="hero"><div><div class="eyebrow">THE GROUP ARCHIVE</div><h1>History</h1><p class="sub">Movies watched by this server.</p></div></div>${toolbar(true)}${a.length?(state.view==="list"?listView(a,true):gridView(a,true)):`<div class="empty">Nothing matches your filters.</div>`}`}
function personVote(m,p){
  // Resolve each person's exact response first; legacy color-only voter entries
  // are normalized below so every person uses the same interest/seen rules.
  const local=p===currentUser?currentVote(m.id):null;
  const recorded=(m.voterResponses||m.responses||{})[p]||(votesByUser[stableIdentityKey(p)]?.votes?.[m.id]||votesByUser[userKey(p)]?.votes?.[m.id])||null;
  const legacy=(m.voters||[]).find(([name])=>name===p)?.[1]||null;
  const raw=local||recorded||legacy;
  if(!raw)return null;
  return ({green:"interested",yellow:"watch",red:"no",must:"must",interested:"interested",watch:"watch",no:"no"})[String(raw).toLowerCase()]||null;
}
function personVoteColor(v){return ({must:"green",interested:"green",watch:"yellow",no:"red"})[v]||""}
function people(){const peopleList=[...new Set(serverUsers.filter(p=>p&&p!=="Guest"))].sort((a,b)=>a===currentUser?-1:b===currentUser?1:a.localeCompare(b));return `<div class="hero"><div><div class="eyebrow">THE SERVER</div><h1>People</h1><p class="sub">Reviews, watch history, and what everyone wants to see.</p></div></div><div class="settings">${peopleList.map(p=>`<div class="setting person-card" data-person="${escapeHtml(p)}" onclick="togglePerson('${escapeHtml(p)}')" style="cursor:pointer"><div style="display:flex;gap:13px;align-items:center">${avatarMarkup(p)}<div><strong>${escapeHtml(p)}</strong></div></div></div>`).join("")}</div>`}
window.setWarningGroup=(groupName,checked)=>{const group=warningGroups.find(g=>g.name===groupName);if(!group)return;const keys=new Set(group.categories.map(x=>x.toLowerCase()));savedWarningCategories=checked?[...new Set([...savedWarningCategories,...keys])]:savedWarningCategories.filter(x=>!keys.has(x));try{localStorage.setItem("watchlist-warning-categories",JSON.stringify(savedWarningCategories))}catch(error){}saveUserSettings();document.querySelectorAll(".warning-category-option").forEach(label=>{const name=label.querySelector("span")?.textContent?.trim().toLowerCase();if(name&&keys.has(name)){const input=label.querySelector("input");if(input)input.checked=checked}});document.querySelectorAll(".warning-picker-count").forEach(el=>el.textContent=savedWarningCategories.length+" selected")};
let discordGuildCache=null;
let discordGuildCachePromise=null;
async function getDiscordGuildsCached(){
  if(discordGuildCache)return discordGuildCache;
  if(discordGuildCachePromise)return discordGuildCachePromise;
  try{const cached=JSON.parse(sessionStorage.getItem("watchlist-discord-guilds-cache")||"null");if(cached&&Array.isArray(cached.guilds)&&Date.now()-cached.savedAt<30*60*1000){discordGuildCache=cached.guilds;return discordGuildCache}}catch(error){}
  discordGuildCachePromise=window.WATCHLIST_FETCH_DISCORD_GUILDS().then(guilds=>{discordGuildCache=guilds||[];try{sessionStorage.setItem("watchlist-discord-guilds-cache",JSON.stringify({savedAt:Date.now(),guilds:discordGuildCache}))}catch(error){}return discordGuildCache}).catch(error=>{try{const cached=JSON.parse(sessionStorage.getItem("watchlist-discord-guilds-cache")||"null");if(cached&&Array.isArray(cached.guilds))return discordGuildCache=cached.guilds}catch(cacheError){}throw error}).finally(()=>{discordGuildCachePromise=null});
  return discordGuildCachePromise;
}
async function loadConnectedDiscordServer(){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  const uid=window.WATCHLIST_AUTH_PROFILE?.id;
  if(!client||!uid)return null;
  const {data,error}=await client.from("watchlist_connected_servers").select("guild_id,guild_name,guild_icon_url").eq("user_id",uid).maybeSingle();
  if(error){console.warn("Could not load connected Discord server:",error.message||error);return null}
  return data||null;
}
async function connectDiscordServer(guildId){
  const client=window.WATCHLIST_SUPABASE_CLIENT;
  if(!client||!guildId)return;
  const {data:{user},error:authError}=await client.auth.getUser();
  if(authError||!user)throw new Error("Your Discord session is no longer available. Please sign in again.");
  const uid=user.id;
  const guilds=await getDiscordGuildsCached();
  const guild=guilds.find(x=>x.id===guildId);
  if(!guild)throw new Error("That Discord server is no longer available to this account.");
  const profile=window.WATCHLIST_AUTH_PROFILE||{};
  const iconUrl=guild.icon?("https://cdn.discordapp.com/icons/"+guild.id+"/"+guild.icon+".png?size=64"):null;
  const now=new Date().toISOString();
  const {error:connectError}=await client.rpc("watchlist_connect_server",{target_guild_id:guild.id,target_guild_name:guild.name,target_guild_icon_url:iconUrl,target_display_name:profile.name||currentUser,target_avatar_url:profile.avatar||null});
  if(connectError)throw connectError;
  activeServer={guild_id:guild.id,guild_name:guild.name,guild_icon_url:iconUrl};
  try{localStorage.setItem("watchlist-active-server",JSON.stringify(activeServer))}catch(error){}
  await saveUserSettings();
  await loadServerContext();
}
async function chooseDiscordServer(){
  const picker=document.querySelector("#discord-server-picker");
  if(!picker)return;
  picker.disabled=true;picker.innerHTML='<option>Loading servers…</option>';
  try{
    const guilds=await getDiscordGuildsCached();
    const current=await loadConnectedDiscordServer();
    const selected=activeServer||current;
    picker.innerHTML='<option value="">Select a Discord server…</option>'+guilds.sort((a,b)=>a.name.localeCompare(b.name)).map(g=>'<option value="'+escapeHtml(g.id)+'">'+escapeHtml(g.name)+'</option>').join("");
    if(selected)picker.value=selected.guild_id;
    picker.disabled=false;
  }catch(error){
    picker.innerHTML='<option value="">Could not load servers</option>';picker.disabled=false;
    alert(error.message||"Could not load your Discord servers.");
  }
}
async function onDiscordServerSelected(select){
  if(!select.value)return;
  select.disabled=true;
  try{await connectDiscordServer(select.value)}
  catch(error){alert(error.message||"Could not connect this Discord server.");select.disabled=false}
}

function settings(){let rows=[["Show synopsis","Show movie synopses on cards and details.","showSynopsis"],["Show RT/IMDb scores","Show Rotten Tomatoes and IMDb scores when available.","showRatings"],["Show suggester's note","Show personal notes attached to suggestions on Details screens.","showNote"],["Show cast","Show cast photos and names on movie details.","showCast"],["Show streaming links","Show streaming availability and provider links on movie details.","showStreamingLinks"],["Show trailers","Allow trailers to appear in details.","showTrailer"]];return `<div class="hero"><div><div class="eyebrow">YOUR PREFERENCES</div><h1>Settings</h1><p class="sub">Control how much pre-watch information The Watchlist shows you.</p></div></div><div class="settings">${rows.map(([a,b,k])=>`<div class="setting"><div><strong>${a}</strong><span>${b}</span></div><button class="toggle ${state[k]?"on":""}" onclick="toggleSetting('${k}')" aria-label="Toggle ${a}"></button></div>`).join("")}<div class="setting warning-settings"><div class="warning-settings-header"><div><strong>Content warnings</strong><span>Choose which warning categories you want surfaced.</span></div><button class="toggle ${contentWarningsEnabled?"on":""}" onclick="toggleContentWarnings()" aria-label="Toggle content warnings" aria-pressed="${contentWarningsEnabled}"></button></div><div class="warning-category-controls"><details class="warning-category-picker"><summary>Choose categories <span class="warning-picker-count">${savedWarningCategories.length} selected</span><span class="tmdb-section-chevron warning-picker-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5 10h10"/><path class="warning-chevron-vertical" d="M10 5v10"/></svg></span></summary><div class="warning-category-groups">${warningGroups.map(group=>'<details class="warning-category-group"><summary>'+escapeHtml(group.name)+'<span class="tmdb-section-chevron warning-picker-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="M5 10h10"/><path class="warning-chevron-vertical" d="M10 5v10"/></svg></span></summary><div class="warning-category-options"><div class="warning-group-actions"><button type="button" onclick="setWarningGroup(&quot;'+group.name+'&quot;,true)">Check all</button><button type="button" onclick="setWarningGroup(&quot;'+group.name+'&quot;,false)">Uncheck all</button></div>'+group.categories.map(category=>'<label class="warning-category-option"><input type="checkbox" '+(savedWarningCategories.includes(category.toLowerCase())?'checked':'')+' onchange="toggleWarningCategory(\&quot;'+category+'\&quot;,this.checked)"><span>'+escapeHtml(category)+'</span></label>').join("")+'</div></details>').join("")}<p class="warning-picker-help">Each heading expands to a scrollable list of individual warning categories with toggles.</p></div></details></div></div><div class="setting discord-server-setting"><div><strong>Discord server</strong><span>Connect The Watchlist to a Discord server you belong to.</span></div><div class="discord-server-control"><select id="discord-server-picker" onchange="onDiscordServerSelected(this)"><option value="">Loading…</option></select></div></div></div>`}
window.toggleContentWarnings=()=>{contentWarningsEnabled=!contentWarningsEnabled;try{localStorage.setItem("watchlist-content-warnings-enabled",String(contentWarningsEnabled))}catch(error){}saveUserSettings();render()};
function peopleRatingStars(value){const rating=Math.max(0,Math.min(5,Number(value)||0));let html='<span class="review-stars people-review-stars">';for(let i=0;i<5;i++){const fill=Math.round(Math.max(0,Math.min(1,rating-i))*2)/2;html+='<span class="rating-star"><span class="star-base">★</span><span class="star-fill" style="--people-star-fill:'+(fill*100)+'%;width:'+(fill*100)+'%">★</span></span>'}return html+'</span>'}
function ratingStars(value,interactive=false,inline=false){const rating=Math.max(0,Math.min(5,Number(value)||0));const wrapper=inline?'span':'div';let html='<'+wrapper+' class="review-stars'+(interactive?' interactive':'')+(inline?' review-stars-inline':'')+'">';for(let i=0;i<5;i++){const fill=Math.round(Math.max(0,Math.min(1,rating-i))*2)/2;const pct=fill*100;const tag=interactive?'button':'span';const attrs=interactive?' class="rating-star" onclick="setReviewRating(event,'+i+')"':' class="rating-star"';html+='<'+tag+attrs+'><span class="star-gradient" style="--star-fill:'+pct+'%">★</span></'+tag+'>'}return html+'</'+wrapper+'>'}
function movieReviewsSection(m){if(!m.watched)return "";const reviews=movieReviews[m.id]||{};const mine=reviews[currentUser]||{};let html='<section class="review-section" data-rating="'+(mine.rating||0)+'"><div class="review-heading"><div><div class="eyebrow">AFTER THE WATCH</div><h3>Reviews</h3></div><span class="review-count">'+Object.keys(reviews).length+'</span></div><div class="review-form"><div class="review-form-label">Your rating</div>'+ratingStars(mine.rating||0,true)+'<textarea id="reviewText" class="review-text" rows="3" placeholder="What did you think?">'+(mine.review||"")+'</textarea><div class="review-form-actions"><button class="primary" onclick="saveReview(\''+m.id+'\')">'+(mine.rating||mine.review?"Update review":"Add review")+'</button></div></div>';Object.entries(reviews).forEach(([name,r])=>{html+='<article class="review-card"><div class="review-card-head"><div class="review-author">'+avatarMarkup(name)+'<strong>'+escapeHtml(name)+'</strong></div>'+ratingStars(r.rating||0)+'</div>'+(r.review?'<div class="review-body">'+r.review+'</div>':"")+'</article>'});return html+'</section>'}
function tmdbDetailsSections(m){
  const cast=m.tmdbCast||[],providers=(m.tmdbStreaming||[]).filter(p=>["flatrate","free","ads"].includes(p.type)),trailer=m.tmdbTrailer;
  const collapsible=(key,label,body)=>'<section class="tmdb-detail-section tmdb-section-'+key+'"><button class="tmdb-section-toggle" aria-expanded="'+Boolean(state.detailSections[key])+'" onclick="toggleDetailSection(\''+key+'\')"><span>'+label+'</span><span class="tmdb-section-chevron" aria-hidden="true"><svg viewBox="0 0 20 20" focusable="false"><path d="'+(state.detailSections[key]?"M5 10h10":"M10 5v10 M5 10h10")+'"/></svg></span></button>'+(state.detailSections[key]?'<div class="tmdb-section-body">'+body+'</div>':"")+'</section>';
  let castMarkup="";
  if(state.showCast&&cast.length){
    const cards=cast.map(person=>'<div class="tmdb-cast-card">'+(person.profilePath?'<img src="'+TMDB.image(person.profilePath,"w185")+'" alt="" loading="lazy">':'<div class="tmdb-cast-no-image">No photo</div>')+'<strong>'+escapeHtml(person.name)+'</strong><span>'+escapeHtml(person.character||"")+'</span></div>').join("");
    const castLink=m.tmdbId?"https://www.themoviedb.org/movie/"+encodeURIComponent(m.tmdbId)+"/cast":"";
    const fullCastSlot=castLink?'<a class="tmdb-cast-card tmdb-cast-full-link" href="'+castLink+'" target="_blank" rel="noopener noreferrer" aria-label="See full cast and crew on TMDB"><span class="tmdb-cast-full-link-art"><span>See more</span></span><strong>Full cast &amp; crew</strong><span>View on TMDB ↗</span></a>':"";
    castMarkup=collapsible("cast","Cast",'<div class="tmdb-cast-grid">'+cards+fullCastSlot+'</div>');
  }
  const uniqueProviders=providers.filter((p,i,all)=>all.findIndex(x=>x.id===p.id)===i);
  let streamingMarkup="";
  if(state.showStreamingLinks&&uniqueProviders.length) streamingMarkup=collapsible("streaming","Where to watch"+'<small>'+escapeHtml(m.tmdbStreamingRegion||"US")+'</small>','<div class="tmdb-provider-list">'+uniqueProviders.map(p=>'<a class="tmdb-provider" href="'+escapeHtml(m.tmdbStreamingLink||("https://www.themoviedb.org/movie/"+encodeURIComponent(m.tmdbId||"")+"/watch"))+'" target="_blank" rel="noopener noreferrer" aria-label="Find '+escapeHtml(m.title)+' on '+escapeHtml(p.name)+'"><span class="tmdb-provider-identity">'+(p.logoPath?'<img src="'+TMDB.image(p.logoPath,"w92")+'" alt="">':"")+'<span>'+escapeHtml(p.name)+'</span></span><small>Stream ↗</small></a>').join("")+'</div>');
  const trailerMarkup=state.showTrailer&&trailer&&trailer.site==="YouTube"&&trailer.key?collapsible("trailer","Trailer",'<div class="tmdb-trailer"><iframe src="https://www.youtube-nocookie.com/embed/'+encodeURIComponent(trailer.key)+'" title="'+escapeHtml(m.title)+' trailer" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>'):"";
  return castMarkup+trailerMarkup+streamingMarkup;
}
function detail(){
 let m=movies.find(x=>x.id===state.detail);
 if(!m)return '<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div></div><section class="detail"><p class="muted">Movie not found.</p></section>';
 let selected=currentVote(m.id);
 const detailWarnings=contentWarningsEnabled?dedupeWarnings(m.warnings).filter(w=>savedWarningCategories.includes(String(w).toLowerCase())):[];
 const detailGenres=(Array.isArray(m.genre)?m.genre:String(m.genre||"").split(/\\s*[·,/]\s*/)).map(x=>String(x).trim()).filter(Boolean);
 const detailDirectors=Array.isArray(m.director)?m.director.filter(Boolean):String(m.director||"").split(/\\s*,\s*/).filter(Boolean);
 return `<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div></div>
 <section class="detail ${m.watched?"history-detail":""}">
   <div class="detail-cover-column"><div class="detail-vhs" data-vhs="${m.id}" onclick="toggleCase(event,this)" title="Click the VHS case to flip it"><div class="vhs-stage">${caseFaces(m,backContent(m))}</div></div>${canEditCaseAssets()&&m.tmdbId?`<button class="watched-together-button artwork-button" onclick="openAssetEditor('${m.id}')">✎ Customize case artwork</button>`:""}</div>
   <div>
    <div class="eyebrow" style="${m.watched?"display:none":""}">CURRENT RANK #${rankOf(m)}</div><div class="detail-title-row"><h2>${detailLogoPath(m)&&window.TMDB?'<img class="detail-logo" src="'+TMDB.image(detailLogoPath(m),"w300")+'" alt="'+m.title+'">':'<span>'+m.title+'</span>'}</h2><button class="seen-button detail-seen-button ${m.seen.includes(currentUser)?"on":"off"}" data-movie-id="${m.id}" onclick="toggleSeen(this.dataset.movieId)" aria-label="${m.seen.includes(currentUser)?"Mark as not seen":"Mark as seen"}"><span class="seen-icon" aria-hidden="true"></span><span>${m.seen.includes(currentUser)?"I have seen this":"I have not seen this"}</span></button></div><div class="detail-info-primary">${escapeHtml(m.year)}${m.rating?' · Rated '+escapeHtml(m.rating):""}${detailWarnings.length?detailWarnings.map(w=>'<span class="detail-warning-badge">⚠ '+escapeHtml(w)+'</span>').join(""):""}</div><div class="detail-info-genres">${detailGenres.map(escapeHtml).join(" · ")}</div><div class="detail-info-credits">${detailDirectors.map(escapeHtml).join(", ")}${m.runtime?' · '+escapeHtml(m.runtime):""}</div>${state.showRatings?`<div class="external-ratings" aria-label="External movie ratings">${m.imdbRating?`<span class="external-rating imdb-rating"><strong>IMDb</strong> ${escapeHtml(m.imdbRating)}<small>/10</small></span>`:""}${m.rottenTomatoesRating?`<span class="external-rating rt-rating"><strong>Rotten Tomatoes</strong> ${escapeHtml(m.rottenTomatoesRating)}</span>`:""}${m.ratingsLoading?`<span class="external-ratings-loading">Loading IMDb / Rotten Tomatoes…</span>`:""}${m.ratingsError&&!m.ratingsLoading?`<span class="external-ratings-unavailable">External ratings unavailable</span>`:""}</div>`:""}
    <div class="people-strip"><div class="people-strip-label">${m.watched?"WHO WATCHED":"RESPONSES"}</div>${m.watched?stack((m.watchedBy||[]).map(n=>[n,"watched","Watched"])):stack(voterEntries(m).map(([n,color])=>{const mine=n==="Josh"?currentVote(m.id):null;return [n,color,mine?responseLabel(mine):({green:"Interested",yellow:"I’d Watch",red:"Not Interested",must:"Must Watch"})[color]||"No response"]}))}</div>
    <div class="vote-box"><div class="vote-label">Your response</div><div class="votes">${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([k,l])=>`<button class="vote vote-${k} ${selected===k?"selected":""}" onclick="vote('${m.id}','${k}')">${l}</button>`).join("")}</div></div>
    ${state.showSynopsis?`<section class="detail-synopsis-section"><h3>Synopsis</h3><p class="detail-synopsis">${m.synopsis}</p></section>`:""}
    ${tmdbDetailsSections(m)}
    ${suggestionNoteMarkup(m)}
    ${m.watched?`<div class="history-actions"><button class="watched-together-button" onclick="editWatchedBy(\'${m.id}\')">✎ Edit who watched</button><button class="watched-together-button" onclick="watchAgain(\'${m.id}\')">↻ Watch again</button></div>`:`<div class="detail-movie-actions"><button class="watched-together-button" onclick="markWatchedTogether(\'${m.id}\',false)">✓ Mark watched together</button><button class="remove-movie-button" onclick="openRemoveMovie(\'${m.id}\')">Remove ✕</button></div>`}
    ${movieReviewsSection(m)}
   </div>
 </section>`;
}
function suggestionNoteMarkup(m){
  const ownerId=m.suggestedById||m.addedById;
  const resolved=ownerId?identityDisplayName(ownerId,userProfiles,votesByUser):"";
  const who=resolved&&resolved!==ownerId?resolved:(m.suggestedBy||m.addedBy||"Unknown");
  const editable=ownerId?ownerId===currentProfile?.id:who===currentUser;
  const avatar=avatarFor(who);
  return '<div class="detail-note '+(!m.note?'detail-note-empty':'')+'"><div class="detail-note-label">'+(avatar?'<img class="avatar" src="'+escapeHtml(avatar)+'" alt="" referrerpolicy="no-referrer">':'<span class="avatar">'+escapeHtml(who.slice(0,2).toUpperCase())+'</span>')+'<span>Suggested by '+escapeHtml(who)+'</span></div>'+(state.showNote&&m.note?'<div class="detail-note-text">'+escapeHtml(m.note)+'</div>':"")+(state.showNote&&editable?'<div class="detail-note-actions"><button class="edit-suggestion-note" onclick="editSuggestionNote(\''+m.id+'\')">'+(m.note?"Edit note":"Add note")+'</button></div>':"")+'</div>';
}
function addMovieResults(){if(state.addMovieLoading)return '<div class="add-status">Searching TMDB…</div>';if(state.addMovieError)return `<div class="add-status error">${state.addMovieError}</div>`;if(!state.addMovieQuery)return '<div class="add-status">Search TMDB for a movie, then choose the correct title and year.</div>';if(!state.addMovieResults?.length)return '<div class="add-status">No movies found.</div>';return state.addMovieResults.map(r=>{const poster=r.textlessPosterPath||r.posterPath;const posterMarkup=poster?`<img src="${TMDB.image(poster,"w185")}" alt="">`:"";const logoMarkup=r.logoPath?`<span class="add-result-logo"><img src="${TMDB.image(r.logoPath,"w300")}" alt="" aria-hidden="true"></span>`:"";return `<button class="add-result" onclick="selectAddMovie(${r.tmdbId})"><span class="add-result-poster">${posterMarkup}${logoMarkup}</span><span><strong>${r.title}</strong><small>${r.year||"Year unknown"}</small></span></button>`}).join("")}
function addMovieForm(){const d=state.addMovieSelection;return `<div class="add-selected"><div class="add-selected-poster">${d.posterPath?'<img src="'+TMDB.image(d.posterPath,"w154")+'" alt="">':""}</div><div class="add-selected-info"><div class="eyebrow">SELECTED MOVIE</div><h3>${d.title}</h3><div class="meta">${d.year||"Year unknown"} · ${(d.genre||[]).join(" · ")}</div>${state.addMovieError?'<div class="add-status error">'+state.addMovieError+'</div>':""}<label class="add-label">Your note (optional)<textarea id="addMovieNote" rows="3" placeholder="Why should we watch this?"></textarea></label><div class="add-form-actions"><button class="ghost" onclick="clearAddMovieSelection()">← Choose another</button><button class="primary" onclick="confirmAddMovie()">Add to watchlist</button></div></div></div>`}
function addMovieModal(){return `<div class="modal-backdrop ${state.addMovieOpen?"open":""}" onclick="if(event.target===this)closeAddMovie()"><section class="add-modal" role="dialog" aria-modal="true" aria-labelledby="add-movie-title"><div class="modal-head"><div><div class="eyebrow">TMDB SEARCH</div><h2 id="add-movie-title">Add a movie</h2></div><button class="modal-close" onclick="closeAddMovie()" aria-label="Close">×</button></div>${state.addMovieSelection?addMovieForm():`<div class="add-search-row"><input id="addMovieSearch" class="search" placeholder="Search by movie title..." value="${state.addMovieQuery||""}" onkeydown="if(event.key==='Enter')searchAddMovies()"><button class="primary" onclick="searchAddMovies()">Search</button></div><div id="addMovieResults" class="add-results">${addMovieResults()}</div>`}</section></div>`}
function attendanceModal(){
  if(!state.attendanceOpen)return "";
  const m=movies.find(x=>x.id===state.attendanceMovieId);
  if(!m)return "";
  return `<div class="modal-backdrop open" onclick="if(event.target===this)closeAttendance()"><section class="attendance-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-title"><div class="modal-head"><div><div class="eyebrow">GROUP WATCH</div><h2 id="attendance-title">Who watched?</h2><p class="attendance-sub">Select everyone who watched <strong>${m.title}</strong>.</p></div><button class="modal-close" onclick="closeAttendance()" aria-label="Close">×</button></div><div class="attendance-list">${serverUsers.map(name=>`<button class="attendance-user ${state.attendanceSelected.includes(name)?"selected":""}" onclick="toggleAttendanceUser(event,&quot;${name}&quot;)"><span class="avatar">${name.slice(0,2)}</span><span class="attendance-user-name">${name}</span><span class="attendance-check">${state.attendanceSelected.includes(name)?"✓":""}</span></button>`).join("")}</div><div class="attendance-actions"><button class="ghost" onclick="closeAttendance()">Cancel</button><button class="primary" onclick="confirmAttendance()">Confirm watched</button></div></section></div>`;
}
function assetImage(path,size="w185"){return path&&window.TMDB?TMDB.image(path,size):""}
function assetLanguageLabel(a){return a.isoLanguage||"No language"}
function assetLanguageKey(a){return a.isoLanguage||"none"}
function assetLanguageName(key){return key==="none"?"No language":String(key).toUpperCase()}
function assetCards(items,type,selected){
  if(!items?.length)return '<div class="asset-empty">No TMDB assets found.</div>';
  const groups=new Map();
  items.forEach(a=>{const key=assetLanguageKey(a);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a)});
  return [...groups.entries()].map(([key,group])=>{
    const id="asset-lang-"+type.replace(/[^a-z0-9]/gi,"")+"-"+key.replace(/[^a-z0-9]/gi,"none");
    const open=state.assetLanguageGroups[id]!==false;
    const cards=group.map(a=>{
      const safe=encodeURIComponent(String(a.filePath));
      const sel=selected===a.filePath?" selected":"";
      const size=type==="logo"||type==="detail-logo"?"w300":type==="poster"?"w185":"w300";
      return `<button class="asset-card${sel}" onclick="chooseAsset('${type}','${safe}')" title="${assetLanguageName(key)}"><img src="${assetImage(a.filePath,size)}" alt=""><span>${assetLanguageName(key)}</span></button>`;
    }).join("");
    return `<div class="asset-language-group ${open?"open":""}">
      <button type="button" class="asset-language-heading" onclick="toggleAssetLanguage('${id}',event)" aria-expanded="${open}">
        <strong>${assetLanguageName(key)}</strong><span>${group.length} asset${group.length===1?"":"s"} <b>${open?"−":"+"}</b></span>
      </button>
      ${open?`<div class="asset-language-grid ${type==="logo"||type==="detail-logo"?"logo-assets":type==="poster"?"poster-assets":"backdrop-assets"}">${cards}</div>`:""}
    </div>`;
  }).join("")
}
function assetSection(id,number,title,description,body){
  const open=state.assetSections[id]!==false;
  return `<div class="asset-section ${open?"open":""}">
    <button type="button" class="asset-heading asset-section-toggle" onclick="toggleAssetSection('${id}',event)" aria-expanded="${open}">
      <span><strong>${number}. ${title}</strong><small>${description}</small></span><b>${open?"−":"+"}</b>
    </button>
    ${open?body:""}
  </div>`
}
let assetPreviewFlipRequest=0;
function preserveArtworkView(){
  const controls=document.querySelector(".artwork-controls-column");
  const grids=[...document.querySelectorAll(".artwork-controls-column .asset-grid-scroll")];
  const preview=document.querySelector("[data-asset-preview]");
  return {
    controlsTop:controls?.scrollTop||0,
    grids:grids.map((el,i)=>[i,el.scrollTop]),
    flipped:state.assetPreviewFlipped
  };
}
function restoreArtworkView(view){
  if(!view)return;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const controls=document.querySelector(".artwork-controls-column");
    if(controls)controls.scrollTop=view.controlsTop;
    [...document.querySelectorAll(".artwork-controls-column .asset-grid-scroll")].forEach((el,i)=>{
      const saved=view.grids.find(x=>x[0]===i);
      if(saved)el.scrollTop=saved[1];
    });
    const preview=document.querySelector("[data-asset-preview]");
    if(preview)preview.classList.toggle("flipped",Boolean(state.assetPreviewFlipped));
  }));
}
window.toggleAssetSection=(id,event)=>{
  event?.stopPropagation();
  ++assetPreviewFlipRequest;
  const view=preserveArtworkView();
  state.assetSections[id]=state.assetSections[id]===false;
  render();
  restoreArtworkView(view);
};
window.toggleAssetLanguage=(id,event)=>{
  event?.stopPropagation();
  ++assetPreviewFlipRequest;
  const view=preserveArtworkView();
  state.assetLanguageGroups[id]=state.assetLanguageGroups[id]===false;
  render();
  restoreArtworkView(view);
};
function assetEditor(){
  const m=movies.find(x=>x.id===state.assetMovieId);
  if(!state.assetEditorOpen||state.nav!=="detail"||state.detail!==state.assetMovieId||!m||!canEditCaseAssets())return "";
  const d=assetDraft(m),tmdb=m.tmdbAssets||{};
  const frontLogoBody='<div class="asset-grid-scroll"><div class="asset-grid asset-language-list logo-grid">'+assetCards(tmdb.logos||[],"logo",d.frontLogoPath)+'</div></div>'+
    '<div class="asset-controls">'+
      '<label>Logo size <input type="range" min="10" max="40" value="'+d.frontLogoSize+'" oninput="setAssetDraft(\'frontLogoSize\',this.value)"><b data-asset-value="frontLogoSize">'+d.frontLogoSize+'%</b></label>'+
      '<label>Vertical position <input type="range" min="0" max="100" value="'+d.frontLogoBottom+'" oninput="setAssetDraft(\'frontLogoBottom\',this.value)"><b data-asset-value="frontLogoBottom">'+d.frontLogoBottom+'% from bottom</b></label>'+
    '</div>'+
    '<label class="asset-toggle"><span><strong>Show logo on front</strong><small>Keep the logo on the back and spines even when hidden here.</small></span><button type="button" class="toggle '+(d.frontLogoVisible?"on":"")+'" onclick="toggleAssetLogo(this)" aria-label="Toggle front logo"></button></label>';
  const detailLogoBody='<div class="asset-grid-scroll"><div class="asset-grid asset-language-list logo-grid">'+assetCards(tmdb.logos||[],"detail-logo",d.detailLogoPath)+'</div></div>';
  const frontImageBody='<div class="asset-grid-scroll"><div class="asset-grid asset-language-list poster-grid">'+assetCards(tmdb.posters||[],"poster",d.frontImagePath)+'</div></div>'+
    '<div class="asset-controls">'+
      '<label>Horizontal crop <input type="range" min="0" max="100" value="'+d.frontImageX+'" oninput="setAssetDraft(\'frontImageX\',this.value)"><b data-asset-value="frontImageX">'+d.frontImageX+'%</b></label>'+
      '<label>Vertical crop <input type="range" min="0" max="100" value="'+d.frontImageY+'" oninput="setAssetDraft(\'frontImageY\',this.value)"><b data-asset-value="frontImageY">'+d.frontImageY+'%</b></label>'+
    '</div>';
  const backStillBody='<div class="asset-grid-scroll"><div class="asset-grid asset-language-list backdrop-grid">'+assetCards(tmdb.backdrops||[],"backdrop",d.backStillPath)+'</div></div>'+
    '<div class="asset-controls">'+
      '<label>Horizontal position <input type="range" min="0" max="100" value="'+d.backStillX+'" oninput="setAssetDraft(\'backStillX\',this.value)"><b data-asset-value="backStillX">'+d.backStillX+'%</b></label>'+
      '<label>Vertical position <input type="range" min="0" max="100" value="'+d.backStillY+'" oninput="setAssetDraft(\'backStillY\',this.value)"><b data-asset-value="backStillY">'+d.backStillY+'%</b></label>'+
    '</div>';
  return '<div class="modal-backdrop open artwork-backdrop" onclick="if(event.target===this)closeAssetEditor()">'+
    '<section class="asset-modal artwork-picker" role="dialog" aria-modal="true" aria-labelledby="asset-title">'+
      '<div class="artwork-live-preview"><div class="artwork-preview-label">LIVE PREVIEW</div><div class="artwork-preview-case'+(state.assetPreviewFlipped?" flipped":"")+'" data-asset-preview data-vhs="'+m.id+'" title="Move the mouse over the case to tilt · click to flip"><div class="vhs-stage" onclick="toggleCase(event,this.parentElement)">'+caseFaces(m,backContent(m))+'</div></div><div class="artwork-preview-hint">Move over the case to tilt · click to flip</div></div>'+
      '<div class="artwork-controls-column"><div class="modal-head"><div><div class="eyebrow">TMDB ARTWORK</div><h2 id="asset-title">Customize case artwork</h2><p class="asset-sub">Choose the artwork you want to use for this movie.</p></div><button class="modal-close" onclick="closeAssetEditor()" aria-label="Close">×</button></div>'+
      (state.assetLoading?'<div class="add-status">Loading artwork from TMDB…</div>':state.assetError?'<div class="add-status error">'+state.assetError+'</div>':
        assetSection("frontLogo",1,"Front logo","Used on the front, spine, and back of the VHS case.",frontLogoBody)+
        assetSection("detailLogo",2,"Details-page logo","Independent from the logo used on the physical case.",detailLogoBody)+
        assetSection("frontImage",3,"Front image","Choose any TMDB poster asset, including language-specific versions.",frontImageBody)+
        assetSection("backStill",4,"Back still","Choose the TMDB backdrop/still shown behind the back-of-case information.",backStillBody)+
        '<div class="asset-actions"><button class="ghost" onclick="closeAssetEditor()">Done</button></div>')+
      '</div></section></div>';
}
function openRemoveMovie(id){state.removeMovieId=id;render()}
function closeRemoveMovie(){state.removeMovieId=null;render()}
function confirmRemoveMovie(){const id=state.removeMovieId;if(!id)return;const idx=movies.findIndex(x=>x.id===id);if(idx<0)return;removedMovieIds.push(id);try{localStorage.setItem('watchlist-removed-movies',JSON.stringify([...new Set(removedMovieIds)]));if(id.startsWith('tmdb-'))localStorage.setItem('watchlist-added-movies',JSON.stringify(movies.filter(x=>x.id.startsWith('tmdb-')&&x.id!==id).map(x=>({...x,score:0}))));}catch(error){}movies.splice(idx,1);persistSharedWatchlist();state.removeMovieId=null;state.detail=null;state.nav='watchlist';render()}
function removeMovieModal(){if(!state.removeMovieId)return '';const m=movies.find(x=>x.id===state.removeMovieId);if(!m)return '';return '<div class="modal-backdrop open" onclick="if(event.target===this)closeRemoveMovie()"><section class="remove-confirm-modal" role="dialog" aria-modal="true"><h2>Remove '+m.title+'?</h2><p>Are you sure?</p><div class="remove-confirm-actions"><button class="ghost" onclick="closeRemoveMovie()">No</button><button class="remove-movie-button" onclick="confirmRemoveMovie()">Yes</button></div></section></div>'}
let headerPrismIntroPlayed=false;
function syncHeaderPrism(){const logo=document.querySelector(".brand-logo"),avatar=document.querySelector(".topbar .user, .topbar .auth-control"),prism=document.querySelector(".header-prism");if(!logo||!avatar||!prism)return;const l=logo.getBoundingClientRect(),u=avatar.getBoundingClientRect();const left=l.right-l.width*.139,right=u.left-24,width=Math.max(0,right-left);prism.style.setProperty("position","fixed","important");prism.style.setProperty("left",left+"px","important");prism.style.setProperty("right","auto","important");prism.style.setProperty("top",l.top+"px","important");prism.style.setProperty("bottom","auto","important");prism.style.setProperty("width",width+"px","important");prism.style.setProperty("height",l.height+"px","important");prism.style.setProperty("transform","none","important");prism.style.setProperty("margin","0","important");prism.style.setProperty("--prism-height",l.height+"px");if(!headerPrismIntroPlayed){headerPrismIntroPlayed=true;const beam=prism.querySelector("img");if(beam){const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;if(reduceMotion){beam.style.transform="none";}else{beam.style.transformOrigin="left center";beam.style.transform="scaleX(0)";beam.getBoundingClientRect();beam.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:650,easing:"cubic-bezier(.18,.72,.25,1)",fill:"both"});}}}}
function render(){const openFilterIds=[...document.querySelectorAll(".filter-dropdown[open][data-filter-id]")].map(el=>el.dataset.filterId);const signedIn=!!window.WATCHLIST_AUTHENTICATED;const content=signedIn?(state.nav==="watchlist"?watchlist():state.nav==="history"?history():state.nav==="people"?people():state.nav==="settings"?settings():detail()):'<section class="empty-state signed-out-message"><h2>Sign in with Discord to start tracking your watchlist.</h2></section>';app.innerHTML=header()+`<main class="content${signedIn?"":" signed-out-content"}">${content}</main>`+addMovieModal()+attendanceModal()+assetEditor()+removeMovieModal()+suggestionNoteEditorModal();openFilterIds.forEach(id=>{const el=[...document.querySelectorAll(".filter-dropdown[data-filter-id]")].find(x=>x.dataset.filterId===id);if(el)el.open=true});bindLiveInputs();bindVhsTilt();requestAnimationFrame(syncHeaderPrism);if(state.nav==="settings"&&window.WATCHLIST_AUTHENTICATED){requestAnimationFrame(()=>{const picker=document.querySelector("#discord-server-picker");if(picker&&picker.dataset.loaded!=="true"){picker.dataset.loaded="loading";chooseDiscordServer().then(()=>{picker.dataset.loaded="true"}).catch(()=>{picker.dataset.loaded="error"})}})}if(!window.__watchlistPrismResize){window.__watchlistPrismResize=true;window.addEventListener("resize",()=>requestAnimationFrame(syncHeaderPrism));window.addEventListener("scroll",()=>requestAnimationFrame(syncHeaderPrism),{passive:true});}}
let addMovieSearchTimer=null;let addMovieSearchRequest=0;
function bindLiveInputs(){let s=document.querySelector("#search");if(s)s.addEventListener("input",e=>{state.search=e.target.value;updateListOnly()});let r=document.querySelector("#sizeRange");if(r)r.addEventListener("input",e=>setPosterSize(e.target.value));let a=document.querySelector("#addMovieSearch");if(a)a.addEventListener("input",e=>{state.addMovieQuery=e.target.value;clearTimeout(addMovieSearchTimer);const query=e.target.value.trim();if(!query){state.addMovieResults=[];state.addMovieError="";document.querySelector("#addMovieResults").innerHTML=addMovieResults();return}addMovieSearchTimer=setTimeout(()=>searchAddMovies(query),300)})}
function updateListOnly(){let main=document.querySelector(".content");if(!main)return;let active=document.activeElement===document.querySelector("#search");let pos=document.querySelector("#search")?.selectionStart;main.innerHTML=watchlist();bindLiveInputs();bindVhsTilt();let s=document.querySelector("#search");if(active&&s){s.focus();s.setSelectionRange(pos,pos)}}
function bindVhsTilt(){const cards=[...document.querySelectorAll("[data-vhs]")];cards.forEach(card=>{const stage=card.querySelector(".vhs-stage"),inner=card.querySelector(".vhs-inner");if(!stage||!inner)return;const r=stage.getBoundingClientRect();inner.style.setProperty("--box-width",r.width+"px");inner.style.setProperty("--box-height",r.height+"px")});if(window.__vhsMouseMove){window.removeEventListener("pointermove",window.__vhsMouseMove);window.removeEventListener("pointerleave",window.__vhsMouseLeave)}window.__vhsMouseMove=e=>{cards.forEach(card=>{const stage=card.querySelector(".vhs-stage");if(!stage)return;const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));const tiltY=clamp(x*14,-20,20);stage.style.setProperty("--tilt-x",clamp(-y*10,-10,10).toFixed(2)+"deg");stage.style.setProperty("--tilt-y",tiltY.toFixed(2)+"deg");stage.style.setProperty("--sticker-shine",(tiltY/20*45).toFixed(2)+"%")})};window.__vhsMouseLeave=()=>cards.forEach(card=>{const stage=card.querySelector(".vhs-stage");if(stage){stage.style.setProperty("--tilt-x","0deg");stage.style.setProperty("--tilt-y","0deg");stage.style.setProperty("--sticker-shine","0%")}});window.addEventListener("pointermove",window.__vhsMouseMove);window.addEventListener("pointerleave",window.__vhsMouseLeave)}
window.toggleCase=(e,el)=>{
  if(!el||e.target.closest("button,input"))return;
  el.classList.toggle("flipped");
  if(el.closest("[data-asset-preview]"))state.assetPreviewFlipped=el.classList.contains("flipped");
};
window.openAddMovie=()=>{state.addMovieOpen=true;state.addMovieQuery="";state.addMovieResults=[];state.addMovieSelection=null;state.addMovieError="";state.addMovieLoading=false;render();requestAnimationFrame(()=>document.querySelector("#addMovieSearch")?.focus())};
window.closeAddMovie=()=>{state.addMovieOpen=false;render()};
window.searchAddMovies=async queryArg=>{const input=document.querySelector("#addMovieSearch");const query=(queryArg??input?.value??state.addMovieQuery??"").trim();if(!query)return;state.addMovieQuery=query;state.addMovieLoading=true;state.addMovieError="";state.addMovieResults=[];const request=++addMovieSearchRequest;const results=document.querySelector("#addMovieResults");if(results)results.innerHTML=addMovieResults();try{const data=await TMDB.search(query);if(request!==addMovieSearchRequest)return;state.addMovieResults=(data.results||[]).slice(0,8);const currentInput=document.querySelector("#addMovieSearch");if(currentInput?.value.trim()!==state.addMovieQuery.trim())return;state.addMovieLoading=false;if(results)results.innerHTML=addMovieResults();}catch(error){if(request!==addMovieSearchRequest)return;state.addMovieError=error.message||"TMDB search failed.";state.addMovieLoading=false;if(results)results.innerHTML=addMovieResults();}};
window.selectAddMovie=async tmdbId=>{state.addMovieLoading=true;state.addMovieError="";render();try{state.addMovieSelection=await TMDB.details(tmdbId);}catch(error){state.addMovieError=error.message||"Could not load that movie.";state.addMovieSelection=null;}finally{state.addMovieLoading=false;render()}};
window.clearAddMovieSelection=()=>{state.addMovieSelection=null;state.addMovieError="";render()};
window.confirmAddMovie=()=>{
  const d=state.addMovieSelection;
  if(!d?.tmdbId)return;
  const identityId=currentProfile?.id||window.WATCHLIST_AUTH_PROFILE?.id||null;
  if(!identityId||currentUser==="Guest"){
    state.addMovieError="Your Discord account could not be identified. Please sign in again.";
    return render();
  }
  const normalizeTitle=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ");
  const duplicate=movies.some(m=>m.tmdbId===d.tmdbId||(normalizeTitle(m.title)===normalizeTitle(d.title)&&String(m.year)===String(d.year||"")));
  if(duplicate){state.addMovieError="Already in watchlist";return render()}
  const note=(document.querySelector("#addMovieNote")?.value||"").trim();
  const movie={id:"tmdb-"+d.tmdbId,title:d.title,year:d.year||"",genre:(d.genre||[]).join(" · "),director:(d.director||[]).join(", "),runtime:d.runtime?formatRuntime(d.runtime):"",rating:d.rating||"",score:0,seen:[],voters:[],synopsis:d.synopsis||"",note,warnings:Array.isArray(d.warnings)?d.warnings:[],watched:false,suggestedBy:currentUser,addedBy:currentUser,suggestedById:identityId,addedById:identityId,releaseDate:d.releaseDate||"",tmdbId:d.tmdbId,posterPath:d.posterPath||null,textlessPosterPath:d.textlessPosterPath||null,backdropPath:d.backdropPath||null,logoPath:d.logoPath||null,digitalReleaseDate:d.digitalReleaseDate||null,physicalReleaseDate:d.physicalReleaseDate||null,tmdbStreaming:Array.isArray(d.streaming)?d.streaming:[]};
  movies.push(movie);
  removedMovieIds=removedMovieIds.filter(removedId=>removedId!==movie.id);
  try{localStorage.setItem("watchlist-removed-movies",JSON.stringify(removedMovieIds));localStorage.setItem("watchlist-added-movies",JSON.stringify(movies.filter(m=>m.id.startsWith("tmdb-")).map(m=>({...m,score:0}))));}catch(error){}
  persistSharedWatchlist();
  state.addMovieOpen=false;state.addMovieSelection=null;state.addMovieError="";render()
};

window.openAssetEditor=async id=>{
  if(!canEditCaseAssets()||state.nav!=="detail"||state.detail!==id)return;
  assetEditorDirty=false;
  state.assetMovieId=id;state.assetEditorOpen=true;state.assetLoading=true;state.assetError="";render();
  const m=movies.find(x=>x.id===id);
  try{
    if(!m?.tmdbId)throw new Error("This movie is not linked to TMDB.");
    const data=await TMDB.details(m.tmdbId);
    TMDB.apply(m,data);
  }catch(error){state.assetError=error.message||"Could not load TMDB artwork."}
  finally{state.assetLoading=false;render()}
};
window.closeAssetEditor=()=>{
  const shouldSync=assetEditorDirty;
  assetEditorDirty=false;
  state.assetEditorOpen=false;state.assetMovieId=null;state.assetLoading=false;
  if(shouldSync)saveCaseAssets(true);
  render();
};
window.chooseAsset=(type,encodedPath)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const view=preserveArtworkView();
  const wasFlipped=Boolean(state.assetPreviewFlipped);
  const path=decodeURIComponent(encodedPath);
  const a=savedCaseAssets[m.id]||{};
  if(type==="logo")a.frontLogoPath=path;
  else if(type==="detail-logo")a.detailLogoPath=path;
  else if(type==="poster")a.frontImagePath=path;
  else if(type==="backdrop")a.backStillPath=path;
  savedCaseAssets[m.id]=a;assetEditorDirty=true;saveCaseAssets(false);

  const targetFlipped=type==="backdrop"?true:type==="poster"?false:wasFlipped;
  const shouldAnimateFlip=(type==="poster"||type==="backdrop")&&wasFlipped!==targetFlipped;
  const request=++assetPreviewFlipRequest;

  // When changing to the opposite side, render the preview on its current side
  // first so the existing 3D transition can animate from that side to the target.
  state.assetPreviewFlipped=shouldAnimateFlip?wasFlipped:targetFlipped;
  render();
  restoreArtworkView(view);

  if(shouldAnimateFlip){
    requestAnimationFrame(()=>{
      if(request!==assetPreviewFlipRequest)return;
      const preview=document.querySelector("[data-asset-preview]");
      const inner=preview?.querySelector(".vhs-inner");
      if(!preview||!inner)return;
      state.assetPreviewFlipped=targetFlipped;
      void inner.offsetWidth;
      requestAnimationFrame(()=>{
        if(request!==assetPreviewFlipRequest)return;
        preview.classList.toggle("flipped",targetFlipped);
      });
    });
  }
};
window.toggleAssetLogo=(button)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const a=savedCaseAssets[m.id]||{};
  const visible=a.frontLogoVisible!==false;
  const next=!visible;
  a.frontLogoVisible=next;
  savedCaseAssets[m.id]=a;
  assetEditorDirty=true;
  saveCaseAssets(false);
  const live=document.querySelector("[data-asset-preview] .vhs-inner");
  const logo=live?.querySelector(".vhs-front-logo");
  if(logo)logo.classList.toggle("asset-logo-hidden",!next);
  if(button)button.classList.toggle("on",next);
};
window.setAssetDraft=(field,value)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const a=savedCaseAssets[m.id]||{};
  a[field]=field==="frontLogoVisible"?Boolean(value):Number(value);
  savedCaseAssets[m.id]=a;assetEditorDirty=true;saveCaseAssets(false);

  const label=document.querySelector('[data-asset-value="'+field+'"]');
  if(label)label.textContent=field==="frontLogoBottom"?value+"% from bottom":value+"%";

  const live=document.querySelector("[data-asset-preview] .vhs-inner");
  if(!live)return;

  if(field==="frontLogoSize"||field==="frontLogoBottom"){
    const logo=live.querySelector(".vhs-front-logo");
    if(logo)logo.style.setProperty(field==="frontLogoSize"?"--front-logo-size":"--front-logo-bottom",Number(value)+"%");
  }
  if(field==="frontImageX"||field==="frontImageY"){
    const img=live.querySelector(".vhs-front>img");
    if(img){
      const x=field==="frontImageX"?100-Number(value):100-Number(a.frontImageX??50);
      const y=field==="frontImageY"?Number(value):Number(a.frontImageY??50);
      img.style.objectPosition=x+"% "+y+"%";
    }
  }
  if(field==="backStillX"||field==="backStillY"){
    const img=live.querySelector(".vhs-back-art");
    if(img){
      const x=field==="backStillX"?100-Number(value):100-Number(a.backStillX??50);
      const y=field==="backStillY"?Number(value):Number(a.backStillY??50);
      img.style.objectPosition=x+"% "+y+"%";
    }
  }
  if(field==="frontLogoVisible"){
    const logo=live.querySelector(".vhs-front-logo");
    if(logo)logo.classList.toggle("asset-logo-hidden",!Boolean(value));
    const toggle=document.querySelector(".asset-toggle .toggle");
    if(toggle)toggle.classList.toggle("on",Boolean(value));
  }
};
window.setNav=x=>{if(!["watchlist","history","people","settings"].includes(x))return;const target=routeUrl(x,null);if(window.location.pathname+window.location.search!==target)window.history.pushState(null,document.title,target);state.nav=x;state.detail=null;render();};window.setView=x=>{state.view=x;saveUserSettings();render()};window.toggleFilters=()=>{state.showFilters=!state.showFilters;render()};window.setFilter=x=>{state.filter=x;render()};window.setPosterSize=x=>{state.posterSize=Math.max(1,Math.min(4,Math.round(Number(x)||1)));saveUserSettings();const cols=[12,8,6,5][state.posterSize-1];document.querySelectorAll(".grid").forEach(e=>e.style.setProperty("--grid-cols",cols));document.querySelectorAll(".range").forEach(e=>e.value=state.posterSize);requestAnimationFrame(()=>bindVhsTilt())};window.toggleSetting=k=>{state[k]=!state[k];if(displaySettingKeys.includes(k)){try{const saved={};displaySettingKeys.forEach(key=>saved[key]=Boolean(state[key]));localStorage.setItem("watchlist-display-settings",JSON.stringify(saved))}catch(error){}saveUserSettings()}render();if(k==="showRatings"&&state[k]&&state.nav==="detail"){const movie=movies.find(x=>x.id===state.detail);if(movie)loadExternalRatings(movie)}};window.toggleDetailSection=k=>{state.detailSections[k]=!state.detailSections[k];render()};async function loadExternalRatings(movie){if(!state.showRatings||movie.ratingsLoaded||movie.ratingsLoading)return;movie.ratingsLoading=true;movie.ratingsError=false;try{if(!movie.imdbId&&movie.tmdbId){const details=await TMDB.details(movie.tmdbId);TMDB.apply(movie,details)}if(!movie.imdbId)throw new Error("No IMDb ID");const endpoint=window.WATCHLIST_OMDB_ENDPOINT||(location.hostname.endsWith("github.io")?"https://the-watchlist-two.vercel.app/api/omdb":"/api/omdb");const url=new URL(endpoint,window.location.origin);url.searchParams.set("imdbID",movie.imdbId);const response=await fetch(url);const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw new Error("Ratings unavailable");movie.imdbRating=data.imdbRating&&data.imdbRating!=="N/A"?data.imdbRating:null;movie.rottenTomatoesRating=data.rottenTomatoesRating&&data.rottenTomatoesRating!=="N/A"?data.rottenTomatoesRating:null;movie.ratingsLoaded=true;}catch(error){movie.ratingsError=true;}finally{movie.ratingsLoading=false;if(state.nav==="detail"&&state.detail===movie.id)render()}}
window.openMovie=id=>{const movie=movies.find(x=>String(x.id)===String(id));if(!movie)return;window.location.href=routeUrl("detail",movie.id);if(movie.tmdbId&&!movie.tmdbDetailsLoading){movie.tmdbDetailsLoading=true;TMDB.details(movie.tmdbId).then(data=>{TMDB.apply(movie,data);movie.tmdbDetailsLoaded=true;if(state.showRatings)loadExternalRatings(movie);}).catch(error=>console.warn("TMDB details unavailable for "+movie.title,error.message)).finally(()=>{movie.tmdbDetailsLoading=false;if(state.nav==="detail"&&state.detail===movie.id)render()})}else if(state.showRatings)loadExternalRatings(movie)};window.togglePerson=p=>{
const card=document.querySelector('[data-person="'+p+'"]');if(!card)return;const old=card.querySelector(".person-details");if(old){old.remove();return}
// Interest is independent of Seen status. A movie can be both watched/seen
// and still have a recorded interest response, so don't hide it here.
const interests=movies.filter(m=>{const v=personVote(m,p);return Boolean(v)&&v!=="no"});
const watched=movies.filter(m=>(m.watchedBy||[]).includes(p));
const together=p===currentUser?[]:movies.filter(m=>(m.watchedBy||[]).includes(p)&&(m.watchedBy||[]).includes(currentUser));
const reviewed=movies.filter(m=>(movieReviews[m.id]||{})[p]);
const suggested=movies.filter(m=>m.suggestedBy===p||m.addedBy===p);
const row=(m,label,cls,showWatchers=false)=>'<button type="button" class="person-movie" onclick="event.stopPropagation();openMovie(this.dataset.id)" data-id="'+m.id+'"><span>'+m.title+'</span>'+(label?'<span class="'+cls+'">'+label+'</span>':"")+(showWatchers?stack((m.watchedBy||[]).map(n=>[n,"watched","Watched"])):"")+'</button>';
const section=(title,items,empty,cls)=>'<div><div class="person-section-label">'+title+' ('+items.length+')</div><div class="person-movies">'+(items.join("")||'<div class="person-empty">'+empty+'</div>')+'</div></div>';
const details=document.createElement("div");details.className="person-details";
details.innerHTML=section("INTERESTED IN WATCHING",interests.map(m=>{const vote=personVote(m,p);const label=({must:"Must Watch",interested:"Interested",watch:"I’d Watch",no:"Not Interested"})[vote]||"No response";return row(m,label,"person-interest "+personVoteColor(vote))}),"No interest responses yet.")+section("MOVIES WATCHED",watched.map(m=>row(m,"","",true)),"No watched movies recorded.")+(p===currentUser?"":section("WATCHED WITH YOU",together.map(m=>row(m,"","",true)),"No movies recorded as watched together."))+section("REVIEWS",reviewed.map(m=>{const review=movieReviews[m.id][p]||{};const stars=review.rating?peopleRatingStars(review.rating):"";const quote=review.review?'<span class="people-review-quote"><span class="people-review-open">“</span><span class="people-review-quote-text">'+escapeHtml(review.review)+'</span><span class="people-review-close">”</span></span>':"Review posted";const content='<span class="people-review-content">'+(review.rating?'<span class="people-review-score">'+stars+'</span><span class="people-review-copy">'+(review.review?'<em>'+quote+'</em>':quote)+'</span>':(review.review?'<em>'+quote+'</em>':quote))+'</span>';return row(m,content,"person-seen")}),"No reviews yet.")+section("SUGGESTED",suggested.map(m=>row(m,"","")),"No suggestions yet.");
card.appendChild(details)};
window.toggleGenre=(g,on)=>{state.genreFilters=on?[...new Set([...state.genreFilters,g])]:state.genreFilters.filter(x=>x!==g);render()};
window.previewYearRange=(which,input)=>{const years=movies.map(m=>Number(m.year)).filter(y=>Number.isFinite(y)&&y>0),min=years.length?Math.min(...years):1888,max=years.length?Math.max(...years):new Date().getFullYear();const fromEl=document.querySelector(".dual-range input[aria-label=\"From year\"]"),toEl=document.querySelector(".dual-range input[aria-label=\"To year\"]");let from=Number(fromEl?.value)||min,to=Number(toEl?.value)||max,n=Math.max(min,Math.min(max,Number(input.value)));if(which==="from"){n=Math.min(n,to);input.value=n;from=n}else{n=Math.max(n,from);input.value=n;to=n}const fl=document.getElementById("year-from-label"),tl=document.getElementById("year-to-label");if(fl)fl.textContent=from;if(tl)tl.textContent=to;const p1=(from-min)/(max-min||1)*100,p2=(to-min)/(max-min||1)*100,track=document.querySelector(".dual-range");if(track)track.style.setProperty("--range-fill",`linear-gradient(to right,#555b65 0%,#555b65 ${p1}%,#aeb4be ${p1}%,#aeb4be ${p2}%,#555b65 ${p2}%,#555b65 100%)`)};window.setYear=(which,value)=>{const years=movies.map(m=>Number(m.year)).filter(y=>Number.isFinite(y)&&y>0),min=years.length?Math.min(...years):1888,max=years.length?Math.max(...years):new Date().getFullYear();let n=Math.max(min,Math.min(max,Number(value)));if(which==="from"){const upper=Number(state.yearTo)||max;n=Math.min(n,upper);state.yearFrom=String(n)}else{const lower=Number(state.yearFrom)||min;n=Math.max(n,lower);state.yearTo=String(n)}render()};window.toggleInterestUser=(p,on)=>{state.interestUsers=on?[...new Set([...state.interestUsers,p])]:state.interestUsers.filter(x=>x!==p);render()};window.setInterestLevel=x=>{state.interestLevel=x;render()};
window.setSeenMode=x=>{state.seenMode=x;render()};
window.toggleSeenUser=(p,on)=>{state.seenUsers=on?[...new Set([...(state.seenUsers||[]),p])]: (state.seenUsers||[]).filter(x=>x!==p);render()};
window.setRewatchStatus=x=>{state.rewatchStatus=x;render()};
window.setSuggestedBy=x=>{state.suggestedBy=x;render()};
window.clearOneFilter=key=>{if(key==="yearFrom"||key==="yearTo"){state.yearFrom="";state.yearTo=""}else if(key==="interestUsers"||key==="interestLevel"){state.interestUsers=[];state.interestLevel=""}else if(key==="seenUsers"){state.seenUsers=[];state.seenMode="seen"}else if(key==="seenMode"){state.seenMode="seen"}else state[key]=Array.isArray(state[key])?[]:"";const owner={genre:"genre",genreFilters:"genre",yearFrom:"year",yearTo:"year",suggestedBy:"suggested",interestUsers:"interest",interestLevel:"interest",seenUsers:"seen",seenMode:"seen",rewatchStatus:"rewatch"}[key];if(owner){const el=document.querySelector('[data-filter-id="'+owner+'"]');if(el)el.open=false}render()};
window.closeFilterDropdowns=()=>document.querySelectorAll(".filter-dropdown[open]").forEach(el=>el.open=false);if(!window.__filterOutsideBound){document.addEventListener("click",e=>{if(!e.target.closest(".filter-dropdown"))window.closeFilterDropdowns()});window.__filterOutsideBound=true;}
window.clearAllFilters=()=>{state.genreFilters=[];state.yearFrom="";state.yearTo="";state.interestUsers=[];state.interestLevel="";state.seenMode="seen";state.seenUsers=[];state.rewatchStatus="";state.suggestedBy="";state.filter="all";state.search="";render()};
window.resetAdvancedFilters=window.clearAllFilters;
window.vote=async(id,k)=>{if(currentUser==="Guest")return;const old=state.votes[id];if(old===k)return;const before=new Map([...document.querySelectorAll("[data-movie-id]")].map(el=>[el.dataset.movieId,el.getBoundingClientRect()]));const m=movies.find(x=>x.id===id);if(!m)return;state.votes[id]=k;m.voterResponses={...(m.voterResponses||{}),[currentUser]:k};votesByUser[currentProfile?.id||identityIdForName(currentUser)||userKey(currentUser)]={id:currentProfile?.id||identityIdForName(currentUser)||null,name:currentUser,avatar:currentAvatar(),votes:{...state.votes}};m.score=calculateMovieScore(m);try{localStorage.setItem("watchlist-votes-by-user",JSON.stringify(votesByUser));localStorage.setItem("watchlist-votes",JSON.stringify(state.votes));localStorage.setItem("watchlist-added-movies",JSON.stringify(movies.filter(x=>x.id.startsWith("tmdb-")).map(x=>({...x,score:0}))))}catch(error){}await persistSharedWatchlist();render();requestAnimationFrame(()=>{document.querySelectorAll("[data-movie-id]").forEach(el=>{const first=before.get(el.dataset.movieId);if(!first)return;const last=el.getBoundingClientRect();const dx=first.left-last.left,dy=first.top-last.top;if(Math.abs(dx)+Math.abs(dy)>1){el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:420,easing:"cubic-bezier(.2,.75,.2,1)"})}})})};
window.toggleSeen=async id=>{
  if(currentUser==="Guest"||!currentProfile?.id)return;
  const m=movies.find(x=>x.id===id);
  if(!m)return;
  const userId=currentProfile.id;
  const wasSeen=Boolean(globalSeenByUser[userId]?.[id]);
  try{
    await setSeenForAccount(userId,id,!wasSeen);
    await loadGlobalSeen();
    savedSeenStatus[id]=Object.keys(globalSeenByUser).filter(uid=>globalSeenByUser[uid]?.[id]).map(uid=>identityDisplayName(uid,userProfiles,votesByUser));
    render();
  }catch(error){console.warn("Could not save seen state:",error.message||error);alert("Could not save Seen status. Please try again.")}
};
window.openAttendance=id=>{
  const m=movies.find(x=>x.id===id);if(!m)return;
  state.attendanceMovieId=id;
  state.attendanceSelected=[...(watchedAttendance[id]||m.watchedBy||[])];
  state.attendanceOpen=true;render();
};
window.closeAttendance=()=>{state.attendanceOpen=false;state.attendanceMovieId=null;state.attendanceSelected=[];render()};
window.toggleAttendanceUser=(event,name)=>{
  event?.preventDefault?.();
  const selected=state.attendanceSelected;
  const idx=selected.findIndex(value=>userKey(value)===userKey(name));
  if(idx>=0)selected.splice(idx,1);else selected.push(name);
  render();
};
window.confirmAttendance=async()=>{
  const id=state.attendanceMovieId,m=movies.find(x=>x.id===id);
  if(!m||!currentProfile?.id)return;
  const attendees=[...state.attendanceSelected];
  const ids=[...new Set(attendees.map(name=>identityIdForName(name)).filter(Boolean))];
  if(!ids.length){alert("Select at least one group member.");return}
  try{
    const client=window.WATCHLIST_SUPABASE_CLIENT;
    const {error:groupError}=await client.rpc("watchlist_set_group_seen",{
      p_movie_id:String(id),p_user_ids:ids
    });
    if(groupError)throw groupError;
    watchedAttendance[id]=attendees;
    if(!watchedMovies.includes(id))watchedMovies.push(id);
    m.watched=true;m.watchedBy=attendees;m.setToRewatch=false;
    state.attendanceOpen=false;state.attendanceMovieId=null;state.attendanceSelected=[];
    await loadGlobalSeen();
    await persistSharedWatchlist();
    try{
      localStorage.setItem("watchlist-watched-movies",JSON.stringify(watchedMovies));
      localStorage.setItem("watchlist-watched-attendance",JSON.stringify(watchedAttendance));
    }catch(error){}
    render();
  }catch(error){console.warn("Could not save group watch:",error.message||error);alert("Could not save the group watch. Please try again.")}
};
window.markWatchedTogether=(id,undo)=>{if(undo)return;openAttendance(id)};
window.watchAgain=id=>{const m=movies.find(x=>x.id===id);if(!m)return;m.setToRewatch=true;m.watched=false;m.watchedBy=[];watchedMovies=watchedMovies.filter(x=>x!==id);try{localStorage.setItem("watchlist-watched-movies",JSON.stringify(watchedMovies));localStorage.setItem("watchlist-watched-attendance",JSON.stringify(Object.fromEntries(movies.filter(x=>x.watched).map(x=>[x.id,x.watchedBy||[]]))));}catch(error){}persistSharedWatchlist();state.nav="watchlist";state.detail=null;render()};
window.editWatchedBy=id=>{const m=movies.find(x=>x.id===id);if(!m)return;openAttendance(id)};
window.setReviewRating=(event,index)=>{const button=event.currentTarget;const rect=button.getBoundingClientRect();const value=index+(event.clientX-rect.left<rect.width/2?.5:1);const section=document.querySelector(".review-section");if(section)section.dataset.rating=value;document.querySelectorAll(".review-form .rating-star .star-gradient").forEach((el,i)=>{const fill=Math.round(Math.max(0,Math.min(1,value-i))*2)/2;el.style.setProperty("--star-fill",fill*100+"%")});};
window.editSuggestionNote=id=>{
  const m=movies.find(x=>x.id===id);if(!m)return;
  const ownerId=m.suggestedById||m.addedById;
  if(ownerId?ownerId!==currentProfile?.id:(m.suggestedBy||m.addedBy)!==currentUser)return;
  state.noteEditorMovieId=id;state.noteEditorOpen=true;render()
};
function suggestionNoteEditorModal(){if(!state.noteEditorOpen)return "";const m=movies.find(x=>x.id===state.noteEditorMovieId);if(!m)return "";return '<div class="modal-backdrop open note-editor-backdrop" onclick="if(event.target===this)closeSuggestionNoteEditor()"><section class="add-modal note-editor-modal" role="dialog" aria-modal="true" aria-labelledby="suggestion-note-editor-title"><div class="modal-head"><div><div class="eyebrow">YOUR SUGGESTION</div><h2 id="suggestion-note-editor-title">'+(m.note?"Edit note":"Add a note")+'</h2><p class="attendance-sub">'+escapeHtml(m.title)+'</p></div><button class="modal-close" onclick="closeSuggestionNoteEditor()" aria-label="Close">×</button></div><label class="add-label">Your note<textarea id="suggestionNoteDraft" class="review-text" rows="4" placeholder="Why should we watch this?">'+escapeHtml(m.note||"")+'</textarea></label><div class="add-form-actions"><button class="ghost" onclick="closeSuggestionNoteEditor()">Cancel</button><button class="primary" onclick="saveSuggestionNote()">Save note</button></div></section></div>'}
window.closeSuggestionNoteEditor=()=>{state.noteEditorOpen=false;state.noteEditorMovieId=null;render()};
window.saveSuggestionNote=()=>{const m=movies.find(x=>x.id===state.noteEditorMovieId);if(!m)return;const note=(document.querySelector("#suggestionNoteDraft")?.value||"").trim();m.note=note;const identityId=currentProfile?.id||window.WATCHLIST_AUTH_PROFILE?.id||null;m.suggestedById=m.suggestedById||m.addedById||identityId;m.addedById=m.addedById||identityId;m.suggestedBy=m.suggestedBy||currentUser;m.addedBy=m.addedBy||currentUser;try{if(m.id.startsWith("tmdb-"))localStorage.setItem("watchlist-added-movies",JSON.stringify(movies.filter(x=>x.id.startsWith("tmdb-")).map(x=>({...x,score:0}))));else{let notes={};try{notes=JSON.parse(localStorage.getItem("watchlist-suggestion-notes")||"{}")}catch(error){}notes[m.id]=m.note;localStorage.setItem("watchlist-suggestion-notes",JSON.stringify(notes));}}catch(error){}persistSharedWatchlist();state.noteEditorOpen=false;state.noteEditorMovieId=null;render()};
window.saveReview=id=>{const section=document.querySelector(".review-section");if(!section)return;const text=(document.querySelector("#reviewText")?.value||"").trim();const rating=Number(section.dataset.rating||0);if(!rating&&!text)return;movieReviews[id]=movieReviews[id]||{};movieReviews[id][currentUser]={rating,review:text,userId:currentProfile?.id||identityIdForName(currentUser)||null,name:currentUser,avatar:currentAvatar()};try{localStorage.setItem("watchlist-movie-reviews",JSON.stringify(movieReviews));}catch(error){}persistSharedWatchlist();render()};
let tmdbHydrated=false;
async function hydrateTmdbArtwork(){
  if(tmdbHydrated||!window.TMDB)return;
  tmdbHydrated=true;
  let cache={};try{cache=JSON.parse(localStorage.getItem("watchlist-tmdb-preload-cache")||"{}")}catch(error){cache={}}
  const seeded=movies.filter(movie=>!movie.id.startsWith("tmdb-"));
  let appliedCache=false;
  seeded.forEach(movie=>{if(cache[movie.id]){TMDB.apply(movie,cache[movie.id]);appliedCache=true}});
  // Paint cached artwork immediately instead of waiting for every network refresh.
  if(appliedCache)render();
  const matches=await Promise.all(seeded.map(async movie=>{
    try{const search=await TMDB.search(movie.title);const results=search.results||[];return {movie,match:results.find(r=>Number(r.year)===Number(movie.year))||results[0]||null}}
    catch(error){console.warn("TMDB search hydration skipped for "+movie.title,error.message);return {movie,match:null}}
  }));
  await Promise.all(matches.filter(x=>x.match?.tmdbId).map(async ({movie,match})=>{
    try{const details=await TMDB.details(match.tmdbId);TMDB.apply(movie,details);cache[movie.id]=details;render();if(state.showRatings)loadExternalRatings(movie)}
    catch(error){console.warn("TMDB hydration skipped for "+movie.title,error.message)}
  }));
  try{localStorage.setItem("watchlist-tmdb-preload-cache",JSON.stringify(cache))}catch(error){}
  render();
}
window.toggleWarningCategory=(category,checked)=>{const key=String(category).toLowerCase();savedWarningCategories=checked?[...new Set([...savedWarningCategories,key])]:savedWarningCategories.filter(x=>x!==key);try{localStorage.setItem("watchlist-warning-categories",JSON.stringify(savedWarningCategories))}catch(error){}saveUserSettings();document.querySelectorAll(".warning-picker-count").forEach(el=>el.textContent=savedWarningCategories.length+" selected")};
applyRoute({replace:true});
render();
hydrateTmdbArtwork();document.addEventListener("toggle",event=>{const target=event.target;if(!target.matches(".filter-dropdown")||!target.open)return;document.querySelectorAll(".filter-dropdown[open]").forEach(other=>{if(other!==target&&!other.contains(target)&&!target.contains(other))other.open=false})},true);
