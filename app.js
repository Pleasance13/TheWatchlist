const fallback=(t,y)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#25282d"/><rect x="30" y="30" width="440" height="690" rx="12" fill="#17191c" stroke="#4a4f57"/><text x="250" y="350" fill="#e8e4da" font-family="Arial" font-size="38" font-weight="bold" text-anchor="middle">${t}</text><text x="250" y="400" fill="#9298a1" font-family="Arial" font-size="24" text-anchor="middle">${y}</text></svg>`)}`;

const seedMovies=[
{id:"alien",title:"Alien",year:1979,genre:"Horror · Sci-Fi",director:"Ridley Scott",runtime:"1h 57m",rating:"R",score:10,seen:["Josh"],voters:[["Josh","green"],["Sarah","green"],["Dan","yellow"]],synopsis:"The crew of a commercial spacecraft encounter a deadly lifeform after answering a mysterious distress signal.",note:"I don't think we've actually watched this together. Fix that.",warnings:["Gore","Body horror"],watched:false},
{id:"thing",title:"The Thing",year:1982,genre:"Horror · Sci-Fi",director:"John Carpenter",runtime:"1h 49m",rating:"R",score:8,seen:["Sarah"],voters:[["Josh","green"],["Sarah","yellow"],["Alex","red"]],synopsis:"A research team in Antarctica faces a lifeform capable of perfectly imitating other organisms.",note:"Been meaning to show you guys this for ages.",warnings:["Gore","Animal death"],watched:false},
{id:"scream",title:"Scream",year:1996,genre:"Horror · Mystery",director:"Wes Craven",runtime:"1h 51m",rating:"R",score:7,seen:["Josh","Alex"],voters:[["Josh","yellow"],["Dan","yellow"],["Alex","red"]],synopsis:"A masked killer turns a small town's horror-movie knowledge into a deadly game.",note:"A classic group-watch candidate.",warnings:["Violence","Sexual content"],watched:false},
{id:"predator",title:"Predator",year:1987,genre:"Action · Sci-Fi",director:"John McTiernan",runtime:"1h 47m",rating:"R",score:6,seen:[],voters:[["Josh","green"],["Sarah","yellow"]],synopsis:"An elite rescue team becomes prey for an extraterrestrial hunter in a Central American jungle.",note:"",warnings:["Gore","Violence"],watched:false},
{id:"tremors",title:"Tremors",year:1990,genre:"Horror · Comedy",director:"Ron Underwood",runtime:"1h 36m",rating:"PG-13",score:5,seen:["Dan"],voters:[["Dan","green"],["Alex","yellow"]],synopsis:"A tiny desert town is besieged by enormous underground creatures.",note:"",warnings:["Animal death"],watched:false},
{id:"event",title:"Event Horizon",year:1997,genre:"Horror · Sci-Fi",director:"Paul W. S. Anderson",runtime:"1h 36m",rating:"R",score:3,seen:["Sarah","Dan"],voters:[["Sarah","green"],["Alex","yellow"]],synopsis:"A rescue crew investigates a vanished spaceship and discovers something deeply wrong with its return.",note:"Maybe this one is a terrible idea. Which is exactly why I'm suggesting it.",warnings:["Gore","Disturbing imagery"],watched:true,watchedBy:["Josh","Sarah","Dan"]}
];

let savedMovies=[];
try{savedMovies=JSON.parse(localStorage.getItem("watchlist-added-movies")||"[]");}catch(error){savedMovies=[];}
seedMovies.forEach(m=>{if(m.note)m.addedBy="Josh";});
const movies=[...seedMovies,...savedMovies];
const baseScores=Object.fromEntries(movies.map(m=>[m.id,m.score||0]));
let movieReviews={};let watchedMovies=[];
try{movieReviews=JSON.parse(localStorage.getItem("watchlist-movie-reviews")||"{}");}catch(error){movieReviews={}}
try{watchedMovies=JSON.parse(localStorage.getItem("watchlist-watched-movies")||"[]");}catch(error){watchedMovies=[]}
let watchedAttendance={};try{watchedAttendance=JSON.parse(localStorage.getItem("watchlist-watched-attendance")||"{}")}catch(error){watchedAttendance={}}
watchedMovies.forEach(id=>{const m=movies.find(x=>x.id===id);if(m){m.watched=true;m.watchedBy=watchedAttendance[id]||m.watchedBy||[]}});
const currentUser="Josh";
const serverUsers=["Josh","Sarah","Dan","Sam","Alex"];
const state={nav:"watchlist",view:"list",search:"",filter:"all",posterSize:2,showSynopsis:true,showRatings:false,showNote:true,showTrailer:false,detail:null,showFilters:false,genreFilters:[],yearFrom:"",yearTo:"",interestUser:"",interestLevel:"",seenMode:"seen",seenUsers:[],rewatchUsers:[],watchedWith:"",suggestedBy:"",votes:{},addMovieOpen:false,addMovieQuery:"",addMovieResults:[],addMovieSelection:null,addMovieLoading:false,addMovieError:"",attendanceOpen:false,attendanceMovieId:null,attendanceSelected:[],assetEditorOpen:false,assetMovieId:null,assetLoading:false,assetError:"",assetSections:{frontLogo:true,detailLogo:true,frontImage:true,backStill:true},assetLanguageGroups:{},assetPreviewFlipped:false};
const app=document.querySelector("#app");
let savedCaseAssets={};
try{savedCaseAssets=JSON.parse(localStorage.getItem("watchlist-case-assets")||"{}");}catch(error){savedCaseAssets={}}
// Temporary UI gate: once Discord auth exists, replace this with the authenticated Josh/Discord user ID check.
function canEditCaseAssets(){return currentUser==="Josh"}
function caseAssets(m){return savedCaseAssets[m.id]||{}}
function movieLogoPath(m,preferred){
  const a=caseAssets(m);
  return preferred||a.frontLogoPath||m.logoPath||m.tmdbAssets?.logos?.find(x=>x.isoLanguage==='en'||!x.isoLanguage)?.filePath||m.tmdbAssets?.logos?.[0]?.filePath||null;
}
function detailLogoPath(m){
  const a=caseAssets(m);
  return a.detailLogoPath||m.logoPath||m.tmdbAssets?.logos?.find(x=>x.isoLanguage==='en'||!x.isoLanguage)?.filePath||m.tmdbAssets?.logos?.[0]?.filePath||null;
}
function saveCaseAssets(){try{localStorage.setItem("watchlist-case-assets",JSON.stringify(savedCaseAssets));}catch(error){}}
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
function voterEntries(m){
  const entries=m.voters.filter(([name])=>name!=="Josh");
  const mine=currentVote(m.id);
  if(mine){
    const color={must:"green",interested:"green",watch:"yellow",no:"red"}[mine];
    entries.unshift(["Josh",color]);
  }
  return entries;
}
function responseLabel(k){return ({must:"Must Watch",interested:"Interested",watch:"I'd Watch",no:"Not Interested"})[k]||"No response"}
function rankOf(m){const ranked=movies.filter(x=>!x.watched).slice().sort((a,b)=>b.score-a.score);const n=ranked.findIndex(x=>x.id===m.id);return n>=0?n+1:"—"}
function rankSticker(rank,extraClass=""){if(!Number.isFinite(Number(rank))||Number(rank)<1||Number(rank)>5)return "";const n=Number(rank);return `<span class="rank-sticker rank-sticker-${n} ${extraClass}" aria-label="Rank #${n}" style="--sticker-index:${n-1}"><span class="rank-sticker-number">#${n}</span>${n===1?'<span class="rank-sticker-shine" aria-hidden="true"></span>':""}</span>`}
function header(){return `<header class="topbar"><button class="brand" onclick="setNav('watchlist');setView('list')" aria-label="Go to Watchlist"><div class="brand-mark">▶</div><span>THE WATCHLIST</span></button><nav class="nav">${["watchlist","history","people","settings"].map(x=>`<button class="${state.nav===x?"active":""}" onclick="setNav('${x}')">${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}</nav><div class="user"><div class="avatar">J</div><span>Josh</span></div></header>`}
function genreList(){return [...new Set(movies.flatMap(m=>(m.genre||"").split(/\s*[·,/&]\s*/).map(x=>x.trim()).filter(Boolean)))].sort()}
function filterActive(key){const v=state[key];return Array.isArray(v)?v.length>0:Boolean(v)}
function filterChip(label,key){return filterActive(key)?`<button class="filter-clear" title="Clear ${label}" aria-label="Clear ${label}" onclick="clearOneFilter('${key}')">×</button>`:""}
function userOptions(users,selected,placeholder){return `<option value="">${placeholder}</option>${users.map(p=>`<option value="${p}" ${selected===p?"selected":""}>${p===currentUser?p+" (you)":p}</option>`).join("")}`}
function advancedFilterPanel(){
 const genres=genreList(),years=movies.map(m=>Number(m.year)).filter(y=>Number.isFinite(y)&&y>0),minYear=years.length?Math.min(...years):1888,maxYear=years.length?Math.max(...years):new Date().getFullYear();
 const suggesters=[...new Set(movies.map(m=>m.suggestedBy||m.addedBy||(m.note?"Josh":"")).filter(Boolean))].sort();
 const seenUsers=[...new Set(movies.flatMap(m=>m.seen||[]))].sort((a,b)=>a===currentUser?-1:b===currentUser?1:a.localeCompare(b));
 const rewatchUsers=[...new Set(movies.filter(m=>m.watched||m.watchedBy?.length).flatMap(m=>m.watchedBy||[]))].sort((a,b)=>a===currentUser?-1:b===currentUser?1:a.localeCompare(b));
 const selected=state.genreFilters||[];
 return `<div class="filter-panel">
 <button class="filter-all" onclick="clearAllFilters()">All movies</button>
 <div class="filter-control"><details class="filter-dropdown"><summary>Genre(s) ▾ ${selected.length?`<span class="filter-count">${selected.length}</span>`:""} </summary><div class="filter-menu"><div class="filter-options">${genres.map(g=>`<label><input type="checkbox" ${selected.includes(g)?"checked":""} onchange="toggleGenre(this.value,this.checked)" value="${g.replace(/&/g,"&amp;").replace(/"/g,"&quot;")}"> ${g}</label>`).join("")}</div></div></details>${filterChip("Genre(s)","genreFilters")}</div>
 <div class="filter-control"><details class="filter-dropdown"><summary>Release year (range) ▾</summary><div class="filter-menu"><div class="filter-two-col"><label>From<input type="number" min="${minYear}" max="${maxYear}" placeholder="${minYear}" value="${state.yearFrom||""}" onchange="setYear('from',this.value)"></label><label>To<input type="number" min="${minYear}" max="${maxYear}" placeholder="${maxYear}" value="${state.yearTo||""}" onchange="setYear('to',this.value)"></label></div><small>Available years: ${minYear}–${maxYear}</small></div></details>${filterChip("Release year","yearFrom")}${filterActive("yearTo")?'<button class="filter-clear" title="Clear year range" onclick="clearOneFilter(\'yearTo\')">×</button>':""}</div>
 <div class="filter-control"><details class="filter-dropdown"><summary>Suggested by ▾</summary><div class="filter-menu"><select class="filter-select" onchange="setSuggestedBy(this.value)">${userOptions(suggesters,state.suggestedBy,"Any user")}</select></div></details>${filterChip("Suggested by","suggestedBy")}</div>
 <div class="filter-control"><details class="filter-dropdown"><summary>Interest level ▾</summary><div class="filter-menu"><div class="filter-two-col"><label>User<select onchange="setInterestUser(this.value)">${userOptions(serverUsers,state.interestUser,"Choose user")}</select></label><label>Interest<select onchange="setInterestLevel(this.value)"><option value="">Choose level</option>${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([v,l])=>`<option value="${v}" ${state.interestLevel===v?"selected":""}>${l}</option>`).join("")}</select></label></div></div></details>${filterChip("Interest level","interestUser")}${filterActive("interestLevel")?'<button class="filter-clear" title="Clear interest level" onclick="clearOneFilter(\'interestLevel\')">×</button>':""}</div>
 <div class="filter-control"><details class="filter-dropdown"><summary>Seen by ▾</summary><div class="filter-menu"><div class="filter-two-col"><label>Mode<select onchange="setSeenMode(this.value)"><option value="seen" ${state.seenMode!=="not"?"selected":""}>Seen by</option><option value="not" ${state.seenMode==="not"?"selected":""}>Not seen by</option></select></label><label>Users<details class="filter-dropdown filter-nested"><summary>${(state.seenUsers||[]).length?state.seenUsers.length+" selected":"Choose users"}</summary><div class="filter-options">${seenUsers.map(p=>`<label><input type="checkbox" ${(state.seenUsers||[]).includes(p)?"checked":""} onchange="toggleSeenUser(this.value,this.checked)" value="${p}">${p===currentUser?p+" (you)":p}</label>`).join("")}</div></details></label></div></div></details>${filterChip("Seen by","seenUsers")}${filterActive("seenUsers")&&state.seenMode==="not"?'<button class="filter-clear" title="Clear seen mode" onclick="clearOneFilter(\'seenMode\')">×</button>':""}</div>
 <div class="filter-control"><details class="filter-dropdown"><summary>Rewatch ▾</summary><div class="filter-menu"><div class="filter-options">${rewatchUsers.map(p=>`<label><input type="checkbox" ${(state.rewatchUsers||[]).includes(p)?"checked":""} onchange="toggleRewatchUser(this.value,this.checked)" value="${p}">${p===currentUser?p+" (you)":p}</label>`).join("")||"<small>No group watch history yet.</small>"}</div></div></details>${filterChip("Rewatch","rewatchUsers")}</div>
 </div>`
}
function toolbar(){return `<div class="toolbar"><input id="search" class="search" placeholder="Search movies..." value="${state.search}"><button class="icon ${state.view==="list"?"active":""}" onclick="setView('list')">☷ <span>List</span></button><button class="icon ${state.view==="grid"?"active":""}" onclick="setView('grid')"><svg class="toolbar-icon-svg" viewBox="0 0 18 18" aria-hidden="true">${Array.from({length:9},(_,i)=>`<rect x="${(i%3)*6+1}" y="${Math.floor(i/3)*6+1}" width="4" height="4" rx=".7"></rect>`).join("")}</svg><span>Grid</span></button><button class="ghost filter-button" onclick="toggleFilters()"><svg class="filter-icon-svg" viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 4.5h15L12 10.5v4.1l-3.9 1.9v-6Z"></path></svg><span>Filters</span></button>${state.view==="grid"?`<input class="range" id="sizeRange" type="range" min="1" max="4" step="1" value="${state.posterSize}" aria-label="Poster size">`:""}</div>${advancedFilterPanel()}`}
function stack(v){return `<div class="stack">${v.map(([n,c])=>`<div class="ring ${c}" title="${n}">${n.slice(0,2).toUpperCase()}</div>`).join("")}</div>`}
function responseButtons(m,compact=false){const mine=currentVote(m.id);return `<div class="quick-votes ${compact?"compact":""}" onclick="event.stopPropagation()">${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([k,l])=>`<button class="quick-vote quick-${k} ${mine===k?"selected":""}" onclick="vote('${m.id}','${k}')" title="${l}" aria-label="${l}">${compact?({must:"Must Watch",interested:"Interested",watch:"I'd Watch",no:"Not Interested"}[k]):l}</button>`).join("")}</div>`}
function listView(items,historyMode=false){return `<div class="list">${items.map((m,i)=>{const mine=currentVote(m.id);return `<article class="row ${mine==="no"?"not-interested-row":""} ${historyMode?"history-row":""}" data-movie-id="${m.id}">${historyMode?"":`<div class="rank">${i<5?rankSticker(i+1,"list-rank-sticker"):`#${i+1}`}</div>`}<div class="list-vhs" aria-hidden="true"><div class="vhs-stage">${caseFaces(m,"","list-vhs-inner")}</div></div><div onclick="openMovie('${m.id}')" style="cursor:pointer"><div class="title">${m.title}</div><div class="meta">${m.year} · ${m.genre} · ${m.director}</div>${historyMode?"":responseButtons(m,true)}</div><div>${historyMode?stack((m.watchedBy||[]).map(n=>[n,"green"])):stack(voterEntries(m))}</div><div class="seen">${m.seen.includes("Josh")?"◉ Seen":"○ Not seen"}</div></article>`}).join("")}</div>`}
function caseFaces(m, backHtml, extraClass=""){
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
  const frontLogo=logo?`<div class="vhs-front-logo${assets.frontLogoVisible===false?" asset-logo-hidden":""}" style="--front-logo-size:${Number.isFinite(Number(assets.frontLogoSize))?Number(assets.frontLogoSize):22}%;--front-logo-bottom:${Number.isFinite(Number(assets.frontLogoBottom))?Number(assets.frontLogoBottom):6}%;--front-logo-image:url("${logo}")" aria-hidden="true">${logoMarkup}</div>`:"";
  const spineMarkup=logo?`<img class="vhs-spine-logo" src="${logo}" alt="" aria-hidden="true">`:`<span class="spine-label">${m.title}</span>`;
  const style=`--poster-art:url("${frontImage}");--backdrop-art:url("${backdrop}")`;
  const objectPosition=`object-position:${Number.isFinite(Number(assets.frontImageX))?100-Number(assets.frontImageX):50}% ${Number.isFinite(Number(assets.frontImageY))?Number(assets.frontImageY):50}%`;
  return `<div class="vhs-inner ${extraClass}" style="${style}">
    <div class="vhs-front">${m.watched?"":rankSticker(rankOf(m))}<img src="${frontImage}" alt="${m.title}" style="${objectPosition}">${frontLogo}</div>
    <div class="vhs-back"><img class="vhs-back-art" src="${backdrop}" alt="" aria-hidden="true" style="object-position:${Number.isFinite(Number(assets.backStillX))?100-Number(assets.backStillX):50}% ${Number.isFinite(Number(assets.backStillY))?Number(assets.backStillY):50}%"><div class="vhs-back-scroll">${logo&&window.TMDB?`<div class="vhs-back-logo">${logoMarkup}</div>`:""}${backHtml}</div></div>
    <div class="vhs-side vhs-right">${spineMarkup}</div>
    <div class="vhs-side vhs-left">${spineMarkup}</div><div class="vhs-side vhs-top"></div><div class="vhs-side vhs-bottom"></div>
  </div>`;
}
function externalRatings(m){
  const rt=m.rottenTomatoesScore??m.rtScore??m.rottenTomatoes;
  const imdb=m.imdbScore??m.imdbRating;
  const parts=[];
  if(rt!==undefined&&rt!==null&&rt!=="")parts.push(`RT ${rt}%`);
  if(imdb!==undefined&&imdb!==null&&imdb!=="")parts.push(`IMDb ${imdb}`);
  return parts.length?`<div class="external-ratings">${parts.map(x=>`<span class="pill">${x}</span>`).join("")}`:"";
}
function backContent(m){
 return `
 <div class="meta">${m.year} · ${m.genre}</div><div class="meta">${m.director} · ${m.runtime}</div>
 ${state.showSynopsis?`<p>${m.synopsis}</p>`:""}
 ${m.rating?`<span class="pill">Rating ${m.rating}</span>`:""}
 ${state.showRatings?externalRatings(m):""}
 <div class="back-warnings">${m.warnings.map(w=>`<span class="pill">⚠ ${w}</span>`).join("")}</div>`;
}
function caseArticle(m,extra=""){const notInterested=currentVote(m.id)==="no";return `<article class="vhs ${extra} ${notInterested?"not-interested-card":""}" data-vhs="${m.id}" data-movie-id="${m.id}"><div class="vhs-stage" onclick="toggleCase(event,this.parentElement)">${caseFaces(m,backContent(m))}</div><div class="grid-title" data-open-movie="${m.id}" onclick="event.stopPropagation();openMovie(this.dataset.openMovie)">${m.title}</div><div class="grid-meta" data-open-movie="${m.id}" onclick="event.stopPropagation();openMovie(this.dataset.openMovie)">${m.year} · ${m.genre}</div>${responseButtons(m,true)}</article>`}
function gridView(items,historyMode=false){return `<div class="grid" style="--grid-cols:${[12,8,6,5][state.posterSize-1]||8}">${items.map(m=>caseArticle(m,historyMode?"history-movie":"")).join("")}</div>`}
function applyAdvancedFilters(items){let a=items.slice();const genres=state.genreFilters||[];if(genres.length)a=a.filter(m=>genres.every(g=>(m.genre||"").split(/\\s*[·,/&]\\s*/).map(x=>x.trim()).includes(g)));if(state.yearFrom)a=a.filter(m=>Number(m.year)>=Number(state.yearFrom));if(state.yearTo)a=a.filter(m=>Number(m.year)<=Number(state.yearTo));if(state.interestUser&&state.interestLevel)a=a.filter(m=>{const p=state.interestUser;const raw=p===currentUser?currentVote(m.id):(m.voters||[]).find(([n])=>n===p)?.[1];if(p===currentUser)return raw===state.interestLevel;return state.interestLevel==="must"||state.interestLevel==="interested"?raw==="green":state.interestLevel==="watch"?raw==="yellow":raw==="red"});if(state.seenUsers?.length)a=a.filter(m=>{const has=state.seenUsers.some(p=>(m.seen||[]).includes(p));return state.seenMode==="not"?!has:has});if(state.rewatchUsers?.length)a=a.filter(m=>(m.watchedBy||[]).some(p=>state.rewatchUsers.includes(p)));if(state.suggestedBy)a=a.filter(m=>(m.suggestedBy||m.addedBy||(m.note?"Josh":""))===state.suggestedBy);return a}
function watchlist(){
 let a=movies.filter(m=>!m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));
 a=applyAdvancedFilters(a);a.sort((x,y)=>y.score-x.score);
 return `<div class="hero"><div><div class="eyebrow">YOUR SERVER'S MOVIE LIBRARY</div><h1>Watchlist</h1><p class="sub">${a.length} movies waiting for a movie night.</p></div><button class="primary" onclick="openAddMovie()">＋ Add movie</button></div>${toolbar()}${a.length?(state.view==="list"?listView(a,false):gridView(a,false)):`<div class="empty">Nothing matches those filters.</div>`}`;
}
function history(){let a=movies.filter(m=>m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));a=applyAdvancedFilters(a);return `<div class="hero"><div><div class="eyebrow">THE GROUP ARCHIVE</div><h1>History</h1><p class="sub">Movies you've watched together, kept around so nobody has to remember.</p></div></div>${toolbar()}${a.length?(state.view==="list"?listView(a,true):gridView(a,true)):`<div class="empty">Nothing matches your filters.</div>`}`}
function personVote(m,p){if(p==="Josh"){const mine=currentVote(m.id);if(mine)return {must:"green",interested:"green",watch:"yellow",no:"red"}[mine]||null}const v=m.voters.find(([n])=>n===p);return v?v[1]:null}
function people(){return `<div class="hero"><div><div class="eyebrow">THE SERVER</div><h1>People</h1><p class="sub">Who's in the group and what they're interested in.</p></div></div><div class="settings">${["Josh","Sarah","Dan","Sam","Alex"].map(p=>{const unseen=movies.filter(m=>!m.seen.includes(p));const relevant=unseen.filter(m=>{const v=personVote(m,p);return !v||v!=="red"});const interested=relevant.filter(m=>personVote(m,p));const suggested=unseen.filter(m=>p==="Josh"&&m.note);return `<div class="setting person-card" data-person="${p}" onclick="togglePerson('${p}')" style="cursor:pointer"><div style="display:flex;gap:13px;align-items:center"><div class="avatar">${p.slice(0,2)}</div><div><strong>${p}</strong><span>Interested in ${interested.length} · Hasn't seen ${relevant.length} · Suggested ${suggested.length}</span></div></div></div>`}).join("")}</div>`}
function settings(){let rows=[["Show synopsis","Show movie synopses on cards and details.","showSynopsis"],["Show RT/IMDb scores","Show Rotten Tomatoes and IMDb scores when available.","showRatings"],["Show suggester's note","Show personal notes attached to suggestions on Details screens.","showNote"],["Show trailers","Allow trailers to appear in details.","showTrailer"]];return `<div class="hero"><div><div class="eyebrow">YOUR PREFERENCES</div><h1>Settings</h1><p class="sub">Control how much pre-watch information The Watchlist shows you.</p></div></div><div class="settings">${rows.map(([a,b,k])=>`<div class="setting"><div><strong>${a}</strong><span>${b}</span></div><button class="toggle ${state[k]?"on":""}" onclick="toggleSetting('${k}')" aria-label="Toggle ${a}"></button></div>`).join("")}<div class="setting"><div><strong>Content warnings</strong><span>Choose which warning categories you want surfaced.</span></div><button class="ghost" onclick="alert('Warning category picker comes next.')">Choose</button></div></div>`}
function ratingStars(value,interactive=false){const rating=Math.max(0,Math.min(5,Number(value)||0));let html='<div class="review-stars'+(interactive?' interactive':'')+'">';for(let i=0;i<5;i++){const fill=Math.round(Math.max(0,Math.min(1,rating-i))*2)/2;const pct=fill*100;const tag=interactive?'button':'span';const attrs=interactive?' class="rating-star" onclick="setReviewRating(event,'+i+')"':' class="rating-star"';html+='<'+tag+attrs+'><span class="star-gradient" style="--star-fill:'+pct+'%">★</span></'+tag+'>'}return html+'</div>'}
function movieReviewsSection(m){if(!m.watched)return "";const reviews=movieReviews[m.id]||{};const mine=reviews[currentUser]||{};let html='<section class="review-section" data-rating="'+(mine.rating||0)+'"><div class="review-heading"><div><div class="eyebrow">AFTER THE WATCH</div><h3>Reviews</h3></div><span class="review-count">'+Object.keys(reviews).length+'</span></div><div class="review-form"><div class="review-form-label">Your rating</div>'+ratingStars(mine.rating||0,true)+'<textarea id="reviewText" class="review-text" rows="3" placeholder="What did you think?">'+(mine.review||"")+'</textarea><div class="review-form-actions"><button class="primary" onclick="saveReview(\''+m.id+'\')">'+(mine.rating||mine.review?"Update review":"Add review")+'</button></div></div>';Object.entries(reviews).forEach(([name,r])=>{html+='<article class="review-card"><div class="review-card-head"><div class="review-author"><span class="avatar">'+name.slice(0,2)+'</span><strong>'+name+'</strong></div>'+ratingStars(r.rating||0)+'</div>'+(r.review?'<div class="review-body">'+r.review+'</div>':"")+'</article>'});return html+'</section>'}
function detail(){
 let m=movies.find(x=>x.id===state.detail);
 if(!m)return '<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div><button class="ghost" onclick="setNav(\'watchlist\')">← Back</button></div><section class="detail"><p class="muted">Movie not found.</p></section>';
 let selected=currentVote(m.id);
 return `<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div><button class="ghost" onclick="setNav('watchlist')">← Back</button></div>
 <section class="detail ${m.watched?"history-detail":""}">
   <div class="detail-cover-column"><div class="detail-vhs" data-vhs="${m.id}" onclick="toggleCase(event,this)" title="Click the VHS case to flip it"><div class="vhs-stage">${caseFaces(m,backContent(m))}</div></div>${canEditCaseAssets()&&m.tmdbId?`<button class="watched-together-button artwork-button" onclick="openAssetEditor('${m.id}')">✎ Customize case artwork</button>`:""}</div>
   <div>
    <div class="eyebrow" style="${m.watched?"display:none":""}">CURRENT RANK #${rankOf(m)}</div><div class="detail-title-row"><h2>${detailLogoPath(m)&&window.TMDB?'<img class="detail-logo" src="'+TMDB.image(detailLogoPath(m),"w300")+'" alt="'+m.title+'">':'<span>'+m.title+'</span>'}</h2><button class="seen-button ${m.seen.includes("Josh")?"on":"off"}" data-movie-id="${m.id}" onclick="toggleSeen(this.dataset.movieId)" aria-label="${m.seen.includes("Josh")?"Mark as not seen":"Mark as seen"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6-9.8-6-9.8-6Z"/><circle cx="12" cy="12" r="2.8"/></svg><span class="seen-slash"></span><span>${m.seen.includes("Josh")?"I have seen this":"I have not seen this"}</span></button></div><div class="meta">${m.year} · ${m.genre} · ${m.director} · ${m.runtime}</div>${m.rating?`<div class="detail-board-rating">Rating ${m.rating}</div>`:""}
    <div class="people-strip"><div class="people-strip-label">${m.watched?"WHO WATCHED":"RESPONSES"}</div>${m.watched?stack((m.watchedBy||[]).map(n=>[n,"green"])):stack(voterEntries(m))}</div>
    <div class="vote-box"><div class="vote-label">Your response</div><div class="votes">${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([k,l])=>`<button class="vote vote-${k} ${selected===k?"selected":""}" onclick="vote('${m.id}','${k}')">${l}</button>`).join("")}</div></div>
    ${state.showSynopsis?`<p class="detail-synopsis">${m.synopsis}</p>`:""}
    ${state.showNote&&m.note?`<div class="detail-note"><div class="detail-note-label"><span class="avatar">J</span><span>Suggested by Josh</span></div><div class="detail-note-text">${m.note}</div></div>`:""}
    ${m.watched?`<div class="history-actions"><button class="watched-together-button" onclick="editWatchedBy(\'${m.id}\')">✎ Edit who watched</button><button class="watched-together-button" onclick="watchAgain(\'${m.id}\')">↻ Watch again</button></div>`:(m.addedBy===currentUser?`<button class="watched-together-button" onclick="markWatchedTogether(\'${m.id}\',false)">✓ Mark watched together</button>`:"")}
    ${movieReviewsSection(m)}
   </div>
 </section>`;
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
function render(){app.innerHTML=header()+`<main class="content">${state.nav==="watchlist"?watchlist():state.nav==="history"?history():state.nav==="people"?people():state.nav==="settings"?settings():detail()}</main>`+addMovieModal()+attendanceModal()+assetEditor();bindLiveInputs();bindVhsTilt()}
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
window.confirmAddMovie=()=>{const d=state.addMovieSelection;if(!d?.tmdbId)return;const normalizeTitle=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ");const duplicate=movies.some(m=>m.tmdbId===d.tmdbId||(normalizeTitle(m.title)===normalizeTitle(d.title)&&String(m.year)===String(d.year||"")));if(duplicate){state.addMovieError="Already in watchlist";return render()}const note=(document.querySelector("#addMovieNote")?.value||"").trim();const movie={id:"tmdb-"+d.tmdbId,title:d.title,year:d.year||"",genre:(d.genre||[]).join(" · "),director:(d.director||[]).join(", "),runtime:d.runtime?formatRuntime(d.runtime):"",rating:d.rating||"",score:0,seen:[],voters:[],synopsis:d.synopsis||"",note,warnings:[],watched:false,suggestedBy:"Josh",addedBy:currentUser,tmdbId:d.tmdbId,posterPath:d.posterPath||null,textlessPosterPath:d.textlessPosterPath||null,backdropPath:d.backdropPath||null,logoPath:d.logoPath||null};movies.push(movie);try{localStorage.setItem("watchlist-added-movies",JSON.stringify(movies.filter(m=>m.id.startsWith("tmdb-"))));}catch(error){}state.addMovieOpen=false;state.addMovieSelection=null;state.addMovieError="";render()};

window.openAssetEditor=async id=>{
  if(!canEditCaseAssets()||state.nav!=="detail"||state.detail!==id)return;
  state.assetMovieId=id;state.assetEditorOpen=true;state.assetLoading=true;state.assetError="";render();
  const m=movies.find(x=>x.id===id);
  try{
    if(!m?.tmdbId)throw new Error("This movie is not linked to TMDB.");
    const data=await TMDB.details(m.tmdbId);
    TMDB.apply(m,data);
  }catch(error){state.assetError=error.message||"Could not load TMDB artwork."}
  finally{state.assetLoading=false;render()}
};
window.closeAssetEditor=()=>{state.assetEditorOpen=false;state.assetMovieId=null;state.assetLoading=false;render()};
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
  savedCaseAssets[m.id]=a;saveCaseAssets();

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
  saveCaseAssets();
  const live=document.querySelector("[data-asset-preview] .vhs-inner");
  const logo=live?.querySelector(".vhs-front-logo");
  if(logo)logo.classList.toggle("asset-logo-hidden",!next);
  if(button)button.classList.toggle("on",next);
};
window.setAssetDraft=(field,value)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const a=savedCaseAssets[m.id]||{};
  a[field]=field==="frontLogoVisible"?Boolean(value):Number(value);
  savedCaseAssets[m.id]=a;saveCaseAssets();

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
window.setNav=x=>{state.nav=x;state.detail=null;render()};window.setView=x=>{state.view=x;render()};window.toggleFilters=()=>{state.showFilters=!state.showFilters;render()};window.setFilter=x=>{state.filter=x;render()};window.setPosterSize=x=>{state.posterSize=Math.max(1,Math.min(4,Math.round(Number(x)||1)));const cols=[12,8,6,5][state.posterSize-1];document.querySelectorAll(".grid").forEach(e=>e.style.setProperty("--grid-cols",cols));document.querySelectorAll(".range").forEach(e=>e.value=state.posterSize);requestAnimationFrame(()=>bindVhsTilt())};window.toggleSetting=k=>{state[k]=!state[k];render()};window.openMovie=id=>{const movie=movies.find(x=>x.id===id);if(!movie)return;state.detail=movie.id;state.nav="detail";render();window.scrollTo({top:0,behavior:"smooth"})};window.togglePerson=p=>{const card=document.querySelector('[data-person="'+p+'"]');if(!card)return;const old=card.querySelector('.person-details');if(old){old.remove();return}const notSeen=movies.filter(m=>{if(m.seen.includes(p))return false;const v=personVote(m,p);return !v||v!=="red"});const interests=notSeen.filter(m=>personVote(m,p));const suggested=movies.filter(m=>p==="Josh"&&!m.seen.includes(p)&&m.note);const row=(m,label,cls)=>'<button type="button" class="person-movie" onclick="event.stopPropagation();openMovie(this.dataset.id)" data-id="'+m.id+'"><span>'+m.title+'</span><span class="'+cls+'">'+label+'</span></button>';const details=document.createElement("div");details.className="person-details";details.innerHTML='<div><div class="person-section-label">INTERESTED IN WATCHING</div><div class="person-movies">'+(interests.map(m=>{const v=personVote(m,p);const label=v==="green"?"Interested":v==="yellow"?"I’d Watch":"Not Interested";return row(m,label,"person-interest "+v)}).join("")||'<div class="person-empty">No interest responses yet.</div>')+'</div></div><div><div class="person-section-label">HASN\'T SEEN</div><div class="person-movies">'+(notSeen.map(m=>row(m,"Not seen","person-seen")).join("")||'<div class="person-empty">No movies left unseen.</div>')+'</div></div>'+(suggested.length?'<div><div class="person-section-label">SUGGESTED</div><div class="person-movies">'+suggested.map(m=>row(m,"Suggestion","person-seen")).join("")+'</div></div>':"");card.appendChild(details)};
window.toggleGenre=(g,on)=>{state.genreFilters=on?[...new Set([...(state.genreFilters||[]),g])]: (state.genreFilters||[]).filter(x=>x!==g);render()};
window.setYear=(which,value)=>{const years=movies.map(m=>Number(m.year)).filter(y=>Number.isFinite(y)&&y>0),min=years.length?Math.min(...years):1888,max=years.length?Math.max(...years):new Date().getFullYear();let n=value===""?"":Math.max(min,Math.min(max,Number(value)));state[which==="from"?"yearFrom":"yearTo"]=n===""?"":String(n);render()};
window.setInterestUser=x=>{state.interestUser=x;render()};window.setInterestLevel=x=>{state.interestLevel=x;render()};
window.setSeenMode=x=>{state.seenMode=x;render()};
window.toggleSeenUser=(p,on)=>{state.seenUsers=on?[...new Set([...(state.seenUsers||[]),p])]: (state.seenUsers||[]).filter(x=>x!==p);render()};
window.toggleRewatchUser=(p,on)=>{state.rewatchUsers=on?[...new Set([...(state.rewatchUsers||[]),p])]: (state.rewatchUsers||[]).filter(x=>x!==p);render()};
window.setSuggestedBy=x=>{state.suggestedBy=x;render()};
window.clearOneFilter=key=>{if(key==="yearFrom"||key==="yearTo"){state.yearFrom="";state.yearTo=""}else if(key==="interestUser"||key==="interestLevel"){state.interestUser="";state.interestLevel=""}else if(key==="seenUsers"){state.seenUsers=[];state.seenMode="seen"}else if(key==="seenMode"){state.seenMode="seen"}else state[key]=Array.isArray(state[key])?[]:"";render()};
window.clearAllFilters=()=>{state.genreFilters=[];state.yearFrom="";state.yearTo="";state.interestUser="";state.interestLevel="";state.seenMode="seen";state.seenUsers=[];state.rewatchUsers=[];state.suggestedBy="";state.filter="all";state.search="";render()};
window.resetAdvancedFilters=window.clearAllFilters;
window.vote=(id,k)=>{const old=state.votes[id];if(old===k)return;const before=new Map([...document.querySelectorAll("[data-movie-id]")].map(el=>[el.dataset.movieId,el.getBoundingClientRect()]));const weights={must:5,interested:3,watch:1,no:0};const m=movies.find(x=>x.id===id);m.score=baseScores[id]+weights[k];state.votes[id]=k;render();requestAnimationFrame(()=>{document.querySelectorAll("[data-movie-id]").forEach(el=>{const first=before.get(el.dataset.movieId);if(!first)return;const last=el.getBoundingClientRect();const dx=first.left-last.left,dy=first.top-last.top;if(Math.abs(dx)+Math.abs(dy)>1){el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:420,easing:"cubic-bezier(.2,.75,.2,1)"})}})})};
window.toggleSeen=id=>{const m=movies.find(x=>x.id===id);if(!m)return;const i=m.seen.indexOf("Josh");if(i===-1)m.seen.push("Josh");else m.seen.splice(i,1);render()};
function attendanceDefaults(m){const selected=new Set();(m.voters||[]).forEach(([name,color])=>{if(color==="green"||color==="yellow")selected.add(name)});const mine=currentVote(m.id);if(mine&&mine!=="no")selected.add(currentUser);return serverUsers.filter(name=>selected.has(name))}
window.openAttendance=id=>{const m=movies.find(x=>x.id===id);if(!m)return;state.attendanceMovieId=id;state.attendanceSelected=(m.watchedBy&&m.watchedBy.length)?[...m.watchedBy]:attendanceDefaults(m);state.attendanceOpen=true;render()};
window.closeAttendance=()=>{state.attendanceOpen=false;state.attendanceMovieId=null;state.attendanceSelected=[];render()};
window.toggleAttendanceUser=(event,name)=>{event.preventDefault();const i=state.attendanceSelected.indexOf(name);if(i===-1)state.attendanceSelected.push(name);else state.attendanceSelected.splice(i,1);render()};
window.confirmAttendance=()=>{const id=state.attendanceMovieId;const m=movies.find(x=>x.id===id);if(!m)return;const chosen=[...state.attendanceSelected];m.watchedBy=chosen;if(!m.watched){m.watched=true;if(!watchedMovies.includes(id))watchedMovies.push(id);state.nav="history";state.detail=id}try{localStorage.setItem("watchlist-watched-movies",JSON.stringify(watchedMovies));localStorage.setItem("watchlist-watched-attendance",JSON.stringify(Object.fromEntries(movies.filter(x=>x.watched).map(x=>[x.id,x.watchedBy||[]]))))}catch(error){}state.attendanceOpen=false;state.attendanceMovieId=null;state.attendanceSelected=[];render()};
window.markWatchedTogether=(id,undo)=>{if(undo)return;openAttendance(id)};
window.watchAgain=id=>{const m=movies.find(x=>x.id===id);if(!m)return;m.watched=false;m.watchedBy=[];watchedMovies=watchedMovies.filter(x=>x!==id);try{localStorage.setItem("watchlist-watched-movies",JSON.stringify(watchedMovies));localStorage.setItem("watchlist-watched-attendance",JSON.stringify(Object.fromEntries(movies.filter(x=>x.watched).map(x=>[x.id,x.watchedBy||[]]))));}catch(error){}state.nav="watchlist";state.detail=null;render()};
window.editWatchedBy=id=>{const m=movies.find(x=>x.id===id);if(!m)return;openAttendance(id)};
window.setReviewRating=(event,index)=>{const button=event.currentTarget;const rect=button.getBoundingClientRect();const value=index+(event.clientX-rect.left<rect.width/2?.5:1);const section=document.querySelector(".review-section");if(section)section.dataset.rating=value;document.querySelectorAll(".review-form .rating-star .star-gradient").forEach((el,i)=>{const fill=Math.round(Math.max(0,Math.min(1,value-i))*2)/2;el.style.setProperty("--star-fill",fill*100+"%")});};
window.saveReview=id=>{const section=document.querySelector(".review-section");if(!section)return;const text=(document.querySelector("#reviewText")?.value||"").trim();const rating=Number(section.dataset.rating||0);if(!rating&&!text)return;movieReviews[id]=movieReviews[id]||{};movieReviews[id][currentUser]={rating,review:text};try{localStorage.setItem("watchlist-movie-reviews",JSON.stringify(movieReviews));}catch(error){}render()};
let tmdbHydrated=false;
async function hydrateTmdbArtwork(){
  if(tmdbHydrated||!window.TMDB)return;
  tmdbHydrated=true;
  for(const movie of movies){
    try{
      const search=await TMDB.search(movie.title);
      const exact=(search.results||[]).find(r=>r.year===movie.year)||search.results?.[0];
      if(!exact?.tmdbId)continue;
      const details=await TMDB.details(exact.tmdbId);
      TMDB.apply(movie,details);
    }catch(error){
      console.warn("TMDB hydration skipped for "+movie.title,error.message);
    }
  }
  render();
}
render();
hydrateTmdbArtwork();