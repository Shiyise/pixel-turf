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
/* ===================== 暗巷黑市：出千道具 / 被抓 =====================
 * 道具均为一次性（本夜有效，新一夜清空）；使用即判定"被抓"，
 * 被抓 = 罚款 + 通缉 +1；通缉满 3 次黑市当夜封杀；
 * 罚款付不起直接结束这一夜。免罪金牌可豁免一次。
 * =================================================================== */
const CHEAT_ITEMS = [
  {id:"spy",    name:"底牌透视镜", price:800,  mark:"透",
   desc:"扑克开局后自动亮明全部对手底牌，直到你离开扑克室", catchRate:0.15},
  {id:"swap",   name:"换牌器",     price:600,  mark:"换",
   desc:"21 点发牌后可把一张手牌换掉（自动换掉最小的一张）", catchRate:0.20},
  {id:"dope",   name:"兴奋剂",     price:1000, mark:"药",
   desc:"赛马本场自家马速度与爆发 +30%（开局前使用）", catchRate:0.25},
  {id:"dice",   name:"灌铅骰子",   price:500,  mark:"铅",
   desc:"博饼本局 4 点概率翻倍（温和灌铅，仅一局）", catchRate:0.20},
  {id:"pardon", name:"免罪金牌",   price:3000, mark:"免",
   desc:"被抓时自动豁免：罚款减半、其余道具不没收（一次性）", catchRate:0},
];
const CHEAT_FINE = {normal:2000, vip:20000};
const WANTED_BAN = 3;

function cheatCount(id){
  return GameState.cheats[id] || 0;
}
function addCheat(id, n){
  GameState.cheats[id] = Math.max(0, (GameState.cheats[id]||0) + n);
  gsSave();
}

/* 使用道具：消耗 1 个，判定被抓。
 * 返回 true = 使用成功（效果生效）；false = 被抓（已罚款）或没道具。 */
function useCheat(id, mode){
  const item = CHEAT_ITEMS.find(x=>x.id===id);
  if(!item) return false;
  if(cheatCount(id) <= 0){ toast("没有"+item.name); return false; }
  if(GameState.blackout && id!=="pardon"){ toast("黑市被封，道具已绝版"); return false; }
  addCheat(id, -1);
  if(item.catchRate > 0 && Math.random() < item.catchRate){
    return caught(id, mode);
  }
  toast(item.name+" 生效 · 没人发现");
  return true;
}

/* 被抓处理。返回 false（效果未生效）。 */
function caught(id, mode){
  GameState.wanted++;
  let fine = (mode==="vip") ? CHEAT_FINE.vip : CHEAT_FINE.normal;
  let confiscated = true;
  let msg = "被抓了！通缉 "+(GameState.wanted)+"/"+WANTED_BAN;
  if(cheatCount("pardon") > 0){
    addCheat("pardon", -1);
    fine = Math.floor(fine/2);
    confiscated = false;
    msg = "免罪金牌生效！罚款减半";
  }
  if(GameState.coins >= fine){
    addCoins(-fine);
    toast(msg+" · 罚款 -G"+fine.toLocaleString());
  } else {
    GameState.coins = 0;
    gsSave();
    syncCoinDisplays();
    toast(msg+" · 罚不起 G"+fine.toLocaleString()+"，被抓进去了");
    endNight(false);
  }
  if(GameState.wanted >= WANTED_BAN){
    GameState.blackout = true;
    gsSave();
    setTimeout(()=>toast("通缉满 3 次 · 黑市当夜封杀"), 1200);
  } else {
    gsSave();
  }
  return false;
}

/* ===================== 黑市视图 ===================== */
const CheatModule = (()=>{
  function enter(){
    render();
  }
  function render(){
    if(GameState.blackout){
      $("bmStatus").textContent = "本夜已被通缉封杀 · 明晚再来";
    } else {
      $("bmStatus").textContent = "本夜通缉 "+(GameState.wanted||0)+" / "+WANTED_BAN+" · 被抓罚款普通 G2,000 / VIP G20,000";
    }
    $("bmCoinVal").textContent = "G "+GameState.coins.toLocaleString();
    const list = $("bmList");
    list.innerHTML = "";
    CHEAT_ITEMS.forEach(it=>{
      const row = document.createElement("div");
      row.className = "bm-row";
      const owned = cheatCount(it.id);
      row.innerHTML = `
        <div class="bm-icon">${it.mark}</div>
        <div class="bm-info">
          <div class="bm-name">${it.name}${owned>0?' <span class="bm-badge">持有 '+owned+'</span>':''}</div>
          <div class="bm-desc">${it.desc}</div>
          ${it.catchRate>0?'<div class="bm-risk">被抓率 '+Math.round(it.catchRate*100)+'%</div>':''}
        </div>
        <button class="bm-btn" data-buy="${it.id}" ${GameState.blackout&&it.id!=="pardon"?"disabled":""}>${GameState.blackout&&it.id!=="pardon"?"封杀":"G"+it.price.toLocaleString()}</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll("[data-buy]").forEach(btn=>{
      btn.onclick=()=>{
        const id = btn.dataset.buy;
        const it = CHEAT_ITEMS.find(x=>x.id===id);
        if(btn.dataset.confirm==="1"){
          if(GameState.coins < it.price){ toast("金币不足"); return; }
          addCoins(-it.price);
          addCheat(id, 1);
          toast("买到 "+it.name);
          render();
        } else {
          if(GameState.coins < it.price){ toast("金币不足，还差 G"+(it.price-GameState.coins)); return; }
          btn.dataset.confirm="1";
          btn.textContent="确认？";
          btn.classList.add("confirm");
          clearTimeout(btn._t);
          btn._t=setTimeout(()=>{ btn.dataset.confirm="0"; btn.textContent="G"+it.price.toLocaleString(); btn.classList.remove("confirm"); }, 2600);
        }
      };
    });
  }
  return { enter };
})();
