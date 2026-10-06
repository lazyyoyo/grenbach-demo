(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./data'),require('./sim-core'));else root.KeepPolicy=factory(root.KEEP,root.KeepSim);})(typeof window==='undefined'?globalThis:window,(K,Sim)=>{
  // 정책은 공개된 정보만 보고 명령 목록을 낸다. 생존 보정/시드별 분기는 없다.
  function policy(state,kind='average'){
    if(state.p1)return prototypePolicy(state,kind);
    let s=state;const actions=[];
    const push=a=>{if(Sim.validate(s,a))return false;actions.push(a);s=Sim.act(s,a).state;return true;};
    if(kind==='idle'){
      if(s.pending){const e=Sim.eventFor(s,s.pending);push({type:'choice',index:e.choices.length-1});}return actions;
    }
    const expert=kind==='expert';
    if(s.pending){const e=Sim.eventFor(s,s.pending);let index=e.kind==='registry'?1:0;if(e.kind==='merchant')index=s.res.food<45?0:s.res.wood<65?1:2;if(Sim.validate(s,{type:'choice',index}))index=e.choices.length-1;push({type:'choice',index});}
    if(s.queue.length){push({type:'openRequest',id:s.queue[0].id});push({type:'choice',index:0});}
    if(s.gateHP<Sim.gateMax(s)*(expert?.95:.55))push({type:'repair'});
    if(expert&&s.day>65&&s.neighbors.berg<70)push({type:'gift',neighbor:'berg',gift:'food'});
    const build=type=>{if(Sim.slotOf(s,type))return;const slot=Object.keys(s.rooms).find(id=>s.rooms[id]===null&&Sim.unlocked(s,id));if(slot)push({type:'build',slot,room:type});};
    build('forge');
    if(s.level>=2){build('dorm');build('storage');}
    if(expert&&s.level>=3)build('barracks');
    const assign=(id,type)=>{const f=s.folk.find(f=>f.id===id),slot=Sim.slotOf(s,type);if(f&&slot&&f.room!==slot)push({type:'assign',id,slot});};
    assign('ottilie','nursery');assign('johanna','parlor');assign('bruno','lumber');assign('liesel','kitchen');assign('heinz','gate');
    const nearRaid=s.raid||K.raids.some(r=>r.day>=s.day&&r.day-s.day<=2);
    assign('eleanor',nearRaid?'gate':'forge');
    s.folk.filter(f=>!K.folk.slice(0,6).some(p=>p.id===f.id)).forEach(f=>{
      const target=nearRaid&&f.str>=5?'gate':f.dex>=5?'forge':f.heart>=6?'nursery':expert?'barracks':'lumber';
      assign(f.id,target);
    });
    if(s.pending){
      const e=Sim.eventFor(s,s.pending);let index=0;
      if(e.kind==='merchant')index=s.res.food<45?0:s.res.wood<65?1:2;
      if(Sim.validate(s,{type:'choice',index}))index=e.choices.length-1;
      push({type:'choice',index});
    }
    for(const [slot,r] of Object.entries(s.rooms))if(r?.fire)push({type:'extinguish',slot});
    const upgrade=(type,max)=>{const slot=Sim.slotOf(s,type);if(slot&&s.rooms[slot].level<max)push({type:'upgrade',slot});};
    // 평균: 필요한 방을 하나씩 확장. 고수: 무기와 수비 성장에 먼저 투자.
    if(s.day>25)upgrade('gate',3);
    if(expert&&s.day>60&&s.wallLevel<3)push({type:'wall'});
    if(s.res.food<35)upgrade('kitchen',2);
    if(expert){
      if(s.day>15)upgrade('forge',3);
      if(s.day>60)upgrade('barracks',2);
      for(const id of ['eleanor','heinz']){
        const f=s.folk.find(f=>f.id===id);if(!f||f.weapon)continue;
        const lv=s.rooms[Sim.slotOf(s,'forge')]?.level||1,weapon=lv>=3?'sword':lv>=2?'spear':'knife';
        if(!s.inventory.includes(weapon)&&!s.crafts.some(c=>c.weapon===weapon))push({type:'craft',weapon});
        push({type:'equip',id,weapon});
      }
      if(s.julian.health<65)assign('johanna','nursery');
      for(const id of [...s.candidates])push({type:'recruit',id});
    }
    return actions;
  }
  function prototypePolicy(state,kind){
    let s=state;const actions=[],expert=['expert','hider','revealer'].includes(kind);
    const push=a=>{if(Sim.validate(s,a))return false;const r=Sim.act(s,a);if(r.error)return false;s=r.state;actions.push(a);return true;};
    if(s.prologue==='gate')push({type:'openGate'});if(s.prologue==='cradle')push({type:'placeChild',slot:Sim.slotOf(s,'nursery')});
    if(s.pending){const e=Sim.eventFor(s,s.pending);let index=kind==='idle'?e.choices.length-1:0;if(Sim.validate(s,{type:'choice',index}))index=e.choices.length-1;push({type:'choice',index});}
    for(const g of s.guests||[]){const e=Sim.eventFor(s,g.id);let index=kind==='idle'||e.kind==='leopold'&&(kind==='hider'||kind==='expert'&&Sim.leopoldScore(s)<10&&s.julian.abroad?.kind!=='study')?e.choices.length-1:0;if(Sim.validate(s,{type:'choice',guest:g.id,index}))index=e.choices.length-1;push({type:'choice',guest:g.id,index});}
    if(kind==='idle')return actions;
    if(s.queue.length){push({type:'openRequest',id:s.queue[0].id});push({type:'choice',index:0});}
    const build=type=>{if(Sim.slotOf(s,type))return;const slot=Object.keys(s.rooms).find(id=>s.rooms[id]===null&&id!==s.residence.slot&&Sim.unlocked(s,id));if(slot)push({type:'build',slot,room:type});};
    build('dorm');
    if(s.v08&&Sim.slotOf(s,'dorm')&&s.rooms[Sim.slotOf(s,'dorm')].level<2)push({type:'upgrade',slot:Sim.slotOf(s,'dorm')});
    const assign=(id,type)=>{const f=s.folk.find(f=>f.id===id),slot=Sim.slotOf(s,type);if(f&&slot&&f.room!==slot)push({type:'assign',id,slot});};
    // 숙련은 습격 예고를 보고 벌목 담당을 잠시 성문으로 옮긴다.
    const defend=kind==='expert'&&(s.raid||(Sim.forecast(s)?.days??99)<=2);
    assign('ottilie','nursery');assign('johanna','parlor');assign('bruno',defend?'gate':'lumber');assign('liesel','kitchen');assign('heinz','gate');assign('eleanor','gate');
    for(const f of s.folk.slice(6))assign(f.id,f.heart>=6?'parlor':f.dex>=5?'kitchen':f.str>=5?'barracks':'lumber');
    if(s.gateHP<Sim.gateMax(s)*(expert?.95:.77))push({type:'repair'});
    const upgrade=(type,max)=>{const slot=Sim.slotOf(s,type);if(slot&&s.rooms[slot].level<max)push({type:'upgrade',slot});};
    if(s.day>20||s.year>1)upgrade('gate',3);
    if(s.res.food<50)upgrade('kitchen',3);
    if(s.res.wood<50)upgrade('lumber',2);
    if(s.level>=3){if(s.wallLevel<(expert?3:2))push({type:'wall'});build('barracks');}
    if(s.res.gold>100)build('storage');
    if(s.julian.health<60)push({type:'checkup'});
    if(expert&&s.julian.age>=3&&['outside','r0c1',Sim.slotOf(s,'forge')].includes(s.julian.location))push({type:'recall'});
    if(s.julian.age>=5&&!s.teacher){push({type:'teacher',id:expert?'eleanor':'ottilie'});if(expert){push({type:'tool',tool:'book'});push({type:'tool',tool:'sword'});}}
    for(const [slot,r] of Object.entries(s.rooms))if(r?.fire)push({type:'extinguish',slot});
    if(s.v08&&expert){
      if(s.julian.age>=3&&kind!=='hider')push({type:'registry'});
      if(s.opened.map){
        for(const id of ['berg','licht']){const t=s.territories[id];if(t.favor<85&&s.res.gold>100)push({type:'gift',neighbor:id});}
        if(!s.territories.licht.visited&&!s.folk.some(f=>f.away==='envoy')&&!s.raid&&(Sim.forecast(s)?.days||99)>6)push({type:'envoy',neighbor:'licht',id:'johanna'});
        if(kind!=='hider'){
          if(s.julian.abroad?.kind==='study'&&s.julian.abilities.learning>=15&&s.territories.licht.flag!=='north')push({type:'returnStudy'});
          for(const id of ['berg','licht'])if(!s.territories[id].shown&&(kind==='revealer'||s.territories[id].favor>=80&&s.sus<40&&(id==='berg'||s.reputation>=20)))push({type:'showJulian',neighbor:id});
          if(kind==='revealer'||s.territories.licht.favor>=85&&s.reputation>=20&&s.sus<30)push({type:'study'});
        }
      }
      if(s.julian.kidnapped){const a=s.folk.filter(f=>f.status==='가신'&&!f.away&&!f.collapsed).sort((a,b)=>b.str-a.str);if(a.length>=2)push({type:'rescue',ids:a.slice(0,2).map(f=>f.id)});}
    }
    return actions;
  }

  return policy;
});
