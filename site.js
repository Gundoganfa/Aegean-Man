(()=>{
const picker=document.getElementById('gamePicker');
const aegean=document.getElementById('aegeanGame');
const eastmed=document.getElementById('eastmedGame');

function showGame(name){
  document.body.dataset.game=name;
  picker.hidden=true;
  aegean.hidden=name!=='aegean';
  eastmed.hidden=name!=='eastmed';
  document.body.classList.remove('playing');
  document.body.classList.add('pre-game');
  window.scrollTo({top:0,left:0,behavior:'instant'});
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
  });
});
})();