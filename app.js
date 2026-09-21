const fallback=(t,y)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750"><rect width="100%" height="100%" fill="#25282d"/><rect x="30" y="30" width="440" height="690" rx="12" fill="#17191c" stroke="#4a4f57"/><text x="250" y="350" fill="#e8e4da" font-family="Arial" font-size="38" font-weight="bold" text-anchor="middle">${t}</text><text x="250" y="400" fill="#9298a1" font-family="Arial" font-size="24" text-anchor="middle">${y}</text></svg>`)}`;

const movies=[
{id:"alien",title:"Alien",year:1979,genre:"Horror · Sci-Fi",director:"Ridley Scott",runtime:"1h 57m",rating:"R",score:10,seen:["Josh"],voters:[["Josh","green"],["Sarah","green"],["Mike","yellow"]],synopsis:"The crew of a commercial spacecraft encounter a deadly lifeform after answering a mysterious distress signal.",note:"I don't think we've actually watched this together. Fix that.",warnings:["Gore","Body horror"],watched:false},
{id:"thing",title:"The Thing",year:1982,genre:"Horror · Sci-Fi",director:"John Carpenter",runtime:"1h 49m",rating:"R",score:8,seen:["Sarah"],voters:[["Josh","green"],["Sarah","yellow"],["Alex","red"]],synopsis:"A research team in Antarctica faces a lifeform capable of perfectly imitating other organisms.",note:"Been meaning to show you guys this for ages.",warnings:["Gore","Animal death"],watched:false},
{id:"scream",title:"Scream",year:1996,genre:"Horror · Mystery",director:"Wes Craven",runtime:"1h 51m",rating:"R",score:7,seen:["Josh","Alex"],voters:[["Josh","yellow"],["Mike","yellow"],["Alex","red"]],synopsis:"A masked killer turns a small town's horror-movie knowledge into a deadly game.",note:"A classic group-watch candidate.",warnings:["Violence","Sexual content"],watched:false},
{id:"predator",title:"Predator",year:1987,genre:"Action · Sci-Fi",director:"John McTiernan",runtime:"1h 47m",rating:"R",score:6,seen:[],voters:[["Josh","green"],["Sarah","yellow"]],synopsis:"An elite rescue team becomes prey for an extraterrestrial hunter in a Central American jungle.",note:"",warnings:["Gore","Violence"],watched:false},
{id:"tremors",title:"Tremors",year:1990,genre:"Horror · Comedy",director:"Ron Underwood",runtime:"1h 36m",rating:"PG-13",score:5,seen:["Mike"],voters:[["Mike","green"],["Alex","yellow"]],synopsis:"A tiny desert town is besieged by enormous underground creatures.",note:"",warnings:["Animal death"],watched:false},
{id:"event",title:"Event Horizon",year:1997,genre:"Horror · Sci-Fi",director:"Paul W. S. Anderson",runtime:"1h 36m",rating:"R",score:3,seen:["Sarah","Mike"],voters:[["Sarah","green"],["Alex","yellow"]],synopsis:"A rescue crew investigates a vanished spaceship and discovers something deeply wrong with its return.",note:"Maybe this one is a terrible idea. Which is exactly why I'm suggesting it.",warnings:["Gore","Disturbing imagery"],watched:true}
];

const baseScores=Object.fromEntries(movies.map(m=>[m.id,m.score]));
const state={nav:"watchlist",view:"list",search:"",filter:"all",posterSize:175,showSynopsis:true,showRatings:false,showNote:true,showTrailer:false,detail:null,showFilters:false,votes:{}};
const app=document.querySelector("#app");

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
function header(){return `<header class="topbar"><div class="brand"><div class="brand-mark">▶</div><span>THE WATCHLIST</span></div><nav class="nav">${["watchlist","history","people","settings"].map(x=>`<button class="${state.nav===x?"active":""}" onclick="setNav('${x}')">${x[0].toUpperCase()+x.slice(1)}</button>`).join("")}</nav><div class="user"><div class="avatar">J</div><span>Josh</span></div></header>`}
function toolbar(){return `<div class="toolbar"><input id="search" class="search" placeholder="Search movies..." value="${state.search}"><button class="icon ${state.view==="list"?"active":""}" onclick="setView('list')">☷ List</button><button class="icon ${state.view==="grid"?"active":""}" onclick="setView('grid')">▦ Posters</button>${state.view==="grid"?`<input class="range" id="sizeRange" type="range" min="130" max="250" value="${state.posterSize}" aria-label="Poster size">`:``}<button class="ghost" onclick="toggleFilters()">☷ Filters</button></div>${state.showFilters?`<div class="filter-panel">${[["all","All movies"],["unwatched","Unwatched"],["nobody seen","Nobody has seen"],["I haven't seen","I haven't seen"],["not interested","I'm not interested"]].map(([f,l])=>`<button class="${state.filter===f?"active":""}" onclick="setFilter('${f}')">${l}</button>`).join("")}</div>`:""}`}
function stack(v){return `<div class="stack">${v.map(([n,c])=>`<div class="ring ${c}" title="${n}">${n.slice(0,2).toUpperCase()}</div>`).join("")}</div>`}
function listView(items){return `<div class="list">${items.map((m,i)=>{const mine=currentVote(m.id);return `<article class="row ${mine==="no"?"not-interested-row":""}"><div class="rank">#${i+1}</div><img class="thumb" src="${fallback(m.title,m.year)}"><div onclick="openMovie('${m.id}')" style="cursor:pointer"><div class="title">${m.title}${mine?` <span class="response-chip ${mine}">${responseLabel(mine)}</span>`:""}</div><div class="meta">${m.year} · ${m.genre} · ${m.director}</div></div><div>${stack(voterEntries(m))}</div><div class="seen">${m.seen.includes("Josh")?"◉ Seen":"○ Not seen"}</div></article>`}).join("")}</div>`}
function caseFaces(m, backHtml, extraClass=""){
  return `<div class="vhs-inner ${extraClass}">
    <div class="vhs-front"><span class="rank-badge">#${rankOf(m)}</span><img src="${fallback(m.title,m.year)}" alt="${m.title}"></div>
    <div class="vhs-back"><div class="vhs-back-scroll">${backHtml}</div></div>
    <div class="vhs-side vhs-right"><div class="spine-label">${m.title} · ${m.year}</div></div>
    <div class="vhs-side vhs-left"></div><div class="vhs-side vhs-top"></div><div class="vhs-side vhs-bottom"></div>
  </div>`;
}
function backContent(m){
 return `<div class="eyebrow">VHS BACK</div><h3>${m.title}</h3>
 <div class="meta">${m.year} · ${m.genre}</div><div class="meta">${m.director} · ${m.runtime}</div>
 ${state.showSynopsis?`<p>${m.synopsis}</p>`:""}
 ${state.showRatings?`<span class="pill">Rating ${m.rating}</span>`:""}
 ${state.showNote&&m.note?`<div class="note">“${m.note}”</div>`:""}
 <div class="back-warnings">${m.warnings.map(w=>`<span class="pill">⚠ ${w}</span>`).join("")}</div>`;
}
function caseArticle(m,extra=""){return `<article class="vhs ${extra}" data-vhs="${m.id}" onclick="toggleCase(event,this)"><div class="vhs-stage">${caseFaces(m,backContent(m))}</div><div class="grid-title" onclick="event.stopPropagation();openMovie('${m.id}')">${m.title}</div><div class="grid-meta" onclick="event.stopPropagation();openMovie('${m.id}')">${m.year} · ${m.genre}</div><div class="hint">Click the case to flip · click the title for details</div></article>`}
function gridView(items){return `<div class="grid" style="--poster-size:${state.posterSize}px">${items.map(m=>caseArticle(m)).join("")}</div>`}
function watchlist(){
 let a=movies.filter(m=>!m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));
 if(state.filter==="nobody seen")a=a.filter(m=>!m.seen.length);
 if(state.filter==="I haven't seen")a=a.filter(m=>!m.seen.includes("Josh"));
 if(state.filter==="not interested")a=a.filter(m=>currentVote(m.id)==="no");
 a.sort((x,y)=>y.score-x.score);
 return `<div class="hero"><div><div class="eyebrow">YOUR SERVER'S MOVIE LIBRARY</div><h1>Watchlist</h1><p class="sub">${a.length} movies waiting for a movie night.</p></div><button class="primary" onclick="alert('The real Add Movie search comes after the prototype.')">＋ Add movie</button></div>${toolbar()}${a.length?(state.view==="list"?listView(a):gridView(a)):`<div class="empty">Nothing matches those filters.</div>`}`;
}
function history(){const a=movies.filter(m=>m.watched&&((m.title+" "+m.genre).toLowerCase().includes(state.search.toLowerCase())));return `<div class="hero"><div><div class="eyebrow">THE GROUP ARCHIVE</div><h1>History</h1><p class="sub">Movies you've watched together, kept around so nobody has to remember.</p></div></div>${toolbar()}${a.length?(state.view==="list"?listView(a):gridView(a)):`<div class="empty">Nothing matches your search.</div>`}` }
function people(){return `<div class="hero"><div><div class="eyebrow">THE SERVER</div><h1>People</h1><p class="sub">Who's in the group and what they're interested in.</p></div></div><div class="settings">${["Josh","Sarah","Mike","Alex"].map(p=>`<div class="setting"><div style="display:flex;gap:13px;align-items:center"><div class="avatar">${p.slice(0,2)}</div><div><strong>${p}</strong><span>${movies.filter(m=>m.voters.some(([n])=>n===p)).length} active interests · ${movies.filter(m=>m.seen.includes(p)).length} seen before</span></div></div></div>`).join("")}</div>`}
function settings(){let rows=[["Show synopsis","Show movie synopses on cards and details.","showSynopsis"],["Show ratings","Show external ratings when available.","showRatings"],["Show suggester's note","Show personal notes attached to suggestions.","showNote"],["Show trailers","Allow trailers to appear in details.","showTrailer"]];return `<div class="hero"><div><div class="eyebrow">YOUR PREFERENCES</div><h1>Settings</h1><p class="sub">Control how much pre-watch information The Watchlist shows you.</p></div></div><div class="settings">${rows.map(([a,b,k])=>`<div class="setting"><div><strong>${a}</strong><span>${b}</span></div><button class="toggle ${state[k]?"on":""}" onclick="toggleSetting('${k}')" aria-label="Toggle ${a}"></button></div>`).join("")}<div class="setting"><div><strong>Content warnings</strong><span>Choose which warning categories you want surfaced.</span></div><button class="ghost" onclick="alert('Warning category picker comes next.')">Choose</button></div><div class="setting"><div><strong>Default poster size</strong><span>Used by the poster grid.</span></div><input class="range" type="range" min="130" max="250" value="${state.posterSize}" oninput="setPosterSize(this.value)"></div></div>`}
function detail(){
 let m=movies.find(x=>x.id===state.detail), selected=currentVote(m.id);
 return `<div class="hero"><div><div class="eyebrow">MOVIE</div><h1>Details</h1></div><button class="ghost" onclick="setNav('watchlist')">← Back</button></div>
 <section class="detail">
   <div class="detail-vhs" data-vhs="${m.id}" onclick="toggleCase(event,this)" title="Click the VHS case to flip it"><div class="vhs-stage">${caseFaces(m,backContent(m))}</div><div class="detail-flip-hint">CLICK TO FLIP</div></div>
   <div>
    <div class="eyebrow">CURRENT RANK #${rankOf(m)}</div><h2>${m.title}</h2><div class="meta">${m.year} · ${m.genre} · ${m.director} · ${m.runtime}</div>
    <div class="people-strip"><div class="people-strip-label">RESPONSES</div>${stack(voterEntries(m))}</div>
    ${selected?`<div class="current-response">Your response: <strong>${responseLabel(selected)}</strong></div>`:""}
    <div class="seen-control"><div><strong>Already seen</strong><span>Mark whether you have seen this movie before.</span></div><button class="toggle ${m.seen.includes("Josh")?"on":""}" onclick="toggleSeen('${m.id}')" aria-label="Toggle already seen"></button></div>
    <div class="vote-box"><div class="vote-label">Your response</div><div class="votes">${[["must","🔥 Must Watch"],["interested","🟢 Interested"],["watch","🟡 I'd Watch"],["no","🔴 Not Interested"]].map(([k,l])=>`<button class="vote ${selected===k?"selected":""}" onclick="vote('${m.id}','${k}')">${l}</button>`).join("")}</div></div>
    ${state.showSynopsis?`<p class="detail-synopsis">${m.synopsis}</p>`:""}
    ${state.showNote&&m.note?`<div class="note">Suggested by Josh: “${m.note}”</div>`:""}
    <div class="warning-list">${m.warnings.map(w=>`<span class="pill">⚠ ${w}</span>`).join("")}</div>
   </div>
 </section>`;
}
function render(){app.innerHTML=header()+`<main class="content">${state.nav==="watchlist"?watchlist():state.nav==="history"?history():state.nav==="people"?people():state.nav==="settings"?settings():detail()}</main>`;bindLiveInputs();bindVhsTilt()}
function bindLiveInputs(){let s=document.querySelector("#search");if(s)s.addEventListener("input",e=>{state.search=e.target.value;updateListOnly()});let r=document.querySelector("#sizeRange");if(r)r.addEventListener("input",e=>setPosterSize(e.target.value))}
function updateListOnly(){let main=document.querySelector(".content");if(!main)return;let active=document.activeElement===document.querySelector("#search");let pos=document.querySelector("#search")?.selectionStart;main.innerHTML=watchlist();bindLiveInputs();bindVhsTilt();let s=document.querySelector("#search");if(active&&s){s.focus();s.setSelectionRange(pos,pos)}}
function bindVhsTilt(){document.querySelectorAll("[data-vhs]").forEach(card=>{const stage=card.querySelector(".vhs-stage"),inner=card.querySelector(".vhs-inner");if(!stage||!inner)return;const r=stage.getBoundingClientRect();inner.style.setProperty("--box-width",r.width+"px");inner.style.setProperty("--box-height",r.height+"px");stage.addEventListener("pointermove",e=>{const r=stage.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;stage.style.setProperty("--tilt-x",(-y*16).toFixed(2)+"deg");stage.style.setProperty("--tilt-y",(x*20).toFixed(2)+"deg")});stage.addEventListener("pointerleave",()=>{stage.style.setProperty("--tilt-x","0deg");stage.style.setProperty("--tilt-y","0deg")})})}
window.toggleCase=(e,el)=>{if(e.target.closest("button,input"))return;el.classList.toggle("flipped")};
window.setNav=x=>{state.nav=x;state.detail=null;render()};window.setView=x=>{state.view=x;render()};window.toggleFilters=()=>{state.showFilters=!state.showFilters;render()};window.setFilter=x=>{state.filter=x;render()};window.setPosterSize=x=>{state.posterSize=Number(x);document.querySelectorAll(".grid").forEach(e=>e.style.setProperty("--poster-size",state.posterSize+"px"));document.querySelectorAll(".range").forEach(e=>e.value=state.posterSize)};window.toggleSetting=k=>{state[k]=!state[k];render()};window.openMovie=id=>{state.detail=id;state.nav="detail";render()};
window.vote=(id,k)=>{const old=state.votes[id];if(old===k)return;const weights={must:5,interested:3,watch:1,no:0};const m=movies.find(x=>x.id===id);m.score=baseScores[id]+weights[k];state.votes[id]=k;render()};
window.toggleSeen=id=>{const m=movies.find(x=>x.id===id);if(!m)return;const i=m.seen.indexOf("Josh");if(i===-1)m.seen.push("Josh");else m.seen.splice(i,1);render()};
render();
