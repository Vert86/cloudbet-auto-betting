# Cloudbet Automated Sports Betting System

An intelligent automated betting system that analyzes odds from multiple sources, identifies value betting opportunities, and executes bets automatically on your **Cloudbet** account using cryptocurrency.

## Why Cloudbet?

- ✅ **Public API Access**: Available to all users (just deposit 10 EUR equivalent)
- ✅ **Cryptocurrency Support**: BTC, ETH, USDT, and many more
- ✅ **International**: Available globally
- ✅ **Instant Withdrawals**: Fast crypto payouts
- ✅ **Well Documented**: Complete REST API with Swagger docs

## Features

- **Multi-Source Odds Aggregation**: Collects and compares odds from Cloudbet and external sources
- **Smart Bet Selection**: Uses statistical analysis to identify value bets with positive expected value
- **Kelly Criterion Betting**: Automatically calculates optimal bet sizes based on bankroll and edge
- **Risk Management**: Built-in limits for daily losses, maximum exposure, and bet frequency
- **Performance Tracking**: Monitors win/loss rates and adjusts bet sizing based on recent performance
- **Automatic Execution**: Places bets automatically when opportunities meet your criteria
- **Cryptocurrency Native**: All bets in Bitcoin or your preferred crypto
- **Comprehensive Logging**: Detailed logs of all activities, bets, and performance metrics

## Quick Start

### 1. Create Cloudbet Account

1. Sign up at [Cloudbet.com](https://www.cloudbet.com/)
2. Deposit minimum **10 EUR equivalent** in cryptocurrency (e.g., 0.001 BTC)
3. Go to [Account → API](https://www.cloudbet.com/en/account/api)
4. Generate your **Trading API Key** (not Affiliate key!)

### 2. Install & Configure

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env and add your Cloudbet API key
nano .env  # or use any text editor
```

Your `.env` file should look like:
```env
BETTING_PLATFORM=cloudbet
CLOUDBET_API_KEY=your_actual_api_key_here
CLOUDBET_CURRENCY=BTC

MIN_BET_AMOUNT=0.001
MAX_BET_AMOUNT=0.01
MAX_DAILY_LOSS=0.05
...
```

### 3. Test Connection

```bash
npm test
```

If all tests pass ✅, you're ready to go!

### 4. Start the System

```bash
npm start
```

## How It Works

### 1. Odds Collection (Every 10 minutes)
- Fetches odds from Cloudbet for major sports (soccer, basketball, tennis, etc.)
- Compares with external bookmaker odds (if configured)
- Identifies discrepancies and value opportunities

### 2. Value Detection
- Calculates implied probabilities
- Compares Cloudbet odds with market averages
- Identifies bets with positive expected value (edge ≥ 2%)

### 3. Bet Evaluation
- Verifies odds are still available
- Calculates optimal bet size using Kelly Criterion
- Adjusts sizing based on recent performance (reduces during losing streaks)
- Checks all risk management constraints

### 4. Bet Execution
- Places bets automatically via Cloudbet Trading API
- Tracks all bets in real-time
- Monitors bet outcomes
- Updates performance statistics

### 5. Performance Adjustment
- Monitors win/loss rate over last 10 bets
- Reduces bet sizes by 30% during losing streaks (3+ losses)
- Slightly increases (10%) during winning periods
- Resets daily statistics at midnight

## Configuration

### Cryptocurrency Settings

The system defaults to Bitcoin (BTC), but you can use any currency supported by Cloudbet:

```env
CLOUDBET_CURRENCY=BTC   # or ETH, USDT, LTC, etc.
```

### Bet Size Configuration

Amounts are in cryptocurrency units:

```env
# Conservative (recommended for beginners)
MIN_BET_AMOUNT=0.0001      # ~$7 at $70k BTC
MAX_BET_AMOUNT=0.001       # ~$70
MAX_DAILY_LOSS=0.005       # ~$350
MAX_TOTAL_EXPOSURE=0.01    # ~$700

# Moderate
MIN_BET_AMOUNT=0.001       # ~$70
MAX_BET_AMOUNT=0.01        # ~$700
MAX_DAILY_LOSS=0.05        # ~$3,500
MAX_TOTAL_EXPOSURE=0.1     # ~$7,000

# Aggressive (higher risk)
MIN_BET_AMOUNT=0.01        # ~$700
MAX_BET_AMOUNT=0.1         # ~$7,000
MAX_DAILY_LOSS=0.5         # ~$35,000
MAX_TOTAL_EXPOSURE=1.0     # ~$70,000
```

### Risk Management

```env
KELLY_FRACTION=0.25              # Use 1/4 Kelly (conservative)
MIN_EDGE_PERCENTAGE=2.0          # Minimum 2% edge required
MAX_BETS_PER_DAY=10              # Max 10 bets per day
BANKROLL_PERCENTAGE_PER_BET=2    # Max 2% of bankroll per bet
```

## API Endpoints Used

### Feed API
- `GET /v2/sports` - Get available sports
- `GET /v2/sports/{sport}/events` - Get events with odds
- `GET /v2/events/{eventId}` - Get specific event odds

### Trading API
- `POST /v3/bets` - Place a bet
- `GET /v3/bets` - Get bet history
- `GET /v3/bets/{betId}` - Get specific bet details

### Account API
- `GET /v1/account/balances` - Get account balances

## Supported Sports

The system focuses on major sports with high liquidity:
- ⚽ Soccer (Football)
- 🏀 Basketball
- 🎾 Tennis
- 🏈 American Football
- ⚾ Baseball

## Risk Management Features

1. **Kelly Criterion**: Optimal bet sizing based on edge and bankroll
2. **Fractional Kelly**: Uses 25% of full Kelly for safety
3. **Daily Loss Limit**: Stops betting after reaching daily loss threshold
4. **Maximum Exposure**: Limits total amount at risk across all active bets
5. **Bet Count Limit**: Maximum number of bets per day
6. **Performance-Based Adjustment**: Reduces bets during losing streaks
7. **Odds Range**: Only bets within acceptable odds range (1.50 - 5.00)

## Logging and Monitoring

### Logs Directory
- `logs/combined.log` - All system activity
- `logs/error.log` - Errors only
- `logs/bets.log` - All bet placements and outcomes

### Data Files
- `data/cloudbet_bets_history.json` - Complete bet history

### Statistics Tracked
- Overall win rate and ROI
- Daily profit/loss (in BTC/crypto)
- Current winning/losing streaks
- Total bets placed
- Total amount staked and returned

## Troubleshooting

### "API key not configured"
- Make sure you've created `.env` file (copy from `.env.example`)
- Add your actual Cloudbet API key

### "Authentication failed"
**Possible causes:**
1. Invalid API key → Check you copied it correctly
2. Using Affiliate key → Must use Trading API key
3. Insufficient deposit → Need minimum 10 EUR equivalent

### "Insufficient bankroll"
- Ensure your Cloudbet account has enough funds
- Minimum balance should be at least `MIN_BET_AMOUNT`
- Check you're using the correct currency (BTC, ETH, etc.)

### No bets being placed
**Check these settings:**
- `MIN_EDGE_PERCENTAGE` might be too high (try 1.5%)
- `MIN_ODDS` / `MAX_ODDS` might be too restrictive
- Check logs to see why opportunities are rejected
- External odds API might not be configured (optional but helpful)

### Connection test fails
```bash
npm test
```
Will diagnose the exact issue and provide solutions.

## External Odds Comparison (Optional)

For better value detection, you can add an external odds API:

1. Sign up at [The Odds API](https://the-odds-api.com/)
2. Get free API key (500 requests/month free)
3. Add to `.env`:
```env
ODDS_API_KEY=your_odds_api_key_here
```

This allows the system to compare Cloudbet odds with market averages.

## Advanced Customization

### Change Update Frequency

Edit `src/index-cloudbet.js`:

```javascript
// Current: every 10 minutes
cron.schedule('*/10 * * * *', async () => { ... });

// Change to every 5 minutes
cron.schedule('*/5 * * * *', async () => { ... });
```

### Add More Sports

Edit `src/index-cloudbet.js` and update `targetSports`:

```javascript
this.targetSports = ['soccer', 'basketball', 'tennis', 'ice-hockey', 'mma'];
```

### Custom Strategy

Modify `src/services/bettingStrategy.js` to implement your own betting logic.

## Safety Best Practices

1. **Start Small**: Begin with minimum bet amounts
2. **Test First**: Run `npm test` before starting
3. **Monitor Closely**: Watch for the first 24 hours
4. **Conservative Limits**: Use conservative risk settings initially
5. **Regular Checks**: Verify balances match your expectations
6. **Separate Bankroll**: Only use funds you can afford to lose

## Comparison: Cloudbet vs Pinnacle

| Feature | Cloudbet | Pinnacle |
|---------|----------|----------|
| API Access | ✅ Public (10 EUR deposit) | ❌ Restricted (by request) |
| Cryptocurrency | ✅ BTC, ETH, USDT, etc. | ❌ Fiat only |
| International | ✅ Global | ⚠️ Limited regions |
| Withdrawals | ✅ Instant (crypto) | ⏳ 1-3 days |
| API Documentation | ✅ Excellent (Swagger) | ✅ Good |
| Liquidity | ⚠️ Good | ✅ Excellent |
| Margins | ⚠️ Moderate | ✅ Low (sharp) |

## License

This software is provided as-is for personal use. Use at your own risk.

## Disclaimer

**IMPORTANT**: Automated betting carries financial risk. This system does not guarantee profits. Past performance does not indicate future results. Only bet what you can afford to lose. Ensure compliance with local gambling laws and Cloudbet's terms of service. Cryptocurrency values fluctuate - manage your risk accordingly.

## Support

For issues:
1. Run `npm test` to diagnose connection issues
2. Check logs in `logs/` directory
3. Review troubleshooting section above
4. Verify Cloudbet API status
5. Check your account has sufficient balance

## Version

2.0.0 - Cloudbet Integration Release

---

**Ready to start?**

```bash
npm install
cp .env.example .env
# Edit .env with your Cloudbet API key
npm test
npm start
```

🚀 Happy automated betting with cryptocurrency!
