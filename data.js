// 「그렌바흐 대공령」 데이터 — 엔진(index.html)과 분리.
// 능력치: str(힘) · dex(솜씨) · heart(마음), 1~10. 하루 = 엔진의 DAY_MS.
window.KEEP = {
  // 1년 = 봄·여름·가을·겨울 30일씩 120일. 해는 이어지고, 해마다 봄 1일에 황후궁 감찰단이 온다(첫 감찰은 G.day 120). 일정의 day는 해 안의 날
  totalDays: 120, seasons: ['봄', '여름', '가을', '겨울'], seasonDays: 30,
  coldBySeason: [1, 0, 1, 2], // 계절별 추위 = 하루 장작 소비. 눈보라면 balance.blizzardCold를 더한다
  blizzard: { day: 97, days: 12 }, // 겨울 8일부터 열이틀
  // 성에는 성문·응접실·요람실만 있다. 주방·벌목장은 플레이어가 짓는다 — 아무것도 안 하면 식량 10일·장작 30일(봄 추위 1) 뒤 바닥
  start: { food: 30, wood: 30, gold: 120 },
  popBase: 6,
  // 밸런스 변수 — 시스템 설계서의 기준 변수와 같은 이름. 값만 바꿔 조정한다
  balance: {
    vGold: 2,            // 금화 1의 식량 환산 가치 (상인 기준가)
    aptitude: 1.25,      // 적성(가장 높은 능력치 = 방 능력치) 배수
    upLv3: 1.5,          // Lv3 업그레이드 = 설치비 × 이 값 (Lv2는 ×1)
    buildDays: 2, upgradeDays: 3,
    scoutBonus: 0.15,    // 정찰 할증 = 1 + 이 값 × 일수
    ration: 2,           // 정찰 식량 선불 = 인원 × 0.5 × 일수 × 이 값
    injuryDays: 5,
    raidHpK: 1.5, raidAtk: 0.3, defK: 0.5, gateBonus: 6,
    xpBase: 20, xpExp: 2, hpBase: 90, hpPerLv: 10,
    weaponGoldPerP: 6, weaponWood: 5, durability: 3, armoryCap: 3, // 내구도 0이면 부서져 사라진다 (수리 없음)
    mBuy: 1.5, mSell: 0.5, // 상인이 한 번에 사 가는 양은 지갑(merchant.purse)으로 묶는다
    blizzardCold: 2,
    raidYearMult: 0.5,   // 습격 전투력 = n × h × (1 + 이 값 × (해 − 1)) — 2년째 1.5배
    deathDmg: 30,        // 쓰러진 채 이만큼 더 깎이면 죽는다
    // 의심: 하루 susBase 오르고 응접실 사람의 마음(적성 포함) × susParlor × 방 배수만큼 덜 오른다.
    // 0.6이면 요한나(마음 6 × 적성 1.25) 한 명으로 완전히 상쇄되어 감찰이 긴장이 없었다
    susBase: 0.8, susParlor: 0.08,
  },
  rooms: {
    gate:     { name: '성문', stat: 'str', cap: 3, fixed: true, desc: '습격을 막는다. 방어 = 성문·병영 사람의 힘(+무기 위력) + 성벽 보너스 6 + 엘레노어 통솔. 무기고 3자리' },
    lumber:   { name: '벌목장', stat: 'str', cap: 2, res: 'wood', rate: 0.5, cost: 40, desc: '장작 = 힘 × 0.5/일. 추위만큼 하루에 든다 (봄 1 · 여름 0 · 가을 1 · 겨울 2 · 눈보라 +2)' },
    kitchen:  { name: '주방', stat: 'dex', cap: 2, res: 'food', rate: 0.5, cost: 40, desc: '식량 = 솜씨 × 0.5/일. 영지민 1명이 하루 0.5씩 먹는다' },
    forge:    { name: '대장간', stat: 'dex', cap: 2, res: 'gold', rate: 0.35, cost: 60, desc: '금화 = 솜씨 × 0.35/일. 금화·장작·하루 노동으로 무기를 벼린다' },
    barracks: { name: '병영', stat: 'str', cap: 3, train: true, cost: 70, desc: '머무는 동안 경험치 +3/일 (일하는 방은 +1). 습격 때 성문에서 함께 싸운다' },
    dorm:     { name: '숙소', cap: 3, pop: 4, cost: 50, desc: '영지민 정원 +4. 여기서 쉬면 체력 +15/일 (안뜰은 +6, 일하는 방은 0)' },
    parlor:   { name: '응접실', stat: 'heart', cap: 1, fixed: true, desc: '레오폴트를 상대한다. 마음이 높을수록 의심이 덜 쌓인다' },
    nursery:  { name: '요람실', stat: 'heart', cap: 2, fixed: true, desc: '율리안. 비면 건강이 떨어진다. 감찰 수색 때 여기 사람의 마음이 숨기기 점수가 된다' },
  },
  // 4층 × 3칸
  layout: [
    ['gate', null, null],
    ['parlor', null, null],
    [null, null, null],
    [null, null, 'nursery'],
  ],
  folk: [
    { id: 'eleanor', name: '엘레노어', role: '대공', str: 8, dex: 3, heart: 2, lead: 4, wit: 3, room: 'r0c0', hero: true, img: 'media/eleanor.webp' },
    { id: 'johanna', name: '요한나', role: '유모', str: 2, dex: 3, heart: 6, room: 'r3c2' },
    { id: 'bernhard', name: '베른하르트', role: '시종장', str: 2, dex: 4, heart: 6, room: 'r1c0' }, // 응접실 담당 · 튜토리얼 안내
    { id: 'heinz',   name: '하인츠', role: '경비대장', str: 6, dex: 2, heart: 1, room: 'r0c0' },
    { id: 'bruno',   name: '브루노', role: '나무꾼', str: 5, dex: 2, heart: 2, room: null },
    { id: 'liesel',  name: '리젤', role: '요리사', str: 1, dex: 6, heart: 3, room: null },
  ],
  // 습격대 = 병력 n × 개체 힘 h. 전투력 F = n × h, 체력 = F × raidHpK, 공격/틱 = F × raidAtk
  // 시작 배치 그대로(방어 27.5)면 2차는 버티고 3차(여름 26일, G.day 55 · 전투력 64)에 진다 — 주방·벌목장만 짓고 방치해도 첫 여름을 못 넘긴다.
  // 한 파도마다 방어 +10쯤 키워야 따라간다
  raids: [
    { day: 20, n: 2, h: 6, name: '호르칸 척후대' },
    { day: 34, n: 4, h: 7, name: '호르칸 약탈대' },
    { day: 55, n: 8, h: 8, name: '호르칸 기마대' },
    { day: 78, n: 7, h: 10, name: '얼음강을 건넌 기마대' },
    { day: 100, n: 9, h: 10, name: '눈보라 속의 대족장' },
    { day: 115, n: 11, h: 10, name: '호르칸 연합군' },
  ],
  refugeeDays: [24, 44, 64, 84, 104],
  refugees: [
    { name: '마르타', role: '피난민 과부', str: 2, dex: 5, heart: 5 },
    { name: '클라우스', role: '탈영병', str: 6, dex: 3, heart: 1 },
    { name: '엘제', role: '수녀원 견습', str: 1, dex: 3, heart: 8 },
    { name: '프리츠', role: '떠돌이 대장장이', str: 4, dex: 7, heart: 2 },
    { name: '안나', role: '양치기', str: 3, dex: 4, heart: 5 },
  ],
  captives: [
    { name: '토르그', role: '호르칸 포로', str: 7, dex: 2, heart: 1 },
    { name: '아실', role: '호르칸 포로', str: 6, dex: 4, heart: 2 },
    { name: '케넥', role: '호르칸 소년병', str: 4, dex: 3, heart: 4 },
    { name: '바르가', role: '호르칸 여전사', str: 8, dex: 2, heart: 2 },
  ],
  // 정찰지: days 걸리는 날, risk 추위 0일 때 한 사람당 다칠 확률(추위 1마다 +3%p), find 사람을 데려올 확률.
  // 보상 금화 = 인원 × 평균 힘 × 일수 × 대장간 금화율 × (1 + scoutBonus × 일수)
  scouts: [
    { id: 'forest', name: '숲 가장자리', days: 2, risk: 0.06, find: 0.2 },
    { id: 'foot', name: '산기슭', days: 5, risk: 0.19, find: 0.5 },
    { id: 'river', name: '얼음강', days: 8, risk: 0.34, find: 0.8 },
  ],
  weapons: [
    { id: 'knife', name: '단검', power: 3 },
    { id: 'spear', name: '창', power: 6 },
    { id: 'sword', name: '장검', power: 10 },
  ],
  merchant: { days: [9, 29, 49, 69, 89, 109], stay: 3, qty: 20, purse: 20 }, // 10·30일에 와서 3일 머문다. purse = 한 번 방문에 쓰는 금화
  // 국경 성 방문(가을 8일)에 가면 겨울 1일(G.day 90)에 합류한다 — 정원을 넘겨도 온다
  knights: [
    { name: '아른트', role: '베르크 기사', str: 8, dex: 3, heart: 2 },
    { name: '테오', role: '베르크 기사', str: 7, dex: 4, heart: 3 },
  ],
  wanderers: [
    { name: '그레타', role: '빵 굽는 이', str: 2, dex: 7, heart: 3, line: '눈 덮인 방앗간에서 혼자 버티고 있었다. "밀가루만 있으면 뭐든 굽죠."' },
    { name: '에밀', role: '사냥꾼', str: 5, dex: 4, heart: 2, line: '덫을 보러 나왔다가 정찰대와 마주쳤다. 활은 낡았지만 손은 빠르다.' },
    { name: '로자', role: '농부', str: 5, dex: 3, heart: 4, line: '불탄 마을에서 살아남았다. 호르칸 이야기를 하면 입을 다문다.' },
    { name: '파울', role: '석공', str: 7, dex: 3, heart: 1, line: '무너진 망루 아래서 끌어냈다. "성벽이라면 내가 쌓아 봤소."' },
    { name: '레나', role: '행상', str: 3, dex: 5, heart: 6, line: '짐수레가 눈에 빠져 있었다. 말이 많고, 사람을 잘 달랜다.' },
    { name: '한스', role: '숯꾼', str: 6, dex: 3, heart: 1, line: '숲속 숯가마 옆에서 얼어 가고 있었다.' },
    { name: '이다', role: '바느질장이', str: 2, dex: 6, heart: 5, line: '수녀원으로 가던 길이었다고 한다. 아이 옷을 기울 줄 안다.' },
    { name: '오토', role: '짐꾼', str: 7, dex: 2, heart: 2, line: '얼음강을 건너다 발이 빠졌다. 혼자 통나무 두 개를 진다.' },
  ],
  milestones: [
    [25, '첫 뒤집기', '율리안이 혼자 몸을 뒤집었다. 목소리만 듣고도 고개부터 돌린다.'],
    [45, '첫 이', '율리안이 손가락을 깨물었다. 잇몸 사이로 하얀 것이 만져진다. "…늑대 새끼 맞네."'],
    [65, '첫걸음', '요한나의 손을 놓은 율리안이 세 걸음을 걸어 당신의 무릎에 부딪혔다.'],
    [85, '첫말', '"…바바. 엄, 마." — "…이러면 반칙이지."'],
  ],
};
