# Pinnacle Automated Sports Betting System

An intelligent automated betting system that analyzes odds from multiple sources, identifies value betting opportunities, and executes bets automatically on your Pinnacle account.

## Features

- **Multi-Source Odds Aggregation**: Collects and compares odds from Pinnacle and external sources
- **Smart Bet Selection**: Uses statistical analysis to identify value bets with positive expected value
- **Kelly Criterion Betting**: Automatically calculates optimal bet sizes based on bankroll and edge
- **Risk Management**: Built-in limits for daily losses, maximum exposure, and bet frequency
- **Performance Tracking**: Monitors win/loss rates and adjusts bet sizing based on recent performance
- **Automatic Execution**: Places bets automatically when opportunities meet your criteria
- **Comprehensive Logging**: Detailed logs of all activities, bets, and performance metrics

## System Architecture

```
src/
├── config/
│   └── config.js              # Configuration management
├── services/
│   ├── pinnacleAPI.js         # Pinnacle API integration
│   ├── oddsAggregator.js      # Multi-source odds collection
│   ├── bettingStrategy.js     # Decision engine and risk management
│   └── betExecutor.js         # Bet placement and tracking
├── utils/
│   └── logger.js              # Logging system
└── index.js                   # Main application entry point
```

## Prerequisites

- Node.js v14 or higher
- Active Pinnacle account with API access
- Funded Pinnacle account

**IMPORTANT**: As of July 23, 2025, Pinnacle API access is restricted. You must contact api@pinnacle.com to request access for your account.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure your credentials:
```bash
cp .env.example .env
```

3. Edit `.env` file with your credentials and preferences:
```env
# Required: Pinnacle API Credentials
PINNACLE_USERNAME=your_pinnacle_username
PINNACLE_PASSWORD=your_pinnacle_password

# Optional: Odds comparison API key (get from https://the-odds-api.com)
ODDS_API_KEY=your_odds_api_key

# Betting Configuration
MIN_ODDS=1.50                    # Minimum acceptable odds
MAX_ODDS=5.00                    # Maximum acceptable odds
MIN_BET_AMOUNT=10                # Minimum bet size
MAX_BET_AMOUNT=100               # Maximum bet size
MAX_DAILY_LOSS=500               # Maximum daily loss limit
MAX_TOTAL_EXPOSURE=1000          # Maximum total at-risk amount

# Risk Management
KELLY_FRACTION=0.25              # Kelly fraction (0.25 = quarter Kelly)
MIN_EDGE_PERCENTAGE=2.0          # Minimum edge required to place bet
MAX_BETS_PER_DAY=10              # Maximum bets per day
BANKROLL_PERCENTAGE_PER_BET=2    # Max % of bankroll per bet
```

## Usage

### Start the Automated System

```bash
npm start
```

The system will:
1. Connect to your Pinnacle account and verify credentials
2. Check your account balance
3. Begin monitoring odds and identifying opportunities
4. Automatically place bets when value opportunities are found
5. Monitor active bets and update performance metrics
6. Run continuously with scheduled cycles every 15 minutes

### Development Mode (with auto-restart)

```bash
npm run dev
```

## How It Works

### 1. Odds Collection
- Every 15 minutes, the system fetches odds from Pinnacle for major sports
- Optionally compares with external bookmaker odds for value detection
- Respects Pinnacle's rate limits (1 request per 2 minutes per endpoint)

### 2. Value Detection
- Compares Pinnacle odds with market averages
- Calculates implied probabilities and edge percentages
- Identifies bets with positive expected value

### 3. Bet Evaluation
- Verifies odds are still available
- Calculates optimal bet size using Kelly Criterion
- Adjusts sizing based on recent performance
- Checks all risk management constraints:
  - Daily bet limit
  - Daily loss limit
  - Total exposure limit
  - Odds range
  - Minimum edge requirement

### 4. Bet Execution
- Places bets automatically via Pinnacle API
- Tracks all bets in real-time
- Monitors bet outcomes
- Updates performance statistics

### 5. Performance Adjustment
- Monitors win/loss rate over last 10 bets
- Reduces bet sizes during losing streaks (3+ losses)
- Slightly increases during winning streaks
- Resets daily statistics at midnight

## Risk Management

The system includes multiple layers of protection:

1. **Bet Sizing**: Uses fractional Kelly Criterion to prevent over-betting
2. **Daily Limits**: Stops betting after reaching max daily loss or bet count
3. **Exposure Control**: Limits total amount at risk across all active bets
4. **Odds Verification**: Confirms odds before placing each bet
5. **Performance-Based Adjustment**: Reduces bet sizes during losing periods

## Logging and Monitoring

Logs are stored in the `logs/` directory:
- `combined.log`: All system activity
- `error.log`: Errors only
- `bets.log`: All bet placements and outcomes

Bet history is stored in `data/bets_history.json`

## Statistics and Reports

The system tracks:
- Overall win rate and ROI
- Daily profit/loss
- Current winning/losing streaks
- Total bets placed
- Total amount staked and returned

Daily reports are automatically generated at midnight.

## Configuration Guide

### Conservative Settings (Recommended for beginners)
```env
KELLY_FRACTION=0.10              # Very conservative bet sizing
MIN_EDGE_PERCENTAGE=3.0          # Higher edge requirement
MAX_BETS_PER_DAY=5               # Fewer bets
BANKROLL_PERCENTAGE_PER_BET=1    # Lower max per bet
```

### Moderate Settings (Default)
```env
KELLY_FRACTION=0.25
MIN_EDGE_PERCENTAGE=2.0
MAX_BETS_PER_DAY=10
BANKROLL_PERCENTAGE_PER_BET=2
```

### Aggressive Settings (Higher risk/reward)
```env
KELLY_FRACTION=0.50
MIN_EDGE_PERCENTAGE=1.5
MAX_BETS_PER_DAY=20
BANKROLL_PERCENTAGE_PER_BET=3
```

## Supported Sports

The system focuses on major sports with high liquidity:
- Soccer (Football)
- Basketball
- Tennis
- Baseball
- American Football

## API Rate Limits

Pinnacle enforces strict rate limits:
- **Odds endpoints**: 1 request per 2 minutes per sport
- **Sports list**: Maximum once per hour
- **Maximum IPs**: 2 per account

The system automatically handles rate limiting with delays between requests.

## Troubleshooting

### "Pinnacle credentials not configured"
- Make sure you've copied `.env.example` to `.env`
- Fill in your Pinnacle username and password

### "Insufficient bankroll"
- Ensure your Pinnacle account is funded
- Minimum balance should be at least MIN_BET_AMOUNT

### "TOO_MANY_REQUESTS" error
- The system hit Pinnacle's rate limit
- It will automatically wait and retry
- Consider increasing delays in code if this persists

### "API access denied"
- You may not have API access enabled
- Contact api@pinnacle.com to request access

### No bets being placed
- Check MIN_EDGE_PERCENTAGE - you may need to lower it
- Verify MIN_ODDS and MAX_ODDS aren't too restrictive
- Check logs for why opportunities are being rejected

## Safety Notes

1. **Start with small amounts**: Test with minimum bet sizes first
2. **Monitor closely**: Watch the system for the first few days
3. **Set conservative limits**: Use the conservative settings initially
4. **Regular balance checks**: Verify your account balance matches expectations
5. **Backup bankroll**: Only bet what you can afford to lose

## Advanced Customization

### Adding New Sports
Edit `src/index.js` and add to `targetSports` array:
```javascript
this.targetSports = ['soccer', 'basketball', 'tennis', 'hockey', 'mma'];
```

### Changing Bet Cycle Frequency
Edit the cron schedule in `src/index.js`:
```javascript
// Current: every 15 minutes
cron.schedule('*/15 * * * *', async () => { ... });

// Example: every 30 minutes
cron.schedule('*/30 * * * *', async () => { ... });
```

### Custom Betting Strategy
Modify `src/services/bettingStrategy.js` to implement your own strategy logic.

## Data Storage

- **Bet History**: `data/bets_history.json` - All historical bet records
- **Logs**: `logs/` directory - All system logs with rotation
- **Performance**: In-memory tracking, logged to files

## Stopping the System

Press `Ctrl+C` to gracefully shut down the system. It will:
1. Log final statistics
2. Save all data
3. Exit cleanly

## License

This software is provided as-is for personal use. Use at your own risk.

## Disclaimer

**IMPORTANT**: Automated betting carries financial risk. This system does not guarantee profits. Past performance does not indicate future results. Only bet what you can afford to lose. Ensure compliance with local gambling laws and Pinnacle's terms of service.

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review the troubleshooting section
3. Verify your configuration in `.env`
4. Check Pinnacle API status

## Version

1.0.0 - Initial Release
