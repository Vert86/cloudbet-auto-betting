const pinnacleAPI = require('./pinnacleAPI');
const bettingStrategy = require('./bettingStrategy');
const logger = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

class BetExecutor {
  constructor() {
    this.activeBets = [];
    this.currentExposure = 0;
    this.betsHistoryFile = path.join(__dirname, '../../data/bets_history.json');
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
   * Execute a bet
   */
  async executeBet(evaluatedBet) {
    try {
      logger.info('Executing bet', {
        event: `${evaluatedBet.home} vs ${evaluatedBet.away}`,
        betType: evaluatedBet.betType,
        side: evaluatedBet.side,
        stake: evaluatedBet.betSize,
        odds: evaluatedBet.pinnacleOdds,
        edge: evaluatedBet.edge,
        expectedValue: evaluatedBet.expectedValue,
      });

      // Prepare bet data
      const betData = {
        uniqueRequestId: `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        acceptBetterLine: true,
        oddsFormat: 'DECIMAL',
        stake: evaluatedBet.betSize,
        winRiskStake: 'RISK',
        lineId: evaluatedBet.lineId,
        sportId: evaluatedBet.sportId,
        eventId: evaluatedBet.eventId,
        periodNumber: 0,
        betType: evaluatedBet.betType,
        team: evaluatedBet.team,
        side: evaluatedBet.side,
      };

      // Place the bet
      const result = await pinnacleAPI.placeBet(betData);

      if (result.status === 'ACCEPTED') {
        logger.info('Bet accepted successfully', {
          betId: result.betId,
          stake: result.risk,
          toWin: result.win,
          price: result.price,
        });

        // Track the bet
        const betRecord = {
          betId: result.betId,
          uniqueRequestId: betData.uniqueRequestId,
          timestamp: new Date().toISOString(),
          eventId: evaluatedBet.eventId,
          home: evaluatedBet.home,
          away: evaluatedBet.away,
          betType: evaluatedBet.betType,
          side: evaluatedBet.side,
          stake: result.risk,
          odds: result.price,
          toWin: result.win,
          edge: evaluatedBet.edge,
          expectedValue: evaluatedBet.expectedValue,
          status: 'PENDING',
        };

        this.activeBets.push(betRecord);
        this.currentExposure += result.risk;

        // Save to history
        await this.saveBetToHistory(betRecord);

        return {
          success: true,
          bet: betRecord,
        };
      } else {
        logger.warn('Bet not accepted', {
          status: result.status,
          errorCode: result.errorCode,
        });

        return {
          success: false,
          reason: result.status,
          errorCode: result.errorCode,
        };
      }
    } catch (error) {
      logger.error('Error executing bet', {
        error: error.message,
        response: error.response?.data,
      });

      return {
        success: false,
        reason: 'EXECUTION_ERROR',
        error: error.message,
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
   * Update bet statuses
   */
  async updateBetStatuses() {
    if (this.activeBets.length === 0) {
      return;
    }

    try {
      logger.info('Updating bet statuses', {
        activeBets: this.activeBets.length,
      });

      const betIds = this.activeBets.map(bet => bet.betId);
      const betsData = await pinnacleAPI.getBets(betIds);

      if (!betsData.straightBets) {
        return;
      }

      for (const betData of betsData.straightBets) {
        const activeBet = this.activeBets.find(
          bet => bet.betId === betData.betId
        );

        if (!activeBet) continue;

        const oldStatus = activeBet.status;
        activeBet.status = betData.betStatus;

        // If status changed, update performance
        if (oldStatus !== betData.betStatus) {
          logger.info('Bet status changed', {
            betId: betData.betId,
            oldStatus,
            newStatus: betData.betStatus,
          });

          if (betData.betStatus === 'WON') {
            const profit = betData.win;
            bettingStrategy.updatePerformance(activeBet, 'win', profit);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.betId
            );
          } else if (betData.betStatus === 'LOSE') {
            const loss = -activeBet.stake;
            bettingStrategy.updatePerformance(activeBet, 'loss', loss);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.betId
            );
          } else if (
            betData.betStatus === 'CANCELLED' ||
            betData.betStatus === 'REFUNDED'
          ) {
            bettingStrategy.updatePerformance(activeBet, 'cancelled', 0);
            this.currentExposure -= activeBet.stake;

            // Remove from active bets
            this.activeBets = this.activeBets.filter(
              bet => bet.betId !== betData.betId
            );
          }

          // Update history file
          await this.updateBetInHistory(betData.betId, betData.betStatus);
        }
      }
    } catch (error) {
      logger.error('Error updating bet statuses', {
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

module.exports = new BetExecutor();
