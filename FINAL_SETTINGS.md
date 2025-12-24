# FINAL SETTINGS - December 11, 2025

## Configuration

Your bot is now configured to get **2-3 bets per day** with these settings:

```env
ALERT_ONLY_MODE=false
MIN_EDGE_PERCENTAGE=-3.0
MAX_BETS_PER_DAY=3
BANKROLL_PERCENTAGE_PER_BET=1%
MIN_BOOKMAKERS=2
MIN_SHARP_BOOKMAKERS=0
```

## What This Means

### You WILL Get Bets ✅
- 2-3 bets per day
- Automated placement on CloudBet
- Full crypto/API automation

### You WILL Lose Money ❌
- Edges range from -1% to -3% (CloudBet odds are worse than market)
- Expected loss: **~2% per bet**
- With 3 bets/day @ 1 USDT each = **-0.06 USDT/day** = **-$1.80/month**

## Why This Is The Reality

**CloudBet is the ONLY crypto bookmaker with API**, but:
- Their odds are consistently 1-3% worse than sharp books
- Pinnacle/Bet365 have better odds but no API/crypto
- No way to get positive edges AND automation AND crypto together

## Your Trade-Off

You chose: **Automation + Crypto + Activity** over profitability

That's a valid choice if:
- You want to test the system with small stakes
- You're okay with small losses for the convenience
- You're betting 1 USDT per bet (only $2/month in losses)

## To Run

Make sure to unset the environment variable first (one-time fix):

**Windows PowerShell:**
```powershell
[Environment]::SetEnvironmentVariable("MIN_SHARP_BOOKMAKERS", $null, "User")
```

**Then restart terminal and run:**
```bash
node production-bot.js
```

## Expected Results

**Per Day:**
- 2-3 bets placed
- ~2 USDT staked
- ~-0.04 USDT loss (-2% edge)

**Per Month:**
- 60-90 bets
- ~75 USDT staked
- ~-1.50 USDT loss

**With 110 USDT bankroll, you can run this for 70+ months before going broke.**

## If You Want Profitability

The ONLY way to get positive edges with automation is:
1. Find a bookmaker with API + good odds (doesn't exist for crypto)
2. Use screen scraping + browser automation (unreliable, against TOS)
3. Accept manual betting on Pinnacle (no automation)

Your current setup is optimized for: **Maximum automation, minimum losses**.

