(()=>{
const c=document.getElementById('warGame');
if(!c)return;
const x=c.getContext('2d'),W=c.width,H=c.height;
const $=id=>document.getElementById(id);

const scoreE=$('warScore'),timeE=$('warTime'),interceptsE=$('warIntercepts'),threatsE=$('warThreats'),systemE=$('warSystem');
const startPanel=$('warStartPanel'),leaderPanel=$('warLeaderboardPanel'),startBtn=$('warStartBtn'),msg=$('warMessage');
const playerNameE=$('warPlayerName'),finalScoreE=$('warFinalScore'),leaderNameE=$('warLeaderboardName');
const saveBtn=$('warSaveScoreBtn'),saveStatus=$('warScoreSaveStatus'),listE=$('warLeaderboardList'),againBtn=$('warPlayAgainBtn');

let run=false,score=0,manualIntercepts=0,elapsed=0,last=0,nextThreat=2.5,runId='',scoreSaved=false,mapGeo=null,aegeanGeo=null;
let incoming=[],interceptors=[],offense=[],explosions=[],ships=[],shipRockets=[],tanks=[];
let westDefenseEvent=false,cyprusEvent=false,shipsEvent=false,tanksEvent=false,controlEvent=false,lastShipShot=0,lastFire=-9,weaponIndex=0;
const weapons=['BAYRAKTAR','BALLISTIC','CRUISE'];

playerNameE.value=localStorage.aegeanPlayerName||'PLAYER';

const MAP_BOUNDS={minLon:23.0,maxLon:40.8,minLat:29.2,maxLat:42.7,padX:34,padY:28};
function project(lon,lat){
  const b=MAP_BOUNDS;
  return {
    x:b.padX+(lon-b.minLon)/(b.maxLon-b.minLon)*(W-b.padX*2),
    y:b.padY+(b.maxLat-lat)/(b.maxLat-b.minLat)*(H-b.padY*2)
  };
}
const geoPoint=(lon,lat)=>project(lon,lat);
const turkeyTargets=[
  geoPoint(28.98,41.01),
  geoPoint(32.86,39.93),
  geoPoint(27.14,38.42),
  geoPoint(35.32,37.00),
  geoPoint(37.38,37.07)
];
const defenseBase=geoPoint(32.86,39.20);
const mersin=geoPoint(34.63,36.80);
const israelLaunch=geoPoint(34.78,31.95);
const israelTarget=geoPoint(34.82,32.05);
const turkeyLaunches={
  BAYRAKTAR:geoPoint(32.65,39.75),
  BALLISTIC:geoPoint(34.30,38.70),
  CRUISE:geoPoint(35.10,37.10)
};
const tankStart=geoPoint(36.95,37.05);
const tankEnd=geoPoint(35.15,32.15);

const westDefenseSites=[
  {name:'THRACE DEF',type:'air',p:geoPoint(26.75,40.95)},
  {name:'DARDANELLES DEF',type:'air',p:geoPoint(26.40,40.15)},
  {name:'AEGEAN DEF',type:'air',p:geoPoint(27.10,38.55)},
  {name:'SOUTHWEST DEF',type:'air',p:geoPoint(27.45,37.10)},
  {name:'ISLAND GARRISON',type:'garrison',p:geoPoint(26.15,39.15)},
  {name:'ISLAND GARRISON',type:'garrison',p:geoPoint(26.10,38.35)},
  {name:'ISLAND GARRISON',type:'garrison',p:geoPoint(27.00,37.75)},
  {name:'ISLAND GARRISON',type:'garrison',p:geoPoint(27.25,36.90)}
];

const pad=(n,k=2)=>String(Math.max(0,Math.floor(n))).padStart(k,'0');
const lerp=(a,b,t)=>a+(b-a)*t;
const rnd=(a,b)=>a+Math.random()*(b-a);
const active=()=>document.body.dataset.game==='eastmed';

function cleanName(v){
  const name=String(v||'PLAYER').replace(/[^a-zA-Z0-9 _.-]/g,'').trim().slice(0,16)||'PLAYER';
  playerNameE.value=name;leaderNameE.value=name;localStorage.aegeanPlayerName=name;return name;
}

function hud(){
  scoreE.textContent=pad(score,5);
  timeE.textContent=pad(Math.max(0,60-Math.floor(elapsed)),2);
  interceptsE.textContent=pad(manualIntercepts,2);
  threatsE.textContent=pad(incoming.filter(m=>!m.dead).length,2);
}

function note(t){
  msg.textContent=t;msg.classList.add('show');
  clearTimeout(note.t);note.t=setTimeout(()=>msg.classList.remove('show'),1200);
}

function addExplosion(px,py,color='#ffb45e',size=1){explosions.push({x:px,y:py,t:0,color,size})}

function missilePos(m){
  const t=m.p,cx=(m.x0+m.x1)/2+(m.arc||0),cy=Math.min(m.y0,m.y1)-165;
  const a=(1-t)*(1-t),b=2*(1-t)*t,d=t*t;
  return {x:a*m.x0+b*cx+d*m.x1,y:a*m.y0+b*cy+d*m.y1};
}

function spawnThreat(){
  const t=turkeyTargets[Math.floor(Math.random()*turkeyTargets.length)];
  incoming.push({x0:israelLaunch.x+rnd(-14,14),y0:israelLaunch.y+rnd(-8,8),x1:t[0]+rnd(-20,20),y1:t[1]+rnd(-12,12),p:0,speed:rnd(.12,.17),dead:false,auto:false});
  addExplosion(israelLaunch.x,israelLaunch.y,'#ff9e3d',.48);
  note('ISRAEL MISSILE LAUNCH · SPACE TO INTERCEPT');
}

function launchOffense(){
  const type=weapons[weaponIndex++%weapons.length];
  const s=turkeyLaunches[type];
  offense.push({type,x0:s.x,y0:s.y,x1:israelTarget.x+rnd(-10,10),y1:israelTarget.y+rnd(-18,18),p:0,speed:type==='BAYRAKTAR'?.18:type==='BALLISTIC'?.34:.26});
  return type;
}

function manualHit(m){
  if(m.dead)return;
  const pos=missilePos(m);m.dead=true;manualIntercepts++;
  const points=Math.round(250+(1-m.p)*750);score+=points;
  addExplosion(pos.x,pos.y,'#77edff',1.25);systemE.textContent='MANUAL';note('EARLY INTERCEPT +'+points);hud();
}

function autoHit(m){
  if(m.dead)return;
  const pos=missilePos(m);m.dead=true;m.auto=true;
  addExplosion(pos.x,pos.y,'#c3d0dc',1);systemE.textContent='AUTO';note('AUTO INTERCEPT · NO SCORE');hud();
}

function fire(){
  if(!run||!active()||window.landscapeBlocked)return;
  const now=performance.now()/1000;if(now-lastFire<.16)return;lastFire=now;
  const type=launchOffense();
  const candidates=incoming.filter(m=>!m.dead&&m.p<.82).sort((a,b)=>b.p-a.p);
  if(!candidates.length){systemE.textContent='LAUNCH';note(type+' LAUNCHED');return}
  const target=candidates[0];
  interceptors.push({target,t:0,duration:.28+rnd(0,.12),x0:defenseBase.x,y0:defenseBase.y});
  systemE.textContent='MANUAL';
}

function triggerTimeline(){
  if(!westDefenseEvent&&elapsed>=5){
    westDefenseEvent=true;
    systemE.textContent='WEST DEF';
    note('5 SEC · WESTERN DEFENSES ACTIVE');
  }
  if(!cyprusEvent&&elapsed>=10){cyprusEvent=true;note('10 SEC · CYPRUS ARCADE EVENT')}
  if(!shipsEvent&&elapsed>=20){
    shipsEvent=true;
    ships=[{p:0,lane:-20},{p:0,lane:0},{p:0,lane:20}];
    note('20 SEC · MERSIN FLEET DEPLOYED');
  }
  if(!tanksEvent&&elapsed>=30){
    tanksEvent=true;
    tanks=Array.from({length:9},(_,i)=>({p:-i*.055,lane:(i%3-1)*13}));
    note('30 SEC · GROUND COLUMN MOVING');
  }
  if(!controlEvent&&elapsed>=50){controlEvent=true;note('FINAL ARCADE CONTROL PHASE')}
}

async function loadLeaderboard(){
  try{
    const r=await fetch('/api/leaderboard?game=eastmed',{cache:'no-store'}),data=await r.json();
    const rows=Array.isArray(data.scores)?data.scores:[];listE.textContent='';
    if(!rows.length){const li=document.createElement('li');li.className='leaderboard-loading';li.textContent='No scores yet. Be the first.';listE.appendChild(li);return}
    rows.forEach((row,i)=>{
      const li=document.createElement('li'),rank=document.createElement('span'),name=document.createElement('span'),sc=document.createElement('strong');
      rank.className='leaderboard-rank';name.className='leaderboard-name';sc.className='leaderboard-score';
      rank.textContent='#'+(i+1);name.textContent=row.player||'PLAYER';sc.textContent=pad(Number(row.score)||0,5);
      li.append(rank,name,sc);listE.appendChild(li);
    });
  }catch{
    listE.textContent='';const li=document.createElement('li');li.className='leaderboard-loading';li.textContent='Leaderboard unavailable';listE.appendChild(li);
  }
}

async function saveScore(){
  if(scoreSaved){await loadLeaderboard();return;}
  const name=cleanName(leaderNameE.value||playerNameE.value);
  saveBtn.disabled=true;saveStatus.textContent='Saving…';
  try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'score',game:'eastmed',player:name,score,level:manualIntercepts,id:runId})});
    if(!r.ok)throw new Error('save');
    scoreSaved=true;saveBtn.textContent='SAVED';saveStatus.textContent='Saved ✓';await loadLeaderboard();
  }catch{saveBtn.disabled=false;saveStatus.textContent='Could not save. Try again.'}
}

function reset(){
  score=0;manualIntercepts=0;elapsed=0;last=performance.now();nextThreat=rnd(.8,1.4);
  runId=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
  incoming=[];interceptors=[];offense=[];explosions=[];ships=[];shipRockets=[];tanks=[];
  westDefenseEvent=false;cyprusEvent=false;shipsEvent=false;tanksEvent=false;controlEvent=false;lastShipShot=0;weaponIndex=0;scoreSaved=false;
  systemE.textContent='READY';hud();
}

function start(){
  if(!active())return;
  cleanName(playerNameE.value);reset();run=true;
  document.body.classList.remove('pre-game');document.body.classList.add('playing');
  startPanel.classList.remove('panel-visible');
  leaderPanel.classList.remove('panel-visible');
  leaderPanel.style.opacity='';
  leaderPanel.style.pointerEvents='';
  note('60 SEC · DEFENSE ONLINE');
}

async function end(){
  if(!run)return;
  run=false;
  document.body.classList.remove('playing');
  document.body.classList.add('pre-game');
  startPanel.classList.remove('panel-visible');
  leaderPanel.classList.add('panel-visible');
  leaderPanel.style.opacity='1';
  leaderPanel.style.pointerEvents='auto';

  finalScoreE.textContent=pad(score,5);
  leaderNameE.value=localStorage.aegeanPlayerName||playerNameE.value||'PLAYER';
  saveBtn.disabled=false;saveBtn.textContent='SAVE SCORE';
  saveStatus.textContent='Saving score…';

  await saveScore();
  await loadLeaderboard();

  requestAnimationFrame(()=>{
    leaderPanel.scrollIntoView({block:'center',behavior:'instant'});
    setTimeout(()=>leaderNameE.focus(),80);
  });
}

function update(dt){
  if(!run)return;
  elapsed+=dt;triggerTimeline();

  if(elapsed>=nextThreat&&elapsed<58){spawnThreat();nextThreat=elapsed+rnd(elapsed>35?1.6:2.4,elapsed>35?3.0:4.2)}

  for(const m of incoming){if(m.dead)continue;m.p+=m.speed*dt;if(m.p>=.82)autoHit(m)}
  for(const q of interceptors){
    q.t+=dt;
    if(q.t>=q.duration&&!q.done){q.done=true;if(q.target&&!q.target.dead&&q.target.p<.82)manualHit(q.target)}
  }
  interceptors=interceptors.filter(q=>q.t<q.duration+.2);

  for(const a of offense)a.p+=a.speed*dt;
  offense=offense.filter(a=>a.p<1.1);

  if(shipsEvent){
    for(const s of ships)s.p=Math.min(1,s.p+dt*.045);
    if(elapsed-lastShipShot>1.2){
      lastShipShot=elapsed;
      for(const s of ships){
        if(s.p>.07){
          const sx=lerp(mersin.x,israelTarget.x-70,s.p),sy=lerp(mersin.y+s.lane,israelTarget.y+s.lane*.15,s.p);
          shipRockets.push({x0:sx,y0:sy,x1:israelTarget.x+rnd(-14,14),y1:israelTarget.y+rnd(-18,18),p:0,speed:rnd(.45,.62)});
        }
      }
    }
  }
  for(const r of shipRockets)r.p+=r.speed*dt;
  shipRockets=shipRockets.filter(r=>r.p<1.08);

  if(tanksEvent)for(const t of tanks)t.p=Math.min(1,t.p+dt*.035);
  for(const e of explosions)e.t+=dt;
  explosions=explosions.filter(e=>e.t<.75);
  hud();
  if(elapsed>=60){elapsed=60;end();}
}

function countryStyle(name){
  if(name==='Turkey')return {fill:'rgba(136,48,59,.46)',stroke:'rgba(255,101,112,.78)'};
  if(name==='Cyprus')return cyprusEvent
    ? {fill:'rgba(136,48,59,.46)',stroke:'rgba(255,101,112,.78)'}
    : {fill:'rgba(120,130,145,.25)',stroke:'rgba(190,205,220,.35)'};
  if(name==='Israel')return controlEvent
    ? {fill:'rgba(136,48,59,.34)',stroke:'rgba(255,101,112,.72)'}
    : {fill:'rgba(55,92,135,.42)',stroke:'rgba(112,190,255,.72)'};
  return {fill:'rgba(39,63,82,.28)',stroke:'rgba(126,160,184,.34)'};
}

function drawCountry(feature){
  const name=feature.properties?.name||'';
  const style=countryStyle(name);
  const polys=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
  for(const poly of polys){
    x.beginPath();
    for(const ring of poly){
      ring.forEach((v,i)=>{
        const p=project(v[0],v[1]);
        i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y);
      });
      x.closePath();
    }
    x.fillStyle=style.fill;x.fill('evenodd');
    x.strokeStyle=style.stroke;x.lineWidth=name==='Turkey'||name==='Israel'||name==='Cyprus'?1.8:1;x.stroke();

    if(name==='Cyprus'&&!cyprusEvent){
      x.save();
      x.clip('evenodd');
      const northY=project(33.2,34.97).y;
      x.fillStyle='rgba(136,48,59,.52)';
      x.fillRect(0,0,W,northY);
      x.restore();

      x.strokeStyle='rgba(255,101,112,.72)';
      x.lineWidth=1.3;
      x.stroke();
    }
  }
}

function polygonStats(poly){
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity,sumLon=0,sumLat=0,n=0;
  for(const ring of poly)for(const v of ring){
    const lon=v[0],lat=v[1];
    minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
    minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
    sumLon+=lon;sumLat+=lat;n++;
  }
  return n?{lon:sumLon/n,lat:sumLat/n,w:maxLon-minLon,h:maxLat-minLat}:null;
}

function drawAegeanTurkeyIslands(){
  if(!aegeanGeo)return;
  const gr=aegeanGeo.features.find(f=>f.properties?.side==='GR');
  if(!gr)return;
  const polys=gr.geometry.type==='MultiPolygon'?gr.geometry.coordinates:[gr.geometry.coordinates];

  for(const poly of polys){
    const s=polygonStats(poly);
    if(!s)continue;
    const easternIsland=s.lon>25.45&&s.lon<29.2&&s.lat>35.0&&s.lat<41.6&&s.w<1.15&&s.h<1.05;
    if(!easternIsland)continue;

    x.beginPath();
    for(const ring of poly){
      ring.forEach((v,i)=>{
        const p=project(v[0],v[1]);
        i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y);
      });
      x.closePath();
    }
    x.fillStyle='rgba(136,48,59,.52)';
    x.fill('evenodd');
    x.strokeStyle='rgba(255,101,112,.82)';
    x.lineWidth=1.4;
    x.stroke();
  }
}

function label(text,px,py,color='rgba(235,245,255,.7)',size=15){
  x.fillStyle=color;x.font='800 '+size+'px system-ui';x.fillText(text,px,py);
}

function drawMap(){
  const sea=x.createLinearGradient(0,0,0,H);sea.addColorStop(0,'#071b2e');sea.addColorStop(1,'#03101b');x.fillStyle=sea;x.fillRect(0,0,W,H);

  x.strokeStyle='rgba(84,190,225,.08)';x.lineWidth=1;
  for(let gx=40;gx<W;gx+=80){x.beginPath();x.moveTo(gx,0);x.lineTo(gx,H);x.stroke()}
  for(let gy=40;gy<H;gy+=80){x.beginPath();x.moveTo(0,gy);x.lineTo(W,gy);x.stroke()}

  if(mapGeo)for(const feature of mapGeo.features)drawCountry(feature);
  drawAegeanTurkeyIslands();

  const tr=geoPoint(32.2,39.1),cy=geoPoint(33.15,35.15),il=geoPoint(34.7,31.7),sy=geoPoint(37.2,35.0),lb=geoPoint(35.55,33.9),eg=geoPoint(30.1,31.2),nc=geoPoint(33.25,35.10);
  label('TÜRKİYE',tr.x,tr.y,'rgba(255,210,214,.82)',20);
  label(cyprusEvent?'CYPRUS · ARCADE CONTROL':'CYPRUS',cy.x-40,cy.y,cyprusEvent?'rgba(255,180,188,.85)':'rgba(205,220,230,.55)',11);
  if(!cyprusEvent)label('NORTH CYPRUS',nc.x-42,nc.y-5,'rgba(255,180,188,.82)',9);
  label(controlEvent?'ISRAEL · ARCADE CONTROL':'ISRAEL',il.x-18,il.y,controlEvent?'rgba(255,180,188,.85)':'rgba(180,215,245,.76)',13);
  label('SYRIA',sy.x,sy.y,'rgba(185,205,220,.42)',10);
  label('LEBANON',lb.x-10,lb.y,'rgba(185,205,220,.42)',9);
  label('EGYPT',eg.x,eg.y,'rgba(185,205,220,.38)',11);
  label('E A S T E R N   M E D I T E R R A N E A N',430,525,'rgba(105,230,255,.18)',13);

  x.fillStyle='#e93b48';x.beginPath();x.arc(defenseBase.x,defenseBase.y,7,0,Math.PI*2);x.fill();
  label('AIR DEFENSE',defenseBase.x-42,defenseBase.y-14,'rgba(255,220,224,.75)',10);
  x.fillStyle='#ef3340';x.beginPath();x.arc(mersin.x,mersin.y,5,0,Math.PI*2);x.fill();
  label('MERSIN',mersin.x-27,mersin.y+23,'rgba(255,220,224,.65)',10);
}

function drawWestDefenses(){
  if(!westDefenseEvent)return;

  const pulse=.58+.42*Math.sin(performance.now()*.006);

  for(const site of westDefenseSites){
    const p=site.p;

    if(site.type==='air'){
      x.save();
      x.strokeStyle='rgba(105,230,255,'+(0.28+.34*pulse)+')';
      x.lineWidth=2;
      x.beginPath();x.arc(p.x,p.y,18+5*pulse,0,Math.PI*2);x.stroke();

      x.fillStyle='rgba(105,230,255,.92)';
      x.beginPath();x.arc(p.x,p.y,5,0,Math.PI*2);x.fill();

      x.strokeStyle='rgba(210,250,255,.88)';
      x.lineWidth=2;
      x.beginPath();x.moveTo(p.x,p.y-11);x.lineTo(p.x,p.y+11);x.moveTo(p.x-11,p.y);x.lineTo(p.x+11,p.y);x.stroke();

      x.fillStyle='rgba(210,245,255,.86)';
      x.font='900 9px ui-monospace,monospace';
      x.fillText('AIR DEF',p.x+12,p.y-12);
      x.restore();
    } else {
      x.save();
      x.fillStyle='rgba(230,236,214,.92)';
      x.fillRect(p.x-5,p.y-5,10,10);
      x.strokeStyle='rgba(255,255,255,.72)';
      x.lineWidth=1.5;
      x.strokeRect(p.x-8,p.y-8,16,16);
      x.fillStyle='rgba(235,242,226,.78)';
      x.font='900 8px ui-monospace,monospace';
      x.fillText('GARRISON',p.x+10,p.y+3);
      x.restore();
    }
  }

  const a=geoPoint(26.1,40.95),b=geoPoint(27.55,36.75);
  x.save();
  x.setLineDash([8,8]);
  x.strokeStyle='rgba(105,230,255,.24)';
  x.lineWidth=2;
  x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke();
  x.setLineDash([]);
  x.fillStyle='rgba(170,232,245,.64)';
  x.font='900 10px ui-monospace,monospace';
  x.fillText('WESTERN DEFENSE LINE · HOLD',a.x+8,(a.y+b.y)/2);
  x.restore();
}

function drawIncoming(){
  const pulse=.65+.35*Math.sin(performance.now()*.012);

  for(const m of incoming){
    if(m.dead)continue;

    const p=missilePos(m);
    const q=missilePos({...m,p:Math.max(0,m.p-.09)});
    const r=missilePos({...m,p:Math.max(0,m.p-.018)});
    const ang=Math.atan2(p.y-r.y,p.x-r.x);

    // Bright long trail, deliberately oversized so it stays visible on phones.
    x.save();
    x.lineCap='round';
    x.shadowColor='#ff6b2f';
    x.shadowBlur=20;

    x.strokeStyle='rgba(255,72,34,.22)';
    x.lineWidth=13;
    x.beginPath();x.moveTo(q.x,q.y);x.lineTo(p.x,p.y);x.stroke();

    x.strokeStyle='rgba(255,205,91,.96)';
    x.lineWidth=4.5;
    x.beginPath();x.moveTo(q.x,q.y);x.lineTo(p.x,p.y);x.stroke();

    // Missile body / arrow head.
    x.translate(p.x,p.y);
    x.rotate(ang);
    x.fillStyle='#fff2b2';
    x.beginPath();
    x.moveTo(13,0);x.lineTo(-8,-6);x.lineTo(-4,0);x.lineTo(-8,6);x.closePath();
    x.fill();
    x.restore();

    // Pulsing threat ring and label.
    x.save();
    x.strokeStyle='rgba(255,70,40,'+(0.45+.4*pulse)+')';
    x.lineWidth=2.5;
    x.beginPath();x.arc(p.x,p.y,15+5*pulse,0,Math.PI*2);x.stroke();
    x.fillStyle='rgba(255,226,190,.95)';
    x.font='900 12px ui-monospace,monospace';
    x.fillText('INCOMING',p.x+18,p.y-12);
    x.restore();
  }

  // Make the launch point visibly pulse whenever a threat is in flight.
  if(incoming.some(m=>!m.dead)){
    x.save();
    x.strokeStyle='rgba(255,120,45,'+(0.35+.45*pulse)+')';
    x.lineWidth=3;
    x.beginPath();x.arc(israelLaunch.x,israelLaunch.y,12+10*pulse,0,Math.PI*2);x.stroke();
    x.fillStyle='#ff9e3d';
    x.beginPath();x.arc(israelLaunch.x,israelLaunch.y,5,0,Math.PI*2);x.fill();
    x.restore();
  }

  for(const q of interceptors){
    const target=q.target&&!q.target.dead?missilePos(q.target):{x:defenseBase.x+90,y:defenseBase.y+40};
    const t=Math.min(1,q.t/q.duration),px=lerp(q.x0,target.x,t),py=lerp(q.y0,target.y,t);
    x.save();
    x.lineCap='round';
    x.shadowColor='#69e6ff';x.shadowBlur=18;
    x.strokeStyle='rgba(105,230,255,.34)';x.lineWidth=10;
    x.beginPath();x.moveTo(q.x0,q.y0);x.lineTo(px,py);x.stroke();
    x.strokeStyle='rgba(190,249,255,.96)';x.lineWidth=3.5;
    x.beginPath();x.moveTo(q.x0,q.y0);x.lineTo(px,py);x.stroke();
    x.fillStyle='#e9feff';x.beginPath();x.arc(px,py,5,0,Math.PI*2);x.fill();
    x.restore();
  }
}

function drawOffense(){
  for(const a of offense){
    const t=a.p,px=lerp(a.x0,a.x1,t),base=lerp(a.y0,a.y1,t),py=base-Math.sin(Math.PI*Math.min(1,t))*120;
    x.strokeStyle=a.type==='BAYRAKTAR'?'rgba(255,255,255,.4)':'rgba(255,80,90,.48)';
    x.lineWidth=2;x.beginPath();x.moveTo(a.x0,a.y0);x.lineTo(px,py);x.stroke();
    x.fillStyle=a.type==='BAYRAKTAR'?'#f2f5f8':'#ef3340';x.fillRect(px-4,py-2,8,4);
    if(t>=.98)addExplosion(a.x1,a.y1,'#ff665f',.65);
  }

  for(const r of shipRockets){
    const px=lerp(r.x0,r.x1,r.p),py=lerp(r.y0,r.y1,r.p)-Math.sin(Math.PI*Math.min(1,r.p))*55;
    x.strokeStyle='rgba(255,99,89,.42)';x.lineWidth=1.5;x.beginPath();x.moveTo(r.x0,r.y0);x.lineTo(px,py);x.stroke();
    x.fillStyle='#ff6d5e';x.fillRect(px-3,py-1.5,6,3);
  }
}

function drawShips(){
  for(const s of ships){
    const px=lerp(mersin.x,israelTarget.x-70,s.p),py=lerp(mersin.y+s.lane,israelTarget.y+s.lane*.15,s.p);
    x.save();x.translate(px,py);x.fillStyle='#d9e8ef';x.fillRect(-12,-3,24,6);x.fillStyle='#7d9fb3';x.fillRect(-4,-8,8,5);x.restore();
  }
}

function drawTanks(){
  for(const t of tanks){
    const p=Math.max(0,t.p),px=lerp(tankStart.x,tankEnd.x,p),py=lerp(tankStart.y+t.lane,tankEnd.y+t.lane*.2,p);
    x.save();x.translate(px,py);x.rotate(.55);x.fillStyle='#b5c0a2';x.fillRect(-8,-5,16,10);x.fillRect(0,-2,11,3);x.restore();
  }
}

function drawExplosions(){
  for(const e of explosions){
    const k=e.t/.75,r=(8+32*k)*e.size;
    x.globalAlpha=Math.max(0,1-k);x.strokeStyle=e.color;x.lineWidth=4;x.beginPath();x.arc(e.x,e.y,r,0,Math.PI*2);x.stroke();
    x.globalAlpha=.55*(1-k);x.fillStyle=e.color;x.beginPath();x.arc(e.x,e.y,r*.35,0,Math.PI*2);x.fill();
  }
  x.globalAlpha=1;
}

function draw(t){
  drawMap();drawWestDefenses();drawIncoming();drawOffense();drawShips();drawTanks();drawExplosions();

  if(run){
    x.fillStyle='rgba(255,255,255,.72)';x.font='900 13px ui-monospace,monospace';
    x.fillText(matchMedia('(pointer:coarse)').matches?'TAP = INTERCEPT + LAUNCH':'SPACE = INTERCEPT + LAUNCH',38,H-32);
    const pct=Math.min(1,elapsed/60);
    x.fillStyle='rgba(255,255,255,.08)';x.fillRect(38,H-20,W-76,5);
    x.fillStyle='#ef3340';x.fillRect(38,H-20,(W-76)*pct,5);
  }

  const v=x.createRadialGradient(W/2,H/2,120,W/2,H/2,W*.7);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(0,0,0,.48)');x.fillStyle=v;x.fillRect(0,0,W,H);
}

function loop(t){
  const dt=Math.min(.05,(t-last)/1000||0);last=t;
  if(active()&&!window.landscapeBlocked)update(dt);
  draw(t);requestAnimationFrame(loop);
}

document.addEventListener('keydown',e=>{
  if(!active())return;
  if(e.code==='Space'){
    e.preventDefault();
    if(run)fire();
    else if(startPanel.classList.contains('panel-visible'))start();
  }
},{passive:false});

c.addEventListener('pointerdown',e=>{
  if(!active()||!run)return;
  e.preventDefault();
  fire();
},{passive:false});

startBtn.onclick=start;
againBtn.onclick=start;
saveBtn.onclick=saveScore;
leaderNameE.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveScore()}});
fetch('./eastmed-map.json').then(r=>r.json()).then(j=>mapGeo=j).catch(()=>0);
fetch('./aegean-map.json').then(r=>r.json()).then(j=>aegeanGeo=j).catch(()=>0);
loadLeaderboard();hud();requestAnimationFrame(loop);
})();