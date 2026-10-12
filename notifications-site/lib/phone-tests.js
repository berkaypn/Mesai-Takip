const examples={
  break:{kind:'today',title:'☕ TEST · Molayı kapatmayı mı unuttun?',body:'Bu bir mola bildirimi örneği. Mesai kaydın değiştirilmedi.'},
  exit:{kind:'today',title:'🌙 TEST · Hâlâ mesaidesin sanırım…',body:'Çıktıysan çıkışını kaydet. Bu mesaj bir test örneğidir.'},
  entry:{kind:'today',title:'👀 TEST · Girişini kaydetmeyi mi unuttun?',body:'Bu mesaj giriş hatırlatmasının örneğidir.'},
  canias:{kind:'notes',title:'📌 TEST · Canias görevlerini kontrol et',body:'Örnek: Canias’a girilmeyi bekleyen 2 dış görev günün var.'},
  weekly:{kind:'sum',title:'📊 TEST · Haftalık özetin hazır',body:'Örnek test verisi: bu hafta +2 saatin var. İyi hafta sonları!'},
};
export const testScenarios=Object.keys(examples);
export function phoneTestPayload(scenario,due){return {...examples[scenario],tag:'phone-test:'+scenario+':'+due,due,expiry:due+5*60000};}
