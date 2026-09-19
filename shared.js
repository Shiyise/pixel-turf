/* ===================== 共享状态 / 地图 / 存档 ===================== */
const SAVE_KEY = "pixelcasino1";

const GameState = {
  coins: 1000,
  // 赛马
  streak: 0,
  raceNo: 1,
  dex: [],
  stable: [],
};

function gsSave(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      coins: GameState.coins,
      streak: GameState.streak,
      raceNo: GameState.raceNo,
      dex: GameState.dex,
      stable: GameState.stable,
    }));
  }catch(e){}
}
function gsLoad(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(typeof d.coins === "number") GameState.coins = d.coins;
    if(typeof d.streak === "number") GameState.streak = d.streak;
    if(typeof d.raceNo === "number") GameState.raceNo = d.raceNo;
    if(Array.isArray(d.dex)) GameState.dex = d.dex;
    if(Array.isArray(d.stable)) GameState.stable = d.stable;
    return true;
  }catch(e){ return false; }
}

const $ = id => document.getElementById(id);
function rand(a,b){ return a + Math.random()*(b-a); }

function toast(msg){
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>t.classList.remove("show"), 1800);
}

/* 金币变动统一入口，自动刷新所有显示 */
function addCoins(n){
  GameState.coins += n;
  if(GameState.coins < 0) GameState.coins = 0;
  syncCoinDisplays();
  gsSave();
}
function syncCoinDisplays(){
  const v = GameState.coins;
  ["mapCoins","coinVal","pokerCoinVal","bjCoinVal"].forEach(id=>{
    const el = $(id);
    if(el) el.textContent = v;
  });
}

/* ===================== 视图切换 ===================== */
function showView(name){
  ["map","race","poker","blackjack"].forEach(v=>{
    $("view-"+v).classList.toggle("hidden", v!==name);
  });
  syncCoinDisplays();
  if(name === "map"){
    drawMapHorse();
  }
  if(name === "race" && typeof RaceModule !== "undefined"){
    RaceModule.enter();
  }
  if(name === "poker" && typeof PokerModule !== "undefined"){
    PokerModule.enter();
  }
  if(name === "blackjack" && typeof BlackjackModule !== "undefined"){
    BlackjackModule.enter();
  }
}

/* 地图卡片上的像素马动画 */
let mapHorseT = 0;
function drawMapHorse(){
  const c = $("mapHorse");
  if(!c) return;
  const x = c.getContext("2d");
  x.imageSmoothingEnabled = false;
  function loop(){
    if($("view-map").classList.contains("hidden")){
      requestAnimationFrame(loop); return;
    }
    mapHorseT++;
    x.clearRect(0,0,c.width,c.height);
    // 跑道线
    x.fillStyle = "#1a3d1a";
    x.fillRect(0,70,c.width,40);
    x.fillStyle = "#2d9400";
    for(let i=0;i<c.width;i+=16) x.fillRect(i,70,8,40);
    // 像素马横向跑
    const px = (mapHorseT*2) % (c.width+40) - 20;
    const py = 78;
    const frame = Math.floor(mapHorseT/6)%2;
    const body = "#b8733a", dark = "#6b3a20";
    x.fillStyle = body;
    x.fillRect(px, py, 24, 10);
    x.fillRect(px+20, py-6, 8, 8);
    x.fillStyle = dark;
    x.fillRect(px+18, py-8, 4, 6);
    x.fillRect(px-4, py+2, 5, 3);
    // 腿
    x.fillStyle = body;
    if(frame===0){
      x.fillRect(px+4, py+10, 3, 8);
      x.fillRect(px+18, py+10, 3, 8);
    } else {
      x.fillRect(px+8, py+10, 3, 8);
      x.fillRect(px+14, py+10, 3, 8);
    }
    // 骑师
    x.fillStyle = "#ff004d";
    x.fillRect(px+8, py-8, 8, 8);
    x.fillStyle = "#ffd800";
    x.fillRect(px+10, py-12, 4, 4);
    requestAnimationFrame(loop);
  }
  loop();
}

/* ===================== 启动 ===================== */
gsLoad();
/* 新档送一匹赛马 */
if(!GameState.stable || GameState.stable.length === 0){
  GameState.stable = [{
    poolId: 8, level: 1, exp: 0, fatigue: 0,
    baseSpeed: 0.95, baseStamina: 0.95, baseBurst: 0.15, baseConsistency: 1.0,
    trained:{speed:0,stamina:0,burst:0,consistency:0},
  }];
  gsSave();
}
syncCoinDisplays();
showView("map");

$("goRace").onclick = ()=>showView("race");
$("goPoker").onclick = ()=>showView("poker");
$("goBlackjack").onclick = ()=>showView("blackjack");
$("raceBack").onclick = ()=>showView("map");
$("pokerBack").onclick = ()=>showView("map");
$("bjBack").onclick = ()=>showView("map");
