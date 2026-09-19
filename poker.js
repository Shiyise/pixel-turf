/* ===================== 德州扑克模块（现金桌 + SNG 锦标赛） ===================== */
const SUITS = ["♠","♥","♦","♣"];
const RANK_NAMES = {11:"J",12:"Q",13:"K",14:"A"};
const HAND_NAMES = ["高牌","一对","两对","三条","顺子","同花","葫芦","四条","同花顺"];
const SB = 10, BB = 20;
const VIP_SB = 200, VIP_BB = 400;
const BOT_NAMES = ["BOT-1","BOT-2","BOT-3"];

/* 锦标赛配置（普通 / VIP 高注） */
const TOUR = {
  buyin: 500,
  startChips: 1500,
  handsPerLevel: 8,
  blinds: [[10,20],[20,40],[40,80],[80,160],[150,300],[300,600],[500,1000],[1000,2000],[2000,4000]],
  prizes: {1:1500, 2:500}, // 名次奖金
};
const TOUR_VIP = {
  buyin: 5000,
  startChips: 15000,
  handsPerLevel: 8,
  blinds: [[100,200],[200,400],[400,800],[800,1600],[1500,3000],[3000,6000],[5000,10000],[10000,20000],[20000,40000]],
  prizes: {1:15000, 2:5000},
};

const PokerModule = (()=>{
  let P = null;  // 当前手牌局状态
  let T = null;  // 锦标赛状态（null = 现金桌/未开赛）
  let vip = false;
  const cashBlinds = ()=> vip ? [VIP_SB,VIP_BB] : [SB,BB];

  /* ---------- 牌组 ---------- */
  function newDeck(){
    const d=[];
    for(let s=0;s<4;s++) for(let r=2;r<=14;r++) d.push({rank:r,suit:s});
    for(let i=d.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }
  const rk=c=>c.rank;

  /* ---------- 牌型评估 ---------- */
  function evaluate5(c5){
    const ranks=c5.map(rk).sort((a,b)=>b-a);
    const isFlush=c5.every(c=>c.suit===c5[0].suit);
    const uniq=[...new Set(ranks)].sort((a,b)=>b-a);
    let isStraight=false, straightHigh=0;
    if(uniq.length===5){
      if(uniq[0]-uniq[4]===4){ isStraight=true; straightHigh=uniq[0]; }
      else if(uniq.join(",")==="14,5,4,3,2"){ isStraight=true; straightHigh=5; }
    }
    const counts={};
    ranks.forEach(r=>counts[r]=(counts[r]||0)+1);
    const groups=Object.entries(counts).map(([r,c])=>({rank:+r,count:c}))
      .sort((a,b)=>b.count-a.count||b.rank-a.rank);
    if(isFlush&&isStraight) return {cat:8,tb:[straightHigh]};
    if(groups[0].count===4) return {cat:7,tb:[groups[0].rank,groups[1].rank]};
    if(groups[0].count===3&&groups[1].count===2) return {cat:6,tb:[groups[0].rank,groups[1].rank]};
    if(isFlush) return {cat:5,tb:ranks};
    if(isStraight) return {cat:4,tb:[straightHigh]};
    if(groups[0].count===3) return {cat:3,tb:[groups[0].rank,...groups.slice(1).map(g=>g.rank)]};
    if(groups[0].count===2&&groups[1].count===2) return {cat:2,tb:[groups[0].rank,groups[1].rank,groups[2].rank]};
    if(groups[0].count===2) return {cat:1,tb:[groups[0].rank,...groups.slice(1).map(g=>g.rank)]};
    return {cat:0,tb:ranks};
  }
  function evaluate7(cards){
    let best=null;
    for(let a=0;a<cards.length-4;a++)
    for(let b=a+1;b<cards.length-3;b++)
    for(let c=b+1;c<cards.length-2;c++)
    for(let d=c+1;d<cards.length-1;d++)
    for(let e=d+1;e<cards.length;e++){
      const h=evaluate5([cards[a],cards[b],cards[c],cards[d],cards[e]]);
      if(!best||cmpHand(h,best)>0) best=h;
    }
    return best;
  }
  function cmpHand(x,y){
    if(x.cat!==y.cat) return x.cat-y.cat;
    for(let i=0;i<Math.max(x.tb.length,y.tb.length);i++){
      const a=x.tb[i]||0,b=y.tb[i]||0;
      if(a!==b) return a-b;
    }
    return 0;
  }

  /* ---------- AI 强度 ---------- */
  function preflopStrength(hand){
    const [a,b]=hand.map(rk).sort((x,y)=>y-x);
    let s=0.1;
    if(a===b) s=0.5+a/35;
    else{
      if(a===14)s+=0.28; else if(a===13)s+=0.2; else if(a===12)s+=0.14; else if(a===11)s+=0.09;
      if(b>=12)s+=0.08;
      if(hand[0].suit===hand[1].suit)s+=0.07;
      if(a-b===1)s+=0.07; else if(a-b===2)s+=0.03;
    }
    return Math.min(0.98,s);
  }
  function handStrength7(cards){
    const h=evaluate7(cards);
    let s;
    switch(h.cat){
      case 8:s=0.98;break; case 7:s=0.95;break; case 6:s=0.88;break;
      case 5:s=0.78;break; case 4:s=0.72;break; case 3:s=0.58;break;
      case 2:s=0.45;break; case 1:s=0.22+h.tb[0]/45;break;
      default:s=h.tb[0]>=14?0.16:h.tb[0]>=13?0.12:0.07;
    }
    const sc={};
    cards.forEach(c=>sc[c.suit]=(sc[c.suit]||0)+1);
    if(Object.values(sc).some(n=>n===4)) s+=0.12;
    return Math.min(0.99,s);
  }

  /* ---------- 工具 ---------- */
  function alivePlayers(){ return P.players.filter(p=>!p.folded&&!p.out); }
  function seatedPlayers(){ return P.players.filter(p=>!p.out); }
  function canActPlayers(){ return P.players.filter(p=>!p.folded&&!p.allin&&!p.out); }
  function currentBlinds(){
    if(!T) return cashBlinds();
    const cfg=T.cfg||TOUR;
    const lv=Math.min(cfg.blinds.length-1, Math.floor((T.handNo-1)/cfg.handsPerLevel));
    return cfg.blinds[lv];
  }

  /* ---------- 开局 ---------- */
  function startCash(){
    T=null;
    const [,bb]=cashBlinds();
    if(GameState.coins<bb*10){
      if(vip){ toast("VIP 桌至少带 G"+(bb*10)+" 上桌，先回普通桌或地图"); return; }
      if(GameState.coins<BB){ addCoins(200); toast("扑克室救助金 +G200"); }
    }
    const botChips=vip?50000:1000;
    const players=makePlayers([
      {chips:GameState.coins},
      {chips:botChips},{chips:botChips},{chips:botChips},
    ]);
    beginHand(players,"cash");
  }

  function startTournament(){
    if(T&&T.finished) T=null;
    const cfg=vip?TOUR_VIP:TOUR;
    if(!T){
      if(GameState.coins<cfg.buyin){ toast("金币不足，报名费 G"+cfg.buyin); return; }
      addCoins(-cfg.buyin);
      T={
        cfg, vip,
        handNo:0, finished:false, eliminations:[],
        players:makePlayers([
          {chips:cfg.startChips},{chips:cfg.startChips},
          {chips:cfg.startChips},{chips:cfg.startChips},
        ]).map(p=>({id:p.id,name:p.name,human:p.human,chips:p.chips,out:false})),
      };
      log("锦标赛开始 · 买入 G"+cfg.buyin);
    }
    // 回滚未完成手：恢复到本手开始时的筹码快照
    if(T.savedChips) T.players.forEach(p=>{ p.chips=T.savedChips[p.id]; });
    T.handNo++;
    const players=T.players.map(sp=>makePlayer(sp.id, sp.name, sp.human, sp.chips));
    beginHand(players,"tournament");
  }

  function makePlayers(specs){
    return specs.map((s,i)=>makePlayer(i, i===0?"YOU":BOT_NAMES[i-1], i===0, s.chips));
  }
  function makePlayer(id,name,human,chips){
    return {id,name,human:!!human,chips,hand:[],bet:0,totalBet:0,
      folded:false,allin:false,out:chips<=0,needAct:false,isWinner:false,evaluated:null};
  }

  function beginHand(players, mode){
    P={
      deck:newDeck(),community:[],players,pot:0,curBet:0,
      stage:"preflop",humanPending:false,mode,
      startCoins:GameState.coins,
    };
    // 保存本手开始前快照（锦标赛回滚用）
    if(T) T.savedChips={}; players.forEach(p=>{ if(T) T.savedChips[p.id]=p.chips; });

    const [sbAmt,bbAmt]=currentBlinds();
    const seated=seatedPlayers();
    // 小盲固定玩家（玩家始终在桌上），大盲为下一个在座 BOT
    const sbP=players[0];
    const bbP=players.slice(1).find(p=>!p.out);
    postBlind(sbP, sbAmt);
    if(bbP) postBlind(bbP, bbAmt);
    P.curBet=bbAmt;
    // 发底牌
    for(let r=0;r<2;r++) seated.forEach(p=>p.hand.push(P.deck.pop()));
    seated.forEach(p=>{ if(!p.allin) p.needAct=true; });

    $("pokerIntro").style.display="none";
    $("pokerResultModal").classList.add("hidden");
    setStageTag();
    renderAll();
    log(`第 ${T?T.handNo:""} 手 · 盲注 ${sbAmt}/${bbAmt}`);
    // 两人桌特殊：若 BB 缺失（极端情况）直接摊牌
    if(seated.length<2){ endHand(); return; }
    advance();
  }
  function postBlind(p,amt){
    const pay=Math.min(amt,p.chips);
    p.chips-=pay; p.bet+=pay; p.totalBet+=pay; P.pot+=pay;
    if(p.chips===0) p.allin=true;
  }

  const STAGE_ORDER=["preflop","flop","turn","river","showdown"];
  function setStageTag(){
    if(P.mode==="tournament"){
      const cfg=T.cfg||TOUR;
      const lv=Math.min(cfg.blinds.length-1,Math.floor((T.handNo-1)/cfg.handsPerLevel));
      const [sb,bb]=cfg.blinds[lv];
      $("stageTag").textContent=`${T.vip?"VIP SNG":"SNG"} Lv.${lv+1} · ${sb}/${bb} · ${seatedPlayers().length}人 · 第${T.handNo}手`;
    } else {
      const [sb,bb]=cashBlinds();
      $("stageTag").textContent=(vip?"VIP CASH":"CASH")+` · ${sb}/${bb}`;
    }
  }

  function actorOrder(){
    // preflop: [玩家, BOT2, BOT3, BOT1]；postflop: [玩家, BOT1, BOT2, BOT3]，均过滤出局者
    const order=P.stage==="preflop"?[0,2,3,1]:[0,1,2,3];
    return order.map(i=>P.players[i]).filter(p=>p&&!p.out);
  }

  function advance(){
    const alive=alivePlayers();
    if(alive.length===1){ endHand(); return; }
    const next=actorOrder().find(p=>p.needAct&&!p.folded&&!p.allin);
    if(next){
      if(next.human){
        P.humanPending=true; renderControls();
      } else {
        P.humanPending=false; renderControls(true);
        setTimeout(()=>aiAct(next), 600+Math.random()*500);
      }
      renderAll();
      return;
    }
    nextStage();
  }

  function nextStage(){
    P.players.forEach(p=>{ p.bet=0; if(!p.folded&&!p.allin&&!p.out) p.needAct=true; });
    P.curBet=0;
    P.stage=STAGE_ORDER[STAGE_ORDER.indexOf(P.stage)+1];
    if(P.stage==="flop") P.community.push(P.deck.pop(),P.deck.pop(),P.deck.pop());
    else if(P.stage==="turn"||P.stage==="river") P.community.push(P.deck.pop());
    else if(P.stage==="showdown"){ showdown(); return; }
    setStageTag(); renderAll();
    if(canActPlayers().length<=1){
      canActPlayers().forEach(p=>p.needAct=false);
      setTimeout(nextStage,600);
      return;
    }
    setTimeout(advance,450);
  }

  /* ---------- 玩家动作 ---------- */
  function humanFold(){
    if(!P.humanPending)return;
    const me=P.players[0];
    me.folded=true; me.needAct=false; P.humanPending=false;
    log("YOU · FOLD");
    $("raiseRow").classList.remove("open");
    advance();
  }
  function humanCall(){
    if(!P.humanPending)return;
    const me=P.players[0];
    const toCall=Math.min(P.curBet-me.bet,me.chips);
    me.chips-=toCall; me.bet+=toCall; me.totalBet+=toCall; P.pot+=toCall;
    if(me.chips===0)me.allin=true;
    me.needAct=false; P.humanPending=false;
    log(toCall===0?"YOU · CHECK":"YOU · CALL "+toCall+(me.allin?" ALL-IN":""));
    $("raiseRow").classList.remove("open");
    renderAll(); advance();
  }
  function humanRaise(mode){
    if(!P.humanPending)return;
    const me=P.players[0];
    const toCall=P.curBet-me.bet;
    const [,bbAmt]=currentBlinds();
    let target;
    if(mode==="all") target=me.bet+me.chips;
    else if(mode==="pot") target=P.curBet+Math.max(bbAmt,P.pot);
    else target=P.curBet+bbAmt*2;
    target=Math.min(target,me.bet+me.chips);
    const pay=target-me.bet;
    if(pay<=toCall){ humanCall(); return; }
    me.chips-=pay; me.bet+=pay; me.totalBet+=pay; P.pot+=pay;
    if(me.chips===0)me.allin=true;
    P.curBet=me.bet;
    P.players.forEach(p=>{ if(p.id!==0&&!p.folded&&!p.allin&&!p.out) p.needAct=true; });
    me.needAct=false; P.humanPending=false;
    log("YOU · RAISE "+me.bet+(me.allin?" ALL-IN":""));
    $("raiseRow").classList.remove("open");
    renderAll(); advance();
  }

  /* ---------- AI ---------- */
  function aiAct(p){
    const toCall=P.curBet-p.bet;
    let strength=P.stage==="preflop"?preflopStrength(p.hand):handStrength7(p.hand.concat(P.community));
    if(Math.random()<0.08&&P.stage!=="preflop") strength=Math.min(0.99,strength+0.25);
    const [,bbAmt]=currentBlinds();
    const potOdds=toCall>0?toCall/(P.pot+toCall):0;
    let action;
    if(toCall===0){
      action=(strength>0.6&&Math.random()<0.65&&p.chips>bbAmt*2)?"raise":"check";
    } else {
      if(strength>0.82&&Math.random()<0.55&&p.chips>toCall+bbAmt*2) action="raise";
      else if(strength>potOdds+0.08) action="call";
      else if(toCall<=bbAmt&&strength>0.3) action="call";
      else action="fold";
    }
    if(action==="fold"){
      p.folded=true; p.needAct=false; log(p.name+" · FOLD");
    } else if(action==="check"){
      p.needAct=false; log(p.name+" · CHECK");
    } else if(action==="call"){
      const pay=Math.min(toCall,p.chips);
      p.chips-=pay; p.bet+=pay; p.totalBet+=pay; P.pot+=pay;
      if(p.chips===0)p.allin=true;
      p.needAct=false;
      log(p.name+" · CALL "+pay+(p.allin?" ALL-IN":""));
    } else {
      let target=strength>0.92?P.curBet+Math.max(bbAmt*2,Math.round(P.pot*0.8)):P.curBet+bbAmt*2;
      target=Math.min(target,p.bet+p.chips);
      const pay=target-p.bet;
      p.chips-=pay; p.bet+=pay; p.totalBet+=pay; P.pot+=pay;
      if(p.chips===0)p.allin=true;
      P.curBet=p.bet;
      P.players.forEach(o=>{ if(o.id!==p.id&&!o.folded&&!o.allin&&!o.out)o.needAct=true; });
      p.needAct=false;
      log(p.name+" · RAISE "+p.bet+(p.allin?" ALL-IN":""));
    }
    renderAll();
    setTimeout(advance,200);
  }

  /* ---------- 边池 ---------- */
  // 退还弃牌者超过“未弃牌者最高投入”的部分（无人跟注的注码原路退回）
  function refundFoldedExcess(){
    const alive=P.players.filter(p=>!p.folded&&!p.out);
    const maxAliveBet=Math.max(0,...alive.map(p=>p.totalBet));
    P.players.filter(p=>p.folded).forEach(p=>{
      if(p.totalBet>maxAliveBet){
        const refund=p.totalBet-maxAliveBet;
        p.chips+=refund;
        p.totalBet=maxAliveBet;
        P.pot-=refund;
      }
    });
  }
  function buildPots(){
    refundFoldedExcess();
    const alive=P.players.filter(p=>!p.folded&&!p.out);
    const levels=[...new Set(alive.map(p=>p.totalBet).filter(x=>x>0))]
      .sort((a,b)=>a-b);
    const pots=[];
    let prev=0;
    for(const lvl of levels){
      let amount=0;
      P.players.forEach(p=>{ amount+=Math.max(0,Math.min(p.totalBet,lvl)-prev); });
      const eligible=alive.filter(p=>p.totalBet>prev);
      if(amount>0) pots.push({amount,eligible});
      prev=lvl;
    }
    return pots;
  }

  /* ---------- 摊牌 ---------- */
  function showdown(){
    P.stage="showdown"; setStageTag();
    const contenders=alivePlayers();
    contenders.forEach(p=>{ p.evaluated=evaluate7(p.hand.concat(P.community)); });
    const pots=buildPots();
    pots.forEach(pot=>{
      let best=null,winners=[];
      pot.eligible.filter(p=>!p.folded).forEach(p=>{
        if(!best||cmpHand(p.evaluated,best)>0){ best=p.evaluated; winners=[p]; }
        else if(cmpHand(p.evaluated,best)===0) winners.push(p);
      });
      const share=Math.floor(pot.amount/winners.length);
      let rem=pot.amount-share*winners.length;
      winners.forEach(w=>{ w.chips+=share+(rem-->0?1:0); w.isWinner=true; });
    });
    const winnerNames=[...new Set(contenders.filter(p=>p.isWinner).map(p=>p.name))];
    log("摊牌 · "+winnerNames.join("/")+" 获胜");
    renderAll();
    setTimeout(endHand,1300);
  }

  function endHand(){
    P.stage="showdown"; setStageTag();
    // 弃牌收场：唯一存活者通吃（任意街），先退还无人跟注的超额注码
    const alive=alivePlayers();
    if(alive.length===1){
      refundFoldedExcess();
      alive[0].chips+=P.pot;
      alive[0].isWinner=true;
      log(alive[0].name+" 赢得 "+P.pot+"（其他人弃牌）");
    }

    /* 现金桌：同步金币 */
    let pnl=0;
    if(P.mode==="cash"){
      const me=P.players[0];
      pnl=me.chips-P.startCoins;
      GameState.coins=Math.max(0,me.chips);
      if(!vip && GameState.coins<BB) GameState.coins=200;
      gsSave(); syncCoinDisplays();
      businessTick();
    }

    /* 锦标赛：淘汰判定与名次 */
    let tourResult=null;
    if(P.mode==="tournament"){
      const cfg=T.cfg||TOUR;
      // 同步筹码回 T.players
      P.players.forEach(p=>{
        const tp=T.players.find(x=>x.id===p.id);
        if(tp){ tp.chips=p.chips; if(p.chips<=0&&!tp.out){ tp.out=true; T.eliminations.push(p.id);} }
      });
      T.savedChips=null;
      const remaining=T.players.filter(p=>!p.out);
      const meOut=T.players[0].out;
      if(meOut){
        // 玩家名次 = 4 - 淘汰序号（第1个出局=第4名）
        const elimIndex=T.eliminations.indexOf(0);
        const place=4-elimIndex;
        tourResult={place, over:true};
        const prize=cfg.prizes[place]||0;
        if(prize>0){ addCoins(prize); log("第"+place+"名 · 奖金 G"+prize); }
        T.finished=true;
        businessTick();
      } else if(remaining.length===1){
        tourResult={place:1, over:true};
        addCoins(cfg.prizes[1]);
        log("冠军! 奖金 G"+cfg.prizes[1]);
        T.finished=true;
        businessTick();
      } else {
        tourResult={place:null, over:false};
      }
    }
    renderAll();
    showResultModal(pnl, tourResult);
  }

  /* ---------- 结算弹窗 ---------- */
  function showResultModal(pnl, tourResult){
    const me=P.players[0];
    setTimeout(()=>{
      const titleEl=$("prTitle"), subEl=$("prSub");
      if(P.mode==="tournament"){
        const cfg=T.cfg||TOUR;
        if(tourResult.over){
          if(tourResult.place===1){ titleEl.textContent="CHAMPION"; }
          else titleEl.textContent="第 "+tourResult.place+" 名";
          const prize=cfg.prizes[tourResult.place]||0;
          subEl.textContent=tourResult.place===1
            ? (T.vip?"VIP ":"")+"锦标赛冠军 · 奖金 G"+prize.toLocaleString()
            : "锦标赛出局 · "+(prize>0?"奖金 G"+prize.toLocaleString():"无奖金");
        } else {
          titleEl.textContent="HAND OVER";
          const remaining=T.players.filter(p=>!p.out).length;
          subEl.textContent=`SNG 进行中 · 剩余 ${remaining} 人 · 第 ${T.handNo} 手`;
        }
      } else {
        titleEl.textContent=me.isWinner?"YOU WIN!":"HAND OVER";
        subEl.textContent="现金桌";
      }

      const box=$("prHands");
      box.innerHTML="";
      const show=P.players.filter(p=>!p.out);
      show.forEach(p=>{
        const row=document.createElement("div");
        row.style.cssText="display:flex;align-items:center;gap:8px;background:var(--bg-2);border:2px solid #000;padding:6px;"
          +(p.isWinner?"border-color:var(--green);":"")
          +(p.folded?"opacity:.4;":"");
        const cards=p.hand.length
          ? (p.folded ? '<span style="font-size:10px;color:var(--muted);">FOLD</span>'
                     : (p.human||P.stage==="showdown") ? p.hand.map(c=>cardHTML(c,true)).join("")
                     : cardBackHTML(true)+cardBackHTML(true))
          : '<span style="font-size:10px;color:var(--red);">OUT</span>';
        const hn=p.evaluated?HAND_NAMES[p.evaluated.cat]:"";
        const cur=P.mode==="tournament"?"T$":"G";
        row.innerHTML=`
          <div style="min-width:58px;font-size:11px;font-weight:700;">${p.name}${p.isWinner?' ★':''}</div>
          <div style="display:flex;gap:3px;">${cards}</div>
          <div style="flex:1;text-align:right;font-size:11px;color:var(--yellow);">${hn}</div>
          <div style="font-size:10px;min-width:52px;text-align:right;">${cur} ${p.chips}</div>`;
        box.appendChild(row);
      });

      const pnlEl=$("prPnl");
      if(P.mode==="tournament"){
        const cfg=T.cfg||TOUR;
        if(tourResult.over){
          const prize=cfg.prizes[tourResult.place]||0;
          pnlEl.textContent=(prize>0?"+":"-")+"G "+(prize>0?prize.toLocaleString():cfg.buyin.toLocaleString());
          pnlEl.className="v "+(prize>0?"pos":"neg");
        } else {
          pnlEl.textContent="锦标赛进行中";
          pnlEl.className="v";
        }
      } else {
        pnlEl.textContent=(pnl>=0?"+":"")+"G "+pnl;
        pnlEl.className="v "+(pnl>=0?"pos":"neg");
      }
      $("prCoin").textContent="G "+GameState.coins;

      // 下一手按钮行为
      const nextBtn=$("prNext");
      if(P.mode==="tournament"&&!tourResult.over){
        nextBtn.textContent="下一手";
      } else {
        nextBtn.textContent="返回大厅";
      }
      $("pokerResultModal").classList.remove("hidden");
    }, P.stage==="showdown"&&P.community.length===5?1200:600);
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(c,small){
    const red=c.suit===1||c.suit===2;
    const t=RANK_NAMES[c.rank]||c.rank;
    return `<div class="playing-card ${small?'small':''} ${red?'red':'dark'}">
      <span class="rk">${t}</span><span class="st">${SUITS[c.suit]}</span></div>`;
  }
  function cardBackHTML(small){
    return `<div class="playing-card ${small?'small':''} back"></div>`;
  }

  function renderAll(){
    if(!P)return;
    const cc=$("community");
    cc.innerHTML="";
    for(let i=0;i<5;i++) cc.innerHTML+=P.community[i]?cardHTML(P.community[i],true):cardBackHTML(true);
    $("potVal").textContent=P.pot;
    P.players.forEach(p=>{
      const seat=$("seat-"+p.id);
      seat.className="seat seat-"+p.id
        +(p.folded?" folded":"")+(p.out?" folded":"")
        +(p.isWinner?" winner":"")
        +(P.humanPending&&p.human?" active":"")
        +(!P.humanPending&&p.needAct?" active":"");
      let cardsHTML="";
      if(p.out){
        cardsHTML="";
      } else if(p.hand.length){
        const reveal=p.human||P.stage==="showdown";
        if(p.folded) cardsHTML="";
        else if(reveal) cardsHTML=p.hand.map(c=>cardHTML(c,true)).join("");
        else cardsHTML=cardBackHTML(true)+cardBackHTML(true);
      }
      seat.innerHTML=`
        <div class="seat-cards">${cardsHTML}</div>
        <div class="seat-info">
          <div class="seat-name">${p.name}</div>
          <div class="seat-chips">${T?"T$ ":"G "}${p.chips}</div>
          <div class="seat-bet">${p.bet>0?"BET "+p.bet:""}</div>
          <div class="seat-tag">${p.out?"OUT":p.folded?"FOLD":p.allin?"ALL-IN":""}</div>
        </div>`;
    });
    const yh=$("yourHand");
    const me=P.players[0];
    if(me.hand.length&&!me.out){
      let hn="";
      if(P.community.length>=3&&!me.folded){
        hn=HAND_NAMES[evaluate7(me.hand.concat(P.community)).cat];
      }
      yh.innerHTML=me.hand.map(c=>cardHTML(c)).join("")
        +(hn?`<span class="hand-name">${hn}</span>`:"")
        +(me.folded?'<span class="hand-name" style="color:var(--red);">FOLDED</span>':"");
    } else yh.innerHTML="";
    renderControls();
  }

  function renderControls(disableAll){
    if(!P){ ["btnFold","btnCall","btnRaise"].forEach(id=>$(id).disabled=true); return; }
    const me=P.players[0];
    const enabled=P.humanPending&&!me.folded&&!me.allin&&!disableAll;
    const toCall=P.curBet-me.bet;
    const canPay=Math.min(toCall,me.chips);
    $("btnFold").disabled=!enabled;
    $("btnCall").disabled=!enabled;
    $("btnRaise").disabled=!enabled||me.chips<=canPay;
    const cur=P.mode==="tournament"?"T$":"G";
    $("btnCall").innerHTML=toCall===0
      ?"CHECK<br>过牌"
      :me.chips<=toCall
        ?`ALL-IN ${cur}${me.chips}<br>全押`
        :`CALL ${cur}${toCall}<br>跟注`;
  }

  function log(msg){
    const el=$("pokerLog");
    const line=document.createElement("div");
    line.textContent="> "+msg;
    el.appendChild(line);
    while(el.children.length>5) el.removeChild(el.firstChild);
  }

  /* ---------- 事件 ---------- */
  $("btnDeal").onclick=startCash;
  $("btnTournament").onclick=startTournament;
  $("btnFold").onclick=humanFold;
  $("btnCall").onclick=humanCall;
  $("btnRaise").onclick=()=>$("raiseRow").classList.toggle("open");
  $("btnRaiseCancel").onclick=()=>$("raiseRow").classList.remove("open");
  document.querySelectorAll("#raiseRow [data-raise]").forEach(b=>{
    b.onclick=()=>humanRaise(b.dataset.raise);
  });
  $("prNext").onclick=()=>{
    $("pokerResultModal").classList.add("hidden");
    if(P.mode==="tournament"&&T&&!T.finished){ startTournament(); }
    else {
      if(T&&T.finished) T=null;
      PokerModule.enter();
    }
  };
  $("prMap").onclick=()=>{
    $("pokerResultModal").classList.add("hidden");
    showView("map");
  };
  $("pokerResultModal").addEventListener("click",e=>{
    if(e.target===$("pokerResultModal")) e.target.classList.add("hidden");
  });

  return {
    get tournament(){ return T; },
    enter(mode){
      if(mode==="vip") vip=true;
      else if(mode==="normal") vip=false;
      // 回到一场未打完的 VIP 锦标赛时自动切回 VIP 模式
      if(T&&!T.finished&&T.vip) vip=true;
      // 未完成手回滚（保护玩家筹码）
      if(T&&!T.finished&&P&&P.stage!=="showdown"&&T.savedChips){
        T.players.forEach(p=>{ p.chips=T.savedChips[p.id]; });
        T.savedChips=null;
      }
      P=null;
      // 顶栏标题
      const h=document.querySelector("#view-poker .brand h1");
      if(h) h.textContent = vip ? "POKER VIP" : "POKER";
      $("pokerResultModal").classList.add("hidden");
      $("community").innerHTML="";
      $("potVal").textContent="0";
      $("yourHand").innerHTML="";
      $("pokerLog").innerHTML="";
      // intro 文案按锦标赛状态
      if(T&&!T.finished){
        const cfg=T.cfg||TOUR;
        const lv=Math.min(cfg.blinds.length-1,Math.floor(T.handNo/cfg.handsPerLevel));
        const remaining=T.players.filter(p=>!p.out).length;
        $("pokerIntroText").innerHTML=`${T.vip?"VIP ":""}锦标赛进行中 · 剩余 ${remaining} 人<br>下一手盲注 Lv.${lv+1}（${cfg.blinds[lv][0]}/${cfg.blinds[lv][1]}）`;
        $("btnDeal").style.display="none";
        $("btnTournament").textContent=`继续 ${T.vip?"VIP SNG":"SNG"} · 第 ${T.handNo+1} 手`;
      } else {
        T=null;
        if(vip){
          $("pokerIntroText").innerHTML="VIP 现金桌：盲注 200/400，对手各带五万<br>VIP 锦标赛：G5,000 买入，冠军 G15,000 / 亚军 G5,000";
          $("btnDeal").style.display="block";
          $("btnDeal").textContent="VIP CASH · 现金桌（盲注 200/400）";
          $("btnTournament").textContent="VIP SNG · 锦标赛（报名 G5,000）";
        } else {
          $("pokerIntroText").innerHTML="现金桌：金币直接上桌，随时离场<br>锦标赛：G500 买入，4 人淘汰赛，冠军 G1500 / 亚军 G500";
          $("btnDeal").style.display="block";
          $("btnDeal").textContent="CASH · 现金桌（盲注 10/20）";
          $("btnTournament").textContent="SNG · 锦标赛（报名 G500）";
        }
      }
      const botChips=vip?50000:1000;
      [0,1,2,3].forEach(i=>{
        const seat=$("seat-"+i);
        seat.className="seat seat-"+i;
        let chips="G "+botChips;
        if(i===0) chips="G "+GameState.coins.toLocaleString();
        if(T&&!T.finished){ const tp=T.players[i]; chips=(tp.out?"OUT":"T$ "+tp.chips.toLocaleString()); }
        seat.innerHTML=`
          <div class="seat-cards"></div>
          <div class="seat-info">
            <div class="seat-name">${i===0?"YOU":BOT_NAMES[i-1]}</div>
            <div class="seat-chips">${chips}</div>
          </div>`;
      });
      $("stageTag").textContent=vip?"TEXAS HOLD'EM VIP · 200/400":"TEXAS HOLD'EM · 10/20";
      $("pokerIntro").style.display="flex";
      renderControls();
    }
  };
})();
