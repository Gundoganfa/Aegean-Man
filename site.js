(()=>{
const picker=document.getElementById('gamePicker');
const aegean=document.getElementById('aegeanGame');
const eastmed=document.getElementById('eastmedGame');
const onlineEls=[...document.querySelectorAll('[data-online-count]')];
const presenceId=sessionStorage.aegeanPresenceId||(sessionStorage.aegeanPresenceId=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)));
let presenceTimer=null;

function setOnline(value){
  for(const el of onlineEls)el.textContent=value==null?'—':String(value);
}

async function syncOnline(){
  try{
    const r=await fetch('/api/presence',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({id:presenceId}),
      cache:'no-store'
    });
    const data=await r.json();
    setOnline(data.online);
  }catch{setOnline(null)}
}

function startPresence(){
  syncOnline();
  if(!presenceTimer)presenceTimer=setInterval(syncOnline,15000);
}

function stopPresence(){
  if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null}
  try{navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({id:presenceId,leave:true})],{type:'application/json'}))}catch{}
}

window.updateGlobalOnline=syncOnline;

function showGame(name){
  document.body.dataset.game=name;
  picker.hidden=true;
  aegean.hidden=name!=='aegean';
  eastmed.hidden=name!=='eastmed';
  document.body.classList.remove('playing');
  document.body.classList.add('pre-game');
  window.scrollTo({top:0,left:0,behavior:'instant'});
  syncOnline();
}

document.querySelectorAll('[data-game-choice]').forEach(btn=>{
  btn.addEventListener('click',()=>showGame(btn.dataset.gameChoice));
});

document.querySelectorAll('.back-to-picker').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.body.dataset.game='';
    document.body.classList.remove('playing');
    document.body.classList.add('pre-game');
    aegean.hidden=true;
    eastmed.hidden=true;
    picker.hidden=false;
    window.scrollTo({top:0,left:0,behavior:'instant'});
    syncOnline();
  });
});

document.addEventListener('visibilitychange',()=>document.hidden?stopPresence():startPresence());
window.addEventListener('beforeunload',stopPresence);
startPresence();
})();