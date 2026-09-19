/* ===================== 德州扑克模块 ===================== */
const SUITS = ["♠","♥","♦","♣"];
const RANK_NAMES = {11:"J",12:"Q",13:"K",14:"A"};
const HAND_NAMES = ["高牌","一对","两对","三条","顺子","同花","葫芦","四条","同花顺"];
const SB = 10, BB = 20;
const BOT_NAMES = ["BOT-1","BOT-2","BOT-3"];

const PokerModule = (()=>{
  let P = null; // 牌局状态

  /* ---------- 牌组 ---------- */
  function newDeck(){
    const d = [];
    for(let s=0;s<4;s++) for(let r=2;r<=14;r++) d.push({rank:r,suit:s});
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }
  const rk = c => c.rank;

  /* ---------- 牌型评估（5 张） ---------- */
  function evaluate5(c5){
    const ranks = c5.map(rk).sort((a,b)=>b-a);
    const suits = c5.map(c=>c.suit);
    const isFlush = suits.every(s=>s===suits[0]);
    const uniq = [...new Set(ranks)].sort((a,b)=>b-a);
    let isStraight=false, straightHigh=0;
    if(uniq.length===5){
      if(uniq[0]-uniq[4]===4){ isStraight=true; straightHigh=uniq[0]; }
      else if(uniq.join(",")==="14,5,4,3,2"){ isStraight=true; straightHigh=5; }
    }
    const counts={};
    ranks.forEach(r=>counts[r]=(counts[r]||0)+1);
    const groups=Object.entries(counts).map(([r,c])=>({rank:+r,count:c}))
      .sort((a,b)=> b.count-a.count || b.rank-a.rank);

    if(isFlush && isStraight) return {cat:8, tb:[straightHigh]};
    if(groups[0].count===4) return {cat:7, tb:[groups[0].rank, groups[1].rank]};
    if(groups[0].count===3 && groups[1].count===2) return {cat:6, tb:[groups[0].rank, groups[1].rank]};
    if(isFlush) return {cat:5, tb:ranks};
    if(isStraight) return {cat:4, tb:[straightHigh]};
    if(groups[0].count===3) return {cat:3, tb:[groups[0].rank, ...groups.slice(1).map(g=>g.rank)]};
    if(groups[0].count===2 && groups[1].count===2)
      return {cat:2, tb:[groups[0].rank, groups[1].rank, groups[2].rank]};
    if(groups[0].count===2)
      return {cat:1, tb:[groups[0].rank, ...groups.slice(1).map(g=>g.rank)]};
    return {cat:0, tb:ranks};
  }
  /* 7 张选最佳 5 张 */
  function evaluate7(cards){
    let best=null;
    for(let a=0;a<cards.length-4;a++)
    for(let b=a+1;b<cards.length-3;b++)
    for(let c=b+1;c<cards.length-2;c++)
    for(let d=c+1;d<cards.length-1;d++)
    for(let e=d+1;e<cards.length;e++){
      const h = evaluate5([cards[a],cards[b],cards[c],cards[d],cards[e]]);
      if(!best || cmpHand(h,best)>0) best=h;
    }
    return best;
  }
  function cmpHand(x,y){
    if(x.cat!==y.cat) return x.cat-y.cat;
    for(let i=0;i<Math.max(x.tb.length,y.tb.length);i++){
      const a=x.tb[i]||0, b=y.tb[i]||0;
      if(a!==b) return a-b;
    }
    return 0;
  }

  /* ---------- AI 强度 ---------- */
  function preflopStrength(hand){
    const [a,b] = hand.map(rk).sort((x,y)=>y-x);
    let s = 0.1;
    if(a===b) s = 0.5 + a/35;
    else {
      if(a===14) s+=0.28; else if(a===13) s+=0.2; else if(a===12) s+=0.14; else if(a===11) s+=0.09;
      if(b>=12) s+=0.08;
      if(hand[0].suit===hand[1].suit) s+=0.07;
      if(a-b===1) s+=0.07;
      else if(a-b===2) s+=0.03;
    }
    return Math.min(0.98, s);
  }
  function handStrength7(cards){
    const h = evaluate7(cards);
    let s;
    switch(h.cat){
      case 8: s=0.98; break;
      case 7: s=0.95; break;
      case 6: s=0.88; break;
      case 5: s=0.78; break;
      case 4: s=0.72; break;
      case 3: s=0.58; break;
      case 2: s=0.45; break;
      case 1: s=0.22 + h.tb[0]/45; break;
      default: s = h.tb[0]>=14?0.16: h.tb[0]>=13?0.12:0.07;
    }
    // 同花听牌
    const suitCount={};
    cards.forEach(c=>suitCount[c.suit]=(suitCount[c.suit]||0)+1);
    if(Object.values(suitCount).some(n=>n===4)) s+=0.12;
    return Math.min(0.99,s);
  }

  /* ---------- 牌局生命周期 ---------- */
  function startHand(){
    if(GameState.coins < BB){
      addCoins(200);
      toast("扑克室救助金 +G200");
    }
    const players = [
      {id:0,name:"YOU",human:true, chips:GameState.coins, hand:[],bet:0,folded:false,allin:false,needAct:false},
      {id:1,name:BOT_NAMES[0], chips:1000, hand:[],bet:0,folded:false,allin:false,needAct:false},
      {id:2,name:BOT_NAMES[1], chips:1000, hand:[],bet:0,folded:false,allin:false,needAct:false},
      {id:3,name:BOT_NAMES[2], chips:1000, hand:[],bet:0,folded:false,allin:false,needAct:false},
    ];
    P = {
      deck:newDeck(), community:[], players,
      pot:0, curBet:0, stage:"preflop",
      actedRaiser:-1, humanPending:false,
      startCoins: GameState.coins,
      lastAggressor:0,
    };
    // 盲注：玩家小盲，BOT-1 大盲
    postBlind(players[0], SB);
    postBlind(players[1], BB);
    P.curBet = BB;
    // 发底牌
    for(let r=0;r<2;r++) players.forEach(p=>{ if(p.chips>=0) p.hand.push(P.deck.pop()); });
    players.forEach(p=>{ if(!p.allin) p.needAct=true; });
    $("pokerIntro").style.display="none";
    $("pokerResultModal").classList.add("hidden");
    setStageTag();
    renderAll();
    log("新一局 · 小盲10 大盲20");
    advance();
  }
  function postBlind(p, amt){
    const pay = Math.min(amt, p.chips);
    p.chips -= pay; p.bet += pay; P.pot += pay;
    if(p.chips===0) p.allin=true;
  }

  const STAGE_ORDER = ["preflop","flop","turn","river","showdown"];
  function setStageTag(){
    const map={preflop:"PREFLOP",flop:"FLOP",turn:"TURN",river:"RIVER",showdown:"SHOWDOWN"};
    $("stageTag").textContent = map[P.stage] + " · POT";
  }

  /* 行动顺序：preflop 玩家先，postflop 从 BOT-1（大盲位）开始 */
  function actorOrder(){
    return P.stage==="preflop" ? [0,2,3,1] : [1,2,3,0];
  }

  function alivePlayers(){ return P.players.filter(p=>!p.folded); }
  function canActPlayers(){ return P.players.filter(p=>!p.folded && !p.allin); }

  function advance(){
    const alive = alivePlayers();
    if(alive.length===1){ endHand(alive[0], "fold"); return; }
    // 还有需要行动的人吗
    const order = actorOrder();
    const next = order.map(i=>P.players[i]).find(p=>p.needAct && !p.folded && !p.allin);
    if(next){
      if(next.human){
        P.humanPending = true;
        renderControls();
      } else {
        P.humanPending = false;
        renderControls(true);
        setTimeout(()=>{ aiAct(next); }, 650+Math.random()*500);
      }
      renderAll();
      return;
    }
    // 本轮结束 → 下一 stage
    nextStage();
  }

  function nextStage(){
    // 收注：bet 已在 pot 里（行动时即时入池），清零
    P.players.forEach(p=>{ p.bet=0; p.needAct = !p.folded && !p.allin; });
    P.curBet = 0;
    const idx = STAGE_ORDER.indexOf(P.stage);
    P.stage = STAGE_ORDER[idx+1];
    setStageTag();
    if(P.stage==="flop"){
      P.community.push(P.deck.pop(),P.deck.pop(),P.deck.pop());
    } else if(P.stage==="turn" || P.stage==="river"){
      P.community.push(P.deck.pop());
    } else if(P.stage==="showdown"){
      showdown();
      return;
    }
    renderAll();
    // 只剩一个能行动的人（其他人全押）→ 自动 check 到底
    if(canActPlayers().length<=1){
      canActPlayers().forEach(p=>p.needAct=false);
      setTimeout(nextStage, 600);
      return;
    }
    setTimeout(advance, 500);
  }

  /* ---------- 玩家动作 ---------- */
  function humanFold(){
    if(!P.humanPending) return;
    const me = P.players[0];
    me.folded=true; me.needAct=false; P.humanPending=false;
    log("YOU · FOLD 弃牌");
    $("raiseRow").classList.remove("open");
    advance();
  }
  function humanCall(){
    if(!P.humanPending) return;
    const me = P.players[0];
    const toCall = Math.min(P.curBet - me.bet, me.chips);
    me.chips -= toCall; me.bet += toCall; P.pot += toCall;
    if(me.chips===0) me.allin=true;
    me.needAct=false; P.humanPending=false;
    log(toCall===0 ? "YOU · CHECK" : "YOU · CALL "+toCall + (me.allin?" · ALL-IN":""));
    $("raiseRow").classList.remove("open");
    renderAll(); advance();
  }
  function humanRaise(mode){
    if(!P.humanPending) return;
    const me = P.players[0];
    const toCall = P.curBet - me.bet;
    let target;
    if(mode==="all"){
      target = me.bet + me.chips; // 全押总额
    } else if(mode==="pot"){
      target = P.curBet + Math.max(BB, P.pot);
    } else {
      target = P.curBet + BB*2; // 最小加注
    }
    target = Math.min(target, me.bet + me.chips);
    const pay = target - me.bet;
    if(pay <= toCall){ // 钱不够最小加注，视为 call
      humanCall(); return;
    }
    me.chips -= pay; me.bet += pay; P.pot += pay;
    if(me.chips===0) me.allin=true;
    P.curBet = me.bet;
    // 其他人重新行动
    P.players.forEach(p=>{ if(p.id!==0 && !p.folded && !p.allin) p.needAct=true; });
    me.needAct=false; P.humanPending=false;
    log("YOU · RAISE TO "+me.bet + (me.allin?" · ALL-IN":""));
    $("raiseRow").classList.remove("open");
    renderAll(); advance();
  }

  /* ---------- AI 动作 ---------- */
  function aiAct(p){
    const toCall = P.curBet - p.bet;
    let strength;
    if(P.stage==="preflop") strength = preflopStrength(p.hand);
    else strength = handStrength7(p.hand.concat(P.community));
    if(Math.random()<0.08 && P.stage!=="preflop") strength = Math.min(0.99, strength+0.25); // 诈唬

    const potOdds = toCall>0 ? toCall/(P.pot+toCall) : 0;
    let action;
    if(toCall===0){
      if(strength>0.6 && Math.random()<0.65 && p.chips>BB*2){
        action="raise";
      } else action="check";
    } else {
      if(strength>0.82 && Math.random()<0.55 && p.chips>toCall+BB*2) action="raise";
      else if(strength > potOdds+0.08) action="call";
      else if(toCall<=BB && strength>0.3) action="call";
      else action="fold";
    }

    if(action==="fold"){
      p.folded=true; p.needAct=false;
      log(p.name+" · FOLD");
    } else if(action==="check"){
      p.needAct=false;
      log(p.name+" · CHECK");
    } else if(action==="call"){
      const pay = Math.min(toCall, p.chips);
      p.chips-=pay; p.bet+=pay; P.pot+=pay;
      if(p.chips===0) p.allin=true;
      p.needAct=false;
      log(p.name+" · CALL "+pay+(p.allin?" ALL-IN":""));
    } else {
      let target;
      if(strength>0.92) target = P.curBet + Math.max(BB*2, Math.round(P.pot*0.8));
      else target = P.curBet + BB*2;
      target = Math.min(target, p.bet+p.chips);
      const pay = target - p.bet;
      p.chips-=pay; p.bet+=pay; P.pot+=pay;
      if(p.chips===0) p.allin=true;
      P.curBet = p.bet;
      P.players.forEach(o=>{ if(o.id!==p.id && !o.folded && !o.allin) o.needAct=true; });
      p.needAct=false;
      log(p.name+" · RAISE "+p.bet+(p.allin?" ALL-IN":""));
    }
    renderAll();
    setTimeout(advance, 200);
  }

  /* ---------- 摊牌 ---------- */
  function showdown(){
    P.stage="showdown";
    setStageTag();
    const contenders = alivePlayers();
    let best=null, winners=[];
    contenders.forEach(p=>{
      p.evaluated = evaluate7(p.hand.concat(P.community));
      if(!best || cmpHand(p.evaluated,best)>0){ best=p.evaluated; winners=[p]; }
      else if(cmpHand(p.evaluated,best)===0) winners.push(p);
    });
    const share = Math.floor(P.pot/winners.length);
    winners.forEach(w=>{ w.chips += share; w.isWinner=true; });
    log("摊牌 · "+winners.map(w=>w.name).join("/")+" 赢得 "+share);
    setTimeout(()=>endHand(winners[0], "showdown", winners), 1200);
    renderAll();
  }

  function endHand(winner, reason, winners){
    P.stage="showdown";
    setStageTag();
    if(reason==="fold"){
      winner.chips += P.pot;
      winner.isWinner=true;
      log(winner.name+" 赢得锅底 "+P.pot+"（其他人弃牌）");
    }
    // 同步玩家金币
    const me = P.players[0];
    const pnl = me.chips - P.startCoins;
    GameState.coins = Math.max(0, me.chips);
    if(GameState.coins < BB) GameState.coins = 200;
    gsSave();
    syncCoinDisplays();
    renderAll();

    // 结算弹窗
    setTimeout(()=>{
      const ws = winners || [winner];
      $("prTitle").textContent = ws.some(w=>w.id===0) ? "YOU WIN!" : "HAND OVER";
      $("prSub").textContent = reason==="fold" ? "所有人弃牌" : "摊牌";
      const box = $("prHands");
      box.innerHTML="";
      alivePlayers().forEach(p=>{
        const row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:2px solid #000;padding:6px;"
          + (p.isWinner?"border-color:var(--green);":"");
        const cards = p.hand.map(cardHTML).join("");
        const hn = p.evaluated ? HAND_NAMES[p.evaluated.cat] : (reason==="fold"?"":"未摊牌");
        row.innerHTML = `
          <div style="min-width:64px;font-size:11px;font-weight:700;">${p.name}${p.isWinner?' ★':''}</div>
          <div style="display:flex;gap:3px;">${cards}</div>
          <div style="flex:1;text-align:right;font-size:11px;color:var(--yellow);">${hn}</div>`;
        box.appendChild(row);
      });
      const pnlEl=$("prPnl");
      pnlEl.textContent = (pnl>=0?"+":"")+"G "+pnl;
      pnlEl.className = "v " + (pnl>=0?"pos":"neg");
      $("prCoin").textContent = "G "+GameState.coins;
      $("pokerResultModal").classList.remove("hidden");
    }, reason==="showdown"?1400:700);
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(c, small){
    const red = c.suit===1||c.suit===2;
    const rkTxt = RANK_NAMES[c.rank]||c.rank;
    return `<div class="playing-card ${small?'small':''} ${red?'red':'dark'}">
      <span class="rk">${rkTxt}</span><span class="st">${SUITS[c.suit]}</span></div>`;
  }
  function cardBackHTML(small){
    return `<div class="playing-card ${small?'small':''} back"></div>`;
  }

  function renderAll(){
    if(!P) return;
    // 公共牌
    const cc = $("community");
    cc.innerHTML = "";
    for(let i=0;i<5;i++){
      cc.innerHTML += P.community[i] ? cardHTML(P.community[i],true) : cardBackHTML(true);
    }
    $("potVal").textContent = P.pot;
    // 座位
    P.players.forEach(p=>{
      const seat = $("seat-"+p.id);
      seat.className = "seat seat-"+p.id
        + (p.folded?" folded":"")
        + (p.isWinner?" winner":"")
        + (P.humanPending && p.human ? " active":"")
        + (!P.humanPending && P.players.some(x=>x.needAct) && p.needAct ? " active":"");
      const showCards = p.human || P.stage==="showdown" || (p.isWinner && P.stage==="showdown");
      let cardsHTML = "";
      if(p.hand.length){
        if(showCards && !p.folded) cardsHTML = p.hand.map(c=>cardHTML(c,true)).join("");
        else if(p.folded) cardsHTML = "";
        else cardsHTML = cardBackHTML(true)+cardBackHTML(true);
      }
      seat.innerHTML = `
        <div class="seat-cards">${cardsHTML}</div>
        <div class="seat-info">
          <div class="seat-name">${p.name}</div>
          <div class="seat-chips">G ${p.chips}</div>
          <div class="seat-bet">${p.bet>0?"BET "+p.bet:""}</div>
          <div class="seat-tag">${p.folded?"FOLD":p.allin?"ALL-IN":""}</div>
        </div>`;
    });
    // 玩家手牌区
    const yh = $("yourHand");
    const me = P.players[0];
    if(me.hand.length){
      let hn = "";
      if(P.community.length>=3 && !me.folded){
        const ev = evaluate7(me.hand.concat(P.community));
        hn = HAND_NAMES[ev.cat];
      }
      yh.innerHTML = me.hand.map(c=>cardHTML(c)).join("")
        + (hn?`<span class="hand-name">${hn}</span>`:"")
        + (me.folded?'<span class="hand-name" style="color:var(--red);">FOLDED</span>':"");
    } else yh.innerHTML="";
    renderControls();
  }

  function renderControls(disableAll){
    if(!P){
      ["btnFold","btnCall","btnRaise"].forEach(id=>$(id).disabled=true);
      return;
    }
    const me=P.players[0];
    const enabled = P.humanPending && !me.folded && !me.allin && !disableAll;
    const toCall = P.curBet - me.bet;
    const canPay = Math.min(toCall, me.chips);
    $("btnFold").disabled = !enabled;
    $("btnCall").disabled = !enabled;
    $("btnRaise").disabled = !enabled || me.chips<=canPay;
    $("btnCall").innerHTML = toCall===0
      ? "CHECK<br>过牌"
      : (me.chips<=toCall ? "ALL-IN G"+me.chips+"<br>全押" : "CALL G"+toCall+"<br>跟注");
  }

  function log(msg){
    const el=$("pokerLog");
    const line=document.createElement("div");
    line.textContent="> "+msg;
    el.appendChild(line);
    while(el.children.length>5) el.removeChild(el.firstChild);
  }

  /* ---------- 事件 ---------- */
  $("btnDeal").onclick = startHand;
  $("btnFold").onclick = humanFold;
  $("btnCall").onclick = humanCall;
  $("btnRaise").onclick = ()=>$("raiseRow").classList.toggle("open");
  $("btnRaiseCancel").onclick = ()=>$("raiseRow").classList.remove("open");
  document.querySelectorAll("#raiseRow [data-raise]").forEach(b=>{
    b.onclick = ()=>humanRaise(b.dataset.raise);
  });
  $("prNext").onclick = ()=>startHand();
  $("prMap").onclick = ()=>{
    $("pokerResultModal").classList.add("hidden");
    showView("map");
  };
  $("pokerResultModal").addEventListener("click", e=>{
    if(e.target===$("pokerResultModal")) e.target.classList.add("hidden");
  });

  return {
    enter(){
      P=null;
      $("pokerIntro").style.display="flex";
      $("pokerResultModal").classList.add("hidden");
      $("community").innerHTML="";
      $("potVal").textContent="0";
      $("yourHand").innerHTML="";
      $("pokerLog").innerHTML="";
      [0,1,2,3].forEach(i=>{
        $( "seat-"+i).className="seat seat-"+i;
        $("seat-"+i).innerHTML=`
          <div class="seat-cards"></div>
          <div class="seat-info">
            <div class="seat-name">${i===0?"YOU":BOT_NAMES[i-1]}</div>
            <div class="seat-chips">${i===0?"G "+GameState.coins:"G 1000"}</div>
          </div>`;
      });
      $("stageTag").textContent="TEXAS HOLD'EM · 10/20";
      renderControls();
    }
  };
})();
