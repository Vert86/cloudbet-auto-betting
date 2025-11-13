require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');
const advancedBettingStrategy = require('./src/services/advancedBettingStrategy');
const cloudbetAPI = require('./src/services/cloudbetAPI');
const logger = require('./src/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Production Automated Betting Bot
 * Uses multi-bookmaker odds comparison with advanced +EV strategy
 */
class ProductionBot {
  constructor() {
    this.isRunning = false;
    this.betCount = 0;
    this.dailyProfit = 0;
    this.sessionStart = new Date();
    this.lastBetTime = null;

    // Configuration
    this.scanInterval = 5 * 60 * 1000; // 5 minutes
    // Include sports with daily games for faster results
    this.sports = [
      'ice-hockey',     // NHL - games almost daily
      'basketball',     // NBA - games almost daily
      'american-football', // NFL - weekend games
      'soccer'          // Soccer - keep for coverage
    ];
    this.maxBetsPerDay = parseInt(process.env.MAX_BETS_PER_DAY) || 5;
    this.maxDailyLoss = parseFloat(process.env.MAX_DAILY_LOSS) || 50;

    // Bet history file
    this.betHistoryFile = path.join(__dirname, 'data', 'production_bets.json');
    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  /**
   * Get current bankroll
   */
  async getBankroll() {
    try {
      const balance = await cloudbetAPI.getBalance();
      const bankroll = parseFloat(balance.amount || balance.available) || 0;
      logger.info('Current bankroll', { bankroll, currency: process.env.CLOUDBET_CURRENCY });
      return bankroll;
    } catch (error) {
      logger.error('Error fetching bankroll', { error: error.message });
      return 0;
    }
  }

  /**
   * Calculate current exposure from active bets
   */
  getCurrentExposure() {
    // For simplicity, track this in memory during session
    // In production, you'd query active bets from Cloudbet API
    return this.dailyProfit < 0 ? Math.abs(this.dailyProfit) : 0;
  }

  /**
   * Save bet to history
   */
  saveBet(bet) {
    try {
      let history = [];
      if (fs.existsSync(this.betHistoryFile)) {
        const data = fs.readFileSync(this.betHistoryFile, 'utf8');
        history = JSON.parse(data);
      }

      history.push({
        ...bet,
        timestamp: new Date().toISOString(),
        sessionStart: this.sessionStart.toISOString(),
      });

      fs.writeFileSync(this.betHistoryFile, JSON.stringify(history, null, 2));
      logger.info('Bet saved to history', { totalBets: history.length });
    } catch (error) {
      logger.error('Error saving bet history', { error: error.message });
    }
  }

  /**
   * Place a bet on Cloudbet
   */
  async placeBet(opportunity, evaluation) {
    try {
      logger.info('Placing bet', {
        event: `${opportunity.home} vs ${opportunity.away}`,
        side: opportunity.side,
        odds: opportunity.cloudbetOdds,
        stake: evaluation.betSize,
        edge: evaluation.edge.toFixed(2),
      });

      const betData = {
        eventId: opportunity.eventId,
        marketUrl: opportunity.marketUrl,
        price: opportunity.cloudbetOdds,
        stake: evaluation.betSize,
        currency: process.env.CLOUDBET_CURRENCY || 'USDT',
      };

      const result = await cloudbetAPI.placeBet(betData);

      logger.info('Bet placed successfully', {
        betId: result.id,
        status: result.status,
      });

      // Save to history
      this.saveBet({
        opportunity,
        evaluation,
        result,
        success: true,
      });

      this.betCount++;
      this.lastBetTime = new Date();

      return result;
    } catch (error) {
      logger.error('Error placing bet', {
        error: error.message,
        opportunity: `${opportunity.home} vs ${opportunity.away}`,
      });

      // Save failed bet attempt
      this.saveBet({
        opportunity,
        evaluation,
        error: error.message,
        success: false,
      });

      return null;
    }
  }

  /**
   * Scan for opportunities and place bets
   */
  async scanAndBet() {
    logger.info('Starting opportunity scan', {
      sports: this.sports,
      betsPlacedToday: this.betCount,
      maxBets: this.maxBetsPerDay,
    });

    try {
      // Get current bankroll
      const bankroll = await this.getBankroll();

      if (bankroll === 0) {
        logger.error('Zero bankroll - cannot place bets');
        return;
      }

      const currentExposure = this.getCurrentExposure();

      // Scan all sports
      for (const sport of this.sports) {
        logger.info(`Scanning ${sport} for opportunities`);

        // Get opportunities
        const opportunities = await multiBookmakerAggregator.findOpportunities(sport);
        logger.info(`Found ${opportunities.length} opportunities for ${sport}`);

        if (opportunities.length === 0) {
          continue;
        }

        // Evaluate each opportunity
        for (const opportunity of opportunities) {
          // Check if we've hit daily limits
          if (this.betCount >= this.maxBetsPerDay) {
            logger.info('Daily bet limit reached', { limit: this.maxBetsPerDay });
            return;
          }

          if (Math.abs(this.dailyProfit) >= this.maxDailyLoss) {
            logger.info('Daily loss limit reached', { loss: Math.abs(this.dailyProfit), limit: this.maxDailyLoss });
            return;
          }

          // Evaluate with advanced strategy
          const evaluation = await advancedBettingStrategy.evaluateBet(
            opportunity,
            bankroll,
            currentExposure
          );

          if (evaluation) {
            logger.info('✅ APPROVED BET FOUND', {
              event: `${opportunity.home} vs ${opportunity.away}`,
              side: opportunity.side,
              edge: evaluation.edge.toFixed(2),
              stake: evaluation.betSize,
              odds: opportunity.cloudbetOdds,
            });

            // Place the bet
            const result = await this.placeBet(opportunity, evaluation);

            if (result) {
              // Wait a bit before next bet
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
      }

      logger.info('Scan complete', {
        betsPlaced: this.betCount,
        dailyProfit: this.dailyProfit.toFixed(2),
      });

    } catch (error) {
      logger.error('Error in scan cycle', {
        error: error.message,
        stack: error.stack,
      });
    }
  }

  /**
   * Display bot status
   */
  displayStatus() {
    const uptime = Date.now() - this.sessionStart.getTime();
    const uptimeMinutes = Math.floor(uptime / 1000 / 60);

    console.log('\n' + '='.repeat(80));
    console.log('PRODUCTION BOT STATUS');
    console.log('='.repeat(80));
    console.log(`Status: ${this.isRunning ? '🟢 RUNNING' : '🔴 STOPPED'}`);
    console.log(`Session Start: ${this.sessionStart.toLocaleString()}`);
    console.log(`Uptime: ${uptimeMinutes} minutes`);
    console.log(`Bets Placed Today: ${this.betCount}/${this.maxBetsPerDay}`);
    console.log(`Daily P/L: ${this.dailyProfit >= 0 ? '+' : ''}${this.dailyProfit.toFixed(2)} ${process.env.CLOUDBET_CURRENCY}`);
    if (this.lastBetTime) {
      console.log(`Last Bet: ${this.lastBetTime.toLocaleString()}`);
    }
    console.log(`Next Scan: ${new Date(Date.now() + this.scanInterval).toLocaleTimeString()}`);
    console.log('='.repeat(80) + '\n');
  }

  /**
   * Start the bot
   */
  async start() {
    logger.info('='.repeat(80));
    logger.info('PRODUCTION BOT STARTING');
    logger.info('='.repeat(80));

    // Verify API connectivity
    logger.info('Verifying API connectivity...');

    try {
      // Test Cloudbet API
      const balance = await cloudbetAPI.getBalance();
      logger.info('✅ Cloudbet API connected', { balance: balance.amount || balance.available, currency: process.env.CLOUDBET_CURRENCY });

      // Test Odds API
      const axios = require('axios');
      const oddsApiTest = await axios.get('https://api.the-odds-api.com/v4/sports', {
        params: { apiKey: process.env.ODDS_API_KEY }
      });
      const remaining = oddsApiTest.headers['x-requests-remaining'];
      logger.info('✅ The Odds API connected', { requestsRemaining: remaining });

    } catch (error) {
      logger.error('❌ API connectivity check failed', { error: error.message });
      console.error('\n⚠️  STARTUP FAILED - Check your API keys and connectivity\n');
      return;
    }

    console.log('\n✅ All systems operational\n');
    console.log('🤖 Starting automated betting...\n');

    this.isRunning = true;

    // Display status every 30 seconds
    const statusInterval = setInterval(() => {
      if (this.isRunning) {
        this.displayStatus();
      }
    }, 30000);

    // Initial scan
    await this.scanAndBet();

    // Schedule periodic scans
    const scanLoop = setInterval(async () => {
      if (this.isRunning) {
        await this.scanAndBet();
      }
    }, this.scanInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received shutdown signal');
      console.log('\n\n🛑 Shutting down gracefully...\n');
      this.isRunning = false;
      clearInterval(statusInterval);
      clearInterval(scanLoop);
      this.displayStatus();
      console.log('✅ Bot stopped\n');
      process.exit(0);
    });

    // Keep process alive
    process.stdin.resume();
  }
}

// Start the bot
const bot = new ProductionBot();
bot.start().catch(error => {
  logger.error('Fatal error', { error: error.message, stack: error.stack });
  console.error('\n❌ FATAL ERROR:', error.message, '\n');
  process.exit(1);
});
