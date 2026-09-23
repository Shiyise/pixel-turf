$src = "C:\Users\wyyxh\Doubao\chats\2026-09-19\new-chat-1\horse-racing"
$dst = Join-Path $src "archive\v10-2026-09-23"
New-Item -ItemType Directory -Force $dst | Out-Null

$common = @(
  "PIXEL TURF v1.0 (resource tag v=10)",
  "archived: 2026-09-23",
  "commit: d4c1686 Add property business and VIP high-roller lounge",
  "scope: race(bet/stable/train/breed/fatigue/cup/dex/sell)",
  "       poker(cash/SNG/side-pot), blackjack(ALL-IN/3:2)",
  "       football(20 teams/11v11/3 markets/pixel live)",
  "       property(5 businesses/per-settle dividend), VIP lounge(VIP BJ/VIP poker/high SNG)",
  "READ-ONLY snapshot before next changes - do not develop here."
)

$files = @("index.html","shared.js","race.js","poker.js","blackjack.js","football.js","README.md")
$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach($f in $files){
  $content = [IO.File]::ReadAllText((Join-Path $src $f))
  if($f -eq "index.html"){
    $lines = $common | ForEach-Object { "     $_" }
    $head = "<!--`n" + ($lines -join "`n") + "`n-->`n"
    $content = $content -replace '<html lang="zh-CN">', ($head + '<html lang="zh-CN">')
  } elseif($f -eq "README.md") {
    $lines = $common | ForEach-Object { "> $_" }
    $head = "# ARCHIVED SNAPSHOT (read-only)`n`n" + ($lines -join "`n") + "`n`n---`n`n"
    $content = $head + $content
  } else {
    $lines = $common | ForEach-Object { " * $_" }
    $head = "/* ============================================================`n * ARCHIVED SNAPSHOT`n" + ($lines -join "`n") + "`n * ============================================================ */`n"
    $content = $head + $content
  }
  [IO.File]::WriteAllText((Join-Path $dst $f), $content, $utf8)
  Write-Output ("archived " + $f + " " + (Get-Item (Join-Path $dst $f)).Length + "B")
}
