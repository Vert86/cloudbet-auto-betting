const cron = require('node-cron');
const config = require('./config/config');
const logger = require('./utils/logger');
const cloudbetAPI = require('./services/cloudbetAPI');
const cloudbetOddsAggregator = require('./services/cloudbetOddsAggregator');
const bettingStrategy = require('./services/bettingStrategy');
const cloudbetBetExecutor = require('./services/cloudbetBetExecutor');

class CloudbetAutoBettingSystem {
  constructor() {
    this.isRunning = false;
    this.bankroll = 0;
    this.currency = config.cloudbet.currency || 'BTC';
    this.sports = [];
    // Focus on popular sports with good liquidity
    this.targetSports = ['soccer', 'basketball', 'tennis', 'american-football', 'baseball'];
  }

  /**
   * Initialize the system
   */
  async initialize() {
    try {
      logger.info('Initializing Cloudbet Auto Betting System...');

      // Verify API key
      if (!config.cloudbet.apiKey || config.cloudbet.apiKey === 'your_cloudbet_api_key_here') {
        throw new Error('Cloudbet API key not configured. Please set CLOUDBET_API_KEY in .env file');
      }

      // Get account balance for selected currency
      const balanceData = await cloudbetAPI.getBalance(this.currency);

      // Balance can be in .available or .amount format
      this.bankroll = parseFloat(balanceData.available || balanceData.amount || 0);

      logger.info('Account balance retrieved', {
        balance: this.bankroll,
        currency: this.currency,
        bonus: balanceData.bonus || 0,
        total: balanceData.total || this.bankroll,
      });

      if (this.bankroll < config.betting.minBetAmount) {
        throw new Error(`Insufficient bankroll: ${this.bankroll} ${this.currency}. Minimum required: ${config.betting.minBetAmount}`);
      }

      // Get available sports
      const sportsData = await cloudbetAPI.getSports();
      this.sports = sportsData.sports || [];

      logger.info('System initialized successfully', {
        bankroll: this.bankroll,
        currency: this.currency,
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
      logger.info('===== Starting Cloudbet Betting Cycle =====');

      // Update account balance
      await this.updateBankroll();

      // Update status of active bets
      await cloudbetBetExecutor.updateBetStatuses();

      // Get current exposure
      const currentExposure = cloudbetBetExecutor.getCurrentExposure();

      logger.info('Current status', {
        bankroll: this.bankroll,
        currency: this.currency,
        currentExposure,
        activeBets: cloudbetBetExecutor.getActiveBets().length,
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
          const sportKey = sport.key;

          // Focus on popular sports
          if (!this.targetSports.includes(sportKey)) {
            continue;
          }

          logger.info(`Analyzing sport: ${sport.name}`, { sportKey });

          // Get aggregated odds
          const aggregatedData = await cloudbetOddsAggregator.aggregateOdds(sportKey);

          // Find value bets
          const valueBets = cloudbetOddsAggregator.findValueBets(
            aggregatedData,
            config.riskManagement.minEdgePercentage
          );

          opportunities.push(...valueBets);

          logger.info(`Found ${valueBets.length} opportunities in ${sport.name}`);

          // Delay between sports to avoid rate limits
          await this.delay(2000);
        } catch (error) {
          logger.error(`Error analyzing sport ${sport.name}`, {
            error: error.message,
          });
        }
      }

      logger.info(`Total opportunities found: ${opportunities.length}`);

      // Sort opportunities by edge (highest first)
      opportunities.sort((a, b) => {
        const edgeA = parseFloat(a.edge);
        const edgeB = parseFloat(b.edge);
        return edgeB - edgeA;
      });

      // Evaluate and place bets
      let betsPlaced = 0;

      for (const opportunity of opportunities) {
        try {
          // Evaluate the bet
          const evaluatedBet = await this.evaluateBet(
            opportunity,
            this.bankroll,
            currentExposure + cloudbetBetExecutor.getCurrentExposure()
          );

          if (!evaluatedBet) {
            logger.info('Opportunity did not pass evaluation', {
              event: `${opportunity.home} vs ${opportunity.away}`,
            });
            continue;
          }

          // Execute the bet
          const result = await cloudbetBetExecutor.executeBet(evaluatedBet);

          if (result.success) {
            betsPlaced++;
            logger.info('Bet placed successfully on Cloudbet', {
              betId: result.bet.betId,
              stake: result.bet.stake,
              currency: result.bet.currency
            });

            // Update bankroll
            this.bankroll -= result.bet.stake;

            // Delay between bets
            await this.delay(3000);
          } else {
            logger.warn('Bet execution failed', {
              reason: result.reason,
              error: result.error,
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
   * Evaluate a betting opportunity
   */
  async evaluateBet(opportunity, bankroll, currentExposure) {
    logger.info('Evaluating betting opportunity', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      market: opportunity.marketName,
      edge: opportunity.edge,
    });

    // Check daily limits
    const stats = bettingStrategy.getStatistics();
    if (stats.daily.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      logger.info('Daily bet limit reached');
      return null;
    }

    // Check daily loss limit
    if (stats.daily.profit < -config.betting.maxDailyLoss) {
      logger.info('Daily loss limit reached');
      return null;
    }

    // Check edge threshold
    const edge = parseFloat(opportunity.edge);
    if (edge < config.riskManagement.minEdgePercentage) {
      logger.info('Bet edge below minimum threshold');
      return null;
    }

    // Check odds range
    const odds = opportunity.price;
    if (odds < config.betting.minOdds || odds > config.betting.maxOdds) {
      logger.info('Odds outside acceptable range', { odds });
      return null;
    }

    // Calculate win probability and bet size
    const winProbability = 1 / odds; // Simple implied probability
    const betSize = bettingStrategy.calculateKellyBetSize(bankroll, odds, winProbability);
    const adjustedBetSize = bettingStrategy.adjustBetSizeByPerformance(betSize);

    // Round to appropriate decimal places for crypto
    const finalBetSize = Math.round(adjustedBetSize * 100000000) / 100000000;

    // Check exposure
    if (currentExposure + finalBetSize > config.betting.maxTotalExposure) {
      logger.info('Total exposure limit would be exceeded');
      return null;
    }

    // Check minimum bet size
    if (finalBetSize < config.betting.minBetAmount) {
      logger.info('Bet size below minimum', { betSize: finalBetSize });
      return null;
    }

    return {
      ...opportunity,
      betSize: finalBetSize,
      estimatedWinProbability: winProbability,
      expectedValue: (winProbability * odds * finalBetSize) - finalBetSize,
    };
  }

  /**
   * Update bankroll from account
   */
  async updateBankroll() {
    try {
      const balanceData = await cloudbetAPI.getBalance(this.currency);
      this.bankroll = parseFloat(balanceData.available || balanceData.amount || 0);

      logger.info('Bankroll updated', {
        balance: this.bankroll,
        currency: this.currency
      });
    } catch (error) {
      logger.error('Error updating bankroll', { error: error.message });
    }
  }

  /**
   * Check if system should continue betting
   */
  shouldContinueBetting() {
    const stats = bettingStrategy.getStatistics();

    if (stats.daily.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      return false;
    }

    if (stats.daily.profit < -config.betting.maxDailyLoss) {
      return false;
    }

    const currentExposure = cloudbetBetExecutor.getCurrentExposure();
    if (currentExposure >= config.betting.maxTotalExposure) {
      return false;
    }

    if (this.bankroll < config.betting.minBetAmount) {
      return false;
    }

    return true;
  }

  /**
   * Start the automated betting system
   */
  async start() {
    try {
      logger.info('Starting Cloudbet Automated Betting System...');

      // Initialize
      await this.initialize();

      // Run initial cycle
      await this.runBettingCycle();

      // Schedule regular cycles - every 10 minutes
      cron.schedule('*/10 * * * *', async () => {
        logger.info('Scheduled betting cycle triggered');
        await this.runBettingCycle();
      });

      // Schedule bet status updates every 3 minutes
      cron.schedule('*/3 * * * *', async () => {
        logger.info('Scheduled bet status update triggered');
        await cloudbetBetExecutor.updateBetStatuses();
      });

      // Daily stats report at midnight
      cron.schedule('0 0 * * *', () => {
        const stats = bettingStrategy.getStatistics();
        logger.info('Daily Report', {
          date: new Date().toDateString(),
          stats,
        });
      });

      logger.info('Cloudbet Automated Betting System is now running');
      logger.info('Press Ctrl+C to stop');

      // Graceful shutdown
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
const autoBettingSystem = new CloudbetAutoBettingSystem();
autoBettingSystem.start();

module.exports = autoBettingSystem;
