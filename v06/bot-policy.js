(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./data'),require('./sim-core'));else root.KeepPolicy=factory(root.KEEP,root.KeepSim);})(typeof window==='undefined'?globalThis:window,(K,Sim)=>{
  // 정책은 공개된 정보만 보고 명령 목록을 낸다. 생존 보정/시드별 분기는 없다.
  function policy(state,kind='average'){
    let s=state;const actions=[];
    const push=a=>{if(Sim.validate(s,a))return false;actions.push(a);s=Sim.act(s,a).state;return true;};
    if(kind==='idle'){
      if(s.pending){const e=Sim.eventFor(s,s.pending);push({type:'choice',index:e.choices.length-1});}return actions;
    }
    const expert=kind==='expert';
    if(s.pending){const e=Sim.eventFor(s,s.pending);let index=e.kind==='registry'?1:0;if(e.kind==='merchant')index=s.res.food<45?0:s.res.wood<65?1:2;if(Sim.validate(s,{type:'choice',index}))index=e.choices.length-1;push({type:'choice',index});}
    if(s.queue.length){push({type:'openRequest',id:s.queue[0].id});push({type:'choice',index:0});}
    if(s.gateHP<Sim.gateMax(s)*(expert?.95:.45))push({type:'repair'});
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
    if(s.day>25)upgrade('gate',expert?3:2);
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
  return policy;
});
