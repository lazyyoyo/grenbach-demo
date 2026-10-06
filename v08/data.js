// 수치와 콘텐츠의 단일 출처. 브라우저와 Node가 같은 데이터를 사용한다.
(function (root, factory) {
  const data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.KEEP = data;
})(typeof window === 'undefined' ? globalThis : window, () => {
  const rooms = {
    gate: { name: '성문', stat: 'str', cap: 3, fixed: true, cost: 50, desc: '첫 방어선. 레벨마다 성벽 방어 +6.' },
    parlor: { name: '응접실', stat: 'heart', cap: 2, fixed: true, cost: 40, desc: '마음 × 0.08만큼 하루 의심을 낮춘다.' },
    nursery: { name: '요람실', stat: 'heart', cap: 2, fixed: true, cost: 50, desc: '마음으로 건강과 애착을 돌본다. 마지막 방어선.' },
    kitchen: { name: '주방', stat: 'dex', cap: 2, res: 'food', cost: 40, desc: '손재주만큼 매일 식량을 만든다.' },
    lumber: { name: '벌목장', stat: 'str', cap: 2, res: 'wood', cost: 40, desc: '힘만큼 장작을 모은다. 겨울 전에 비축하자.' },
    field: { name: '밭', stat: 'str', cap: 2, res: 'food', cost: 30, desc: '봄·여름에만 힘만큼 식량을 생산한다.' },
    forge: { name: '대장간', stat: 'dex', cap: 2, cost: 55, desc: '장인이 일하는 방. 아이가 오래 머물면 다칠 수 있다.' },
    dorm: { name: '숙소(휴식)', cap: 4, pop: 4, cost: 45, desc: '칸수 × 레벨마다 영지민 정원 +4.' },
    storage: { name: '창고', cap: 0, storage: 160, cost: 40, desc: '칸수 × 레벨마다 식량·장작 저장 한도 +160.' },
    barracks: { name: '병영', stat: 'str', cap: 3, cost: 60, desc: '10일마다 힘 +2. 성문 방어에 절반의 힘을 보탠다.' },
  };
  const traits = {
    northern: { name: '북부 태생', desc: '추위 피해 절반.', cold: .5 },
    lullaby: { name: '자장가 장인', desc: '돌봄 애착 효과 ×1.5.', bond: 1.5 },
    steady: { name: '침착함', desc: '재촉 실패율 −5%p.', rush: -.05 },
    gossip: { name: '입이 가벼움', desc: '응접실에서 하루 의심 +0.7.', suspicion: .7 },
    cook: { name: '알뜰한 요리사', desc: '주방 생산 +15%.', room: 'kitchen', production: 1.15 },
    logger: { name: '숲의 일꾼', desc: '벌목장 생산 +15%.', room: 'lumber', production: 1.15 },
    brave: { name: '담대한 수비수', desc: '전투 방어 +3.', defense: 3 },
    frail: { name: '허약함', desc: '받는 피해 +20%.', damage: 1.2 },
    scout: { name: '길잡이', desc: '함께 떠난 정찰 부상 확률 −10%p.', scout: -.1 },
    smith: { name: '대장장이', desc: '대장간 생산 +15%.', room: 'forge', production: 1.15 },
    hungry: { name: '대식가', desc: '하루 식량 소모 +0.3.', food: .3 },
    warm: { name: '다정한 손길', desc: '요람실 건강 회복 +0.5.', care: .5 },
  };
  const folk = [
    ['eleanor','엘레노어','대공',8,3,4,'brave','r0c1',true,'media/eleanor.webp'],
    ['ottilie','오틸리에','옛 유모',1,4,10,'lullaby','r1c3',true,'media/ottilie.webp'],
    ['johanna','요한나','젖어미',2,5,7,'warm','r1c1',true],
    ['heinz','하인츠','경비대장',8,2,2,'northern','r0c1',true],
    ['bruno','브루노','나무꾼',5,2,2,'logger','r0c2'],
    ['liesel','리젤','요리사',1,6,3,'cook','r0c3'],
    ['marta','마르타','직조공',2,5,5,'steady'],['klaus','클라우스','길 잃은 병사',6,3,2,'brave'],
    ['else','엘제','약초꾼',1,3,8,'frail'],['fritz','프리츠','대장장이',4,7,2,'smith'],
    ['anna','안나','양치기',3,4,5,'scout'],['otto','오토','짐꾼',7,2,2,'hungry'],
    ['greta','그레타','빵 굽는 이',2,7,3,'cook'],['hans','한스','숯꾼',6,3,1,'logger'],
    ['ida','이다','바느질장이',2,6,5,'gossip'],['emil','에밀','사냥꾼',5,4,2,'scout'],
    ['rosa','로자','농부',5,3,4,'northern'],['paul','파울','석공',7,3,1,'steady'],
    ['lena','레나','행상',3,5,6,'warm'],['theo','테오','견습',4,4,4,'frail'],
  ].map(([id,name,role,str,dex,heart,trait,room=null,named=false,img]) => ({id,name,role,str,dex,heart,trait,room,named,img,hero:id==='eleanor',wis:({eleanor:7,ottilie:6,johanna:5,heinz:3}[id]||1+(str+dex+heart)%10),status:named?'가신':'영지민'}));
  const choice = (label, fx = {}, cost = {}, extra = {}) => ({label,fx,cost,...extra});
  const events = [
    ...['문 앞의 가족','눈 녹은 길의 손님','갈 곳 없는 장인','마지막 마차'].map((title,i) => ({id:`refugee${i}`,kind:'refugee',day:[6,36,68,94][i],title,text:'성문 밖에 사람이 기다린다. 빈 잠자리가 있다면 함께 겨울을 날 수 있다.',choices:[choice('식량 8을 나누고 맞는다',{satisfaction:3},{food:8},{recruit:true}),choice('길에 쓸 식량만 준다',{xp:2},{food:3}),choice('문을 닫는다',{satisfaction:-3})]})),
    ...['소금 장수','장작 수레','겨울 비축상'].map((title,i) => ({id:`merchant${i}`,kind:'merchant',day:[12,48,85][i],title,text:'상인이 마당에 짐을 풀었다. 봄의 값은 겨울에도 같지 않다.',choices:[choice('식량 40을 산다',{food:40},{gold:16}),choice('장작 50을 산다',{wood:50},{gold:18}),choice('식량 30을 판다',{gold:12},{food:30}),choice('장작 30을 판다',{gold:10},{wood:30}),choice('다음을 기약한다')]})),
    ...['여름 감찰','겨울 감찰'].map((title,i) => ({id:`inspection${i}`,kind:'inspection',day:[45,105][i],title,text:'감찰관은 방 사이의 거리를 재고 인구 대장을 펼친다. 요람실과 응접실이 맞닿아 있으면 의심이 15 오른다.',choices:[choice('정돈한 장부를 내민다',{sus:-8},{gold:15}),choice('있는 그대로 답한다',{sus:8})]})),
    ...[
      ['새 도끼',10,'벌목꾼이 닳은 도끼날을 내민다.',{wood:18}],
      ['따뜻한 식사',21,'함께 먹을 수 있는 저녁을 청한다.',{satisfaction:12}],
      ['찢어진 이불',33,'아침마다 잠자리가 차갑다고 한다.',{satisfaction:8,health:3}],
      ['경비 교대',55,'경비대가 잠시 쉴 시간을 원한다.',{satisfaction:10}],
      ['아이의 장갑',64,'작은 장갑 한 짝이 식탁 위에 놓였다.',{bond:6}],
      ['무딘 망치',77,'대장간의 망치에 금이 갔다.',{gold:22}],
      ['고향의 노래',98,'누군가 오래된 노래를 기억해 냈다.',{bond:8,satisfaction:8}],
      ['빈 의자',112,'돌아오지 못한 이들을 위해 식사를 차리자고 한다.',{satisfaction:12}],
    ].map(([title,day,text,fx],i) => ({id:`request${i}`,kind:'request',day,title,text,choices:[choice('청을 들어준다',fx,{food:5,gold:5}),choice('이번에는 미룬다',{satisfaction:-4})]})),
    ...[['봄의 종자',3,{food:20}],['가을의 창고',73,{wood:25}],['긴 밤의 등불',92,{health:6}]].map(([title,day,fx],i) => ({id:`season${i}`,kind:'season',day,title,text:'계절이 바뀌면 성 안의 일도 달라진다. 오늘 할 일을 미리 정해 두자.',choices:[choice('함께 준비한다',fx,{gold:8}),choice('지금은 아껴 둔다')]})),
  ].sort((a,b) => a.day-b.day);
  return {
    version: 6, totalDays:840, dayMs:4000, seasons:['봄','여름','가을','겨울'],
    balance:{start:{food:45,wood:40,gold:110},popBase:6,storageBase:150,foodPerPerson:.65,
      woodUse:[1,.5,2,4],levelXP:[0,25,65,120,190],levelMult:[1,1.5,2],lessonRate:.35,
      raidHP:2.0,raidBonus:[4,0,20,38],raidVariance:.45,raidDamage:.6,bossBonus:24,defenseScale:1.60,
      v08:{raidBase:.94,raidYear:.015,raidBonus:[4,0,20,38],bossBonus:24,
        southBase:.6,southScale:.6,reinforcements:{berg:14,licht:7},
        showSuspicion:12,abroadAssassin:2,kidnapRate:.04},
      yearScale:.18,healthWithoutCare:5,starvationDamage:5,coldDamage:4,taxPerPerson:5},
    rooms,traits,folk,events,
    growth:['갓난아기','뒤집기','기어가기','붙잡고 서기','첫걸음'],
    registries:{
      eleanor:{name:'엘레노어의 친자',bond:1.3,sus:0,inspection:10,seeds:{str:2,dex:3,heart:6},desc:'애착 ×1.3 · 감찰 의심 +10 · 마음·지혜의 씨앗'},
      heinz:{name:'하인츠의 아들',bond:1,sus:0,inspection:0,seeds:{str:6,dex:3,heart:3},desc:'힘 씨앗 · 병영이 요람실 옆이면 건강 +0.5/일'},
      johanna:{name:'요한나 부부의 아이',bond:.8,sus:-10,inspection:0,seeds:{str:3,dex:6,heart:4},desc:'의심 −10 · 만족도 +8 · 애착 ×0.8'},
      ottilie:{name:'오틸리에의 손주',bond:1,sus:0,inspection:0,seeds:{str:2,dex:4,heart:7},desc:'마음 씨앗 · 레오폴트 방문 의심 +5'}
    },
    neighbors:{rosental:{name:'로젠탈 백작령',direction:'남 · 곡창 · 중립',envoy:'아델하이트',benefit:'계절마다 식량 +35'},eisenberg:{name:'아이젠베르크 남작령',direction:'동 · 광산 · 황후파',envoy:'디트리히',benefit:'무기 구매·제작 금화 20% 할인'},halden:{name:'할던 수도원령',direction:'서 · 교회',envoy:'수사 안셀름',benefit:'감찰 의심 −15'},berg:{name:'베르크 기사령',direction:'북서 · 국경 동지',envoy:'기사 루트거',benefit:'성문 방어 +25'}},
    items:{herb:{name:'말린 약초',cost:12,fx:{health:12}},blanket:{name:'모직 담요',cost:15,fx:{health:3,satisfaction:8}}},
    objectives:[['밭 건설·씨 뿌리기','피난민 맞이','율리안 첫 진찰'],['식량 100 비축','행상 거래','감찰 전 호적 결정'],['장작 100 비축','성문 Lv2 강화','가을 습격 2회 막기'],['장작 30 이상 유지','대족장 습격 막기','율리안 첫걸음']],
    layout:[[null,'gate','lumber','kitchen',null],[null,'parlor',null,'nursery',null],...Array.from({length:4},()=>Array(5).fill(null))],
    raids:[{day:18,name:'호르칸 척후대'},{day:69,name:'호르칸 약탈대'},{day:83,name:'호르칸 기마대'},{day:97,name:'설원의 기마대'},{day:109,name:'얼음강의 기마대'},{day:119,name:'호르칸 대족장',boss:true}],
    weapons:[{id:'knife',name:'철제 단검',power:3,cost:18,level:1},{id:'spear',name:'장창',power:6,cost:32,level:2},{id:'sword',name:'북부 장검',power:10,cost:50,level:3},{id:'bow',name:'사냥활',power:4,scout:true},{id:'axe',name:'산악 도끼',power:7,scout:true},{id:'relic',name:'얼음강의 검',power:12,scout:true}],
    scouts:[{id:'forest',name:'숲 가장자리',days:2,risk:.12,food:16,gold:12,weapon:'bow'},{id:'mountain',name:'산기슭',days:5,risk:.25,food:35,gold:30,weapon:'axe'},{id:'river',name:'얼음강',days:8,risk:.4,food:55,gold:55,weapon:'relic'}],
    milestones:[['처음 잡은 손','작은 손가락이 당신의 손을 꼭 쥔다.'],['첫 뒤집기','창가의 빛을 향해 혼자 몸을 돌렸다.'],['첫 이','웃는 입 사이에 하얀 이가 보인다.'],['첫걸음','두 손을 놓고, 당신을 향해 한 걸음.']],
    cutscenes:{
      start:{title:'북부에 온 작은 봄',img:'media/basket.webp',lines:['눈이 녹기 전에 아이가 성에 왔다.','엘레노어: 이곳에는 빈 방이 있어요.','오틸리에: 따뜻한 손도 필요하지요.','성문 너머에서 새 계절이 시작된다.']},
      raid:{title:'성문 너머의 발굽',img:'media/guardhouse.webp',lines:['능선 위로 검은 깃발이 보였다.','하인츠: 성문은 제가 지킵니다.','엘레노어: 요람의 불은 꺼뜨리지 마세요.']},
      winter:{title:'북부의 긴 밤',img:'media/swaddle.webp',lines:['첫눈이 창틀을 덮었다.','오틸리에: 여름에 쌓은 것이 우리를 지켜 주겠지요.','엘레노어: 봄까지, 함께 있어요.']},
      year:{title:'대장에 남은 이름',img:'media/julian.webp',lines:['인구 대장에 한 해의 이름을 적었다.','하인츠: 이만큼의 사람이 겨울을 건넜습니다.','아이의 작은 손이 새 장을 넘긴다.','다시 봄이다.']},
    },
  };
});
