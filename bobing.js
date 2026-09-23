/* ===================== 博饼坊：六骰博状元 =====================
 * 6 骰子取最高奖单一结算：一秀1.0 二举1.2 四进1.5 三红2.5
 * 对堂4 状元10 插金花30 罚黑0（RTP≈95.6%，娱乐场略负期望）
 * 灌铅骰子：本局每骰 P(4)=1/4（RTP≈146.7%，VIP 大注才有赚头）
 * 一局耗时 5 分钟；VIP 桌（解锁后）注码 5,000 / 10,000。
 * ============================================================ */
const BOBING_MULT = {jin:30, zhuang:10, duitang:4, sijin:1.5, sanhong:2.5, erju:1.2, yixiu:1.0, hei:0};
const BOBING_NAME = {jin:"状元插金花", zhuang:"状元", duitang:"对堂", sijin:"四进", sanhong:"三红", erju:"二举", yixiu:"一秀", hei:"罚黑"};
const BOBING_CHIPS = {normal:[100,500,1000], vip:[5000,10000]};

function bobingEval(d){
  const c4 = d.filter(x=>x===4).length;
  const isShunzi = new Set(d).size===6;
  if(c4===4 && d.filter(x=>x===1).length===2) return "jin";
  if(c4===4) return "zhuang";
  if(isShunzi) return "duitang";
  for(let v=1;v<=6;v++){
    if(v===4) continue;
    if(d.filter(x=>x===v).length===4) return "sijin";
  }
  if(c4===3) return "sanhong";
  if(c4===2) return "erju";
  if(c4===1) return "yixiu";
  return "hei";
}
function bobingRollDie(loaded){
  if(loaded){
    const r = Math.random();
    if(r < 0.25) return 4;
    const seq=[1,2,3,5,6];
    return seq[Math.min(4, Math.floor((r-0.25)/0.15))];
  }
  return 1 + Math.floor(Math.random()*6);
}

const BobingModule = (()=>{
  const state = {mode:"normal", bet:100, loaded:false, busy:false, last:null};
  let animTimer = null;

  function enter(mode){
    if(mode==="vip") state.mode = "vip";
    else state.mode = "normal";
    state.bet = BOBING_CHIPS[state.mode][0];
    state.loaded = false;
    state.busy = false;
    if(animTimer){ clearInterval(animTimer); animTimer=null; }
    render();
  }

  function render(){
    /* 顶栏 */
    $("bbCoinVal").textContent = "G "+GameState.coins.toLocaleString();
    /* 模式切换 */
    const modeBtns = $("bbModeBtns");
    modeBtns.innerHTML = "";
    [["normal","普通桌"],["vip","VIP 桌"]].forEach(([m,label])=>{
      const b = document.createElement("button");
      b.className = "chip-btn"+(state.mode===m?" active":"")+(m==="vip"&&!GameState.vipUnlocked?" locked":"");
      b.textContent = label+(m==="vip"&&!GameState.vipUnlocked?" (需G50k)":"");
      b.disabled = (m==="vip"&&!GameState.vipUnlocked);
      b.onclick = ()=>{ state.mode=m; state.bet=BOBING_CHIPS[m][0]; render(); };
      modeBtns.appendChild(b);
    });
    /* 注码 */
    const chipBtns = $("bbChipBtns");
    chipBtns.innerHTML = "";
    BOBING_CHIPS[state.mode].forEach(c=>{
      const b = document.createElement("button");
      b.className = "chip-btn"+(state.bet===c?" active":"");
      b.textContent = "G"+c.toLocaleString();
      b.onclick = ()=>{ state.bet=c; render(); };
      chipBtns.appendChild(b);
    });
    /* 灌铅 */
    const loadedBtn = $("bbLoadedBtn");
    const have = cheatCount("dice");
    if(have>0 || state.loaded){
      loadedBtn.classList.remove("hidden");
      loadedBtn.textContent = state.loaded ? "灌铅已下（本局 4 点翻倍）" : "用灌铅骰子（剩 "+have+"）";
      loadedBtn.classList.toggle("active", state.loaded);
      loadedBtn.disabled = state.loaded || state.busy;
    } else {
      loadedBtn.classList.add("hidden");
    }
    /* 赔率表 */
    const table = $("bbTable");
    table.innerHTML = Object.entries(BOBING_MULT).map(([k,m])=>{
      return `<div class="bb-trow ${k==="hei"?"loss":""}"><span>${BOBING_NAME[k]}</span><span>${m===0?"输注":m+"x"}</span></div>`;
    }).join("");
    /* 结果区 */
    const res = $("bbResult");
    if(state.last){
      res.innerHTML = `<div class="bb-dice-row">${state.last.d.map(p=>`<div class="bb-die"><span>${p}</span></div>`).join("")}</div>
        <div class="bb-resline ${state.last.key==="hei"?"loss":"win"}">${BOBING_NAME[state.last.key]}</div>
        <div class="bb-resmoney">${state.last.amount>=0?"+"+state.last.amount.toLocaleString():state.last.amount.toLocaleString()} G</div>`;
    } else {
      res.innerHTML = `<div class="bb-dice-row">${[0,0,0,0,0,0].map(()=>`<div class="bb-die empty"></div>`).join("")}</div>
        <div class="bb-resline muted">掷骰定状元</div>`;
    }
  }

  function roll(){
    if(state.busy) return;
    if(GameState.runEnded) return;
    if(!canSpend(5)){ toast("时间不够开一局博饼了"); return; }
    if(GameState.coins < state.bet){ toast("金币不足"); return; }
    state.busy = true;
    addCoins(-state.bet);
    advanceClock(5); // 先推进时间（内含结算后事件）
    const loaded = state.loaded;
    state.loaded = false;
    const d = [0,0,0,0,0,0].map(()=>bobingRollDie(loaded));
    /* 掷骰动画：快速换点 */
    const resEl = $("bbResult");
    const rowEl = document.createElement("div");
    rowEl.className = "bb-dice-row";
    resEl.innerHTML = "";
    resEl.appendChild(rowEl);
    const dies = d.map(p=>{
      const el = document.createElement("div");
      el.className = "bb-die";
      const s = document.createElement("span");
      el.appendChild(s);
      rowEl.appendChild(el);
      return {el,s,final:p};
    });
    let tick = 0;
    if(animTimer) clearInterval(animTimer);
    animTimer = setInterval(()=>{
      tick++;
      dies.forEach(({s})=>{
        s.textContent = bobingRollDie(false);
      });
      if(tick >= 8){
        clearInterval(animTimer); animTimer=null;
        const key = bobingEval(d);
        const amount = Math.round(state.bet * BOBING_MULT[key]);
        if(amount>0) addCoins(amount);
        dies.forEach(({s,final})=>{ s.textContent = final; });
        state.last = {d, key, amount: amount - state.bet};
        state.busy = false;
        render();
        toast(loaded ? "灌铅骰子：本局掷出 "+BOBING_NAME[key] : "掷出 "+BOBING_NAME[key]);
        businessTick();
      }
    }, 90);
  }

  /* ---------- 事件绑定 ---------- */
  $("bbRoll").onclick = ()=>roll();
  $("bbLoadedBtn").onclick = ()=>{
    if(state.busy || state.loaded) return;
    if(cheatCount("dice")<=0) return;
    if(useCheat("dice", "normal")){
      state.loaded = true;
      render();
      toast("灌铅骰子已下 · 本局 4 点概率翻倍");
    } else {
      render();
    }
  };

  return { enter, render, roll };
})();
