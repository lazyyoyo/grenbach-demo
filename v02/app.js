(() => {
  'use strict';
  const K=window.KEEP,R=K.rooms,Sim=window.KeepSim,DAY_MS=K.dayMs;
  const $=id=>document.getElementById(id),world=$('world');
  const STAT={str:'힘',dex:'손재주',heart:'마음'},BODY={str:'#B5652E',dex:'#B89A3E',heart:'#3F8A5E'};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const best=f=>['str','dex','heart'].sort((a,b)=>f[b]-f[a])[0];
  const sum=(arr,k)=>arr.reduce((s,f)=>s+f[k],0);
  let saveFailed=false;
  const store={get(k,d){try{const raw=localStorage.getItem(k);return raw===null?d:JSON.parse(raw);}catch{saveFailed=true;return d;}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v));saveFailed=false;}catch{saveFailed=true;}}};
  const saved=store.get('north-keep-v2',null);
  let G=Sim.validSave(saved)?saved:Sim.create(1),speed=1,geo=null,acc=0,raidAcc=0,showing=false,auto=false,autoAccumulator=0;
  let tutorial=store.get('north-keep-tutorial',0),dialogKind='',lastFocus=null,audio=null,lullTimers=[];
  G.sel=null;
  const figs=new Map(),slots=()=>Object.keys(G.rooms),typeOf=id=>G.rooms[id]?.type,slotOf=type=>Sim.slotOf(G,type),at=id=>G.folk.filter(f=>f.room===id&&!f.away),working=id=>Sim.workers(G,id),rateOf=id=>Sim.rate(G,id),popCap=()=>Sim.popCap(G);
  const button=(label,action,sub='')=>`<button class="opt" data-action="${esc(JSON.stringify(action))}" ${Sim.validate(G,action)?'disabled':''}><b>${esc(label)}</b>${sub?`<span>${esc(sub)}</span>`:''}</button>`;
  const costText=c=>Object.entries(c).map(([k,v])=>`${{food:'식량',wood:'장작',gold:'금화'}[k]} ${v}`).join(' · ');
  const closeButton=()=>'<button class="btn dialog-close" data-close>성으로 돌아가기</button>';
  function save(){store.set('north-keep-v2',G);}
  function feedback(t){$('feedback').textContent=t;}
  function closeDialog(){lullTimers.forEach(clearTimeout);lullTimers=[];$('modal').innerHTML='';showing=false;dialogKind='';lastFocus?.focus?.({preventScroll:true});}
  function sheet(title,body,kind='manage',img=''){
    if(!showing)lastFocus=document.activeElement;
    showing=true;dialogKind=kind;
    $('modal').innerHTML=`<div class="modal"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">${img?`<img class="pic" src="${img}" alt="">`:''}<div class="body"><h2>${esc(title)}</h2>${body}</div></section></div>`;
    $('modal').querySelector('button:not(:disabled),input')?.focus({preventScroll:true});
  }
  function dispatch(a){const result=Sim.act(G,a);if(result.error){feedback(result.error);return false;}G=result.state;G.sel=null;closeDialog();save();render();pump();return true;}
  document.addEventListener('click',e=>{
    const a=e.target.closest('[data-action]');if(a&&!a.disabled){dispatch(JSON.parse(a.dataset.action));return;}
    if(e.target.closest('[data-close]')){closeDialog();pump();}
  });
  document.addEventListener('keydown',e=>{
    if(!showing)return;
    if(e.key==='Escape'&&['manage','folk','scout','records','help','lullaby'].includes(dialogKind)){closeDialog();pump();}
    if(e.key==='Tab'){const focus=[...$('modal').querySelectorAll('button:not(:disabled),input:not(:disabled)')];if(!focus.length)return;const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });
  function selectFolk(id){G.sel=G.sel===id?null:id;renderPanel();syncRooms();renderRoster();}
  function assign(id,slot){const ok=dispatch({type:'assign',id,slot});if(ok)feedback(`${G.folk.find(f=>f.id===id)?.name} → ${R[typeOf(slot)]?.name||'안뜰'}`);}
  function tapSlot(slot){
    if(!Sim.unlocked(G,slot)){feedback(`영지 Lv${+slot[1]}에 열립니다. 명성을 모아 주세요.`);return;}
    if(G.sel){assign(G.sel,slot);return;}manageRoom(slot);
  }
  function manageRoom(slot){
    const r=G.rooms[slot];if(r?.mergedInto)return manageRoom(r.mergedInto);
    if(!r){sheet('빈 방에 불을 밝힌다',`<p class="hint">${+slot[1]+1}층 · ${+slot[3]+1}번째 칸 / 금화 ${Math.floor(G.res.gold)}</p><div class="buildgrid">${Object.entries(R).filter(([,r])=>!r.fixed).map(([key,def])=>button(`${def.name} · ${def.cost} 금화`,{type:'build',slot,room:key},def.desc)).join('')}</div>${closeButton()}`);return;}
    let body=`<p>${R[r.type].desc}</p><p class="hint">Lv${r.level} · ${r.size}칸 · ${working(slot).length}/${Sim.capacity(G,slot)}명${R[r.type].res?` · 하루 ${rateOf(slot).toFixed(1)} 생산`:''}</p>`;
    const upgrade={type:'upgrade',slot};body+=button(`업그레이드 → Lv${Math.min(3,r.level+1)}`,upgrade,costText(Sim.price(G,upgrade)));
    if(!R[r.type].fixed){for(const [other,o] of Object.entries(G.rooms)){const a={type:'merge',slot,other};if(o?.type===r.type&&other!==slot&&other[1]===slot[1])body+=button(`인접 ${+other[3]+1}번 방과 합치기`,a,costText(Sim.price(G,a))+' · 같은 레벨, 최대 3칸');}}
    if(R[r.type].res){const tries=G.rush[slot]||0;body+=button('재촉 · 하루치 즉시 생산',{type:'rush',slot},`기본 실패율 ${Math.min(95,10+15*tries)}% (특장점 보정) · 실패하면 화재`);}
    if(r.fire)body+=button(`불 끄기 · 남은 화재 ${r.fire}일`,{type:'extinguish',slot},'장작 4');
    if(r.type==='forge')body+=K.weapons.filter(w=>!w.scout).map(w=>button(`${w.name} 제작 · 방어 +${w.power}`,{type:'craft',weapon:w.id},`대장간 Lv${w.level} · 금화 ${w.cost} · 장작 5`)).join('');
    if(r.type==='nursery')body+='<button class="opt" id="lullaby"><b>목동 자장가</b><span>세 음의 가락을 듣고 따라 부르세요. 하루 한 번.</span></button>';
    sheet(`${R[r.type].name} · 관리`,body+closeButton());$('lullaby')?.addEventListener('click',lullaby);
  }
  function folkSheet(id){
    const f=G.folk.find(f=>f.id===id);if(!f)return;
    sheet(f.name,`<p>${f.role} · Lv${f.level} · XP ${f.xp}<br>힘 ${f.str} / 손재주 ${f.dex} / 마음 ${f.heart}<br>체력 ${Math.ceil(f.hp)}/${Sim.maxHP(f)} · 만족도 ${Math.round(f.satisfaction)}<br>${f.hurt?`부상 ${f.hurt}일`:f.away?'정찰 파견 중':'성에서 일할 수 있음'}</p><p><b>${K.traits[f.trait].name}</b><br>${K.traits[f.trait].desc}</p><p class="hint">무기: ${K.weapons.find(w=>w.id===f.weapon)?.name||'없음'}</p>${[...new Set(G.inventory)].map(w=>button(`${K.weapons.find(x=>x.id===w).name} 장착`,{type:'equip',id,weapon:w})).join('')}${f.weapon?button('무기 해제',{type:'equip',id,weapon:null}):''}<h3>배치 이력</h3><p class="hint">${f.history.slice(-8).reverse().map(h=>`${h.year}년 ${K.seasons[Math.min(3,Math.floor(h.day/30))]} ${h.day%30+1}일 · ${R[G.rooms[h.room]?.type]?.name||'안뜰'}`).join('<br>')||'아직 배치한 적이 없습니다.'}</p>${closeButton()}`,'folk',f.img||'');
  }
  function scoutSheet(){
    const people=G.folk.filter(f=>!f.hurt&&!f.away);
    sheet('산 너머로 보내는 사람들',`<p class="hint">1~3명. 파견 중에는 생산·돌봄·방어에서 빠집니다. 귀환 후에는 안뜰에서 기다립니다.</p>${G.expeditions.map(e=>`<div class="expedition">${K.scouts.find(d=>d.id===e.destination).name} · ${e.returnAt-G.elapsedDays}일 뒤 귀환<br>${e.ids.map(id=>G.folk.find(f=>f.id===id)?.name||'').join(' · ')}</div>`).join('')}<div id="scout-people">${people.map(f=>`<label class="checkfolk"><input type="checkbox" value="${f.id}">${f.name} · 힘 ${f.str} / ${R[typeOf(f.room)]?.name||'안뜰'}</label>`).join('')}</div>${K.scouts.map(d=>`<button class="opt" data-destination="${d.id}"><b>${d.name} · ${d.days}일</b><span>식량 ${d.food} · 금화 ${d.gold} · ${Math.round(d.risk*100)}% 기본 부상 위험<br>무기·영지민 후보를 만날 수도 있습니다.</span></button>`).join('')}<div id="scout-error" role="status"></div>${G.candidates.map(id=>button(`${K.folk.find(f=>f.id===id).name} 영입`,{type:'recruit',id},`정원 ${G.folk.length}/${popCap()}`)).join('')}${closeButton()}`,'scout');
    $('modal').querySelectorAll('[data-destination]').forEach(b=>b.onclick=()=>{const ids=[...$('scout-people').querySelectorAll('input:checked')].map(x=>x.value),a={type:'scout',destination:b.dataset.destination,ids};const err=Sim.validate(G,a);if(err)$('scout-error').textContent=err;else dispatch(a);});
  }
  function recordsSheet(){sheet('성에 남은 기록',`<h3>율리안의 성장</h3>${G.records.map(r=>`<p>${r.year}년 ${K.seasons[r.season]} · ${r.title}<br><small>${r.text}</small></p>`).join('')||'<p>계절이 끝나면 기록이 남습니다.</p>'}<h3>묘지</h3><p>${G.graveyard.map(f=>`${f.name} · ${f.year}년 ${K.seasons[Math.floor(f.day/30)]}`).join('<br>')||'아직 떠나보낸 사람이 없습니다.'}</p>${closeButton()}`,'records');}
  function pump(){
    if(showing)return;
    const n=G.notices[0];
    if(n){let title='',text='',img='';
      if(n.kind==='cutscene'){const c=K.cutscenes[n.id];title=c.title;text=c.lines.join('\n');img=c.img;}
      if(n.kind==='failure'){title='빈 요람';text=n.reason+'\n그 계절 첫날의 성으로 돌아왔습니다. 방 배치와 비축을 바꿔 다시 지켜 주세요.';img='media/basket.webp';}
      if(n.kind==='record'){title=n.title;text=n.text;img='media/julian.webp';}
      if(n.kind==='season'){title=`${G.year}년 · ${K.seasons[n.season]}`;text=['봄에는 밭을 열고 사람을 맞습니다.','여름에는 장작을 아끼고 비축합니다.','밭이 멈춥니다. 주방과 성문을 준비하세요.','장작 소모 하루 4. 눈보라에는 두 배입니다.'][n.season];}
      if(n.kind==='level'){title=`영지 Lv${n.level}`;text=`${n.level+1}층까지 열렸습니다. 빈 방에서 건설할 수 있습니다.`;}
      if(n.kind==='scout'){title='발자국이 돌아왔다';text=`${n.destination} 정찰대가 돌아왔습니다. 정찰 화면의 후보와 영지민의 부상을 확인하세요.`;}
      sheet(title,`<p>${esc(text)}</p>${button('계속',{type:'ack'})}`,'notice',img);return;
    }
    if(G.pending){const e=K.events.find(e=>e.id===G.pending);sheet(e.title,`<p>${e.text}</p>${e.choices.map((c,index)=>button(c.label,{type:'choice',index},`${costText(c.cost)}${Object.entries(c.fx).length?' / '+Object.entries(c.fx).map(([k,v])=>`${{food:'식량',wood:'장작',gold:'금화',health:'건강',bond:'애착',sus:'의심',satisfaction:'만족도',xp:'명성'}[k]} ${v>0?'+':''}${v}`).join(' · '):''}`)).join('')}`,'event');return;}
    if(G.status==='yearEnd'){
      const r=G.yearReports.at(-1);sheet(`${r.year}년 연말 결산`, `<p>인구 대장 ${r.population.length}명 · 세금 +${r.tax} 금화<br>율리안 건강 ${Math.round(r.health)} · 애착 ${Math.round(r.bond)}<br>떠나보낸 사람 ${r.deaths.length}명 · 되돌림 누적 ${G.failures}회</p><table class="stats-table">${r.population.map(f=>`<tr><td>${f.name}</td><td>Lv${f.level}</td></tr>`).join('')}</table><p class="hint">다음 해에는 습격 강도가 ${Math.round(K.balance.yearScale*100)}%p 높아집니다. 성과 사람들은 그대로 이어집니다.</p>${button(`${G.year+1}년차로 계속`,{type:'continue'})}`,'year');auto=false;
    }
  }
  function advance(){G=Sim.step(G);save();render();pump();}
  // 사람 모형: 몸 색 = 가장 높은 능력치
  function figHTML(f, kind) {
    const hair = f.hero ? '#2A2220' : f.id === 'ottilie' ? '#C9C6C0' : kind === 'raider' || f.raiderLook ? '#3A2B20' : '#6B4A30';
    const body = kind === 'raider' ? '#8E2F2A' : BODY[best(f)];
    return `<div class="hair" style="background:${hair}"></div><div class="h"></div><div class="b" style="background:${body}${f.hero ? ';box-shadow:inset 0 3px 0 #B9A889' : ''}"></div><div class="l a"></div><div class="l c"></div>${kind ? '' : `<div class="hpb"><i></i></div>`}<div class="nm">${esc(f.name)}</div>`;
  }
  function areaOf(f) {
    if (f.room && geo.rooms[f.room]) { const r = geo.rooms[f.room]; return { x0: r.x + 16, x1: r.x + r.w - (typeOf(f.room) === 'nursery' ? 66 : 18), floor: r.y + r.h - 9 }; }
    const y = geo.yard; return { x0: y.x + 14, x1: y.x + y.w - 14, floor: y.y + y.h - 4 };
  }
  function ensureFig(id, f, kind) {
    let o = figs.get(id);
    if (!o) {
      const el = document.createElement('div'); el.className = 'fig' + (kind ? ' npc ' + kind : ''); el.innerHTML = figHTML(f, kind); world.appendChild(el);
      const a = areaOf(f); o = { el, x: a.x0 + Math.random() * (a.x1 - a.x0), tx: null, wait: 0, room: f.room, kind };
      figs.set(id, o);
      if (!kind) { bindDrag(el, id); el.tabIndex=0; el.setAttribute('role','button'); el.setAttribute('aria-label',f.name+' 선택'); el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFolk(id);}}); }
    }
    return o;
  }
  function animate(dt) {
    if (!G || !geo) return;
    const alive = new Set(), perRoom = {};
    for (const f of G.folk) {
      if (f.away) continue;
      alive.add(f.id);
      // 같은 방 사람끼리 이름표가 겹치지 않게 짝수번째는 발밑, 홀수번째는 머리 위
      const nth = perRoom[f.room || 'yard'] = (perRoom[f.room || 'yard'] ?? -1) + 1;
      const o = ensureFig(f.id, f), a = areaOf(f);
      if (o.room !== f.room) { o.room = f.room; o.x = a.x0 + Math.random() * (a.x1 - a.x0); o.tx = null; }
      if (o.dragging) continue;
      const working = f.room && !f.hurt && G.raid?.path[G.raid.idx] !== f.room;
      if (o.wait > 0) o.wait -= dt;
      else if (o.tx == null) o.tx = a.x0 + Math.random() * (a.x1 - a.x0);
      else { const dx = o.tx - o.x, st = 0.03 * dt; if (Math.abs(dx) <= st) { o.x = o.tx; o.tx = null; o.wait = working ? 1400 + Math.random() * 2000 : 600 + Math.random() * 1600; } else o.x += Math.sign(dx) * st; }
      o.x = Math.max(a.x0, Math.min(a.x1, o.x));
      o.el.style.left = o.x + 'px'; o.el.style.top = (a.floor - 38) + 'px';
      o.el.classList.toggle('walk', o.tx != null && o.wait <= 0);
      o.el.classList.toggle('work', !!(working && o.tx == null));
      o.el.classList.toggle('hurt', !!f.hurt);
      o.el.classList.toggle('sel', G.sel === f.id); o.el.querySelector('.b').style.background = BODY[best(f)];
      o.el.querySelector('.nm').style.top = nth % 2 ? '-13px' : '39px';
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
      if (moved) { const b = world.getBoundingClientRect(); el.style.left = (e.clientX - b.left) + 'px'; el.style.top = (e.clientY - b.top - 30) + 'px'; }
    });
    const up = e => {
      if (e.pointerId !== pid) return; pid = null;
      const o = figs.get(id); el.classList.remove('drag');
      if (!moved) { selectFolk(id); return; }
      o.dragging = false;
      const b = world.getBoundingClientRect(), px = e.clientX - b.left, py = e.clientY - b.top;
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
  const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1);
  const DECOR={gate:'<div class="dec"></div><div class="banner-wolf"></div>',lumber:'<div class="dec"></div>',kitchen:'<div class="dec"></div>',forge:'<div class="dec"></div><div class="anvil"></div>',barracks:'<div class="dec"></div><div class="dummy"></div>',dorm:'<div class="dec"></div>',parlor:'<div class="dec"></div>',nursery:'<div class="cradle" id="cradle"></div>'};
  function layoutGeo(){
    const W=world.clientWidth,pad=10,gap=6,skyH=65,yardH=62,rowH=100,cw=(W-pad*2-gap*2)/3,top=skyH+yardH+10;
    const g={W,yard:{x:pad,y:skyH,w:W-pad*2,h:yardH},rooms:{},H:top+6*(rowH+gap)+8,wall:{x:pad-6,y:top-6,w:W-pad*2+12,h:6*(rowH+gap)+6}};
    for(const id of slots()){const r=G.rooms[id];if(r?.mergedInto)continue;g.rooms[id]={x:pad+(+id[3])*(cw+gap),y:top+(+id[1])*(rowH+gap),w:cw*(r?.size||1)+gap*((r?.size||1)-1),h:rowH};}
    return g;
  }
  let geometryKey='';
  function buildCastle(){
    geo=layoutGeo();world.style.height=geo.H+'px';world.querySelectorAll('.yard,.keepwall,.room').forEach(e=>e.remove());const y=geo.yard,w=geo.wall;
    world.insertAdjacentHTML('beforeend',`<div class="yard" style="left:${y.x}px;top:${y.y}px;width:${y.w}px;height:${y.h}px"><div class="tag">안뜰 · 대기</div></div><div class="keepwall" style="left:${w.x}px;top:${w.y}px;width:${w.w}px;height:${w.h}px"></div>`);
    for(const [id,r] of Object.entries(geo.rooms)){
      const type=typeOf(id),locked=!Sim.unlocked(G,id);
      world.insertAdjacentHTML('beforeend',`<div class="room ${type?'r-'+type:'empty'} ${locked?'locked':''}" role="button" tabindex="0" aria-label="${+id[1]+1}층 ${+id[3]+1}번 ${type?R[type].name:locked?'잠긴 방':'건설'}" data-s="${id}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px">${type?`<div class="light"></div>${DECOR[type]||''}<div class="floor"></div><div class="tag">${R[type].name}<span class="cap"></span></div><div class="out"></div>${R[type].res?'<div class="prog"><i></i></div>':''}`:`<div class="build"><div><b>${locked?'·':'＋'}</b>${locked?'영지 Lv'+id[1]:'짓기'}</div></div>`}</div>`);
    }
    world.querySelectorAll('.room').forEach(el=>{el.onclick=()=>tapSlot(el.dataset.s);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tapSlot(el.dataset.s);}};});sizeSnow();syncRooms();
  }
  function syncRooms(){
    if(!geo)return;
    const selected=G.folk.find(f=>f.id===G.sel);
    world.querySelectorAll('.room').forEach(el=>{const id=el.dataset.s,type=typeOf(id),r=G.rooms[id];el.classList.toggle('raid',G.raid?.path[G.raid.idx]===id);el.classList.toggle('fire',!!r?.fire);el.classList.toggle('can',!!selected&&!Sim.validate(G,{type:'assign',id:selected.id,slot:id}));if(!type)return;
      el.querySelector('.cap').textContent=`L${r.level} ${R[type].cap?at(id).length+'/'+Sim.capacity(G,id):''}`;
      el.querySelector('.out').textContent=r.fire?'화재 '+r.fire+'일':R[type].res?`+${rateOf(id).toFixed(1)}/일`:type==='dorm'?`정원 +${4*r.level*r.size}`:type==='storage'?`저장 +${160*r.level*r.size}`:'';
    });
    if($('cradle'))$('cradle').innerHTML=working(slotOf('nursery')).length?'<span class="zz">z z</span>':'<span class="cry">으앙!</span>';
    world.querySelectorAll('.raidbar').forEach(el=>el.remove());
    if(G.raid){const r=geo.rooms[G.raid.path[G.raid.idx]];world.insertAdjacentHTML('beforeend',`<div class="raidbar" style="left:${r.x+8}px;top:${r.y+39}px;width:${r.w-16}px"><i style="width:${100*G.raid.hp/G.raid.max}%"></i></div>`);}
  }
  function renderRoster(){
    $('roster').innerHTML=G.folk.map(f=>`<button class="btn person ${G.sel===f.id?'selected':''}" data-person="${f.id}" style="color:${BODY[best(f)]}">${f.name}${f.hurt?' +'+f.hurt+'일':f.away?' ↗':' L'+f.level}</button>`).join('');
    $('roster').querySelectorAll('button').forEach(b=>b.onclick=()=>selectFolk(b.dataset.person));
  }
  function renderPanel(){
    const f=G.folk.find(f=>f.id===G.sel);
    $('panel').innerHTML=f?`<div class="who"><b>${f.name}</b><button class="btn" id="detail">상세·무기</button><button class="btn" id="toYard">안뜰로</button></div><div class="stats3">힘 ${f.str} · 손재주 ${f.dex} · 마음 ${f.heart}</div><p class="hint">${f.hurt?'부상 '+f.hurt+'일':f.away?'정찰 중':'빛나는 방을 누르거나 끌어다 놓으세요.'}</p>`:'<p class="hint">사람을 끌어 방에 놓거나, 아래 이름 → 방을 누르세요.<br><span style="color:#B5652E">주황 힘</span> · <span style="color:#B89A3E">노랑 손재주</span> · <span style="color:#3F8A5E">초록 마음</span> / 방을 누르면 관리합니다.</p>';
    $('detail')?.addEventListener('click',()=>folkSheet(f.id));$('toYard')?.addEventListener('click',()=>assign(f.id,null));
  }
  function renderHud(){
    const d=Sim.daily(G),j=G.julian,next=K.raids.find(r=>r.day>G.day);
    $('date').textContent=`${G.year}년 · ${G.day===120?'연말':K.seasons[Sim.season(G)]+' '+(G.day%30+1)+'일'} · ${Math.min(120,G.day)}/120일`;
    $('estate').textContent=`영지 Lv${G.level} · 명성 ${G.xp}${G.level<5?'/'+K.balance.levelXP[G.level]:''} · ${G.level+1}/6층 개방${auto?' · 자동 플레이':''}`;
    $('speed').innerHTML=[[0,'❚❚'],[1,'1×'],[2,'2×'],[4,'4×']].map(([n,t])=>`<button data-sp="${n}" aria-label="${n?'속도 '+n+'배':'일시정지'}" class="${speed===n?'on':''}">${t}</button>`).join('');$('speed').querySelectorAll('button').forEach(b=>b.onclick=()=>setSpeed(+b.dataset.sp));
    $('res').innerHTML=['food','wood','gold'].map(key=>`<div class="pill">${ICON[key]}<b>${Math.floor(G.res[key])}</b><span class="${d[key]<0?'dn':'up'}">${{food:'식량',wood:'장작',gold:'금화'}[key]} ${fmt(d[key])}</span></div>`).join('')+`<div class="pill">${ICON.folk}<b>${G.folk.length}/${popCap()}</b><span>저장 ${Sim.storageCap(G)}</span></div>`;
    $('crib').innerHTML=`<img src="media/julian.webp" alt="율리안">${[['health','건강',j.health],['bond','애착',j.bond],['sus','의심',G.sus]].map(([k,n,v])=>`<div class="meter m-${k}">${n} ${Math.round(v)}<div class="t"><i style="width:${v}%"></i></div></div>`).join('')}`;
    $('banner').innerHTML=G.raid?`<div class="banner">${G.raid.name} · ${R[typeOf(G.raid.path[G.raid.idx])].name}에서 교전. 영지민을 이동시켜 막으세요.</div>`:next&&next.day-G.day<=3?`<div class="banner">${next.name} ${next.day-G.day}일 뒤. 성문과 무기를 준비하세요.</div>`:G.day<G.blizzardUntil?`<div class="banner cold">눈보라 · ${G.blizzardUntil-G.day}일 · 장작 소모 두 배</div>`:'';
    $('log').innerHTML=G.log.slice(0,4).map(t=>`<div>${esc(t)}</div>`).join('');
    if(saveFailed)feedback('자동 저장을 사용할 수 없습니다. 이 창에서는 계속 플레이할 수 있습니다.');
  }
  const lessons=['하인츠: 율리안의 요람을 비우지 마십시오. 초록 옷은 마음이 뛰어난 사람입니다.','하인츠: 영지민을 누른 다음 방을 누르거나, 사람을 끌어다 놓으십시오. 방 자체를 누르면 건설과 업그레이드가 보입니다.','하인츠: 여름에 식량과 장작을 쌓아 두십시오. 밭은 가을에 멈추고, 겨울 눈보라에는 장작이 두 배 듭니다.','하인츠: 습격 사흘 전에 알려 드리겠습니다. 성문에 힘센 사람과 무기를 준비하십시오. 정찰대가 떠나면 그만큼 성이 빕니다.'];
  function renderTutorial(){
    $('tutorial').innerHTML=tutorial<lessons.length?`<div class="tutorial">${tutorial+1}/4 · ${lessons[tutorial]}<br><button class="btn" id="tutorial-next">${tutorial===3?'시작하기':'다음'}</button> <button class="btn" id="tutorial-skip">건너뛰기</button></div>`:'';
    $('tutorial-next')?.addEventListener('click',()=>{tutorial++;store.set('north-keep-tutorial',tutorial);renderTutorial();});$('tutorial-skip')?.addEventListener('click',()=>{tutorial=4;store.set('north-keep-tutorial',tutorial);renderTutorial();});
  }
  function render(){const key=JSON.stringify([G.rooms,G.level,world.clientWidth]);if(key!==geometryKey){geometryKey=key;buildCastle();}renderHud();renderPanel();renderRoster();syncRooms();}
  function setSpeed(n){if([0,1,2,4].includes(n)){speed=n;renderHud();}return speed;}
  // 눈
  const snow = $('snow'), sctx = snow.getContext('2d'); let flakes = [];
  function sizeSnow() { const dpr = devicePixelRatio || 1; snow.width = world.clientWidth * dpr; snow.height = (geo?.H || 600) * dpr; sctx.setTransform(dpr, 0, 0, dpr, 0, 0); flakes = Array.from({ length: 70 }, () => ({ x: Math.random() * world.clientWidth, y: Math.random() * 160, s: 0.6 + Math.random() * 1.6, v: 0.01 + Math.random() * 0.03 })); }
  function drawSnow(dt) {
    const heavy = G && G.day < G.blizzardUntil;
    sctx.clearRect(0, 0, snow.width, snow.height); if (Sim.season(G)!==3) return; sctx.fillStyle = 'rgba(255,255,255,.8)';
    for (const f of flakes) { f.y += f.v * dt * (heavy ? 3 : 1); f.x += (heavy ? 0.06 : 0.01) * dt; if (f.y > 156) { f.y = -4; f.x = Math.random() * world.clientWidth; } if (f.x > world.clientWidth) f.x = 0; sctx.beginPath(); sctx.arc(f.x, f.y, f.s, 0, 7); sctx.fill(); }
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
  // 평균 정책의 명령을 실제 노출된 UI 컨트롤을 통해 실행한다.
  function clickAction(a){
    if(Sim.validate(G,a))return false;
    if(a.type==='assign'){
      $('roster').querySelector(`[data-person="${a.id}"]`)?.click();
      if(a.slot===null)$('toYard')?.click();else world.querySelector(`[data-s="${a.slot}"]`)?.click();return true;
    }
    if(['build','upgrade','merge','rush','extinguish'].includes(a.type))world.querySelector(`[data-s="${a.slot}"]`)?.click();
    if(a.type==='craft')world.querySelector(`[data-s="${slotOf('forge')}"]`)?.click();
    if(a.type==='equip'){$('roster').querySelector(`[data-person="${a.id}"]`)?.click();$('detail')?.click();}
    const target=[...$('modal').querySelectorAll('[data-action]')].find(b=>JSON.stringify(JSON.parse(b.dataset.action))===JSON.stringify(a));
    if(!target||target.disabled)return false;target.click();return true;
  }
  function clearNotices(){for(let i=0;i<16&&G.notices.length;i++){pump();if(!clickAction({type:'ack'}))break;}}
  function autoTurn(){
    $('tutorial-skip')?.click();
    if(showing&&!['notice','event','year'].includes(dialogKind)){$('modal').querySelector('[data-close]')?.click();}
    clearNotices();
    if(G.status==='yearEnd'){pump();auto=false;return;}
    // 사건 모달은 먼저 선택한 뒤 배치/건설한다.
    if(G.pending){const choice=window.KeepPolicy(G,'average').find(a=>a.type==='choice');if(choice)clickAction(choice);clearNotices();}
    for(const a of window.KeepPolicy(G,'average')){if(a.type==='choice'&&!G.pending)continue;clickAction(a);clearNotices();}
    if(!showing)advance();
  }
  function skipDays(n){
    n=Math.max(0,Math.min(600,Math.floor(Number(n)||0)));let count=0,guard=0;
    while(count<n&&G.status==='playing'&&guard++<n*35+40){const oldDay=G.elapsedDays,oldFail=G.failures;if(auto)autoTurn();else{if(showing)break;advance();}if(G.elapsedDays!==oldDay||G.failures!==oldFail)count++;if(!auto&&(G.pending||showing))break;}
    if(auto&&G.status==='yearEnd'){clearNotices();pump();}
    render();return JSON.parse(JSON.stringify(G));
  }
  window.__keep={state:()=>JSON.parse(JSON.stringify(G)),setSpeed,skipDays,autoplay(value){auto=!!value;autoAccumulator=0;renderHud();return auto;}};
  $('scout').onclick=scoutSheet;$('records').onclick=recordsSheet;$('help').onclick=()=>{sheet('하인츠의 안내',`<p>${lessons.join('\n\n')}</p><p>하루 15초 · 네 계절 각 30일. 일시정지와 2·4배속을 쓸 수 있습니다. 사건과 상세 화면을 열면 시간은 멈춥니다.<br>의심 100, 건강 0, 요람실 함락 시 계절 첫날로 돌아갑니다. 일반 영지민의 죽음은 그 계절을 되돌리지 않는 한 영구적입니다.</p>${closeButton()}`,'help');};
  let lastFrame=performance.now();
  function frame(now){
    const elapsed=Math.min(1000,now-lastFrame),dt=Math.min(60,elapsed);lastFrame=now;
    animate(dt);drawSnow(dt);
    if(auto){autoAccumulator+=elapsed;if(autoAccumulator>=100){autoAccumulator=0;autoTurn();}}
    else if(!showing&&tutorial>=4&&speed&&G.status==='playing'){
      if(G.raid){raidAcc+=elapsed*speed;if(raidAcc>=1100){raidAcc=0;advance();}}
      else{acc+=elapsed*speed;if(acc>=DAY_MS){acc-=DAY_MS;advance();}}
    }
    world.querySelectorAll('.prog i').forEach(i=>i.style.width=Math.min(100,acc/DAY_MS*100)+'%');requestAnimationFrame(frame);
  }
  addEventListener('resize',()=>{geometryKey='';render();});addEventListener('pagehide',save);
  renderTutorial();render();pump();requestAnimationFrame(frame);
})();
