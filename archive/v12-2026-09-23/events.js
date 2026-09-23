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
/* ===================== 随机事件：富婆 / 黑道 / 市井 =====================
 * pre  ：进入赌场时 roll（18%）
 * post ：每局结算后 roll（18%，由 advanceClock 调用）
 * 金额按身家比例缩放；部分事件为选项弹窗；高利贷登记 debt 分期扣款。
 * ===================================================================== */
const EVENT_CHANCE = 0.18;

/* ---- 工具 ---- */
function rnd(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function pctAmt(minPct, maxPct, floorAmt, capAmt){
  const base = GameState.coins;
  let v = Math.floor(base * (minPct + Math.random()*(maxPct-minPct)));
  if(floorAmt && v < floorAmt) v = floorAmt;
  if(capAmt && v > capAmt) v = capAmt;
  return v;
}

/* ---- 弹窗 ---- */
function showEventModal(title, bodyHTML, buttons){
  const m = $("eventModal");
  if(!m) return;
  $("evTitle").textContent = title;
  $("evBody").innerHTML = bodyHTML;
  const btns = $("evBtns");
  btns.innerHTML = "";
  buttons.forEach(b=>{
    const el = document.createElement("button");
    el.className = "btn-primary ev-btn";
    el.textContent = b.label;
    el.onclick = ()=>{ hideEventModal(); if(b.fn) b.fn(); };
    btns.appendChild(el);
  });
  m.classList.remove("hidden");
}
function hideEventModal(){
  const m = $("eventModal");
  if(m) m.classList.add("hidden");
}

/* ---- 事件库 ---- */
const EVENTS_PRE = [
  {name:"富婆撒钱", w:1, run(){
    const v = pctAmt(0.03,0.08,200,8000);
    addCoins(v); toast("富婆心情好，撒了一把零花钱 +G"+v.toLocaleString()); }},
  {name:"富婆抛硬币", w:1, run(){
    showEventModal("富婆抛硬币",
      "阔太拿出金币：“猜正反，猜中这沓钱归你，猜错赔我一半。”<br>（赢了 +10% 身家，输了 -5%）",
      [{label:"猜正", fn(){
        if(Math.random()<0.5){ const v=pctAmt(0.10,0.10,300,20000); addCoins(v); toast("猜中了！+G"+v.toLocaleString()); }
        else { const v=pctAmt(0.05,0.05,200,10000); addCoins(-v); toast("猜错了 -G"+v.toLocaleString()); }
      }},{label:"猜反", fn(){
        if(Math.random()<0.5){ const v=pctAmt(0.10,0.10,300,20000); addCoins(v); toast("猜中了！+G"+v.toLocaleString()); }
        else { const v=pctAmt(0.05,0.05,200,10000); addCoins(-v); toast("猜错了 -G"+v.toLocaleString()); }
      }},{label:"婉拒", fn(){ toast("你摆摆手，富婆哼了一声走了"); }}]); }},
  {name:"黑道收保护费", w:1, run(){
    const v = pctAmt(0.04,0.07,100,15000);
    addCoins(-v); toast("黑道大哥伸手：保护费 -G"+v.toLocaleString()); }},
  {name:"黑道递烟", w:1, run(){
    addCoins(-50); toast("道上兄弟递烟寒暄，破费 -G50（人情世故）"); }},
  {name:"醉汉撒钱", w:1, run(){
    const v=rnd(100,500); addCoins(v); toast("醉汉把钱当纸撒，你捡到 +G"+v.toLocaleString()); }},
  {name:"小偷摸包", w:1, run(){
    showEventModal("小偷摸包",
      "一个瘦小子贴着你的口袋挤过去，钱包已到半空。",
      [{label:"追！", fn(){
        if(Math.random()<0.6){ const v=rnd(200,500); addCoins(v); toast("追上了，钱包+见义勇为赏 +G"+v.toLocaleString()); }
        else { const v=rnd(100,300); addCoins(-v); toast("没追上，还摔了一跤 -G"+v.toLocaleString()); }
      }},{label:"认栽", fn(){
        const v=rnd(150,400); addCoins(-v); toast("钱包没了 -G"+v.toLocaleString()); }}]); }},
  {name:"老赌棍指点", w:1, run(){
    const v=rnd(50,300); addCoins(v); toast("老赌棍讲了两句门道，你请他吃茶 +G"+v.toLocaleString()+"（他给的）"); }},
  {name:"高利贷", w:1, run(){
    showEventModal("高利贷",
      "柜台后探出一张脸：“借你 G1,500，接下来 3 局每局还我 G300，干不干？”",
      [{label:"借", fn(){
        addCoins(1500); GameState.debt=3; GameState.debtPer=300; gsSave();
        toast("借到 G1,500 · 之后 3 局每局自动扣 G300");
      }},{label:"不借", fn(){ toast("你摇摇头走了"); }}]); }},
  {name:"发牌员多给", w:1, run(){
    addCoins(100); toast("发牌员数错了筹码，多给你 +G100"); }},
  {name:"停电补偿", w:1, run(){
    addCoins(200); toast("赌场停电两秒，经理发补偿 +G200"); }},
  {name:"算命先生", w:1, run(){
    showEventModal("算命先生",
      "街角瞎子拉住你：“G100 一卦，算算你今晚的手气。”",
      [{label:"算一卦", fn(){
        addCoins(-100);
        if(Math.random()<0.6){ const v=rnd(300,800); addCoins(v); toast("“财星高照！” +G"+v.toLocaleString()); }
        else { const v=rnd(200,400); addCoins(-v); toast("“印堂发黑，破财消灾” -G"+v.toLocaleString()); }
      }},{label:"走人", fn(){ toast("你甩开袖子走了"); }}]); }},
  {name:"赛场记者", w:1, run(){
    toast("小报记者拦住你问手气，你随口胡吹了两句"); }},
];

const EVENTS_POST = [
  {name:"富婆看你赢钱", w:1, run(){
    const v = pctAmt(0.02,0.05,150,6000);
    addCoins(v); toast("富婆看你手气好，赏了你一杯酒 +G"+v.toLocaleString()); }},
  {name:"富婆吃醋", w:1, run(){
    addCoins(-100); toast("富婆见你多看了荷官一眼，甩来一巴掌 -G100"); }},
  {name:"黑道收保护费", w:1, run(){
    const v = pctAmt(0.03,0.06,100,12000);
    addCoins(-v); toast("出了门就被拦下：保护费 -G"+v.toLocaleString()); }},
  {name:"黑道火并", w:1, run(){
    if(Math.random()<0.5){ const v=rnd(300,800); addCoins(-v); toast("两帮火并殃及池鱼，医药费 -G"+v.toLocaleString()); }
    else { const v=rnd(200,600); addCoins(v); toast("混乱中有人掉了一沓钱，你捡到 +G"+v.toLocaleString()); } }},
  {name:"黑道找你打牌", w:1, run(){
    showEventModal("黑道找你打牌",
      "道上兄弟拉你去后屋搓牌：“来一把？赢了归你，输了算你的。”（耗时 10 分钟，输赢 ±8% 身家）",
      [{label:"打", fn(){
        advanceClock(10);
        if(Math.random()<0.5){ const v=pctAmt(0.08,0.08,400,30000); addCoins(v); toast("后屋赢麻了 +G"+v.toLocaleString()); }
        else { const v=pctAmt(0.06,0.06,300,20000); addCoins(-v); toast("后屋输光了 -G"+v.toLocaleString()); }
      }},{label:"推掉", fn(){
        addCoins(-100); toast("借口肚子疼推掉，赔笑 -G100"); }}]); }},
  {name:"醉汉吐你一身", w:1, run(){
    addCoins(-100); toast("醉汉吐了你一身，清洗费 -G100"); }},
  {name:"小偷混在人群", w:1, run(){
    const v=rnd(200,500); addCoins(-v); toast("散场时钱包被顺走 -G"+v.toLocaleString()); }},
  {name:"老赌棍请客", w:1, run(){
    const v=rnd(50,200); addCoins(v); toast("老赌棍赢钱请客，分你一杯羹 +G"+v.toLocaleString()); }},
  {name:"高利贷上门", w:1, run(){
    addCoins(-300); toast("高利贷来收利息 -G300"); }},
  {name:"捡到钱包", w:1, run(){
    showEventModal("捡到钱包",
      "地上躺着一个鼓鼓的钱包。",
      [{label:"私吞", fn(){
        if(Math.random()<0.7){ addCoins(400); toast("数了数，G400 到手"); }
        else { addCoins(-800); toast("失主带人追来，赔了 + 医药费 -G800"); }
      }},{label:"归还", fn(){
        addCoins(100);
        if(Math.random()<0.3){ addCoins(500); toast("失主千恩万谢，谢礼 +G600"); }
        else { toast("失主道了声谢，给你 +G100"); }
      }}]); }},
  {name:"保安查房", w:1, run(){
    const ids = Object.keys(GameState.cheats).filter(k=>GameState.cheats[k]>0 && k!=="pardon");
    if(ids.length>0){
      const id = ids[Math.floor(Math.random()*ids.length)];
      addCheat(id,-1);
      const it = CHEAT_ITEMS.find(x=>x.id===id);
      toast("保安搜身，"+ (it?it.name:"道具") +"被没收了！");
    } else {
      addCoins(-100); toast("保安查房，破财消灾 -G100"); } }},
  {name:"深夜粥摊", w:1, run(){
    if(Math.random()<0.6){ addCoins(-20); toast("深夜粥摊喝了一碗，-G20"); }
    else { addCoins(30); toast("粥摊老板多找了你 G30"); } }},
];

/* ---- 主入口：rollEvent(phase) ---- */
function rollEvent(phase){
  if(GameState.runEnded) return;
  if(Math.random() >= EVENT_CHANCE) return;
  const pool = phase==="pre" ? EVENTS_PRE : EVENTS_POST;
  const total = pool.reduce((s,e)=>s+e.w, 0);
  let r = Math.random()*total;
  let ev = pool[0];
  for(const e of pool){ r -= e.w; if(r<=0){ ev=e; break; } }
  if(phase==="post"){
    /* 延迟弹出，避免盖住结算弹窗 */
    setTimeout(()=>ev.run(), 700);
  } else {
    ev.run();
  }
}
