# 🚨 ALERT-ONLY MODE - Smart Bet Finder

## What This Does

The bot now runs in **ALERT-ONLY MODE** which means:

✅ **Finds betting opportunities** with real positive edges
✅ **Sends Telegram alerts** when good bets are found
✅ **Does NOT place bets automatically**
❌ **You place bets manually** on whichever bookmaker you choose

## Why This Is Better

| Automatic Mode (Old) | Alert Mode (New) |
|---------------------|------------------|
| Bets on CloudBet only | Bet on ANY bookmaker |
| CloudBet odds often worse | Choose BEST odds available |
| Automated losses | Manual control |
| No flexibility | Full flexibility |

## How It Works

1. **Bot scans** all sports for opportunities
2. **Compares odds** to sharp bookmakers (Pinnacle, Bookmaker)
3. **When edge found** → Sends you Telegram alert
4. **You decide** whether to bet and which bookmaker to use

## Telegram Alert Format

When an opportunity is found, you'll receive:

```
🚨 BETTING OPPORTUNITY ALERT

BASKETBALL: Lakers vs Warriors

📊 BET: away @ 2.35
💰 Recommended Stake: 4.50 USDT
📈 Edge: 5.2%
⚡ Efficiency: 18.5
📚 Sharp Books: 2

⏰ Starts: 12/10/2025, 7:00:00 PM

🎯 Place this bet manually on your preferred bookmaker!
```

## How to Use

### Step 1: Start the Bot
```bash
node production-bot.js
```

The bot will scan every 5 minutes and send alerts when opportunities are found.

### Step 2: Receive Alerts
- Alerts come to your Telegram
- Review the opportunity details
- Check your bookmaker's odds

### Step 3: Place Bet Manually
**Recommended bookmakers (in order of preference):**
1. **Pinnacle** - Best odds, lowest margins
2. **Bet365** - Good odds, reliable
3. **Betfair Exchange** - Bet against other players
4. CloudBet - If it has the best odds

### Step 4: Track Results
- Keep your own record
- Compare performance across bookmakers
- Adjust stake sizes based on results

## Settings Explained

Current `.env` settings for ALERT MODE:

```env
ALERT_ONLY_MODE=true           # Enable alert-only mode
MIN_EDGE_PERCENTAGE=2.5        # Find 2.5%+ edges
MIN_BOOKMAKERS=3               # Need 3 bookmakers
MIN_SHARP_BOOKMAKERS=1         # Need 1 sharp bookmaker (Pinnacle)
MIN_EFFICIENCY_SCORE=10        # Quality threshold
MAX_BETS_PER_DAY=20            # Max alerts per day
```

## Advantages

### 1. **Better Odds**
- You're not limited to CloudBet
- Shop around for best prices
- Use Pinnacle when they have best odds

### 2. **Risk Control**
- You decide stake size
- You decide which bets to take
- No automated losses

### 3. **Learn the Markets**
- See what edges look like
- Understand market movements
- Build your betting intuition

### 4. **Test Before Automating**
- Track manual results first
- If profitable → consider automation on better bookmaker
- If not profitable → avoid losses

## Expected Results

**Alerts per day:** 5-15 opportunities (depending on market conditions)

**Quality:** Only opportunities with:
- At least 1 sharp bookmaker confirming the edge
- 2.5%+ calculated edge
- Reasonable odds (1.5 - 4.0)

## Tips for Success

1. **Act quickly** - Odds change fast, place bets within minutes
2. **Keep records** - Track which alerts were profitable
3. **Compare bookmakers** - Some may have better odds than alert shows
4. **Adjust stakes** - Use smaller stakes until you validate profitability
5. **Focus on sharp books** - Pinnacle/Bet365 usually have best odds

## Switching Back to Automatic Mode

If you get access to a better bookmaker API (Pinnacle, Bet365), you can switch back:

```env
ALERT_ONLY_MODE=false  # Disable alert mode
```

But for now, **ALERT MODE is your best option** given CloudBet's odds quality.

## Troubleshooting

**No alerts?**
- Check settings aren't too strict
- Lower MIN_EDGE to 2.0 for more opportunities
- Check bot is running

**Too many alerts?**
- Raise MIN_EDGE to 3.0-4.0
- Raise MIN_SHARP_BOOKMAKERS to 2
- Focus on fewer sports

## Next Steps

1. Start the bot: `node production-bot.js`
2. Wait for Telegram alerts
3. Place bets manually on your preferred bookmaker
4. Track results
5. Adjust settings based on performance

**This way you get the EDGE DETECTION without the AUTOMATIC LOSSES!** 🎯
