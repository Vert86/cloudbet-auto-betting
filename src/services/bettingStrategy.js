const config = require('../config/config');
const logger = require('../utils/logger');

class BettingStrategy {
  constructor() {
    this.performanceHistory = [];
    this.dailyStats = {
      date: new Date().toDateString(),
      betsPlaced: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStaked: 0,
      totalReturns: 0,
      profit: 0,
    };
  }

  /**
   * Calculate bet size using Kelly Criterion
   */
  calculateKellyBetSize(bankroll, odds, estimatedWinProbability) {
    // Kelly Formula: f* = (bp - q) / b
    // where:
    // f* = fraction of bankroll to bet
    // b = decimal odds - 1
    // p = probability of winning
    // q = probability of losing (1 - p)

    const b = odds - 1;
    const p = estimatedWinProbability;
    const q = 1 - p;

    const kellyFraction = (b * p - q) / b;

    // Apply fractional Kelly for safety
    const adjustedKelly = kellyFraction * config.riskManagement.kellyFraction;

    // Calculate bet size
    let betSize = bankroll * adjustedKelly;

    // Apply maximum limits first
    betSize = Math.min(betSize, config.betting.maxBetAmount);

    // Also limit by bankroll percentage
    const maxByPercentage = bankroll * (config.riskManagement.bankrollPercentagePerBet / 100);
    betSize = Math.min(betSize, maxByPercentage);

    // Round to 2 decimals
    betSize = Math.round(betSize * 100) / 100;

    // Ensure minimum bet size is respected AFTER all calculations and rounding
    betSize = Math.max(betSize, config.betting.minBetAmount);

    return betSize;
  }

  /**
   * Estimate win probability from market odds
   */
  estimateWinProbability(currentOdds, marketOdds) {
    // Use the average of implied probabilities
    const currentProb = 1 / currentOdds;
    const marketProb = 1 / marketOdds;

    // Weight current odds more heavily (they're more recent)
    const estimatedProb = (currentProb * 0.6 + marketProb * 0.4);

    return estimatedProb;
  }

  /**
   * Evaluate if a bet meets criteria
   */
  async evaluateBet(opportunity, bankroll, currentExposure) {
    logger.info('Evaluating betting opportunity', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      betType: opportunity.betType,
      edge: opportunity.edge,
    });

    // Check daily limits
    if (this.dailyStats.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      logger.info('Daily bet limit reached', {
        limit: config.riskManagement.maxBetsPerDay
      });
      return null;
    }

    // Check daily loss limit
    if (this.dailyStats.profit < -config.betting.maxDailyLoss) {
      logger.info('Daily loss limit reached', {
        loss: this.dailyStats.profit,
        limit: config.betting.maxDailyLoss
      });
      return null;
    }

    // Check edge threshold
    const edge = parseFloat(opportunity.edge);
    if (edge < config.riskManagement.minEdgePercentage) {
      logger.info('Bet edge below minimum threshold', {
        edge,
        threshold: config.riskManagement.minEdgePercentage
      });
      return null;
    }

    // Check odds range
    const odds = opportunity.price || opportunity.cloudbetOdds;
    if (odds < config.betting.minOdds || odds > config.betting.maxOdds) {
      logger.info('Odds outside acceptable range', {
        odds,
        minOdds: config.betting.minOdds,
        maxOdds: config.betting.maxOdds
      });
      return null;
    }

    // Verify line is still available
    const lineVerification = await this.verifyLine(opportunity);
    if (!lineVerification.valid) {
      logger.info('Line no longer available or changed significantly', {
        reason: lineVerification.reason
      });
      return null;
    }

    // Calculate win probability
    const winProbability = this.estimateWinProbability(
      odds,
      opportunity.marketOdds || odds
    );

    // Calculate bet size
    const betSize = this.calculateKellyBetSize(bankroll, odds, winProbability);

    // Check total exposure
    if (currentExposure + betSize > config.betting.maxTotalExposure) {
      logger.info('Total exposure limit would be exceeded', {
        currentExposure,
        betSize,
        limit: config.betting.maxTotalExposure
      });
      return null;
    }

    // Adjust bet size based on recent performance
    const adjustedBetSize = this.adjustBetSizeByPerformance(betSize);

    return {
      ...opportunity,
      betSize: adjustedBetSize,
      estimatedWinProbability: winProbability,
      expectedValue: (winProbability * odds * adjustedBetSize) - adjustedBetSize,
    };
  }

  /**
   * Verify line is still available before betting
   * For Cloudbet, we'll accept the current odds from the aggregator
   */
  async verifyLine(opportunity) {
    // For Cloudbet, the odds are already current from the feed API
    // No need for additional verification like Pinnacle required
    return {
      valid: true,
      currentOdds: opportunity.price || opportunity.cloudbetOdds,
    };
  }

  /**
   * Adjust bet size based on recent performance (win/loss streaks)
   */
  adjustBetSizeByPerformance(baseBetSize) {
    if (this.performanceHistory.length < 5) {
      return baseBetSize;
    }

    // Look at last 10 bets
    const recentBets = this.performanceHistory.slice(-10);
    const recentWins = recentBets.filter(bet => bet.result === 'win').length;
    const recentLosses = recentBets.filter(bet => bet.result === 'loss').length;

    // Calculate win rate
    const winRate = recentWins / recentBets.length;

    // Adjust bet size based on performance
    let adjustment = 1.0;

    if (winRate >= 0.6) {
      // Good performance - slight increase
      adjustment = 1.1;
    } else if (winRate <= 0.4) {
      // Poor performance - reduce bet size
      adjustment = 0.8;
    }

    // Check for losing streak
    const losingStreak = this.getLosingStreak();
    if (losingStreak >= 3) {
      // On a losing streak - reduce bets further
      adjustment *= 0.7;
    }

    let adjustedSize = baseBetSize * adjustment;
    logger.info('Adjusted bet size based on performance', {
      baseBetSize,
      adjustedSize,
      winRate,
      losingStreak,
    });

    // Round to 2 decimals
    adjustedSize = Math.round(adjustedSize * 100) / 100;

    // Ensure minimum bet size is respected after performance adjustment
    adjustedSize = Math.max(adjustedSize, config.betting.minBetAmount);

    return adjustedSize;
  }

  /**
   * Get current losing streak
   */
  getLosingStreak() {
    let streak = 0;
    for (let i = this.performanceHistory.length - 1; i >= 0; i--) {
      if (this.performanceHistory[i].result === 'loss') {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * Update performance history
   */
  updatePerformance(bet, result, profit) {
    this.performanceHistory.push({
      timestamp: new Date().toISOString(),
      betId: bet.betId,
      eventId: bet.eventId,
      stake: bet.stake,
      odds: bet.odds,
      result,
      profit,
    });

    // Update daily stats
    this.dailyStats.betsPlaced++;
    this.dailyStats.totalStaked += bet.stake;

    if (result === 'win') {
      this.dailyStats.wins++;
      this.dailyStats.totalReturns += bet.stake + profit;
    } else if (result === 'loss') {
      this.dailyStats.losses++;
    } else {
      this.dailyStats.pending++;
    }

    this.dailyStats.profit = this.dailyStats.totalReturns - this.dailyStats.totalStaked;

    logger.info('Performance updated', {
      result,
      dailyStats: this.dailyStats,
      performanceHistorySize: this.performanceHistory.length,
    });

    // Reset daily stats if new day
    const today = new Date().toDateString();
    if (this.dailyStats.date !== today) {
      this.resetDailyStats();
    }
  }

  /**
   * Reset daily statistics
   */
  resetDailyStats() {
    logger.info('Resetting daily stats', { previousStats: this.dailyStats });

    this.dailyStats = {
      date: new Date().toDateString(),
      betsPlaced: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStaked: 0,
      totalReturns: 0,
      profit: 0,
    };
  }

  /**
   * Get current statistics
   */
  getStatistics() {
    const totalBets = this.performanceHistory.length;
    const wins = this.performanceHistory.filter(b => b.result === 'win').length;
    const losses = this.performanceHistory.filter(b => b.result === 'loss').length;
    const pending = this.performanceHistory.filter(b => b.result === 'pending').length;

    const totalStaked = this.performanceHistory.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = this.performanceHistory.reduce((sum, b) => sum + b.profit, 0);

    return {
      overall: {
        totalBets,
        wins,
        losses,
        pending,
        winRate: totalBets > 0 ? (wins / (wins + losses)) * 100 : 0,
        totalStaked,
        totalProfit,
        roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
      },
      daily: this.dailyStats,
      currentStreak: {
        type: this.getLosingStreak() > 0 ? 'losing' : 'winning',
        length: Math.abs(this.getLosingStreak()),
      },
    };
  }
}

module.exports = new BettingStrategy();
