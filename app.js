const fallback=(t,y)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#25282d"/><rect x="30" y="30" width="440" height="690" rx="12" fill="#17191c" stroke="#4a4f57"/><text x="250" y="350" fill="#e8e4da" font-family="Arial" font-size="38" font-weight="bold" text-anchor="middle">${t}</text><text x="250" y="400" fill="#9298a1" font-family="Arial" font-size="24" text-anchor="middle">${y}</text></svg>`)}`;

const seedMovies=[
{id:"alien",title:"Alien",year:1979,genre:"Horror · Sci-Fi",director:"Ridley Scott",runtime:"1h 57m",rating:"R",score:10,seen:["Josh"],voters:[["Josh","green"],["Sarah","green"],["Mike","yellow"]],synopsis:"The crew of a commercial spacecraft encounter a deadly lifeform after answering a mysterious distress signal.",note:"I don't think we've actually watched this together. Fix that.",warnings:["Gore","Body horror"],watched:false},
{id:"thing",title:"The Thing",year:1982,genre:"Horror · Sci-Fi",director:"John Carpenter",runtime:"1h 49m",rating:"R",score:8,seen:["Sarah"],voters:[["Josh","green"],["Sarah","yellow"],["Alex","red"]],synopsis:"A research team in Antarctica faces a lifeform capable of perfectly imitating other organisms.",note:"Been meaning to show you guys this for ages.",warnings:["Gore","Animal death"],watched:false},
{id:"scream",title:"Scream",year:1996,genre:"Horror · Mystery",director:"Wes Craven",runtime:"1h 51m",rating:"R",score:7,seen:["Josh","Alex"],voters:[["Josh","yellow"],["Mike","yellow"],["Alex","red"]],synopsis:"A masked killer turns a small town's horror-movie knowledge into a deadly game.",note:"A classic group-watch candidate.",warnings:["Violence","Sexual content"],watched:false},
{id:"predator",title:"Predator",year:1987,genre:"Action · Sci-Fi",director:"John McTiernan",runtime:"1h 47m",rating:"R",score:6,seen:[],voters:[["Josh","green"],["Sarah","yellow"]],synopsis:"An elite rescue team becomes prey for an extraterrestrial hunter in a Central American jungle.",note:"",warnings:["Gore","Violence"],watched:false},
{id:"tremors",title:"Tremors",year:1990,genre:"Horror · Comedy",director:"Ron Underwood",runtime:"1h 36m",rating:"PG-13",score:5,seen:["Mike"],voters:[["Mike","green"],["Alex","yellow"]],synopsis:"A tiny desert town is besieged by enormous underground creatures.",note:"",warnings:["Animal death"],watched:false},
{id:"event",title:"Event Horizon",year:1997,genre:"Horror · Sci-Fi",director:"Paul W. S. Anderson",runtime:"1h 36m",rating:"R",score:3,seen:["Sarah","Mike"],voters:[["Sarah","green"],["Alex","yellow"]],synopsis:"A rescue crew investigates a vanished spaceship and discovers something deeply wrong with its return.",note:"Maybe this one is a terrible idea. Which is exactly why I'm suggesting it.",warnings:["Gore","Disturbing imagery"],watched:true,watchedBy:["Josh","Sarah","Mike"]}
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
const serverUsers=["Josh","Sarah","Mike","Alex"];
const state={nav:"watchlist",view:"list",search:"",filter:"all",posterSize:2,showSynopsis:true,showRatings:false,showNote:true,showTrailer:false,detail:null,showFilters:false,votes:{},addMovieOpen:false,addMovieQuery:"",addMovieResults:[],addMovieSelection:null,addMovieLoading:false,addMovieError:"",attendanceOpen:false,attendanceMovieId:null,attendanceSelected:[],assetEditorOpen:false,assetMovieId:null,assetLoading:false,assetError:""};
const app=document.querySelector("#app");
let savedCaseAssets={};
try{savedCaseAssets=JSON.parse(localStorage.getItem("watchlist-case-assets")||"{}");}catch(error){savedCaseAssets={}}
// Temporary UI gate: once Discord auth exists, replace this with the authenticated Josh/Discord user ID check.\nfunction canEditCaseAssets(){return currentUser==="Josh"}
function caseAssets(m){return savedCaseAssets[m.id]||{}}
function saveCaseAssets(){try{localStorage.setItem("watchlist-case-assets",JSON.stringify(savedCaseAssets));}catch(error){}}
function assetDraft(m){const a=caseAssets(m);return {frontLogoPath:a.frontLogoPath!==undefined?a.frontLogoPath:(m.logoPath||null),frontLogoSize:Number(a.frontLogoSize)||22,frontLogoBottom:Number(a.frontLogoBottom)||6,detailLogoPath:a.detailLogoPath!==undefined?a.detailLogoPath:(m.logoPath||null),frontImagePath:a.frontImagePath!==undefined?a.frontImagePath:(m.textlessPosterPath||m.posterPath||null),frontImageX:Number(a.frontImageX)||50,frontImageY:Number(a.frontImageY)||50,backStillPath:a.backStillPath!==undefined?a.backStillPath:(m.backdropPath||null)}}

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
function header(){return `<header class="topbar"><button class="brand" onclick="setNav('watchlist');setView('list')" aria-label="Go to Watchlist"><div class="brand-mark">▶</div><span>THE WATCHLIST</span></button><nav class="nav">${["watchlist","history","people","settings"].map(x=>`<button class="${state.nav===x?"active":""}" onclick="setNav('${x}')">${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}</nav><div class="user"><div class="avatar">J</div><span>Josh</span></div></header>`}
function toolbar(){return `<div class="toolbar"><input id="search" class="search" placeholder="Search movies..." value="${state.search}"><button class="icon ${state.view==="list"?"active":""}" onclick="setView('list')">☷ List</button><button class="icon ${state.view==="grid"?"active":""}" onclick="setView('grid')">▦ Grid</button><button class="ghost" onclick="toggleFilters()">☷ Filters</button>${state.view==="grid"?`<input class="range" id="sizeRange" type="range" min="1" max="4" step="1" value="${state.posterSize}" aria-label="Poster size">`:``}</div>${state.showFilters?`<div class="filter-panel">${[["all","All movies"],["unwatched","Unwatched"],["nobody seen","Nobody has seen"],["I haven't seen","I haven't seen"],["not interested","I'm not interested"]].map(([f,l])=>`<button class="${state.filter===f?"active":""}" data-filter="${f}" onclick="setFilter(this.dataset.filter)">${l}</button>`).join("")}</div>`:""}`}
function stack(v){return `<div class="stack">${v.map(([n,c])=>`<div class="ring ${c}" title="${n}">${n.slice(0,2).toUpperCase()}</div>`).join("")}</div>`}
function responseButtons(m,compact=false){const mine=currentVote(m.id);return `<div class="quick-votes ${compact?"compact":""}" onclick="event.stopPropagation()">${[["must","Must Watch"],["interested","Interested"],["watch","I'd Watch"],["no","Not Interested"]].map(([k,l])=>`<button class="quick-vote quick-${k} ${mine===k?"selected":""}" onclick="vote('${m.id}','${k}')" title="${l}" aria-label="${l}">${compact?({must:"Must Watch",interested:"Interested",watch:"I'd Watch",no:"Not Interested"}[k]):l}</button>`).join("")}</div>`}
function listView(items,historyMode=false){return `<div class="list">${items.map((m,i)=>{const mine=currentVote(m.id);return `<article class="row ${mine==="no"?"not-interested-row":""} ${historyMode?"history-row":""}" data-movie-id="${m.id}">${historyMode?"":`<div class="rank">#${i+1}</div>`}<div class="list-vhs" aria-hidden="true"><div class="vhs-stage">${caseFaces(m,"","list-vhs-inner")}</div></div><div onclick="openMovie('${m.id}')" style="cursor:pointer"><div class="title">${m.title}</div><div class="meta">${m.year} · ${m.genre} · ${m.director}</div>${historyMode?"":responseButtons(m,true)}</div><div>${historyMode?stack((m.watchedBy||[]).map(n=>[n,"green"])):stack(voterEntries(m))}</div><div class="seen">${m.seen.includes("Josh")?"◉ Seen":"○ Not seen"}</div></article>`}).join("")}</div>`}
function caseFaces(m, backHtml, extraClass=""){
  const assets=caseAssets(m);
  const poster=m.posterPath&&window.TMDB?TMDB.image(m.posterPath,"w500"):fallback(m.title,m.year);
  const defaultPoster=m.textlessPosterPath&&window.TMDB?TMDB.image(m.textlessPosterPath,"w500"):poster;
  const frontPath=assets.frontImagePath||m.textlessPosterPath||m.posterPath||null;
  const frontImage=frontPath&&window.TMDB?TMDB.image(frontPath,"w500"):defaultPoster;
  const backPath=assets.backStillPath||m.backdropPath||m.posterPath||null;
  const backdrop=backPath&&window.TMDB?TMDB.image(backPath,"w780"):poster;
  const logoPath=assets.frontLogoPath!==undefined?assets.frontLogoPath:m.logoPath;
  const logo=logoPath&&window.TMDB?TMDB.image(logoPath,"w300"):"";
  const logoMarkup=logo?`<img class="vhs-logo" src="${logo}" alt="" aria-hidden="true">`:`<div class="vhs-logo-fallback">${m.title}</div>`;
  const frontLogo=logo?`<div class="vhs-front-logo" style="--front-logo-size:${Number(assets.frontLogoSize)||22}%;--front-logo-bottom:${Number(assets.frontLogoBottom)||6}%">${logoMarkup}</div>`:"";
  const spineMarkup=logo?`<img class="vhs-spine-logo" src="${logo}" alt="" aria-hidden="true">`:`<span class="spine-label">${m.title}</span>`;
  const style=`--poster-art:url("${frontImage}");--backdrop-art:url("${backdrop}")`;
  const objectPosition=`object-position:${Number(assets.frontImageX)||50}% ${Number(assets.frontImageY)||50}%`;
  return `<div class="vhs-inner ${extraClass}" style="${style}">
    <div class="vhs-front"><span class="rank-badge" style="${m.watched?"display:none":""}">#${rankOf(m)}</span><img src="${frontImage}" alt="${m.title}" style="${objectPosition}">${frontLogo}</div>
    <div class="vhs-back"><img class="vhs-back-art" src="${backdrop}" alt="" aria-hidden="true"><div class="vhs-back-scroll">${logo&&window.TMDB?`<div class="vhs-back-logo">${logoMarkup}</div>`:""}${backHtml}</div></div>
    <div class="vhs-side vhs-right">${spineMarkup}</div>
    <div class="vhs-side vhs-left">${spineMarkup}</div><div class="vhs-side vhs-top"></div><div class="vhs-side vhs-bottom"></div>
  </div>`;
}
function backContent(m){
 return `
 <div class="meta">${m.year} · ${m.genre}</div><div class="meta">${m.director} · ${m.runtime}</div>
 ${state.showSynopsis?`<p>${m.synopsis}</p>`:""}
 ${state.showRatings?`<span class="pill">Rating ${m.rating}</span>`:""}
 ${state.showNote&&m.note?`<div class="note">“${m.note}”</div>`:""}
 <div class="back-warnings">${m.warnings.map(w=>`<span class="pill">⚠ ${w}</span>`).join("")}</div>`;
}
function caseArticle(m,extra=""){return `<article class="vhs ${extra}" data-vhs="${m.id}" data-movie-id="${m.id}"><div class="vhs-stage" onclick="toggleCase(event,this.parentElement)">${caseFaces(m,backContent(m))}</div><div class="grid-title" onclick="event.stopPropagation();openMovie('${m.id}')">${m.title}</div><div class="grid-meta" onclick="event.stopPropagation();openMovie('${m.id}')">${m.year} · ${m.genre}</div>${responseButtons(m,true)}</article>`}
function gridView(items,historyMode=false){return `<div class="grid" style="--grid-cols:${[12,8,6,5][state.posterSize-1]||8}">${items.map(m=>caseArticle(m,historyMode?"history-movie":"")).join("")}</div>`}
function watchlist(){
 let a=movies.filter(m=>!m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));
 if(state.filter==="nobody seen")a=a.filter(m=>!m.seen.length);
 if(state.filter==="I haven't seen")a=a.filter(m=>!m.seen.includes("Josh"));
 if(state.filter==="not interested")a=a.filter(m=>currentVote(m.id)==="no");
 a.sort((x,y)=>y.score-x.score);
 return `<div class="hero"><div><div class="eyebrow">YOUR SERVER'S MOVIE LIBRARY</div><h1>Watchlist</h1><p class="sub">${a.length} movies waiting for a movie night.</p></div><button class="primary" onclick="openAddMovie()">＋ Add movie</button></div>${toolbar()}${a.length?(state.view==="list"?listView(a,false):gridView(a,false)):`<div class="empty">Nothing matches those filters.</div>`}`;
}
function history(){const a=movies.filter(m=>m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));return `<div class="hero"><div><div class="eyebrow">THE GROUP ARCHIVE</div><h1>History</h1><p class="sub">Movies you've watched together, kept around so nobody has to remember.</p></div></div>${toolbar()}${a.length?(state.view==="list"?listView(a,true):gridView(a,true)):`<div class="empty">Nothing matches your search.</div>`}` }
function personVote(m,p){if(p==="Josh"){const mine=currentVote(m.id);if(mine)return {must:"green",interested:"green",watch:"yellow",no:"red"}[mine]||null}const v=m.voters.find(([n])=>n===p);return v?v[1]:null}
function people(){return `<div class="hero"><div><div class="eyebrow">THE SERVER</div><h1>People</h1><p class="sub">Who's in the group and what they're interested in.</p></div></div><div class="settings">${["Josh","Sarah","Mike","Alex"].map(p=>{const unseen=movies.filter(m=>!m.seen.includes(p));const relevant=unseen.filter(m=>{const v=personVote(m,p);return !v||v!=="red"});const interested=relevant.filter(m=>personVote(m,p));const suggested=unseen.filter(m=>p==="Josh"&&m.note);return `<div class="setting person-card" data-person="${p}" onclick="togglePerson('${p}')" style="cursor:pointer"><div style="display:flex;gap:13px;align-items:center"><div class="avatar">${p.slice(0,2)}</div><div><strong>${p}</strong><span>Interested in ${interested.length} · Hasn't seen ${relevant.length} · Suggested ${suggested.length}</span></div></div></div>`}).join("")}</div>`}
function settings(){let rows=[["Show synopsis","Show movie synopses on cards and details.","showSynopsis"],["Show ratings","Show external ratings when available.","showRatings"],["Show suggester's note","Show personal notes attached to suggestions.","showNote"],["Show trailers","Allow trailers to appear in details.","showTrailer"]];return `<div class="hero"><div><div class="eyebrow">YOUR PREFERENCES</div><h1>Settings</h1><p class="sub">Control how much pre-watch information The Watchlist shows you.</p></div></div><div class="settings">${rows.map(([a,b,k])=>`<div class="setting"><div><strong>${a}</strong><span>${b}</span></div><button class="toggle ${state[k]?"on":""}" onclick="toggleSetting('${k}')" aria-label="Toggle ${a}"></button></div>`).join("")}<div class="setting"><div><strong>Content warnings</strong><span>Choose which warning categories you want surfaced.</span></div><button class="ghost" onclick="alert('Warning category picker comes next.')">Choose</button></div><div class="setting"><div><strong>Default poster size</strong><span>Used by the poster grid.</span></div><input class="range" type="range" min="1" max="4" step="1" value="${state.posterSize}" oninput="setPosterSize(this.value)"></div></div>`}
function ratingStars(value,interactive=false){const rating=Math.max(0,Math.min(5,Number(value)||0));let html='<div class="review-stars'+(interactive?' interactive':'')+'">';for(let i=0;i<5;i++){const fill=Math.round(Math.max(0,Math.min(1,rating-i))*2)/2;const pct=fill*100;const tag=interactive?'button':'span';const attrs=interactive?' class="rating-star" onclick="setReviewRating(event,'+i+')"':' class="rating-star"';html+='<'+tag+attrs+'><span class="star-gradient" style="--star-fill:'+pct+'%">★</span></'+tag+'>'}return html+'</div>'}
function movieReviewsSection(m){if(!m.watched)return "";const reviews=movieReviews[m.id]||{};const mine=reviews[currentUser]||{};let html='<section class="review-section" data-rating="'+(mine.rating||0)+'"><div class="review-heading"><div><div class="eyebrow">AFTER THE WATCH</div><h3>Reviews</h3></div><span class="review-count">'+Object.keys(reviews).length+'</span></div><div class="review-form"><div class="review-form-label">Your rating</div>'+ratingStars(mine.rating||0,true)+'<textarea id="reviewText" class="review-text" rows="3" placeholder="What did you think?">'+(mine.review||"")+'</textarea><div class="review-form-actions"><button class="primary" onclick="saveReview(\''+m.id+'\')">'+(mine.rating||mine.review?"Update review":"Add review")+'</button></div></div>';Object.entries(reviews).forEach(([name,r])=>{html+='<article class="review-card"><div class="review-card-head"><div class="review-author"><span class="avatar">'+name.slice(0,2)+'</span><strong>'+name+'</strong></div>'+ratingStars(r.rating||0)+'</div>'+(r.review?'<div class="review-body">'+r.review+'</div>':"")+'</article>'});return html+'</section>'}
function detail(){
 let m=movies.find(x=>x.id===state.detail), selected=currentVote(m.id);
 return `<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div><button class="ghost" onclick="setNav('watchlist')">← Back</button></div>
 <section class="detail ${m.watched?"history-detail":""}">
   <div class="detail-cover-column"><div class="detail-vhs" data-vhs="${m.id}" onclick="toggleCase(event,this)" title="Click the VHS case to flip it"><div class="vhs-stage">${caseFaces(m,backContent(m))}</div></div>${canEditCaseAssets()&&m.tmdbId?`<button class="watched-together-button artwork-button" onclick="openAssetEditor('${m.id}')">✎ Customize case artwork</button>`:""}</div>
   <div>
    <div class="eyebrow" style="${m.watched?"display:none":""}">CURRENT RANK #${rankOf(m)}</div><div class="detail-title-row"><h2>${(caseAssets(m).detailLogoPath||m.logoPath)&&window.TMDB?'<img class="detail-logo" src="'+TMDB.image(caseAssets(m).detailLogoPath||m.logoPath,"w300")+'" alt="'+m.title+'">':'<span>'+m.title+'</span>'}</h2><button class="seen-button ${m.seen.includes("Josh")?"on":"off"}" data-movie-id="${m.id}" onclick="toggleSeen(this.dataset.movieId)" aria-label="${m.seen.includes("Josh")?"Mark as not seen":"Mark as seen"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.2 12s3.4-6 9.8-6 9.8 6 9.8 6-3.4 6-9.8 6-9.8-6-9.8-6Z"/><circle cx="12" cy="12" r="2.8"/></svg><span class="seen-slash"></span><span>${m.seen.includes("Josh")?"I have seen this":"I have not seen this"}</span></button></div><div class="meta">${m.year} · ${m.genre} · ${m.director} · ${m.runtime}</div>
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
function assetCards(items,type,selected){
  if(!items?.length)return '<div class="asset-empty">No TMDB assets found.</div>';
  return items.map(a=>{
    const safe=JSON.stringify(String(a.filePath));
    const sel=selected===a.filePath?" selected":"";
    const size=type==="logo"||type==="detail-logo"?"w300":type==="poster"?"w185":"w300";
    return `<button class="asset-card${sel}" onclick="chooseAsset('${type}','${safe}')" title="${assetLanguageLabel(a)}"><img src="${assetImage(a.filePath,size)}" alt=""><span>${assetLanguageLabel(a)}</span></button>`;
  }).join("")
}
function assetEditor(){
  const m=movies.find(x=>x.id===state.assetMovieId);
  if(!m||!canEditCaseAssets())return "";
  const d=assetDraft(m),tmdb=m.tmdbAssets||{};
  return `<div class="modal-backdrop open" onclick="if(event.target===this)closeAssetEditor()"><section class="asset-modal" role="dialog" aria-modal="true" aria-labelledby="asset-title">
    <div class="modal-head"><div><div class="eyebrow">TMDB ARTWORK</div><h2 id="asset-title">Customize case artwork</h2><p class="asset-sub">${m.title} · changes are saved in this browser</p></div><button class="modal-close" onclick="closeAssetEditor()" aria-label="Close">×</button></div>
    ${state.assetLoading?'<div class="add-status">Loading TMDB artwork…</div>':state.assetError?'<div class="add-status error">'+state.assetError+'</div>':`
      <div class="asset-section"><div class="asset-heading"><strong>Front logo</strong><span>Also used on the spine and back</span></div><div class="asset-grid logo-grid">${assetCards(tmdb.logos||[],"logo",d.frontLogoPath)}</div><div class="asset-controls"><label>Size <input type="range" min="10" max="40" value="${d.frontLogoSize}" oninput="setAssetDraft('frontLogoSize',this.value)"><b>${d.frontLogoSize}%</b></label><label>Vertical position <input type="range" min="0" max="30" value="${d.frontLogoBottom}" oninput="setAssetDraft('frontLogoBottom',this.value)"><b>${d.frontLogoBottom}% from bottom</b></label></div></div>
      <div class="asset-section"><div class="asset-heading"><strong>Details-page logo</strong><span>Choose independently from the case logo</span></div><div class="asset-grid logo-grid">${assetCards(tmdb.logos||[],"detail-logo",d.detailLogoPath)}</div></div>
      <div class="asset-section"><div class="asset-heading"><strong>Front image</strong><span>All TMDB poster assets, including language-specific versions</span></div><div class="asset-grid poster-grid">${assetCards(tmdb.posters||[],"poster",d.frontImagePath)}</div><div class="asset-crop-preview"><img src="${assetImage(d.frontImagePath,"w500")}" alt="" style="object-position:${d.frontImageX}% ${d.frontImageY}%"><span>Case crop preview</span></div><div class="asset-controls two"><label>Horizontal position <input type="range" min="0" max="100" value="${d.frontImageX}" oninput="setAssetDraft('frontImageX',this.value)"><b>${d.frontImageX}%</b></label><label>Vertical position <input type="range" min="0" max="100" value="${d.frontImageY}" oninput="setAssetDraft('frontImageY',this.value)"><b>${d.frontImageY}%</b></label></div></div>
      <div class="asset-section"><div class="asset-heading"><strong>Back still</strong><span>Choose any TMDB backdrop/still</span></div><div class="asset-grid backdrop-grid">${assetCards(tmdb.backdrops||[],"backdrop",d.backStillPath)}</div></div>
      <div class="asset-actions"><button class="ghost" onclick="closeAssetEditor()">Close</button></div>`}
  </section></div>`;
}
function render(){app.innerHTML=header()+`<main class="content">${state.nav==="watchlist"?watchlist():state.nav==="history"?history():state.nav==="people"?people():state.nav==="settings"?settings():detail()}</main>`+addMovieModal()+attendanceModal()+assetEditor();bindLiveInputs();bindVhsTilt()}
let addMovieSearchTimer=null;let addMovieSearchRequest=0;
function bindLiveInputs(){let s=document.querySelector("#search");if(s)s.addEventListener("input",e=>{state.search=e.target.value;updateListOnly()});let r=document.querySelector("#sizeRange");if(r)r.addEventListener("input",e=>setPosterSize(e.target.value));let a=document.querySelector("#addMovieSearch");if(a)a.addEventListener("input",e=>{state.addMovieQuery=e.target.value;clearTimeout(addMovieSearchTimer);const query=e.target.value.trim();if(!query){state.addMovieResults=[];state.addMovieError="";document.querySelector("#addMovieResults").innerHTML=addMovieResults();return}addMovieSearchTimer=setTimeout(()=>searchAddMovies(query),300)})}
function updateListOnly(){let main=document.querySelector(".content");if(!main)return;let active=document.activeElement===document.querySelector("#search");let pos=document.querySelector("#search")?.selectionStart;main.innerHTML=watchlist();bindLiveInputs();bindVhsTilt();let s=document.querySelector("#search");if(active&&s){s.focus();s.setSelectionRange(pos,pos)}}
function bindVhsTilt(){const cards=[...document.querySelectorAll("[data-vhs]")];cards.forEach(card=>{const stage=card.querySelector(".vhs-stage"),inner=card.querySelector(".vhs-inner");if(!stage||!inner)return;const r=stage.getBoundingClientRect();inner.style.setProperty("--box-width",r.width+"px");inner.style.setProperty("--box-height",r.height+"px")});if(window.__vhsMouseMove){window.removeEventListener("pointermove",window.__vhsMouseMove);window.removeEventListener("pointerleave",window.__vhsMouseLeave)}window.__vhsMouseMove=e=>{cards.forEach(card=>{const stage=card.querySelector(".vhs-stage");if(!stage)return;const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));stage.style.setProperty("--tilt-x",clamp(-y*10,-10,10).toFixed(2)+"deg");stage.style.setProperty("--tilt-y",clamp(x*14,-20,20).toFixed(2)+"deg")})};window.__vhsMouseLeave=()=>cards.forEach(card=>{const stage=card.querySelector(".vhs-stage");if(stage){stage.style.setProperty("--tilt-x","0deg");stage.style.setProperty("--tilt-y","0deg")}});window.addEventListener("pointermove",window.__vhsMouseMove);window.addEventListener("pointerleave",window.__vhsMouseLeave)}
window.toggleCase=(e,el)=>{if(!el||e.target.closest("button,input"))return;el.classList.toggle("flipped")};
window.openAddMovie=()=>{state.addMovieOpen=true;state.addMovieQuery="";state.addMovieResults=[];state.addMovieSelection=null;state.addMovieError="";state.addMovieLoading=false;render();requestAnimationFrame(()=>document.querySelector("#addMovieSearch")?.focus())};
window.closeAddMovie=()=>{state.addMovieOpen=false;render()};
window.searchAddMovies=async queryArg=>{const input=document.querySelector("#addMovieSearch");const query=(queryArg??input?.value??state.addMovieQuery??"").trim();if(!query)return;state.addMovieQuery=query;state.addMovieLoading=true;state.addMovieError="";state.addMovieResults=[];const request=++addMovieSearchRequest;const results=document.querySelector("#addMovieResults");if(results)results.innerHTML=addMovieResults();try{const data=await TMDB.search(query);if(request!==addMovieSearchRequest)return;state.addMovieResults=(data.results||[]).slice(0,8);const currentInput=document.querySelector("#addMovieSearch");if(currentInput?.value.trim()!==state.addMovieQuery.trim())return;state.addMovieLoading=false;if(results)results.innerHTML=addMovieResults();}catch(error){if(request!==addMovieSearchRequest)return;state.addMovieError=error.message||"TMDB search failed.";state.addMovieLoading=false;if(results)results.innerHTML=addMovieResults();}};
window.selectAddMovie=async tmdbId=>{state.addMovieLoading=true;state.addMovieError="";render();try{state.addMovieSelection=await TMDB.details(tmdbId);}catch(error){state.addMovieError=error.message||"Could not load that movie.";state.addMovieSelection=null;}finally{state.addMovieLoading=false;render()}};
window.clearAddMovieSelection=()=>{state.addMovieSelection=null;state.addMovieError="";render()};
window.confirmAddMovie=()=>{const d=state.addMovieSelection;if(!d?.tmdbId)return;const normalizeTitle=s=>String(s||"").trim().toLowerCase().replace(/[^a-z0-9]+/g," ");const duplicate=movies.some(m=>m.tmdbId===d.tmdbId||(normalizeTitle(m.title)===normalizeTitle(d.title)&&String(m.year)===String(d.year||"")));if(duplicate){state.addMovieError="Already in watchlist";return render()}const note=(document.querySelector("#addMovieNote")?.value||"").trim();const movie={id:"tmdb-"+d.tmdbId,title:d.title,year:d.year||"",genre:(d.genre||[]).join(" · "),director:(d.director||[]).join(", "),runtime:d.runtime?formatRuntime(d.runtime):"",rating:d.rating||"",score:0,seen:[],voters:[],synopsis:d.synopsis||"",note,warnings:[],watched:false,suggestedBy:"Josh",addedBy:currentUser,tmdbId:d.tmdbId,posterPath:d.posterPath||null,textlessPosterPath:d.textlessPosterPath||null,backdropPath:d.backdropPath||null,logoPath:d.logoPath||null};movies.push(movie);try{localStorage.setItem("watchlist-added-movies",JSON.stringify(movies.filter(m=>m.id.startsWith("tmdb-"))));}catch(error){}state.addMovieOpen=false;state.addMovieSelection=null;state.addMovieError="";render()};

window.openAssetEditor=async id=>{
  if(!canEditCaseAssets())return;
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
window.chooseAsset=(type,path)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const a=savedCaseAssets[m.id]||{};
  if(type==="logo")a.frontLogoPath=path;
  else if(type==="detail-logo")a.detailLogoPath=path;
  else if(type==="poster")a.frontImagePath=path;
  else if(type==="backdrop")a.backStillPath=path;
  savedCaseAssets[m.id]=a;saveCaseAssets();render()
};
window.setAssetDraft=(field,value)=>{
  const m=movies.find(x=>x.id===state.assetMovieId);if(!m||!canEditCaseAssets())return;
  const a=savedCaseAssets[m.id]||{};
  a[field]=Number(value);savedCaseAssets[m.id]=a;saveCaseAssets();
  const label=document.querySelector('[data-asset-value="'+field+'"]');
  if(label)label.textContent=field==="frontLogoBottom"?value+"% from bottom":value+"%";
  if(field==="frontImageX"||field==="frontImageY"){
    const preview=document.querySelector(".asset-crop-preview img");
    if(preview)preview.style.objectPosition=(field==="frontImageX"?value:(a.frontImageX??50))+"% "+(field==="frontImageY"?value:(a.frontImageY??50))+"%";
  }
};
window.setNav=x=>{state.nav=x;state.detail=null;render()};window.setView=x=>{state.view=x;render()};window.toggleFilters=()=>{state.showFilters=!state.showFilters;render()};window.setFilter=x=>{state.filter=x;render()};window.setPosterSize=x=>{state.posterSize=Math.max(1,Math.min(4,Math.round(Number(x)||1)));const cols=[12,8,6,5][state.posterSize-1];document.querySelectorAll(".grid").forEach(e=>e.style.setProperty("--grid-cols",cols));document.querySelectorAll(".range").forEach(e=>e.value=state.posterSize);requestAnimationFrame(()=>bindVhsTilt())};window.toggleSetting=k=>{state[k]=!state[k];render()};window.openMovie=id=>{state.detail=id;state.nav="detail";render()};window.togglePerson=p=>{const card=document.querySelector('[data-person="'+p+'"]');if(!card)return;const old=card.querySelector('.person-details');if(old){old.remove();return}const notSeen=movies.filter(m=>{if(m.seen.includes(p))return false;const v=personVote(m,p);return !v||v!=="red"});const interests=notSeen.filter(m=>personVote(m,p));const suggested=movies.filter(m=>p==="Josh"&&!m.seen.includes(p)&&m.note);const details=document.createElement("div");details.className="person-details";details.innerHTML='<div><div class="person-section-label">INTERESTED IN WATCHING</div><div class="person-movies">'+(interests.map(m=>{const v=personVote(m,p);const label=v==="green"?"Interested":v==="yellow"?"I’d Watch":"Not Interested";return '<div class="person-movie"><span>'+m.title+'</span><span class="person-interest '+v+'">'+label+'</span></div>'}).join("")||'<div class="person-empty">No interest responses yet.</div>')+'</div></div><div><div class="person-section-label">HASN\'T SEEN</div><div class="person-movies">'+(notSeen.map(m=>'<div class="person-movie"><span>'+m.title+'</span><span class="person-seen">Not seen</span></div>').join("")||'<div class="person-empty">No movies left unseen.</div>')+'</div></div>'+(suggested.length?'<div><div class="person-section-label">SUGGESTED</div><div class="person-movies">'+suggested.map(m=>'<div class="person-movie"><span>'+m.title+'</span><span class="person-seen">Suggestion</span></div>').join("")+'</div></div>':"");card.appendChild(details)};
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