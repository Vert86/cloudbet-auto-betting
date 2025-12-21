# BallDontLie API Setup - Required for NBA Predictions

## The Problem

Your bot is finding NBA games on CloudBet (Bulls vs Hawks, Heat vs Knicks, etc.) but getting **401 authentication errors** when trying to fetch team data.

```
Error predicting NBA game: Request failed with status code 401
```

As of 2025, BallDontLie API requires an API key for all requests.

---

## Solution: Get a Free BallDontLie API Key

### Step 1: Sign Up for Free Account

1. Visit https://www.balldontlie.io/
2. Click "Sign Up" or "Get API Key"
3. Create a free account (email + password)

### Step 2: Get Your API Key

1. After signing in, go to your Dashboard
2. Copy your API key (looks like: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### Step 3: Add API Key to .env

Open your `.env` file and update this line:

```env
# Currently empty
BALLDONTLIE_API_KEY=

# Change to (paste your actual key):
BALLDONTLIE_API_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Step 4: Restart the Bot

```powershell
# Stop the current bot (Ctrl+C if running)
# Start it again
node production-bot.js
```

---

## What the Free Tier Includes

According to [BallDontLie documentation](https://www.balldontlie.io/), the **free tier** includes:

✅ **Teams** - Get all NBA team data
✅ **Players** - Get player information
✅ **Games** - Get game results and scores (this is what we use to calculate standings)

This is **exactly what we need** to calculate team win/loss records and make predictions!

---

## How the Bot Uses BallDontLie

Once you add the API key, here's what happens:

1. **Bot finds NBA game:** "CHI Bulls vs ATL Hawks"
2. **Fetches team list:** Gets all 30 NBA teams with IDs
3. **Matches team names:** "CHI Bulls" → Chicago Bulls (ID: 4)
4. **Fetches games for each team:** Last 100 games to calculate W-L record
5. **Calculates standings:**
   - Bulls: 15 wins, 18 losses (45.5% win rate, estimated rank #18)
   - Hawks: 16 wins, 16 losses (50% win rate, estimated rank #15)
6. **Makes prediction:** Hawks 63% to win (home advantage + better record)
7. **If confidence > 60%:** Places bet on Hawks

---

## Cost Breakdown

**Free Tier:**
- ✅ Teams, players, games endpoints
- ✅ Enough for calculating standings
- ✅ **Cost: $0/month**

**ALL-STAR Tier ($9.99/month):**
- ✅ All free tier features
- ✅ Stats, injuries, standings endpoints (direct)
- Not needed since we calculate standings from games

**GOAT Tier ($39.99/month):**
- ✅ Everything
- ✅ Advanced stats, box scores, betting odds
- Not needed for basic predictions

**Recommendation:** Start with the **free tier**. It has everything we need!

---

## Expected Results After Setup

Once you add the API key and restart:

```
2025-12-21 14:00:00 [info]: Running fundamental analysis
  home: "ATL Hawks"
  away: "CHI Bulls"
  sport: "basketball"

2025-12-21 14:00:01 [info]: ✅ Fundamental analysis supports this bet
  predicted: "Atlanta Hawks"
  confidence: "63.2%"
  reasoning: "Hawks has better season record. Home court advantage."

✅ BET APPROVED
  Event: Hawks vs Bulls
  Prediction: 63% confidence
  Edge: +2.1%
  Stake: 1.05 USDT
```

---

## Troubleshooting

### Still getting 401 errors after adding key?

**Check:**
1. API key is copied correctly (no extra spaces)
2. `.env` file saved after editing
3. Bot restarted after adding key

**Test the API key:**
```powershell
# Run this to test your key
node -e "
const axios = require('axios');
const key = process.env.BALLDONTLIE_API_KEY;
axios.get('https://api.balldontlie.io/v1/teams', {
  headers: { 'Authorization': key }
}).then(r => console.log('✅ API key works! Found', r.data.data.length, 'teams'))
  .catch(e => console.log('❌ Error:', e.response?.status, e.message));
"
```

### API key not in environment?

Make sure you're running from the correct directory:

```powershell
# Check current directory
pwd
# Should show: D:\CloudBet Automation betting

# Check .env file exists
cat .env | findstr BALLDONTLIE
# Should show: BALLDONTLIE_API_KEY=your_key_here
```

---

## Alternative: Use API-Sports for NBA Instead

If you don't want to sign up for another service, I can update the code to use **API-Sports** (which you already have) for NBA data instead of BallDontLie.

**Pros:**
- You already have the API key
- No new signup needed

**Cons:**
- API-Sports NBA endpoints might be premium tier
- Would need to check if your current key has NBA access

Let me know if you prefer this option!

---

## Summary

**What you need to do:**

1. Go to https://www.balldontlie.io/
2. Sign up (free)
3. Copy your API key
4. Add to `.env`: `BALLDONTLIE_API_KEY=your_key_here`
5. Restart bot: `node production-bot.js`

**Expected time:** 5 minutes

**Expected result:** NBA predictions working, 3-5 NBA bets per day with 60%+ confidence!

---

## Current Status

✅ Code updated to use BallDontLie API key
✅ Team name matching fixed (handles "CHI Bulls" → "Chicago Bulls")
⏸️ Waiting for you to add API key
⏸️ Then we can test with live NBA games (6 games scheduled today!)

Once you add the key, the bot will immediately start working with the NBA games that are currently on CloudBet! 🏀
