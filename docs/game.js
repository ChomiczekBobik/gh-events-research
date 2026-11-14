(() => {
'use strict';

const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = ri(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const A = window.GameAudio;

// ───────────────────────── ДАННЫЕ ─────────────────────────
const NIGHTS = [3, 4, 4, 5, 6];
const TYPE_MIX = [ // вероятности local / rad / krak по ночам
  [0.55, 0.25, 0.20], [0.45, 0.30, 0.25], [0.40, 0.30, 0.30], [0.35, 0.30, 0.35], [0.30, 0.30, 0.40],
];
const NAMES_M = ['Пан Збигнев', 'Януш', 'Мирек', 'Кшиштоф', 'Томек', 'Гжегож', 'Станислав', 'Бартек', 'Пан Здзислав', 'Мариуш', 'Ярек', 'Пан Казимеж', 'Войтек', 'Анджей', 'Пётрек'];
const NAMES_F = ['Пани Гражина', 'Бася', 'Агнешка', 'Пани Халина', 'Ванда', 'Мажена', 'Ядвига', 'Пани Божена', 'Кася', 'Ола', 'Пани Данута', 'Эва', 'Магда'];

const GREET = {
  local: [
    'Пустите, ради святой Кинги! Там пыль, ничего не видно…',
    'Я с Копальняной, наш дом сложился как карточный…',
    'Сосед, это я! Ну, вроде я. Открой, а?',
    'Я неделю просидел в шахте на глубине 135 метров. У вас есть чай?',
    'Холодно… Я только переночевать. Я свою соль принесу.',
    'Матка Боска… Тут хоть кто-то живой есть?',
  ],
  rad: [
    'Здравствуйте… мне что-то нехорошо. Наверно, съел что-то.',
    'Я в порядке! Просто внутри как-то… светло.',
    'Можно войти? Волосы с утра выпадают, но это от стресса.',
    'Я гулял все эти дни. Красиво было — всё так сияло…',
    'Пустите, а то я весь горю. Ну, в хорошем смысле.',
    'Кхе-кхе… Пустите, пожалуйста. Кхе.',
  ],
  krak: [
    'Dzień dobry! Я местный, абсолютно местный. Величка — лучший город. Наверно.',
    'Пустите земляка! Я из… Велички, да. Прямо отсюда.',
    'Ох, ну и смог у вас… в смысле, у НАС. У нас.',
    'Я принёс обважанки… то есть ничего не принёс. Откройте.',
    'Пустите переночевать, а я вам потом про Вавель расскажу… то есть не расскажу.',
    'Я обычный величанин, просто проездом. Живу тут. Постоянно.',
  ],
};

const QUESTIONS = [
  { q: 'Как сказать «пойду на улицу»?',
    right: ['«Idę na dwór», как все нормальные люди.', 'Na dwór, конечно. А как ещё?'],
    wrong: ['«Idę na pole»… а что?', 'Na pole! Ой. В смысле…'] },
  { q: 'Кто покровительница соляных шахтёров?',
    right: ['Святая Кинга! У неё же внизу часовня, вся из соли.', 'Кинга. Я в её часовне на свадьбе гулял.'],
    wrong: ['Э-э… святой Вавельский дракон?', 'Святой Флориан? Он же у ворот стоит…'] },
  { q: 'За кого болеешь?',
    right: ['Górnik Wieliczka, до гроба!', 'Горник Величка, ясное дело.'],
    wrong: ['Висла Краков! Ой… то есть Горник.', 'Краковия, ну в смысле… никого. Футбол — зло.'] },
  { q: 'Сколько ступенек до первого уровня шахты?',
    right: ['Почти четыреста. Мои колени помнят каждую.', 'Около 380. Туристы каждый раз ноют.'],
    wrong: ['Ну… двенадцать?', 'Шахта? Какая шахта? А, ТА шахта. Много.'] },
  { q: 'Что главное в жизни?',
    right: ['Соль. Без соли и жизнь не жизнь.', 'Соль, семья и чтобы шахту не затопило.'],
    wrong: ['Тёплый обважанек с маком, тут без вариантов!', 'Вид на Вавель… то есть соль, соль.'] },
  { q: 'Где ты был, когда ударило?',
    right: ['Внизу, в шахте, на экскурсии с японцами. Они до сих пор там.', 'В погребе, огурцы солил.'],
    wrong: ['На Рынке Главном, кормил голубей… то есть дома.', 'В трамвае номер… а, в Величке нет трамваев? Тогда дома.'] },
];

const STREETS_W = ['ul. Kopalniana', 'ul. Słowackiego', 'ul. Dembowskiego', 'Rynek Górny', 'ul. Daniłowicza', 'ul. Zamkowa', 'ul. Józefa Piłsudskiego'];
const STREETS_K = ['ul. Floriańska', 'ul. Grodzka', 'ul. Szewska', 'ul. Kanonicza', 'Rynek Główny', 'ul. Wawelska'];

const RADIO = [
  'Говорит Радио «Солянка». Прошла неделя после удара Кракова.\nПыль осела. Выжившие идут к уцелевшим домам.\n\nИНСТРУКЦИЯ №1: облучённые светятся изнутри. Дозиметр выше 2 мкЗв/ч — это уже не загар.\nИНСТРУКЦИЯ №2: краковяне-предатели выдают себя за местных. Задавайте вопросы.\nНе тратьте все проверки на одного гостя.',
  'Радио «Солянка», день второй.\nПоступают сообщения: краковяне говорят «na pole», когда идут на улицу. Нормальный человек говорит «na dwór».\nТакже напоминаем: в нашей крови столько соли, что наши ладони солёные. У краковян — смог и мак.',
  'Радио «Солянка», день третий.\nСоседи жалуются на пропавшие огурцы. Если ночью кто-то чавкает — это повод задуматься.\nОблучённые иногда сами не знают, что облучены. Посветите им фонариком в глаза: зелёный блеск — плохой знак.',
  'Радио «Солянка», день четвёртый.\nКраковские шпионы подделывают прописку! «Wieliczka, ul. Floriańska» — так не бывает, Флорианская в Кракове.\nИ помните: Рынок ГУРНЫ — наш, Рынок ГЛУВНЫ — их.',
  'Радио «Солянка», последний эфир.\nВетер с Вислы несёт новую волну. Сегодня у двери будет многолюдно.\nПродержитесь эту ночь — утром из шахты выйдут спасатели. Да хранит вас святая Кинга.',
];

// ─────────────────────── СОСТОЯНИЕ ───────────────────────
let S;
function newState() {
  return {
    day: 1, queue: [], current: null, checks: 0, minutes: 0,
    house: [{ name: 'Бабця Ядзя', type: 'local', alive: true, nights: 0, gone: false, story: true }],
    stats: { letLocal: 0, letRad: 0, letKrak: 0, denyLocal: 0, denyRad: 0, denyKrak: 0, killed: 0 },
    playerAlive: true, busy: false,
  };
}

// ─────────────────────── ГЕНЕРАЦИЯ ГОСТЕЙ ───────────────────────
const SKINS = ['#e7c3a3', '#d9ad8a', '#f0d2b8', '#c99a76', '#e9c9b0'];
const HAIR = ['#2b1a12', '#5a3a22', '#8a6a3a', '#c9b38a', '#777', '#1a1a1a', '#a0442a'];
const COATS = ['#3d4a3a', '#4a3a30', '#2e3442', '#5a2a24', '#3a3a3a', '#5e5232', '#2b2b38'];

function makeLook(type, male) {
  const L = {
    skin: pick(SKINS), hairColor: pick(HAIR), coat: pick(COATS),
    hw: ri(21, 27), hh: ri(27, 33), eyeGap: ri(8, 11), eyeY: ri(-3, 2),
    hair: pick(male ? ['short', 'short', 'bald', 'side', 'long'] : ['long', 'long', 'bun', 'short', 'side']),
    hat: pick([null, null, null, 'cap', 'beanie', 'miner', 'ushanka']),
    mouth: pick(['flat', 'frown', 'smile', 'open']),
    mustache: male && chance(0.4), beard: male && chance(0.2), glasses: chance(0.15),
    mask: chance(0.07), scarf: null, bagel: false, sickly: false, patchy: false,
    seed: Math.random() * 1000,
  };
  if (chance(type === 'krak' ? 0.25 : 0.08)) L.scarf = 'cracovia';
  else if (chance(0.3)) L.scarf = pick(['#7a1a14', '#2a4a6a', '#6a6a2a', '#bbb']);
  L.bagel = chance(type === 'krak' ? 0.15 : 0.03);
  if (type === 'rad') { L.sickly = chance(0.4); L.patchy = chance(0.35); }
  else L.sickly = chance(0.06);
  return L;
}

function makeClues(type) {
  const c = {};
  // Дозиметр
  let d;
  if (type === 'rad') d = chance(0.85) ? rnd(2.5, 9) : rnd(1.2, 1.95);
  else if (type === 'krak') d = chance(0.3) ? rnd(0.8, 1.7) : rnd(0.1, 0.6);
  else d = chance(0.12) ? rnd(0.8, 1.6) : rnd(0.08, 0.5);
  c.doseValue = d;
  c.dose = `${d.toFixed(2)} мкЗв/ч. ` + (d > 2 ? 'Трещит как бешеный!' : d > 0.75 ? 'Пощёлкивает чаще обычного.' : 'Тихонько щёлкает.');

  // Фонарик
  c.glow = false;
  if (type === 'rad' && chance(0.7)) { c.glow = true; c.flash = 'Зрачки отсвечивают ЗЕЛЁНЫМ. Это точно не отражение.'; }
  else if (type === 'rad') c.flash = 'Кожа бледная, восковая. Глаза… вроде обычные.';
  else if (type === 'krak' && chance(0.45)) c.flash = 'На воротнике крошки и маковые зёрна. Похоже на обважанек.';
  else if (chance(0.1)) c.flash = pick(['Глаза красные, мешки до подбородка. Видимо, неделю не спал.', 'На воротнике пара маковых зёрен. Булку ел?']);
  else c.flash = 'Обычные глаза. Щурится от света и ругается.';

  // Соль
  if (type === 'local') c.salt = chance(0.85) ? 'Ладонь солёная, как стена в шахте.' : 'Почти не солёная… может, руки помыл?';
  else if (type === 'rad') c.salt = chance(0.6) ? 'Солёная… но язык щиплет, привкус металла.' : 'Ладонь солёная, как стена в шахте.';
  else c.salt = chance(0.75) ? pick(['Вкус смога и трамвайных рельсов.', 'Сладковато… мак? Тесто?']) : 'Чуть солёная. Или это просто пот?';

  // Вопрос
  const Q = pick(QUESTIONS);
  let ans;
  if (type === 'krak') ans = chance(0.7) ? pick(Q.wrong) : (chance(0.5) ? '(долго молчит) …' : '') + pick(Q.right);
  else ans = (chance(0.1) ? '(долго молчит) …' : '') + pick(Q.right);
  if (type === 'rad' && chance(0.7)) ans += pick([' *кхе-кхе*', ' (голос странно звенит)', ' *сплёвывает что-то светящееся*']);
  c.ask = `«${Q.q}» — ${ans}`;

  // Документы
  if (type === 'krak') {
    c.docs = chance(0.55) ? `Wieliczka, ${pick(STREETS_K)} ${ri(1, 40)}` : chance(0.4) ? 'Документов нет — «потерял в пыли».' : `Wieliczka, ${pick(STREETS_W)} ${ri(1, 60)}`;
  } else {
    c.docs = chance(0.1) ? 'Документов нет — «сгорели вместе с домом».' : `Wieliczka, ${pick(STREETS_W)} ${ri(1, 60)}`;
  }
  return c;
}

function makeVisitor(type, custom) {
  const male = custom?.male ?? chance(0.55);
  const v = {
    type, male,
    name: custom?.name || pick(male ? NAMES_M : NAMES_F),
    greeting: custom?.greeting || pick(GREET[type]),
    look: makeLook(type, male),
    clues: Object.assign(makeClues(type), custom?.clues || {}),
    used: {}, flashed: false, appear: 0, img: null,
  };
  if (custom?.clues?.flash && custom.clues.glow === undefined) v.clues.glow = type === 'rad';
  if (custom?.image) { const im = new Image(); im.src = custom.image; v.img = im; }
  return v;
}

function buildQueue(day) {
  const n = NIGHTS[day - 1], mix = TYPE_MIX[day - 1];
  const used = new Set(S.house.map(h => h.name));
  const q = [];
  const customs = (window.CUSTOM_CHARACTERS || []).filter(c => c.night ? c.night === day : chance(0.3) && !S.usedCustom?.has(c.name));
  for (const c of customs) { if (q.length < n + 2) { q.push(makeVisitor(c.type, c)); (S.usedCustom ||= new Set()).add(c.name); } }
  while (q.length < n) {
    const r = Math.random();
    const type = r < mix[0] ? 'local' : r < mix[0] + mix[1] ? 'rad' : 'krak';
    let v, tries = 0;
    do { v = makeVisitor(type); } while (used.has(v.name) && tries++ < 20);
    used.add(v.name); q.push(v);
  }
  return shuffle(q);
}

// ─────────────────────── ОТРИСОВКА ───────────────────────
const cv = $('#view'), g = cv.getContext('2d');
const dust = Array.from({ length: 70 }, () => ({ x: Math.random() * 160, y: Math.random() * 160, s: rnd(0.15, 0.6), r: Math.random() < 0.15 ? 2 : 1 }));
let lastT = 0;

function ell(x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
function rect(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); }

function drawCorridor(t) {
  rect(0, 0, 160, 160, '#140807');
  rect(28, 8, 104, 120, '#241110');
  g.strokeStyle = '#3a1a16'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(28, 8); g.moveTo(160, 0); g.lineTo(132, 8);
  g.moveTo(0, 160); g.lineTo(28, 128); g.moveTo(160, 160); g.lineTo(132, 128); g.stroke();
  for (let i = 0; i < 5; i++) rect(28, 128 + i * 7, 104, 1, '#2c1411');
  const flick = Math.sin(t / 90) > 0.95 || Math.random() < 0.01 ? 0.2 : 1;
  const lg = g.createRadialGradient(80, 6, 1, 80, 40, 80);
  lg.addColorStop(0, `rgba(255,180,120,${0.35 * flick})`); lg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lg; g.fillRect(0, 0, 160, 160);
  rect(74, 2, 12, 4, flick < 1 ? '#553322' : '#ffd8a0');
}

function drawPerson(v, t) {
  const L = v.look, bob = Math.sin(t / 700 + L.seed) * 1.2;
  const cx = 80, cy = 78 + bob;
  // тело
  g.fillStyle = L.coat; g.beginPath();
  g.moveTo(cx - 46, 165); g.lineTo(cx - 40, cy + 40); g.quadraticCurveTo(cx, cy + 26, cx + 40, cy + 40); g.lineTo(cx + 46, 165); g.fill();
  rect(cx - 1, cy + 36, 2, 40, 'rgba(0,0,0,.35)');
  rect(cx - 7, cy + 24, 14, 12, L.skin); // шея
  rect(cx - 7, cy + 30, 14, 6, 'rgba(0,0,0,.18)');
  // шарф
  if (L.scarf === 'cracovia') { for (let i = 0; i < 6; i++) rect(cx - 22 + i * 8, cy + 32, 8, 8, i % 2 ? '#eee' : '#c4231c'); }
  else if (L.scarf) rect(cx - 22, cy + 32, 44, 8, L.scarf);
  if (L.bagel) { g.strokeStyle = '#c99a4a'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy + 46, 13, 8, 0, 0, Math.PI * 2); g.stroke();
    for (let a = 0; a < 6.28; a += 0.7) rect(cx + Math.cos(a) * 13, cy + 46 + Math.sin(a) * 8, 1, 1, '#222'); }
  // длинные волосы сзади
  if (L.hair === 'long' && L.hat !== 'ushanka') ell(cx, cy + 6, L.hw + 4, L.hh + 6, L.hairColor);
  // голова
  ell(cx, cy, L.hw, L.hh, L.skin);
  if (L.sickly) { g.globalAlpha = 0.25; ell(cx, cy, L.hw, L.hh, '#8fc070'); g.globalAlpha = 1; }
  ell(cx - L.hw + 1, cy + 2, 3, 5, L.skin); ell(cx + L.hw - 1, cy + 2, 3, 5, L.skin); // уши
  // тень лица
  g.globalAlpha = 0.18; ell(cx + 6, cy + 4, L.hw - 6, L.hh - 4, '#000'); g.globalAlpha = 1;
  // волосы
  const top = cy - L.hh;
  if (L.hair === 'short' || L.hair === 'side') { g.fillStyle = L.hairColor; g.beginPath(); g.ellipse(cx, cy - L.hh * 0.45, L.hw + 1, L.hh * 0.62, 0, Math.PI, 0); g.fill();
    if (L.hair === 'side') rect(cx - L.hw, top + 10, 14, 6, L.hairColor); }
  if (L.hair === 'long') { g.fillStyle = L.hairColor; g.beginPath(); g.ellipse(cx, cy - L.hh * 0.4, L.hw + 2, L.hh * 0.66, 0, Math.PI, 0); g.fill(); }
  if (L.hair === 'bun') { ell(cx, top - 3, 8, 7, L.hairColor); g.fillStyle = L.hairColor; g.beginPath(); g.ellipse(cx, cy - L.hh * 0.45, L.hw + 1, L.hh * 0.6, 0, Math.PI, 0); g.fill(); }
  if (L.patchy) for (let i = 0; i < 4; i++) ell(cx - 12 + i * 8 + Math.sin(L.seed + i) * 3, top + 8 + (i % 2) * 4, 3, 2, L.skin);
  // глаза
  const ey = cy - 4 + L.eyeY, eg = L.eyeGap;
  const blink = (t / 1000 + L.seed) % 5 < 0.12;
  const glowing = v.flashed && v.clues.glow;
  for (const s of [-1, 1]) {
    const ex = cx + s * eg;
    rect(ex - 5, ey - 6, 9, 2, L.hairColor === '#c9b38a' ? '#9a8458' : '#2a1a12'); // бровь
    if (blink) rect(ex - 4, ey, 8, 1, '#2a1a12');
    else {
      rect(ex - 4, ey - 2, 8, 5, v.flashed ? '#fff' : '#ddd');
      if (glowing) { g.shadowColor = '#7dff6a'; g.shadowBlur = 8; rect(ex - 2, ey - 2, 4, 5, '#7dff6a'); g.shadowBlur = 0; }
      else rect(ex - 1 - (v.flashed ? 0 : 1), ey - 1, v.flashed ? 2 : 3, 3, '#111');
    }
    if (L.glasses) { g.strokeStyle = '#111'; g.lineWidth = 1; g.strokeRect(ex - 6, ey - 4, 11, 8); }
  }
  if (L.glasses) rect(cx - 2, ey - 1, 4, 1, '#111');
  // нос
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(cx, ey + 1); g.lineTo(cx + 4, ey + 11); g.lineTo(cx - 1, ey + 11); g.fill();
  // рот / маска
  const my = cy + 15;
  if (L.mask) { rect(cx - 15, ey + 7, 30, 18, '#5a5a4a'); ell(cx, my, 6, 6, '#333'); rect(cx - 2, my - 2, 4, 4, '#111'); }
  else {
    if (L.beard) { g.fillStyle = L.hairColor; g.beginPath(); g.ellipse(cx, cy + 14, L.hw - 3, 14, 0, 0, Math.PI); g.fill(); }
    if (L.mouth === 'open') ell(cx, my, 4, 3, '#3a0d0a');
    else if (L.mouth === 'smile') { rect(cx - 5, my, 10, 1, '#5a1a14'); rect(cx - 6, my - 1, 1, 1, '#5a1a14'); rect(cx + 5, my - 1, 1, 1, '#5a1a14'); }
    else if (L.mouth === 'frown') { rect(cx - 5, my, 10, 1, '#5a1a14'); rect(cx - 6, my + 1, 1, 1, '#5a1a14'); rect(cx + 5, my + 1, 1, 1, '#5a1a14'); }
    else rect(cx - 5, my, 10, 1, '#5a1a14');
    if (L.mustache) { rect(cx - 9, my - 5, 18, 3, L.hairColor); rect(cx - 10, my - 3, 3, 3, L.hairColor); rect(cx + 7, my - 3, 3, 3, L.hairColor); }
  }
  // шапки
  if (L.hat === 'cap') { g.fillStyle = '#3a3226'; g.beginPath(); g.ellipse(cx, top + 10, L.hw + 2, 12, 0, Math.PI, 0); g.fill(); rect(cx - L.hw, top + 8, L.hw * 2 + 8, 3, '#2a241a'); }
  if (L.hat === 'beanie') { g.fillStyle = '#6a2222'; g.beginPath(); g.ellipse(cx, top + 12, L.hw + 2, 15, 0, Math.PI, 0); g.fill(); rect(cx - L.hw - 2, top + 9, L.hw * 2 + 4, 5, '#4a1616'); }
  if (L.hat === 'ushanka') { ell(cx, top + 8, L.hw + 4, 12, '#4a3a2a'); rect(cx - L.hw - 5, top + 8, 8, 26, '#4a3a2a'); rect(cx + L.hw - 3, top + 8, 8, 26, '#4a3a2a'); }
  if (L.hat === 'miner') { g.fillStyle = '#d8c23a'; g.beginPath(); g.ellipse(cx, top + 10, L.hw + 3, 13, 0, Math.PI, 0); g.fill(); rect(cx - L.hw - 5, top + 8, L.hw * 2 + 10, 3, '#a8941a');
    rect(cx - 4, top - 1, 8, 6, '#555'); g.shadowColor = '#fff6c0'; g.shadowBlur = 6; rect(cx - 2, top + 1, 4, 3, '#fff6c0'); g.shadowBlur = 0; }
  // облучённые чуть светятся всегда, если плохо
  if (v.type === 'rad' && v.clues.doseValue > 6) { g.globalAlpha = 0.07 + 0.05 * Math.sin(t / 300); ell(cx, cy, L.hw + 8, L.hh + 8, '#7dff6a'); g.globalAlpha = 1; }
}

function drawCustom(v) {
  const im = v.img; if (!im.complete || !im.naturalWidth) return;
  const s = Math.min(150 / im.naturalWidth, 150 / im.naturalHeight);
  const w = im.naturalWidth * s, h = im.naturalHeight * s;
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 80 - w / 2, 160 - h, w, h);
  if (v.flashed && v.clues.glow) { g.globalAlpha = 0.25; rect(0, 0, 160, 160, '#7dff6a'); g.globalAlpha = 1; }
}

function draw(t) {
  const dt = Math.min(50, t - lastT); lastT = t;
  drawCorridor(t);
  const v = S?.current;
  if (v) {
    v.appear = Math.min(1, v.appear + dt / 700);
    g.globalAlpha = v.appear;
    if (v.img) drawCustom(v); else drawPerson(v, t);
    g.globalAlpha = 1;
  }
  // освещение
  if (v?.flashed) {
    const fg = g.createRadialGradient(80, 72, 5, 80, 72, 70);
    fg.addColorStop(0, 'rgba(255,250,220,.25)'); fg.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = fg; g.fillRect(0, 0, 160, 160);
  } else { g.fillStyle = 'rgba(30,0,0,.35)'; g.fillRect(0, 0, 160, 160); }
  // пыль
  for (const p of dust) {
    p.y += p.s * dt / 16; p.x += Math.sin(t / 1000 + p.y / 20) * 0.1;
    if (p.y > 160) { p.y = -2; p.x = Math.random() * 160; }
    rect(p.x, p.y, p.r, p.r, 'rgba(220,200,170,.45)');
  }
  // глазок
  const vg = g.createRadialGradient(80, 80, 40, 80, 80, 80);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.95)');
  g.fillStyle = vg; g.fillRect(0, 0, 160, 160);
  g.fillStyle = 'rgba(200,220,255,.06)'; g.beginPath(); g.ellipse(58, 50, 22, 12, -0.6, 0, Math.PI * 2); g.fill();
  requestAnimationFrame(draw);
}

// ─────────────────────── UI ───────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

let typing = null;
function say(who, text, cb) {
  const el = $('#dialog');
  clearInterval(typing);
  el.innerHTML = (who ? `<span class="who">${who}:</span> ` : '') + '<span class="txt"></span>';
  const span = el.querySelector('.txt'); let i = 0;
  typing = setInterval(() => {
    span.textContent = text.slice(0, ++i);
    if (i % 3 === 0) A.blip();
    if (i >= text.length) { clearInterval(typing); cb && cb(); }
  }, 22);
}

function addClue(tag, text) {
  const d = document.createElement('div'); d.className = 'clue';
  d.innerHTML = `<span class="tag">${tag}</span> `; d.append(text);
  $('#clues').append(d);
}

function fmtTime() { const m = 23 * 60 + S.minutes; return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }

function hud() {
  $('#hud-day').textContent = S.day; $('#hud-maxday').textContent = NIGHTS.length;
  $('#hud-checks').textContent = S.checks; $('#hud-queue').textContent = S.queue.length + (S.current ? 1 : 0);
  $('#hud-time').textContent = fmtTime();
  const busy = !S.current || S.busy;
  document.querySelectorAll('.tool').forEach(b => { b.disabled = busy || S.checks <= 0 || !!S.current?.used[b.dataset.tool]; });
  $('#btn-let').disabled = $('#btn-deny').disabled = busy;
  $('#house-list').innerHTML = '';
  for (const h of S.house) {
    if (h.gone) continue;
    const d = document.createElement('span'); d.className = 'mate' + (h.alive ? '' : ' dead'); d.textContent = h.name;
    $('#house-list').append(d);
  }
}

// ─────────────────────── ИГРОВОЙ ЦИКЛ ───────────────────────
function startGame() {
  S = newState();
  showRadio([]);
}

function showRadio(events) {
  $('#radio-day').textContent = `ДЕНЬ ${S.day}`;
  const box = $('#radio-text'); box.innerHTML = '';
  for (const e of events) { const s = document.createElement('span'); s.className = 'ev'; s.textContent = e; box.append(s); }
  if (events.length) box.append(document.createElement('br'));
  box.append(RADIO[S.day - 1]);
  renderMorningHouse();
  show('screen-radio');
}

function renderMorningHouse() {
  const wrap = $('#morning-house'); wrap.innerHTML = '';
  const alive = S.house.filter(h => h.alive && !h.gone);
  if (S.day === 1 || !alive.length) return;
  const t = document.createElement('div'); t.className = 'house-title'; t.textContent = 'Жильцы. Кого-то выгнать за дверь?'; wrap.append(t);
  for (const h of alive) {
    const row = document.createElement('div'); row.className = 'row';
    const n = document.createElement('span'); n.textContent = h.name + (h.story ? ' (твоя бабушка)' : '');
    row.append(n);
    if (!h.story) {
      const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'ВЫГНАТЬ';
      b.onclick = () => {
        h.gone = true; A.slam();
        if (h.type === 'local') S.stats.denyLocal++;
        row.querySelector('.btn').replaceWith(Object.assign(document.createElement('span'), { textContent: '— ушёл в пыль' }));
      };
      row.append(b);
    }
    wrap.append(row);
  }
}

function startNight() {
  S.queue = buildQueue(S.day);
  S.checks = S.queue.length * 2;
  S.minutes = 0;
  S.current = null;
  $('#clues').innerHTML = ''; $('#visitor-name').textContent = '';
  show('screen-game'); hud();
  say('', 'Тишина. Пыль медленно падает за окном…', () => setTimeout(nextVisitor, 900));
}

function nextVisitor() {
  $('#btn-next').hidden = true; $('#verdict').hidden = false; $('#tools').hidden = false;
  if (!S.queue.length) return endNight();
  S.current = S.queue.shift(); S.busy = true;
  S.minutes += ri(15, 40);
  $('#clues').innerHTML = ''; $('#visitor-name').textContent = '';
  hud();
  A.knock();
  say('', '*тук-тук-тук*', () => setTimeout(() => {
    $('#visitor-name').textContent = S.current.name;
    say(S.current.name, S.current.greeting, () => { S.busy = false; hud(); });
  }, 500));
}

const TOOL_TAG = { dose: '📟', flash: '🔦', salt: '🧂', ask: '🗣', docs: '🪪' };
function useTool(tool) {
  const v = S.current; if (!v || S.busy || v.used[tool] || S.checks <= 0) return;
  v.used[tool] = true; S.checks--; S.minutes += 3;
  const c = v.clues;
  if (tool === 'dose') { A.geiger(c.doseValue); addClue(TOOL_TAG.dose, 'Дозиметр: ' + c.dose); }
  if (tool === 'flash') { v.flashed = true; addClue(TOOL_TAG.flash, c.flash); }
  if (tool === 'salt') { addClue(TOOL_TAG.salt, 'Просишь просунуть ладонь в щель и лизнуть её. ' + c.salt); }
  if (tool === 'ask') { addClue(TOOL_TAG.ask, c.ask); }
  if (tool === 'docs') { addClue(TOOL_TAG.docs, 'Прописка: ' + c.docs); }
  hud();
}

function decide(letIn) {
  const v = S.current; if (!v || S.busy) return;
  S.busy = true; hud();
  const key = v.type === 'local' ? 'Local' : v.type === 'rad' ? 'Rad' : 'Krak';
  S.stats[(letIn ? 'let' : 'deny') + key]++;
  if (letIn) {
    A.creak();
    S.house.push({ name: v.name, type: v.type, alive: true, nights: 0, gone: false });
    say('', pick([`${v.name} заходит, отряхивая пыль с плеч.`, `${v.name} шепчет «дзенькуе» и проходит на кухню.`, `${v.name} заходит. Половица скрипит как-то зловеще.`]), after);
  } else {
    A.slam();
    say('', pick([`Ты захлопываешь дверь. ${v.name} ещё долго стоит в пыли.`, `«Нет». ${v.name} уходит в темноту.`, `Глазок закрыт. Шаги удаляются.`]), after);
  }
  function after() {
    S.current = null; $('#visitor-name').textContent = ''; hud();
    $('#verdict').hidden = true; $('#tools').hidden = true;
    const b = $('#btn-next'); b.hidden = false;
    b.textContent = S.queue.length ? 'ЖДАТЬ СЛЕДУЮЩЕГО →' : 'ЛЕЧЬ СПАТЬ →';
  }
}

function endNight() {
  const ev = [];
  const alive = () => S.house.filter(h => h.alive && !h.gone);
  // облучённые
  for (const h of alive().filter(h => h.type === 'rad')) {
    h.nights++;
    const victims = alive().filter(x => x !== h);
    if (victims.length && chance(0.5)) {
      const x = pick(victims); x.alive = false; S.stats.killed++;
      ev.push(`☢ ${x.name} не проснулся. Кожа в ожогах, а в комнате пахнет озоном.`);
    } else if (chance(0.5)) ev.push('☢ Ночью в доме было странно светло, хотя свечи не горели.');
    if (h.nights >= 2 || chance(0.25)) { h.alive = false; ev.push(`☢ ${h.name} всю ночь тихо светился(-ась), а к утру погас(ла). Совсем.`); }
  }
  // краковяне
  for (const h of alive().filter(h => h.type === 'krak')) {
    const victims = alive().filter(x => x.type !== 'krak');
    if (chance(0.55)) {
      if (victims.length) {
        const x = pick(victims); x.alive = false; S.stats.killed++;
        ev.push(`🗡 ${x.name} найден(а) утром мёртвым. Рядом — крошки обважанка.`);
      } else if (chance(0.6)) { S.playerAlive = false; break; }
    } else ev.push(pick(['🥒 Пропала банка солёных огурцов. Кто-то чавкал ночью.', '🎺 Кто-то ночью насвистывал хейнал с Мариацкой башни.', '🐉 На запотевшем окне кто-то нарисовал дракона.']));
  }
  if (!ev.length) ev.push('Ночь прошла спокойно. Все проснулись.');

  if (!S.playerAlive) return ending('dead');
  S.day++;
  if (S.day > NIGHTS.length) return ending('survived', ev);
  A.sting();
  showRadio(ev);
}

function ending(kind, ev = []) {
  const alive = S.house.filter(h => h.alive && !h.gone);
  const locals = alive.filter(h => h.type === 'local').length;
  const kraks = alive.filter(h => h.type === 'krak').length;
  let title, text;
  if (kind === 'dead') {
    title = 'ТЫ УМЕР';
    text = 'Ночью на кухне скрипнула половица. Последнее, что ты услышал, — «a teraz idziemy na pole».<br>Утром над ратушей Велички подняли флаг с вавельским драконом.';
  } else if (kraks > 0) {
    title = 'ПРЕДАТЕЛИ СРЕДИ НАС';
    text = `Утром из шахты вышли спасатели. Ты пересчитал жильцов… и заметил, что кто-то из них заказывает «обважанек, но без соли».<br>Краковян в доме: ${kraks}. Величка уже никогда не будет прежней.`;
  } else if (locals >= 6) {
    title = 'ВЕЛИЧКА ВЫСТОЯЛА';
    text = 'Спасатели вывели всех в шахту. В часовне святой Кинги зажгли соляные лампы.<br>Ты спас столько величан, что о тебе вырежут скульптуру. Из соли, конечно.';
  } else if (locals >= 2) {
    title = 'ВЫЖИЛИ';
    text = 'Немногие, но свои. Вы спускаетесь в шахту и начинаете всё сначала.<br>Где-то наверху ветер всё ещё несёт пыль с Кракова.';
  } else {
    title = 'ОДИН В ШАХТЕ';
    text = 'Ты выжил. Почти один. Соляные стены шахты молчат.<br>Может, стоило открывать дверь чаще?';
  }
  if (ev.length) text = ev.map(e => `<i>${e}</i>`).join('<br>') + '<br><br>' + text;
  $('#end-title').textContent = title;
  $('#end-text').innerHTML = `<p>${text}</p>`;
  const st = S.stats;
  $('#end-stats').innerHTML =
    `Впущено величан: <b>${st.letLocal}</b> · облучённых: <b>${st.letRad}</b> · краковян: <b>${st.letKrak}</b><br>` +
    `Прогнано величан: <b>${st.denyLocal}</b> · облучённых: <b>${st.denyRad}</b> · краковян: <b>${st.denyKrak}</b><br>` +
    `Погибло в доме: <b>${st.killed}</b> · живых своих: <b>${locals}</b>`;
  A.sting();
  document.body.classList.add('flash-red'); setTimeout(() => document.body.classList.remove('flash-red'), 1200);
  show('screen-end');
}

// ─────────────────────── СОБЫТИЯ ───────────────────────
$('#btn-start').onclick = () => { A.init(); startGame(); };
$('#btn-night').onclick = startNight;
$('#btn-restart').onclick = startGame;
$('#btn-let').onclick = () => decide(true);
$('#btn-deny').onclick = () => decide(false);
$('#btn-next').onclick = nextVisitor;
$('#btn-mute').onclick = e => { e.target.textContent = A.toggleMute() ? '🔇' : '🔊'; };
document.querySelectorAll('.tool').forEach(b => b.onclick = () => useTool(b.dataset.tool));

requestAnimationFrame(draw);
})();
