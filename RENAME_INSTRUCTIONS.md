# GitHub Repository Rename Instructions

## Current Status
- Current repo: `https://github.com/Vert86/pinnacle_sports_betting`
- All Cloudbet files are up to date and committed
- System is fully functional with Cloudbet

## How to Rename the Repository

### Step 1: Rename on GitHub
1. Go to: https://github.com/Vert86/pinnacle_sports_betting/settings
2. Scroll to **Repository name** section
3. Change name from: `pinnacle_sports_betting`
4. Change name to: `cloudbet-auto-betting`
5. Click **Rename** button

GitHub will automatically redirect the old URL to the new one.

### Step 2: Update Local Repository
After renaming on GitHub, run this command:

```bash
git remote set-url origin https://github.com/Vert86/cloudbet-auto-betting.git
```

Verify it worked:
```bash
git remote -v
```

Should show:
```
origin  https://github.com/Vert86/cloudbet-auto-betting.git (fetch)
origin  https://github.com/Vert86/cloudbet-auto-betting.git (push)
```

### Step 3: Test
```bash
git pull
git push
```

## What's in the Repository

### Main Files
- `src/index-cloudbet.js` - Main application
- `src/services/cloudbetAPI.js` - Cloudbet API integration
- `src/services/cloudbetOddsAggregator.js` - Odds comparison
- `src/services/cloudbetBetExecutor.js` - Bet execution
- `src/services/bettingStrategy.js` - Kelly Criterion & risk management
- `test-cloudbet.js` - Connection test
- `README.md` - Complete documentation

### Configuration
- `.env` - Your API keys and settings (not in git)
- `.env.example` - Template for new users
- `package.json` - Node.js dependencies

### Removed (All Pinnacle files deleted)
- ❌ `src/services/pinnacleAPI.js`
- ❌ `src/services/oddsAggregator.js`
- ❌ `src/services/betExecutor.js`
- ❌ `src/index.js`
- ❌ `test-connection.js`

## Current System Status

✅ **Fully Operational**
- Balance: 98.4 USDT
- Platform: Cloudbet
- API: Connected and working
- Sports: 74 available
- Status: Scanning for value bets every 10 minutes

## After Renaming

The repository will be:
- **URL**: `https://github.com/Vert86/cloudbet-auto-betting`
- **Name**: cloudbet-auto-betting
- **Description**: Automated sports betting system for Cloudbet with cryptocurrency support

All existing links will automatically redirect to the new URL.
