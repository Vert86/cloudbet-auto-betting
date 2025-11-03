const cron = require('node-cron');
const config = require('./config/config');
const logger = require('./utils/logger');
const pinnacleAPI = require('./services/pinnacleAPI');
const oddsAggregator = require('./services/oddsAggregator');
const bettingStrategy = require('./services/bettingStrategy');
const betExecutor = require('./services/betExecutor');

class AutoBettingSystem {
  constructor() {
    this.isRunning = false;
    this.bankroll = 0;
    this.sports = [];
    this.targetSports = ['soccer', 'basketball', 'tennis', 'baseball', 'football'];
  }

  /**
   * Initialize the system
   */
  async initialize() {
    try {
      logger.info('Initializing Auto Betting System...');

      // Verify credentials
      if (!config.pinnacle.username || !config.pinnacle.password) {
        throw new Error('Pinnacle credentials not configured. Please set PINNACLE_USERNAME and PINNACLE_PASSWORD in .env file');
      }

      // Get account balance
      const balanceData = await pinnacleAPI.getBalance();
      this.bankroll = balanceData.availableBalance;

      logger.info('Account balance retrieved', {
        balance: this.bankroll,
        currency: balanceData.currency,
      });

      if (this.bankroll < config.betting.minBetAmount) {
        throw new Error(`Insufficient bankroll: ${this.bankroll}. Minimum required: ${config.betting.minBetAmount}`);
      }

      // Get available sports
      const sportsData = await pinnacleAPI.getSports();
      this.sports = sportsData.sports || [];

      logger.info('System initialized successfully', {
        bankroll: this.bankroll,
        availableSports: this.sports.length,
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize system', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Main betting cycle
   */
  async runBettingCycle() {
    if (this.isRunning) {
      logger.info('Betting cycle already running, skipping...');
      return;
    }

    this.isRunning = true;

    try {
      logger.info('===== Starting Betting Cycle =====');

      // Update account balance
      await this.updateBankroll();

      // Update status of active bets
      await betExecutor.updateBetStatuses();

      // Get current exposure
      const currentExposure = betExecutor.getCurrentExposure();

      logger.info('Current status', {
        bankroll: this.bankroll,
        currentExposure,
        activeBets: betExecutor.getActiveBets().length,
      });

      // Check if we should continue betting
      if (!this.shouldContinueBetting()) {
        logger.info('Betting paused due to limits or conditions');
        this.isRunning = false;
        return;
      }

      // Analyze opportunities for each sport
      const opportunities = [];

      for (const sport of this.sports) {
        try {
          // Focus on popular sports
          const sportName = sport.name?.toLowerCase() || '';
          const shouldAnalyze = this.targetSports.some(target =>
            sportName.includes(target)
          );

          if (!shouldAnalyze) {
            continue;
          }

          logger.info(`Analyzing sport: ${sport.name}`, { sportId: sport.id });

          // Get aggregated odds
          const aggregatedData = await oddsAggregator.aggregateOdds(
            sport.id,
            [],
            false
          );

          // Find value bets
          const valueBets = oddsAggregator.findValueBets(
            aggregatedData,
            config.riskManagement.minEdgePercentage
          );

          opportunities.push(...valueBets);

          logger.info(`Found ${valueBets.length} opportunities in ${sport.name}`);

          // Small delay between sports to respect rate limits
          await this.delay(5000);
        } catch (error) {
          logger.error(`Error analyzing sport ${sport.name}`, {
            error: error.message,
          });
        }
      }

      logger.info(`Total opportunities found: ${opportunities.length}`);

      // Sort opportunities by expected value (highest first)
      opportunities.sort((a, b) => {
        const evA = parseFloat(a.edge);
        const evB = parseFloat(b.edge);
        return evB - evA;
      });

      // Evaluate and place bets
      let betsPlaced = 0;

      for (const opportunity of opportunities) {
        try {
          // Evaluate the bet
          const evaluatedBet = await bettingStrategy.evaluateBet(
            opportunity,
            this.bankroll,
            currentExposure + betExecutor.getCurrentExposure()
          );

          if (!evaluatedBet) {
            logger.info('Opportunity did not pass evaluation', {
              event: `${opportunity.home} vs ${opportunity.away}`,
            });
            continue;
          }

          // Execute the bet
          const result = await betExecutor.executeBet(evaluatedBet);

          if (result.success) {
            betsPlaced++;
            logger.info('Bet placed successfully', {
              betId: result.bet.betId,
              stake: result.bet.stake,
            });

            // Update bankroll
            this.bankroll -= result.bet.stake;

            // Small delay between bets
            await this.delay(3000);
          } else {
            logger.warn('Bet execution failed', {
              reason: result.reason,
              event: `${evaluatedBet.home} vs ${evaluatedBet.away}`,
            });
          }

          // Check if we've hit daily limit
          const stats = bettingStrategy.getStatistics();
          if (stats.daily.betsPlaced >= config.riskManagement.maxBetsPerDay) {
            logger.info('Daily bet limit reached');
            break;
          }
        } catch (error) {
          logger.error('Error processing opportunity', {
            error: error.message,
            opportunity,
          });
        }
      }

      // Log cycle summary
      const stats = bettingStrategy.getStatistics();
      logger.info('===== Betting Cycle Complete =====', {
        betsPlaced,
        totalOpportunities: opportunities.length,
        dailyStats: stats.daily,
        overallStats: stats.overall,
      });
    } catch (error) {
      logger.error('Error in betting cycle', {
        error: error.message,
        stack: error.stack,
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Update bankroll from account
   */
  async updateBankroll() {
    try {
      const balanceData = await pinnacleAPI.getBalance();
      this.bankroll = balanceData.availableBalance;
      logger.info('Bankroll updated', { balance: this.bankroll });
    } catch (error) {
      logger.error('Error updating bankroll', { error: error.message });
    }
  }

  /**
   * Check if system should continue betting
   */
  shouldContinueBetting() {
    const stats = bettingStrategy.getStatistics();

    // Check daily bet limit
    if (stats.daily.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      logger.info('Daily bet limit reached');
      return false;
    }

    // Check daily loss limit
    if (stats.daily.profit < -config.betting.maxDailyLoss) {
      logger.info('Daily loss limit reached');
      return false;
    }

    // Check total exposure
    const currentExposure = betExecutor.getCurrentExposure();
    if (currentExposure >= config.betting.maxTotalExposure) {
      logger.info('Total exposure limit reached');
      return false;
    }

    // Check bankroll
    if (this.bankroll < config.betting.minBetAmount) {
      logger.info('Insufficient bankroll');
      return false;
    }

    return true;
  }

  /**
   * Start the automated betting system
   */
  async start() {
    try {
      logger.info('Starting Automated Betting System...');

      // Initialize
      await this.initialize();

      // Run initial cycle
      await this.runBettingCycle();

      // Schedule regular cycles
      // Run every 15 minutes (respects rate limits)
      cron.schedule('*/15 * * * *', async () => {
        logger.info('Scheduled betting cycle triggered');
        await this.runBettingCycle();
      });

      // Schedule bet status updates every 5 minutes
      cron.schedule('*/5 * * * *', async () => {
        logger.info('Scheduled bet status update triggered');
        await betExecutor.updateBetStatuses();
      });

      // Daily stats report at midnight
      cron.schedule('0 0 * * *', () => {
        const stats = bettingStrategy.getStatistics();
        logger.info('Daily Report', {
          date: new Date().toDateString(),
          stats,
        });
      });

      logger.info('Automated Betting System is now running');
      logger.info('Press Ctrl+C to stop');

      // Keep the process running
      process.on('SIGINT', () => {
        logger.info('Shutting down gracefully...');
        const stats = bettingStrategy.getStatistics();
        logger.info('Final Statistics', { stats });
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to start system', {
        error: error.message,
        stack: error.stack,
      });
      process.exit(1);
    }
  }

  /**
   * Utility function to delay execution
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the system
const autoBettingSystem = new AutoBettingSystem();
autoBettingSystem.start();

module.exports = autoBettingSystem;
