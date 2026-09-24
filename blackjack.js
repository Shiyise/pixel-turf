/* ===================== 21 点（Blackjack）模块 =====================
 * 规则：4 副牌靴；A 自动按 1/11 取最优；庄家 17 点停牌（含软 17）；
 * 玩家动作 HIT / STAND / DOUBLE（仅两张牌时，余额不足可押上剩余全部）；
 * 自然黑杰克（A+10）赔 3:2；普通赢赔 1:1；和局退本；爆牌即输。
 * 高注码专桌：筹码 100/500/1000/5000 + ALL-IN，可押上全部身家。
 * =================================================================== */
const BJ_SUITS = ["♠","♥","♦","♣"];
const BJ_RANK = {11:"J",12:"Q",13:"K",14:"A"};

const BlackjackModule = (()=>{
  let shoe=[];
  let bet=0, player=[], dealer=[], phase="bet", result=null, busy=false;
  let vip=false;
  let canSwap=false;   // 换牌器：本局是否可用
  let winStreak=0;     // 连胜手数（和局不变，输牌清零）
  const CHIPS_NORMAL=[100,500,1000,5000];
  const CHIPS_VIP=[5000,10000,50000,100000];
  const chips=()=>vip?CHIPS_VIP:CHIPS_NORMAL;

  /* ---------- 牌靴（4 副） ---------- */
  function buildShoe(){
    shoe=[];
    for(let d=0;d<4;d++)
      for(let s=0;s<4;s++)
        for(let r=2;r<=14;r++) shoe.push({rank:r,suit:s});
    for(let i=shoe.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [shoe[i],shoe[j]]=[shoe[j],shoe[i]];
    }
  }
  function draw(){
    if(shoe.length<20) buildShoe();
    return shoe.pop();
  }

  /* ---------- 点数（A 动态 1/11） ---------- */
  function score(hand){
    let total=0, aces=0;
    hand.forEach(c=>{
      if(c.rank===14){ aces++; total+=11; }
      else total+=Math.min(10,c.rank);
    });
    while(total>21 && aces>0){ total-=10; aces--; }
    return total;
  }
  const isBJ = h => h.length===2 && score(h)===21;

  /* ---------- 流程 ---------- */
  function enter(mode){
    if(mode==="vip") vip=true;
    else if(mode==="normal") vip=false;
    bet=0; player=[]; dealer=[]; phase="bet"; result=null; busy=false;
    canSwap=false;
    // 顶栏标题区分桌台
    const h=document.querySelector("#view-blackjack .brand h1");
    if(h) h.textContent = vip ? "21 VIP" : "21";
    render();
  }

  function addBet(amt){
    if(phase!=="bet") return;
    if(amt==="all") bet=GameState.coins;
    else if(amt==="clear") bet=0;
    else bet=Math.min(GameState.coins, bet+amt);
    render();
  }

  function deal(){
    if(phase!=="bet" || bet<=0) return;
    if(!canSpend(5)){ toast("天亮前打不完这一局了"); render(); return; }
    addCoins(-bet);
    player=[draw(),draw()];
    dealer=[draw(),draw()];
    phase="player"; result=null; busy=false;
    canSwap = cheatCount("swap")>0;
    const pBJ=isBJ(player), dBJ=isBJ(dealer);
    if(pBJ || dBJ){ settle(pBJ,dBJ); return; }
    render();
  }

  /* 换牌器：换掉点数最小的一张（出千，可被抓） */
  function doSwap(){
    if(phase!=="player" || busy) return;
    if(!canSwap || cheatCount("swap")<=0) return;
    if(!useCheat("swap", vip?"vip":"normal")){ canSwap=false; renderControls(); return; }
    canSwap=false;
    let idx = player[0].rank<=player[1].rank ? 0 : 1;
    const oldCard = player[idx];
    player[idx] = draw();
    render();
    if(score(player)>21){
      busy=true;
      setTimeout(()=>settle(false,false,"bust"),480);
    } else {
      toast("换牌成功："+(BJ_RANK[oldCard.rank]||oldCard.rank)+" → "+(BJ_RANK[player[idx].rank]||player[idx].rank));
    }
  }

  function rebet(){
    if(phase!=="done") return;
    if(GameState.coins<bet){ toast("金币不足，重新选注"); enter(); return; }
    phase="bet"; player=[]; dealer=[]; result=null;
    deal();
  }

  function hit(){
    if(phase!=="player" || busy) return;
    player.push(draw());
    if(score(player)>21){
      busy=true; render();
      setTimeout(()=>settle(false,false,"bust"),480);
    } else {
      render();
    }
  }

  function doubleDown(){
    if(phase!=="player" || busy || player.length!==2) return;
    const extra=Math.min(bet, GameState.coins);
    if(extra<=0) return;
    addCoins(-extra); bet+=extra;
    player.push(draw());
    busy=true; render();
    if(score(player)>21) setTimeout(()=>settle(false,false,"bust"),480);
    else setTimeout(dealerPlay,520);
  }

  function stand(){
    if(phase!=="player" || busy) return;
    busy=true;
    dealerPlay();
  }

  function dealerPlay(){
    if(phase!=="player") return;
    phase="dealer";
    render();
    setTimeout(step,650);
  }
  function step(){
    if(phase!=="dealer") return;
    if(score(dealer)<17){
      dealer.push(draw());
      render();
      setTimeout(step,620);
    } else {
      settle(false,false);
    }
  }

  /* ---------- 结算 ---------- */
  function settle(pBJ,dBJ,forced){
    if(phase==="done" || phase==="bet") return;
    phase="done";
    const ps=score(player), ds=score(dealer);
    let ret=0, msg, cls;
    if(forced==="bust" || ps>21){
      msg="BUST · 爆牌"; cls="lose";
    } else if(pBJ && dBJ){
      msg="PUSH · 双方黑杰克"; cls="push"; ret=bet;
    } else if(pBJ){
      msg="BLACKJACK! · 赔率 3:2"; cls="bj"; ret=Math.floor(bet*2.5);
    } else if(dBJ){
      msg="DEALER BLACKJACK"; cls="lose";
    } else if(ds>21){
      msg="DEALER BUST · 庄家爆牌"; cls="win"; ret=bet*2;
    } else if(ps>ds){
      msg="YOU WIN! · "+ps+" 比 "+ds; cls="win"; ret=bet*2;
    } else if(ps<ds){
      msg="DEALER WINS · "+ds+" 比 "+ps; cls="lose";
    } else {
      msg="PUSH · 都是 "+ps; cls="push"; ret=bet;
    }
    result={msg,cls,ret};
    /* 连胜：赢/黑杰克 +1（到 5 解锁），输清零，和局不变 */
    if(cls==="win"||cls==="bj"){ winStreak++; if(winStreak===5) unlockAch("bj_streak5"); }
    else if(cls==="lose") winStreak=0;
    if(ret>0) addCoins(ret);
    if(GameState.coins<MIN_BET) claimBailout();
    businessTick();
    trackNight("bj");
    advanceClock(5);
    render();
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(c){
    const red=c.suit===1||c.suit===2;
    const t=BJ_RANK[c.rank]||c.rank;
    return `<div class="playing-card ${red?'red':'dark'}">
      <span class="rk">${t}</span><span class="st">${BJ_SUITS[c.suit]}</span></div>`;
  }
  const backHTML=()=>'<div class="playing-card back"></div>';

  function render(){
    const hideHole = phase==="player";
    $("bjPlayerHand").innerHTML=player.map(cardHTML).join("");
    $("bjDealerHand").innerHTML=dealer.map((c,i)=>
      (hideHole&&i===1)?backHTML():cardHTML(c)).join("");

    $("bjPlayerScore").textContent=player.length?String(score(player)):"0";
    if(!dealer.length){
      $("bjDealerScore").textContent="?";
    } else if(hideHole){
      const c=dealer[0];
      $("bjDealerScore").textContent=c.rank===14?"11":String(Math.min(10,c.rank));
    } else {
      $("bjDealerScore").textContent=String(score(dealer));
    }

    const banner=$("bjBanner");
    if(result){ banner.textContent=result.msg; banner.className="bj-banner "+result.cls; }
    else { banner.textContent=""; banner.className="bj-banner"; }

    if(phase==="bet"){
      $("bjBetInfo").innerHTML = (vip?'<span style="color:var(--yellow)">VIP 高注桌 · </span>':'')
        + (bet>0
          ? `本局下注 <span style="color:var(--yellow)">G${bet.toLocaleString()}</span> · 黑杰克可赢 G${Math.floor(bet*1.5).toLocaleString()}`
          : "选择筹码下注 · 黑杰克赔 3:2，和局退本");
    } else {
      $("bjBetInfo").innerHTML = `本局下注 <span style="color:var(--yellow)">G${bet}</span>`
        + (result?` · 返还 <span style="color:${result.ret>0?'var(--green)':'var(--muted)'}">G${result.ret||0}</span>`:"");
    }
    renderControls();
  }

  function renderControls(){
    const box=$("bjControls");
    if(phase==="bet"){
      const chipBtns=chips().map(c=>`<button class="chip" data-bj="${c}">${c.toLocaleString()}</button>`).join("");
      box.innerHTML=`
        <div class="bj-chiprow">
          ${chipBtns}
          <button class="chip allin" data-bj="all">ALL-IN</button>
          <button class="chip clear" data-bj="clear">CLEAR</button>
        </div>
        <button class="bj-deal" id="bjDeal" ${bet<=0?"disabled":""}>DEAL · 发牌（G${bet.toLocaleString()}）</button>`;
      box.querySelectorAll("[data-bj]").forEach(b=>{
        b.onclick=()=>{
          const v=b.dataset.bj;
          addBet(v==="all"||v==="clear"?v:+v);
        };
      });
      $("bjDeal").onclick=deal;
    } else if(phase==="player"){
      const canDouble=!busy && player.length===2 && GameState.coins>0;
      const swapHTML = (canSwap && cheatCount("swap")>0)
        ? `<button class="pbtn pbtn-double" id="bjSwap" ${busy?"disabled":""}>SWAP<br>换牌</button>`
        : "";
      box.innerHTML=`
        <div class="bj-actionrow">
          <button class="pbtn pbtn-hit" id="bjHit" ${busy?"disabled":""}>HIT<br>要牌</button>
          <button class="pbtn pbtn-stand" id="bjStand" ${busy?"disabled":""}>STAND<br>停牌</button>
          <button class="pbtn pbtn-double" id="bjDouble" ${canDouble?"":"disabled"}>DOUBLE<br>加倍</button>
          ${swapHTML}
        </div>`;
      $("bjHit").onclick=hit;
      $("bjStand").onclick=stand;
      $("bjDouble").onclick=doubleDown;
      if($("bjSwap")) $("bjSwap").onclick=doSwap;
    } else if(phase==="dealer"){
      box.innerHTML=`<button class="bj-deal" disabled>DEALER PLAYING…</button>`;
    } else {
      const canRebet=bet>0 && GameState.coins>=bet;
      box.innerHTML=`
        <div class="bj-actionrow">
          <button class="pbtn pbtn-stand" id="bjNewBet" style="flex:0 0 34%;">NEW BET<br>改注</button>
          <button class="bj-deal" id="bjRebet" ${canRebet?"":"disabled"}>REBET · 同注再来（G${bet.toLocaleString()}）</button>
        </div>`;
      $("bjNewBet").onclick=enter;
      $("bjRebet").onclick=rebet;
    }
  }

  return { enter };
})();
