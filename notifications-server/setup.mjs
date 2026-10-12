import webpush from 'web-push';
import {spawnSync} from 'node:child_process';
const listed=spawnSync('npx',['wrangler','secret','list'],{encoding:'utf8',stdio:['ignore','pipe','inherit']});
if(listed.status!==0)process.exit(listed.status||1);
let existing;try{existing=JSON.parse(listed.stdout);}catch{console.error('Mevcut anahtarlar doğrulanamadı; yeni anahtar oluşturulmadı.');process.exit(1);}
if(existing.some(x=>['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY'].includes(x.name))){
  console.log('Bildirim anahtarları zaten yapılandırılmış. Abonelikleri korumak için değiştirilmedi.');process.exit(0);
}
const keys=webpush.generateVAPIDKeys();
// Upload through stdin. Private keys are never printed, committed or passed as CLI arguments.
const result=spawnSync('npx',['wrangler','secret','bulk'],{input:JSON.stringify({VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey}),stdio:['pipe','inherit','inherit']});
if(result.status!==0)process.exit(result.status||1);
console.log('Bildirim anahtarları servise yüklendi. Özel anahtar dosyaya yazılmadı.');
