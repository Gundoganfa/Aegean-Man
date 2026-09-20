(()=>{
const c=document.getElementById('game'),x=c.getContext('2d'),W=c.width,H=c.height,C=31,R=17,T=36,OX=(W-C*T)/2,OY=(H-R*T)/2;
const $=id=>document.getElementById(id),scoreE=$('score'),highE=$('highScore'),levelE=$('level'),flagsE=$('flagsLeft'),onlineE=$('onlinePlayers'),panel=$('startPanel'),btn=$('startBtn'),msg=$('message'),playerNameE=$('playerName'),leaderboardPanel=$('leaderboardPanel'),leaderboardList=$('leaderboardList'),leaderboardTitle=$('leaderboardTitle'),leaderboardSubtitle=$('leaderboardSubtitle'),leaderboardFooter=$('leaderboardFooter'),finalScoreE=$('finalScore'),leaderboardNameE=$('leaderboardName'),saveScoreBtn=$('saveScoreBtn'),scoreSaveStatus=$('scoreSaveStatus'),playAgainBtn=$('playAgainBtn'),adminEditBtn=$('adminEditBtn'),adminEditor=$('adminEditor'),titleInput=$('leaderboardTitleInput'),subtitleInput=$('leaderboardSubtitleInput'),footerInput=$('leaderboardFooterInput'),saveBoardText=$('saveLeaderboardText'),cancelBoardEdit=$('cancelLeaderboardEdit');
const D={left:[-1,0,Math.PI],right:[1,0,0],up:[0,-1,-Math.PI/2],down:[0,1,Math.PI/2]},opp={left:'right',right:'left',up:'down',down:'up'};
let geo=null,run=0,score=0,level=1,lives=3,hi=+localStorage.aegeanManHigh||0,w=[],flags=new Map,storms=[],dir='right',queued='right',px=2,py=8,last=0,acc=0,particles=[],audioCtx=null,musicTimer=null,musicStep=0,swipeX=0,swipeY=0,swiping=false,presenceTimer=null,runId='',scoreSaved=false,adminPassword='',boardCopy={title:'AEGEAN CHAMPIONS',subtitle:'Top pilots of the boss level.',footer:'Survive. Adapt. Level up anyway.'};
const pad=(n,k)=>String(Math.max(0,n|0)).padStart(k,'0'),cx=a=>OX+a*T+T/2,cy=a=>OY+a*T+T/2,key=(a,b)=>a+','+b;
highE.textContent=pad(hi,5);document.body.classList.add('pre-game');playerNameE.value=localStorage.aegeanPlayerName||'PLAYER';
const presenceId=sessionStorage.aegeanPresenceId||(sessionStorage.aegeanPresenceId=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)));
async function syncPresence(){
  try{
    const res=await fetch('/api/presence',{method:run?'POST':'GET',headers:run?{'content-type':'application/json'}:undefined,body:run?JSON.stringify({id:presenceId}):undefined,cache:'no-store'});
    const data=await res.json();
    onlineE.textContent=data.online==null?'—':String(data.online);
    onlineE.title=data.configured===false?'Live counter needs Redis/KV configuration':'Players active in the last 45 seconds';
  }catch{onlineE.textContent='—'}
}
function beginPresence(){window.updateGlobalOnline?.()}
function endPresence(){window.updateGlobalOnline?.()}
syncPresence();
function safePlayerName(){
  const value=(playerNameE.value||'PLAYER').replace(/[^a-zA-Z0-9 _.-]/g,'').trim().slice(0,16)||'PLAYER';
  playerNameE.value=value;
  localStorage.aegeanPlayerName=value;
  return value;
}
function renderLeaderboard(data){
  boardCopy=data?.copy||boardCopy;
  leaderboardTitle.textContent=boardCopy.title||'AEGEAN CHAMPIONS';
  leaderboardSubtitle.textContent=boardCopy.subtitle||'Top pilots of the boss level.';
  leaderboardFooter.textContent=boardCopy.footer||'Survive. Adapt. Level up anyway.';
  leaderboardList.textContent='';
  const rows=Array.isArray(data?.scores)?data.scores:[];
  if(!rows.length){
    const li=document.createElement('li');li.className='leaderboard-loading';li.textContent='No scores yet. Be the first.';leaderboardList.appendChild(li);return;
  }
  rows.forEach((row,idx)=>{
    const li=document.createElement('li');
    const rank=document.createElement('span'),name=document.createElement('span'),sc=document.createElement('strong');
    rank.className='leaderboard-rank';name.className='leaderboard-name';sc.className='leaderboard-score';
    rank.textContent='#'+(idx+1);name.textContent=row.player||'PLAYER';sc.textContent=pad(Number(row.score)||0,5);
    li.append(rank,name,sc);leaderboardList.appendChild(li);
  });
}
async function loadLeaderboard(){
  try{
    const r=await fetch('/api/leaderboard',{cache:'no-store'});
    renderLeaderboard(await r.json());
  }catch{
    leaderboardList.textContent='';const li=document.createElement('li');li.className='leaderboard-loading';li.textContent='Leaderboard unavailable';leaderboardList.appendChild(li);
  }
}
async function submitScore(){
  if(scoreSaved)return true;
  const value=(leaderboardNameE.value||playerNameE.value||'PLAYER').replace(/[^a-zA-Z0-9 _.-]/g,'').trim().slice(0,16)||'PLAYER';
  leaderboardNameE.value=value;
  playerNameE.value=value;
  localStorage.aegeanPlayerName=value;
  saveScoreBtn.disabled=true;
  scoreSaveStatus.textContent='Saving…';
  try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'score',player:value,score,level,id:runId})});
    if(!r.ok)throw new Error('save failed');
    scoreSaved=true;
    scoreSaveStatus.textContent='Saved ✓';
    saveScoreBtn.textContent='SAVED';
    await loadLeaderboard();
    return true;
  }catch{
    saveScoreBtn.disabled=false;
    scoreSaveStatus.textContent='Could not save. Try again.';
    return false;
  }
}
async function finishRun(){
  finalScoreE.textContent=pad(score,5);
  leaderboardNameE.value=localStorage.aegeanPlayerName||playerNameE.value||'PLAYER';
  scoreSaved=false;
  saveScoreBtn.disabled=false;
  saveScoreBtn.textContent='SAVE SCORE';
  scoreSaveStatus.textContent='Enter your name and save your score.';
  leaderboardList.textContent='';const loading=document.createElement('li');loading.className='leaderboard-loading';loading.textContent='Loading leaderboard…';leaderboardList.appendChild(loading);
  panel.classList.remove('panel-visible');
  leaderboardPanel.classList.add('panel-visible');
  await loadLeaderboard();
  setTimeout(()=>leaderboardNameE.focus(),120);
}
function walls(){w=Array.from({length:R},()=>Array(C).fill(0));for(let i=0;i<C;i++)w[0][i]=w[R-1][i]=1;for(let i=0;i<R;i++)w[i][0]=w[i][C-1]=1;[[5,2,1,4],[5,8,1,6],[9,1,1,5],[9,8,1,3],[9,13,1,3],[13,3,1,4],[13,9,1,6],[17,1,1,4],[17,7,1,4],[17,13,1,3],[21,3,1,5],[21,10,1,5],[25,1,1,5],[25,8,1,6],[3,6,5,1],[11,7,5,1],[19,8,5,1],[23,6,5,1],[2,12,4,1],[7,11,5,1],[14,5,4,1],[18,13,5,1],[26,12,3,1]].forEach(([a,b,q,z])=>{for(let j=b;j<b+z;j++)for(let i=a;i<a+q;i++)w[j][i]=1})}
const open=(a,b)=>a>0&&b>0&&a<C-1&&b<R-1&&!w[b][a];
function makeFlags(){flags.clear();for(let b=1;b<R-1;b++)for(let a=1;a<C-1;a++)if(open(a,b)&&!(a==2&&b==8)&&((a*13+b*17)%5==0))flags.set(key(a,b),[a,b,Math.random()*6.28]);flagsE.textContent=pad(flags.size,2)}
function makeStorms(){storms=[];[[28,3,'left'],[15,14,'up'],[11,4,'right'],[23,14,'left']].slice(0,Math.min(2+(level>>1),4)).forEach(([a,b,d])=>{while(!open(a,b))a--;storms.push({a,b,d,t:0})})}
function hud(){scoreE.textContent=pad(score,5);highE.textContent=pad(Math.max(score,hi),5);levelE.textContent=pad(level,2);flagsE.textContent=pad(flags.size,2)}
function note(s){msg.textContent=s;msg.classList.add('show');setTimeout(()=>msg.classList.remove('show'),1200)}
function burst(a,b,col){for(let i=0;i<12;i++){let q=Math.random()*6.28,v=40+Math.random()*90;particles.push({x:a,y:b,vx:Math.cos(q)*v,vy:Math.sin(q)*v,l:.5+Math.random()*.4,c:col})}}
function beep(freq,dur=.09,type='square',vol=.025){
  if(!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain(),now=audioCtx.currentTime;
  o.type=type;o.frequency.setValueAtTime(freq,now);
  g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.01);g.gain.exponentialRampToValueAtTime(0.0001,now+dur);
  o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+dur+.02);
}
function startMusic(){
  if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended')audioCtx.resume();
  if(musicTimer)return;
  const bass=[110,110,130.81,146.83,110,110,164.81,146.83];
  const lead=[220,261.63,329.63,392,329.63,261.63,246.94,293.66];
  musicTimer=setInterval(()=>{
    const n=musicStep++%8;
    beep(bass[n],.13,'sawtooth',.018);
    if(n%2===0)beep(lead[n],.08,'square',.012);
  },150);
}
function stopMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null}}
function start(){if(document.body.dataset.game!=='aegean')return;score=0;level=1;lives=3;scoreSaved=false;px=2;py=8;dir=queued='right';runId=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));safePlayerName();walls();makeFlags();makeStorms();hud();run=1;beginPresence();document.body.classList.remove('pre-game');document.body.classList.add('playing');adminEditor.hidden=true;leaderboardPanel.classList.remove('panel-visible');panel.classList.remove('panel-visible');startMusic();note('LEVEL 01 · BOSS MODE')}
function over(){run=0;endPresence();document.body.classList.remove('playing');document.body.classList.add('pre-game');stopMusic();if(score>hi){hi=score;localStorage.aegeanManHigh=hi}hud();finishRun()}
function next(){level++;score+=1000*level;px=2;py=8;dir=queued='right';makeFlags();makeStorms();hud();note('LEVEL '+pad(level,2)+' · HARDER')}
function move(){if(!run)return;let q=D[queued];if(open(px+q[0],py+q[1]))dir=queued;let d=D[dir];if(open(px+d[0],py+d[1])){px+=d[0];py+=d[1]}let k=key(px,py);if(flags.has(k)){flags.delete(k);score+=100+level*15;burst(cx(px),cy(py),'#69e6ff');hud();if(!flags.size)next()}for(let s of storms){if(s.a==px&&s.b==py){lives--;burst(cx(px),cy(py),'#ff4d5e');px=2;py=8;if(lives<=0)over();else note('STORM HIT · '+lives+' LIVES LEFT');break}}}
function stormMove(){for(let s of storms){let opts=Object.keys(D).filter(n=>{let d=D[n];return n!=opp[s.d]&&open(s.a+d[0],s.b+d[1])});if(!opts.length)opts=[opp[s.d]];if(!opts.includes(s.d)||Math.random()<.3)s.d=opts[Math.random()*opts.length|0];let d=D[s.d];if(open(s.a+d[0],s.b+d[1])){s.a+=d[0];s.b+=d[1]}}}
function nearTurkeyIsland(poly){
  let minLon=Infinity,maxLon=-Infinity,minLat=Infinity,maxLat=-Infinity,sumLon=0,sumLat=0,n=0;
  for(const ring of poly)for(const v of ring){
    const lon=v[0],lat=v[1];
    minLon=Math.min(minLon,lon);maxLon=Math.max(maxLon,lon);
    minLat=Math.min(minLat,lat);maxLat=Math.max(maxLat,lat);
    sumLon+=lon;sumLat+=lat;n++;
  }
  if(!n)return false;
  const lon=sumLon/n,lat=sumLat/n;
  return lon>25.75&&maxLon>25.9&&lat>35.3&&lat<39.6&&(maxLon-minLon)<1.1&&(maxLat-minLat)<.9;
}
function map(){
  if(!geo)return;
  for(const f of geo.features){
    const g=f.geometry,polys=g.type=='MultiPolygon'?g.coordinates:[g.coordinates];
    for(const poly of polys){
      x.beginPath();
      for(const ring of poly)ring.forEach((v,i)=>{
        const X=(v[0]-19)/12.2*W,Y=(42.5-v[1])/8.3*H;
        i?x.lineTo(X,Y):x.moveTo(X,Y);
      });
      const turkeyTone=f.properties.side=='TR'||(f.properties.side=='GR'&&nearTurkeyIsland(poly));
      x.fillStyle=turkeyTone?'rgba(118,58,68,.28)':'rgba(52,79,110,.28)';
      x.strokeStyle=turkeyTone?'rgba(255,104,112,.42)':'rgba(112,190,255,.42)';
      x.lineWidth=1;x.fill('evenodd');x.stroke();
    }
  }
  x.font='800 13px system-ui';x.fillStyle='rgba(190,220,240,.43)';x.fillText('GREECE',170,290);x.fillText('TÜRKİYE',990,325);x.fillStyle='rgba(105,230,255,.3)';x.fillText('A E G E A N   S E A',525,370)
}
function greek(a,b,s=1){let q=20*s,z=14*s,A=a-q/2,B=b-z/2;x.save();x.shadowColor='#58b7ff';x.shadowBlur=7;x.fillStyle='white';x.fillRect(A,B,q,z);x.fillStyle='#1769aa';let h=z/9;for(let i=0;i<9;i+=2)x.fillRect(A,B+i*h,q,h+.2);let m=z*5/9;x.fillRect(A,B,m,m);x.fillStyle='white';x.fillRect(A+m*.4,B,m*.2,m);x.fillRect(A,B+m*.4,m,m*.2);x.restore()}
function star(a,b,r){x.beginPath();for(let i=0;i<10;i++){let q=i%2?r:r*.42,t=-Math.PI/2+i*Math.PI/5,A=a+Math.cos(t)*q,B=b+Math.sin(t)*q;i?x.lineTo(A,B):x.moveTo(A,B)}x.closePath();x.fill()}
function player(t){x.save();x.translate(cx(px),cy(py));x.rotate(D[dir][2]);let m=.2+Math.abs(Math.sin(t*.012))*.12;x.shadowColor='#ff4452';x.shadowBlur=22;x.beginPath();x.moveTo(0,0);x.arc(0,0,15,m,6.28-m);x.closePath();x.fillStyle='#e92f3c';x.fill();x.rotate(-D[dir][2]);x.fillStyle='white';x.beginPath();x.arc(-2,0,7.3,0,6.28);x.fill();x.fillStyle='#e92f3c';x.beginPath();x.arc(1.3,-.5,6.5,0,6.28);x.fill();x.fillStyle='white';star(6,0,3.5);x.restore()}
function draw(t){let g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,'#07192b');g.addColorStop(1,'#030a13');x.fillStyle=g;x.fillRect(0,0,W,H);map();for(let b=0;b<R;b++)for(let a=0;a<C;a++)if(w[b][a]){
  x.save();
  x.shadowColor='rgba(80,220,255,.85)';x.shadowBlur=8;
  x.fillStyle='rgba(2,9,18,.94)';
  x.strokeStyle='rgba(88,222,255,.78)';
  x.lineWidth=2.2;
  x.beginPath();x.roundRect(OX+a*T+2,OY+b*T+2,T-4,T-4,8);x.fill();x.stroke();
  x.strokeStyle='rgba(20,105,150,.55)';x.lineWidth=1;
  x.beginPath();x.roundRect(OX+a*T+7,OY+b*T+7,T-14,T-14,6);x.stroke();
  x.restore()
}for(let f of flags.values())greek(cx(f[0]),cy(f[1]),.82+Math.sin(t*.004+f[2])*.1);for(let s of storms){x.save();x.translate(cx(s.a),cy(s.b));x.rotate(t*.004+s.a);x.strokeStyle='#c066ff';x.lineWidth=4;x.shadowColor='#c066ff';x.shadowBlur=18;for(let i=0;i<3;i++){x.beginPath();x.arc(0,0,9+i*5,i,Math.PI*1.2+i);x.stroke()}x.restore()}player(t);for(let p of particles){x.globalAlpha=Math.max(0,p.l*2);x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,2.5,0,6.28);x.fill()}x.globalAlpha=1;x.font='800 11px system-ui';x.fillStyle='rgba(220,235,245,.65)';x.fillText('LIVES',24,32);for(let i=0;i<3;i++){x.fillStyle=i<lives?'#ef3340':'rgba(255,255,255,.12)';x.beginPath();x.arc(30+i*18,50,5.5,0,6.28);x.fill()}let v=x.createRadialGradient(W/2,H/2,100,W/2,H/2,W*.65);v.addColorStop(0,'transparent');v.addColorStop(1,'rgba(0,0,0,.5)');x.fillStyle=v;x.fillRect(0,0,W,H)}
function loop(t){let dt=Math.min(.05,(t-last)/1000||0);last=t;if(run&&!window.landscapeBlocked){acc+=dt;if(acc>.11){move();acc=0}storms.forEach(s=>s.t+=dt);if(storms[0]&&storms[0].t>.34){stormMove();storms.forEach(s=>s.t=0)}}for(let p of particles){p.l-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=35*dt}particles=particles.filter(p=>p.l>0);draw(t);requestAnimationFrame(loop)}
document.addEventListener('keydown',e=>{if(document.body.dataset.game!=='aegean')return;let m={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down'};if(m[e.key]){e.preventDefault();queued=m[e.key]}if((e.key==' '||e.key=='Enter')&&!run)start()},{passive:false});document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();queued=b.dataset.dir},{passive:false}));
c.addEventListener('pointerdown',e=>{swiping=true;swipeX=e.clientX;swipeY=e.clientY;c.setPointerCapture?.(e.pointerId)},{passive:true});
c.addEventListener('pointermove',e=>{
  if(!swiping||!run)return;
  const dx=e.clientX-swipeX,dy=e.clientY-swipeY;
  if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
  queued=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');
  swipeX=e.clientX;swipeY=e.clientY;
},{passive:true});
c.addEventListener('pointerup',()=>swiping=false,{passive:true});
c.addEventListener('pointercancel',()=>swiping=false,{passive:true});
btn.onclick=start;
playAgainBtn.onclick=start;
saveScoreBtn.onclick=submitScore;
leaderboardNameE.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();submitScore()}});
playerNameE.addEventListener('change',safePlayerName);
adminEditBtn.onclick=async()=>{
  const password=prompt('Admin password');
  if(!password)return;
  try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'auth',password})});
    if(!r.ok){alert('Wrong password');return}
    adminPassword=password;
    titleInput.value=boardCopy.title||'';
    subtitleInput.value=boardCopy.subtitle||'';
    footerInput.value=boardCopy.footer||'';
    adminEditor.hidden=false;
  }catch{alert('Admin check unavailable')}
};
cancelBoardEdit.onclick=()=>{adminEditor.hidden=true;adminPassword=''};
saveBoardText.onclick=async()=>{
  if(!adminPassword)return;
  try{
    const r=await fetch('/api/leaderboard',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'copy',password:adminPassword,title:titleInput.value,subtitle:subtitleInput.value,footer:footerInput.value})});
    if(!r.ok){alert('Could not save text');return}
    renderLeaderboard(await r.json());
    adminEditor.hidden=true;adminPassword='';
  }catch{alert('Could not save text')}
};
loadLeaderboard();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)window.updateGlobalOnline?.()});
walls();makeFlags();makeStorms();fetch('./aegean-map.json').then(r=>r.json()).then(j=>geo=j).catch(()=>0);requestAnimationFrame(loop);
})();
