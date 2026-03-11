// ===== 게임 상태 =====
const STATIONS = ['강남', '교대', '서초', '방배', '사당', '낙성대', '서울대입구', '신림'];
const TRANSFER_STATIONS = ['교대', '사당'];

let state = {};

function initState() {
  state = {
    hp: 100,
    mental: 100,
    moral: 50,
    turn: 0,
    stationIdx: 0,
    usedEvents: [],
    gameOver: false,
    currentEvent: null,
  };
}

// ===== 이벤트 풀 =====
const EVENTS = [
  {
    id: 1,
    title: '할머니의 레이저 눈빛',
    emoji: '👵',
    description: '할머니 한 분이 당신의 자리를 노려보고 있다.\n눈빛이 레이저처럼 강렬하다.\n"요즘 젊은 것들은..."이라는 소리가 들리는 것 같다.',
    choices: [
      { text: '😇 자리를 양보한다', effects: { hp: -5, mental: -5, moral: 15 }, resultText: '할머니가 "고맙다 젊은이~"라며 앉으셨다. 다리가 아프지만 마음은 편하다.' },
      { text: '📱 폰만 보며 모른 척한다', effects: { hp: 0, mental: -10, moral: -10 }, resultText: '할머니의 한숨 소리가 귓가에 맴돈다. 죄책감이 밀려온다...' },
      { text: '🏃 슬쩍 다른 칸으로 이동한다', effects: { hp: -10, mental: 0, moral: -5 }, resultText: '사람들 사이를 비집고 옆 칸으로 도망쳤다. 체력만 소모됐다.' },
    ],
  },
  {
    id: 2,
    title: '인간 베개 사건',
    emoji: '😴',
    description: '옆 사람이 서서히 당신의 어깨에 기대서 잠들기 시작했다.\n침까지 흘리고 있다.\n심지어 코까지 골기 시작한다.',
    choices: [
      { text: '🤝 그냥 어깨를 빌려준다', effects: { hp: -5, mental: -10, moral: 10 }, resultText: '어깨가 저리지만... 이 사람도 힘든 하루였겠지. 당신은 인간 베개가 되었다.' },
      { text: '💪 어깨를 세게 움직여서 깨운다', effects: { hp: 0, mental: 5, moral: -5 }, resultText: '"엇, 죄송합니다!" 옆 사람이 화들짝 놀라며 일어났다. 좀 미안하지만 편하다.' },
      { text: '📸 셀카를 찍어서 보여준다', effects: { hp: 0, mental: 10, moral: -5 }, resultText: '옆 사람이 자기 사진을 보고 충격받아서 반대편으로 도망갔다. 승리!' },
    ],
  },
  {
    id: 3,
    title: '취객의 등장',
    emoji: '🍺',
    description: '"야!! 너 어디서 많이 봤다!!"\n취객 한 명이 당신에게 시비를 걸고 있다.\n소주 냄새가 진동하고 눈이 풀려 있다.',
    choices: [
      { text: '🙏 "네 형님, 제가 잘못했습니다"', effects: { hp: 0, mental: -15, moral: 5 }, resultText: '취객이 "그래 잘 알았어~"라며 다른 타겟을 찾아 떠났다. 멘탈이 흔들린다.' },
      { text: '😤 "저 모르는 분인데요?"라고 쏘아붙인다', effects: { hp: -15, mental: 5, moral: 0 }, resultText: '취객이 화가 나서 당신의 가방을 밟았다. 아... 새 가방이었는데.' },
      { text: '🎧 에어팟을 꽂고 무시한다', effects: { hp: 0, mental: -5, moral: 0 }, resultText: '취객이 무시당한 것도 모르고 혼자 중얼거리다 잠들었다. 위기 모면!' },
    ],
  },
  {
    id: 4,
    title: '치킨 테러',
    emoji: '🍗',
    description: '누군가 지하철에서 치킨을 먹기 시작했다.\n양념치킨의 향기가 객차 전체에 퍼진다.\n배에서 꼬르륵 소리가 난다.',
    choices: [
      { text: '🤤 침을 삼키며 참는다', effects: { hp: -5, mental: -15, moral: 0 }, resultText: '배고픔과 냄새의 이중고... 저녁을 아직 못 먹었다는 사실이 떠오른다.' },
      { text: '🗣️ "여기서 치킨을 드시면..."이라고 말한다', effects: { hp: 0, mental: -5, moral: 10 }, resultText: '"아 죄송~" 치킨 주인이 봉투를 닫았다. 하지만 냄새는 이미 퍼졌다...' },
      { text: '💰 "한 조각만 주세요"라고 한다', effects: { hp: 10, mental: 10, moral: -10 }, resultText: '놀랍게도 치킨 주인이 닭다리를 줬다! 맛있다! 하지만 도덕은 어디로...' },
    ],
  },
  {
    id: 5,
    title: '무한 지연 안내',
    emoji: '📢',
    description: '"승객 여러분께 안내 말씀 드립니다.\n앞선 열차의 지연으로 잠시 정차하겠습니다."\n...이게 오늘 세 번째다.',
    choices: [
      { text: '😤 한숨을 깊이 쉰다', effects: { hp: 0, mental: -15, moral: 0 }, resultText: '한숨을 쉬었지만 열차는 꿈쩍도 안 한다. 시간만 흘러간다...' },
      { text: '📱 SNS에 2호선 욕을 쓴다', effects: { hp: 0, mental: 5, moral: -5 }, resultText: '"2호선 ㅅㅂ" 좋아요 37개. 현타가 온다.' },
      { text: '🧘 명상을 시작한다', effects: { hp: 5, mental: 10, moral: 5 }, resultText: '옴... 평화... 잠깐 명상했더니 오히려 개운하다. 역시 마음의 수양이다.' },
    ],
  },
  {
    id: 6,
    title: '커플 애정행각',
    emoji: '💑',
    description: '바로 앞에서 커플이 애정행각을 벌이고 있다.\n눈을 어디에 둬야 할지 모르겠다.\n주변 승객들의 눈빛도 불편하다.',
    choices: [
      { text: '🙈 고개를 돌리고 창밖을 본다', effects: { hp: 0, mental: -10, moral: 0 }, resultText: '지하철이라 창밖은 깜깜하다. 유리에 비친 커플이 보인다. 어딜 봐도 지옥...' },
      { text: '😏 커플 사이에 서서 공간을 차지한다', effects: { hp: -5, mental: 10, moral: -10 }, resultText: '커플이 기겁하며 떨어졌다. 주변 승객들의 무언의 박수가 느껴진다.' },
      { text: '📱 일부러 큰 소리로 전화하는 척한다', effects: { hp: 0, mental: 5, moral: -5 }, resultText: '"여보세요? 네! 네!! 아 진짜요?!" 커플이 귀찮아서 옆 칸으로 갔다.' },
    ],
  },
  {
    id: 7,
    title: '아줌마 통화 대전',
    emoji: '📱',
    description: '아줌마 단체가 각자 다른 사람과 동시에 전화통화를 하고 있다.\n"거기 김 여사? 나야 나!"\n"아니 그래서 그 집이 얼마래?"\n3중 스테레오 사운드.',
    choices: [
      { text: '🎧 노이즈캔슬링을 최대로 올린다', effects: { hp: 0, mental: -5, moral: 0 }, resultText: '노이즈캔슬링으로도 뚫고 오는 아줌마들의 성량... 기술의 한계를 느꼈다.' },
      { text: '🗣️ "조금만 작게 통화해주세요"', effects: { hp: 0, mental: -10, moral: 10 }, resultText: '"에이~ 젊은 사람이 그것도 못 참아?" 역으로 혼났다. 현실은 냉혹하다.' },
      { text: '🎵 이어폰 없이 유튜브를 튼다', effects: { hp: 0, mental: 10, moral: -15 }, resultText: '아줌마들이 기겁했다. 하지만 당신도 민폐의 일원이 되었다...' },
    ],
  },
  {
    id: 8,
    title: '등산 탱크의 습격',
    emoji: '🎒',
    description: '거대한 등산 배낭을 멘 아저씨가 몸을 돌릴 때마다\n배낭으로 주변 사람들을 쓸어버린다.\n이것은 인간이 아니라 탱크다.',
    choices: [
      { text: '🛡️ 가방으로 방어한다', effects: { hp: -10, mental: -5, moral: 0 }, resultText: '배낭 vs 배낭 전투... 하지만 등산 배낭의 무게는 차원이 달랐다. 패배.' },
      { text: '🗣️ "배낭 좀 내려놓으시죠"', effects: { hp: 0, mental: -5, moral: 10 }, resultText: '"아 미안미안~" 배낭을 내렸다. 하지만 이미 3명이 피해를 입은 후다.' },
      { text: '🏃 재빨리 뒤로 빠진다', effects: { hp: -5, mental: 0, moral: 0 }, resultText: '뒤로 빠졌지만 또 다른 배낭족이 있었다. 이 열차는 등산열차였나...' },
    ],
  },
  {
    id: 9,
    title: '에어팟 DJ',
    emoji: '🎵',
    description: '옆 사람의 에어팟에서 음악이 새어나온다.\n장르는... 트로트와 EDM의 기묘한 믹스.\n본인은 신나서 고개를 끄덕이는 중.',
    choices: [
      { text: '🎶 같이 리듬을 탄다', effects: { hp: 0, mental: 5, moral: 0 }, resultText: '둘이서 고개를 끄덕이다 눈이 마주쳤다. 어색한 미소를 교환했다.' },
      { text: '👆 소리 새는 거 알려준다', effects: { hp: 0, mental: 0, moral: 10 }, resultText: '"앗 감사합니다!" 볼륨을 줄였다. 좋은 사람이다.' },
      { text: '😤 째려본다', effects: { hp: 0, mental: -5, moral: -10 }, resultText: '상대가 눈치채고 볼륨을 줄였지만 분위기가 험악해졌다.' },
    ],
  },
  {
    id: 10,
    title: '전도의 시간',
    emoji: '📖',
    description: '"혹시 하나님을 믿으십니까?"\n갑자기 종교인이 나타나 전도를 시작했다.\n전단지를 들이밀며 열정적으로 다가온다.',
    choices: [
      { text: '🙏 공손히 거절한다', effects: { hp: 0, mental: -10, moral: 5 }, resultText: '"다음에 기회가 되면..." 하지만 이미 전단지 3장이 손에 쥐어져 있다.' },
      { text: '🎧 에어팟을 가리키며 못 듣는 척한다', effects: { hp: 0, mental: 0, moral: -5 }, resultText: '종교인이 포기하고 옆 사람에게 갔다. 옆 사람의 원망의 눈빛이 느껴진다.' },
      { text: '🤔 "저도 다른 종교인데요"라고 한다', effects: { hp: 0, mental: 5, moral: 0 }, resultText: '종교인이 잠시 당황했다가 "그래도 한번..."이라며 더 열정적으로 다가왔다. 역효과!' },
    ],
  },
  {
    id: 11,
    title: '김밥 먹방',
    emoji: '🍙',
    description: '옆자리에서 참치 김밥을 먹기 시작했다.\n참치 마요의 향기가 코를 자극한다.\n단무지 씹는 소리가 ASMR처럼 들린다.',
    choices: [
      { text: '😤 불쾌한 표정을 짓는다', effects: { hp: 0, mental: -10, moral: -5 }, resultText: '상대는 전혀 신경 쓰지 않고 계속 먹고 있다. 세상은 불공평하다.' },
      { text: '🙂 "맛있게 드세요~"라고 한다', effects: { hp: 0, mental: -5, moral: 10 }, resultText: '"감사합니다~" 하나 건네줬다! ...하지만 맨손으로 줘서 고민된다.' },
      { text: '🤢 억지로 기침을 한다', effects: { hp: -5, mental: 5, moral: -10 }, resultText: '옆 사람이 겁먹고 김밥을 치웠다. 승리... 했지만 찝찝하다.' },
    ],
  },
  {
    id: 12,
    title: '발 테러',
    emoji: '🦶',
    description: '누군가 당신의 발을 세게 밟고 모른 척한다.\n운동화에 발자국이 찍혔다.\n새로 산 건데!!!',
    choices: [
      { text: '😡 "발 밟으셨는데요?"라고 한다', effects: { hp: 0, mental: -5, moral: 5 }, resultText: '"아 죄송~" 대충 사과하고 끝. 신발의 상처는 치유되지 않는다.' },
      { text: '😈 보복으로 발을 밟는다', effects: { hp: 0, mental: 10, moral: -20 }, resultText: '"앗!" 상대가 깜짝 놀랐다. 통쾌하지만... 이게 맞나?' },
      { text: '😢 속으로 삼킨다', effects: { hp: 0, mental: -15, moral: 5 }, resultText: '참았다... 어른이니까 참는 거다... 신발 세탁비 8천원이 떠오른다.' },
    ],
  },
  {
    id: 13,
    title: '선반 위의 위협',
    emoji: '💼',
    description: '선반 위의 큰 가방이 흔들리며 머리 위로 떨어질 것 같다.\n열차가 흔들릴 때마다 조금씩 밀려난다.\n이마에 식은땀이 흐른다.',
    choices: [
      { text: '✋ 손으로 가방을 밀어 넣는다', effects: { hp: -5, mental: 5, moral: 10 }, resultText: '가방을 밀어 넣었다. 주인이 고맙다고 했지만 어깨가 아프다.' },
      { text: '🏃 재빨리 자리를 피한다', effects: { hp: 0, mental: 0, moral: -5 }, resultText: '피한 직후 가방이 떨어졌다! 원래 있던 자리로! 위기일발이었다.' },
      { text: '📢 "가방 떨어져요!"라고 소리친다', effects: { hp: 0, mental: -5, moral: 5 }, resultText: '주인이 부랴부랴 가방을 잡았다. 하지만 온 차량 시선이 당신에게...' },
    ],
  },
  {
    id: 14,
    title: '찜질방 열차',
    emoji: '🥵',
    description: '에어컨이 고장났다.\n객차 온도가 서서히 올라가고 있다.\n지하철이 아니라 찜질방이다.\n이마에서 땀이 흐른다.',
    choices: [
      { text: '🧊 차가운 음료를 이마에 댄다', effects: { hp: 5, mental: -5, moral: 0 }, resultText: '가방 속 물병이 미지근해져 있었다. 그래도 없는 것보다 낫다...' },
      { text: '😤 비상인터폰을 누른다', effects: { hp: 0, mental: -10, moral: 5 }, resultText: '"확인하겠습니다" ...3분 후에도 변화 없음. 시스템의 한계.' },
      { text: '🏃 다음 역에서 다른 칸으로 이동한다', effects: { hp: -10, mental: 5, moral: 0 }, resultText: '힘들게 이동했지만 옆 칸도 별반 다르지 않다. 전체 에어컨 고장이었다!' },
    ],
  },
  {
    id: 15,
    title: '문에 끼인 가방',
    emoji: '🚪',
    description: '지하철 문이 닫히는데 누군가의 가방이 끼었다!\n문이 열렸다 닫혔다를 반복한다.\n"문 쪽에 계신 분 비켜주세요~"',
    choices: [
      { text: '🦸 가방을 빼주는 걸 돕는다', effects: { hp: -10, mental: 0, moral: 15 }, resultText: '힘을 합쳐 가방을 빼냈다! "감사합니다!" 하지만 팔이 찢어질 뻔했다.' },
      { text: '📱 구경하며 영상을 찍는다', effects: { hp: 0, mental: 5, moral: -15 }, resultText: '영상을 찍었지만 양심에 찔린다. 좋아요 받을 수 있을까...?' },
      { text: '😰 그냥 멀리서 지켜본다', effects: { hp: 0, mental: -5, moral: 0 }, resultText: '다른 승객이 도와줘서 해결됐다. 안도감과 함께 약간의 죄책감이...' },
    ],
  },
  {
    id: 16,
    title: '좌석 전쟁',
    emoji: '💺',
    description: '자리 하나가 비었다!\n하지만 당신과 정장 입은 직장인이 동시에 발견했다.\n서로의 눈빛이 마주친다.\n0.5초의 심리전이 시작된다.',
    choices: [
      { text: '🏃 전력 질주로 앉는다', effects: { hp: -5, mental: 10, moral: -10 }, resultText: '앉았다! 승리의 달콤함... 하지만 상대의 절망적인 눈빛이 마음에 걸린다.' },
      { text: '🤝 양보한다', effects: { hp: -10, mental: -5, moral: 15 }, resultText: '"감사합니다..." 상대의 진심어린 감사. 다리는 아프지만 뿌듯하다.' },
      { text: '😐 어색하게 둘 다 안 앉는다', effects: { hp: 0, mental: -10, moral: 5 }, resultText: '서로 양보하다가 제3자가 앉아버렸다. 허무하다...' },
    ],
  },
  {
    id: 17,
    title: '미스터리 냄새',
    emoji: '👃',
    description: '정체불명의 냄새가 객차에 퍼지기 시작한다.\n누구의 소행인지 알 수 없다.\n승객들이 하나둘 코를 막기 시작한다.',
    choices: [
      { text: '😷 마스크를 쓴다', effects: { hp: 0, mental: -5, moral: 0 }, resultText: '마스크로 어느 정도 방어했지만 완벽하진 않다. 눈이 매캐하다.' },
      { text: '🏃 다음 칸으로 대피한다', effects: { hp: -5, mental: 5, moral: 0 }, resultText: '재빨리 옆 칸으로 이동했다. 신선한 공기! ...라고 하기엔 지하철이지만.' },
      { text: '🤢 "누구세요?!"라고 외친다', effects: { hp: 0, mental: 5, moral: -10 }, resultText: '아무도 대답하지 않았다. 오히려 당신이 범인으로 의심받기 시작한다.' },
    ],
  },
];

// ===== 환승역 특수 이벤트 =====
const TRANSFER_EVENTS = [
  {
    id: 100,
    title: '환승 인파 대란',
    emoji: '🌊',
    description: '환승역이다! 사람들이 파도처럼 밀려온다!\n숨을 쉴 수 없을 정도의 인파다.\n발이 땅에서 떨어진 채로 이동하고 있다.',
    isSpecial: true,
    choices: [
      { text: '🏄 파도에 몸을 맡긴다', effects: { hp: -10, mental: -10, moral: 0 }, resultText: '인파에 떠밀려 3미터를 이동했다. 신발 한 짝이 벗겨질 뻔했다.' },
      { text: '🧱 기둥을 잡고 버틴다', effects: { hp: -15, mental: 5, moral: 0 }, resultText: '기둥을 사수했다! 하지만 온몸이 욱신거린다. 전투의 상처다.' },
      { text: '🏃 계단 쪽으로 역주행한다', effects: { hp: -5, mental: -15, moral: -5 }, resultText: '역주행하다가 수많은 눈빛의 공격을 받았다. 그래도 살아남았다.' },
    ],
  },
  {
    id: 101,
    title: '환승 미로 탈출',
    emoji: '🔀',
    description: '환승 통로가 미로처럼 복잡하다.\n표지판은 있지만 사람이 너무 많아서 안 보인다.\n어디가 어딘지 모르겠다.',
    isSpecial: true,
    choices: [
      { text: '🧭 표지판을 찾아 차분히 이동한다', effects: { hp: -5, mental: 0, moral: 5 }, resultText: '겨우 방향을 찾았다. 침착함이 빛을 발했다.' },
      { text: '🏃 앞 사람을 따라간다', effects: { hp: 0, mental: -10, moral: 0 }, resultText: '앞 사람이 반대 방향으로 가고 있었다! 5분을 낭비했다.' },
      { text: '📱 지도앱을 켠다', effects: { hp: 0, mental: -5, moral: 0 }, resultText: '지하라서 GPS가 안 잡힌다. 역시 기술에는 한계가 있다.' },
    ],
  },
];

// ===== 화면 전환 =====
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  document.getElementById(screenId).classList.add('active');
}

// ===== 스탯 업데이트 =====
function updateStatDisplay() {
  var hp = Math.max(0, Math.min(100, state.hp));
  var mental = Math.max(0, Math.min(100, state.mental));
  var moral = Math.max(0, Math.min(100, state.moral));

  document.getElementById('hp-bar').style.width = hp + '%';
  document.getElementById('hp-value').textContent = hp;
  document.getElementById('mental-bar').style.width = mental + '%';
  document.getElementById('mental-value').textContent = mental;
  document.getElementById('moral-bar').style.width = moral + '%';
  document.getElementById('moral-value').textContent = moral;

  // 색상 변화 (낮을수록 위험)
  var hpBar = document.getElementById('hp-bar');
  if (hp <= 25) hpBar.style.background = 'linear-gradient(90deg, #ff0000, #ff4757)';
  else if (hp <= 50) hpBar.style.background = 'linear-gradient(90deg, #ff6348, #ff7979)';
  else hpBar.style.background = 'linear-gradient(90deg, #ff4757, #ff6b81)';

  var mentalBar = document.getElementById('mental-bar');
  if (mental <= 25) mentalBar.style.background = 'linear-gradient(90deg, #8b00ff, #a855f7)';
  else if (mental <= 50) mentalBar.style.background = 'linear-gradient(90deg, #6c5ce7, #a29bfe)';
  else mentalBar.style.background = 'linear-gradient(90deg, #5352ed, #a29bfe)';

  document.getElementById('current-station').textContent = '📍 ' + STATIONS[state.stationIdx];
  document.getElementById('turn-info').textContent = '턴 ' + (state.turn + 1);

  // 역 진행 표시 업데이트
  document.querySelectorAll('.station-dot').forEach(function(dot) {
    var idx = parseInt(dot.dataset.idx);
    dot.classList.remove('visited', 'current');
    if (idx < state.stationIdx) dot.classList.add('visited');
    else if (idx === state.stationIdx) dot.classList.add('current');
  });
}

// ===== 스탯 변동 애니메이션 =====
function animateStatChange(stat, delta) {
  if (delta === 0) return;
  var el = document.getElementById(stat + '-value');
  el.classList.remove('stat-flash-red', 'stat-flash-green');
  void el.offsetWidth;
  if (delta > 0) el.classList.add('stat-flash-green');
  else el.classList.add('stat-flash-red');
}

// ===== 게임 시작 =====
function startGame() {
  initState();
  showScreen('game-screen');
  updateStatDisplay();
  showEvent();
}

// ===== 이벤트 표시 =====
function showEvent() {
  if (state.gameOver) return;

  var resultArea = document.getElementById('result-area');
  resultArea.classList.add('hidden');
  document.getElementById('next-btn').classList.add('hidden');

  // 환승역 특수 이벤트
  var currentStation = STATIONS[state.stationIdx];
  var event;
  if (TRANSFER_STATIONS.indexOf(currentStation) !== -1 && state.turn > 0 && state.turn % 2 === 0) {
    var transferIdx = Math.floor(Math.random() * TRANSFER_EVENTS.length);
    event = TRANSFER_EVENTS[transferIdx];
    document.getElementById('event-area').classList.add('special-event');
  } else {
    document.getElementById('event-area').classList.remove('special-event');
    // 일반 이벤트 (중복 방지)
    var available = EVENTS.filter(function(e) { return state.usedEvents.indexOf(e.id) === -1; });
    if (available.length === 0) state.usedEvents = [];
    var pool = available.length > 0 ? available : EVENTS;
    event = pool[Math.floor(Math.random() * pool.length)];
    state.usedEvents.push(event.id);
  }

  state.currentEvent = event;

  // 이벤트 렌더링
  var eventArea = document.getElementById('event-area');
  eventArea.style.animation = 'none';
  void eventArea.offsetWidth;
  eventArea.style.animation = 'fadeIn 0.4s ease';

  document.getElementById('event-emoji').textContent = event.emoji;
  document.getElementById('event-title').textContent = event.title;
  document.getElementById('event-desc').textContent = event.description;

  // 선택지 렌더링
  var choicesArea = document.getElementById('choices-area');
  choicesArea.innerHTML = '';
  event.choices.forEach(function(choice, i) {
    var btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.text;
    btn.onclick = function() { selectChoice(i); };
    choicesArea.appendChild(btn);
  });
}

// ===== 선택지 선택 =====
function selectChoice(idx) {
  var event = state.currentEvent;
  var choice = event.choices[idx];

  // 선택지 비활성화
  var btns = document.querySelectorAll('.choice-btn');
  btns.forEach(function(btn, i) {
    btn.disabled = true;
    if (i === idx) btn.classList.add('selected');
  });

  // 스탯 변경 적용
  state.hp = Math.max(0, Math.min(100, state.hp + choice.effects.hp));
  state.mental = Math.max(0, Math.min(100, state.mental + choice.effects.mental));
  state.moral = Math.max(0, Math.min(100, state.moral + choice.effects.moral));

  // 결과 표시
  var resultArea = document.getElementById('result-area');
  resultArea.classList.remove('hidden');
  document.getElementById('result-text').textContent = choice.resultText;

  // 스탯 변동 표시
  var changes = [];
  if (choice.effects.hp !== 0) {
    var cls = choice.effects.hp > 0 ? 'change-positive' : 'change-negative';
    var sign = choice.effects.hp > 0 ? '+' : '';
    changes.push('<span class="' + cls + '">❤️ ' + sign + choice.effects.hp + '</span>');
  }
  if (choice.effects.mental !== 0) {
    var cls2 = choice.effects.mental > 0 ? 'change-positive' : 'change-negative';
    var sign2 = choice.effects.mental > 0 ? '+' : '';
    changes.push('<span class="' + cls2 + '">🧠 ' + sign2 + choice.effects.mental + '</span>');
  }
  if (choice.effects.moral !== 0) {
    var cls3 = choice.effects.moral > 0 ? 'change-positive' : 'change-negative';
    var sign3 = choice.effects.moral > 0 ? '+' : '';
    changes.push('<span class="' + cls3 + '">😇 ' + sign3 + choice.effects.moral + '</span>');
  }
  document.getElementById('stat-changes').innerHTML = changes.join(' ');

  // 애니메이션
  if (choice.effects.hp !== 0) animateStatChange('hp', choice.effects.hp);
  if (choice.effects.mental !== 0) animateStatChange('mental', choice.effects.mental);
  if (choice.effects.moral !== 0) animateStatChange('moral', choice.effects.moral);

  updateStatDisplay();

  // 게임오버 체크
  if (state.hp <= 0 || state.mental <= 0) {
    setTimeout(function() { showEnding(); }, 1500);
    return;
  }

  // 다음 버튼 표시
  document.getElementById('next-btn').classList.remove('hidden');
}

// ===== 다음 턴 =====
function nextTurn() {
  state.turn++;

  // 2턴마다 다음 역 도착
  if (state.turn % 2 === 0 && state.stationIdx < STATIONS.length - 1) {
    state.stationIdx++;
    updateStatDisplay();

    // 목적지 도착 체크
    if (state.stationIdx >= STATIONS.length - 1) {
      setTimeout(function() { showEnding(); }, 500);
      return;
    }

    // 역 도착 화면 표시
    showStationArrival();
    return;
  }

  showEvent();
}

// ===== 역 도착 화면 =====
function showStationArrival() {
  var station = STATIONS[state.stationIdx];
  var isTransfer = TRANSFER_STATIONS.indexOf(station) !== -1;

  document.getElementById('arrival-station-name').textContent =
    (isTransfer ? '🔀 ' : '🚉 ') + station + ' 도착';
  document.getElementById('arrival-message').textContent =
    isTransfer
      ? '환승역이다! 사람들이 쏟아져 들어온다...'
      : '이번 역은 ' + station + '입니다. 내리실 문은 왼쪽입니다.';

  showScreen('station-screen');
}

function continueAfterStation() {
  showScreen('game-screen');
  showEvent();
}

// ===== 엔딩 =====
function showEnding() {
  state.gameOver = true;
  var ending;

  if (state.hp <= 0) {
    ending = {
      type: 'faint',
      emoji: '😵',
      title: '종착역 표류',
      desc: '체력이 바닥나 기절했다...\n눈을 떠보니 종착역.\n"승객님, 종점입니다. 일어나세요."\n\n당신은 시청역까지 갔다가 다시 돌아와야 한다.',
    };
  } else if (state.mental <= 0) {
    ending = {
      type: 'mental',
      emoji: '🤯',
      title: '멘탈 붕괴',
      desc: '더 이상 참을 수 없었다.\n"아아아아아아!!!!!"\n\n지하철 안에서 소리를 질러버렸다.\n모든 승객이 당신을 쳐다보고 있다.\n\n다음 역에서 급히 내렸다.',
    };
  } else if (state.moral <= 0) {
    ending = {
      type: 'villain',
      emoji: '😈',
      title: '히든 엔딩: 진상의 탄생',
      desc: '어느새 당신이 지하철의 빌런이 되어 있었다.\n자리 뺏기, 발 밟기, 소음 테러...\n\n"요즘 젊은 것들은..."이라는 말을 듣게 되었다.\n당신이 바로 지옥철의 원인이었다.',
    };
  } else if (state.moral >= 90) {
    ending = {
      type: 'saint',
      emoji: '😇',
      title: '지하철 성인 인증',
      desc: '축하합니다! 당신은 2호선의 성인(聖人)입니다.\n\n자리 양보, 배려, 참을성...\n모든 면에서 완벽한 시민이었습니다.\n\n📜 [지하철 성인 인증서] 획득!\n서울교통공사가 인정한 모범 시민.',
    };
  } else {
    ending = {
      type: 'safe',
      emoji: '🎉',
      title: '무사 귀환!',
      desc: '신림역에 도착했다!\n살아남았다... 오늘도 퇴근 성공.\n\n집에 가서 치킨이나 시켜먹자.\n내일도 이 지옥이 반복되겠지만\n오늘은 일단 수고했다.',
    };
  }

  // 엔딩 화면 렌더링
  var endingContent = document.querySelector('#ending-screen .ending-content');
  endingContent.className = 'ending-content ending-' + ending.type;

  document.getElementById('ending-emoji').textContent = ending.emoji;
  document.getElementById('ending-title').textContent = ending.title;
  document.getElementById('ending-desc').textContent = ending.desc;

  // 최종 스탯
  document.getElementById('ending-stats').innerHTML =
    '❤️ 체력: ' + Math.max(0, state.hp) + ' | 🧠 멘탈: ' + Math.max(0, state.mental) + ' | 😇 도덕: ' + Math.max(0, state.moral) + '<br>' +
    '📍 도달 역: ' + STATIONS[state.stationIdx] + ' | 🔄 총 ' + (state.turn + 1) + '턴';

  showScreen('ending-screen');
}
