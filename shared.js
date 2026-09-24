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
  bailouts: 0,         // 本夜已领救助金次数（上限 3 次，新一夜重置）
  // 成就 / 结局 / 遗产
  achievements: {},    // 已解锁成就 id -> true（跨夜永久保留）
  seenEndings: {},     // 已打出结局 id -> true（跨夜永久保留）
  nightStats: null,    // 本夜行为统计 {race,poker,bj,fb,bobing,cheats}
  pendingLegacy: null, // 结算时选择的遗产 id（cash/item/asset），开始新夜时应用
};

/* 本夜行为统计的初始结构 */
function freshNightStats(){
  return {race:0, poker:0, bj:0, fb:0, bobing:0, cheats:0};
}

/* 一夜通关：18:00 开始，次日 05:00 结束 */
const NIGHT_START = 18*60;   // 1080
const NIGHT_END   = 29*60;   // 1740（把次日时间按 24h 延展）
const NIGHT_GOAL  = 100000;  // 天亮前金币达标即通关

/* 破产救助：低于最低注码时可领，每夜上限次数 */
const BAILOUT_AMT = 200;
const BAILOUT_MAX = 3;
const MIN_BET = 100;          // 全场最低下注门槛

/* 可购置业：每在任意场所结算一局，所有生意按 income 发一次分红 */
const PROPERTIES = [
  {id:"bar",    name:"街角酒吧",   price:5000,   income:120,  mark:"酒", place:null},
  {id:"track",  name:"赛马场股份", price:25000,  income:600,  mark:"马", place:"goRace"},
  {id:"room",   name:"扑克室",     price:80000,  income:2000, mark:"牌", place:"goPoker"},
  {id:"book",   name:"博彩公司",   price:200000, income:5000, mark:"彩", place:"goFootball"},
  {id:"casino", name:"PIXEL 赌场", price:500000, income:15000,mark:"赌", place:"goBlackjack"},
];
const VIP_THRESHOLD = 50000;

/* ===================== 成就 / 结局 / 遗产 ===================== */
/* 成就清单（16 项）：跨夜永久，解锁后在成就墙高亮 */
const ACHIEVEMENTS = [
  {id:"first_win",  name:"初战告捷",   desc:"首次一夜通关"},
  {id:"no_bailout", name:"自力更生",   desc:"不领救助金通关"},
  {id:"phoenix",    name:"不死鸟",     desc:"领满 3 次救助后仍通关"},
  {id:"cheat_king", name:"千王之王",   desc:"单夜出千 5 次并通关"},
  {id:"tycoon",     name:"地产大亨",   desc:"买齐 5 处产业并通关"},
  {id:"sng_champ",  name:"锦标赛之王", desc:"赢下一场德州 SNG"},
  {id:"bj_streak5", name:"连庄好手",   desc:"21 点连赢 5 手"},
  {id:"bobing_king",name:"金榜题名",   desc:"博饼掷出状元（含插金花）"},
  {id:"dex_all",    name:"相马大师",   desc:"名马图鉴集齐 12 匹"},
  {id:"peak_500k",  name:"半城之主",   desc:"身家峰值达到 G500,000"},
  {id:"vip_once",   name:"贵宾光临",   desc:"首次解锁 VIP 厅"},
  {id:"breeder",    name:"后继有人",   desc:"首次配种生下小马"},
  {id:"seller",     name:"忍痛割爱",   desc:"首次出售马匹"},
  {id:"briber",     name:"暗度陈仓",   desc:"赌球贿赂首次得手"},
  {id:"nights_5",   name:"赌场常客",   desc:"度过 5 个夜晚"},
  {id:"end_all",    name:"结局收藏家", desc:"打出全部 11 种结局"},
];

/* 结局清单：成功 9 种（按优先级判定）+ 失败 2 种 */
const ENDINGS = {
  tycoon:   {win:true,  name:"地产大亨",   desc:"你买下了半座城，赌场都要看你脸色"},
  phoenix:  {win:true,  name:"不死鸟",     desc:"三次谷底爬起，烧尽黑夜的传奇"},
  cheat_king:{win:true, name:"千王之王",   desc:"你的手法比运气更值钱"},
  race:     {win:true,  name:"马王",       desc:"马蹄声是你这一夜的主旋律"},
  poker:    {win:true,  name:"扑克脸",     desc:"你在牌桌上读穿了所有人"},
  bj:       {win:true,  name:"21点之神",   desc:"庄家在你面前抬不起头"},
  fb:       {win:true,  name:"赌球军师",   desc:"你算准了每一场比分"},
  bobing:   {win:true,  name:"博饼状元",   desc:"六粒骰子都听你的话"},
  default:  {win:true,  name:"赌神",       desc:"没有固定套路，你就是赢"},
  bankrupt: {win:false, name:"破产流浪汉", desc:"三次救助也没能救活你"},
  dawn:     {win:false, name:"梦断天亮",   desc:"天亮了，你的十万梦碎在 05:00"},
};
const ENDING_TOTAL = Object.keys(ENDINGS).length;

/* 遗产三选一：开始新夜时三选一（也可放弃不选） */
const LEGACY_CASH = 3000;
const LEGACIES = [
  {id:"cash",  name:"厚启本金", desc:"新一夜以 G3,000 开局（通常只有 G1,000）"},
  {id:"item",  name:"夹带道具", desc:"把一件随机黑市道具带进新夜"},
  {id:"asset", name:"保留产业", desc:"保留你名下价值最高的一处产业"},
];
const LEGACY_ITEMS = ["spy","swap","dope","dice","pardon"];

/* 本夜行为埋点：每在一场所结算一局 */
function trackNight(place){
  if(!GameState.nightStats) GameState.nightStats = freshNightStats();
  if(typeof GameState.nightStats[place] === "number") GameState.nightStats[place]++;
  gsSave();
}
/* 出千埋点：成功使用一件道具 */
function trackCheat(){
  if(!GameState.nightStats) GameState.nightStats = freshNightStats();
  GameState.nightStats.cheats++;
  gsSave();
}

/* 解锁成就（已解锁则静默） */
function unlockAch(id){
  if(GameState.achievements[id]) return false;
  const a = ACHIEVEMENTS.find(x=>x.id===id);
  if(!a) return false;
  GameState.achievements[id] = true;
  gsSave();
  setTimeout(()=>toast("成就解锁 | "+a.name), 400);
  return true;
}

/* 结局判定：按 ENDINGS 优先级取本夜结局 */
function judgeEnding(win){
  const st = GameState.nightStats || freshNightStats();
  const assetCnt = PROPERTIES.filter(p=>GameState.assets[p.id]).length;
  if(!win){
    return GameState.bailouts>=BAILOUT_MAX ? "bankrupt" : "dawn";
  }
  if(assetCnt>=PROPERTIES.length) return "tycoon";
  if(GameState.bailouts>=BAILOUT_MAX) return "phoenix";
  if(st.cheats>=5) return "cheat_king";
  /* 场所路线：取局数最多且至少 3 局者 */
  const places = ["race","poker","bj","fb","bobing"];
  let best = "default", bestN = 3;
  places.forEach(p=>{ if(st[p]>bestN){ bestN=st[p]; best=p; } });
  return best;
}

/* 记录结局，解锁"结局收藏家"；返回本次是否新结局 */
function recordEnding(eid){
  const isNew = !GameState.seenEndings[eid];
  GameState.seenEndings[eid] = true;
  if(Object.keys(GameState.seenEndings).length >= ENDING_TOTAL) unlockAch("end_all");
  gsSave();
  return isNew;
}

/* 选择遗产（结算弹窗内三选一，再点一次可取消） */
function chooseLegacy(id){
  if(id==="asset"){
    const has = PROPERTIES.some(p=>GameState.assets[p.id]);
    if(!has){ toast("你名下没有产业可保留"); return; }
  }
  GameState.pendingLegacy = (GameState.pendingLegacy===id) ? null : id;
  gsSave();
  renderLegacyChoices();
}

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
      bailouts: GameState.bailouts,
      achievements: GameState.achievements,
      seenEndings: GameState.seenEndings,
      nightStats: GameState.nightStats,
      pendingLegacy: GameState.pendingLegacy,
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
    if(typeof d.bailouts === "number") GameState.bailouts = d.bailouts;
    if(d.achievements && typeof d.achievements === "object") GameState.achievements = d.achievements;
    if(d.seenEndings && typeof d.seenEndings === "object") GameState.seenEndings = d.seenEndings;
    if(d.nightStats && typeof d.nightStats === "object") GameState.nightStats = d.nightStats;
    if(typeof d.pendingLegacy === "string") GameState.pendingLegacy = d.pendingLegacy;
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
    unlockAch("vip_once");
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
  renderBailoutBar();
}

/* 领救助金：金币低于最低注码、次数未用完时可领 */
function claimBailout(){
  if(GameState.runEnded){ toast("这一夜已经结束"); return false; }
  if(GameState.coins >= MIN_BET){ toast("你还有钱下注，无需救助"); return false; }
  if(GameState.bailouts >= BAILOUT_MAX){ toast("今夜救助次数已用完，只能重开一夜"); return false; }
  GameState.bailouts++;
  addCoins(BAILOUT_AMT);
  toast("救助金 +G"+BAILOUT_AMT+"（今夜第 "+GameState.bailouts+" 次）");
  renderBailoutBar();
  return true;
}

/* 地图破产操作条：无力下注时出现 */
function renderBailoutBar(){
  const bar = $("bailoutBar");
  if(!bar) return;
  const broke = !GameState.runEnded && GameState.coins < MIN_BET;
  bar.classList.toggle("show", broke);
  const left = BAILOUT_MAX - GameState.bailouts;
  const btn = $("btnClaimBailout");
  if(btn){
    btn.disabled = left<=0;
    btn.textContent = left>0
      ? ("领救助金 G"+BAILOUT_AMT+"（剩 "+left+" 次）")
      : "救助次数已用完";
  }
}

/* 放弃今夜：两段确认后重开（任何卡死状态都能从这里脱身） */
function giveUpNight(confirm){
  if(GameState.runEnded){ startNewNight(); return; }
  if(!confirm){ toast("再点一次确认放弃这一夜，重新开始"); return; }
  startNewNight();
}

/* 一夜结算 */
function endNight(manual){
  if(GameState.runEnded) return;
  GameState.runEnded = true;
  const win = GameState.coins>=NIGHT_GOAL;
  const before = Object.keys(GameState.achievements);
  if(win) GameState.wins++;
  if(GameState.coins>GameState.bestPeak) GameState.bestPeak = GameState.coins;
  /* 结局判定与记录 */
  const eid = judgeEnding(win);
  recordEnding(eid);
  /* 成就判定 */
  const st = GameState.nightStats || freshNightStats();
  const assetCnt = PROPERTIES.filter(p=>GameState.assets[p.id]).length;
  if(win){
    unlockAch("first_win");
    if(GameState.bailouts===0) unlockAch("no_bailout");
    if(GameState.bailouts>=BAILOUT_MAX) unlockAch("phoenix");
    if(st.cheats>=5) unlockAch("cheat_king");
    if(assetCnt>=PROPERTIES.length) unlockAch("tycoon");
  }
  if(GameState.bestPeak>=500000) unlockAch("peak_500k");
  if(GameState.dex.length>=12) unlockAch("dex_all");
  if(GameState.nightNo>=5) unlockAch("nights_5");
  /* 本次新解锁成就（供结算弹窗展示） */
  GameState._newAchs = Object.keys(GameState.achievements)
    .filter(id=>before.indexOf(id)<0);
  gsSave();
  showNightResult(win, manual, eid);
}

/* 开始新一夜：清空 run 层（金币/产业/VIP/时钟/黑市/事件），保留 meta 层（马厩/图鉴/统计） */
function startNewNight(){
  /* 遗产：在清空前算好要保留的产业 */
  const legacy = GameState.pendingLegacy;
  let keepAsset = null;
  if(legacy==="asset"){
    const owned = PROPERTIES.filter(p=>GameState.assets[p.id]);
    if(owned.length) keepAsset = owned.reduce((a,b)=>b.price>a.price?b:a).id;
  }
  GameState.nightNo++;
  GameState.coins = (legacy==="cash") ? LEGACY_CASH : 1000;
  GameState.assets = keepAsset ? {[keepAsset]:true} : {};
  GameState.vipUnlocked = false;
  GameState.clock = NIGHT_START;
  GameState.runEnded = false;
  GameState.cheats = {};
  GameState.wanted = 0;
  GameState.blackout = false;
  GameState.debt = 0;
  GameState.debtPer = 0;
  GameState.bailouts = 0;
  GameState.nightStats = freshNightStats();
  /* 遗产：夹带随机道具 */
  if(legacy==="item"){
    const id = LEGACY_ITEMS[Math.floor(Math.random()*LEGACY_ITEMS.length)];
    GameState.cheats[id] = 1;
  }
  GameState.pendingLegacy = null;
  GameState._newAchs = null;
  hideNightResult();
  if(typeof hideEventModal === "function") hideEventModal();
  gsSave();
  syncCoinDisplays();
  syncClock();
  showView("map");
  let legacyMsg = "";
  if(legacy==="cash") legacyMsg=" | 遗产 厚启本金 G"+LEGACY_CASH;
  else if(legacy==="item") legacyMsg=" | 遗产 夹带道具进夜";
  else if(keepAsset) legacyMsg=" | 遗产 保留产业";
  toast("第 "+GameState.nightNo+" 夜开始 · 本金 G"+GameState.coins.toLocaleString()+legacyMsg);
}

/* 结算弹窗 */
function showNightResult(win, manual, eid){
  const ov = $("nightResult");
  ov.classList.add("show");
  ov.classList.toggle("win", win);
  ov.classList.toggle("lose", !win);
  const end = ENDINGS[eid] || ENDINGS.dawn;
  $("nrTitle").textContent = win ? "一夜通关！" : "天亮了";
  /* 结局称号 */
  const tag = $("nrEnding");
  if(tag){
    tag.textContent = "结局 | " + end.name;
    tag.className = "nr-ending" + (win?" win":" lose");
  }
  const endDesc = $("nrEndingDesc");
  if(endDesc) endDesc.textContent = end.desc;
  $("nrSub").textContent = win
    ? (manual ? "你在日出前功成身退" : "你撑到了最后，身家达标")
    : "未能在 05:00 前赚到 G100,000";
  $("nrCoins").textContent = "最终身家 G"+GameState.coins.toLocaleString();
  /* 本夜新成就 */
  const achBox = $("nrAchs");
  if(achBox){
    const news = GameState._newAchs || [];
    achBox.innerHTML = news.length
      ? news.map(id=>{
          const a = ACHIEVEMENTS.find(x=>x.id===id);
          return '<span class="nr-ach">成就 + '+a.name+'</span>';
        }).join("")
      : '<span class="nr-ach none">本夜无新成就</span>';
  }
  $("nrMeta").textContent = "第 "+GameState.nightNo+" 夜 · 累计通关 "+GameState.wins
    +" 次 · 结局 "+Object.keys(GameState.seenEndings).length+"/"+ENDING_TOTAL
    +" · 历史最高 G"+GameState.bestPeak.toLocaleString();
  /* 遗产选择（重置为未选） */
  GameState.pendingLegacy = null;
  renderLegacyChoices();
}

/* 渲染遗产三选一（结算弹窗内） */
function renderLegacyChoices(){
  const box = $("nrLegacy");
  if(!box) return;
  const owned = PROPERTIES.some(p=>GameState.assets[p.id]);
  box.innerHTML = LEGACIES.map(l=>{
    const sel = GameState.pendingLegacy===l.id;
    const disabled = l.id==="asset" && !owned;
    return '<button class="legacy-btn'+(sel?" sel":"")+(disabled?" disabled":"")
      +'" data-legacy="'+l.id+'"'+(disabled?" disabled":"")+'>'
      +'<b>'+l.name+'</b><small>'+(disabled?"名下无产业":l.desc)+'</small></button>';
  }).join("");
  box.querySelectorAll("[data-legacy]").forEach(b=>{
    b.onclick=()=>chooseLegacy(b.dataset.legacy);
  });
}

/* 渲染成就墙 */
function renderAchievements(){
  const box = $("achList");
  if(!box) return;
  const got = Object.keys(GameState.achievements).length;
  const cnt = $("achCount");
  if(cnt) cnt.textContent = "已解锁 "+got+" / "+ACHIEVEMENTS.length;
  box.innerHTML = ACHIEVEMENTS.map(a=>{
    const on = !!GameState.achievements[a.id];
    return '<div class="ach-item'+(on?" on":"")+'">'
      +'<div class="ach-badge">'+(on?"★":"?")+'</div>'
      +'<div class="ach-info"><div class="ach-name">'+(on?a.name:"？？？")+'</div>'
      +'<div class="ach-desc">'+a.desc+'</div></div></div>';
  }).join("");
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
if(!GameState.nightStats) GameState.nightStats = freshNightStats();
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

/* 成就墙 */
$("btnAchievements").onclick = ()=>{
  renderAchievements();
  $("achModal").classList.add("show");
};
$("achClose").onclick = ()=>$("achModal").classList.remove("show");
$("achModal").addEventListener("click", function(e){
  if(e.target===this) this.classList.remove("show");
});

/* 破产救助条 / 放弃今夜 */
$("btnClaimBailout").onclick = ()=>claimBailout();
$("btnGiveUp").addEventListener("click", function(){
  /* 两段确认：首次点击后 2.6 秒内再点生效 */
  if(this.dataset.confirm!=="1"){
    this.dataset.confirm="1";
    this.textContent="确认放弃？再点一次";
    this.classList.add("confirm");
    clearTimeout(this._t);
    this._t=setTimeout(()=>{ this.dataset.confirm="0"; this.textContent="放弃今夜 · 重新开始"; this.classList.remove("confirm"); }, 2600);
    return;
  }
  giveUpNight(true);
});
/* 目标面板内的放弃按钮：转发给主放弃按钮（复用两段确认） */
$("btnGiveUp2").onclick = ()=>$("btnGiveUp").click();
