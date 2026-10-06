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
  function log(s,text){s.log.unshift(`${s.year}년 ${K.seasons[season(s)]} ${s.day%30+1}일 · ${text}`);s.log=s.log.slice(0,40);}
  function makeFolk(f){return {...clone(f),hp:100,hurt:0,away:null,level:1,xp:0,satisfaction:70,weapon:null,work:{str:0,dex:0,heart:0},history:f.room?[{day:0,year:1,room:f.room}]:[]};}
  function snapshot(s){const c=clone({...s,checkpoint:null});c.notices=[];c.lastFailure=null;return c;}
  function create(seed=1){
    const s={version:K.version,rng:seed>>>0,seed:seed>>>0,year:1,day:0,elapsedDays:0,res:{...B.start},xp:0,level:1,
      rooms:{},folk:K.folk.slice(0,6).map(makeFolk),julian:{health:85,bond:15},sus:20,raid:null,raidsWon:0,
      graveyard:[],expeditions:[],candidates:[],inventory:[],pending:null,notices:[{kind:'cutscene',id:'start'}],
      seen:['start'],records:[],yearReports:[],status:'playing',blizzardUntil:0,rush:{},log:[],failures:0,lastFailure:null,lullabyDay:-1,checkpoint:null};
    K.layout.forEach((row,r)=>row.forEach((type,c)=>s.rooms[`r${r}c${c}`]=type?{type,level:1,size:1}:null));
    s.checkpoint=snapshot(s);return s;
  }
  function unlocked(s,id){return /^r[0-5]c[0-2]$/.test(id)&&+id[1]<s.level+1;}
  function rate(s,id){
    const r=room(s,id),def=K.rooms[r?.type];
    if(!def?.res||r.fire||(r.type==='field'&&season(s)>1))return 0;
    return workers(s,id).reduce((n,f)=>n+f[def.stat]*(.8+f.satisfaction/250)*(trait(f).room===r.type?trait(f).production:1),0)*B.levelMult[r.level-1];
  }
  function daily(s){
    const out={food:-s.folk.reduce((n,f)=>n+B.foodPerPerson+(trait(f).food||0),0),wood:-B.woodUse[season(s)]*(s.day<s.blizzardUntil?2:1),gold:0};
    for(const id of Object.keys(s.rooms)){const def=K.rooms[room(s,id)?.type];if(def?.res)out[def.res]+=rate(s,id);}
    out.sus=.5-workers(s,slotOf(s,'parlor')).reduce((n,f)=>n+f.heart*.08-(trait(f).suspicion||0),0);
    return out;
  }
  function price(s,a){
    const r=room(s,a.slot),def=K.rooms[r?.type];
    if(a.type==='build')return {gold:K.rooms[a.room]?.cost||0};
    if(a.type==='upgrade'&&r)return {gold:def.cost*r.level*r.size,wood:8*r.level*r.size};
    if(a.type==='merge'&&r)return {gold:20*r.level,wood:5*r.level};
    if(a.type==='craft')return {gold:K.weapons.find(w=>w.id===a.weapon)?.cost||0,wood:5};
    if(a.type==='extinguish')return {wood:4};
    return {};
  }
  const affordable=(s,cost)=>Object.entries(cost).every(([k,n])=>s.res[k]>=n);
  function pay(s,cost){for(const [k,n] of Object.entries(cost))s.res[k]-=n;}
  function gainXP(s,n){s.xp+=n;const old=s.level;while(s.level<5&&s.xp>=B.levelXP[s.level])s.level++;if(old!==s.level){log(s,`영지 Lv${s.level} · ${s.level+1}층 개방`);s.notices.push({kind:'level',level:s.level});}}
  function damage(s,id,n){
    const f=s.folk.find(f=>f.id===id);if(!f||f.hurt)return;
    f.hp-=n*(trait(f).damage||1);
    if(f.hp>0)return;
    if(f.hero||f.named){f.hurt=f.hero?7:14;f.hp=1;f.room=null;log(s,`${f.name} ${f.hurt}일 부상`);}
    else{s.graveyard.push({id:f.id,name:f.name,year:s.year,day:s.day});s.folk=s.folk.filter(p=>p!==f);s.folk.forEach(p=>p.satisfaction=clamp(p.satisfaction-12));log(s,`${f.name}을 묘지에 기록했다.`);}
  }
  function adjacent(a,b){return a[1]===b[1]&&Math.abs(+a[3]-+b[3])===1;}
  function validate(s,a){
    if(!a||typeof a.type!=='string')return '알 수 없는 명령';
    const r=room(s,a.slot),f=s.folk.find(f=>f.id===a.id);
    if(a.type==='ack')return s.notices.length?null:'알림 없음';
    if(a.type==='continue')return s.status==='yearEnd'?null:'결산 후 계속할 수 있습니다';
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
      const e=K.events.find(e=>e.id===s.pending),c=e?.choices[a.index];
      if(!c)return '사건 선택지가 없습니다';
      if(c.recruit&&s.folk.length>=popCap(s))return '숙소가 부족합니다';
      if(!affordable(s,c.cost))return '비용이 부족합니다';return null;
    }else if(a.type==='scout'){
      if(!K.scouts.some(d=>d.id===a.destination)||!Array.isArray(a.ids)||a.ids.length<1||a.ids.length>3||new Set(a.ids).size!==a.ids.length)return '1~3명을 선택하세요';
      if(a.ids.some(id=>!s.folk.some(f=>f.id===id&&available(f))))return '부상 또는 파견 중인 사람입니다';
      return null;
    }else if(a.type==='recruit'){
      if(!s.candidates.includes(a.id)||s.folk.length>=popCap(s))return '후보 또는 숙소가 없습니다';return null;
    }else if(a.type==='craft'){
      const w=K.weapons.find(w=>w.id===a.weapon);
      if(!w||w.scout||!Object.entries(s.rooms).some(([id,r])=>r?.type==='forge'&&r.level>=w.level&&!r.fire&&workers(s,id).length))return '일꾼과 해당 레벨 대장간이 필요합니다';
    }else if(a.type==='equip'){
      if(!f||!available(f)||a.weapon!==null&&!s.inventory.includes(a.weapon))return '장비를 사용할 수 없습니다';return null;
    }else if(a.type==='lullaby'){
      if(s.lullabyDay===s.elapsedDays)return '오늘은 이미 노래했습니다';
      if(!workers(s,slotOf(s,'nursery')).length)return '요람실에 돌보는 사람이 필요합니다';return null;
    }else return '알 수 없는 명령';
    return affordable(s,price(s,a))?null:'재화가 부족합니다';
  }
  function recruit(s,id){
    const p=K.folk.find(f=>f.id===id&&!s.folk.some(x=>x.id===id)&&!s.graveyard.some(x=>x.id===id));
    if(!p)return;const f=makeFolk(p);f.room=null;f.history=[];s.folk.push(f);log(s,`${f.name}이 성에 합류했다.`);
  }
  function nextCandidate(s){return K.folk.slice(6).find(f=>!s.folk.some(p=>p.id===f.id)&&!s.graveyard.some(p=>p.id===f.id)&&!s.candidates.includes(f.id))?.id;}
  function effects(s,fx){
    for(const [key,n] of Object.entries(fx)){
      if(key in s.res)s.res[key]+=n;
      else if(key==='sus')s.sus=clamp(s.sus+n);
      else if(key==='health'||key==='bond')s.julian[key]=clamp(s.julian[key]+n);
      else if(key==='satisfaction')s.folk.forEach(f=>f.satisfaction=clamp(f.satisfaction+n));
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
      case 'build':s.rooms[a.slot]={type:a.room,level:1,size:1};gainXP(s,5);log(s,`${K.rooms[a.room].name} 건설`);break;
      case 'upgrade':r.level++;gainXP(s,5);log(s,`${K.rooms[r.type].name} Lv${r.level}`);break;
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
        const e=K.events.find(e=>e.id===s.pending),c=e.choices[a.index];pay(s,c.cost);effects(s,c.fx);if(c.recruit)recruit(s,nextCandidate(s));s.pending=null;gainXP(s,2);log(s,`${e.title} · ${c.label}`);break;
      }
      case 'scout':{
        const dest=K.scouts.find(d=>d.id===a.destination),id=`${s.year}-${s.day}-${s.expeditions.length}`;
        s.expeditions.push({id,destination:dest.id,returnAt:s.elapsedDays+dest.days,ids:[...a.ids]});
        a.ids.forEach(id=>{const p=s.folk.find(f=>f.id===id);p.away=id;p.room=null;});log(s,`${dest.name} 정찰 출발 · ${dest.days}일`);break;
      }
      case 'recruit':recruit(s,a.id);s.candidates=s.candidates.filter(id=>id!==a.id);break;
      case 'craft':s.inventory.push(a.weapon);break;
      case 'equip':if(f.weapon)s.inventory.push(f.weapon);f.weapon=a.weapon;if(a.weapon)s.inventory.splice(s.inventory.indexOf(a.weapon),1);break;
      case 'lullaby':s.lullabyDay=s.elapsedDays;effects(s,a.success?{bond:8,health:4}:{bond:1});log(s,a.success?'자장가 끝에 아이가 잠들었다.':'아이를 안고 다시 숨을 고른다.');break;
      case 'continue':s.year++;s.day=0;s.status='playing';s.yearStartDeaths=s.graveyard.length;s.notices.push({kind:'season',season:0});s.checkpoint=snapshot(s);break;
    }
    for(const k of ['food','wood'])s.res[k]=clamp(s.res[k],0,storageCap(s));
    return null;
  }
  function rollback(s,reason){
    const failures=s.failures+1,total=s.elapsedDays,notices=[{kind:'failure',reason}];
    const restored=clone(s.checkpoint);restored.checkpoint=clone(s.checkpoint);restored.failures=failures;restored.lastFailure=reason;
    // 파견 귀환은 체크포인트의 게임 시간과 함께 되감는다. 누적 진행 통계만 별도로 보관한다.
    restored.attemptedDays=(s.attemptedDays||0)+total-restored.elapsedDays;restored.notices=notices;
    restored.rng=(s.rng+2654435761)>>>0;log(restored,`${reason} · 계절 첫날로 되돌아왔다.`);return restored;
  }
  function failure(s){return s.sus>=100?'의심이 100에 닿아 율리안을 빼앗겼다':s.julian.health<=0?'율리안의 건강이 무너져 보호권을 잃었다':null;}
  function startRaid(s,def){
    const power=(s.level*12+B.raidBonus[season(s)]+(def.boss?B.bossBonus:0))*(1+B.yearScale*(s.year-1))*(1-B.raidVariance/2+random(s)*B.raidVariance);
    const gate=slotOf(s,'gate'),nursery=slotOf(s,'nursery');
    const path=[gate,...Object.keys(s.rooms).filter(id=>s.rooms[id]?.type&&id!==gate&&id!==nursery),nursery];
    s.raid={name:def.name,hp:power,max:power,idx:0,path};
    if(!s.seen.includes('raid')){s.seen.push('raid');s.notices.push({kind:'cutscene',id:'raid'});}log(s,`${def.name} 도착`);
  }
  function raidRound(s){
    const rd=s.raid,id=rd.path[rd.idx],r=room(s,id),defenders=workers(s,id);
    let defense=defenders.reduce((n,f)=>n+f.str+weaponPower(s,f)+(trait(f).defense||0),0)*B.levelMult[r.level-1]*B.defenseScale;
    if(r.type==='gate')defense+=6*r.level+workers(s,slotOf(s,'barracks')).reduce((n,f)=>n+(f.str+weaponPower(s,f))*.5,0);
    const before=rd.hp;rd.hp-=defense;
    for(const f of [...defenders])damage(s,f.id,Math.max(0,before-defense*.7)*B.raidDamage/Math.max(1,defenders.length));
    if(rd.hp<=0){s.raidsWon++;s.res.gold+=18;gainXP(s,10);s.raid=null;log(s,'습격을 막았다.');return s;}
    if(r.type==='nursery')return rollback(s,'요람실이 함락되어 율리안을 빼앗겼다');
    if(K.rooms[r.type].res)s.res[K.rooms[r.type].res]=Math.max(0,s.res[K.rooms[r.type].res]-8);
    rd.idx++;return s;
  }
  function returnScouts(s){
    for(const ex of s.expeditions.filter(e=>e.returnAt<=s.elapsedDays)){
      const d=K.scouts.find(d=>d.id===ex.destination),people=ex.ids.map(id=>s.folk.find(f=>f.id===id)).filter(Boolean);
      const risk=Math.max(.02,d.risk+people.reduce((n,f)=>n+(trait(f).scout||0),0)-people.length*.02);
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
    const lost=failure(s);if(lost)return rollback(s,lost);
    if(s.status!=='playing'||s.pending)return s;
    if(s.raid)return raidRound(s);
    // 결산/계절 경계는 전날의 사건과 습격이 끝난 다음 확정한다.
    if(s.day>0&&s.day%30===0&&s.checkpoint.day!==s.day){
      if(s.day===120){
        s.status='yearEnd';const tax=s.folk.length*B.taxPerPerson;s.res.gold+=tax;
        const report={year:s.year,population:s.folk.map(f=>({name:f.name,level:f.level})),deaths:clone(s.graveyard.filter(f=>f.year===s.year)),tax,bond:s.julian.bond,health:s.julian.health,raidsWon:s.raidsWon};
        s.yearReports.push(report);s.notices.push({kind:'cutscene',id:'year'});return s;
      }
      s.checkpoint=snapshot(s);s.notices.push({kind:'season',season:season(s)});
      if(season(s)===3&&!s.seen.includes('winter')){s.seen.push('winter');s.notices.push({kind:'cutscene',id:'winter'});}
    }
    const d=daily(s);s.rush={};
    for(const key of ['food','wood','gold'])s.res[key]+=d[key];
    const hungry=s.res.food<0,cold=s.res.wood<0;
    s.sus=clamp(s.sus+d.sus);
    const care=workers(s,slotOf(s,'nursery'));
    s.julian.health=clamp(s.julian.health+(care.length?sum(care,'heart')*.12+care.reduce((n,f)=>n+(trait(f).care||0),0):-B.healthWithoutCare)-(hungry?B.starvationDamage:0)-(cold?B.coldDamage:0));
    s.julian.bond=clamp(s.julian.bond+care.reduce((n,f)=>n+f.heart*.025*(trait(f).bond||1)+(f.hero?.3:0),0)-(care.length?0:.3));
    for(const f of [...s.folk]){
      if(f.hurt){f.hurt--;if(!f.hurt)f.hp=maxHP(f);continue;}
      if(f.away)continue;
      f.satisfaction=clamp(f.satisfaction+(hungry||cold?-3:.15));
      if(hungry||cold)damage(s,f.id,(hungry?3:0)+(cold?3*(trait(f).cold||1):0));
      else f.hp=clamp(f.hp+2,0,maxHP(f));
      const def=K.rooms[room(s,f.room)?.type];
      if(def?.stat&&!room(s,f.room).fire&&!(room(s,f.room).type==='field'&&season(s)>1)){
        f.xp++;f.work[def.stat]++;if(f.work[def.stat]%10===0)f[def.stat]=Math.min(10,f[def.stat]+(room(s,f.room).type==='barracks'?2:1));
        const lv=Math.min(10,1+Math.floor(f.xp/10));if(lv>f.level){f.hp+=8*(lv-f.level);f.level=lv;}
      }
    }
    for(const [id,r] of Object.entries(s.rooms))if(r?.fire){workers(s,id).forEach(f=>damage(s,f.id,8));r.fire--;}
    s.day++;s.elapsedDays++;gainXP(s,1);returnScouts(s);
    for(const key of ['food','wood'])s.res[key]=clamp(s.res[key],0,storageCap(s));
    if(s.day>=91&&s.day<118&&random(s)<.14){s.blizzardUntil=s.day+3;log(s,'눈보라 · 사흘 동안 장작 소모 두 배');}
    if(s.day%30===0){const i=s.day/30-1,rec={year:s.year,season:i,title:K.milestones[i][0],text:K.milestones[i][1]};s.records.push(rec);s.notices.push({kind:'record',...rec});}
    const e=K.events.find(e=>e.day===s.day);
    if(e){s.pending=e.id;if(e.kind==='inspection'&&adjacent(slotOf(s,'parlor'),slotOf(s,'nursery')))s.sus=clamp(s.sus+15);}
    const rd=K.raids.find(r=>r.day===s.day);if(rd)startRaid(s,rd);
    const reason=failure(s);return reason?rollback(s,reason):s;
  }
  function act(state,action){const s=clone(state),error=perform(s,action);return {state:error?state:s,error};}
  // 구조화된 저장 검증: 손상되거나 이전 버전인 저장은 새 게임으로 대체한다.
  function validSave(s){
    function shape(s){
      const finite=(v,a=0,b=Infinity)=>Number.isFinite(v)&&v>=a&&v<=b;
      return s&&s.version===K.version&&Number.isInteger(s.day)&&finite(s.day,0,120)&&Number.isInteger(s.year)&&s.year>0&&finite(s.level,1,5)&&finite(s.rng)&&finite(s.elapsedDays)&&finite(s.xp)&&finite(s.sus,0,100)
        &&['food','wood','gold'].every(k=>finite(s.res[k]))&&['health','bond'].every(k=>finite(s.julian[k],0,100))
        &&['folk','notices','inventory','expeditions','graveyard','candidates','records','seen','log','yearReports'].every(k=>Array.isArray(s[k]))
        &&s.folk.every(f=>K.folk.some(p=>p.id===f.id)&&K.traits[f.trait]&&finite(f.hp)&&finite(f.hurt)&&finite(f.level,1,10)&&finite(f.satisfaction,0,100)&&finite(f.xp)&&['str','dex','heart'].every(k=>finite(f[k],1,10)&&finite(f.work[k]))&&Array.isArray(f.history))
        &&Object.keys(s.rooms).length===18&&Object.entries(s.rooms).every(([id,r])=>/^r[0-5]c[0-2]$/.test(id)&&(r===null||r.mergedInto&&s.rooms[r.mergedInto]?.type||K.rooms[r.type]&&finite(r.level,1,3)&&finite(r.size,1,3)))
        &&s.inventory.every(id=>K.weapons.some(w=>w.id===id))&&s.rush&&finite(s.failures)&&finite(s.blizzardUntil)&&Number.isFinite(s.lullabyDay)
        &&(!s.pending||K.events.some(e=>e.id===s.pending))&&(!s.raid||finite(s.raid.hp)&&finite(s.raid.max)&&Array.isArray(s.raid.path)&&s.raid.path.every(id=>s.rooms[id]?.type)&&Number.isInteger(s.raid.idx)&&s.raid.idx>=0&&s.raid.idx<s.raid.path.length)
        &&['playing','yearEnd'].includes(s.status);
    }
    try{return !!(shape(s)&&s.checkpoint&&s.checkpoint.checkpoint===null&&shape(s.checkpoint));}catch{return false;}
  }

  return {create,step,act,validate,price,rate,daily,season,workers,slotOf,popCap,storageCap,capacity,unlocked,maxHP,weaponPower,validSave,
    // 순수 규칙 테스트용: 입력 사본에 피해를 가한다.
    injure(state,id,n){const s=clone(state);damage(s,id,n);return s;}};
});
