(() => {
  'use strict';
  const K=window.KEEP,R=K.rooms,Sim=window.KeepSim,DAY_MS=K.dayMs,$=id=>document.getElementById(id),world=$('world'),stage=$('castle-stage');
  const STAT={str:'힘',dex:'손재주',heart:'마음',wis:'지혜'},BODY={str:'#cb844c',dex:'#c5ab47',heart:'#80ad70'},NAMES={food:'식량',wood:'장작',gold:'금화',sus:'의심',health:'건강',bond:'애착',satisfaction:'만족도',xp:'명성'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=x=>JSON.parse(JSON.stringify(x)),best=f=>['str','dex','heart'].sort((a,b)=>f[b]-f[a])[0],sum=(a,k)=>a.reduce((n,f)=>n+f[k],0);
  let G=Sim.create(1),speed=1,previousSpeed=1,resumeSpeed=0,autoResume=false,dangerKey='',geo=null,acc=0,raidAcc=0,showing=false,dialogKind='',lastFocus=null,audio=null,lullTimers=[],tutorial=4,view='home',roomSelection=null,filter='all',auto=false,feedbackTimer,autoAccumulator=0,regionNeighbor='rosental',lastRes={...G.res},geometryKey='',uiActions=0,partySelection=new Set();
  const camera={x:0,y:0,zoom:1,ready:false},growth={level:0,elapsed:1000,from:null,to:null};
  const figs=new Map(),slots=()=>Object.keys(G.rooms),typeOf=id=>G.rooms[id]?.type,slotOf=type=>Sim.slotOf(G,type),at=id=>G.folk.filter(f=>f.room===id&&!f.away),working=id=>Sim.workers(G,id),rateOf=id=>Sim.rate(G,id),popCap=()=>Sim.popCap(G);
  const fmt=n=>(n>=0?'+':'−')+Math.abs(n).toFixed(1),costText=c=>Object.entries(c).map(([k,v])=>`${NAMES[k]} −${v}`).join(' · ')||'비용 없음';
  const chip=(name,n)=>`<span class="chip ${n<0?'negative':'positive'}">${esc(name)} ${n<0?'−':'+'}${Math.abs(n)}</span>`;
  const effectsHTML=c=>Object.entries(c.cost||{}).map(([k,v])=>chip(NAMES[k],-v)).join('')+Object.entries(c.fx||{}).filter(([,v])=>v).map(([k,v])=>chip(NAMES[k],v)).join('');
  const button=(label,a,sub='')=>{const error=Sim.validate(G,a);return `<button class="opt" aria-label="${esc(label)}" data-action="${esc(JSON.stringify(a))}" ${error?'disabled':''} title="${esc(error||sub)}"><b>${esc(label)}</b>${sub?`<span>${esc(sub)}</span>`:''}${error?`<small>${esc(error)}</small>`:''}</button>`;};
  const actionHTML=(label,a,html)=>{const error=Sim.validate(G,a);return `<button class="opt" data-action="${esc(JSON.stringify(a))}" aria-label="${esc(label)}" ${error?'disabled':''}><b>${esc(label)}</b><span>${html}</span>${error?`<small>${esc(error)}</small>`:''}</button>`;};
  const meter=(label,n,max=100,kind='')=>`<div class="meter ${kind}"><label><span>${label}</span><b>${Math.round(n)}${max===100?'':'/'+Math.round(max)}</b></label><div class="t"><i style="width:${Math.max(0,Math.min(100,n/max*100))}%"></i></div></div>`;
  const portrait=f=>f?.img?`<img src="${f.img}" alt="${esc(f.name)}">`:`<span class="portrait" role="img" aria-label="${esc(f?.name||'방문자')} 초상"></span>`;
  const stats=f=>Object.entries(STAT).map(([k,n])=>`<div class="statline ${k}"><span>${n}${best(f)===k?' ★':''}</span><div class="track"><i style="width:${f[k]*10}%"></i></div><b>${f[k]}</b></div>`).join('');
  const closeButton=()=>'<button class="btn dialog-close" data-close>성으로 돌아가기 · Esc</button>';
  function feedback(t){$('feedback').textContent=t;clearTimeout(feedbackTimer);feedbackTimer=setTimeout(()=>$('feedback').textContent='',4200);}
  function slow(){if(speed>1){previousSpeed=speed;speed=1;resumeSpeed=0;}}
  function finishSituation(){if(!G.pending&&!G.raid&&!Sim.risks(G).length&&previousSpeed>1){resumeSpeed=previousSpeed;if(autoResume&&speed!==0){speed=previousSpeed;resumeSpeed=0;}}}
  function closeDialog(){lullTimers.forEach(clearTimeout);lullTimers=[];$('modal').innerHTML='';showing=false;dialogKind='';$('game').inert=false;lastFocus?.focus?.({preventScroll:true});finishSituation();}
  function sheet(title,body,kind='notice',img=''){
    if(!showing)lastFocus=document.activeElement;
    showing=true;dialogKind=kind;if(['event','failure'].includes(kind)||kind==='notice')slow();$('game').inert=true;
    $('modal').innerHTML=`<div class="modal ${kind==='failure'?'failure':''}"><section class="sheet ${kind==='region'?'region':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="body">${kind==='failure'?'':`<h2>${esc(title)}</h2>`}${body}</div></section></div>`;
    $('modal').querySelector('button:not(:disabled),input')?.focus({preventScroll:true});
  }
  function dispatch(a){
    const old=clone(G),result=Sim.act(G,a);if(result.error){feedback(result.error);return false;}G=result.state;uiActions++;if(['scout','caravan','restart','retry'].includes(a.type))partySelection.clear();
    if(a.type==='assign'&&tutorial===0&&old.folk.find(f=>f.id===a.id)?.room!==a.slot)tutorial=1;
    if(a.type==='build'&&tutorial===1)tutorial=2;
    if(a.type==='choice'&&tutorial===2)tutorial=3;
    persist();if(['restart','retry'].includes(a.type)){view='home';roomSelection=null;tutorial=4;acc=0;raidAcc=0;G.sel=null;speed=1;previousSpeed=1;dangerKey='';}
    if(['assign','build','demolish'].includes(a.type))G.sel=null;
    if(a.type==='build'){roomSelection=a.slot;view='room';}
    if(a.type==='demolish'){view='home';roomSelection=null;const r=geo.rooms[a.slot];if(r){const d=document.createElement('div');d.className='dust';d.style.cssText=`left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;stage.append(d);setTimeout(()=>d.remove(),900);}}
    if(showing&&dialogKind!=='region')closeDialog();
    render();if(dialogKind==='region')regionSheet();pump();return true;
  }
  function selectFolk(id){G.sel=G.sel===id?null:id;view=G.sel?'folk':'home';roomSelection=null;render();}
  function assign(id,slot){if(dispatch({type:'assign',id,slot}))feedback(`${G.folk.find(f=>f.id===id)?.name} → ${R[typeOf(slot)]?.name||'숙소에서 휴식'}`);}
  function tapSlot(slot){if(!Sim.unlocked(G,slot)){feedback(`영지 Lv${+slot[1]}에 열립니다`);return;}if(slot===G.residence.slot){G.sel=null;roomSelection=slot;view='room';render();return;}if(G.sel){assign(G.sel,slot);return;}roomSelection=slot;view='room';render();}
  function header(title){return `<div class="panel-head"><b>${title}</b><button class="close-panel" data-view="home" aria-label="상세 닫기">×</button></div>`;}
  function craftPanel(){const id=slotOf('forge'),r=G.rooms[id];if(!r)return '<p>빈 터에 대장간을 지어 주세요.</p><button class="btn" data-view="build">건설 열기</button>';
    return `<h3>제작 대기열 ${G.crafts.length}/${r.level===3?2:1}</h3>${G.crafts.map(c=>meter(K.weapons.find(w=>w.id===c.weapon).name+` · ${c.remaining}일 남음`,c.total-c.remaining,c.total)).join('')||'<p class="hint">완성품은 가방으로 갑니다. 일꾼 부재·화재 때 제작이 멈춥니다.</p>'}${K.weapons.filter(w=>!w.scout).map(w=>button(`${w.name} 제작`,{type:'craft',weapon:w.id},`힘 +${w.power} · ${Sim.craftDays(G,w.id)}일 · ${costText(Sim.price(G,{type:'craft',weapon:w.id}))} · Lv${w.level}`)).join('')}`;
  }
  function roomPanel(){
    const slot=roomSelection,r=G.rooms[slot];if(!slot)return '';if(slot===G.residence.slot)return header('영주관')+'<p>엘레노어와 율리안의 거처입니다. 성 안쪽에 고정되어 일반 숙소와 분리됩니다.</p>';
    if(!r)return header('빈 터 · 건설')+`<p class="hint">${+slot[1]+1}층 ${+slot[3]-Sim.firstColumn(G)+1}번 · 같은 종류는 누적 건설마다 금화 +15</p>`+Object.entries(R).filter(([,r])=>!r.fixed).map(([key,def])=>button(`${def.name} 건설`,{type:'build',slot,room:key},`${costText(Sim.price(G,{type:'build',slot,room:key}))} · ${def.desc}`)).join('');
    const a={type:'upgrade',slot};return header(`${roomName(r.type)} · Lv${r.level}`)+`<p class="hint">${R[r.type].desc}</p><h3>일하는 사람 ${working(slot).length}/${Sim.capacity(G,slot)}</h3>${at(slot).map(f=>`<button class="queue-button" data-person="${f.id}">${f.name} · ${STAT[best(f)]} ${f[best(f)]} ★</button>`).join('')}<button class="btn" data-view="folk">사람 선택 → 이 방 클릭</button>${R[r.type].res?meter(`하루 생산 +${rateOf(slot).toFixed(1)}`,working(slot).length,Sim.capacity(G,slot)):''}${r.type==='forge'?'<p>아이에게는 위험한 방입니다. 제작은 다음 이야기에서 열립니다.</p>':''}${r.type==='nursery'?`<h3>율리안 돌보기</h3><button class="opt" id="lullaby"><b>율리안에게 자장가</b><span>세 음을 듣고 따라 부르기 · 건강 +4 · 애착 +8</span></button>${button('율리안 진찰',{type:'checkup'},'금화 −8 · 건강 +10 · 하루 한 번')}`:''}${r.type==='gate'?meter('성문 HP',G.gateHP,Sim.gateMax(G),'health')+button('성문 수리',{type:'repair'},'장작 −12 · 금화 −8 · 3일')+button(`성벽 Lv${G.wallLevel+1} 강화`,{type:'wall'},costText(Sim.price(G,{type:'wall'}))):''}${r.type==='dorm'?`<h3>숙소 정원과 밤 회복</h3><p>${lodgingText()}</p><p class="hint">배치된 방에서 잠들며, 대기자만 숙소에서 쉽니다. 숙소 정원은 모든 숙소의 칸 × 레벨 × 4 합계입니다.</p>`:''}<h3>건물 관리</h3>${button('업그레이드',a,`${costText(Sim.price(G,a))} · Lv${Math.min(3,r.level+1)}`)}${r.fire?button('불 끄기',{type:'extinguish',slot},'장작 −4'):''}${R[r.type].res?button('생산 재촉',{type:'rush',slot},'하루치 즉시 생산 · 실패 시 화재'):''}${!R[r.type].fixed?`<button class="opt" data-demolish="${slot}" ${Sim.validate(G,{type:'demolish',slot})?'disabled':''}><b>철거</b><span>${Sim.validate(G,{type:'demolish',slot})||`기본비 20% · 환급 금화 +${Math.floor(R[r.type].cost*.2)*r.size}`}</span></button>`:''}`;
  }
  function folkPanel(){const f=G.folk.find(f=>f.id===G.sel);if(!f)return header('영지민')+'<p>왼쪽 명부에서 사람을 선택하세요. 선택한 다음 지도 방을 누르면 배치됩니다.</p>';
    return header('영지민 상세')+`<div class="portrait-line">${portrait(f)}<div><b>${f.name}</b><small>${f.role} · Lv${f.level}<br>${roomName(typeOf(f.room))||'안뜰 대기'}</small></div></div>${meter('체력',f.hp,Sim.maxHP(f),'health')}${stats(f)}${meter('만족도',f.satisfaction)}<p class="hint">생산 ×${Sim.satisfactionMult(f.satisfaction).toFixed(2)} · ${f.satisfaction<40?'태업 생산 −30%':'40 미만이면 태업'}</p>${f.reasons.slice(-4).reverse().map(r=>`<div class="hint">${r.text} <span class="${r.value<0?'dn':'up'}">${fmt(r.value)}</span></div>`).join('')}<h3>특장점</h3><p>${K.traits[f.trait].name} · ${K.traits[f.trait].desc}</p><p>지위: ${f.status}</p>${f.status!=='가신'?button('가신으로 임명',{type:'promote',id:f.id},'금화 40 · 가신 최대 6명'):''}${button('안뜰에서 대기하기',{type:'assign',id:f.id,slot:null})}<h3>발자취</h3><p class="hint">${f.history.slice(-3).map(h=>`${h.day}일 ${R[typeOf(h.room)]?.name||'휴식'}`).join(' → ')}</p>`;
  }
  function party(max){return `<p class="hint">파견 인원 1~${max}명 · 돌봄·생산·수비에서 빠집니다.</p>${G.folk.map(f=>`<label class="checkfolk"><input type="checkbox" name="party" value="${f.id}" ${partySelection.has(f.id)&&!f.away&&!f.hurt?'checked':''} ${f.away||f.hurt?'disabled':''}>${f.name} <small>힘 ${f.str} · 마음 ${f.heart}${f.away?' · 파견 중':f.hurt?' · 부상':''}</small></label>`).join('')}`;}
  function bagPanel(){const recipient=G.folk.find(f=>f.id===G.sel)||G.folk[0];return header('가방 · 행상')+`<label>장착할 사람 <select id="equip-person" aria-label="장착할 사람">${G.folk.map(f=>`<option value="${f.id}" ${f.id===recipient?.id?'selected':''}>${f.name}</option>`).join('')}</select></label>${G.inventory.length?'':'<p class="hint">아직 가방이 비었습니다. 대장간에서 제작하거나 행상에게 구매하세요.</p>'}${[...new Set(G.inventory)].map(id=>{const w=K.weapons.find(w=>w.id===id);return `<h3>${w?.name||K.items[id].name} ×${G.inventory.filter(x=>x===id).length}</h3>`+(w?button('장착: '+w.name,{type:'equip',id:recipient.id,weapon:id},`${recipient.name} · 힘 +${w.power}`):button('사용: '+K.items[id].name,{type:'use_item',item:id},Object.entries(K.items[id].fx).map(([k,v])=>`${NAMES[k]} +${v}`).join(' · ')))+button('판매: '+(w?.name||K.items[id].name),{type:'sell',item:id},`금화 +${Sim.tradePrice(G,id)}`);}).join('')}${recipient?.weapon?button('무기 해제',{type:'equip',id:recipient.id,weapon:null},recipient.name):''}<h3>방문 행상 ${Sim.merchantHere(G)?'· 거래 가능':'· 부재'}</h3>${['herb','blanket','knife','spear'].map(id=>button('구매: '+(K.items[id]?.name||K.weapons.find(w=>w.id===id).name),{type:'buy',item:id},`금화 −${Sim.tradePrice(G,id,true)}`)).join('')}<h3>수도 행상</h3>${party(2)}<p class="hint">4~6일 부재 · 위험 20% (수익 40% 손실·피해)</p>${[['food','식량 20','금화 32'],['wood','장작 25','금화 38'],...G.inventory.filter(id=>K.weapons.some(w=>w.id===id)).map(id=>[id,K.weapons.find(w=>w.id===id).name,`금화 ${Sim.tradePrice(G,id)+20}`])].map(([id,cost,reward])=>`<button class="opt" data-caravan="${id}"><b>수도에 ${cost} 보내기</b><span>출발 비용 ${cost} · 기대 보상 ${reward}</span></button>`).join('')}`;}
  function scoutPanel(){const ids=selectedParty();return header('정찰 파견')+party(3)+K.scouts.map(d=>`<button class="opt" data-destination="${d.id}"><b>${d.name} · ${d.days}일</b><span>출발 비용: 식량 −${d.days*2}<br>기대 보상: 식량 +${d.food} · 금화 +${d.gold}<br>무기 65% · 영지민 후보 45%<br>부상 위험: 기본 ${Math.round(d.risk*100)}% · 선택 인원 보정 <span data-risk="${d.id}">${Math.round((ids.length?Sim.scoutRisk(G,d,ids):d.risk)*100)}</span>%</span></button>`).join('')+G.candidates.map(id=>{const f=Sim.visitor(G,id);return button(f.name+' 영입',{type:'recruit',id},`힘 ${f.str} · 손재주 ${f.dex} · 마음 ${f.heart} · ${f.traitName}`);}).join('');}
  function recordsPanel(){return header('성에 남은 기록')+`<p>플레이 ${Math.floor(G.telemetry.playMs/60000)}분 · 실패 ${G.telemetry.failures}회 · 복구 ${G.telemetry.recoveries}회</p>`+`<h3>율리안의 성장</h3>${G.julian.timeline.map(r=>`<p>${r.day}일 · ${r.title}</p>`).join('')}<h3>묘지</h3><p>${G.graveyard.map(f=>`${f.name} · ${f.day}일`).join('<br>')||'아직 떠나보낸 사람이 없습니다.'}</p><h3>영지 기록</h3>${G.log.map(t=>`<p class="hint">${esc(t)}</p>`).join('')}`;}
  function homePanel(){return header('성의 하루')+`<p>사람을 선택한 뒤 방을 누르면 배치됩니다. 새로 받은 사람은 안뜰에서 기다립니다.</p><p>${unlockText()}</p>${G.queue.map(q=>button(Sim.eventFor(G,q.id).title,{type:'openRequest',id:q.id})).join('')}${button('성문 수리',{type:'repair'},'장작 12 · 금화 8 · 3일')}`;}
  function legacyHomePanel(){const next=Sim.forecast(G),upcoming=[...K.events,...[24,54,78,114].map(day=>({day,title:'레오폴트 방문'})),...K.raids.map(r=>({...r,title:r.name}))].filter(e=>e.day>G.day).sort((a,b)=>a.day-b.day).slice(0,5);
    return `${G.raid?`<div class="battle"><h3>${G.raid.name} · ${G.raid.round} 라운드</h3>${meter('성문 HP',G.gateHP,Sim.gateMax(G),'health')}${meter('습격대 HP',G.raid.hp,G.raid.max,'danger')}<p class="hint">현재 ${R[typeOf(G.raid.path[G.raid.idx])].name} · 배속 잠김 1×</p></div><h3>라운드 기록</h3><div class="battle-log">${G.raid.history.slice(0,7).join('<br>')}</div><h3>성문이 뚫리면</h3><p class="hint">${G.raid.path.map(id=>R[typeOf(id)].name).join(' → ')}</p>`:`<h3>다가오는 일</h3>${upcoming.map(e=>`<div class="event-row"><span class="badge">D-${e.day-G.day}</span>${esc(e.title)}</div>`).join('')}`}
    <h3>알림 큐 <small>${G.queue.length}건</small></h3>${G.queue.map(q=>{const e=Sim.eventFor(G,q.id);return button(`${e.bearer.name} · ${e.title}`,{type:'openRequest',id:q.id},`기한 ${q.until-G.day}일 · ${e.text}`);}).join('')||'<p class="hint">급하지 않은 부탁은 여기서 확인합니다.</p>'}<hr><label class="hint"><input type="checkbox" id="auto-resume" ${autoResume?'checked':''}> 상황 종료 후 배속 자동 복귀</label><p class="hint">일반 패널을 열어도 시간은 흐릅니다. 사건·변경 지도에서는 멈춥니다.</p>${next&&next.days<=3?button('성문 수리',{type:'repair'},'3일 · 장작 −12 · 금화 −8'):''}`;
  }
  function renderPanel(){return panelP1();}
  function legacyRenderPanel(){
    const task=G.raid?'성문을 지키세요. 사람 선택 → 방 클릭으로 수비 교대':G.sel?`${G.folk.find(f=>f.id===G.sel)?.name} 선택 중 → 빛나는 방을 클릭하세요`:!working(slotOf('nursery')).length?'요람실이 비었습니다 → 마음 높은 사람을 배치하세요':Sim.daily(G).food<0?'식량이 줄고 있습니다 → 주방에 사람을 배치하세요':G.gateHP<Sim.gateMax(G)*.6?'성문이 약해졌습니다 → 성문을 눌러 수리하세요':G.day<38&&!G.julian.registry?'여름 감찰을 준비하세요 → 요람실에서 호적을 정할 수 있습니다':G.crafts.length?'제작이 진행 중입니다 → 완성품은 가방에서 장착하세요':'빈 터를 눌러 성을 넓히고, 다가오는 일을 확인하세요';
    $('next-task').textContent='지금 할 일 · '+task;
    let html=view==='room'?roomPanel():view==='folk'?folkPanel():view==='bag'?bagPanel():view==='scout'?scoutPanel():view==='records'?recordsPanel():view==='forge'?header('대장간')+craftPanel():homePanel();
    if(view==='build')html=header('건설할 빈 터 선택')+'<p>지도에서 ＋ 빈 터를 누르세요.</p>'+Object.keys(G.rooms).filter(id=>G.rooms[id]===null&&Sim.unlocked(G,id)).map(id=>`<button class="queue-button" data-slot="${id}">${+id[1]+1}층 ${+id[3]-Sim.firstColumn(G)+1}번 빈 터</button>`).join('');
    $('panel').className='panel';$('panel').innerHTML=html;$('lullaby')?.addEventListener('click',lullaby);
    $('selection').textContent=G.sel?`${G.folk.find(f=>f.id===G.sel)?.name} 선택됨 · 빛나는 방 클릭 = 배치 · Esc 취소`:view==='build'?'＋ 빈 터를 클릭해 건설하세요':'';
  }
  function lodgingText(){const l=Sim.lodging(G);return `정원 ${l.population}/${l.capacity} · 밤 회복 ${Math.round(l.ratio*100)}%`;}
  function renderLeft(){return leftP1();}
  function legacyRenderLeft(){
    if(view==='folk'){
      $('leftcard').innerHTML=`<div><h3>영지민 명부 ${G.folk.length}/${popCap()}</h3><div class="filters">${[['all','전체'],['work','일함'],['rest','휴식'],['away','파견'],['hurt','부상']].map(([id,n])=>`<button data-filter="${id}" aria-pressed="${filter===id}">${n}</button>`).join('')}</div><div id="roster" class="roster-grid">${G.folk.filter(f=>filter==='all'||filter==='work'&&f.room&&!f.away&&!f.hurt||filter==='rest'&&!f.room&&!f.away&&!f.hurt||filter==='away'&&f.away||filter==='hurt'&&f.hurt).map(f=>`<button class="person ${G.sel===f.id?'selected':''}" data-person="${f.id}" aria-label="${f.name} 선택">${portrait(f)}<b>${f.name}</b><small>${f.away?'파견 중':f.hurt?'부상 '+f.hurt+'일':R[typeOf(f.room)]?.name||'휴식'}</small></button>`).join('')}</div><p class="hint">사람 선택 → 지도 방 클릭<br>주황 힘 · 노랑 손재주 · 초록 마음</p></div>`;return;
    }
    const j=G.julian,next=Sim.forecast(G),avg=Sim.averageSatisfaction(G),d=Sim.daily(G);
    $('leftcard').innerHTML=`<div id="crib"><div class="portrait-line"><img src="media/julian.webp" alt="율리안"><div><b>율리안</b><small>${Sim.growth(G)} · ${Math.min(12,G.day/10).toFixed(1)}개월<br>호적: ${K.registries[j.registry]?.name||'아직 미정'}</small></div></div><div class="growth-figure" title="갓난아기 → 뒤집기 → 기어가기 → 붙잡고 서기 → 첫걸음">${K.growth.map((_,i)=>`<i class="${i<=j.growth?'done':''}"></i>`).join('')}</div>${meter('건강',j.health,100,'health')}${meter('애착',j.bond,100,'bond')}</div><div id="crisis"><h3>위기</h3>${meter(`황후궁 의심 <small class="${d.sus>0?'dn':'up'}">${fmt(d.sus)}/일</small>`,G.sus,100,'danger')}${meter('성문 HP',G.gateHP,Sim.gateMax(G),'health')}${next?`<div class="raid-warning ${next.power>next.defense?'danger':''}">다음 습격 D-${next.days} · 예상 ${Math.round(next.power)} vs 방어 ${Math.round(next.defense)}<br>${next.power>next.defense?'성문·무기·수비 인원을 준비하세요':'방어 준비 양호 · 성문 HP도 확인하세요'}</div>`:'<small>올해의 습격을 모두 넘겼습니다.</small>'}</div><div id="satisfaction" class="tooltip" tabindex="0">${meter('영지민 만족도 평균',avg)}<small>생산 ×${Sim.satisfactionMult(avg).toFixed(2)} · 세금 ${Math.round(avg)}%</small><span class="tip">만족도 — 어디에 쓰이나\n생산 ×0.8~1.2\n40 미만: 태업, 생산 추가 −30%\n20 미만: 계절 말 일반 주민 이탈\n세금: 평균 만족도 비례\n\n배치 적성 +0.2/일\n${lodgingText()}\n숙소 휴식 +0.3~0.8/일 × 밤 회복 비율\n식량 부족·추위 −3/일\n사건 선택 ± · 사망 −12\n개별 원인은 영지민 상세에서 확인</span></div><div id="objectives"><h3>${K.seasons[Sim.season(G)]} 목표</h3>${Sim.objectives(G).map((g,i)=>`<div class="goal"><span>${g.done?'☑':'□'} ${g.text}</span><small>명성 +${5+i*3}</small></div>`).join('')}</div>`;
  }
  function renderHud(){return hudP1();}
  function legacyRenderHud(){
    const d=Sim.daily(G),season=Sim.season(G),day=Math.min(G.day%30+1,30);
    $('hud-care').innerHTML=`<span title="율리안 건강">건강 ${Math.round(G.julian.health)}<i style="width:${G.julian.health}%"></i></span><span title="율리안 애착">애착 ${Math.round(G.julian.bond)}<i style="width:${G.julian.bond}%"></i></span>`;
    $('estate').textContent=`영지 Lv${G.level} · 명성 ${G.xp}/${K.balance.levelXP[G.level]||'MAX'}`;$('xp').style.width=(G.level===5?100:G.xp/K.balance.levelXP[G.level]*100)+'%';
    $('date').textContent=`${['❀','☀','❧','❄'][season]} ${K.seasons[season]} ${G.day===120?30:day}/30일 · ${G.year}년차`;
    $('calendar').innerHTML=Array.from({length:30},(_,i)=>{const n=season*30+i,raid=K.raids.find(r=>r.day===n),e=K.events.find(e=>e.day===n);return `<i class="${i<day?'elapsed':''} ${raid?'raid':e?'event':''}" title="${i+1}일${raid?' · '+raid.name:e?' · '+e.title:''}"></i>`;}).join('');
    $('res').innerHTML=['food','wood','gold'].map((key,i)=>`<div class="pill" title="${NAMES[key]} · 하루 ${fmt(d[key])}"><span aria-hidden="true">${['●','▰','◉'][i]}</span><b data-value="${key}">${Math.floor(G.res[key])}</b><span class="${d[key]<0?'dn':'up'}">${NAMES[key]} ${fmt(d[key])}/일</span></div>`).join('')+`<div class="pill"><span>♟</span><b>${G.folk.length}/${popCap()}</b><span>인구 / 정원</span></div><div class="pill"><span>▣</span><b>${Math.floor(Math.max(G.res.food,G.res.wood))}</b><span>창고 / ${Sim.storageCap(G)}</span></div>`;
    for(const key of ['food','wood','gold']){const delta=G.res[key]-lastRes[key];if(Math.abs(delta)>.05){const span=document.createElement('i');span.className='float-number '+(delta<0?'dn':'up');span.textContent=fmt(delta);$('res').querySelector(`[data-value="${key}"]`).parentElement.append(span);}}lastRes={...G.res};
    const risks=Sim.risks(G);$('banner').innerHTML=(G.raid?`<div class="battle map-battle"><b>${G.raid.name} · ${G.raid.round} 라운드 · ${R[typeOf(G.raid.path[G.raid.idx])].name}</b><div>${meter('성문 HP',G.gateHP,Sim.gateMax(G),'health')}${meter('습격대 HP',G.raid.hp,G.raid.max,'danger')}</div><small>${esc(G.raid.history[0]||'성문에 도착했습니다.')}</small></div>`:'')+risks.map(r=>`<button class="banner" data-focus-slot="${r.slot}">${esc(r.text)}</button>`).join('');
    const key=risks.map(r=>r.slot+r.text.split(' · ')[0]).join('|')+(G.raid?'raid':'');if(key&&key!==dangerKey)slow();dangerKey=key;
    $('speed').innerHTML=[[0,'Ⅱ'],[1,'1×'],[2,'2×'],[4,'4×']].map(([n,t])=>`<button data-sp="${n}" aria-label="${n?'속도 '+n+'배':'일시정지'}" aria-pressed="${speed===n}" class="${speed===n?'on':''} ${resumeSpeed===n?'resume':''}">${t}</button>`).join('');
    $('progress').innerHTML=G.crafts.map(c=>`<span class="progress-chip">제작 · ${K.weapons.find(w=>w.id===c.weapon).name} ${c.remaining}일</span>`).join('')+G.expeditions.map(e=>`<span class="progress-chip">${e.kind==='caravan'?'수도 행상':e.kind==='envoy'?'사절':'정찰'} D-${e.returnAt-G.elapsedDays}</span>`).join('')+(G.repair?`<span class="progress-chip">성문 수리 ${G.repair.remaining}일</span>`:'');
    document.querySelectorAll('.toolbar button').forEach(b=>b.classList.toggle('active',b.id===view));
    const palettes=[['#a7c6b1','#506a43','#99be66'],['#78b2b4','#234a32','#285d34'],['#bdaa82','#6b4936','#b16d32'],['#7e98a9','#b7c9c9','#6d9295']];['--sky','--earth','--trees'].forEach((k,i)=>world.style.setProperty(k,palettes[season][i]));world.dataset.season=season;world.classList.toggle('under-raid',!!G.raid);world.classList.toggle('burned',!!G.metrics.burned);
  }
  const lessons=['엘레노어를 선택하고 주방을 눌러 배치해 보세요. 아래 영지민(F)을 열거나 지도 위 사람을 누릅니다.','지도 ＋ 빈 터를 눌러 숙소나 대장간을 지으세요. 금화와 역할은 버튼 안에 있습니다.','봄 4일에 첫 사건이 옵니다. 시간이 흐르는 동안 요람실을 살펴보세요. 사건에서 선택지를 누르세요.','상단 2×를 눌러 시간을 진행하세요. Space는 멈춤, 1·2·3은 배속입니다.'];
  function renderTutorial(){$('tutorial').innerHTML=tutorial<4?`<div class="tutorial"><b>하인츠의 안내 ${tutorial+1}/4</b><p>${lessons[tutorial]}</p><button class="btn" id="tutorial-skip">안내 건너뛰기</button></div>`:'';}
  function render(){const key=JSON.stringify([G.rooms,G.level,G.folk.length,world.clientWidth,world.clientHeight]);if(key!==geometryKey){geometryKey=key;buildCastle();}renderLeft();renderHud();renderPanel();renderTutorial();syncRooms();animate(0);}
  function setSpeed(n){if(![0,1,2,4].includes(n))return speed;if(G.raid&&n>1){feedback('습격 중에는 1×로 공방을 지켜봅니다. 일시정지는 가능합니다.');return speed;}speed=n;if(n)previousSpeed=n;resumeSpeed=0;if(tutorial===3&&n>0)tutorial=4;renderHud();renderTutorial();return speed;}
  function registrySheet(){sheet('율리안의 호적',`<p>감찰과 애착, 1세 능력치의 씨앗을 정합니다.</p>${Object.entries(K.registries).map(([registry,r])=>button(r.name,{type:'registry',registry},`${r.desc} · ${costText(Sim.price(G,{type:'registry'}))}${G.julian.registry?' · 의심 +15':''}`)).join('')}${closeButton()}`,'manage');}
  function regionSheet(){const id=regionNeighbor,n=K.neighbors[id];sheet('변경 지도',`<p class="pause-note">시간 정지 중 · 주변 영지 / 레헨스부르크</p><div class="region-grid"><div class="region-map"><b class="capital-point">♜ 그렌바흐</b>${Object.entries(K.neighbors).map(([id,n])=>`<button data-neighbor="${id}" class="${regionNeighbor===id?'active':''}" aria-label="${n.name} 선택">${Math.round(G.neighbors[id])}<br>${n.name}</button>`).join('')}</div><div><section class="region-detail"><h3>${n.name}</h3><p class="hint">${n.direction} · ${G.neighbors[id]>=70?'동맹':'중립'}</p>${meter('호감 / 동맹 70',G.neighbors[id])}<p>${n.benefit}</p>${button('식량 선물',{type:'gift',neighbor:id,gift:'food'},'식량 −15 · 호감 +10')}${button('금화 선물',{type:'gift',neighbor:id,gift:'gold'},'금화 −15 · 호감 +12')}${G.inventory.filter(w=>K.weapons.some(x=>x.id===w)).map(w=>button('무기 선물: '+K.weapons.find(x=>x.id===w).name,{type:'gift',neighbor:id,gift:'weapon',weapon:w},`무기 −1 · 호감 +${10+K.weapons.find(x=>x.id===w).power}`)).join('')}<label>사절 <select id="envoy-person" aria-label="보낼 사절">${G.folk.filter(f=>!f.hurt&&!f.away).map(f=>`<option value="${f.id}">${f.name} · 마음 ${f.heart}</option>`).join('')}</select></label><button class="opt" data-envoy="${id}"><b>사절 보내기</b><span>식량 −6 · 3일 부재 · 귀환 대화 호감 +5~25</span></button>${G.expeditions.filter(e=>e.kind==='envoy').map(e=>`<p class="hint">${K.neighbors[e.neighbor].name} 사절 이동 중 D-${e.returnAt-G.elapsedDays}</p>`).join('')}</section><section class="region-detail"><h3>레헨스부르크 소식 · ${K.seasons[Sim.season(G)]}</h3><div>황제파 ${G.capital.emperor}% / 황후파 ${G.capital.empress}%</div><div class="partybar"><i style="width:${G.capital.emperor}%"></i></div>${G.capital.rumors.map(r=>`<p class="hint">· ${r}</p>`).join('')}${chip('무기 판매가',Math.round((G.capital.weaponSale-1)*100))}${chip('의심/일',G.capital.suspicion)}</section></div></div>${closeButton()}`,'region');}
  function eventSheet(e){const f=e.bearer,v=e.kind==='refugee'?Sim.visitor(G):null;
    const bio=v?`${stats(v)}<p>${v.age}세 · ${v.origin} 출신 · Lv1</p><p>“${v.story}”</p><p>${v.traitName} · ${v.traitDesc}</p><p class="hint">응접실 마음 7 이상 → 숨은 특장점 공개 ${v.reveal?'가능':'불가'}<br>받는 조건: 식량 8 · 숙소 1칸 (${G.folk.length}/${popCap()})</p>`:f?.age?`<p>${f.age}세 · ${f.origin}</p>${stats(f)}`:'';
    sheet(e.title,`<div class="portrait-line">${portrait(v||f)}<div><b>${esc(f.name)}</b><small>${esc(f.role)}${G.folk.find(p=>p.id===f.id)?' · 만족도 '+Math.round(G.folk.find(p=>p.id===f.id).satisfaction):''}</small></div></div>${bio}<p>${esc(e.text)}</p>${e.choices.map((c,index)=>actionHTML(`${['Q','W','E','R'][index]} · ${c.label}`,{type:'choice',index},effectsHTML(c)+(c.registry?`<small>${K.registries[c.registry].desc}</small>`:'')+(c.recruit?chip('영지민',1):'')+(c.neighbor?chip('호감',c.favor):''))).join('')}<p class="pause-note">일시정지 중 · 선택하면 계속됩니다. 이전 배속은 상황 종료 후 반짝입니다.</p>`,'event');
  }
  function pump(){if(showing)return;
    if(G.status==='complete'&&!G.notices.length){resultP1();return;}
    if(G.status==='gameOver'){auto=false;sheet('율리안을 빼앗겼다',`<div class="candle-scene"><div class="candle"></div><div class="empty-cradle"></div></div><div><small>${G.year}년차 · ${K.seasons[Sim.season(G)]} ${G.day%30+1}일</small><h2>율리안을 빼앗겼다</h2><p>성에 남은 것은 빈 요람과 작은 불빛입니다.</p><hr><h3>무엇이 무너졌나</h3>${G.failureAnalysis.map(t=>`<p class="hint">${esc(t)}</p>`).join('')}${button('이번 계절 첫날로 되돌리기',{type:'retry'},`${K.seasons[Math.floor(G.checkpoint.day/30)]} 1일 · 이번 계절 진행은 사라집니다`)}${button('처음부터',{type:'restart'})}</div>`,'failure');return;}
    if(G.pending){eventSheet(Sim.eventFor(G,G.pending));return;}
    const n=G.notices[0];if(n){let title=n.title||'영지 소식',body=n.text||'',img='';if(n.kind==='cutscene'){const c=K.cutscenes[n.id];title=c.title;body=c.lines.join('\n');img=c.img;}if(n.kind==='level'){title=`영지 Lv${n.level}`;body=`${n.level+1}층 개방 · 지붕과 탑, 마을이 늘어났습니다. 확장 보상 금화 +${30+n.level*10}`;}if(n.kind==='season'){title=`${K.seasons[n.season]}이 왔습니다`;body=K.objectives[n.season].map(x=>'□ '+x).join('\n')+'\n\n수도 소식: '+G.capital.rumors.join('\n');}if(n.kind==='scout'){title='정찰대 귀환';body=n.destination+' · 가방과 영지민 후보를 확인하세요.';}sheet(title,`${img?`<div class="portrait-line"><img src="${img}" alt=""></div>`:''}<p>${esc(body)}</p>${button('계속',{type:'ack'})}`,'notice');return;}
    if(G.status==='yearEnd'){auto=false;const r=G.yearReports.at(-1);sheet('1년 연말 결산',`<div class="portrait-line"><img src="media/julian.webp" alt="첫돌의 율리안"><div><b>율리안의 첫걸음</b><small>호적: ${K.registries[r.registry]?.name||'미정'}</small></div></div><p>건강 ${Math.round(r.health)} · 애착 ${Math.round(r.bond)}<br>1세 씨앗: 힘 ${r.seeds.str} · 손재주 ${r.seeds.dex} · 마음 ${r.seeds.heart}</p><p>함께 겨울을 넘은 사람 ${r.population.length}명<br>떠나보낸 사람 ${r.deaths.length}명 · 막아 낸 습격 ${r.raidsWon}회<br>만족도 비례 세금 +${r.tax} 금화</p><p>${r.population.map(f=>f.name+' Lv'+f.level).join(' · ')}</p><p>여기까지가 120일 프로토입니다.<br>성 안의 배치와 한 해의 선택으로 율리안을 지켜 냈습니다.</p>${button('처음부터',{type:'restart'})}`,'year');}
  }
  function advance(){G=Sim.step(G);persist();finishSituation();render();pump();}
  function selectedParty(){return [...document.querySelectorAll('input[name="party"]:checked')].map(i=>i.value);}
  document.addEventListener('click',e=>{
    const el=e.target.closest('button');if(!el||el.disabled)return;
    if(el.id==='copy-record'){copyRecord();return;}
    if(el.dataset.action){dispatch(JSON.parse(el.dataset.action));return;}
    if(el.hasAttribute('data-close')){closeDialog();render();pump();return;}
    if(el.dataset.sp!==undefined){setSpeed(+el.dataset.sp);return;}
    if(el.dataset.person){selectFolk(el.dataset.person);return;}
    if(el.dataset.slot){tapSlot(el.dataset.slot);return;}
    if(el.dataset.view){view=el.dataset.view;if(view==='home'){G.sel=null;roomSelection=null;}render();return;}
    if(el.dataset.filter){filter=el.dataset.filter;renderLeft();return;}
    if(el.dataset.focusSlot){G.sel=null;tapSlot(el.dataset.focusSlot);world.querySelector(`[data-s="${el.dataset.focusSlot}"]`)?.focus();return;}
    if(el.dataset.demolish){const slot=el.dataset.demolish,r=G.rooms[slot];sheet('철거 확인',`<p>${R[r.type].name} · 환급 금화 +${Math.floor(R[r.type].cost*.2)*r.size}<br>업그레이드 비용은 환급하지 않습니다. 되돌릴 수 없습니다.</p>${button('철거 실행',{type:'demolish',slot})}${closeButton()}`,'manage');return;}
    if(el.hasAttribute('data-registry')){registrySheet();return;}
    if(el.dataset.neighbor){regionNeighbor=el.dataset.neighbor;regionSheet();return;}
    if(el.dataset.envoy){dispatch({type:'envoy',neighbor:el.dataset.envoy,ids:[$('envoy-person').value]});return;}
    if(el.dataset.destination){dispatch({type:'scout',destination:el.dataset.destination,ids:selectedParty()});return;}
    if(el.dataset.caravan){const id=el.dataset.caravan;dispatch({type:'caravan',cargo:['food','wood'].includes(id)?id:'weapon',...(!['food','wood'].includes(id)?{weapon:id}:{}),ids:selectedParty()});return;}
    if(el.id==='tutorial-skip'){tutorial=4;renderTutorial();return;}
    if(el.id==='help'){sheet('하인츠의 안내',`<p>${lessons.join('\n\n')}</p><p>배경 드래그: 성 이동 · 휠: 세로 이동 · Shift+휠: 가로 이동 · Ctrl+휠 또는 +/−: 확대·축소 · Home: 성문으로.\n120일 · 1× 하루 15초. 사건과 지도는 시간을 멈춥니다.\n겨울에는 장작 소모가 큽니다. 성문 HP와 요람실을 지키세요.</p>${closeButton()}`,'manage');return;}
    if(el.id==='region'){regionSheet();return;}
    if(['build','folk','julian','records'].includes(el.id)){view=el.id;roomSelection=null;render();}
  });
  document.addEventListener('change',e=>{if(e.target.id==='auto-resume')autoResume=e.target.checked;if(e.target.id==='equip-person'){G.sel=e.target.value;renderPanel();}if(e.target.name==='party'){const ids=selectedParty();partySelection=new Set(ids);document.querySelectorAll('[data-risk]').forEach(el=>el.textContent=Math.round(Sim.scoutRisk(G,K.scouts.find(d=>d.id===el.dataset.risk),ids)*100));}});
  function cancel(){if(showing){if(['manage','region','lullaby'].includes(dialogKind))closeDialog();}else{G.sel=null;roomSelection=null;view='home';render();}}
  document.addEventListener('keydown',e=>{
    if(e.key==='Tab'&&showing){const a=[...$('modal').querySelectorAll('button:not(:disabled),input,select')],first=a[0],last=a.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.key==='Escape'){cancel();return;}if(showing){if(dialogKind==='event'){const i=['q','w','e','r'].indexOf(e.key.toLowerCase());if(i>=0){const el=$('modal').querySelectorAll('[data-action]')[i];el?.click();}}return;}
    if(e.key==='Home'){e.preventDefault();homeCamera();return;}
    if(e.code==='Space'){e.preventDefault();setSpeed(speed?0:previousSpeed||2);return;}
    if(['1','2','3'].includes(e.key)){setSpeed([1,2,4][+e.key-1]);return;}
    const id={b:'build',f:'folk',j:'julian',l:'records'}[e.key.toLowerCase()];if(id){e.preventDefault();$(id).click();}
  });
  world.addEventListener('contextmenu',e=>{e.preventDefault();cancel();});
  // 사람 모형: 몸 색 = 가장 높은 능력치
  function figHTML(f, kind) {
    const hair = f.hero ? '#2A2220' : f.id === 'ottilie' ? '#C9C6C0' : kind === 'raider' || f.raiderLook ? '#3A2B20' : '#6B4A30';
    const body = kind === 'raider' ? '#8E2F2A' : BODY[best(f)];
    return `<div class="hair" style="background:${hair}"></div><div class="h"></div><div class="b" style="background:${body}${f.hero ? ';box-shadow:inset 0 3px 0 #B9A889' : ''}"></div><div class="l a"></div><div class="l c"></div>${kind ? '' : `<div class="hpb"><i></i></div>`}<div class="nm">${esc(f.name)}</div>${kind?'':'<span class="sleep-mark" aria-hidden="true">z</span>'}`;
  }
  function areaOf(f) {
    const actual=f.id==='eleanor'&&acc/DAY_MS>.78?G.residence.slot:f.room;
    if (actual && geo.rooms[actual]) { const r = geo.rooms[actual]; return { x0: r.x + 16, x1: r.x + r.w - (typeOf(f.room) === 'nursery' ? 66 : 18), floor: r.y + r.h - 22 }; }
    const y = geo.yard; return { x0: y.x + 14, x1: y.x + y.w - 14, floor: y.y + y.h - 4 };
  }
  function ensureFig(id, f, kind) {
    let o = figs.get(id);
    if (!o) {
      const el = document.createElement('div'); el.className = 'fig' + (kind ? ' npc ' + kind : ''); el.innerHTML = figHTML(f, kind); stage.appendChild(el);
      const a = areaOf(f); o = { el, x: a.x0 + Math.random() * (a.x1 - a.x0), tx: null, wait: 0, room: f.room, kind };
      figs.set(id, o);
      if (!kind) { bindDrag(el, id); el.tabIndex=0; el.setAttribute('role','button'); el.setAttribute('aria-label',f.name+' 선택'); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFolk(id);}}); }
    }
    return o;
  }
  function animate(dt) {
    if (!G || !geo) return;
    const alive = new Set(), perRoom = {};
    const place=f=>(f.id==='eleanor'&&acc/DAY_MS>.78?G.residence.slot:f.room)||'yard';
    for (const f of G.folk) {
      if (f.away) continue;
      alive.add(f.id);
      // 같은 방 사람끼리 이름표가 겹치지 않게 짝수번째는 발밑, 홀수번째는 머리 위
      const nth = perRoom[place(f)] = (perRoom[place(f)] ?? -1) + 1;
      const o = ensureFig(f.id, f), a = areaOf(f);
      // 같은 높이 이름표에는 서로 떨어진 가로 구간을 배정한다.
      const count=G.folk.filter(p=>!p.away&&place(p)===place(f)).length;
      const areaWidth=a.x1-a.x0,lane=areaWidth/Math.max(1,count),center=a.x0+lane*(nth+.5);
      a.x0=center-Math.min(4,lane*.05);a.x1=center+Math.min(4,lane*.05);
      o.el.dataset.personId=f.id;o.el.dataset.room=place(f);
      o.el.classList.toggle('sleeping',acc/DAY_MS>.78);
      o.el.querySelector('.nm').style.maxWidth=Math.max(12,Math.min(areaWidth,2*lane-10))+'px';
      if (o.room !== f.room) { o.room = f.room; o.x = a.x0 + Math.random() * (a.x1 - a.x0); o.tx = null; }
      if (o.dragging) continue;
      const working = acc/DAY_MS<=.78 && f.room && !f.hurt && G.raid?.path[G.raid.idx] !== f.room;
      if(o.tx<a.x0||o.tx>a.x1)o.tx=null;
      if(acc/DAY_MS>.78){o.tx=null;o.wait=500;}
      if (o.wait > 0) o.wait -= dt;
      else if (o.tx == null) o.tx = a.x0 + Math.random() * (a.x1 - a.x0);
      else { const dx = o.tx - o.x, st = 0.03 * dt; if (Math.abs(dx) <= st) { o.x = o.tx; o.tx = null; o.wait = working ? 1400 + Math.random() * 2000 : 600 + Math.random() * 1600; } else o.x += Math.sign(dx) * st; }
      o.x = Math.max(a.x0, Math.min(a.x1, o.x));
      o.el.style.left = o.x + 'px'; o.y=o.y==null?a.floor-38:o.y+(a.floor-38-o.y)*Math.min(1,dt/100);o.el.style.top = o.y + 'px';
      o.el.classList.toggle('walk', o.tx != null && o.wait <= 0);
      o.el.classList.toggle('work', !!(working && o.tx == null));
      o.el.classList.toggle('hurt', !!f.hurt);
      o.el.classList.toggle('sel', G.sel === f.id);o.el.title=`${f.name} · 힘 ${f.str} 손재주 ${f.dex} 마음 ${f.heart} · 클릭 후 방 클릭으로 배치`; o.el.querySelector('.b').style.background = BODY[best(f)];
      o.el.querySelector('.nm').style.top = nth%2===0?'39px':'-16px';
      o.el.querySelector('.hpb i').style.width = (f.hp / Sim.maxHP(f) * 100) + '%';
    }
    // 호르칸
    for (let i = 0; i < 3; i++) {
      const id = '__raider' + i;
      if (G.raid) {
        const o = ensureFig(id, { name: i === 1 ? '호르칸' : '' }, 'raider'); alive.add(id);
        const r = geo.rooms[G.raid.path[G.raid.idx]];
        const tx = r.x + r.w - 18 - i * 16; o.x += (tx - o.x) * Math.min(1, dt / 160);
        o.el.style.left = o.x + 'px'; o.el.style.top = (r.y + r.h - 9 - 38) + 'px'; o.el.classList.add('work');
      }
    }
    if(G.julian.age>=3){
      const j=G.julian,loc=acc/DAY_MS>.78||j.location==='residence'?G.residence.slot:j.location,r=geo.rooms[loc],target=r?{x:r.x+r.w/2,y:r.y+r.h-46}:j.location==='outside'?{x:geo.yard.x-58,y:12}:{x:geo.yard.x+geo.yard.w/2,y:12};
      const o=ensureFig('__julian',{name:'율리안',str:1,dex:1,heart:1},'child');alive.add('__julian');o.el.id='julian-child';o.el.dataset.location=j.location;o.el.setAttribute('aria-label','성 안을 걷는 율리안');o.x+=(target.x-o.x)*Math.min(1,dt/130);o.y=o.y==null?target.y:o.y+(target.y-o.y)*Math.min(1,dt/130);o.el.style.left=o.x+'px';o.el.style.top=o.y+'px';o.el.classList.toggle('walk',Math.abs(target.x-o.x)>2);
    }
    if(G.pending&&Sim.eventFor(G,G.pending)?.kind==='refugee'){const f=Sim.visitor(G);if(f){const o=ensureFig('__visitor',f,'visitor');alive.add('__visitor');o.el.style.left=(geo.yard.x-70)+'px';o.el.style.top='0px';o.el.title='성문 밖 · '+f.name;}}
    for (const [id, o] of figs) if (!alive.has(id)) { o.el.remove(); figs.delete(id); }
  }

  // 끌어다 놓기 (+ 탭으로 고르기)
  function bindDrag(el, id) {
    let sx, sy, moved = false, pid = null;
    el.addEventListener('pointerdown', e => {
      e.stopPropagation(); pid = e.pointerId; el.setPointerCapture(pid); sx = e.clientX; sy = e.clientY; moved = false;
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerId !== pid) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) { moved = true; G.sel = id; figs.get(id).dragging = true; el.classList.add('drag'); syncRooms(); }
      if (moved) { const p=worldPoint(e); el.style.left=p.x+'px';el.style.top=(p.y-30)+'px'; }
    });
    const up = e => {
      if (e.pointerId !== pid) return; pid = null;
      const o = figs.get(id); el.classList.remove('drag');
      if (!moved) {
        // 다른 사람을 고른 상태에서 방 안의 사람을 누르면 그 방을 누른 것으로 본다 — 사람이 방 클릭 영역을 가려 배치가 안 되던 문제
        const f = G.folk.find(x => x.id === id);
        if (G.sel && G.sel !== id && f?.room) { assign(G.sel, f.room); renderPanel(); syncRooms(); return; }
        selectFolk(id); return;
      }
      o.dragging = false;
      const {x:px,y:py}=worldPoint(e);
      const slot = Object.entries(geo.rooms).find(([, r]) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)?.[0];
      const y = geo.yard;
      if (slot) assign(id, slot); else if (px >= y.x && px <= y.x + y.w && py >= y.y - 20 && py <= y.y + y.h) { assign(id, null); }
      else G.sel = null;
      renderPanel(); syncRooms();
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', () => {pid=null; const o=figs.get(id);if(o)o.dragging=false;el.classList.remove('drag');}); el.addEventListener('click',e=>e.stopPropagation());
  }
  const ICON = {
    food: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="14" rx="9" ry="6" fill="#C98B4E"/><ellipse cx="12" cy="12" rx="7" ry="4" fill="#E2B074"/></svg>',
    wood: '<svg viewBox="0 0 24 24"><rect x="3" y="12" width="18" height="6" rx="3" fill="#8A6640"/><rect x="5" y="6" width="14" height="6" rx="3" fill="#A57D4F"/><circle cx="19" cy="15" r="2.4" fill="#D9B98A"/></svg>',
    gold: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#DDB95E"/><circle cx="12" cy="12" r="5" fill="none" stroke="#A9852F" stroke-width="1.6"/></svg>',
    folk: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4" fill="#EBC9A8"/><rect x="6" y="12" width="12" height="9" rx="4" fill="#5A7FA8"/></svg>',
  };
  const DECOR={gate:'<div class="dec"></div><div class="banner-wolf"></div>',lumber:'<div class="dec"></div>',kitchen:'<div class="dec"></div>',forge:'<div class="dec"></div><div class="anvil"></div>',barracks:'<div class="dec"></div><div class="dummy"></div>',dorm:'<div class="dec"></div>',parlor:'<div class="dec"></div>',nursery:'<div class="cradle" id="cradle"></div>'};
  function worldPoint(e){const b=world.getBoundingClientRect();return {x:(e.clientX-b.left-camera.x)/camera.zoom,y:(e.clientY-b.top-camera.y)/camera.zoom};}
  function applyCamera(){
    if(!geo)return;
    const w=geo.wall,z=camera.zoom;
    camera.zoom=Math.max(.6,Math.min(1.4,z));
    camera.x=Math.max(70-(w.x+w.w+130)*z,Math.min(geo.W-70-(w.x-130)*z,camera.x));
    camera.y=Math.max(100,Math.min(geo.H-100-(w.y-65)*z,camera.y));
    stage.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom})`;
    $('zoom-level').textContent=Math.round(camera.zoom*100)+'%';
    $('zoom-out').disabled=camera.zoom<=.60001;$('zoom-in').disabled=camera.zoom>=1.39999;
  }
  function homeCamera(){
    if(!geo)return;growth.elapsed=1000;
    const gate=geo.rooms[slotOf('gate')],w=geo.wall;
    camera.x=geo.W/2-(w.x+w.w/2)*camera.zoom;
    if(w.w*camera.zoom>geo.W-40)camera.x=geo.W/2-(gate.x+gate.w/2)*camera.zoom;
    camera.y=geo.H-70;camera.ready=true;applyCamera();
  }
  function zoomCamera(value,point={x:geo.W/2,y:geo.H/2}){
    growth.elapsed=1000;const next=Math.max(.6,Math.min(1.4,value)),ratio=next/camera.zoom;
    camera.x=point.x-(point.x-camera.x)*ratio;camera.y=point.y-(point.y-camera.y)*ratio;camera.zoom=next;applyCamera();
  }
  $('zoom-in').onclick=()=>zoomCamera(camera.zoom+.1);
  $('zoom-out').onclick=()=>zoomCamera(camera.zoom-.1);
  $('camera-home').onclick=homeCamera;
  world.addEventListener('wheel',e=>{
    if(showing)return;e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?geo.H:1;
    if(e.ctrlKey){const b=world.getBoundingClientRect();zoomCamera(camera.zoom*Math.exp(-e.deltaY*unit*.002),{x:e.clientX-b.left,y:e.clientY-b.top});}
    else{growth.elapsed=1000;if(e.shiftKey)camera.x-=(e.deltaY||e.deltaX)*unit;else{camera.y-=e.deltaY*unit;camera.x-=e.deltaX*unit;}applyCamera();}
  },{passive:false});
  let pan=null,suppressYardClick=false;
  world.addEventListener('pointerdown',e=>{
    if(showing||e.button!==0||e.target.closest('.fig,.room,.camera-controls'))return;
    pan={id:e.pointerId,x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,moved:false};
  });
  world.addEventListener('pointermove',e=>{
    if(!pan||e.pointerId!==pan.id)return;
    if(Math.hypot(e.clientX-pan.x,e.clientY-pan.y)>6)pan.moved=true;
    if(pan.moved){world.setPointerCapture(e.pointerId);growth.elapsed=1000;camera.x=pan.cx+e.clientX-pan.x;camera.y=pan.cy+e.clientY-pan.y;world.classList.add('panning');applyCamera();}
  });
  function endPan(e){if(!pan||e.pointerId!==pan.id)return;suppressYardClick=pan.moved;pan=null;world.classList.remove('panning');if(world.hasPointerCapture(e.pointerId))world.releasePointerCapture(e.pointerId);setTimeout(()=>suppressYardClick=false,0);}
  world.addEventListener('pointerup',endPan);world.addEventListener('pointercancel',endPan);
  function layoutGeo(){
    const W=world.clientWidth||700,H=world.clientHeight||570,gap=6,rowH=95,cw=150,rows=G.level+1,cols=Sim.columns(G),left=Sim.firstColumn(G)*156,top=-95-(rows-1)*101,width=cols*156-gap;
    const g={W,H,yard:{x:left,y:8,w:width,h:42},rooms:{},wall:{x:left-6,y:top-6,w:width+12,h:-top+12}};
    for(const id of slots()){const r=G.rooms[id];if(r?.mergedInto||!Sim.unlocked(G,id))continue;g.rooms[id]={x:(+id[3])*156,y:-95-(+id[1])*101,w:cw*(r?.size||1)+gap*((r?.size||1)-1),h:rowH};}
    return g;
  }
  function buildCastle(){
    const oldLevel=growth.level,oldRooms=new Set(Object.keys(geo?.rooms||{}));
    geo=layoutGeo();world.querySelectorAll('.yard,.keepwall,.room,.roof,.tower,.village,.trees,.ground').forEach(e=>e.remove());const y=geo.yard,w=geo.wall;
    stage.insertAdjacentHTML('beforeend',`<div class="ground" style="top:0px;left:${w.x-2000}px;width:${w.w+4000}px"></div><div class="yard" style="left:${y.x}px;top:${y.y}px;width:${y.w}px;height:${y.h}px"><div class="tag">안뜰 · 대기</div></div><div class="keepwall" style="left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px"></div>`);
    const houses=Math.max(2,Math.ceil(G.folk.length/2));
    stage.insertAdjacentHTML('beforeend',`<div class="roof" style="left:${w.x-10}px;top:${w.y-28}px;width:${w.w+20}px"></div>${Array.from({length:houses},(_,i)=>`<div class="village" style="left:${i%2?w.x+w.w+42+Math.floor(i/2)*40:w.x-75-Math.floor(i/2)*40}px;top:0px">⌂</div>`).join('')}${Array.from({length:G.level+1},(_,i)=>`<div class="tower" style="left:${i%2?w.x+w.w+Math.floor(i/2)*14:w.x-28-Math.floor(i/2)*14}px;top:${w.y-12+i*8}px;height:${-w.y+12-i*8}px"></div>`).join('')}`);
    for(const [id,r] of Object.entries(geo.rooms)){
      const type=typeOf(id),locked=!Sim.unlocked(G,id);
      stage.insertAdjacentHTML('beforeend',`<div class="room ${type?'r-'+type:'empty'} ${locked?'locked':''}" role="button" tabindex="0" aria-label="${+id[1]+1}층 ${+id[3]-Sim.firstColumn(G)+1}번 ${type?R[type].name:locked?'잠긴 방':'건설'}" data-s="${id}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${type?`<div class="light"></div>${DECOR[type]||''}<div class="floor"></div><div class="tag">${R[type].name}<span class="cap"></span></div><div class="out"></div>${R[type].res?'<div class="prog"><i></i></div>':''}`:`<div class="build"><div><b>${locked?'·':'＋'}</b>${locked?'영지 Lv'+id[1]:'짓기'}</div></div>`}</div>`);
    }
    const residence=world.querySelector(`[data-s="${G.residence.slot}"]`);if(residence){residence.className='room residence';residence.innerHTML='<div class="tag">영주관</div><p>엘레노어 · 율리안</p><div class="floor"></div>';residence.setAttribute('aria-label','영주관');}
    world.querySelectorAll('.room').forEach(el=>{el.onclick=()=>tapSlot(el.dataset.s);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapSlot(el.dataset.s);}};});world.querySelector('.yard').onclick=()=>{if(!suppressYardClick&&G.sel)assign(G.sel,null);};
    if(!camera.ready||G.level<oldLevel)homeCamera();
    if(oldLevel&&G.level>oldLevel){
      growth.elapsed=0;growth.from={...camera};
      const zoom=camera.zoom;
      growth.to={zoom,x:geo.W/2-(w.x+w.w/2)*zoom,y:geo.H-70};
      world.querySelectorAll('.room').forEach(el=>{if(!oldRooms.has(el.dataset.s))el.classList.add('new-room');});
    }
    growth.level=G.level;applyCamera();sizeSnow();syncRooms();
  }
  function syncRooms(){
    if(!geo)return;
    const selected=G.folk.find(f=>f.id===G.sel);
    world.querySelectorAll('.room').forEach(el=>{const id=el.dataset.s,type=typeOf(id),r=G.rooms[id];el.classList.toggle('raid',G.raid?.path[G.raid.idx]===id);el.classList.toggle('fire',!!r?.fire);el.classList.toggle('selected',roomSelection===id);el.setAttribute('aria-label',`${+id[1]+1}층 ${+id[3]-Sim.firstColumn(G)+1}번 ${type?R[type].name:'건설'}`);el.classList.toggle('can',!!selected&&!Sim.validate(G,{type:'assign',id:selected.id,slot:id}));if(id===G.residence.slot){el.setAttribute('aria-label','영주관');return;}if(!type)return;el.querySelector('.tag').firstChild.textContent=roomName(type);
      el.querySelector('.cap').textContent=`L${r.level} ${R[type].cap?at(id).length+'/'+Sim.capacity(G,id):''}`;
      el.querySelector('.out').textContent=r.fire?'화재 '+r.fire+'일':R[type].res?`+${rateOf(id).toFixed(1)}/일`:type==='dorm'?`정원 +${4*r.level*r.size}`:type==='storage'?`저장 +${160*r.level*r.size}`:'';
    });
    if($('cradle')&&G.julian.age>=5){$('cradle').classList.add('study-desk');$('cradle').title='공부방';$('cradle').textContent='▤ 서책';}else if($('cradle')){$('cradle').dataset.stage=G.julian.growth;$('cradle').title=Sim.growth(G);$('cradle').innerHTML=working(slotOf('nursery')).length?'<span class="zz">z z</span>':'<span class="cry">으앙!</span>';}
    world.querySelectorAll('.raidbar').forEach(el=>el.remove());
    if(G.raid){const r=geo.rooms[G.raid.path[G.raid.idx]];stage.insertAdjacentHTML('beforeend',`<div class="raidbar" style="left:${r.x+8}px;top:${r.y+39}px;width:${r.w-16}px"><i style="width:${100*G.raid.hp/G.raid.max}%"></i></div>`);}
  }

  // 눈
  const snow = $('snow'), sctx = snow.getContext('2d'); let flakes = [];
  function sizeSnow() { const dpr = devicePixelRatio || 1; snow.width = world.clientWidth * dpr; snow.height = (geo?.H || 600) * dpr; sctx?.setTransform(dpr, 0, 0, dpr, 0, 0); flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * world.clientWidth, y: Math.random() * 160, s: 0.6 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.03 })); }
  function drawSnow(dt) {
    if(!sctx)return;const heavy = G && G.day < G.blizzardUntil;
    sctx.clearRect(0, 0, snow.width, snow.height); if (Sim.season(G)!==3) return; sctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const f of flakes) { f.y += f.v * dt * (heavy ? 3 : 1); f.x += (heavy ? 0.06 : 0.01) * dt; if (f.y > (geo?.H||500)) { f.y = -4; f.x = Math.random() * world.clientWidth; } if (f.x > world.clientWidth) f.x = 0; sctx.beginPath(); sctx.arc(f.x, f.y, f.s, 0, 7); sctx.fill(); }
  }

  // 늑대의 요람의 세 음 Simon 가락과 WebAudio 봉투를 이식.
  function lullaby(){
    const err=Sim.validate(G,{type:'lullaby',success:true});if(err){feedback(err);return;}
    const phrases=[[2,2,3,2],[2,1,3,2],[3,2,1,1]],hz={1:261.6,2:329.6,3:392};
    let line=0,pos=0,cries=0,listening=false;
    sheet('목동 자장가',`<p class="hint">빛과 소리를 기억해 세 음을 따라 부르세요.<br>세 번 틀리면 아이를 안고 쉬어 갑니다.</p><div class="staff">${'<i></i>'.repeat(4)}</div><p id="lull-status">소리를 켜고 시작하세요.</p><div class="keys">${[1,2,3].map((p,i)=>`<button class="btn" data-p="${p}" disabled>${['낮게','가운데','높게'][i]}</button>`).join('')}</div><button class="btn" id="lull-start">듣기 시작</button>${closeButton()}`,'lullaby');
    const staff=[...$('modal').querySelectorAll('.staff i')],keys=[...$('modal').querySelectorAll('[data-p]')],st=$('lull-status');
    const later=(fn,ms)=>lullTimers.push(setTimeout(fn,ms));
    const tone=p=>{try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.value=hz[p];g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.18,audio.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.5);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.55);}catch{}};
    const setKeys=on=>keys.forEach(k=>k.disabled=!on);
    function play(){listening=false;setKeys(false);pos=0;st.textContent=`${line+1}절 · 가락을 들어 보세요. 울음 ${cries}/3`;staff.forEach(s=>{s.className='';s.style.marginBottom='0';});phrases[line].forEach((p,j)=>later(()=>{staff.forEach(s=>s.classList.remove('lit'));staff[j].style.marginBottom=(p-1)*20+'px';staff[j].classList.add('lit');tone(p);},400+j*620));later(()=>{staff.forEach(s=>{s.className='';s.style.marginBottom='0';});st.textContent=`${line+1}절 · 이제 불러 주세요. 울음 ${cries}/3`;listening=true;setKeys(true);},3100);}
    $('lull-start').onclick=()=>{$('lull-start').hidden=true;tone(2);play();};
    keys.forEach(k=>k.onclick=()=>{if(!listening)return;const p=+k.dataset.p;tone(p);if(p===phrases[line][pos]){staff[pos].className='ok';staff[pos].style.marginBottom=(p-1)*20+'px';pos++;if(pos===4){listening=false;setKeys(false);line++;if(line===3){st.textContent='율리안이 잠들었습니다.';later(()=>dispatch({type:'lullaby',success:true}),700);}else later(play,700);}}else{cries++;listening=false;setKeys(false);st.textContent=cries>=3?'아이를 안고 숨을 고릅니다.':'음이 달라요. 둘째 절은 가운데 → 낮게 → 높게 → 가운데.';later(cries>=3?()=>dispatch({type:'lullaby',success:false}):play,900);}});
  }
  // 공개 정책도 사람이 쓰는 버튼 경로를 통과한다. 상태를 직접 바꾸지 않는다.
  function clickAction(a){
    if(Sim.validate(G,a))return false;
    if(a.type==='assign'){if(showing)return false;$('folk').click();filter='all';renderLeft();document.querySelector(`[data-person="${a.id}"]`)?.click();if(a.slot===null){const b=[...$('panel').querySelectorAll('[data-action]')].find(b=>JSON.parse(b.dataset.action).type==='assign');b?.click();}else world.querySelector(`[data-s="${a.slot}"]`)?.click();return G.folk.find(f=>f.id===a.id)?.room===a.slot;}
    if(!['choice','ack','retry','restart'].includes(a.type)&&showing&&dialogKind!=='region')return false;
    if(['build','upgrade','demolish','rush','extinguish'].includes(a.type)){G.sel=null;world.querySelector(`[data-s="${a.slot}"]`)?.click();if(a.type==='demolish')document.querySelector(`[data-demolish="${a.slot}"]`)?.click();}
    if(a.type==='craft')$('forge').click();
    if(['equip','buy','sell','use_item'].includes(a.type)){$('bag').click();if(a.type==='equip'){$('equip-person').value=a.id;$('equip-person').dispatchEvent(new Event('change',{bubbles:true}));}}
    if(a.type==='gift'){if(!showing)$('region').click();document.querySelector(`[data-neighbor="${a.neighbor}"]`)?.click();}
    if(['repair','wall'].includes(a.type)){G.sel=null;world.querySelector(`[data-s="${slotOf('gate')}"]`)?.click();}
    if(['registry','checkup'].includes(a.type)){G.sel=null;world.querySelector(`[data-s="${slotOf('nursery')}"]`)?.click();if(a.type==='registry')document.querySelector('[data-registry]')?.click();}
    if(['teacher','tool','recall'].includes(a.type)){view='julian';render();}
    if(a.type==='openRequest'){view='home';render();}
    const target=[...document.querySelectorAll('[data-action]')].find(b=>{const x=JSON.parse(b.dataset.action);return Object.keys(a).every(k=>JSON.stringify(a[k])===JSON.stringify(x[k]));});if(!target||target.disabled)return false;target.click();if(dialogKind==='region')document.querySelector('[data-close]')?.click();return true;
  }
  function clearNotices(){for(let i=0;i<30&&G.notices.length&&!G.pending&&G.status!=='gameOver';i++){pump();if(!clickAction({type:'ack'}))break;}}
  function autoTurn(){
    $('tutorial-skip')?.click();if(showing&&['manage','region','lullaby'].includes(dialogKind))document.querySelector('[data-close]')?.click();
    if(G.status==='gameOver'){clickAction({type:'retry'});return;}clearNotices();
    if(G.pending){const a=window.KeepPolicy(G,'average').find(a=>a.type==='choice');if(a)clickAction(a);clearNotices();}
    for(const a of window.KeepPolicy(G,'average')){if(a.type==='choice'&&!G.pending)continue;clickAction(a);clearNotices();}
    if(!showing)advance();
  }
  function skipDays(n){let count=0,guard=0;n=Math.min(800,Math.max(0,Number(n)||0));while(count<n&&G.status==='playing'&&guard++<n*30+50){const before=G.elapsedDays;if(auto)autoTurn();else{if(showing)break;advance();}if(G.elapsedDays!==before)count++;if(!auto&&showing)break;}if(auto){clearNotices();pump();}render();return clone(G);}
  window.__keep={state:()=>clone(G),setSpeed,skipDays,autoplay(value){auto=!!value;return auto;},ui:()=>({speed,previousSpeed,resumeSpeed,showing,dialogKind,tutorial,view,uiActions}),layout:()=>({width:world.clientWidth,height:world.clientHeight,rooms:clone(geo.rooms),wall:clone(geo.wall),camera:{...camera}}),clickAction};
  const ABILITY={martial:'무예',learning:'학문',etiquette:'예법',people:'인망'};
  function roomName(type){return type==='nursery'&&G.julian.age>=5?'공부방':R[type]?.name;}
  function unlockText(){const n=Sim.nextUnlock(G);return `다음 해금: ${n.age}세 ${n.name}까지 ${n.seasons}계절`;}
  function teacherPanel(){if(G.julian.age<5)return '';const f=G.folk.find(f=>f.id===G.teacher);return `<section id="teacher-panel"><h3>이번 계절 스승 · ${f?.name||'미지정'}</h3><p class="hint">가신 한 명 · 가장 높은 힘→무예 / 지혜→학문 / 마음→예법<br>교육 ×${Sim.educationMultiplier(G).toFixed(2)} · 스승 생산 50% · 교체 시 일수 비례</p>${G.folk.filter(f=>f.status==='가신').map(f=>button(f.name+' 스승 지정',{type:'teacher',id:f.id},`힘 ${f.str} · 지혜 ${f.wis} · 마음 ${f.heart}`)).join('')}</section>`;}
  function julianPanel(){const j=G.julian;return header('율리안 · '+j.age+'세')+meter('건강',j.health,100,'health')+meter('애착',j.bond,100,'bond')+Object.entries(ABILITY).map(([k,n])=>meter(n,j.abilities[k])).join('')+`<p>${j.age<5?'능력치는 5세부터 자랍니다.':''}</p><h3>성향</h3><p>${j.tags.join(' · ')||'함께한 사람들에게서 배웁니다.'}</p><h3>가장 친한 사람</h3>${Sim.closest(G).map(p=>`<p>${p.name} · 유대 ${p.value}</p>`).join('')||'<p>3세부터 유대를 쌓습니다.</p>'}${j.age>=3?button('영주관으로 부르기',{type:'recall'},'위험한 방과 성 밖에서 아이를 부릅니다'):''}${j.age>=5?'<h3>교육 도구</h3>'+button('서책 구매',{type:'tool',tool:'book'},'금화 35 · 학문 교육 계절 보너스 +2')+button('목검 구매',{type:'tool',tool:'sword'},'금화 25 · 무예 교육 계절 보너스 +2'):''}`;}
  function leftP1(){
    const j=G.julian,next=Sim.forecast(G);
    $('leftcard').innerHTML=`<div><h3>아이를 지키는 성</h3>${meter('건강',j.health,100,'health')}${meter('애착',j.bond,100,'bond')}${meter('성문',G.gateHP,Sim.gateMax(G),'health')}<p class="hint">${unlockText()}</p>${next?`<p class="raid-warning">습격 D-${next.days}<br>예상 ${Math.round(next.power)} · 수비 ${Math.round(next.defense)}</p>`:''}<p id="satisfaction" class="hint">만족도 ${Math.round(Sim.averageSatisfaction(G))} · ${lodgingText()}</p></div><div><h3>영지민 ${G.folk.length}/${popCap()}</h3><div id="roster" class="roster-grid">${G.folk.map(f=>`<button class="person ${G.sel===f.id?'selected':''}" data-person="${f.id}" aria-label="${f.name} 선택">${portrait(f)}<b>${f.name}</b><small>${f.status} · ${f.hurt?'부상':roomName(typeOf(f.room))||'안뜰 대기'}</small></button>`).join('')}</div></div>`;
  }
  function panelP1(){
    const risk=Sim.risks(G)[0];$('next-task').textContent='지금 할 일 · '+(risk?.text||(G.julian.age>=5&&!G.teacher?'이번 계절의 스승을 지정하세요':G.gateHP<Sim.gateMax(G)*.6?'성문을 눌러 수리하세요':Sim.daily(G).food<0?'주방의 식량 생산을 늘리세요':G.sel?'선택한 사람을 방에 배치하세요':unlockText()));
    let html=view==='julian'?julianPanel():view==='room'?roomPanel():view==='folk'?folkPanel():view==='records'?recordsPanel():homePanel();
    if(view==='build')html=header('건설할 빈 터 선택')+'<p>성은 위와 양옆으로 확장됩니다.</p>'+Object.keys(G.rooms).filter(id=>G.rooms[id]===null&&id!==G.residence.slot&&Sim.unlocked(G,id)).map(id=>`<button class="queue-button" data-slot="${id}">${+id[1]+1}층 ${+id[3]-Sim.firstColumn(G)+1}번 빈 터</button>`).join('');
    $('panel').className='panel';$('panel').innerHTML=html;
    $('teacher').innerHTML=teacherPanel();$('lullaby')?.addEventListener('click',lullaby);
    $('selection').textContent=G.sel?`${G.folk.find(f=>f.id===G.sel)?.name} 선택됨 · 방 클릭 = 배치 · 안뜰 클릭 = 대기`:'';
  }
  function hudP1(){
    $('julian-hud').innerHTML=`<img src="media/julian.webp" alt="율리안"><div><b>율리안 · ${G.julian.age}세</b><small>${unlockText()}</small></div>`;
    $('contest').innerHTML=meter('이졸데 준비도',G.isolde,100,'danger')+meter('우리 준비 · 능력과 병력',Sim.ourPreparation(G),100,'health');
    $('exposure').innerHTML=meter(G.sus>=80?'의심 · 매우 위험':G.sus>=50?'의심 · 감찰 중':'의심 · 은신 중',G.sus,100,'danger');
    const d=Sim.daily(G);$('res').innerHTML=['food','wood','gold'].map(k=>`<small>${NAMES[k]} <b>${Math.floor(G.res[k])}</b> <span class="${d[k]<0?'dn':'up'}">${fmt(d[k])}</span></small>`).join('');
    $('date').textContent=`${G.year}년 ${K.seasons[Sim.season(G)]} ${G.day===120?30:G.day%30+1}일 · 영지 Lv${G.level}`;
    const risks=Sim.risks(G);$('banner').innerHTML=(G.raid?`<div class="banner">이졸데가 부추긴 ${G.raid.name} · 성문 ${Math.ceil(G.gateHP)} · 습격대 ${Math.ceil(G.raid.hp)} · ${G.raid.round}R</div>`:'')+risks.slice(0,1).map(r=>`<button class="banner" data-focus-slot="${r.slot}">${esc(r.text)}</button>`).join('');
    const key=risks.map(r=>r.text.split(' · ')[0]).join('|')+(G.raid?'raid':'');if(key&&key!==dangerKey)slow();dangerKey=key;
    $('speed').innerHTML=[[0,'Ⅱ'],[1,'1×'],[2,'2×'],[4,'4×']].map(([n,t])=>`<button data-sp="${n}" aria-label="${n?'속도 '+n+'배':'일시정지'}" aria-pressed="${speed===n}" class="${speed===n?'on':''}">${t}</button>`).join('');
    $('progress').textContent=G.repair?`성문 수리 ${G.repair.remaining}일`:'';
    document.querySelectorAll('.toolbar button').forEach(b=>b.classList.toggle('active',b.id===view));world.dataset.season=Sim.season(G);world.classList.toggle('under-raid',!!G.raid);world.classList.toggle('burned',!!G.metrics.burned);
  }
  function resultP1(){auto=false;persist();sheet('6세 · 이 아이는 어떤 황제가 될까',`<div class="portrait-line"><img src="media/julian.webp" alt="6세 율리안"><b>${Sim.emperorType(G)}</b></div>${Object.entries(ABILITY).map(([k,n])=>meter(n,G.julian.abilities[k])).join('')}<p>성향: ${G.julian.tags.join(' · ')||'아직 정해지지 않음'}</p><p>가장 친한 사람: ${Sim.closest(G).map(p=>p.name+' (유대 '+p.value+')').join(' · ')||'아직 없음'}</p>${meter('이졸데 준비도',G.isolde,100,'danger')}<p>이 아이는 어떤 황제가 될까 — ${Sim.emperorType(G)}의 싹을 품었습니다.</p><button class="btn" id="copy-record">기록 복사</button><p id="copy-status" role="status"></p><textarea id="record-text" aria-label="플레이 기록" readonly hidden></textarea>${button('처음부터',{type:'restart'})}`,'result');}
  function persist(){try{localStorage.setItem('north-keep-p1-log',JSON.stringify({...G.telemetry,elapsedDays:G.elapsedDays,age:G.julian.age,abilities:G.julian.abilities,tags:G.julian.tags,closest:Sim.closest(G),isolde:G.isolde}));}catch{/* Private browsing or storage quota must not stop play. */}}
  async function copyRecord(){persist();const text=JSON.stringify({...G.telemetry,elapsedDays:G.elapsedDays,abilities:G.julian.abilities,tags:G.julian.tags,closest:Sim.closest(G),isolde:G.isolde},null,2);try{await navigator.clipboard.writeText(text);$('copy-status').textContent='기록을 복사했습니다.';}catch{const area=$('record-text');area.hidden=false;area.value=text;area.focus();area.select();$('copy-status').textContent='자동 복사가 불가능합니다. 선택한 기록을 복사하세요.';}}

  addEventListener('pagehide',persist);
  let lastFrame=performance.now();
  function frame(now){const realElapsed=Math.max(0,now-lastFrame),elapsed=Math.min(1000,realElapsed),dt=Math.min(60,elapsed);lastFrame=now;
    if(growth.elapsed<1000){growth.elapsed=Math.min(1000,growth.elapsed+elapsed);const t=1-Math.pow(1-growth.elapsed/1000,3);for(const key of ['x','y'])camera[key]=growth.from[key]+(growth.to[key]-growth.from[key])*t;camera.zoom=Math.max(.6,growth.from.zoom*(1-.1*Math.sin(Math.PI*growth.elapsed/1000)));applyCamera();}
    if(G.status==='playing'&&!document.hidden)G.telemetry.playMs+=realElapsed;animate(dt);drawSnow(dt);
    if(auto){autoAccumulator+=elapsed;if(autoAccumulator>=100){autoAccumulator=0;autoTurn();}}
    else if(!showing&&(tutorial>=2||tutorial>=4)&&speed&&G.status==='playing'){
      if(G.raid){raidAcc+=elapsed;if(raidAcc>=1200){raidAcc=0;advance();}}
      else{acc+=elapsed*speed;if(acc>=DAY_MS){acc-=DAY_MS;advance();}}
    }
    world.classList.toggle('night',acc/DAY_MS>.78);
    world.querySelectorAll('.prog i').forEach(i=>i.style.width=Math.min(100,acc/DAY_MS*100)+'%');requestAnimationFrame(frame);
  }
  addEventListener('resize',()=>{geometryKey='';render();});render();pump();requestAnimationFrame(frame);
})();
