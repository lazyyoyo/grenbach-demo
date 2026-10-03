// DOM / 시간 / 네트워크에 의존하지 않는 결정적 시뮬레이션.
(function(root,factory){
  if(typeof module==='object' && module.exports) module.exports=factory(require('./data.js'));
  else root.KeepSim=factory(root.KEEP);
})(typeof window==='undefined'?globalThis:window, K => {
  'use strict';
  const B=K.balance, clone=x=>JSON.parse(JSON.stringify(x));
  const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
  function random(s){s.rng=(Math.imul(1664525,s.rng)+1013904223)>>>0;return s.rng/4294967296;}
  const season=s=>Math.min(3,Math.floor(s.day/30));
  const room=(s,id)=>s.rooms[id];
  const slotOf=(s,type)=>Object.keys(s.rooms).find(id=>room(s,id)?.type===type);
  const available=f=>!f.hurt&&!f.away;
  const workers=(s,id)=>s.folk.filter(f=>f.room===id&&available(f));
  const trait=f=>K.traits[f.trait]||{};
  const maxHP=f=>100+(f.level-1)*8;
  const capacity=(s,id)=>K.rooms[room(s,id)?.type]?.cap*(room(s,id)?.size||1)||0;
  const structures=(s,type)=>Object.values(s.rooms).filter(r=>r?.type===type);
  const popCap=s=>B.popBase+structures(s,'dorm').reduce((a,r)=>a+K.rooms.dorm.pop*r.size*r.level,0);
  const storageCap=s=>B.storageBase+structures(s,'storage').reduce((a,r)=>a+K.rooms.storage.storage*r.size*r.level,0);
  const weaponPower=(s,f)=>K.weapons.find(w=>w.id===f.weapon)?.power||0;
  const sum=(a,k)=>a.reduce((n,f)=>n+f[k],0);
  function log(s,text){s.log.unshift(`${s.year}년 ${K.seasons[season(s)]} ${s.day===120?30:s.day%30+1}일 · ${text}`);s.log=s.log.slice(0,40);}
  function makeFolk(f){return {...clone(f),hp:100,hurt:0,away:null,level:1,xp:0,satisfaction:70,weapon:null,work:{str:0,dex:0,heart:0},reasons:[{text:'성에 합류',value:70,day:0}],history:f.room?[{day:0,year:1,room:f.room}]:[]};}
  function snapshot(s){const c=clone({...s,checkpoint:null});c.notices=[];c.lastFailure=null;return c;}
  function create(seed=1){
    const s={version:K.version,rng:seed>>>0,seed:seed>>>0,year:1,day:0,elapsedDays:0,res:{...B.start},xp:0,level:1,
      rooms:{},folk:K.folk.slice(0,6).map(makeFolk),julian:{health:85,bond:15},sus:20,raid:null,raidsWon:0,
      graveyard:[],expeditions:[],candidates:[],inventory:[],pending:null,notices:[{kind:'cutscene',id:'start'}],
      seen:['start'],records:[],yearReports:[],status:'playing',blizzardUntil:0,rush:{},log:[],failures:0,lastFailure:null,lullabyDay:-1,checkpoint:null};
    K.layout.forEach((row,r)=>row.forEach((type,c)=>s.rooms[`r${r}c${c}`]=type?{type,level:1,size:1}:null));
    s.gateHP=140;s.wallLevel=1;s.repair=null;s.crafts=[];s.visitors=[];s.queue=[];s.events={};s.built={};s.neighbors={rosental:40,eisenberg:35,halden:45,berg:40};s.metrics={trade:0,recruited:0,checkup:0,raidDamage:0,emptyParlor:0};s.goals=[[],[],[],[]];s.warnings=[];s.julian.registry=null;s.julian.growth=0;s.julian.timeline=[{day:0,title:'갓난아기'}];for(const r of Object.values(s.rooms))if(r?.type)s.built[r.type]=(s.built[r.type]||0)+1;capitalNews(s);s.checkpoint=snapshot(s);return s;
  }
  // 고정 좌표: r0은 지상, c1..3은 시작 열, c0/c4는 바깥 확장 열.
  const columns=s=>s.level>=5?5:s.level>=3?4:3;
  const firstColumn=s=>s.level>=3?0:1;
  function unlocked(s,id){return /^r[0-5]c[0-4]$/.test(id)&&+id[1]<s.level+1&&+id[3]>=firstColumn(s)&&+id[3]<firstColumn(s)+columns(s);}
  function lodging(s){const capacity=structures(s,'dorm').reduce((n,r)=>n+r.size*r.level*4,0),population=s.folk.length;return {capacity,population,ratio:population?Math.min(1,capacity/population):1};}
  function restore(saved,seed=1){try{const s=typeof saved==='string'?JSON.parse(saved):saved;return validSave(s)?clone(s):create(seed);}catch{return create(seed);}}
  function rate(s,id){
    const r=room(s,id),def=K.rooms[r?.type];
    if(!def?.res||r.fire||(r.type==='field'&&season(s)>1))return 0;
    return workers(s,id).reduce((n,f)=>n+f[def.stat]*satisfactionMult(f.satisfaction)*(trait(f).room===r.type?trait(f).production:1),0)*B.levelMult[r.level-1];
  }
  function daily(s){
    const out={food:-s.folk.reduce((n,f)=>n+B.foodPerPerson+(trait(f).food||0),0),wood:-B.woodUse[season(s)]*(s.day<s.blizzardUntil?2:1),gold:0};
    for(const id of Object.keys(s.rooms)){const def=K.rooms[room(s,id)?.type];if(def?.res)out[def.res]+=rate(s,id);}
    out.gold=s.folk.length*.18*averageSatisfaction(s)/100;
    out.sus=.5+(s.capital?.suspicion||0)-workers(s,slotOf(s,'parlor')).reduce((n,f)=>n+f.heart*.08-(trait(f).suspicion||0),0);
    return out;
  }
  function price(s,a){
    const r=room(s,a.slot),def=K.rooms[r?.type];
    if(a.type==='build')return {gold:(K.rooms[a.room]?.cost||0)+15*(s.built[a.room]||0)};
    if(a.type==='upgrade'&&r)return {gold:def.cost*r.level*r.size,wood:8*r.level*r.size};
    if(a.type==='merge'&&r)return {gold:20*r.level,wood:5*r.level};
    if(a.type==='craft')return {gold:Math.ceil((K.weapons.find(w=>w.id===a.weapon)?.cost||0)*(s.neighbors.eisenberg>=70?.8:1)),wood:5};
    if(a.type==='repair')return {wood:12,gold:8};
    if(a.type==='wall')return {wood:30,gold:40*s.wallLevel};
    if(a.type==='registry')return s.julian.registry?{gold:80}:{};
    if(a.type==='checkup')return {gold:8};
    if(a.type==='scout')return {food:K.scouts.find(d=>d.id===a.destination)?.days*2||0};
    if(a.type==='buy')return {gold:tradePrice(s,a.item,true)};
    if(a.type==='caravan')return a.cargo==='food'?{food:20}:a.cargo==='wood'?{wood:25}:{};
    if(a.type==='gift')return a.gift==='gold'?{gold:15}:a.gift==='food'?{food:15}:{};
    if(a.type==='envoy')return {food:6};
    if(a.type==='extinguish')return {wood:4};
    return {};
  }
  const affordable=(s,cost)=>Object.entries(cost).every(([k,n])=>s.res[k]>=n);
  function pay(s,cost){for(const [k,n] of Object.entries(cost))s.res[k]-=n;}
  function gainXP(s,n){s.xp+=n;const old=s.level;while(s.level<5&&s.xp>=B.levelXP[s.level])s.level++;if(old!==s.level){s.res.gold+=30+s.level*10;log(s,`확장 보상 금화 +${30+s.level*10} · 영지 Lv${s.level} · ${s.level+1}층 개방`);s.notices.push({kind:'level',level:s.level});}}
  function damage(s,id,n){
    const f=s.folk.find(f=>f.id===id);if(!f||f.hurt)return;
    f.hp-=n*(trait(f).damage||1);
    if(f.hp>0)return;
    if(f.hero||f.named){f.hurt=f.hero?7:14;f.hp=1;f.room=null;log(s,`${f.name} ${f.hurt}일 부상`);}
    else{s.graveyard.push({id:f.id,name:f.name,year:s.year,day:s.day});s.folk=s.folk.filter(p=>p!==f);s.folk.forEach(p=>satisfaction(s,p,-12,`${f.name} 사망`));log(s,`${f.name}을 묘지에 기록했다.`);}
  }
  function adjacent(a,b){return a[1]===b[1]&&Math.abs(+a[3]-+b[3])===1;}
  function validate(s,a){
    if(!a||typeof a.type!=='string')return '알 수 없는 명령';
    const r=room(s,a.slot),f=s.folk.find(f=>f.id===a.id);
    if(a.type==='ack')return s.notices.length?null:'알림 없음';
    if(a.type==='retry')return s.status==='gameOver'?null:'게임오버 뒤 되돌릴 수 있습니다';
    if(a.type==='restart')return null;
    if(a.type==='continue')return '여기까지가 1년 프로토입니다';
    if(s.status!=='playing')return '결산을 먼저 확인하세요';
    if(a.type==='assign'){
      if(!f||!available(f))return '부상 또는 파견 중입니다';
      if(a.slot===null)return null;
      if(!r?.type||!unlocked(s,a.slot)||!capacity(s,a.slot))return '일할 수 없는 방입니다';
      return f.room!==a.slot&&workers(s,a.slot).length>=capacity(s,a.slot)?'방이 가득 찼습니다':null;
    }
    if(a.type==='build'){
      if(!unlocked(s,a.slot)||r!==null)return '빈 개방 칸이 필요합니다';
      if(!K.rooms[a.room]||K.rooms[a.room].fixed)return '이 방은 새로 지을 수 없습니다';
    }else if(a.type==='demolish'){
      if(s.raid)return '습격 중에는 철거할 수 없습니다';
      if(!r?.type||K.rooms[r.type].fixed)return '고정 방은 철거할 수 없습니다';
      if(s.folk.some(p=>p.room===a.slot))return '사람을 먼저 다른 방으로 옮기세요';
      if(s.crafts.some(c=>c.slot===a.slot))return '제작 대기열을 먼저 완료하세요';
    }else if(a.type==='upgrade'){
      if(!r?.type||r.level>=3)return '더 업그레이드할 수 없습니다';
    }else if(a.type==='merge'){
      const other=room(s,a.other);
      if(!r?.type||K.rooms[r.type].fixed||other?.type!==r.type||other.level!==r.level||r.size+other.size>3||a.slot[1]!==a.other[1])return '같은 종류·레벨의 인접한 일반 방 2~3칸만 합칩니다';
      const x=+a.slot[3],y=+a.other[3];if(x+r.size!==y&&y+other.size!==x)return '서로 맞닿아야 합니다';
    }else if(a.type==='rush'){
      if(!K.rooms[r?.type]?.res||r.fire||rate(s,a.slot)<=0)return '생산 중인 방에서 재촉하세요';
    }else if(a.type==='extinguish'){
      if(!r?.fire)return '불이 나지 않았습니다';
    }else if(a.type==='choice'){
      const e=eventFor(s,s.pending),c=e?.choices[a.index];
      if(!c)return '사건 선택지가 없습니다';
      if(c.recruit&&(!nextCandidate(s)||s.folk.length>=popCap(s)))return '숙소가 부족합니다';
      if(!affordable(s,c.cost))return '비용이 부족합니다';return null;
    }else if(a.type==='scout'){
      if(!K.scouts.some(d=>d.id===a.destination)||!Array.isArray(a.ids)||a.ids.length<1||a.ids.length>3||new Set(a.ids).size!==a.ids.length)return '1~3명을 선택하세요';
      if(a.ids.some(id=>!s.folk.some(f=>f.id===id&&available(f))))return '부상 또는 파견 중인 사람입니다';
      return affordable(s,price(s,a))?null:'출발 식량이 부족합니다';
    }else if(a.type==='recruit'){
      if(!s.candidates.includes(a.id)||s.folk.length>=popCap(s))return '후보 또는 숙소가 없습니다';return null;
    }else if(a.type==='craft'){
      const w=K.weapons.find(w=>w.id===a.weapon);
      if(s.crafts.length>=(structures(s,'forge').some(r=>r.level===3)?2:1))return '제작 대기열이 가득 찼습니다';
      if(!w||w.scout||!Object.entries(s.rooms).some(([id,r])=>r?.type==='forge'&&r.level>=w.level&&!r.fire&&workers(s,id).length))return '일꾼과 해당 레벨 대장간이 필요합니다';
    }else if(a.type==='equip'){
      if(!f||!available(f)||a.weapon!==null&&(!s.inventory.includes(a.weapon)||!K.weapons.some(w=>w.id===a.weapon)))return '장비를 사용할 수 없습니다';return null;
    }else if(a.type==='lullaby'){
      if(s.lullabyDay===s.elapsedDays)return '오늘은 이미 노래했습니다';
      if(!workers(s,slotOf(s,'nursery')).length)return '요람실에 돌보는 사람이 필요합니다';return null;
    }else {const error=validateExtra(s,a);if(error)return error;}
    return affordable(s,price(s,a))?null:'재화가 부족합니다';
  }
  function recruit(s,id){
    const p=K.folk.find(f=>f.id===id&&!s.folk.some(x=>x.id===id)&&!s.graveyard.some(x=>x.id===id));
    if(!p)return;const f=makeFolk(p);f.room=null;f.history=[];s.folk.push(f);s.metrics.recruited++;log(s,`${f.name}이 성에 합류했다.`);
  }
  function nextCandidate(s){return K.folk.slice(6).find(f=>!s.folk.some(p=>p.id===f.id)&&!s.graveyard.some(p=>p.id===f.id)&&!s.candidates.includes(f.id))?.id;}
  function effects(s,fx){
    for(const [key,n] of Object.entries(fx)){
      if(key in s.res)s.res[key]+=n;
      else if(key==='sus')s.sus=clamp(s.sus+n);
      else if(key==='health'||key==='bond')s.julian[key]=clamp(s.julian[key]+n);
      else if(key==='satisfaction')s.folk.forEach(f=>satisfaction(s,f,n,'사건 선택'));
      else if(key==='xp')gainXP(s,n);
    }
  }
  function perform(s,a){
    const error=validate(s,a);if(error)return error;
    const r=room(s,a.slot),f=s.folk.find(f=>f.id===a.id);
    pay(s,price(s,a));
    switch(a.type){
      case 'ack':s.notices.shift();break;
      case 'assign':if(f.room!==a.slot){f.room=a.slot;f.history.push({year:s.year,day:s.day,room:a.slot});f.history=f.history.slice(-30);}break;
      case 'build':s.rooms[a.slot]={type:a.room,level:1,size:1};s.built[a.room]=(s.built[a.room]||0)+1;gainXP(s,5);log(s,`${K.rooms[a.room].name} 건설`);break;
      case 'demolish':s.res.gold+=Math.floor(K.rooms[r.type].cost*.2)*r.size;for(let c=+a.slot[3];c<+a.slot[3]+r.size;c++)s.rooms[`r${a.slot[1]}c${c}`]=null;log(s,`${K.rooms[r.type].name} 철거 · 기본비 20% 환급`);break;
      case 'upgrade':r.level++;if(r.type==='gate')s.gateHP=Math.min(gateMax(s),s.gateHP+60);gainXP(s,5);log(s,`${K.rooms[r.type].name} Lv${r.level}`);break;
      case 'merge':{
        const left=+a.slot[3]<+a.other[3]?a.slot:a.other,right=left===a.slot?a.other:a.slot;
        const n=s.rooms[left].size+s.rooms[right].size;s.rooms[left].size=n;
        for(let c=+left[3]+1;c<+left[3]+n;c++)s.rooms[`r${left[1]}c${c}`]={mergedInto:left};
        s.folk.filter(f=>f.room===right).forEach(f=>{f.room=left;f.history.push({year:s.year,day:s.day,room:left});});gainXP(s,3);break;
      }
      case 'rush':{
        const count=s.rush[a.slot]||0,chance=clamp(.1+count*.15+workers(s,a.slot).reduce((n,f)=>n+(trait(f).rush||0),0),0,.95);s.rush[a.slot]=count+1;
        if(random(s)<chance){r.fire=3;workers(s,a.slot).forEach(f=>f.satisfaction=clamp(f.satisfaction-12));log(s,`${K.rooms[r.type].name} 재촉 실패 · 화재 3일`);}
        else{s.res[K.rooms[r.type].res]+=rate(s,a.slot);log(s,'재촉 성공 · 하루치 생산');}break;
      }
      case 'extinguish':r.fire=0;log(s,'불길을 잡았다.');break;
      case 'choice':{
        const e=eventFor(s,s.pending),c=e.choices[a.index];pay(s,c.cost);if(c.registry)register(s,c.registry);else effects(s,c.fx);if(c.recruit)recruit(s,nextCandidate(s));if(c.neighbor)favor(s,c.neighbor,c.favor);if(e.kind==='merchant'&&a.index<2)s.metrics.trade++;s.pending=null;gainXP(s,2);log(s,`${e.title} · ${c.label}`);break;
      }
      case 'scout':{
        const dest=K.scouts.find(d=>d.id===a.destination),id=`${s.year}-${s.day}-${s.expeditions.length}`;
        s.expeditions.push({id,destination:dest.id,returnAt:s.elapsedDays+dest.days,ids:[...a.ids]});
        a.ids.forEach(id=>{const p=s.folk.find(f=>f.id===id);p.away=id;p.room=null;});log(s,`${dest.name} 정찰 출발 · ${dest.days}일`);break;
      }
      case 'recruit':recruit(s,a.id);s.candidates=s.candidates.filter(id=>id!==a.id);break;
      case 'craft':{const total=craftDays(s,a.weapon);s.crafts.push({weapon:a.weapon,slot:slotOf(s,'forge'),total,remaining:total});break;}
      case 'equip':if(f.weapon)s.inventory.push(f.weapon);f.weapon=a.weapon;if(a.weapon)s.inventory.splice(s.inventory.indexOf(a.weapon),1);break;
      case 'lullaby':s.lullabyDay=s.elapsedDays;effects(s,a.success?{bond:8,health:4}:{bond:1});log(s,a.success?'자장가 끝에 아이가 잠들었다.':'아이를 안고 다시 숨을 고른다.');break;
      case 'retry':{const failures=s.failures,attempted=s.elapsedDays;const restored=clone(s.checkpoint);restored.checkpoint=clone(s.checkpoint);restored.failures=failures;restored.attemptedDays=(s.attemptedDays||0)+attempted-restored.elapsedDays;Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,restored);break;}
      case 'restart':{const seed=s.seed;Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,create(seed));break;}
      case 'continue':s.year++;s.day=0;s.status='playing';s.yearStartDeaths=s.graveyard.length;s.notices.push({kind:'season',season:0});s.checkpoint=snapshot(s);break;
      default:performExtra(s,a);
    }
    checkGoals(s);
    for(const k of ['food','wood'])s.res[k]=clamp(s.res[k],0,storageCap(s));
    return null;
  }
  function rollback(s,reason){
    s.status='gameOver';s.failures++;s.lastFailure=reason;s.failureAnalysis=[reason,`성문 HP ${Math.ceil(s.gateHP)}/${gateMax(s)} · 요람실 ${workers(s,slotOf(s,'nursery')).length}명 · 요람 방어 ${Math.round(defense(s,slotOf(s,'nursery')))}`,`의심 ${Math.round(s.sus)} · 응접실이 비어 있던 날 ${s.metrics.emptyParlor}일 · 건강 ${Math.round(s.julian.health)}`, ...s.warnings.slice(-4).map(w=>`${w.day}일: ${w.text}`)];s.notices=[];return s;
  }
  function failure(s){return s.sus>=100?'의심이 100에 닿아 율리안을 빼앗겼다':s.julian.health<=0?'율리안의 건강이 무너져 보호권을 잃었다':null;}
  function startRaid(s,def){
    const power=raidPower(s,def)*(1-B.raidVariance/2+random(s)*B.raidVariance);
    const gate=slotOf(s,'gate'),nursery=slotOf(s,'nursery');
    const path=[gate,...Object.keys(s.rooms).filter(id=>s.rooms[id]?.type&&id!==gate&&id!==nursery),nursery];
    s.raid={name:def.name,power,hp:power*B.raidHP,max:power*B.raidHP,idx:0,path,round:0,history:[],boss:!!def.boss};
    if(defense(s,gate)<power||(s.wallLevel===1&&power>60&&s.neighbors.berg<70)){s.metrics.burned=(s.metrics.burned||0)+1;s.metrics.raidDamage++;log(s,'성 밖 집이 불탔다 · 부족한 수비 또는 미강화 성벽으로 외곽 마을이 노출됐다');}
    log(s,`${def.name} 도착`);
  }
  function raidRound(s){
    const rd=s.raid,id=rd.path[rd.idx],r=room(s,id),defenders=workers(s,id),def=defense(s,id);rd.round++;
    rd.hp=Math.max(0,rd.hp-def);rd.history.unshift(`${rd.round}R · ${K.rooms[r.type].name} 방어 ${Math.round(def)} → 습격대 HP −${Math.round(def)}`);
    if(rd.hp<=0){s.raidsWon++;s.res.gold+=18;if(rd.boss)s.metrics.boss=true;gainXP(s,10);log(s,'습격을 막았다.');s.raid=null;checkGoals(s);return s;}
    if(r.type==='gate'&&s.gateHP>0){const hit=rd.power*.8;s.gateHP=Math.max(0,s.gateHP-hit);rd.history.unshift(`${rd.round}R · 성문 HP −${Math.round(hit)} · 내부 피해 0`);if(s.gateHP>0)return s;rd.idx++;s.metrics.raidDamage++;s.metrics.burned=(s.metrics.burned||0)+1;log(s,'성문 돌파 · 성 밖 집에 불이 붙었다');return s;}
    for(const f of [...defenders])damage(s,f.id,rd.power*.8/Math.max(1,defenders.length));
    if(r.type==='nursery')return rollback(s,`요람실 방어 ${Math.round(def)} vs 습격 잔여 ${Math.round(rd.hp)} — 율리안을 빼앗겼다`);
    const res=K.rooms[r.type].res||'gold';s.res[res]=Math.max(0,s.res[res]-12);s.metrics.raidDamage++;rd.history.unshift(`${K.rooms[r.type].name} 교전 · ${res} 약탈 −12`);rd.idx++;return s;
  }
  function returnScouts(s){
    for(const ex of s.expeditions.filter(e=>e.returnAt<=s.elapsedDays)){
      if(ex.kind){returnMission(s,ex);continue;}
      const d=K.scouts.find(d=>d.id===ex.destination),people=ex.ids.map(id=>s.folk.find(f=>f.id===id)).filter(Boolean);
      const risk=scoutRisk(s,d,ex.ids);
      s.res.food+=d.food;s.res.gold+=d.gold;
      if(random(s)<.65)s.inventory.push(d.weapon);
      if(random(s)<.45){const id=nextCandidate(s);if(id)s.candidates.push(id);}
      for(const f of people){f.away=null;f.xp+=d.days;if(random(s)<risk)damage(s,f.id,maxHP(f)+1);}
      gainXP(s,d.days);log(s,`${d.name} 정찰 귀환 · 식량 ${d.food}, 금화 ${d.gold}`);s.notices.push({kind:'scout',destination:d.name});
    }
    s.expeditions=s.expeditions.filter(e=>e.returnAt>s.elapsedDays);
  }
  function step(state,actions=[]){
    let s=clone(state);for(const a of actions)perform(s,a);
    if(s.status==='gameOver')return s;
    const lost=failure(s);if(lost)return rollback(s,lost);
    if(s.status!=='playing'||s.pending)return s;
    if(s.raid)return raidRound(s);
    // 결산/계절 경계는 전날의 사건과 습격이 끝난 다음 확정한다.
    if(s.day>0&&s.day%30===0&&s.checkpoint.day!==s.day){
      if(s.day===120){
        s.status='yearEnd';const tax=Math.round(s.folk.length*B.taxPerPerson*averageSatisfaction(s)/100);s.res.gold+=tax;
        const report={year:s.year,population:s.folk.map(f=>({name:f.name,level:f.level})),deaths:clone(s.graveyard.filter(f=>f.year===s.year)),tax,bond:s.julian.bond,health:s.julian.health,registry:s.julian.registry,seeds:K.registries[s.julian.registry]?.seeds||{str:1,dex:1,heart:1},raidsWon:s.raidsWon};
        s.yearReports.push(report);s.notices.push({kind:'cutscene',id:'year'});return s;
      }
      for(const f of [...s.folk])if(!f.named&&f.satisfaction<20){s.folk=s.folk.filter(p=>p!==f);log(s,`${f.name} 만족도 20 미만 · 영지를 떠났다`);}
      capitalNews(s);if(s.neighbors.rosental>=70)s.res.food+=35;s.checkpoint=snapshot(s);s.notices.push({kind:'season',season:season(s)});
      if(season(s)===3&&!s.seen.includes('winter')){s.seen.push('winter');s.notices.push({kind:'cutscene',id:'winter'});}
      return s;
    }
    const d=daily(s);s.rush={};
    for(const key of ['food','wood','gold'])s.res[key]+=d[key];
    const hungry=s.res.food<0,cold=s.res.wood<0;
    s.sus=clamp(s.sus+d.sus);
    if(!workers(s,slotOf(s,'parlor')).length)s.metrics.emptyParlor++;
    const care=workers(s,slotOf(s,'nursery'));
    s.julian.health=clamp(s.julian.health+(care.length?sum(care,'heart')*.12+care.reduce((n,f)=>n+(trait(f).care||0),0):-B.healthWithoutCare)-(hungry?B.starvationDamage:0)-(cold?B.coldDamage:0)+(s.julian.registry==='heinz'&&Object.entries(s.rooms).some(([id,r])=>r?.type==='barracks'&&adjacent(id,slotOf(s,'nursery')))?.5:0));
    s.julian.bond=clamp(s.julian.bond+care.reduce((n,f)=>n+f.heart*.025*(trait(f).bond||1)+(f.hero?.3:0),0)*(K.registries[s.julian.registry]?.bond||1)-(care.length?0:.3));
    for(const f of [...s.folk]){
      if(f.hurt){f.hurt--;if(!f.hurt)f.hp=maxHP(f);continue;}
      if(f.away)continue;
      if(hungry||cold)satisfaction(s,f,-3,hungry?'식량 부족':'추위');
      else {const suited=K.rooms[room(s,f.room)?.type]?.stat;const fit=suited&&f[suited]>=Math.max(f.str,f.dex,f.heart);satisfaction(s,f,fit?.2:0,'배치 적성');satisfaction(s,f,(!f.room||room(s,f.room)?.type==='dorm'?.8:.3)*lodging(s).ratio,lodging(s).ratio===1?'숙소 휴식':'숙소 부족 · 회복 감소');}
      if(hungry||cold)damage(s,f.id,(hungry?3:0)+(cold?3*(trait(f).cold||1):0));
      else f.hp=clamp(f.hp+(!f.room||room(s,f.room)?.type==='dorm'?6:3)*lodging(s).ratio,0,maxHP(f));
      const def=K.rooms[room(s,f.room)?.type];
      if(def?.stat&&!room(s,f.room).fire&&!(room(s,f.room).type==='field'&&season(s)>1)){
        f.xp++;f.work[def.stat]++;if(f.work[def.stat]%10===0)f[def.stat]=Math.min(10,f[def.stat]+(room(s,f.room).type==='barracks'?2:1));
        const lv=Math.min(10,1+Math.floor(f.xp/10));if(lv>f.level){f.hp+=8*(lv-f.level);f.level=lv;}
      }
    }
    for(const [id,r] of Object.entries(s.rooms))if(r?.fire){workers(s,id).forEach(f=>damage(s,f.id,8));r.fire--;}
    s.day++;s.elapsedDays++;gainXP(s,1);tickEconomy(s);returnScouts(s);
    const stage=Math.min(4,Math.floor(s.day/30));if(stage!==s.julian.growth){s.julian.growth=stage;s.julian.timeline.push({day:s.day,title:K.growth[stage]});}
    checkGoals(s);expireQueue(s);warnings(s);
    for(const key of ['food','wood'])s.res[key]=clamp(s.res[key],0,storageCap(s));
    if(s.day>=91&&s.day<118&&random(s)<.14){s.blizzardUntil=s.day+3;log(s,'눈보라 · 사흘 동안 장작 소모 두 배');}
    if(s.day%30===0){const i=s.day/30-1,rec={year:s.year,season:i,title:K.milestones[i][0],text:K.milestones[i][1]};s.records.push(rec);s.notices.push({kind:'record',...rec});}
    const e=dayEvent(s);if(e)arrive(s,e);
    const rd=K.raids.find(r=>r.day===s.day);if(rd)startRaid(s,rd);
    const reason=failure(s);return reason?rollback(s,reason):s;
  }
  function averageSatisfaction(s){return s.folk.length?s.folk.reduce((n,f)=>n+f.satisfaction,0)/s.folk.length:0;}
  const satisfactionMult=n=>(.8+n/250)*(n<40?.7:1);
  function satisfaction(s,f,n,text){if(!n)return;f.satisfaction=clamp(f.satisfaction+n);const last=f.reasons.at(-1);if(last?.text===text&&last.day===s.day)last.value+=n;else f.reasons.push({text,value:n,day:s.day});f.reasons=f.reasons.slice(-8);}
  function gateMax(s){return 140+(room(s,slotOf(s,'gate')).level-1)*60+(s.wallLevel-1)*40;}
  function defense(s,id){const r=room(s,id);if(!r)return 0;let n=workers(s,id).reduce((n,f)=>n+f.str+weaponPower(s,f)+(trait(f).defense||0),0)*B.levelMult[r.level-1]*B.defenseScale;if(r.type==='gate')n+=6*r.level+workers(s,slotOf(s,'barracks')).reduce((n,f)=>n+(f.str+weaponPower(s,f))*.5,0)+(s.neighbors.berg>=70?25:0);return n;}
  function raidPower(s,def){return (s.level*12+B.raidBonus[Math.min(3,Math.floor(def.day/30))]+(def.boss?B.bossBonus:0))*(1+B.yearScale*(s.year-1));}
  function forecast(s){const next=K.raids.find(r=>r.day>s.day);return next?{...next,days:next.day-s.day,power:raidPower(s,next),defense:defense(s,slotOf(s,'gate'))}:null;}
  function risks(s){const a=[],next=forecast(s);if(!workers(s,slotOf(s,'nursery')).length)a.push({text:'요람실이 비었습니다 — 돌볼 사람을 배치하세요',slot:slotOf(s,'nursery')});if(s.sus>=80)a.push({text:'의심 80 이상 — 응접실에 마음 높은 사람을 배치하세요',slot:slotOf(s,'parlor')});if(s.julian.health<30)a.push({text:'율리안 건강 30 미만 — 진찰·약초·자장가가 필요합니다',slot:slotOf(s,'nursery')});if(next&&next.days<=3)a.push({text:`습격 D-${next.days} · 예상 ${Math.round(next.power)} vs 성문 방어 ${Math.round(next.defense)}`,slot:slotOf(s,'gate')});return a;}
  function warnings(s){for(const w of risks(s)){if(!s.warnings.some(x=>x.day===s.day&&x.text===w.text))s.warnings.push({day:s.day,...w});}s.warnings=s.warnings.slice(-12);}
  function craftDays(s,id){const dex=workers(s,slotOf(s,'forge')).reduce((n,f)=>n+f.dex*(f.trait==='smith'?1.15:1),0);return Math.max(1,({knife:2,spear:3,sword:5}[id]||99)-Math.floor(dex/10));}
  const merchantHere=s=>s.visitors.some(v=>v.kind==='merchant'&&v.until>=s.day);
  function tradePrice(s,id,buy=false){const w=K.weapons.find(w=>w.id===id),base=w?(w.cost||w.power*6):K.items[id]?.cost||0;return Math.ceil(base*(buy?2.3*(s.neighbors.eisenberg>=70?.8:1):1.45*s.capital.weaponSale));}
  function scoutRisk(s,d,ids){return Math.max(.02,d.risk-ids.length*.02+ids.reduce((n,id)=>n+(trait(s.folk.find(f=>f.id===id)).scout||0),0));}
  function partyError(s,ids,max){return !Array.isArray(ids)||!ids.length||ids.length>max||new Set(ids).size!==ids.length||ids.some(id=>!s.folk.some(f=>f.id===id&&available(f)))?'파견 가능한 사람을 선택하세요':null;}
  function validateExtra(s,a){
    if(a.type==='repair'){if(s.raid||s.repair||s.gateHP>=gateMax(s))return '습격 중·수리 중이거나 성문이 온전합니다';}
    else if(a.type==='wall'){if(s.wallLevel>=3||s.raid)return '성벽은 Lv3까지, 습격 전에 강화하세요';}
    else if(a.type==='registry'){if(!K.registries[a.registry])return '호적을 선택하세요';}
    else if(a.type==='checkup'){if(s.metrics.checkupDay===s.elapsedDays)return '오늘 진찰은 마쳤습니다';}
    else if(a.type==='openRequest'){if(s.pending||!s.queue.some(e=>e.id===a.id))return '지금 열 수 없는 부탁입니다';}
    else if(['buy','sell','use_item'].includes(a.type)){
      if(!K.items[a.item]&&!K.weapons.some(w=>w.id===a.item))return '없는 물건입니다';
      if(a.type!=='use_item'&&!merchantHere(s))return '행상이 방문 중일 때 거래할 수 있습니다';
      if(a.type!=='buy'&&!s.inventory.includes(a.item))return '가방에 물건이 없습니다';
      if(a.type==='use_item'&&!K.items[a.item])return '소모품을 선택하세요';
    }else if(['gift','envoy'].includes(a.type)){
      if(!K.neighbors[a.neighbor])return '영지를 선택하세요';
      if(a.type==='envoy'){const err=partyError(s,a.ids,1);if(err)return err;}
      else if(!['gold','food','weapon'].includes(a.gift))return '선물을 선택하세요';
      else if(a.gift==='weapon'&&(!s.inventory.includes(a.weapon)||!K.weapons.some(w=>w.id===a.weapon)))return '선물할 무기가 없습니다';
    }else if(a.type==='caravan'){
      const err=partyError(s,a.ids,2);if(err)return err;
      if(!['food','wood','weapon'].includes(a.cargo))return '화물을 선택하세요';
      if(a.cargo==='weapon'&&(!s.inventory.includes(a.weapon)||!K.weapons.some(w=>w.id===a.weapon)))return '보낼 무기가 없습니다';
    }else return '알 수 없는 명령';
    return null;
  }
  function take(s,id){s.inventory.splice(s.inventory.indexOf(id),1);}
  function register(s,id){if(s.julian.registry)s.sus=clamp(s.sus+15);s.julian.registry=id;effects(s,{sus:K.registries[id].sus,...(id==='johanna'?{satisfaction:8}:{})});log(s,`호적: ${K.registries[id].name}`);}
  function favor(s,id,n){const old=s.neighbors[id];s.neighbors[id]=clamp(old+n);if(n>0)gainXP(s,3);if(old<70&&s.neighbors[id]>=70){s.res.gold+=15;gainXP(s,8);log(s,`${K.neighbors[id].name} 동맹 · 금화 +15`);}}
  function performExtra(s,a){
    if(a.type==='repair')s.repair={remaining:3};
    if(a.type==='wall'){s.wallLevel++;s.gateHP+=40;}
    if(a.type==='registry')register(s,a.registry);
    if(a.type==='checkup'){effects(s,{health:10});s.metrics.checkup++;s.metrics.checkupDay=s.elapsedDays;}
    if(a.type==='openRequest'){s.pending=a.id;s.queue=s.queue.filter(e=>e.id!==a.id);}
    if(a.type==='buy'){s.inventory.push(a.item);s.metrics.trade++;}
    if(a.type==='sell'){take(s,a.item);s.res.gold+=tradePrice(s,a.item);s.metrics.trade++;}
    if(a.type==='use_item'){take(s,a.item);effects(s,K.items[a.item].fx);}
    if(a.type==='gift'){let n=a.gift==='gold'?12:10;if(a.gift==='weapon'){n+=K.weapons.find(w=>w.id===a.weapon).power;take(s,a.weapon);}favor(s,a.neighbor,n);}
    if(a.type==='caravan'||a.type==='envoy'){
      let reward=a.cargo==='food'?32:38;if(a.cargo==='weapon'){reward=tradePrice(s,a.weapon)+20;take(s,a.weapon);}
      s.expeditions.push({kind:a.type,ids:[...a.ids],neighbor:a.neighbor,reward,returnAt:s.elapsedDays+(a.type==='envoy'?3:4+Math.floor(random(s)*3))});
      a.ids.forEach(id=>{const f=s.folk.find(f=>f.id===id);f.away=a.type;f.room=null;});
    }
  }
  function tickEconomy(s){
    if(s.repair&&!--s.repair.remaining){s.gateHP=gateMax(s);s.repair=null;log(s,'성문 수리 완료');}
    const c=s.crafts[0];if(c&&room(s,c.slot)&&!room(s,c.slot).fire&&workers(s,c.slot).length){c.remaining--;if(c.remaining<=0){s.inventory.push(c.weapon);s.crafts.shift();log(s,`${K.weapons.find(w=>w.id===c.weapon).name} 제작 완료 → 가방`);}}
    s.visitors=s.visitors.filter(v=>v.until>=s.day);
  }
  function returnMission(s,ex){
    const people=ex.ids.map(id=>s.folk.find(f=>f.id===id)).filter(Boolean);people.forEach(f=>f.away=null);
    if(ex.kind==='caravan'){const attacked=random(s)<.2;s.res.gold+=Math.round(ex.reward*(attacked?.6:1));if(attacked)people.forEach(f=>damage(s,f.id,35));log(s,`수도 행상 귀환 · 금화 +${Math.round(ex.reward*(attacked?.6:1))}${attacked?' · 약탈로 수익 40% 손실':''}`);}
    else {const heart=Math.max(0,...people.map(f=>f.heart)),id=`envoy-${s.elapsedDays}-${ex.neighbor}`;s.events[id]={id,kind:'neighbor',title:K.neighbors[ex.neighbor].name+' 사절 귀환',text:'이웃은 다음 겨울을 함께 준비하자고 합니다.',bearer:{name:people[0]?.name||'사절',role:'귀환 사절'},choices:[{label:'우호적으로 설득한다',cost:{},fx:{},neighbor:ex.neighbor,favor:heart>=7?20:10},{label:'선물을 더 보낸다',cost:{gold:10},fx:{},neighbor:ex.neighbor,favor:25},{label:'안부만 전한다',cost:{},fx:{},neighbor:ex.neighbor,favor:5}]};s.queue.push({id,until:s.day+3});}
  }
  function capitalNews(s){const empress=35+Math.floor(random(s)*31),iron=[1,3].includes(season(s));s.capital={empress,emperor:100-empress,weaponSale:iron?1.2:1,suspicion:empress>=50?.2:0,rumors:['새 인구 대장이 레헨스부르크 황궁에 올랐습니다.',empress>=50?'페른하임의 마차가 황후궁에 자주 드나듭니다.':'황제파 귀족들이 북부 교역 재개를 청했습니다.',iron?'철 수레가 늦어져 무기 판매가가 올랐습니다.':'남쪽 곡물 시장이 평년 거래를 되찾았습니다.']};}
  function visitor(s,id=nextCandidate(s)){
    const f=K.folk.find(f=>f.id===id);if(!f)return null;const reveal=workers(s,slotOf(s,'parlor')).some(f=>f.heart>=7),bad=['frail','gossip','hungry'].includes(f.trait);
    return {...f,age:22+K.folk.indexOf(f)*2,origin:['북쪽 산촌','아이젠베르크 광산촌','남쪽 곡창'][K.folk.indexOf(f)%3],level:1,story:'길이 막히기 전에 성을 찾았습니다. 할 수 있는 일을 맡겨 주세요.',traitName:bad&&!reveal?'? 숨겨진 특장점':K.traits[f.trait].name,traitDesc:bad&&!reveal?'응접실에 마음 7 이상인 사람이 있으면 드러납니다.':K.traits[f.trait].desc,reveal};
  }
  function eventFor(s,id){
    const src=s.events?.[id]||K.events.find(e=>e.id===id);if(!src)return null;const e=clone(src);
    if(!e.bearer){let f=K.folk.find(f=>f.id===['bruno','liesel','johanna','heinz','ottilie','fritz','ottilie','eleanor'][Number(e.id.replace('request',''))])||K.folk[3];
      if(e.kind==='refugee')f=visitor(s)||f;
      if(['inspection','leopold'].includes(e.kind))f={name:'레오폴트 비젠',role:'황후궁 시종무관 · 정체를 알 수 없는 감시자'};
      if(e.kind==='merchant')f={name:'마티아스',role:'계절 행상 · 3일간 체류',age:46,origin:'레헨스부르크',str:3,dex:6,heart:5};
      e.bearer=f;
    }
    return e;
  }
  function dayEvent(s){
    const day=s.day,choice=(label,fx={},cost={},extra={})=>({label,fx,cost,...extra});let e=K.events.find(e=>e.day===day);
    if(day===108)e={...clone(K.events.find(e=>e.kind==='merchant')),id:'winter-merchant',day,title:'눈길을 건넌 행상'};
    if(day===38&&!s.julian.registry)e={id:'registry',kind:'registry',day,title:'율리안을 누구의 아이로 올릴 것인가',text:'여름 감찰 전에 호적을 정해야 합니다. 이 이름은 아이의 성장 바탕과 황궁의 의심을 바꿉니다.',choices:Object.entries(K.registries).map(([id,r])=>choice(r.name,{sus:r.sus,...(id==='johanna'?{satisfaction:8}:{})},{},{registry:id}))};
    if([24,54,78,114].includes(day)){const heart=sum(workers(s,slotOf(s,'parlor')),'heart');e={id:`leopold${day}`,kind:'leopold',day,title:'레오폴트의 방문',text:'“황후궁에서는 모두의 안녕을 묻습니다. 장부보다 사람의 말이 오래 남기도 하지요.”',choices:[choice('응접실에서 정중히 접대한다',{sus:heart>=7?-6:4},{food:4}),choice('형식적인 인사만 나눈다',{sus:3}),choice('영지의 사정을 솔직히 전한다',{sus:heart>=10?-2:2})]};}
    if([16,42,75,102].includes(day)){const id=Object.keys(K.neighbors)[[16,42,75,102].indexOf(day)],n=K.neighbors[id];e={id:`neighbor-${id}`,kind:'neighbor',day,title:n.name+'의 부탁',text:'이웃에서 함께 쓸 비축 식량을 구합니다.',bearer:{name:n.envoy,role:n.name+' 사절',age:38,origin:n.direction,str:3,dex:4,heart:7},choices:[choice('식량을 나눈다',{xp:5},{food:10},{neighbor:id,favor:15}),choice('이번에는 사정을 전한다',{}, {},{neighbor:id,favor:-3})]};}
    return e;
  }
  function arrive(s,e){s.events[e.id]=clone(e);
    if(['request','neighbor'].includes(e.kind))s.queue.push({id:e.id,until:s.day+3});else s.pending=e.id;
    if(e.kind==='merchant')s.visitors.push({kind:'merchant',until:s.day+3});
    if(e.kind==='inspection'){s.sus=clamp(s.sus+(adjacent(slotOf(s,'parlor'),slotOf(s,'nursery'))?15:0)+(K.registries[s.julian.registry]?.inspection||0)-(s.neighbors.halden>=70?15:0));}
    if(e.kind==='leopold'&&s.julian.registry==='ottilie')s.sus=clamp(s.sus+5);
  }
  function expireQueue(s){for(const q of s.queue.filter(q=>q.until<s.day)){const e=eventFor(s,q.id),c=e.choices.at(-1);effects(s,c.fx);if(c.neighbor)favor(s,c.neighbor,c.favor);log(s,`${e.title} 기한 만료 · ${c.label}`);}s.queue=s.queue.filter(q=>q.until>=s.day);}
  function checkGoals(s){const i=season(s),checks=[
    [structures(s,'field').length&&Object.entries(s.rooms).some(([id,r])=>r?.type==='field'&&workers(s,id).length),s.metrics.recruited>0,s.metrics.checkup>0],
    [s.res.food>=100,s.metrics.trade>0,!!s.julian.registry],
    [s.res.wood>=100,room(s,slotOf(s,'gate')).level>=2,s.raidsWon>=3],
    [s.day>=115&&s.res.wood>=30,!!s.metrics.boss,s.julian.growth===4]
    ][i];checks.forEach((ok,j)=>{if(ok&&!s.goals[i].includes(j)){s.goals[i].push(j);gainXP(s,5+j*3);log(s,`계절 목표 완료: ${K.objectives[i][j]} · 명성 +${5+j*3}`);}});}

  function act(state,action){const s=clone(state),error=perform(s,action);return {state:error?state:s,error};}
  // 구조화된 저장 검증: 손상되거나 이전 버전인 저장은 새 게임으로 대체한다.
  function validSave(s){
    function validRooms(s){
      return Object.keys(s.rooms).length===30&&Object.entries(s.rooms).every(([id,r])=>{
        if(!/^r[0-5]c[0-4]$/.test(id))return false;
        if(r===null)return true;
        if(!unlocked(s,id))return false;
        if(r.mergedInto){const anchor=s.rooms[r.mergedInto];return !!anchor?.type&&id[1]===r.mergedInto[1]&&+id[3]>+r.mergedInto[3]&&+id[3]<+r.mergedInto[3]+anchor.size;}
        if(!K.rooms[r.type]||!Number.isInteger(r.level)||r.level<1||r.level>3||!Number.isInteger(r.size)||r.size<1||r.size>3)return false;
        return Array.from({length:r.size},(_,offset)=>`r${id[1]}c${+id[3]+offset}`).every((cell,offset)=>unlocked(s,cell)&&(!offset||s.rooms[cell]?.mergedInto===id));
      });
    }
    function shape(s){
      const finite=(v,a=0,b=Infinity)=>Number.isFinite(v)&&v>=a&&v<=b;
      return s&&s.version===K.version&&Number.isInteger(s.day)&&finite(s.day,0,120)&&Number.isInteger(s.year)&&s.year>0&&Number.isInteger(s.level)&&finite(s.level,1,5)&&finite(s.rng)&&finite(s.elapsedDays)&&finite(s.xp)&&finite(s.sus,0,100)
        &&['food','wood','gold'].every(k=>finite(s.res[k]))&&['health','bond'].every(k=>finite(s.julian[k],0,100))
        &&['folk','notices','inventory','expeditions','graveyard','candidates','records','seen','log','yearReports'].every(k=>Array.isArray(s[k]))
        &&s.folk.every(f=>K.folk.some(p=>p.id===f.id)&&K.traits[f.trait]&&finite(f.hp)&&finite(f.hurt)&&finite(f.level,1,10)&&finite(f.satisfaction,0,100)&&finite(f.xp)&&['str','dex','heart'].every(k=>finite(f[k],1,10)&&finite(f.work[k]))&&Array.isArray(f.history))
        &&validRooms(s)&&s.folk.every(f=>f.room===null||!!s.rooms[f.room]?.type)
        &&s.inventory.every(id=>K.weapons.some(w=>w.id===id)||K.items[id])&&s.rush&&finite(s.failures)&&finite(s.blizzardUntil)&&Number.isFinite(s.lullabyDay)
        &&(!s.pending||!!eventFor(s,s.pending))&&(!s.raid||finite(s.raid.hp)&&finite(s.raid.max)&&Array.isArray(s.raid.path)&&s.raid.path.every(id=>s.rooms[id]?.type)&&Number.isInteger(s.raid.idx)&&s.raid.idx>=0&&s.raid.idx<s.raid.path.length)
        &&['playing','yearEnd','gameOver'].includes(s.status)&&finite(s.gateHP,0,gateMax(s))&&finite(s.wallLevel,1,3)&&Array.isArray(s.crafts)&&Array.isArray(s.queue)&&s.events&&s.built&&s.neighbors&&s.metrics&&s.capital&&Array.isArray(s.goals)&&Array.isArray(s.warnings)&&Array.isArray(s.julian.timeline);
    }
    try{return !!(shape(s)&&s.checkpoint&&s.checkpoint.checkpoint===null&&shape(s.checkpoint));}catch{return false;}
  }

  return {columns,firstColumn,lodging,restore,eventFor,visitor,averageSatisfaction,satisfactionMult,gateMax,defense,raidPower,forecast,craftDays,scoutRisk,tradePrice,merchantHere,growth:s=>K.growth[s.julian.growth],risks,objectives:s=>K.objectives[season(s)].map((text,i)=>({text,done:s.goals[season(s)].includes(i)})),create,step,act,validate,price,rate,daily,season,workers,slotOf,popCap,storageCap,capacity,unlocked,maxHP,weaponPower,validSave,
    // 순수 규칙 테스트용: 입력 사본에 피해를 가한다.
    injure(state,id,n){const s=clone(state);damage(s,id,n);return s;}};
});
