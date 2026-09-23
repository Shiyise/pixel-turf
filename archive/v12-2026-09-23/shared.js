/* ============================================================
 * ARCHIVED SNAPSHOT | v12 (2026-09-23, commit 70884e9)
 * PIXEL TURF ARCHIVED SNAPSHOT - v12 (2026-09-23, commit 70884e9)
 * scope: race(bet/stable/train/breed/fatigue/cup/dex/sell/rumors/dope)
 *        poker(cash/SNG/side-pot/spy-glass), blackjack(ALL-IN/3:2/swapper)
 *        football(20 teams/11v11/3 markets/pixel live/S-A-B-C tiers/bribes)
 *        blackmarket(5 cheat items/wanted/blackout), bobing(6 dice/loaded dice)
 *        random events(pre/post 18pct, rich-lady/gang/loan-shark etc.)
 *        property(5 businesses/dividend), VIP lounge, night-run(G100k goal)
 * READ-ONLY snapshot - do not develop here.
 * ============================================================ */
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
  vipUnlocked: false,  // 本夜净资产曾达到门槛即解锁（新一夜重置）
  // 一夜通关
  clock: 0,            // 当前夜钟（分钟，18:00=1080）
  nightNo: 1,          // 第几夜
  wins: 0,             // 累计通关次数
  bestPeak: 0,         // 历史最高身家（跨夜保留）
  runEnded: false,     // 本夜是否已结算
  // 暗巷黑市 / 随机事件
  cheats: {},          // 道具栏 id -> 数量（本夜有效）
  wanted: 0,           // 本夜被抓次数（满 3 次黑市封杀）
  blackout: false,     // 黑市是否已被封杀
  debt: 0,             // 高利贷：剩余扣款局数
  debtPer: 0,          // 高利贷：每局扣款额
};

/* 一夜通关：18:00 开始，次日 05:00 结束 */
const NIGHT_START = 18*60;   // 1080
const NIGHT_END   = 29*60;   // 1740（把次日时间按 24h 延展）
const NIGHT_GOAL  = 100000;  // 天亮前金币达标即通关

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
      clock: GameState.clock,
      nightNo: GameState.nightNo,
      wins: GameState.wins,
      bestPeak: GameState.bestPeak,
      runEnded: GameState.runEnded,
      cheats: GameState.cheats,
      wanted: GameState.wanted,
      blackout: GameState.blackout,
      debt: GameState.debt,
      debtPer: GameState.debtPer,
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
    if(typeof d.clock === "number") GameState.clock = d.clock;
    if(typeof d.nightNo === "number") GameState.nightNo = d.nightNo;
    if(typeof d.wins === "number") GameState.wins = d.wins;
    if(typeof d.bestPeak === "number") GameState.bestPeak = d.bestPeak;
    if(typeof d.runEnded === "boolean") GameState.runEnded = d.runEnded;
    if(d.cheats && typeof d.cheats === "object") GameState.cheats = d.cheats;
    if(typeof d.wanted === "number") GameState.wanted = d.wanted;
    if(typeof d.blackout === "boolean") GameState.blackout = d.blackout;
    if(typeof d.debt === "number") GameState.debt = d.debt;
    if(typeof d.debtPer === "number") GameState.debtPer = d.debtPer;
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
  if(GameState.coins > GameState.bestPeak) GameState.bestPeak = GameState.coins;
  // 本夜净资产峰值达门槛：解锁 VIP 厅（新一夜重新锁）
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

/* ===================== 一夜通关：时钟 / 结算 / 重开 ===================== */
function fmtClock(m){
  const h = Math.floor(m/60)%24, mm = m%60;
  return String(h).padStart(2,"0")+":"+String(mm).padStart(2,"0");
}
function nightLeft(){ return NIGHT_END-GameState.clock; }
function canSpend(mins){ return !GameState.runEnded && GameState.clock+mins<=NIGHT_END; }

/* 顶栏时钟：同步所有 .night-clock */
function syncClock(){
  const txt = fmtClock(GameState.clock);
  document.querySelectorAll(".night-clock").forEach(el=>{ el.textContent = txt; });
}

/* 一局结束推进时间；到 05:00 结算一夜 */
function advanceClock(mins){
  if(GameState.runEnded) return;
  GameState.clock = Math.min(NIGHT_END, GameState.clock+mins);
  syncClock();
  renderGoalPanel();
  if(GameState.clock>=NIGHT_END){ endNight(false); return; }
  /* 高利贷分期扣款（事件系统登记） */
  if(GameState.debt>0 && GameState.debtPer>0){
    const pay = Math.min(GameState.coins, GameState.debtPer);
    GameState.coins -= pay;
    GameState.debt--;
    if(GameState.coins<=0) GameState.coins = 0;
    syncCoinDisplays();
    if(pay>0) toast("高利贷还款 -G"+pay+"（剩 "+GameState.debt+" 局）");
  }
  /* 结算后随机事件 */
  if(typeof rollEvent === "function") rollEvent("post");
  gsSave();
}

/* 地图"今晚目标"面板 */
function renderGoalPanel(){
  const coins = GameState.coins;
  const pct = Math.max(0, Math.min(100, Math.floor(coins/NIGHT_GOAL*100)));
  const bar = $("goalBarFill"); if(bar) bar.style.width = pct+"%";
  const pctEl = $("goalPct"); if(pctEl) pctEl.textContent = pct+"%";
  const nowEl = $("goalNow"); if(nowEl) nowEl.textContent = "G"+coins.toLocaleString();
  const ltEl = $("goalLeftTime"); if(ltEl) ltEl.textContent = fmtClock(GameState.clock)+" · 距天亮 "+fmtClock(nightLeft());
  const metaEl = $("goalMeta"); if(metaEl) metaEl.textContent = "第 "+GameState.nightNo+" 夜 · 已通关 "+GameState.wins+" 次 · 最高身家 G"+GameState.bestPeak.toLocaleString();
  const retire = $("btnRetire");
  if(retire){
    const ready = coins>=NIGHT_GOAL;
    retire.disabled = !ready;
    retire.classList.toggle("ready", ready);
    retire.textContent = ready ? "功成身退 · 锁定通关" : "尚未达标 G100,000";
  }
}

/* 一夜结算 */
function endNight(manual){
  if(GameState.runEnded) return;
  GameState.runEnded = true;
  const win = GameState.coins>=NIGHT_GOAL;
  if(win) GameState.wins++;
  if(GameState.coins>GameState.bestPeak) GameState.bestPeak = GameState.coins;
  gsSave();
  showNightResult(win, manual);
}

/* 开始新一夜：清空 run 层（金币/产业/VIP/时钟/黑市/事件），保留 meta 层（马厩/图鉴/统计） */
function startNewNight(){
  GameState.nightNo++;
  GameState.coins = 1000;
  GameState.assets = {};
  GameState.vipUnlocked = false;
  GameState.clock = NIGHT_START;
  GameState.runEnded = false;
  GameState.cheats = {};
  GameState.wanted = 0;
  GameState.blackout = false;
  GameState.debt = 0;
  GameState.debtPer = 0;
  hideNightResult();
  if(typeof hideEventModal === "function") hideEventModal();
  gsSave();
  syncCoinDisplays();
  syncClock();
  showView("map");
  toast("第 "+GameState.nightNo+" 夜开始 · 本金 G1,000");
}

/* 结算弹窗 */
function showNightResult(win, manual){
  const ov = $("nightResult");
  ov.classList.add("show");
  ov.classList.toggle("win", win);
  ov.classList.toggle("lose", !win);
  $("nrTitle").textContent = win ? "一夜通关！" : "天亮了";
  $("nrSub").textContent = win
    ? (manual ? "你在日出前功成身退" : "你撑到了最后，身家达标")
    : "未能在 05:00 前赚到 G100,000";
  $("nrCoins").textContent = "最终身家 G"+GameState.coins.toLocaleString();
  $("nrMeta").textContent = "第 "+GameState.nightNo+" 夜 · 累计通关 "+GameState.wins+" 次 · 历史最高 G"+GameState.bestPeak.toLocaleString();
}
function hideNightResult(){
  $("nightResult").classList.remove("show","win","lose");
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
  ["mapCoins","mapCoinsVip","coinVal","pokerCoinVal","bjCoinVal","fbCoinVal","bmCoinVal","bbCoinVal"].forEach(id=>{
    const el = $(id);
    if(el) el.textContent = v;
  });
}

/* ===================== 视图切换 ===================== */
function showView(name, opts){
  opts = opts || {};
  ["map","race","poker","blackjack","football","vip","blackmarket","bobing"].forEach(v=>{
    $("view-"+v).classList.toggle("hidden", v!==name);
  });
  syncCoinDisplays();
  syncClock();
  if(name === "map"){
    drawMapHorse();
    renderMapProperty();
    renderGoalPanel();
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
  if(name === "blackmarket" && typeof CheatModule !== "undefined"){
    CheatModule.enter();
  }
  if(name === "bobing" && typeof BobingModule !== "undefined"){
    BobingModule.enter(opts.vip ? "vip" : "normal");
  }
  /* 赌前随机事件（黑市与地图不触发） */
  if(["race","poker","blackjack","football","bobing"].indexOf(name)>=0
     && typeof rollEvent === "function"){
    rollEvent("pre");
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
/* 新档 / 旧档迁移：补合法夜钟 */
if(typeof GameState.clock!=="number" || GameState.clock<NIGHT_START) GameState.clock=NIGHT_START;
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
/* 上次停在结算弹窗：恢复它 */
if(GameState.runEnded){ showNightResult(GameState.coins>=NIGHT_GOAL, false); }

$("goRace").onclick = ()=>showView("race");
$("goPoker").onclick = ()=>showView("poker",{normal:true});
$("goBlackjack").onclick = ()=>showView("blackjack",{normal:true});
$("goFootball").onclick = ()=>showView("football");
$("goVip").onclick = ()=>{
  if(!GameState.vipUnlocked){ toast("身家达到 G50,000 解锁 VIP 厅"); return; }
  showView("vip");
};
$("goBlackmarket").onclick = ()=>showView("blackmarket");
$("goBobing").onclick = ()=>showView("bobing",{normal:true});
$("goVipBlackjack").onclick = ()=>showView("blackjack",{vip:true});
$("goVipPoker").onclick = ()=>showView("poker",{vip:true});
$("vipBack").onclick = ()=>showView("map");
$("raceBack").onclick = ()=>showView("map");
$("pokerBack").onclick = ()=>showView("map");
$("bjBack").onclick = ()=>showView("map");
$("fbBack").onclick = ()=>showView("map");
$("bmBack").onclick = ()=>showView("map");
$("bbBack").onclick = ()=>showView("map");

/* 一夜通关按钮 */
$("btnRetire").onclick = ()=>{
  if(GameState.coins>=NIGHT_GOAL) endNight(true);
  else toast("身家达到 G100,000 才能功成身退");
};
$("btnNewNight").onclick = ()=>startNewNight();
