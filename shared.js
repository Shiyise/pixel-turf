/* ===================== 共享状态 / 地图 / 存档 ===================== */
const SAVE_KEY = "pixelcasino1";

const GameState = {
  coins: 1000,
  // 赛马
  streak: 0,
  raceNo: 1,
  dex: [],
  stable: [],
  // 置业 / VIP
  assets: {},          // 已购资产 id -> true
  vipUnlocked: false,  // 历史净资产曾达到门槛即永久解锁
};

/* 可购置业：每在任意场所结算一局，所有生意按 income 发一次分红 */
const PROPERTIES = [
  {id:"bar",    name:"街角酒吧",   price:5000,   income:120,  mark:"酒", place:null},
  {id:"track",  name:"赛马场股份", price:25000,  income:600,  mark:"马", place:"goRace"},
  {id:"room",   name:"扑克室",     price:80000,  income:2000, mark:"牌", place:"goPoker"},
  {id:"book",   name:"博彩公司",   price:200000, income:5000, mark:"彩", place:"goFootball"},
  {id:"casino", name:"PIXEL 赌场", price:500000, income:15000,mark:"赌", place:"goBlackjack"},
];
const VIP_THRESHOLD = 50000;

function gsSave(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      coins: GameState.coins,
      streak: GameState.streak,
      raceNo: GameState.raceNo,
      dex: GameState.dex,
      stable: GameState.stable,
      assets: GameState.assets,
      vipUnlocked: GameState.vipUnlocked,
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
    if(d.assets && typeof d.assets === "object") GameState.assets = d.assets;
    if(typeof d.vipUnlocked === "boolean") GameState.vipUnlocked = d.vipUnlocked;
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
  // 净资产历史峰值达门槛：永久解锁 VIP 厅
  if(n > 0 && !GameState.vipUnlocked && GameState.coins >= VIP_THRESHOLD){
    GameState.vipUnlocked = true;
    setTimeout(()=>toast("身家破 G50,000 · VIP 厅已解锁"), 300);
  }
  syncCoinDisplays();
  gsSave();
}

/* 营业分红：任意场所每结算一局调用一次 */
function businessTick(){
  let inc = 0, cnt = 0;
  PROPERTIES.forEach(p=>{
    if(GameState.assets[p.id]){ inc += p.income; cnt++; }
  });
  if(inc > 0){
    addCoins(inc);
    setTimeout(()=>toast(cnt+" 处生意分红 +G"+inc.toLocaleString()), 2000);
  }
}

/* 置业购买（两段确认由 UI 传入 confirm=true 完成） */
function buyProperty(id, confirm){
  const p = PROPERTIES.find(x=>x.id===id);
  if(!p || GameState.assets[id]) return false;
  if(GameState.coins < p.price){ toast("金币不足，还差 G"+(p.price-GameState.coins)); return false; }
  if(!confirm){ toast("再点一次确认购买 "+p.name+"（G"+p.price+"）"); return false; }
  addCoins(-p.price);
  GameState.assets[id] = true;
  gsSave();
  toast("成交！买下 "+p.name);
  renderMapProperty();
  return true;
}
function syncCoinDisplays(){
  const v = GameState.coins;
  ["mapCoins","mapCoinsVip","coinVal","pokerCoinVal","bjCoinVal","fbCoinVal"].forEach(id=>{
    const el = $(id);
    if(el) el.textContent = v;
  });
}

/* ===================== 视图切换 ===================== */
function showView(name, opts){
  opts = opts || {};
  ["map","race","poker","blackjack","football","vip"].forEach(v=>{
    $("view-"+v).classList.toggle("hidden", v!==name);
  });
  syncCoinDisplays();
  if(name === "map"){
    drawMapHorse();
    renderMapProperty();
  }
  if(name === "race" && typeof RaceModule !== "undefined"){
    RaceModule.enter();
  }
  if(name === "poker" && typeof PokerModule !== "undefined"){
    PokerModule.enter(opts.vip ? "vip" : (opts.normal ? "normal" : undefined));
  }
  if(name === "blackjack" && typeof BlackjackModule !== "undefined"){
    BlackjackModule.enter(opts.vip ? "vip" : (opts.normal ? "normal" : undefined));
  }
  if(name === "football" && typeof FootballModule !== "undefined"){
    FootballModule.enter();
  }
}

/* ===================== 地图：地产 / VIP 厅状态 ===================== */
function renderMapProperty(){
  // 地产列表
  const list = $("propList");
  if(list){
    list.innerHTML = "";
    PROPERTIES.forEach(p=>{
      const owned = !!GameState.assets[p.id];
      const row = document.createElement("div");
      row.className = "prop-row"+(owned?" owned":"");
      row.innerHTML = `
        <div class="prop-icon">${p.mark}</div>
        <div class="prop-info">
          <div class="prop-name">${p.name}${owned?' <span class="prop-badge">经营中</span>':''}</div>
          <div class="prop-desc">${owned ? ("每局分红 G"+p.income) : ("每局分红 G"+p.income+" · 售价 G"+p.price.toLocaleString())}</div>
        </div>
        <button class="prop-btn" data-buy="${p.id}" ${owned?"disabled":""}>${owned?"已拥有":"购买"}</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll("[data-buy]").forEach(btn=>{
      btn.onclick=()=>{
        const id = btn.dataset.buy;
        if(btn.dataset.confirm==="1"){
          buyProperty(id, true);
        } else {
          buyProperty(id, false);
          btn.dataset.confirm="1";
          btn.textContent="确认？";
          btn.classList.add("confirm");
          clearTimeout(btn._t);
          btn._t=setTimeout(()=>{ btn.dataset.confirm="0"; btn.textContent="购买"; btn.classList.remove("confirm"); }, 2600);
        }
      };
    });
  }
  // 每局总收入
  const income = PROPERTIES.reduce((s,p)=>s+(GameState.assets[p.id]?p.income:0),0);
  const ownedCnt = PROPERTIES.filter(p=>GameState.assets[p.id]).length;
  const sumEl = $("propIncome");
  if(sumEl) sumEl.textContent = ownedCnt ? ("已置 "+ownedCnt+" 处产业 · 每局分红 G"+income) : "还没有产业 · 赢钱后买下生意，每局自动分红";
  // 场所卡股东角标
  PROPERTIES.forEach(p=>{
    if(!p.place) return;
    const card = $(p.place);
    if(!card) return;
    let tag = card.querySelector(".owned-tag");
    if(GameState.assets[p.id]){
      if(!tag){
        tag = document.createElement("span");
        tag.className="owned-tag";
        tag.textContent="股东";
        card.appendChild(tag);
      }
    } else if(tag) tag.remove();
  });
  // VIP 厅卡片
  const vipCard = $("goVip");
  if(vipCard){
    if(GameState.vipUnlocked){
      vipCard.classList.remove("locked");
      vipCard.querySelector(".vip-lock-text").textContent="高注专厅 · 21 点与德州的万元赌局";
    } else {
      vipCard.classList.add("locked");
      vipCard.querySelector(".vip-lock-text").textContent="锁定 · 身家达到 G50,000 解锁";
    }
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
$("goPoker").onclick = ()=>showView("poker",{normal:true});
$("goBlackjack").onclick = ()=>showView("blackjack",{normal:true});
$("goFootball").onclick = ()=>showView("football");
$("goVip").onclick = ()=>{
  if(!GameState.vipUnlocked){ toast("身家达到 G50,000 解锁 VIP 厅"); return; }
  showView("vip");
};
$("goVipBlackjack").onclick = ()=>showView("blackjack",{vip:true});
$("goVipPoker").onclick = ()=>showView("poker",{vip:true});
$("vipBack").onclick = ()=>showView("map");
$("raceBack").onclick = ()=>showView("map");
$("pokerBack").onclick = ()=>showView("map");
$("bjBack").onclick = ()=>showView("map");
$("fbBack").onclick = ()=>showView("map");
