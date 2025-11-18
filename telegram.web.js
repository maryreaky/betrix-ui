const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('redis');

function parseRedisOpts() {
  const url = new URL(process.env.REDIS_URL);
  return {
    socket: { host: url.hostname, port: Number(url.port), tls: url.protocol === 'rediss:' },
    username: url.username || undefined,
    password: url.password ? url.password.replace(/^:/,'') : undefined
  };
}

const redis = createClient(parseRedisOpts());
redis.on('error', e => console.error('REDIS_ERROR', e.message));
redis.connect().then(()=>console.log('REDIS_CONNECTED')).catch(e=>{console.error('REDIS_CONNECT_FAIL', e.message);process.exit(1);});

const app = express();
app.use(bodyParser.json());

app.get('/health',(req,res)=>res.json({ok:true,ts:new Date().toISOString()}));

app.post('/telegram/:token', async (req,res)=>{
  if (req.params.token !== process.env.TELEGRAM_TOKEN) {
    res.status(403).json({ok:false,error:'invalid token'}); return;
  }
  res.json({ok:true});
  try {
    await redis.lPush('betrix-jobs', JSON.stringify({jobId:'wh-'+Date.now(),payload:req.body}));
    console.log('ENQUEUED update');
  } catch(e){console.error('ENQUEUE_FAIL', e.message);}
});

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log('WEB SERVICE listening', port));
