const crypto=require('crypto');

const SCORE_KEY='aegean-man:leaderboard';
const COPY_KEY='aegean-man:leaderboard:copy';
const DEFAULT_COPY={
  title:'AEGEAN CHAMPIONS',
  subtitle:'Top pilots of the boss level.',
  footer:'Survive. Adapt. Level up anyway.'
};
const ADMIN_SALT='aegean-man-admin-v1';
const ADMIN_VERIFIER='cf1978fe9cda6e179384d36afa142fcd04e8a4d51d10445eee3c41e20ab32862';

function cfg(){
  return {
    url:process.env.KV_REST_API_URL||process.env.UPSTASH_REDIS_REST_URL,
    token:process.env.KV_REST_API_TOKEN||process.env.UPSTASH_REDIS_REST_TOKEN
  };
}

async function redis(commands){
  const {url,token}=cfg();
  if(!url||!token)throw new Error('redis not configured');
  const r=await fetch(url.replace(/\/$/,'')+'/pipeline',{
    method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(commands)
  });
  if(!r.ok)throw new Error('Redis '+r.status);
  return r.json();
}

function bodyOf(req){
  let b=req.body||{};
  if(typeof b==='string'){try{b=JSON.parse(b)}catch{b={}}}
  return b;
}

function validPassword(value){
  if(typeof value!=='string'||value.length>80)return false;
  const candidate=crypto.pbkdf2Sync(value,ADMIN_SALT,150000,32,'sha256');
  const expected=Buffer.from(ADMIN_VERIFIER,'hex');
  return candidate.length===expected.length&&crypto.timingSafeEqual(candidate,expected);
}

function clean(value,max,fallback=''){
  const text=String(value??'').replace(/[<>]/g,'').replace(/[\r\n\t]+/g,' ').trim().slice(0,max);
  return text||fallback;
}

function parseScores(raw){
  const out=[];
  const list=Array.isArray(raw)?raw:[];
  for(let i=0;i<list.length;i+=2){
    try{
      const meta=JSON.parse(list[i]);
      out.push({
        player:clean(meta.player,16,'PLAYER'),
        score:Number(list[i+1])||0,
        level:Number(meta.level)||1
      });
    }catch{}
  }
  return out;
}

function parseCopy(raw){
  if(!raw)return DEFAULT_COPY;
  try{
    const v=typeof raw==='string'?JSON.parse(raw):raw;
    return {
      title:clean(v.title,40,DEFAULT_COPY.title),
      subtitle:clean(v.subtitle,90,DEFAULT_COPY.subtitle),
      footer:clean(v.footer,90,DEFAULT_COPY.footer)
    };
  }catch{return DEFAULT_COPY}
}

async function getBoard(){
  const out=await redis([
    ['ZREVRANGE',SCORE_KEY,0,9,'WITHSCORES'],
    ['GET',COPY_KEY]
  ]);
  return {
    scores:parseScores(out?.[0]?.result),
    copy:parseCopy(out?.[1]?.result)
  };
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  try{
    if(req.method==='GET')return res.status(200).json(await getBoard());
    if(req.method!=='POST'){
      res.setHeader('Allow','GET, POST');
      return res.status(405).json({error:'method not allowed'});
    }

    const b=bodyOf(req);

    if(b.action==='score'){
      const player=clean(b.player,16,'PLAYER');
      const score=Math.max(0,Math.min(9999999,Math.floor(Number(b.score)||0)));
      const level=Math.max(1,Math.min(999,Math.floor(Number(b.level)||1)));
      const id=clean(b.id,80,crypto.randomUUID());
      const member=JSON.stringify({player,level,id,at:Date.now()});
      await redis([['ZADD',SCORE_KEY,score,member]]);
      return res.status(200).json(await getBoard());
    }

    if(b.action==='auth'){
      if(!validPassword(b.password))return res.status(401).json({error:'unauthorized'});
      return res.status(200).json({ok:true});
    }

    if(b.action==='copy'){
      if(!validPassword(b.password))return res.status(401).json({error:'unauthorized'});
      const copy={
        title:clean(b.title,40,DEFAULT_COPY.title),
        subtitle:clean(b.subtitle,90,DEFAULT_COPY.subtitle),
        footer:clean(b.footer,90,DEFAULT_COPY.footer)
      };
      await redis([['SET',COPY_KEY,JSON.stringify(copy)]]);
      const board=await getBoard();
      return res.status(200).json(board);
    }

    return res.status(400).json({error:'unknown action'});
  }catch(err){
    return res.status(500).json({error:'leaderboard unavailable'});
  }
};
