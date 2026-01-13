# Sports Comparison Analysis - Why Only NFL Bets?

**Date:** 2026-01-13
**Analysis:** Complete comparison across NFL, NBA, Soccer, and MMA

---

## Executive Summary

After running comprehensive analysis across all sports, here's what we found:

| Sport | Games Available | Fundamental Analysis | Qualified Bets | Status |
|-------|----------------|---------------------|----------------|--------|
| **NFL** | ~10 weekly | ✅ Implemented | ✅ Several | **WORKING** |
| **NBA** | ~10 daily | ✅ Implemented | ❌ None (55% confidence) | **LOW CONFIDENCE** |
| **Soccer** | 183 opportunities | ❌ Not Implemented | ❌ None | **NOT IMPLEMENTED** |
| **MMA** | 0 opportunities | ❓ Unknown | ❌ None | **NO DATA** |

---

## Detailed Findings

### 1. NFL (American Football) ✅

**Status:** WORKING - Bets are being placed successfully

**Why It Works:**
- ✅ Fundamental analysis fully implemented
- ✅ API-Sports provides complete team data
- ✅ Predictions reach 60-70% confidence
- ✅ Large talent gaps between teams (easier to predict)
- ✅ Comprehensive factors analyzed:
  - Win-loss records
  - Power rankings
  - Home field advantage
  - Offensive/defensive stats
  - Injury reports

**Example Prediction:**
```
Game: CAR Panthers vs LA Rams
Prediction: LA Rams (away) will win
Confidence: 65%
Result: BET APPROVED ✅
```

---

### 2. NBA (Basketball) ⚠️

**Status:** PARTIALLY WORKING - Predictions generated but too low confidence

**From Analysis ([analyze-tonights-nba.js](analyze-tonights-nba.js)):**
```
Total games available: 6 tonight
Games analyzed: 6
Predictions generated: 6
Qualified bets: 0

Average confidence: 55%
Required confidence: 60%
```

**Why Predictions Are Low:**
- Only detecting home court advantage (+5 points)
- NBA teams are more evenly matched
- Win rate differences too small (52% vs 48%)
- Missing factors:
  - Recent form (last 10 games)
  - Point differential
  - Head-to-head history
  - Key player injuries

**Example Prediction:**
```
Game: CLE Cavaliers vs MIN Timberwolves
Prediction: CLE Cavaliers (home) will win
Confidence: 55.0%
Factors: [Home Court advantage]
Result: BET REJECTED ❌ (below 60% threshold)
```

**Solutions:**
1. **Quick Fix:** Lower `MIN_PREDICTION_CONFIDENCE=0.50` in `.env`
2. **Better Fix:** Add more prediction factors to boost confidence

---

### 3. Soccer ⚽

**Status:** NOT IMPLEMENTED - Fundamental analysis disabled

**From Analysis ([analyze-soccer-opportunities.js](analyze-soccer-opportunities.js)):**
```
Total opportunities: 183
Unique games: 61
Competitions:
  - Premier League: 20 games
  - Bundesliga: 18 games
  - Ligue 1: 18 games
  - UEFA Champions League: 18 games
  - And more...

Predictions generated: 0
Qualified bets: 0
```

**What Happened:**
Every soccer game returned:
```
❌ No prediction available (insufficient data or not implemented)

Log: "Soccer predictions not yet implemented"
Recommendation: "Focus on NBA/NFL/NHL for best results"
```

**Why Soccer Doesn't Work:**

Located in [fundamentalAnalysisPredictor.js:88-96](src/services/fundamentalAnalysisPredictor.js#L88-L96):

```javascript
async predictWinner(event, sport) {
  logger.info('Running fundamental analysis', {
    home: event.home,
    away: event.away,
    sport
  });

  if (sport === 'soccer') {
    logger.info('Soccer predictions not yet implemented', {
      matchup: `${event.home} vs ${event.away}`,
      recommendation: 'Focus on NBA/NFL/NHL for best results'
    });
    return null;  // ❌ Returns null immediately
  }
  // ... rest of code
}
```

**Missing Components:**
1. No soccer stats API integration
2. No team standings data source
3. No prediction algorithm for soccer
4. No league/competition data

**Available Data Sources:**
- API-Football (football-data.org) - Free tier: 10 req/min
- SofaScore API (unofficial) - Scraping possible
- RapidAPI Soccer - 100 req/day free
- The-Odds-API - Already integrated (has odds, not stats)

---

### 4. MMA (Mixed Martial Arts) 🥊

**Status:** NO DATA AVAILABLE

**From Analysis ([analyze-mma-opportunities.js](analyze-mma-opportunities.js)):**
```
Total MMA opportunities found: 0

Warning: "Sport not mapped to Odds API"
```

**Why No MMA Opportunities:**

Located in [multiBookmakerOddsAggregator.js](src/services/multiBookmakerOddsAggregator.js):

The aggregator tries to fetch from The-Odds-API but MMA isn't mapped to any Odds API sport key.

**Issues:**
1. ❌ No Cloudbet MMA events being fetched
2. ❌ No Odds API mapping for MMA (`sportKey: 'mma'` not recognized)
3. ❓ MMA fundamental analysis may not be implemented
4. ❌ No fighter stats API integration

**Possible Causes:**
- Cloudbet doesn't currently have MMA fights available
- Bot's MMA fetching logic not configured
- The-Odds-API doesn't support MMA sport key

**Available MMA Data Sources:**
- UFC Stats API (unofficial)
- Sherdog scraping
- ESPN MMA API (hidden)
- MMA Junkie data

---

## Root Cause Analysis

### Why ONLY NFL Bets Are Being Placed

The hierarchy of issues:

```
NFL:    Implementation ✅ → Data ✅ → Confidence ✅ → Bets ✅
NBA:    Implementation ✅ → Data ✅ → Confidence ❌ → Bets ❌
Soccer: Implementation ❌ → (stops here) → Bets ❌
MMA:    Data Source ❌ → (stops here) → Bets ❌
```

**NFL succeeds because:**
1. Complete fundamental analysis implementation
2. API-Sports provides rich NFL data
3. Big talent gaps = easier predictions
4. Multiple factors boost confidence to 60%+

**NBA fails because:**
1. Implementation works ✅
2. Data fetching works ✅
3. But predictions only reach 55% confidence
4. Your threshold requires 60%

**Soccer fails because:**
1. Code explicitly returns `null` for soccer
2. No implementation at all
3. Comment says: "Focus on NBA/NFL/NHL"

**MMA fails because:**
1. No games available from Cloudbet
2. Not mapped to odds API
3. Unknown if fundamental analysis exists

---

## Configuration Review

### Current Settings ([.env](.env))

```bash
# Prediction Settings
MIN_PREDICTION_CONFIDENCE=0.60  ⚠️ Too high for NBA
MIN_EDGE_PERCENTAGE=-5.0        ✅ Allows fundamental analysis
MIN_BOOKMAKERS=0                ✅ Doesn't require other bookmakers

# API Keys
API_SPORTS_KEY=3708b4f904f898d5ff05f48374385713  ✅ Working
BALLDONTLIE_API_KEY=5a7a35bf-80c2-497f-a9c0-6ebb2601b768  ⚠️ Rate limited
```

### Sports Enabled ([production-bot.js:28-33](production-bot.js#L28-L33))

```javascript
this.sports = [
  'ice-hockey',        // NHL - games almost daily
  'basketball',        // NBA - games almost daily
  'american-football'  // NFL - weekend games
  // 'soccer' - Disabled: No team stats/rankings API available yet
];
```

**Note:** Even though `soccer` is commented out, your bot still tries to fetch soccer opportunities from Cloudbet and The-Odds-API. But when it tries to run fundamental analysis, it gets blocked by the "not implemented" check.

---

## Solutions by Sport

### NFL: No Action Needed ✅
Everything working as expected.

### NBA: Quick Fix Available ⚠️

**Option 1: Lower Confidence Threshold (Immediate)**
```bash
# In .env
MIN_PREDICTION_CONFIDENCE=0.50
```
This will allow the 55% NBA predictions to qualify.

**Option 2: Improve Prediction Algorithm (Better)**
Add these factors to NBA analysis:
- Last 10 games momentum
- Point differential (offensive/defensive strength)
- Head-to-head history
- Home vs away splits
- Rest days / back-to-back games

Expected confidence boost: 55% → 65%

### Soccer: Requires Implementation 🔧

**What's Needed:**
1. Choose a soccer stats API (recommend API-Football)
2. Implement `predictSoccer()` method in fundamentalAnalysisPredictor.js
3. Add factors:
   - League standings
   - Recent form (last 5 matches)
   - Goal differential
   - Home vs away records
   - Head-to-head history
4. Remove the "not implemented" block
5. Test with Premier League games

**Estimated effort:** 2-3 hours

### MMA: Requires Data Source + Implementation 🔨

**What's Needed:**
1. Configure Cloudbet MMA event fetching
2. Map MMA sport to odds API (or skip odds API for MMA)
3. Choose fighter stats API
4. Implement `predictMMA()` method with factors:
   - Fighter records (W-L-D)
   - Recent form
   - Finish rate (KO/TKO/SUB)
   - Reach/height advantages
   - Weight class
   - Fighting style matchups
5. Test with UFC events

**Estimated effort:** 3-4 hours

---

## Recommendations

### Immediate Actions (Tonight)

1. **Get NBA bets working:**
   ```bash
   # In .env, change:
   MIN_PREDICTION_CONFIDENCE=0.50
   ```
   Restart bot → You'll start seeing NBA bets

2. **Verify NHL status:**
   Run: `node analyze-nhl-opportunities.js` (need to create this)
   Check if NHL has same issue as NBA

### Short-term (This Week)

1. **Improve NBA predictions:**
   - Add momentum factor (last 10 games)
   - Add point differential
   - Target 65% confidence

2. **Decide on soccer:**
   - Do you want soccer betting?
   - If yes, which leagues? (Premier League, La Liga, Champions League?)
   - Budget for API-Football? (Free tier is limited)

### Long-term (Next Month)

1. **Implement soccer** (if desired)
2. **Implement MMA** (if desired)
3. **Add NHL analysis** (similar to NBA)

---

## File References

All analysis scripts created:
- [analyze-tonights-nba.js](analyze-tonights-nba.js) - NBA analysis ✅
- [analyze-soccer-opportunities.js](analyze-soccer-opportunities.js) - Soccer analysis ✅
- [analyze-mma-opportunities.js](analyze-mma-opportunities.js) - MMA analysis ✅

Documentation created:
- [WHY_ONLY_NFL_BETS.md](WHY_ONLY_NFL_BETS.md) - Root cause analysis
- [API_SPORTS_IMPLEMENTATION.md](API_SPORTS_IMPLEMENTATION.md) - NBA multi-source implementation
- [FREE_NBA_APIS.md](FREE_NBA_APIS.md) - Alternative data sources
- [FIXES_APPLIED.md](FIXES_APPLIED.md) - All fixes implemented

---

## Summary

**You're only getting NFL bets because:**

1. ✅ **NFL:** Fully implemented, high confidence → **Bets placed**
2. ⚠️ **NBA:** Implemented but 55% confidence < 60% required → **Bets rejected**
3. ❌ **Soccer:** Not implemented, returns null immediately → **No bets possible**
4. ❌ **MMA:** No data source, no games available → **No bets possible**

**Quick fix to get NBA bets tonight:**
```bash
MIN_PREDICTION_CONFIDENCE=0.50
```

**The fixes you requested ARE working** - NBA data is fetched, predictions are generated, but they're just slightly below your threshold. Lower the threshold or improve the algorithm to start seeing NBA bets!
