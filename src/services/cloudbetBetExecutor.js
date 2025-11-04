const cloudbetAPI = require('./cloudbetAPI');
const bettingStrategy = require('./bettingStrategy');
const config = require('../config/config');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class CloudbetBetExecutor {
  constructor() {
    this.activeBets = [];
    this.currentExposure = 0;
    this.betsHistoryFile = path.join(__dirname, '../../data/cloudbet_bets_history.json');
    this.currency = config.cloudbet.currency || 'BTC';
    this.ensureDataDirectory();
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating data directory', { error: error.message });
    }
  }

  /**
   * Generate a proper UUID v4
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Execute a bet on Cloudbet
   */
  async executeBet(evaluatedBet) {
    try {
      logger.info('Executing bet on Cloudbet', {
        event: `${evaluatedBet.home} vs ${evaluatedBet.away}`,
        market: evaluatedBet.marketName,
        selection: evaluatedBet.selectionName,
        stake: evaluatedBet.betSize,
        odds: evaluatedBet.price,
        edge: evaluatedBet.edge,
        expectedValue: evaluatedBet.expectedValue,
      });

      // Prepare bet data for Cloudbet
      const betData = {
        eventId: evaluatedBet.eventId,
        marketUrl: evaluatedBet.marketUrl,
        price: evaluatedBet.price,
        stake: evaluatedBet.betSize,
        currency: this.currency,
        selectionKey: evaluatedBet.selectionKey,
        referenceId: this.generateUUID() // Proper UUID v4 format required by Cloudbet
      };

      // Place the bet
      const result = await cloudbetAPI.placeBet(betData);

      logger.info('Bet accepted successfully', {
        betId: result.id,
        stake: result.stake,
        price: result.price,
        status: result.status
      });

      // Track the bet
      const betRecord = {
        betId: result.id,
        referenceId: betData.referenceId,
        timestamp: new Date().toISOString(),
        eventId: evaluatedBet.eventId,
        eventKey: evaluatedBet.eventKey,
        home: evaluatedBet.home,
        away: evaluatedBet.away,
        market: evaluatedBet.marketName,
        selection: evaluatedBet.selectionName,
        side: evaluatedBet.side,
        stake: result.stake,
        currency: result.currency,
        odds: result.price,
        potentialWin: result.stake * result.price,
        edge: evaluatedBet.edge,
        expectedValue: evaluatedBet.expectedValue,
        status: result.status || 'PENDING',
      };

      this.activeBets.push(betRecord);
      this.currentExposure += result.stake;

      // Save to history
      await this.saveBetToHistory(betRecord);

      return {
        success: true,
        bet: betRecord,
      };
    } catch (error) {
      logger.error('Error executing bet on Cloudbet', {
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        reason: 'EXECUTION_ERROR',
        error: error.message,
        details: error.response?.data
      };
    }
  }

  /**
   * Save bet to history file
   */
  async saveBetToHistory(betRecord) {
    try {
      let history = [];

      // Read existing history
      try {
        const data = await fs.readFile(this.betsHistoryFile, 'utf8');
        history = JSON.parse(data);
      } catch (error) {
        // File doesn't exist yet, start fresh
        history = [];
      }

      // Add new bet
      history.push(betRecord);

      // Save back to file
      await fs.writeFile(
        this.betsHistoryFile,
        JSON.stringify(history, null, 2),
        'utf8'
      );

      logger.info('Bet saved to history', { betId: betRecord.betId });
    } catch (error) {
      logger.error('Error saving bet to history', {
        error: error.message,
      });
    }
  }

  /**
   * Update bet statuses from Cloudbet
   */
  async updateBetStatuses() {
    if (this.activeBets.length === 0) {
      return;
    }

    try {
      logger.info('Updating bet statuses from Cloudbet', {
        activeBets: this.activeBets.length,
      });

      // Fetch recent bets from Cloudbet
      const betsData = await cloudbetAPI.getBets(100, 0);

      if (!betsData.bets) {
        return;
      }

      for (const betData of betsData.bets) {
        const activeBet = this.activeBets.find(
          bet => bet.betId === betData.id
        );

        if (!activeBet) continue;

        const oldStatus = activeBet.status;
        activeBet.status = betData.status;

        // If status changed, update performance
        if (oldStatus !== betData.status) {
          logger.info('Bet status changed', {
            betId: betData.id,
            oldStatus,
            newStatus: betData.status,
          });

          if (betData.status === 'RESULTED_WON') {
            const profit = betData.returnAmount - betData.stake;
            bettingStrategy.updatePerformance(activeBet, 'win', profit);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.id
            );
          } else if (betData.status === 'RESULTED_LOST') {
            const loss = -activeBet.stake;
            bettingStrategy.updatePerformance(activeBet, 'loss', loss);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.id
            );
          } else if (betData.status === 'RESULTED_VOID' || betData.status === 'CANCELLED') {
            bettingStrategy.updatePerformance(activeBet, 'cancelled', 0);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.id
            );
          }

          // Update history file
          await this.updateBetInHistory(betData.id, betData.status);
        }
      }
    } catch (error) {
      logger.error('Error updating bet statuses from Cloudbet', {
        error: error.message,
      });
    }
  }

  /**
   * Update bet status in history file
   */
  async updateBetInHistory(betId, newStatus) {
    try {
      const data = await fs.readFile(this.betsHistoryFile, 'utf8');
      const history = JSON.parse(data);

      const bet = history.find(b => b.betId === betId);
      if (bet) {
        bet.status = newStatus;
        bet.updatedAt = new Date().toISOString();

        await fs.writeFile(
          this.betsHistoryFile,
          JSON.stringify(history, null, 2),
          'utf8'
        );
      }
    } catch (error) {
      logger.error('Error updating bet in history', {
        error: error.message,
      });
    }
  }

  /**
   * Get current exposure
   */
  getCurrentExposure() {
    return this.currentExposure;
  }

  /**
   * Get active bets
   */
  getActiveBets() {
    return this.activeBets;
  }

  /**
   * Load bets history
   */
  async loadBetsHistory() {
    try {
      const data = await fs.readFile(this.betsHistoryFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }
}

module.exports = new CloudbetBetExecutor();
