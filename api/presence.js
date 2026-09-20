const KEY='aegean-man:presence';
const TTL_MS=45000;

function cfg(){
  return {
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  };
}

async function redis(commands){
  const {url,token}=cfg();
  if(!url||!token) return null;
  const r=await fetch(url.replace(/\/$/,'')+'/pipeline',{
    method:'POST',
    headers:{authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(commands)
  });
  if(!r.ok) throw new Error('Redis '+r.status);
  return r.json();
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  const now=Date.now(),cutoff=now-TTL_MS;
  try{
    const {url,token}=cfg();
    if(!url||!token){
      return res.status(200).json({online:null,configured:false});
    }

    if(req.method==='POST'){
      let body=req.body||{};
      if(typeof body==='string'){
        try{body=JSON.parse(body)}catch{body={}}
      }
      const id=String(body.id||'').slice(0,120);
      if(!id) return res.status(400).json({error:'missing id'});

      const commands=body.leave
        ? [['ZREM',KEY,id],['ZREMRANGEBYSCORE',KEY,0,cutoff],['ZCARD',KEY]]
        : [['ZREMRANGEBYSCORE',KEY,0,cutoff],['ZADD',KEY,now,id],['ZCARD',KEY],['EXPIRE',KEY,120]];

      const out=await redis(commands);
      const idx=body.leave?2:2;
      return res.status(200).json({online:Number(out?.[idx]?.result||0),configured:true});
    }

    if(req.method==='GET'){
      const out=await redis([['ZREMRANGEBYSCORE',KEY,0,cutoff],['ZCARD',KEY]]);
      return res.status(200).json({online:Number(out?.[1]?.result||0),configured:true});
    }

    res.setHeader('Allow','GET, POST');
    return res.status(405).json({error:'method not allowed'});
  }catch(err){
    return res.status(200).json({online:null,configured:true,error:'presence unavailable'});
  }
};
