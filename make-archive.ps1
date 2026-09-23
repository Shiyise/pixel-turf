# PIXEL TURF · 注释归档脚本
# 用法：
#   .\make-archive.ps1                          # 自动取当天日期 + 当前 HEAD commit，版本号 v12
#   .\make-archive.ps1 -Version v13             # 指定版本号
#   .\make-archive.ps1 -Version v13 -Commit abcd123 -Note "新功能说明"
# 产物：
#   archive\<version>-<date>\  （每个文件头部带 ARCHIVED SNAPSHOT 注释块）
#   D:\dm\archive\<version>-<date>\            （同步副本）
#   D:\dm\logic-diagram.html                   （同步最新逻辑图）
#   D:\dm\README.md                            （同步最新说明）
param(
  [string]$Version = "v12",
  [string]$Date = (Get-Date -Format "yyyy-MM-dd"),
  [string]$Commit = "",
  [string]$Note = ""
)

$src = "C:\Users\wyyxh\Doubao\chats\2026-09-19\new-chat-1\horse-racing"
if(-not $Commit){
  Push-Location $src
  $Commit = (git rev-parse --short HEAD).Trim()
  Pop-Location
}
$tag = "$Version ($Date, commit $Commit)"
$dst = Join-Path $src "archive\$Version-$Date"
$dm  = "D:\dm"
$dmDst = Join-Path $dm "archive\$Version-$Date"
New-Item -ItemType Directory -Force $dst | Out-Null
New-Item -ItemType Directory -Force $dmDst | Out-Null

$common = @(
  "PIXEL TURF ARCHIVED SNAPSHOT - $tag",
  "scope: race(bet/stable/train/breed/fatigue/cup/dex/sell/rumors/dope)",
  "       poker(cash/SNG/side-pot/spy-glass), blackjack(ALL-IN/3:2/swapper)",
  "       football(20 teams/11v11/3 markets/pixel live/S-A-B-C tiers/bribes)",
  "       blackmarket(5 cheat items/wanted/blackout), bobing(6 dice/loaded dice)",
  "       random events(pre/post 18pct, rich-lady/gang/loan-shark etc.)",
  "       property(5 businesses/dividend), VIP lounge, night-run(G100k goal)",
  "READ-ONLY snapshot - do not develop here."
)
if($Note){ $common += ("note: " + $Note) }

$files = @("index.html","shared.js","race.js","poker.js","blackjack.js","football.js",
           "cheat.js","events.js","bobing.js","README.md")
$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach($f in $files){
  $content = [IO.File]::ReadAllText((Join-Path $src $f))
  if($f -eq "index.html"){
    $lines = $common | ForEach-Object { "     $_" }
    $head = "<!--`n" + ($lines -join "`n") + "`n-->`n"
    $content = $content -replace '<html lang="zh-CN">', ($head + '<html lang="zh-CN">')
  } elseif($f -eq "README.md") {
    $lines = $common | ForEach-Object { "> $_" }
    $head = "# ARCHIVED SNAPSHOT (read-only) | $tag`n`n" + ($lines -join "`n") + "`n`n---`n`n"
    $content = $head + $content
  } else {
    $lines = $common | ForEach-Object { " * $_" }
    $head = "/* ============================================================`n * ARCHIVED SNAPSHOT | $tag`n" + ($lines -join "`n") + "`n * ============================================================ */`n"
    $content = $head + $content
  }
  [IO.File]::WriteAllText((Join-Path $dst $f), $content, $utf8)
  [IO.File]::WriteAllText((Join-Path $dmDst $f), $content, $utf8)
  Write-Output ("archived " + $f)
}

# 同步逻辑图与 README 到 D:\dm 根目录
Copy-Item (Join-Path $src "docs\logic-diagram.html") (Join-Path $dm "logic-diagram.html") -Force
Copy-Item (Join-Path $src "README.md") (Join-Path $dm "README.md") -Force
Write-Output ""
Write-Output ("DONE | snapshot: archive\$Version-$Date")
Write-Output ("DONE | synced to: $dmDst")
Write-Output "DONE | D:\dm\logic-diagram.html, D:\dm\README.md updated"
