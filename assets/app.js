/* Chaos Map — shared UI logic. Language-specific content comes from window.DATA
   (data-en.js / data-ja.js); icons are shared via window.ICONS (icons.js). */
const D=window.DATA, UI=D.ui;
const zones=D.zones, relations=D.relations, TIERS=D.tiers, YEARS=D.years, typeLabel=D.typeLabel;
const RTYPES=Object.fromEntries(Object.entries(D.rtypeStyle).map(([k,s])=>[k,{...s,label:D.rtypeLabels[k]}]));
const fmt=(tpl,vars)=>tpl.replace(/\{(\w+)\}/g,(_,k)=>vars[k]);

/* ---------- index ---------- */
const slug=n=>n.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const TOOL={};   // slug -> {name,type,desc,tiers,bt,zi,ci}
zones.forEach((z,zi)=>z.cats.forEach((c,ci)=>c.tools.forEach(t=>{
  const [name,type,desc,tiers,bt]=t;
  TOOL[slug(name)]={name,type,desc,tiers:tiers||[],bt,zi,ci};
})));
const relOf=s=>relations.filter(r=>r.f===s||r.t===s);
const catRels=(zi,ci)=>{
  const inCat=[],cross=[];
  const here=new Set(zones[zi].cats[ci].tools.map(t=>slug(t[0])));
  relations.forEach(r=>{
    const fIn=here.has(r.f),tIn=here.has(r.t);
    if(fIn&&tIn)inCat.push(r);
    else if(fIn||tIn)cross.push(r);
  });
  return {inCat,cross};
};
const yearOf=s=>YEARS[s]?parseInt(YEARS[s]):null;
const monthOf=s=>{const p=String(YEARS[s]||"").split("-");return p[1]?parseInt(p[1]):null;};
const monthLabel=m=>UI.months[m-1];
const whenLabel=s=>{
  const y=yearOf(s);if(!y)return"";
  const m=monthOf(s);
  return m?fmt(UI.sinceM,{y,m:monthLabel(m)}):fmt(UI.sinceY,{y});
};

/* ---------- shared renderers ---------- */
const DARK_ICON_BG=new Set(["orcha"]); // white-on-transparent logos need a dark tile
function iconBox(s){
  const t=TOOL[s];
  const ic=window.ICONS[s];
  const tierColor=t.tiers.length?`var(--t-${t.tiers[0]})`:"#B9C0BB";
  if(ic)return `<span class="ic" style="--tier:${tierColor}${DARK_ICON_BG.has(s)?";background:#17212B":""}"><img src="${ic}" alt="" loading="lazy"></span>`;
  const hue=zones[t.zi].cats[t.ci].hue;
  return `<span class="ic mono" style="--tier:${tierColor};--mono-bg:${hue}">${t.name[0].toUpperCase()}</span>`;
}
const tierBadges=tiers=>(tiers||[]).map(k=>`<span class="tier-badge ${k}">${TIERS[k]}</span>`).join("");
/* category-card description: lead sentences of the full write-up (2-3x the one-liner) */
function cardDesc(s){
  const long=D.long[s];
  if(!long)return TOOL[s].desc;
  const sentences=D.lang==="en"
    ? (long.match(/[^.!?]+[.!?]+(?:\s|$)/g)||[long])
    : long.split("。").filter(x=>x.trim()).map(x=>x+"。");
  const limit=D.lang==="en"?{min:110,max:260}:{min:70,max:180};
  let out="";
  for(const x of sentences){
    if(out&&(out.length>=limit.min||out.length+x.length>limit.max))break;
    out+=x;
  }
  return (out||TOOL[s].desc).trim();
}

/* ---------- overview map: dense icon clouds ---------- */
const map=document.getElementById("map");
zones.forEach((z,zi)=>{
  const zone=document.createElement("div");
  zone.className="zone";
  const rail=document.createElement("div");
  rail.className="zone-rail";
  rail.style.background=z.color;
  rail.textContent=z.name;
  const body=document.createElement("div");
  body.className="zone-body";
  z.cats.forEach((c,ci)=>{
    const p=document.createElement("section");
    p.className="panel";
    p.style.setProperty("--hue",c.hue);
    p.innerHTML=`<h2>${c.title}<span class="count">${c.tools.length}</span></h2>`;
    const cloud=document.createElement("div");
    cloud.className="cloud";
    c.tools.forEach(t=>{
      const s=slug(t[0]);
      const tile=document.createElement("span");
      tile.className="tile";
      tile.innerHTML=`${iconBox(s)}<span class="nm">${t[0]}</span>`;
      tile.addEventListener("click",e=>{e.stopPropagation();openFrom(tile);location.hash=`#t/${s}`;});
      cloud.appendChild(tile);
    });
    p.appendChild(cloud);
    p.addEventListener("click",()=>{openFrom(p);location.hash=`#c/${zi}-${ci}`;});
    body.appendChild(p);
  });
  zone.appendChild(rail);
  zone.appendChild(body);
  map.appendChild(zone);
});

/* ---------- zoom navigation ---------- */
const ov=document.getElementById("ov");
const ovPanel=document.getElementById("ovPanel");
let zoomSrc=null; // rect of the clicked element, for the zoom-in animation

function openFrom(el){zoomSrc=el.getBoundingClientRect();}

function crumbHtml(items){
  return `<nav class="crumbs">`+items.map((it,i)=>{
    const last=i===items.length-1;
    return (i?`<span class="sep">›</span>`:"")+
      (last?`<span class="cur">${it.label}</span>`:`<a data-hash="${it.hash}">${it.label}</a>`);
  }).join("")+`</nav>`;
}

function categoryGuideHtml(c){
  if(!c.guide)return `<p class="ov-desc-fallback">${c.desc}</p>`;
  const sections=[
    [UI.guideLabels[0],c.guide.audience],
    [UI.guideLabels[1],c.guide.problem],
    [UI.guideLabels[2],c.guide.benefit],
    [UI.guideLabels[3],c.guide.caution]
  ];
  const splitter=D.lang==="en"?/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g:/[^。！？]+[。！？]?/g;
  const lines=text=>(text.match(splitter)||[text])
    .map(line=>`<span>${line.trim()}</span>`).join("");
  return `<div class="ov-desc" aria-label="${UI.guideAria}">${sections.map(([label,text])=>
    `<section class="ov-desc-block"><h3>${label}</h3><p>${lines(text)}</p></section>`
  ).join("")}</div>`;
}

function playZoomIn(){
  if(!zoomSrc){ovPanel.style.opacity="";ovPanel.style.transform="";return;}
  const target=ovPanel.getBoundingClientRect();
  const sx=zoomSrc.width/target.width, sy=zoomSrc.height/target.height;
  const dx=zoomSrc.left+zoomSrc.width/2-(target.left+target.width/2);
  const dy=zoomSrc.top+zoomSrc.height/2-(target.top+target.height/2);
  ovPanel.classList.remove("zooming");
  ovPanel.style.transform=`translate(${dx}px,${dy}px) scale(${Math.max(sx,.2)},${Math.max(sy,.2)})`;
  ovPanel.style.opacity="0.4";
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    ovPanel.classList.add("zooming");
    ovPanel.style.transform="none";
    ovPanel.style.opacity="1";
  }));
  zoomSrc=null;
}

function parseHash(){
  const h=location.hash;
  let m;
  if((m=h.match(/^#c\/(\d+)-(\d+)$/))){
    const zi=+m[1],ci=+m[2];
    if(zones[zi]&&zones[zi].cats[ci])return{level:1,zi,ci};
  }
  if((m=h.match(/^#t\/([a-z0-9-]+)$/))&&TOOL[m[1]])return{level:2,s:m[1]};
  return{level:0};
}

function render(){
  const st=parseHash();
  syncLangLinks();
  if(st.level===0){
    ov.classList.remove("open");
    document.body.style.overflow="";
    ovPanel.innerHTML="";
    return;
  }
  ov.classList.add("open");
  document.body.style.overflow="hidden";
  if(st.level===1)renderCat(st.zi,st.ci);
  else renderTool(st.s);
  ov.scrollTop=0;
  playZoomIn();
}

/* ---------- category view ---------- */
function renderCat(zi,ci){
  const z=zones[zi],c=z.cats[ci];
  ovPanel.style.setProperty("--hue",c.hue);
  const {inCat,cross}=catRels(zi,ci);

  let html=`<button class="ov-close" data-hash="">${UI.closeMap}</button>`;
  html+=crumbHtml([{label:UI.crumbRoot,hash:""},{label:`${z.name} / ${c.title}`}]);
  html+=`<h2 class="ov-title">${c.title}</h2>${categoryGuideHtml(c)}`;
  html+=`<div class="relwrap"${inCat.length?' style="margin-top:68px"':''}><svg class="relsvg"></svg><div class="cards">`;
  c.tools.forEach(t=>{
    const [name,type,desc,tiers,bt]=t;
    const s=slug(name);
    html+=`<div class="tcard" data-slug="${s}" data-hash="t/${s}">
      <div class="row1">${iconBox(s)}<span class="nm">${name}</span></div>
      <div class="row2">${tierBadges(tiers)}<span class="mini">${typeLabel[type]}</span>${bt?`<span class="mini">${UI.bigtech}</span>`:""}</div>
      <div class="d">${cardDesc(s)}</div>
    </div>`;
  });
  html+=`</div></div>`;

  if(c.trend){
    html+=`<div class="pow"><h3>${UI.power}</h3><p>${c.trend}</p></div>`;
  }

  const datedTools=c.tools.map(t=>({s:slug(t[0]),n:t[0]})).filter(x=>yearOf(x.s));
  const yrs=[...new Set(datedTools.map(x=>yearOf(x.s)))].sort();
  if(datedTools.length){
    const singleYear=yrs.length===1;
    const timelineTitle=singleYear?fmt(UI.tlSingle,{y:yrs[0]}):UI.tl;
    html+=`<div class="tl${singleYear?' single-year':''}"><h3>${timelineTitle}</h3><div class="tl-track">`;
    yrs.forEach((y,i)=>{
      if(i&&y-yrs[i-1]>1)html+=`<div class="tl-col gap">…</div>`;
      html+=`<div class="tl-col"><div class="tl-year">${y}</div><div class="tl-items">`+
        datedTools
          .filter(x=>yearOf(x.s)===y)
          .sort((a,b)=>(monthOf(a.s)||99)-(monthOf(b.s)||99))
          .map(x=>`<span class="tl-item" data-hash="t/${x.s}">${iconBox(x.s)}<span class="tl-txt">${monthOf(x.s)?`<span class="tl-m">${monthLabel(monthOf(x.s))}</span>`:""}<span class="tl-n">${x.n}</span></span></span>`)
          .join("")+`</div></div>`;
    });
    html+=`</div></div>`;
  }

  if(cross.length){
    html+=`<div class="xrel"><h3>${UI.xrel}</h3><div class="xrel-items">`;
    cross.forEach(r=>{
      const rt=RTYPES[r.r];
      const F=TOOL[r.f],T=TOOL[r.t];
      const catOf=t=>`${zones[t.zi].name} / ${zones[t.zi].cats[t.ci].title}`;
      html+=`<div class="xrel-item">
        <a data-hash="t/${r.f}">${F.name}</a><span class="cat-of">(${catOf(F)})</span>
        <span class="reltag" style="background:${rt.color}">${rt.label} →</span>
        <a data-hash="t/${r.t}">${T.name}</a><span class="cat-of">(${catOf(T)})</span>
      </div>`;
    });
    html+=`</div></div>`;
  }
  const usedTypes=[...new Set([...inCat,...cross].map(r=>r.r))];
  if(usedTypes.length){
    html+=`<div class="rel-legend"><h3>${UI.relLegend}</h3><div class="items">`+
      usedTypes.map(k=>{
        const rt=RTYPES[k];
        return `<span><span class="sw" style="border-top:2.5px ${rt.dash?"dashed":"solid"} ${rt.color}"></span>${rt.label}</span>`;
      }).join("")+`</div></div>`;
  }
  ovPanel.innerHTML=html;
  const redraw=()=>drawArrows(inCat);
  redraw();                                  // layout is already computed here
  requestAnimationFrame(redraw);             // repeat on next paint just in case
  ovPanel.addEventListener("transitionend",redraw,{once:true}); // after the zoom-in settles
  // card heights shift when webfonts finish loading (or on any reflow) —
  // arrows must be re-routed from the final geometry or they drift onto text
  if(document.fonts)document.fonts.ready.then(()=>requestAnimationFrame(redraw));
  if(cardsRO)cardsRO.disconnect();
  cardsRO=new ResizeObserver(()=>redraw());
  ovPanel.querySelectorAll(".tcard").forEach(el=>cardsRO.observe(el));
}
let cardsRO=null;

function drawArrows(rels){
  const svg=ovPanel.querySelector(".relsvg");
  const wrapEl=ovPanel.querySelector(".relwrap");
  if(!svg||!wrapEl||!rels.length)return;
  const wr=wrapEl.getBoundingClientRect();
  svg.setAttribute("viewBox",`0 0 ${wr.width} ${wr.height}`);
  // rects may be measured mid-zoom while the panel is scaled non-uniformly;
  // stretching the viewBox to the element box cancels that distortion exactly
  svg.setAttribute("preserveAspectRatio","none");
  let defs=`<defs>`;
  Object.entries(RTYPES).forEach(([k,rt])=>{
    defs+=`<marker id="ah-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${rt.color}"/></marker>`;
  });
  defs+=`</defs>`;

  /* Manhattan routing: arrows travel only through the gutters between cards,
     turning at right angles (rounded corners), so they never cross card text. */
  const R={};
  ovPanel.querySelectorAll(".tcard").forEach(el=>{
    const r=el.getBoundingClientRect();
    R[el.dataset.slug]={l:r.left-wr.left,t:r.top-wr.top,r:r.right-wr.left,b:r.bottom-wr.top,
      cx:r.left-wr.left+r.width/2,w:r.width};
  });
  const cluster=vals=>{
    const s=[...new Set(vals.map(v=>Math.round(v)))].sort((a,b)=>a-b),g=[];
    s.forEach(v=>{if(g.length&&v-g[g.length-1][g[g.length-1].length-1]<=20)g[g.length-1].push(v);else g.push([v]);});
    return g.map(x=>x[0]);
  };
  const all=Object.values(R);
  const rowTops=cluster(all.map(r=>r.t));
  const colLefts=cluster(all.map(r=>r.l));
  const rowOf=r=>rowTops.findIndex(t=>Math.abs(t-r.t)<=20);
  const colOf=r=>colLefts.findIndex(l=>Math.abs(l-r.l)<=20);
  const rows=rowTops.map((t,i)=>{const rs=all.filter(r=>rowOf(r)===i);
    return{top:Math.min(...rs.map(r=>r.t)),bottom:Math.max(...rs.map(r=>r.b))};});
  const cols=colLefts.map((l,i)=>{const rs=all.filter(r=>colOf(r)===i);
    return{left:Math.min(...rs.map(r=>r.l)),right:Math.max(...rs.map(r=>r.r))};});
  // hG(i): y of the horizontal gutter above row i / vG(i): x of the vertical gutter left of col i
  const hG=i=>i===0?rows[0].top-40:(rows[i-1].bottom+rows[i].top)/2;
  const vG=i=>i===0?cols[0].left-22:i===cols.length?cols[cols.length-1].right+22:(cols[i-1].right+cols[i].left)/2;
  const roundedPath=(pts,rad)=>{
    let d=`M${pts[0][0]},${pts[0][1]}`;
    for(let i=1;i<pts.length-1;i++){
      const [x0,y0]=pts[i-1],[x1,y1]=pts[i],[x2,y2]=pts[i+1];
      const l1=Math.hypot(x1-x0,y1-y0),l2=Math.hypot(x2-x1,y2-y1);
      const r1=Math.min(rad,l1/2),r2=Math.min(rad,l2/2);
      d+=`L${x1-(x1-x0)/l1*r1},${y1-(y1-y0)/l1*r1} Q${x1},${y1} ${x1+(x2-x1)/l2*r2},${y1+(y2-y1)/l2*r2}`;
    }
    return d+`L${pts[pts.length-1][0]},${pts[pts.length-1][1]}`;
  };

  let body="";
  rels.forEach((rel,idx)=>{
    const A=R[rel.f],B=R[rel.t];
    if(!A||!B)return;
    const rt=RTYPES[rel.r];
    const lane=(idx-(rels.length-1)/2)*9;          // spread parallel arrows apart
    const clampX=(x,c)=>Math.max(c.l+16,Math.min(c.r-16,x));
    const sx=clampX(A.cx+lane*.6,A), tx=clampX(B.cx+lane,B);
    const rA=rowOf(A),rB=rowOf(B),cA=colOf(A),cB=colOf(B);
    let pts;
    if(rA===rB){
      const gy=hG(rA)+lane;
      pts=[[sx,A.t],[sx,gy],[tx,gy],[tx,B.t]];
    }else{
      const down=rB>rA;
      const gyA=hG(down?rA+1:rA)+lane;
      const gyB=hG(down?rB:rB+1)+lane;
      const exitY=down?A.b:A.t, entY=down?B.t:B.b;
      if(Math.abs(gyA-gyB)<1){
        pts=[[sx,exitY],[sx,gyA],[tx,gyA],[tx,entY]];
      }else{
        // long hop: run vertically inside the column gutter next to the target
        const gx=vG(cA<cB?cB:cB+1)+lane*.8;
        pts=[[sx,exitY],[sx,gyA],[gx,gyA],[gx,gyB],[tx,gyB],[tx,entY]];
      }
    }
    body+=`<path d="${roundedPath(pts,12)}" fill="none" stroke="${rt.color}" stroke-width="2" ${rt.dash?`stroke-dasharray="${rt.dash}"`:""} marker-end="url(#ah-${rel.r})" opacity=".9"/>`;
    // label on the longest horizontal run — always inside a gutter, never on a card
    let best=null,bl=-1;
    for(let i=0;i<pts.length-1;i++){
      if(Math.abs(pts[i][1]-pts[i+1][1])<1){
        const L=Math.abs(pts[i][0]-pts[i+1][0]);
        if(L>bl){bl=L;best=[(pts[i][0]+pts[i+1][0])/2,pts[i][1]];}
      }
    }
    if(best)body+=`<text x="${best[0]}" y="${best[1]-5}" font-size="10" font-weight="700" fill="${rt.color}" text-anchor="middle" stroke="#FAFBF7" stroke-width="3" paint-order="stroke">${rt.label}</text>`;
  });
  svg.innerHTML=defs+body;
}

/* ---------- service view ---------- */
function renderTool(s){
  const t=TOOL[s];
  const z=zones[t.zi],c=z.cats[t.ci];
  ovPanel.style.setProperty("--hue",c.hue);
  const long=D.long[s]||t.desc;
  const dom=D.domains[s];

  let html=`<button class="ov-close" data-hash="c/${t.zi}-${t.ci}">${UI.closeCat}</button>`;
  html+=crumbHtml([
    {label:UI.crumbRoot,hash:""},
    {label:c.title,hash:`c/${t.zi}-${t.ci}`},
    {label:t.name}
  ]);
  html+=`<div class="svc-head">${iconBox(s)}
    <div class="svc-meta">
      <h2 class="ov-title">${t.name}</h2>
      <div class="svc-cat-line">${fmt(UI.layer,{z:z.name,c:c.title})}</div>
      <div class="svc-badges">${tierBadges(t.tiers)}<span class="mini">${typeLabel[t.type]}</span>${whenLabel(s)?`<span class="mini">${whenLabel(s)}</span>`:""}${t.bt?`<span class="mini">${UI.bigtechLong}</span>`:""}
      ${dom?`<a class="svc-link" href="https://${dom}" target="_blank" rel="noopener">https://${dom} ↗</a>`:""}</div>
    </div></div>`;
  html+=`<div class="svc-body">${long.split(/\n+/).map(p=>`<p>${p}</p>`).join("")}</div>`;

  const rels=relOf(s);
  if(rels.length){
    html+=`<div class="svc-rels"><h3>${UI.svcRels}</h3><div class="xrel-items">`;
    rels.forEach(r=>{
      const rt=RTYPES[r.r];
      const other=r.f===s?r.t:r.f;
      const ot=TOOL[other];
      const dirLabel=r.f===s?`${rt.label} →`:`← ${rt.label}`;
      html+=`<div class="xrel-item">
        <span class="reltag" style="background:${rt.color}">${dirLabel}</span>
        <a data-hash="t/${other}">${ot.name}</a>
        <span class="cat-of">(${zones[ot.zi].cats[ot.ci].title})</span>
      </div>`;
    });
    html+=`</div></div>`;
  }

  const sibs=c.tools.map(x=>slug(x[0])).filter(x=>x!==s);
  if(sibs.length){
    html+=`<div class="svc-sibs"><h3>${UI.svcSibs}</h3><div class="sib-cloud">`+
      sibs.map(x=>`<span class="tile" data-hash="t/${x}">${iconBox(x)}<span class="nm">${TOOL[x].name}</span></span>`).join("")+
      `</div></div>`;
  }
  ovPanel.innerHTML=html;
}

/* ---------- language switch: carry the current hash across languages ---------- */
function syncLangLinks(){
  document.querySelectorAll("a[data-lang-base]").forEach(a=>{
    a.href=a.dataset.langBase+location.hash;
  });
}

/* ---------- event wiring ---------- */
ovPanel.addEventListener("click",e=>{
  const el=e.target.closest("[data-hash]");
  if(!el)return;
  e.stopPropagation();
  const h=el.getAttribute("data-hash");
  openFrom(el.classList.contains("tcard")||el.classList.contains("tile")?el:ovPanel);
  if(el.classList.contains("ov-close")||el.tagName==="A")zoomSrc=null; // going up: no zoom-in effect
  location.hash=h?`#${h}`:"";
  if(!h)history.replaceState(null,"",location.pathname+location.search); // drop dangling '#'
});
ov.addEventListener("click",e=>{
  if(e.target===ov)goUp();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")goUp();
});
function goUp(){
  const st=parseHash();
  if(st.level===2){
    const t=TOOL[st.s];
    zoomSrc=null;
    location.hash=`#c/${t.zi}-${t.ci}`;
  }else if(st.level===1){
    zoomSrc=null;
    location.hash="";
    history.replaceState(null,"",location.pathname+location.search);
  }
}
window.addEventListener("hashchange",render);
window.addEventListener("resize",()=>{
  const st=parseHash();
  if(st.level===1)drawArrows(catRels(st.zi,st.ci).inCat);
});
render(); // handle direct links like page.html#t/devin
