// 「그렌바흐 변경성」 데이터 — 엔진(index.html)과 분리.
// 능력치: str(힘) · dex(손재주) · heart(마음), 1~10. 하루 = 엔진의 DAY_MS.
window.KEEP = {
  totalDays: 134, // 11월 1일 → 3월 15일(인구 대장 제출일)
  start: { food: 30, wood: 30, gold: 80 },
  popBase: 6,
  rooms: {
    gate:     { name: '성문', stat: 'str', cap: 3, fixed: true, desc: '습격을 가장 먼저 막는다. 성벽 보너스 +6' },
    lumber:   { name: '벌목장', stat: 'str', cap: 2, res: 'wood', rate: 0.5, cost: 40, desc: '장작. 겨울 내내 성을 데운다' },
    kitchen:  { name: '주방', stat: 'dex', cap: 2, res: 'food', rate: 0.5, cost: 40, desc: '식량. 영지민 1명이 하루 0.5씩 먹는다' },
    forge:    { name: '대장간', stat: 'dex', cap: 2, res: 'gold', rate: 0.35, cost: 60, desc: '금화. 방을 짓고 무기를 벼린다' },
    barracks: { name: '병영', stat: 'str', cap: 3, train: true, cost: 70, desc: '머무는 동안 힘이 오른다. 습격 때 함께 싸운다' },
    dorm:     { name: '숙소', cap: 0, pop: 4, cost: 50, desc: '영지민 정원 +4' },
    parlor:   { name: '응접실', stat: 'heart', cap: 1, fixed: true, desc: '레오폴트를 상대한다. 마음이 높을수록 의심이 덜 쌓인다' },
    nursery:  { name: '요람실', stat: 'heart', cap: 2, fixed: true, desc: '율리안. 비면 건강이 떨어진다. 습격의 마지막 목표' },
  },
  // 4층 × 3칸. 습격은 위층 왼쪽부터 차례로 내려온다 — 요람실이 맨 마지막.
  layout: [
    ['gate', 'lumber', 'kitchen'],
    ['parlor', null, null],
    [null, null, null],
    [null, null, 'nursery'],
  ],
  folk: [
    { id: 'eleanor', name: '엘레노어', role: '변경백', str: 8, dex: 3, heart: 2, room: 'r0c0', hero: true, img: 'media/eleanor.webp' },
    { id: 'ottilie', name: '오틸리에', role: '옛 유모', str: 1, dex: 4, heart: 7, room: 'r3c2', img: 'media/ottilie.webp' },
    { id: 'johanna', name: '요한나', role: '젖어미', str: 2, dex: 3, heart: 6, room: 'r1c0' },
    { id: 'heinz',   name: '하인츠', role: '경비대장', str: 6, dex: 2, heart: 1, room: 'r0c0' },
    { id: 'bruno',   name: '브루노', role: '나무꾼', str: 5, dex: 2, heart: 2, room: 'r0c1' },
    { id: 'liesel',  name: '리젤', role: '요리사', str: 1, dex: 6, heart: 3, room: 'r0c2' },
  ],
  raids: [ // day: 도착일, hp: 기마대 체력, warn: 며칠 전 경보
    { day: 14, hp: 18, name: '호르칸 척후대' },
    { day: 34, hp: 30, name: '호르칸 약탈대' },
    { day: 55, hp: 45, name: '호르칸 기마대' },
    { day: 78, hp: 60, name: '얼음강을 건넌 기마대' },
    { day: 100, hp: 80, name: '눈보라 속의 대족장' },
    { day: 122, hp: 105, name: '호르칸 연합군' },
  ],
  refugeeDays: [20, 47, 66, 88, 110],
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
  milestones: [
    [25, '첫 뒤집기', '율리안이 혼자 몸을 뒤집었다. 목소리만 듣고도 고개부터 돌린다.'],
    [45, '첫 이', '율리안이 손가락을 깨물었다. 잇몸 사이로 하얀 것이 만져진다. "…늑대 새끼 맞네."'],
    [65, '첫걸음', '오틸리에의 손을 놓은 율리안이 세 걸음을 걸어 당신의 무릎에 부딪혔다.'],
    [85, '첫말', '"…바바. 엄, 마." — "…이러면 반칙이지."'],
  ],
};
