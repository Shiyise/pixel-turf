/* ===================== 赛马模块 ===================== */
const HORSE_POOL = [
  { id:0,  name:"秘书处",   en:"SECRETARIAT",   color:"#b8733a", rarity:"SSR", origin:"美国 · 1973 三冠王", desc:"史上最强三冠马" },
  { id:1,  name:"大震撼",   en:"DEEP IMPACT",    color:"#4a3520", rarity:"SSR", origin:"日本 · 2005", desc:"无败二冠" },
  { id:2,  name:"范高尔",   en:"FRANKEL",        color:"#c8c8c8", rarity:"SSR", origin:"英国 · 14 战全胜", desc:"现代地表最强" },
  { id:3,  name:"法拉普",   en:"PHAR LAP",       color:"#6b3a20", rarity:"SR",  origin:"澳洲 · 1930s", desc:"国民英雄" },
  { id:4,  name:"杏目",     en:"ALMOND EYE",     color:"#b8733a", rarity:"SR",  origin:"日本 · 雌马三冠", desc:"日本赏金最高雌马" },
  { id:5,  name:"金枪六十", en:"GOLDEN SIXTY",   color:"#b8b8b8", rarity:"SR",  origin:"香港 · 现役", desc:"香港赏金王" },
  { id:6,  name:"周日宁静", en:"SUNDAY SILENCE", color:"#1a1a1a", rarity:"SR",  origin:"日本 · 种马王", desc:"改变日本赛马史" },
  { id:7,  name:"西雅图回旋", en:"SEATTLE SLEW", color:"#0f0f0f", rarity:"SR",  origin:"美国 · 三冠王", desc:"不败三冠" },
  { id:8,  name:"精英大师", en:"SILENT WITNESS", color:"#5a3a22", rarity:"R",   origin:"香港 · 17 连胜", desc:"短途传奇" },
  { id:9,  name:"步步友",   en:"ABLE FRIEND",    color:"#7a4525", rarity:"R",   origin:"香港 · 一哩王", desc:"世界最佳一哩" },
  { id:10, name:"爪皇凌雨", en:"VENGEANCE",      color:"#4a2d1a", rarity:"R",   origin:"香港 · 迪拜世界杯", desc:"首攻迪拜的港马" },
  { id:11, name:"创世驹",   en:"CHRONO GENESIS", color:"#a86535", rarity:"R",   origin:"日本 · 有马纪念", desc:"近代名雌马" },
];
const SIGN_PRICE = { R:200, SR:500, SSR:1500 };
const TRAIN_COST = 50, TRAIN_GAIN = 0.05, TRAIN_CHANCE = 0.7;
const BREED_COST = 800, CUP_ENTRY = 300;
const CUP_PRIZES = [3000, 800, 300];
const MAX_STABLE = 5, TRACK_LEN = 1000;

const RaceModule = (()=>{
  let state = {
    raceHorses: [], selected: null, bet: 0,
    myHorseSlot: -1, cupMode: false, lastWinner: null, phase: "betting",
  };

  function effAttrs(s){
    const lvMul = 1 + (s.level-1)*0.02;
    const fatigueMul = 1 - (s.fatigue||0)/200;
    return {
      speed: (s.baseSpeed + (s.trained.speed||0)) * fatigueMul,
      stamina: (s.baseStamina + (s.trained.stamina||0)) * fatigueMul,
      burst: (s.baseBurst + (s.trained.burst||0)) * fatigueMul,
      consistency: (s.baseConsistency + (s.trained.consistency||0)) * fatigueMul,
    };
  }
  function fromStableToRace(s, slot){
    const a = effAttrs(s), p = HORSE_POOL[s.poolId];
    return { ...p, slot, isMine:true, poolId:s.poolId,
      speed:a.speed, stamina:a.stamina, burst:a.burst, consistency:a.consistency,
      pos:0, finished:false, finishOrder:null };
  }
  function genRandomHorse(poolId, slot, cupBoost){
    const base = HORSE_POOL[poolId];
    const rMul = base.rarity==="SSR"?1.10:base.rarity==="SR"?1.0:0.92;
    const boost = cupBoost ? 1.15 : 1.0;
    return { ...base, slot, isMine:false,
      speed: rand(0.85,1.15)*rMul*boost,
      stamina: rand(0.70,1.20)*rMul*boost,
      burst: rand(0.05,0.30), consistency: rand(0.75,1.20),
      pos:0, finished:false, finishOrder:null };
  }
  function calcOdds(h){
    const score = h.speed + h.stamina*0.7 + h.consistency*0.5;
    return Math.max(1.5, Math.min(15, Math.round(12/score*10)/10));
  }

  function renderTop(){
    $("streakVal").textContent = GameState.streak;
    $("raceTitle").textContent = state.cupMode
      ? `★ CUP · 第 ${GameState.raceNo} 场 ★`
      : `— 第 ${GameState.raceNo} 场 —`;
  }
  function renderMyPick(){
    const sel = $("myPick");
    sel.innerHTML = '<option value="-1">不派</option>';
    GameState.stable.forEach((s,i)=>{
      const p = HORSE_POOL[s.poolId];
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = p.name + " Lv." + s.level + ((s.fatigue||0)>50?" (累)":"");
      sel.appendChild(opt);
    });
    sel.value = state.myHorseSlot;
    const btn = $("btnCup");
    btn.classList.toggle("active", state.cupMode);
    btn.textContent = state.cupMode ? "CUP ON" : "CUP G300";
  }
  function renderHorses(){
    const list = $("horseList");
    list.innerHTML = "";
    state.raceHorses.forEach((h,i)=>{
      const card = document.createElement("div");
      card.className = "horse-card"
        + (state.selected===i?" selected":"")
        + (h.isMine?" mine":"")
        + (state.cupMode && !h.isMine ? " cup-horse":"");
      card.innerHTML = `
        <span class="rarity">${h.rarity}</span>
        <div class="top">
          <span class="num-badge" style="background:${h.color}">${h.slot+1}</span>
          <div style="flex:1;min-width:0;">
            <div class="name">${h.name}${h.isMine?" ★":""}</div>
            <span class="en">${h.en}</span>
          </div>
          <span class="odds">×${calcOdds(h)}</span>
        </div>
        <div class="attrs">
          <div class="attr-row"><span class="lbl">速度</span><span class="bar"><span class="fill" style="width:${Math.min(100,h.speed/1.5*100)}%"></span></span></div>
          <div class="attr-row"><span class="lbl">耐力</span><span class="bar"><span class="fill" style="width:${Math.min(100,h.stamina/1.5*100)}%"></span></span></div>
          <div class="attr-row"><span class="lbl">爆发</span><span class="bar"><span class="fill" style="width:${h.burst/0.4*100}%"></span></span></div>
        </div>`;
      card.onclick = ()=>{
        if(state.phase!=="betting") return;
        state.selected = (state.selected===i?null:i);
        renderHorses(); renderBetBar();
      };
      list.appendChild(card);
    });
  }
  function renderBetBar(){
    const who = $("betWho"), btn = $("btnGo");
    if(state.selected===null){
      who.innerHTML = "未选择下注马匹"; btn.disabled = true;
    } else {
      const h = state.raceHorses[state.selected];
      who.innerHTML = "下注 <b>"+(h.slot+1)+". "+h.name+"</b>";
      btn.disabled = state.bet<=0 || state.bet>GameState.coins;
    }
    $("betAmt").textContent = "G " + state.bet;
  }

  /* Canvas */
  const canvas = $("track");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  function resizeCanvas(){
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 260;
    canvas.style.width = "100%";
    canvas.style.height = "260px";
  }
  window.addEventListener("resize", ()=>{ if(!$("view-race").classList.contains("hidden")){ resizeCanvas(); drawTrack(); } });
  function pxRect(x,y,w,h,color){ ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),w,h); }
  function shade(hex,amt){
    const c=hex.replace("#","");
    let r=Math.max(0,Math.min(255,parseInt(c.substr(0,2),16)+amt));
    let g=Math.max(0,Math.min(255,parseInt(c.substr(2,2),16)+amt));
    let b=Math.max(0,Math.min(255,parseInt(c.substr(4,2),16)+amt));
    return `rgb(${r},${g},${b})`;
  }
  function drawHorseSprite(cx,cy,h,frame){
    const x=Math.round(cx-8), y=Math.round(cy-7);
    const body=h.color, dark=shade(body,-40);
    pxRect(x+2,y+5,12,5,body);
    pxRect(x+12,y+2,3,5,body);
    pxRect(x+14,y+1,4,3,body);
    pxRect(x+15,y-1,1,2,body); pxRect(x+17,y-1,1,2,body);
    pxRect(x+11,y+1,2,4,dark);
    pxRect(x-1,y+4,3,2,dark); pxRect(x-2,y+3,2,2,dark);
    if(frame===0){
      pxRect(x+3,y+10,2,4,body); pxRect(x+9,y+10,2,3,body);
      pxRect(x+4,y+13,2,1,dark); pxRect(x+10,y+12,2,1,dark);
      pxRect(x+6,y+10,2,3,body); pxRect(x+10,y+10,2,4,body);
      pxRect(x+7,y+12,2,1,dark); pxRect(x+11,y+13,2,1,dark);
    } else {
      pxRect(x+4,y+10,2,3,body); pxRect(x+10,y+10,2,4,body);
      pxRect(x+5,y+12,2,1,dark); pxRect(x+11,y+13,2,1,dark);
      pxRect(x+3,y+10,2,4,body); pxRect(x+9,y+10,2,3,body);
      pxRect(x+4,y+13,2,1,dark); pxRect(x+10,y+12,2,1,dark);
    }
    pxRect(x+5,y-2,4,4, h.isMine?"#ffd800":"#ff004d");
    pxRect(x+6,y-4,2,2, h.isMine?"#ff004d":"#ffd800");
    pxRect(x+6,y+6,3,3,"#fff");
    ctx.fillStyle="#000"; ctx.font="bold 7px monospace"; ctx.textAlign="center";
    ctx.fillText(h.slot+1, x+7, y+9);
  }
  function drawTrack(){
    const w=canvas.width, h=canvas.height;
    pxRect(0,0,w,h,"#0a0b14");
    for(let i=0;i<30;i++) pxRect((i*73)%w,(i*37)%40,1,1,"#8a8fa8");
    pxRect(0,40,w,20,"#1f2138");
    for(let x=0;x<w;x+=16){
      const c=(x/16)%3===0?"#ffd800":(x/16)%3===1?"#ff004d":"#38b000";
      pxRect(x,44,2,2,c);
    }
    const trackTop=70, trackBottom=h-20;
    const laneH=(trackBottom-trackTop)/8;
    for(let i=0;i<8;i++){
      pxRect(0,trackTop+i*laneH,w,laneH,(i%2===0)?"#2d9400":"#38b000");
      for(let x=0;x<w;x+=24) if((x+i*7)%3===0) pxRect(x,trackTop+i*laneH+4,2,1,"#1f6e00");
    }
    ctx.strokeStyle="rgba(255,255,255,.15)"; ctx.lineWidth=1;
    for(let i=0;i<=8;i++){
      ctx.beginPath(); ctx.moveTo(0,trackTop+i*laneH+.5); ctx.lineTo(w,trackTop+i*laneH+.5); ctx.stroke();
    }
    pxRect(40,trackTop,2,trackBottom-trackTop,"#fff");
    const ex=w-24;
    for(let i=0;i<8;i++) for(let j=0;j<3;j++)
      pxRect(ex+j*8,trackTop+i*laneH,8,laneH,(i+j)%2===0?"#ddd":"#ff004d");
    pxRect(0,trackBottom,w,h-trackBottom,"#1f2138");
    const frame=Math.floor(performance.now()/120)%2;
    state.raceHorses.forEach(h=>{
      const laneY=trackTop+h.slot*laneH+laneH/2;
      const x=50+(h.pos/TRACK_LEN)*((ex-50)-30);
      drawHorseSprite(x,laneY,h,frame);
    });
  }

  function newRace(){
    GameState.stable.forEach(s=>{ s.fatigue = Math.max(0,(s.fatigue||0)-15); });
    state.raceHorses = [];
    const myIdx = parseInt(state.myHorseSlot);
    let slot = 0;
    if(myIdx>=0 && GameState.stable[myIdx]){
      state.raceHorses.push(fromStableToRace(GameState.stable[myIdx], slot++));
    }
    const usedPoolIds = new Set();
    if(myIdx>=0 && GameState.stable[myIdx]) usedPoolIds.add(GameState.stable[myIdx].poolId);
    let poolIdx = HORSE_POOL.map((p,i)=>i).filter(id=>!usedPoolIds.has(id));
    if(state.cupMode){
      const score = r => r==="SSR"?3:r==="SR"?2:1;
      poolIdx.sort((a,b)=>score(HORSE_POOL[b].rarity)-score(HORSE_POOL[a].rarity));
    }
    for(let i=poolIdx.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [poolIdx[i],poolIdx[j]]=[poolIdx[j],poolIdx[i]];
    }
    let pi=0;
    while(state.raceHorses.length<8){
      state.raceHorses.push(genRandomHorse(poolIdx[pi++], slot++, state.cupMode));
    }
    state.selected=null; state.bet=0; state.phase="betting";
    renderTop(); renderMyPick(); renderHorses(); renderBetBar();
    $("trackOverlay").style.display="flex";
    $("raceTag").textContent = state.cupMode ? "★ CUP RACE ★" : "SELECT YOUR HORSE";
    $("raceTag").classList.toggle("cup", state.cupMode);
    $("countdown").textContent="";
    resizeCanvas(); drawTrack();
  }

  function startRace(){
    if(state.selected===null || state.bet<=0 || state.bet>GameState.coins){
      toast("请先选马并设定金额"); return;
    }
    addCoins(-state.bet);
    state.phase="countdown";
    renderBetBar();
    let n=3;
    $("raceTag").textContent="GET READY";
    $("countdown").textContent=n;
    const cd=setInterval(()=>{
      n--;
      if(n<=0){ clearInterval(cd); $("countdown").textContent="GO!"; setTimeout(beginRun,500); }
      else $("countdown").textContent=n;
    },800);
  }

  function beginRun(){
    $("countdown").textContent="";
    $("raceTag").textContent = state.cupMode ? "★ LIVE CUP ★" : "★ LIVE ★";
    state.phase="racing";
    state.raceHorses.forEach(h=>{ h.pos=0; h.finished=false; h.finishOrder=null; });
    let finishCount=0, lastT=performance.now();
    function frame(now){
      const dt=Math.min(50, now-lastT); lastT=now;
      let allDone=true;
      state.raceHorses.forEach(h=>{
        if(h.finished) return;
        allDone=false;
        let v=h.speed*90;
        if(h.pos>600){ const drop=(h.pos-600)/400; v*=(1-drop*(1.2-h.stamina)*0.6); }
        if(h.pos>850 && Math.random()<h.burst*0.05) v*=1.5;
        v=Math.max(30, v+(Math.random()-.5)*(2.2-h.consistency)*40);
        h.pos += v*dt/1000;
        if(h.pos>=TRACK_LEN){ h.pos=TRACK_LEN; h.finished=true; h.finishOrder=++finishCount; }
      });
      drawTrack();
      if(!allDone) requestAnimationFrame(frame);
      else finishRace();
    }
    requestAnimationFrame(frame);
  }

  function finishRace(){
    state.phase="done";
    const sorted=[...state.raceHorses].sort((a,b)=>a.finishOrder-b.finishOrder);
    const winner=sorted[0];
    state.lastWinner=winner;
    const picked=state.raceHorses[state.selected];
    const odds=calcOdds(picked);
    let pnl=-state.bet;

    if(winner.id===picked.id){
      let winAmt=Math.round(state.bet*odds);
      GameState.streak+=1;
      if(GameState.streak>=3) winAmt=Math.round(winAmt*(1+Math.min(0.5,(GameState.streak-2)*0.15)));
      addCoins(winAmt);
      pnl=winAmt-state.bet;
      if(!GameState.dex.includes(winner.id)) GameState.dex.push(winner.id);
    } else {
      GameState.streak=0;
    }

    const myIdx = parseInt(state.myHorseSlot);
    let myRaceH = null;
    if(myIdx>=0 && GameState.stable[myIdx]){
      myRaceH = state.raceHorses.find(x=>x.isMine && x.poolId===GameState.stable[myIdx].poolId);
    }
    if(myRaceH){
      const s = GameState.stable[myIdx];
      const place = myRaceH.finishOrder;
      s.exp += place===1?20:10;
      s.fatigue = Math.min(100,(s.fatigue||0)+(state.cupMode?40:30));
      while(s.exp >= s.level*20){
        s.exp -= s.level*20; s.level+=1;
        setTimeout(()=>toast("LEVEL UP! " + HORSE_POOL[s.poolId].name + " Lv." + s.level), 700);
      }
      if(place===1){ addCoins(100); pnl+=100; }
      if(state.cupMode && place<=3){
        const cup = CUP_PRIZES[place-1];
        addCoins(cup); pnl+=cup;
        setTimeout(()=>toast("杯赛第"+place+"名! +G"+cup), 600);
      }
    }

    if(GameState.coins<=0){
      addCoins(200);
      setTimeout(()=>toast("BUST! +200"), 800);
    }
    GameState.raceNo += 1;
    gsSave(); renderTop();

    $("rWinnerNum").textContent=winner.slot+1;
    $("rWinnerNum").style.background=winner.color;
    $("rWinnerName").textContent=winner.name;
    $("rWinnerDesc").textContent=winner.origin+" · "+winner.desc;
    $("rBet").textContent="G "+state.bet;
    $("rOdds").textContent="× "+odds;
    const pnlEl=$("rPnl");
    if(pnl>=0){ pnlEl.textContent="+G "+pnl; pnlEl.className="v pos"; }
    else { pnlEl.textContent="-G "+Math.abs(pnl); pnlEl.className="v neg"; }
    $("rCoin").textContent="G "+GameState.coins;
    $("rTitle").textContent=(winner.id===picked.id)?"YOU WIN!":"LOSE";
    $("rSub").textContent=state.cupMode?"CUP RACE OVER":"RACE OVER";

    const btnSign=$("btnSignUp");
    const alreadyOwned=GameState.stable.some(s=>s.poolId===winner.id);
    const full=GameState.stable.length>=MAX_STABLE;
    if(alreadyOwned||full){
      btnSign.disabled=true;
      btnSign.textContent=alreadyOwned?"已在马厩":"马厩已满";
      btnSign.onclick=null;
    } else {
      const price=SIGN_PRICE[winner.rarity]||500;
      btnSign.disabled=GameState.coins<price;
      btnSign.textContent="签约冠军 G"+price;
      btnSign.onclick=()=>{
        if(GameState.coins<price) return;
        addCoins(-price);
        GameState.stable.push({
          poolId:winner.id, level:1, exp:0, fatigue:0,
          baseSpeed:winner.speed, baseStamina:winner.stamina,
          baseBurst:winner.burst, baseConsistency:winner.consistency,
          trained:{speed:0,stamina:0,burst:0,consistency:0},
        });
        btnSign.disabled=true;
        btnSign.textContent="已签约 "+HORSE_POOL[winner.id].name;
        toast("签约成功: "+HORSE_POOL[winner.id].name);
      };
    }
    $("resultModal").classList.remove("hidden");
  }

  /* 马厩 */
  function openStable(){
    const list=$("stableList");
    list.innerHTML="";
    if(GameState.stable.length===0){
      list.innerHTML='<div class="stable-empty">马厩空无一马</div>';
    } else {
      GameState.stable.forEach((s,idx)=>{
        const p=HORSE_POOL[s.poolId];
        const needExp=s.level*20, fat=s.fatigue||0;
        const item=document.createElement("div");
        item.className="stable-item";
        item.innerHTML=`
          <div class="stable-row">
            <div class="sw" style="background:${p.color}"></div>
            <div class="info">
              <div class="nm">${p.name} <span style="color:var(--muted);font-size:10px;">${p.en}</span></div>
              <div class="lv">Lv.${s.level} · EXP ${s.exp}/${needExp}</div>
              <div class="exp-bar"><div class="exp-fill" style="width:${s.exp/needExp*100}%"></div></div>
              <div class="fatigue-row">
                <span>疲劳</span>
                <div class="fatigue-bar"><div class="fatigue-fill" style="width:${fat}%"></div></div>
                <span>${fat}%</span>
              </div>
            </div>
          </div>
          <div class="train-btns">
            <button class="train-btn" data-idx="${idx}" data-attr="speed">速 G50</button>
            <button class="train-btn" data-idx="${idx}" data-attr="stamina">耐 G50</button>
            <button class="train-btn" data-idx="${idx}" data-attr="burst">爆 G50</button>
            <button class="train-btn" data-idx="${idx}" data-attr="consistency">稳 G50</button>
            <button class="train-btn sell-btn" data-sell="${idx}">卖 G${sellHorsePrice(s)}</button>
          </div>`;
        list.appendChild(item);
      });
      list.querySelectorAll(".train-btn:not(.sell-btn)").forEach(btn=>{
        btn.onclick=()=>{
          const idx=parseInt(btn.dataset.idx), attr=btn.dataset.attr;
          const s=GameState.stable[idx];
          if(GameState.coins<TRAIN_COST){ toast("金币不足"); return; }
          const baseKey="base"+attr[0].toUpperCase()+attr.slice(1);
          const cur=s[baseKey]+(s.trained[attr]||0);
          if(cur>=s[baseKey]*1.5){ toast("该属性已满"); return; }
          addCoins(-TRAIN_COST);
          if(Math.random()<TRAIN_CHANCE){
            s.trained[attr]=(s.trained[attr]||0)+TRAIN_GAIN;
            gsSave(); openStable();
            toast("训练成功 +"+TRAIN_GAIN);
          } else toast("训练失败…");
        };
      });
      list.querySelectorAll(".sell-btn").forEach(btn=>{
        btn.onclick=()=>{
          const idx=parseInt(btn.dataset.sell);
          const s=GameState.stable[idx];
          if(!btn.classList.contains("confirming")){
            // 两段式确认：第一次进入待确认，再点一次才真正出售
            list.querySelectorAll(".sell-btn.confirming").forEach(b=>{
              const oi=parseInt(b.dataset.sell);
              b.classList.remove("confirming");
              if(GameState.stable[oi]) b.textContent="卖 G"+sellHorsePrice(GameState.stable[oi]);
            });
            btn.classList.add("confirming");
            btn.textContent="确认卖?";
            return;
          }
          const price=sellHorsePrice(s);
          const name=HORSE_POOL[s.poolId].name;
          GameState.stable.splice(idx,1);
          addCoins(price);
          state.myHorseSlot=-1;
          renderMyPick();
          gsSave();
          toast("出售 "+name+" +G"+price);
          openStable();
        };
      });
    }
    $("stableCount").textContent=GameState.stable.length+" / "+MAX_STABLE;
    $("stableModal").classList.remove("hidden");
  }

  /* 卖马估价：签约价 6 折 + 训练投入半价 + 每级 G30 */
  function sellHorsePrice(s){
    const rarity=HORSE_POOL[s.poolId].rarity;
    const base=Math.floor((SIGN_PRICE[rarity]||300)*0.6);
    const trainTimes=Object.values(s.trained||{}).reduce((a,b)=>a+(b||0)/TRAIN_GAIN,0);
    const trainVal=Math.floor(trainTimes*TRAIN_COST*0.5);
    const lvVal=(s.level-1)*30;
    return base+trainVal+lvVal;
  }

  /* 配种 */
  function openBreed(){
    if(GameState.stable.length<2){ toast("至少需要 2 匹马"); return; }
    if(GameState.stable.length>=MAX_STABLE){ toast("马厩已满"); return; }
    const dad=$("breedDad"), mom=$("breedMom");
    dad.innerHTML=""; mom.innerHTML="";
    GameState.stable.forEach((s,i)=>{
      const p=HORSE_POOL[s.poolId];
      dad.innerHTML += `<option value="${i}">${p.name} Lv.${s.level}</option>`;
      mom.innerHTML += `<option value="${i}">${p.name} Lv.${s.level}</option>`;
    });
    mom.selectedIndex = Math.min(1, GameState.stable.length-1);
    $("stableModal").classList.add("hidden");
    $("breedModal").classList.remove("hidden");
  }
  function doBreed(){
    const di=parseInt($("breedDad").value), mi=parseInt($("breedMom").value);
    if(di===mi){ toast("不能选同一匹马"); return; }
    if(GameState.coins<BREED_COST){ toast("金币不足 G"+BREED_COST); return; }
    const p1=GameState.stable[di], p2=GameState.stable[mi];
    const ownedIds=new Set(GameState.stable.map(s=>s.poolId));
    const candidates=HORSE_POOL.map((p,i)=>i).filter(id=>!ownedIds.has(id));
    const newId = candidates.length
      ? candidates[Math.floor(Math.random()*candidates.length)]
      : Math.floor(Math.random()*HORSE_POOL.length);
    const j=()=>rand(0.9,1.1);
    addCoins(-BREED_COST);
    GameState.stable.push({
      poolId:newId, level:1, exp:0, fatigue:0,
      baseSpeed:(p1.baseSpeed+p2.baseSpeed)/2*j(),
      baseStamina:(p1.baseStamina+p2.baseStamina)/2*j(),
      baseBurst:(p1.baseBurst+p2.baseBurst)/2*j(),
      baseConsistency:(p1.baseConsistency+p2.baseConsistency)/2*j(),
      trained:{speed:0,stamina:0,burst:0,consistency:0},
    });
    gsSave();
    $("breedModal").classList.add("hidden");
    toast("小马诞生: "+HORSE_POOL[newId].name);
    openStable();
  }

  /* 图鉴 */
  function openDex(){
    const grid=$("dexGrid");
    grid.innerHTML="";
    HORSE_POOL.forEach(h=>{
      const unlocked=GameState.dex.includes(h.id);
      const cell=document.createElement("div");
      cell.className="dex-cell"+(unlocked?"":" locked");
      cell.innerHTML=`<div class="swatch" style="background:${unlocked?h.color:"#222"}"></div>
        <div class="n">${unlocked?h.name:"???"}</div>
        <div class="r">${unlocked?h.rarity:"LOCKED"}</div>`;
      grid.appendChild(cell);
    });
    $("dexCount").textContent=GameState.dex.length+" / "+HORSE_POOL.length;
    $("dexModal").classList.remove("hidden");
  }

  /* 事件 */
  document.querySelectorAll(".chip").forEach(btn=>{
    btn.onclick=()=>{ state.bet=Math.min(GameState.coins,parseInt(btn.dataset.amt)); renderBetBar(); };
  });
  $("btnGo").onclick=startRace;
  $("rAgain").onclick=()=>{
    $("resultModal").classList.add("hidden");
    state.cupMode=false;
    newRace();
  };
  $("btnStable").onclick=openStable;
  $("stableClose").onclick=()=>$("stableModal").classList.add("hidden");
  $("btnBreed").onclick=openBreed;
  $("breedCancel").onclick=()=>{ $("breedModal").classList.add("hidden"); $("stableModal").classList.remove("hidden"); };
  $("breedGo").onclick=doBreed;
  $("btnDex").onclick=openDex;
  $("dexClose").onclick=()=>$("dexModal").classList.add("hidden");
  $("myPick").onchange=(e)=>{ state.myHorseSlot=parseInt(e.target.value); newRace(); };
  $("btnCup").onclick=()=>{
    if(!state.cupMode){
      if(parseInt(state.myHorseSlot)<0){ toast("请先派出自家马"); return; }
      if(GameState.coins<CUP_ENTRY){ toast("报名费不足"); return; }
      addCoins(-CUP_ENTRY);
      state.cupMode=true;
      newRace();
      toast("杯赛报名! 冠军 G"+CUP_PRIZES[0]);
    } else {
      addCoins(CUP_ENTRY);
      state.cupMode=false;
      newRace();
      toast("已退出杯赛");
    }
  };
  ["resultModal","stableModal","dexModal"].forEach(id=>{
    $(id).addEventListener("click", e=>{ if(e.target===$(id)) $(id).classList.add("hidden"); });
  });
  $("breedModal").addEventListener("click", e=>{
    if(e.target===$("breedModal")){ $("breedModal").classList.add("hidden"); $("stableModal").classList.remove("hidden"); }
  });

  return {
    enter(){
      state.cupMode = false;
      newRace();
    }
  };
})();
