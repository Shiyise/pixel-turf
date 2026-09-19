/* ===================== 足球赌球模块 =====================
 * 20 支五大联赛球队（每联赛 4 支），每轮抽 8 队踢 4 场。
 * 盘口：胜平负（1X2）、大小球 2.5、精确比分；赔率由 Poisson 模型给出。
 * 下注后播放 11 人制像素比赛动画，比分在开球前按概率采样，动画只还原结果。
 * ======================================================= */
const TEAMS = [
  // 英超
  {id:0,  name:"曼城",       short:"MCI", en:"MAN CITY",      color:"#6cabdd", rating:1.16, lg:"英超"},
  {id:1,  name:"阿森纳",     short:"ARS", en:"ARSENAL",       color:"#ef0107", rating:1.12, lg:"英超"},
  {id:2,  name:"利物浦",     short:"LIV", en:"LIVERPOOL",     color:"#c8102e", rating:1.12, lg:"英超"},
  {id:3,  name:"切尔西",     short:"CHE", en:"CHELSEA",       color:"#034694", rating:1.07, lg:"英超"},
  // 西甲
  {id:4,  name:"皇家马德里", short:"RMA", en:"REAL MADRID",   color:"#febe10", rating:1.15, lg:"西甲"},
  {id:5,  name:"巴塞罗那",   short:"BAR", en:"BARCELONA",     color:"#a50044", rating:1.10, lg:"西甲"},
  {id:6,  name:"马德里竞技", short:"ATM", en:"ATLETICO",      color:"#272e61", rating:1.05, lg:"西甲"},
  {id:7,  name:"比利亚雷亚尔",short:"VIL",en:"VILLARREAL",    color:"#f5d547", rating:0.95, lg:"西甲"},
  // 意甲
  {id:8,  name:"国际米兰",   short:"INT", en:"INTER MILAN",   color:"#0068a8", rating:1.10, lg:"意甲"},
  {id:9,  name:"那不勒斯",   short:"NAP", en:"NAPOLI",        color:"#12a0d7", rating:1.03, lg:"意甲"},
  {id:10, name:"AC米兰",     short:"MIL", en:"AC MILAN",      color:"#fb090b", rating:1.02, lg:"意甲"},
  {id:11, name:"尤文图斯",   short:"JUV", en:"JUVENTUS",      color:"#e8e8e8", rating:1.00, lg:"意甲"},
  // 德甲
  {id:12, name:"拜仁慕尼黑", short:"BAY", en:"BAYERN",        color:"#dc052d", rating:1.13, lg:"德甲"},
  {id:13, name:"多特蒙德",   short:"DOR", en:"DORTMUND",      color:"#fde100", rating:1.05, lg:"德甲"},
  {id:14, name:"莱比锡",     short:"RBL", en:"LEIPZIG",       color:"#dd0741", rating:0.99, lg:"德甲"},
  {id:15, name:"门兴",       short:"BMG", en:"GLADBACH",      color:"#00a651", rating:0.92, lg:"德甲"},
  // 法甲
  {id:16, name:"巴黎圣日耳曼",short:"PSG",en:"PARIS SG",      color:"#004170", rating:1.14, lg:"法甲"},
  {id:17, name:"马赛",       short:"MAR", en:"MARSEILLE",     color:"#9fd8ff", rating:0.97, lg:"法甲"},
  {id:18, name:"摩纳哥",     short:"MON", en:"MONACO",        color:"#e01e13", rating:0.94, lg:"法甲"},
  {id:19, name:"里昂",       short:"LYO", en:"LYON",          color:"#1e3a8a", rating:0.93, lg:"法甲"},
];
const CS_PICKS = ["1-0","2-0","2-1","3-1","1-1","2-2","0-0","0-1","1-2","0-2"];
const FB_CHIPS = [10,50,100,500];
const GOAL_PAUSE = 1300;

const FootballModule = (()=>{
  let roundNo = 1;
  let state = null;
  let anim = null;
  let raf = 0;
  const FRAME_MS = 1000/60;
  function stopRaf(){ clearTimeout(raf); cancelAnimationFrame(raf); }

  /* ---------- 概率 / 赔率（Poisson） ---------- */
  function fact(n){ let f=1; for(let i=2;i<=n;i++) f*=i; return f; }
  function pois(k,l){ return Math.exp(-l)*Math.pow(l,k)/fact(k); }
  function scoreMatrix(home,away){
    const lh=Math.max(0.35, 1.35*home.rating*1.12);
    const la=Math.max(0.30, 1.20*away.rating*0.92);
    const m=[];
    for(let h=0;h<=6;h++){ m[h]=[]; for(let a=0;a<=6;a++) m[h][a]=pois(h,lh)*pois(a,la); }
    return m;
  }
  function oddsFor(p){ return Math.max(1.05, Math.min(20, Math.round(0.88/p*100)/100)); }
  function fixtureOdds(f){
    let ph=0,pd=0,pa=0,over=0;
    for(let h=0;h<=6;h++) for(let a=0;a<=6;a++){
      const p=f.m[h][a];
      if(h>a) ph+=p; else if(h===a) pd+=p; else pa+=p;
      if(h+a>=3) over+=p;
    }
    return {h:oddsFor(ph), d:oddsFor(pd), a:oddsFor(pa),
            over:oddsFor(over), under:oddsFor(1-over)};
  }
  function sampleScore(m){
    const cells=[]; let tot=0;
    for(let h=0;h<=6;h++) for(let a=0;a<=6;a++){ cells.push([h,a,m[h][a]]); tot+=m[h][a]; }
    let r=Math.random()*tot;
    for(const [h,a,p] of cells){ r-=p; if(r<=0) return [h,a]; }
    return [1,1];
  }
  function buildGoals(h,a){
    const sides=[];
    for(let i=0;i<h;i++) sides.push("h");
    for(let i=0;i<a;i++) sides.push("a");
    for(let i=sides.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [sides[i],sides[j]]=[sides[j],sides[i]]; }
    const mins=Array.from({length:h+a},()=>8+Math.random()*78).sort((x,y)=>x-y);
    return mins.map((min,i)=>({min, side:sides[i]}));
  }

  /* ---------- 赛程 ---------- */
  function newRound(){
    stopAnim();
    const ids=TEAMS.map((_,i)=>i);
    for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [ids[i],ids[j]]=[ids[j],ids[i]]; }
    const picked=ids.slice(0,8);
    const fixtures=[];
    for(let i=0;i<4;i++){
      const home=TEAMS[picked[i*2]], away=TEAMS[picked[i*2+1]];
      const f={id:i, home, away, m:scoreMatrix(home,away), score:null, bet:null};
      f.odds=fixtureOdds(f);
      fixtures.push(f);
    }
    state={fixtures, sel:null, openFid:-1, amount:50, phase:"list", lastRet:0};
    $("fbBanner").textContent="";
    render();
    resizePitch(); drawPitchBg();
    $("fbScoreboard").textContent="SELECT A MATCH";
  }

  function pickLabel(f,type,pick){
    if(type==="1x2") return pick==="h" ? "主胜 "+f.home.name : pick==="d" ? "平局" : "客胜 "+f.away.name;
    if(type==="ou") return pick==="over" ? "大球 2.5（≥3 球）" : "小球 2.5（≤2 球）";
    return "精确比分 "+pick;
  }
  function selectBet(fid,type,pick,odds){
    const f=state.fixtures[fid];
    const key=fid+":"+type+":"+pick;
    if(state.sel && state.sel.key===key){ state.sel=null; }
    else state.sel={key,fid,type,pick,odds,label:pickLabel(f,type,pick)};
    render();
  }

  function confirmBet(){
    const s=state.sel;
    if(!s){ toast("先选择一个盘口"); return; }
    if(state.amount>GameState.coins){ toast("金币不足"); return; }
    const f=state.fixtures[s.fid];
    if(f.score){ toast("该场已完赛"); return; }
    addCoins(-state.amount);
    f.bet={type:s.type, pick:s.pick, label:s.label, odds:s.odds, amount:state.amount};
    f.score=sampleScore(f.m);
    // 同一轮其他比赛同时完赛
    state.fixtures.forEach(o=>{ if(!o.score) o.score=sampleScore(o.m); });
    state.phase="live";
    render();
    startAnim(f);
  }

  function settleBet(f){
    if(!f.bet) return 0;
    const h=f.score[0], a=f.score[1], b=f.bet;
    let win=false;
    if(b.type==="1x2") win=(b.pick==="h"&&h>a)||(b.pick==="d"&&h===a)||(b.pick==="a"&&h<a);
    else if(b.type==="ou") win=b.pick==="over" ? (h+a>=3) : (h+a<=2);
    else win=(b.pick===h+"-"+a);
    return win ? Math.round(b.amount*b.odds) : 0;
  }

  /* ---------- 列表渲染 ---------- */
  function render(){
    syncCoinDisplays();
    const list=$("fbFixtures");
    $("fbNextRound").style.visibility=(state.phase==="list")?"visible":"hidden";
    if(state.phase==="live"){
      list.classList.add("hidden");
      $("fbRoundTitle").textContent="第 "+roundNo+" 轮 · LIVE";
      renderLiveBar();
      return;
    }
    list.classList.remove("hidden");
    const played=state.fixtures.filter(f=>f.score).length;
    $("fbRoundTitle").textContent="第 "+roundNo+" 轮 · "+played+"/4 场已完赛";
    if(state.phase!=="end"){
      $("fbScoreboard").textContent="SELECT A MATCH";
      $("fbBanner").textContent="";
    }
    list.innerHTML="";
    state.fixtures.forEach(f=>{
      const card=document.createElement("div");
      card.className="fx-card"+(f.score?" played":"");
      const o=f.odds;
      const sel=(type,pick)=>{
        const k=f.id+":"+type+":"+pick;
        return state.sel&&state.sel.key===k ? " sel":"";
      };
      if(f.score){
        const ret=settleBet(f);
        card.innerHTML=`
          <div class="fx-row">
            <div class="fx-team"><span class="fx-dot" style="background:${f.home.color}"></span><span class="fx-lg">${f.home.lg}</span><b>${f.home.name}</b></div>
            <div class="fx-final">${f.score[0]} - ${f.score[1]}</div>
            <div class="fx-team away"><b>${f.away.name}</b><span class="fx-lg">${f.away.lg}</span><span class="fx-dot" style="background:${f.away.color}"></span></div>
          </div>
          <div class="fx-result ${ret>0?"win":"lose"}">${
            f.bet ? (ret>0?("投注 "+f.bet.label+" 命中 +G"+(ret-f.bet.amount)) : ("投注 "+f.bet.label+" 未中 -G"+f.bet.amount))
                  : "未投注"
          }</div>`;
      } else {
        let csOptions='<option value="">正确比分…</option>';
        CS_PICKS.forEach(cs=>{
          const [h,a]=cs.split("-").map(Number);
          csOptions+=`<option value="${cs}">${cs} @${oddsFor(f.m[h][a])}</option>`;
        });
        card.innerHTML=`
          <div class="fx-row">
            <div class="fx-team"><span class="fx-dot" style="background:${f.home.color}"></span><span class="fx-lg">${f.home.lg}</span><b>${f.home.name}</b><small>${f.home.rating.toFixed(2)}</small></div>
            <div class="fx-vs">VS</div>
            <div class="fx-team away"><small>${f.away.rating.toFixed(2)}</small><b>${f.away.name}</b><span class="fx-lg">${f.away.lg}</span><span class="fx-dot" style="background:${f.away.color}"></span></div>
          </div>
          <div class="fx-odds-row">
            <button class="fx-odd${sel("1x2","h")}" data-k="${f.id}:1x2:h">主胜<b>@${o.h}</b></button>
            <button class="fx-odd${sel("1x2","d")}" data-k="${f.id}:1x2:d">平<b>@${o.d}</b></button>
            <button class="fx-odd${sel("1x2","a")}" data-k="${f.id}:1x2:a">客胜<b>@${o.a}</b></button>
            <button class="fx-more" data-more="${f.id}">${state.openFid===f.id?"收起 ▲":"盘口 ▾"}</button>
          </div>
          <div class="fx-extra ${state.openFid===f.id?"open":""}">
            <button class="fx-odd sm${sel("ou","over")}" data-k="${f.id}:ou:over">大 2.5<b>@${o.over}</b></button>
            <button class="fx-odd sm${sel("ou","under")}" data-k="${f.id}:ou:under">小 2.5<b>@${o.under}</b></button>
            <select class="fx-cs" data-cs="${f.id}">${csOptions}</select>
          </div>`;
      }
      list.appendChild(card);
    });

    list.querySelectorAll(".fx-odd").forEach(btn=>{
      btn.onclick=()=>{
        const [fid,type,pick]=btn.dataset.k.split(":");
        const f=state.fixtures[+fid];
        let odds;
        if(type==="1x2") odds=f.odds[{h:"h",d:"d",a:"a"}[pick]];
        else odds=f.odds[pick];
        selectBet(+fid,type,pick,odds);
      };
    });
    list.querySelectorAll(".fx-more").forEach(btn=>{
      btn.onclick=()=>{ state.openFid = state.openFid===+btn.dataset.more ? -1 : +btn.dataset.more; render(); };
    });
    list.querySelectorAll(".fx-cs").forEach(sel2=>{
      sel2.onchange=()=>{
        if(!sel2.value) return;
        const fid=+sel2.dataset.cs, f=state.fixtures[fid];
        const [h,a]=sel2.value.split("-").map(Number);
        selectBet(fid,"cs",sel2.value,oddsFor(f.m[h][a]));
      };
    });
    renderBetbar();
  }

  function renderBetbar(){
    const bar=$("fbBetbar");
    if(state.phase==="end"){
      const f=state.fixtures.find(x=>x.bet && x._justPlayed);
      bar.innerHTML="";
      return;
    }
    if(!state.sel){
      bar.innerHTML=`<div class="fb-hint">点赔率选择盘口（胜平负 / 大小球 / 精确比分），再选金额确认</div>`;
      return;
    }
    const s=state.sel;
    bar.innerHTML=`
      <div class="fb-pick">${s.label} <b style="color:var(--yellow)">@${s.odds}</b></div>
      <div class="fb-betrow">
        <div class="fchips">
          ${FB_CHIPS.map(c=>`<button class="fchip ${state.amount===c?"sel":""}" data-amt="${c}">${c}</button>`).join("")}
        </div>
        <button class="fb-confirm" id="fbConfirm">下注 G${state.amount}</button>
      </div>`;
    bar.querySelectorAll(".fchip").forEach(b=>{
      b.onclick=()=>{ state.amount=Math.min(GameState.coins,+b.dataset.amt); render(); };
    });
    $("fbConfirm").onclick=confirmBet;
  }

  function renderLiveBar(){
    const f=anim?anim.f:state.fixtures.find(x=>x._justPlayed);
    if(!f){ $("fbBetbar").innerHTML=""; return; }
    const b=f.bet;
    $("fbBetbar").innerHTML=`<div class="fb-hint">直播中：${f.home.name} vs ${f.away.name} · 你的投注「${b.label} @${b.odds}」G${b.amount}</div>`;
  }

  function renderEnd(f,ret){
    $("fbFixtures").classList.add("hidden");
    $("fbRoundTitle").textContent="第 "+roundNo+" 轮 · 完赛";
    const b=f.bet;
    const win=ret>0;
    $("fbBanner").innerHTML=`<span class="${win?"win":"lose"}">FULL TIME ${f.score[0]}-${f.score[1]} · ${win?("命中 +G"+(ret-b.amount)):"未中 -G"+b.amount}</span>`;
    const allPlayed=state.fixtures.every(x=>x.score);
    $("fbBetbar").innerHTML=`
      <div class="fb-endrow">
        <button class="fb-confirm gray" id="fbBackList">返回赛程</button>
        <button class="fb-confirm" id="fbNext">${allPlayed?("下一轮（第 "+(roundNo+1)+" 轮）"):"跳过未完赛 · 下一轮"}</button>
      </div>`;
    $("fbBackList").onclick=()=>{ state.phase="list"; state.sel=null; f._justPlayed=false; render(); };
    $("fbNext").onclick=()=>{ roundNo++; newRound(); };
  }

  /* ---------- Canvas 比赛动画 ---------- */
  const canvas=$("fbPitch"), cx=canvas.getContext("2d");
  cx.imageSmoothingEnabled=false;
  function resizePitch(){
    canvas.width=canvas.parentElement.clientWidth;
    canvas.height=230;
    canvas.style.width="100%"; canvas.style.height="230px";
  }
  function px(x,y,w,h,c){ cx.fillStyle=c; cx.fillRect(Math.round(x),Math.round(y),w,h); }

  /* 11 人制 4-4-2：GK + 后卫线 4 + 中场线 4 + 前锋 2 */
  const FORM=[
    {x:0.06,y:0.50,gk:true},
    {x:0.20,y:0.13},{x:0.20,y:0.38},{x:0.20,y:0.62},{x:0.20,y:0.87},
    {x:0.38,y:0.16},{x:0.38,y:0.39},{x:0.38,y:0.61},{x:0.38,y:0.84},
    {x:0.56,y:0.34},{x:0.56,y:0.66},
  ];
  function makePlayers(side){
    return FORM.map(p=>{
      const bx=side==="h"?p.x:1-p.x;
      return {bx, by:p.y, x:bx, y:p.y, gk:!!p.gk};
    });
  }

  function startAnim(f){
    resizePitch();
    anim={
      f,
      start:performance.now(),
      baseDur:15000,
      goals:buildGoals(f.score[0],f.score[1]),
      gi:0, celebrated:0,
      score:[0,0],
      hp:makePlayers("h"), ap:makePlayers("a"),
      ball:{x:0.5,y:0.5},
      holder:"h", holderSwap:0, target:{x:0.5,y:0.5},
      mode:"normal", attacker:null, celebrateEnd:0, flash:0,
      lastBoard:"", ended:false, lastT:performance.now(),
    };
    pickTarget();
    stopRaf();
    draw(performance.now(),0); // 立即绘制开场站位首帧
    raf=setTimeout(loop, FRAME_MS);
  }
  function stopAnim(){ stopRaf(); anim=null; }

  function drawPitchBg(){
    const W=canvas.width, H=canvas.height;
    for(let i=0;i<10;i++) px(i*W/10,0,W/10+1,H,i%2?"#1f7a34":"#248a3c");
    cx.strokeStyle="rgba(255,255,255,.55)"; cx.lineWidth=2;
    cx.beginPath(); cx.moveTo(W/2+0.5,6); cx.lineTo(W/2+0.5,H-6); cx.stroke();
    cx.beginPath(); cx.ellipse(W/2,H/2,26,20,0,0,Math.PI*2); cx.stroke();
    cx.strokeRect(4,H/2-44,40,88); cx.strokeRect(W-44,H/2-44,40,88);
    cx.strokeRect(4,H/2-22,16,44); cx.strokeRect(W-20,H/2-22,16,44);
    px(0,H/2-24,4,48,"#f4f4f4"); px(W-4,H/2-24,4,48,"#f4f4f4");
  }

  function pickTarget(){
    if(!anim) return;
    if(anim.mode!=="normal") return;
    const dir=anim.holder==="h"?1:-1;
    anim.target={ x: anim.holder==="h"?rand(0.34,0.66):rand(0.34,0.66), y:rand(0.2,0.8) };
  }

  function loop(now){
    // 视图隐藏（回地图）即断链，由 enter() 按冻结时钟重启
    if($("view-football").classList.contains("hidden")) return;
    if(!anim || anim.ended) return;
    // 页面在后台（切标签页）时维持慢帧并冻结比赛时钟，回前台无缝继续
    const vis=document.visibilityState==="visible";
    raf=setTimeout(loop, vis?FRAME_MS:1000);
    now=performance.now();
    const rawDt=now-anim.lastT; anim.lastT=now;
    if(!vis){ anim.start+=rawDt; anim.holderSwap+=rawDt; anim.celebrateEnd+=rawDt; return; }
    const dt=Math.min(100, rawDt);
    const f=anim.f;
    const activeMs=now-anim.start-anim.celebrated*GOAL_PAUSE;
    anim._lastActive=activeMs;
    const minute=Math.min(90, activeMs/anim.baseDur*90);

    /* 状态机 */
    if(anim.mode==="normal"){
      if(now>anim.holderSwap){
        anim.holderSwap=now+rand(480,1050);
        const hR=f.home.rating, aR=f.away.rating;
        const lose=anim.holder==="h"?Math.min(0.6,0.42*aR/hR):Math.min(0.6,0.42*hR/aR);
        if(Math.random()<lose) anim.holder=anim.holder==="h"?"a":"h";
        pickTarget();
      }
      if(anim.gi<anim.goals.length && minute>=anim.goals[anim.gi].min){
        anim.mode="attack";
        anim.attacker=anim.goals[anim.gi].side;
        anim.holder=anim.attacker;
        const dir=anim.attacker==="h"?1:-1;
        anim.target={x:dir===1?0.975:0.025, y:0.5+rand(-0.1,0.1)};
      }
    } else if(anim.mode==="attack"){
      const goalX=anim.attacker==="h"?0.975:0.025;
      anim.ball.x += (anim.target.x-anim.ball.x)*0.13;
      anim.ball.y += (anim.target.y-anim.ball.y)*0.13;
      if(Math.abs(anim.ball.x-goalX)<0.02){
        anim.score[anim.attacker==="h"?0:1]++;
        anim.flash=now; anim.mode="celebrate";
        anim.celebrateEnd=now+GOAL_PAUSE; anim.gi++; anim.celebrated++;
        $("fbBanner").innerHTML='<span class="goal">GOAL! '+anim.score[0]+' - '+anim.score[1]+'</span>';
        setTimeout(()=>{ if(anim && anim.mode!=="celebrate") $("fbBanner").innerHTML=""; },1400);
      }
    } else if(anim.mode==="celebrate"){
      if(now>anim.celebrateEnd){
        anim.mode="normal";
        anim.holder=anim.attacker==="h"?"a":"h";
        anim.ball.x=0.5; anim.ball.y=0.5;
        anim.holderSwap=now+500;
        pickTarget();
      }
    }

    /* 球移动（normal 追目标） */
    if(anim.mode==="normal"){
      anim.ball.x+=(anim.target.x-anim.ball.x)*0.07;
      anim.ball.y+=(anim.target.y-anim.ball.y)*0.07;
    }
    /* 球员追球 */
    const moveTeam=(players,side)=>{
      const holderSide=anim.holder;
      players.forEach((p,i)=>{
        let tx,ty;
        if(anim.mode==="attack"){
          tx=anim.ball.x; ty=anim.ball.y+(i-5)*0.045;
          if(side!==anim.attacker){ tx=p.bx*0.5+0.25; ty=p.by; }
        } else {
          const pull=side===holderSide?0.22:0.1;
          tx=p.bx+(anim.ball.x-p.bx)*pull;
          ty=p.by+(anim.ball.y-p.by)*(side===holderSide?0.15:0.2);
        }
        if(anim.mode==="celebrate"){ tx=anim.ball.x+(i-5)*0.022; ty=anim.ball.y+(i%2?0.04:-0.04); }
        p.x+=(tx-p.x)*0.08 + Math.sin(now/280+i*1.7+ (side==="h"?0:1))*0.0015;
        p.y+=(ty-p.y)*0.08 + Math.cos(now/330+i*1.3)*0.0015;
      });
    };
    moveTeam(anim.hp,"h"); moveTeam(anim.ap,"a");

    draw(now,minute);

    /* 完赛 */
    if(minute>=90 && anim.gi>=anim.goals.length && anim.mode==="normal" && !anim.ended){
      if(activeMs>anim.baseDur+anim.goals.length*GOAL_PAUSE+200){
        anim.ended=true;
        setTimeout(finishMatch, 500);
      }
    }
  }

  function finishMatch(){
    const f=anim.f;
    const ret=settleBet(f);
    state.lastRet=ret;
    state.phase="end";
    f._justPlayed=true;
    if(ret>0) addCoins(ret);
    if(GameState.coins===0){ addCoins(200); toast("救助金 +G200"); }
    gsSave();
    renderEnd(f,ret);
  }

  function draw(now,minute){
    const W=canvas.width, H=canvas.height;
    const f=anim.f;
    drawPitchBg();
    const X=x=>6+x*(W-12), Y=y=>8+y*(H-16);
    const drawTeam=(players,team,away)=>{
      players.forEach(p=>{
        const x=X(p.x), y=Y(p.y);
        const kit=p.gk?"#ffd800":team.color;
        // 主队黑描边、客队白描边，保证同色对阵也能分清
        px(x-4,y-3,8,7,away?"#f4f4f4":"#000");
        px(x-3,y-2,6,5,kit);
        px(x-2,y-6,4,3,"#e8b088");
        px(x-3,y-2,6,1,"rgba(0,0,0,.25)");
      });
    };
    drawTeam(anim.ap,f.away,true);
    drawTeam(anim.hp,f.home,false);
    /* 球 */
    const bx=X(anim.ball.x), by=Y(anim.ball.y);
    px(bx-2,by-2,4,4,"#fff"); px(bx-1,by-1,2,2,"#111");

    /* GOAL 闪光 */
    if(now-anim.flash<500){
      cx.fillStyle="rgba(255,255,255,"+(0.5*(1-(now-anim.flash)/500))+")";
      cx.fillRect(0,0,W,H);
    }
    /* 比分牌 */
    const board=`${f.home.short} ${anim.score[0]} - ${anim.score[1]} ${f.away.short} · ${Math.floor(minute)}'`;
    if(board!==anim.lastBoard){ anim.lastBoard=board; $("fbScoreboard").textContent=board; }
  }

  /* ---------- 事件 ---------- */
  $("fbNextRound").onclick=()=>{ roundNo++; newRound(); };

  return {
    enter(){
      if(!state){ newRound(); return; }
      // 直播中途离开再回来：按冻结时的比赛时钟无缝恢复（比分已采样，不能重开）
      if(state.phase==="live" && anim && !anim.ended){
        resizePitch();
        const fa=anim._lastActive||0;
        anim.start=performance.now()-fa-anim.celebrated*GOAL_PAUSE;
        anim.lastT=performance.now();
        anim.holderSwap=performance.now()+400;
        if(anim.mode==="celebrate"){
          anim.mode="normal";
          anim.holder=anim.attacker==="h"?"a":"h";
          anim.ball.x=0.5; anim.ball.y=0.5;
        }
        stopRaf();
        raf=setTimeout(loop, FRAME_MS);
        render();
        return;
      }
      state.phase="list"; state.sel=null;
      render();
    }
  };
})();
