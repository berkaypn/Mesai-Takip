// The GitHub-signed token is valid for this one run. No push secret is stored in GitHub.
const origin='https://mesai-takip-bildirimler.ozicirit9.chatgpt.site';
if(process.env.SITE_ORIGIN!==origin||process.env.GH_REPOSITORY!=='berkaypn/Mesai-Takip')throw new Error('Beklenmeyen depo veya servis.');
const oidcURL=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
oidcURL.searchParams.set('audience',origin);
const tokenResponse=await fetch(oidcURL,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}});
if(!tokenResponse.ok)throw new Error('GitHub zamanlayıcı kimliği alınamadı.');
const {value:token}=await tokenResponse.json();
const response=await fetch(origin+'/api/notifications/dispatch',{method:'POST',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(90000)});
const result=await response.json().catch(()=>({}));
console.log(JSON.stringify({sent:result.sent||0,failed:result.failed||0,expired:result.expired||0,status:response.status}));
if(!response.ok)throw new Error('Bildirim kontrolü başarısız: '+response.status);
