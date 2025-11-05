const config = require('../config/config');
const logger = require('../utils/logger');

/**
 * Improved Betting Strategy implementing proper +EV betting
 * Based on the 3-pillar framework:
 * 1. Focus on Positive Expected Value (+EV)
 * 2. Disciplined Bankroll Management (Kelly Criterion)
 * 3. Selection and Execution Filters
 */
class ImprovedBettingStrategy {
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

    // Liquid markets configuration
    this.liquidSports = ['soccer', 'basketball', 'tennis', 'american-football'];
    this.liquidLeagues = {
      soccer: ['premier-league', 'la-liga', 'serie-a', 'bundesliga', 'ligue-1', 'champions-league', 'europa-league'],
      basketball: ['nba', 'euroleague'],
      tennis: ['atp', 'wta'],
      'american-football': ['nfl']
    };
    this.liquidMarkets = ['match_odds', 'moneyline', 'spreads', 'totals', 'h2h'];

    // Reject these markets (too much variance/low liquidity)
    this.rejectedMarkets = [
      'match_odds_period_first_half',
      'winner_of_set',
      'correct_score',
      'first_goalscorer',
      'half_time_full_time'
    ];
  }

  /**
   * PILLAR 1: Calculate TRUE probability from market consensus
   * This removes bookmaker margin to get fair odds
   */
  calculateTrueProbability(allOddsForOutcome) {
    if (!allOddsForOutcome || allOddsForOutcome.length === 0) {
      return null;
    }

    // Method 1: Average of all bookmaker odds (wisdom of the crowd)
    const avgOdds = allOddsForOutcome.reduce((sum, odds) => sum + odds, 0) / allOddsForOutcome.length;
    const impliedProb = 1 / avgOdds;

    return impliedProb;
  }

  /**
   * Calculate bookmaker margin (overround) from all odds in a market
   */
  calculateBookmakerMargin(allOddsInMarket) {
    // allOddsInMarket = { home: [odds1, odds2, ...], away: [...], draw: [...] }

    const avgOddsByOutcome = {};
    let sumImpliedProbs = 0;

    for (const [outcome, oddsList] of Object.entries(allOddsInMarket)) {
      const avgOdds = oddsList.reduce((sum, odds) => sum + odds, 0) / oddsList.length;
      avgOddsByOutcome[outcome] = avgOdds;
      sumImpliedProbs += (1 / avgOdds);
    }

    // Margin = (sum of implied probs) - 1.0
    // Example: 0.45 + 0.30 + 0.30 = 1.05 → margin = 5%
    const margin = Math.max(0, sumImpliedProbs - 1.0);

    return {
      margin,
      avgOddsByOutcome,
      sumImpliedProbs
    };
  }

  /**
   * Remove bookmaker margin to get true probability
   */
  removeMargine(impliedProb, totalOverround) {
    // Adjust implied probability by removing margin
    return impliedProb / totalOverround;
  }

  /**
   * Calculate REAL edge (not fake pseudo-edge)
   * Edge = True Probability - Implied Probability (adjusted for margin)
   */
  calculateRealEdge(cloudbetOdds, marketConsensusOdds, allOddsInMarket) {
    // Get market margin
    const marginData = this.calculateBookmakerMargin(allOddsInMarket);

    if (!marginData || marginData.margin > 0.10) {
      // Margin too high (>10%), reject market
      logger.info('Market margin too high', { margin: marginData.margin });
      return null;
    }

    // Calculate true probability from market consensus (removing margin)
    const impliedProb = 1 / marketConsensusOdds;
    const trueProbability = this.removeMargin(impliedProb, marginData.sumImpliedProbs);

    // Calculate Cloudbet's implied probability
    const cloudbetImpliedProb = 1 / cloudbetOdds;

    // Edge = true probability - cloudbet implied probability
    const edge = trueProbability - cloudbetImpliedProb;
    const edgePercentage = edge * 100;

    logger.info('Edge calculation', {
      cloudbetOdds,
      marketConsensusOdds,
      trueProbability: trueProbability.toFixed(4),
      cloudbetImpliedProb: cloudbetImpliedProb.toFixed(4),
      edge: edgePercentage.toFixed(2) + '%'
    });

    return {
      edge: edgePercentage,
      trueProbability,
      cloudbetImpliedProb,
      marketMargin: marginData.margin
    };
  }

  /**
   * PILLAR 2: Calculate optimal bet size using Kelly Criterion
   * Uses TRUE probability, not implied probability
   */
  calculateKellyBetSize(bankroll, odds, trueProbability) {
    // Kelly Formula: f* = (bp - q) / b
    // where:
    // f* = fraction of bankroll to bet
    // b = decimal odds - 1
    // p = TRUE probability of winning (from model)
    // q = probability of losing (1 - p)

    const b = odds - 1;
    const p = trueProbability; // ✅ Using TRUE probability!
    const q = 1 - p;

    // Full Kelly fraction
    const kellyFraction = (b * p - q) / b;

    // Kelly must be positive (only bet when edge exists)
    if (kellyFraction <= 0) {
      logger.info('Kelly criterion negative, no edge', {
        kellyFraction,
        trueProbability,
        odds
      });
      return 0;
    }

    // Apply fractional Kelly for safety (reduce variance)
    // Using 1/4 Kelly is recommended for most bettors
    const fractionalKelly = config.riskManagement.kellyFraction || 0.25;
    const adjustedKelly = kellyFraction * fractionalKelly;

    // Calculate bet size
    let betSize = bankroll * adjustedKelly;

    // Apply maximum limits
    betSize = Math.min(betSize, config.betting.maxBetAmount);

    // Also limit by bankroll percentage (safety cap)
    const maxByPercentage = bankroll * (config.riskManagement.bankrollPercentagePerBet / 100);
    betSize = Math.min(betSize, maxByPercentage);

    // Round to 2 decimals
    betSize = Math.round(betSize * 100) / 100;

    // Ensure minimum bet size
    betSize = Math.max(betSize, config.betting.minBetAmount);

    logger.info('Kelly bet sizing', {
      fullKelly: kellyFraction.toFixed(4),
      fractionalKelly: fractionalKelly,
      adjustedKelly: adjustedKelly.toFixed(4),
      betSize: betSize,
      bankroll: bankroll
    });

    return betSize;
  }

  /**
   * PILLAR 3: Filter for liquid markets only
   */
  isLiquidMarket(sportKey, leagueKey, marketType) {
    // Check sport
    if (!this.liquidSports.includes(sportKey)) {
      logger.info('Sport not in liquid list', { sportKey });
      return false;
    }

    // Check league (if available)
    if (leagueKey && this.liquidLeagues[sportKey]) {
      const isLiquidLeague = this.liquidLeagues[sportKey].some(league =>
        leagueKey.toLowerCase().includes(league)
      );
      if (!isLiquidLeague) {
        logger.info('League not in liquid list', { leagueKey, sportKey });
        return false;
      }
    }

    // Check market type
    if (!this.liquidMarkets.includes(marketType)) {
      logger.info('Market type not in liquid list', { marketType });
      return false;
    }

    // Reject specific markets
    if (this.rejectedMarkets.includes(marketType)) {
      logger.info('Market type in rejection list', { marketType });
      return false;
    }

    return true;
  }

  /**
   * PILLAR 3: Filter by maximum odds (avoid extreme longshots)
   */
  isWithinOddsRange(odds) {
    const minOdds = config.betting.minOdds || 1.80;
    const maxOdds = config.betting.maxOdds || 4.00; // Reduced from 5.0!

    if (odds < minOdds || odds > maxOdds) {
      logger.info('Odds outside acceptable range', {
        odds,
        minOdds,
        maxOdds
      });
      return false;
    }

    return true;
  }

  /**
   * Main evaluation function with proper +EV logic
   */
  async evaluateBet(opportunity, bankroll, currentExposure) {
    logger.info('Evaluating betting opportunity with improved strategy', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      market: opportunity.marketType,
      odds: opportunity.cloudbetOdds,
    });

    // Check daily limits
    if (this.dailyStats.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      logger.info('Daily bet limit reached');
      return null;
    }

    // Check daily loss limit
    if (this.dailyStats.profit < -config.betting.maxDailyLoss) {
      logger.info('Daily loss limit reached');
      return null;
    }

    // PILLAR 3: Filter for liquid markets
    if (!this.isLiquidMarket(opportunity.sport, opportunity.league, opportunity.marketType)) {
      return null;
    }

    // PILLAR 3: Filter by odds range
    if (!this.isWithinOddsRange(opportunity.cloudbetOdds)) {
      return null;
    }

    // PILLAR 1: Calculate REAL edge
    // Requires market consensus odds from multiple bookmakers
    if (!opportunity.marketConsensusOdds || !opportunity.allOddsInMarket) {
      logger.info('Insufficient market data for edge calculation, rejecting bet');
      return null;
    }

    const edgeData = this.calculateRealEdge(
      opportunity.cloudbetOdds,
      opportunity.marketConsensusOdds,
      opportunity.allOddsInMarket
    );

    if (!edgeData || edgeData.edge < config.riskManagement.minEdgePercentage) {
      logger.info('Edge below minimum threshold', {
        edge: edgeData?.edge,
        threshold: config.riskManagement.minEdgePercentage
      });
      return null;
    }

    // PILLAR 2: Calculate bet size using Kelly with TRUE probability
    const betSize = this.calculateKellyBetSize(
      bankroll,
      opportunity.cloudbetOdds,
      edgeData.trueProbability
    );

    if (betSize === 0) {
      return null;
    }

    // Check total exposure
    if (currentExposure + betSize > config.betting.maxTotalExposure) {
      logger.info('Total exposure limit would be exceeded');
      return null;
    }

    // Calculate expected value
    const expectedValue = (edgeData.trueProbability * opportunity.cloudbetOdds * betSize) - betSize;

    logger.info('✅ Bet approved with positive EV', {
      edge: edgeData.edge.toFixed(2) + '%',
      betSize: betSize,
      expectedValue: expectedValue.toFixed(2),
      trueProbability: (edgeData.trueProbability * 100).toFixed(2) + '%'
    });

    return {
      ...opportunity,
      betSize: betSize,
      edge: edgeData.edge,
      trueProbability: edgeData.trueProbability,
      expectedValue: expectedValue,
      marketMargin: edgeData.marketMargin,
    };
  }

  /**
   * Update performance history (same as before)
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
      edge: bet.edge,
      trueProbability: bet.trueProbability
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

    const totalStaked = this.performanceHistory.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = this.performanceHistory.reduce((sum, b) => sum + b.profit, 0);

    return {
      overall: {
        totalBets,
        wins,
        losses,
        winRate: totalBets > 0 ? (wins / (wins + losses)) * 100 : 0,
        totalStaked,
        totalProfit,
        roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
      },
      daily: this.dailyStats,
    };
  }
}

module.exports = new ImprovedBettingStrategy();
