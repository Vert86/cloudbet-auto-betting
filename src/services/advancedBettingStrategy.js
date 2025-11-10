const config = require('../config/config');
const logger = require('../utils/logger');
const axios = require('axios');

/**
 * Advanced Betting Strategy with Market Inefficiency Detection
 *
 * Key Principles:
 * 1. Market Efficiency Analysis (timing, liquidity, line movement)
 * 2. Information Asymmetries (news, injuries, motivation, weather)
 * 3. True Edge Calculation (comparing multiple sharp bookmakers)
 * 4. Kelly Criterion with proper probability modeling
 * 5. Closing Line Value (CLV) tracking
 */
class AdvancedBettingStrategy {
  constructor() {
    this.performanceHistory = [];
    this.lineMovementHistory = {}; // Track odds changes over time
    this.closingLines = {}; // Track final odds before event starts
    this.clvHistory = []; // Track Closing Line Value performance

    this.dailyStats = {
      date: new Date().toDateString(),
      betsPlaced: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStaked: 0,
      totalReturns: 0,
      profit: 0,
      avgCLV: 0, // Average Closing Line Value
    };

    // Sharp bookmakers (most accurate odds)
    this.sharpBookmakers = ['pinnacle', 'bookmaker', 'betcris', 'circa'];

    // Soft bookmakers (slower to adjust, targets for value)
    this.softBookmakers = ['cloudbet', 'bovada', 'betonline', 'mybookie'];

    // Tier 1 leagues (highest liquidity, most efficient markets)
    this.tier1Leagues = {
      soccer: ['premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'champions-league'],
      basketball: ['nba'],
      'american-football': ['nfl'],
      tennis: ['atp-singles', 'wta-singles'],
    };

    // Markets to focus on (highest liquidity)
    this.premiumMarkets = ['moneyline', 'match_odds', 'spreads', 'h2h'];

    // Minimum number of bookmakers needed for comparison
    this.minBookmakersForComparison = 5;
  }

  /**
   * FACTOR 1: Market Efficiency Analysis
   * Analyze if this is the right time and market to bet on
   */
  async analyzeMarketEfficiency(opportunity) {
    const efficiency = {
      score: 0,
      reasons: [],
      timeToEvent: null,
      liquidity: null,
      marketTier: null,
    };

    // 1A. Time to Event (Closing Line Value optimization)
    const now = new Date();
    const eventStart = new Date(opportunity.starts);
    const hoursUntilEvent = (eventStart - now) / (1000 * 60 * 60);

    efficiency.timeToEvent = hoursUntilEvent;

    if (hoursUntilEvent < 1) {
      // Less than 1 hour: Lines are sharpest, but also move fastest
      efficiency.score += 30;
      efficiency.reasons.push('Close to event start - line is sharp');
    } else if (hoursUntilEvent < 6) {
      // 1-6 hours: Good balance of accuracy and time to place bet
      efficiency.score += 25;
      efficiency.reasons.push('Within 6 hours - good timing window');
    } else if (hoursUntilEvent < 24) {
      // 6-24 hours: Lines are reasonably accurate
      efficiency.score += 15;
      efficiency.reasons.push('Within 24 hours - acceptable timing');
    } else {
      // More than 24 hours: Lines are soft, but high variance
      efficiency.score += 5;
      efficiency.reasons.push('More than 24 hours out - line may be soft');
    }

    // 1B. League/Competition Tier (liquidity proxy)
    const sport = opportunity.sport || this.detectSport(opportunity);
    const league = opportunity.league || this.detectLeague(opportunity);

    if (this.tier1Leagues[sport]?.some(tier1 => league?.toLowerCase().includes(tier1))) {
      efficiency.liquidity = 'high';
      efficiency.marketTier = 'tier1';
      efficiency.score += 30;
      efficiency.reasons.push(`Tier 1 league (${league}) - high liquidity`);
    } else {
      efficiency.liquidity = 'low';
      efficiency.marketTier = 'tier2+';
      efficiency.score += 5;
      efficiency.reasons.push(`Lower tier league - reduced liquidity`);
    }

    // 1C. Market Type (main markets vs exotic)
    if (this.premiumMarkets.includes(opportunity.marketType)) {
      efficiency.score += 20;
      efficiency.reasons.push(`Premium market type (${opportunity.marketType})`);
    } else {
      efficiency.score += 5;
      efficiency.reasons.push(`Exotic market - lower liquidity`);
    }

    logger.info('Market efficiency analysis', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      score: efficiency.score,
      timeToEvent: hoursUntilEvent.toFixed(1),
      tier: efficiency.marketTier,
      reasons: efficiency.reasons,
    });

    return efficiency;
  }

  /**
   * FACTOR 2: Information Asymmetry Detection
   * Check for recent news, injuries, or contextual factors
   */
  async detectInformationAsymmetries(opportunity) {
    const asymmetries = {
      detected: false,
      factors: [],
      adjustmentFactor: 1.0, // Multiplier for probability adjustment
    };

    // 2A. Line Movement Analysis (sharp money vs public money)
    const lineMovement = this.analyzeLineMovement(opportunity);
    if (lineMovement.sharpMoneyDetected) {
      asymmetries.detected = true;
      asymmetries.factors.push('Sharp money movement detected');
      asymmetries.adjustmentFactor *= lineMovement.confidence;
    }

    // 2B. Reverse Line Movement (line moves opposite to betting percentage)
    if (lineMovement.reverseMovement) {
      asymmetries.detected = true;
      asymmetries.factors.push('Reverse line movement - sharp action');
      asymmetries.adjustmentFactor *= 1.15; // Boost probability by 15%
    }

    // 2C. Steam Move (rapid line movement across multiple books)
    if (lineMovement.steamMove) {
      asymmetries.detected = true;
      asymmetries.factors.push('Steam move detected - urgent information');
      asymmetries.adjustmentFactor *= 1.20; // Boost probability by 20%
    }

    // Note: Weather, injuries, motivation would require external APIs
    // These should be integrated via:
    // - Sports data APIs (ESPN, TheScore, etc.)
    // - Weather APIs (OpenWeatherMap)
    // - Team news feeds

    logger.info('Information asymmetry detection', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      detected: asymmetries.detected,
      factors: asymmetries.factors,
      adjustmentFactor: asymmetries.adjustmentFactor,
    });

    return asymmetries;
  }

  /**
   * FACTOR 3: Line Movement Tracking
   * Track how odds have changed over time
   */
  analyzeLineMovement(opportunity) {
    const eventKey = `${opportunity.eventId}_${opportunity.side}`;
    const currentOdds = opportunity.cloudbetOdds;

    // Initialize tracking for this event
    if (!this.lineMovementHistory[eventKey]) {
      this.lineMovementHistory[eventKey] = {
        initialOdds: currentOdds,
        history: [{ timestamp: Date.now(), odds: currentOdds }],
      };
      return { sharpMoneyDetected: false, reverseMovement: false, steamMove: false };
    }

    // Add current observation
    const history = this.lineMovementHistory[eventKey];
    history.history.push({ timestamp: Date.now(), odds: currentOdds });

    // Analyze movement
    const initialOdds = history.initialOdds;
    const movementPercent = ((currentOdds - initialOdds) / initialOdds) * 100;

    // Sharp money: odds moving in favor of underdog (odds decreasing)
    const sharpMoneyDetected = movementPercent < -5; // 5% movement

    // Steam move: rapid movement in short time
    const recentHistory = history.history.slice(-3);
    const steamMove = recentHistory.length >= 3 &&
      Math.abs(recentHistory[0].odds - recentHistory[2].odds) > 0.5;

    // Reverse movement: would need public betting percentage data
    const reverseMovement = false; // Placeholder

    logger.info('Line movement analysis', {
      eventKey,
      initialOdds,
      currentOdds,
      movementPercent: movementPercent.toFixed(2),
      sharpMoneyDetected,
      steamMove,
    });

    return {
      sharpMoneyDetected,
      reverseMovement,
      steamMove,
      confidence: sharpMoneyDetected ? 1.10 : 1.00,
    };
  }

  /**
   * FACTOR 4: Calculate True Probability with Sharp Bookmaker Consensus
   * Use multiple sharp books to establish "true" market probability
   */
  calculateTrueProbabilityFromSharpBooks(allBookmakerOdds, side) {
    if (!allBookmakerOdds || allBookmakerOdds.length < this.minBookmakersForComparison) {
      logger.warn('Insufficient bookmakers for probability calculation', {
        count: allBookmakerOdds?.length,
        required: this.minBookmakersForComparison,
      });
      return null;
    }

    // Extract odds for the specific side from all bookmakers
    const oddsForSide = allBookmakerOdds
      .map(book => book.odds[side])
      .filter(odds => odds && odds > 0);

    if (oddsForSide.length < 3) {
      return null;
    }

    // Method 1: Use only sharp bookmakers if available
    const sharpOdds = allBookmakerOdds
      .filter(book => this.sharpBookmakers.includes(book.bookmaker.toLowerCase()))
      .map(book => book.odds[side])
      .filter(odds => odds && odds > 0);

    const oddsToUse = sharpOdds.length >= 2 ? sharpOdds : oddsForSide;

    // Calculate consensus (average) odds
    const avgOdds = oddsToUse.reduce((sum, odds) => sum + odds, 0) / oddsToUse.length;

    // Convert to implied probability
    const impliedProb = 1 / avgOdds;

    // Calculate market overround (margin)
    const allSidesImpliedProbs = ['home', 'away', 'draw']
      .map(s => {
        const sideOdds = allBookmakerOdds
          .map(book => book.odds[s])
          .filter(odds => odds && odds > 0);
        if (sideOdds.length === 0) return 0;
        const avgSideOdds = sideOdds.reduce((sum, odds) => sum + odds, 0) / sideOdds.length;
        return 1 / avgSideOdds;
      })
      .filter(prob => prob > 0);

    const overround = allSidesImpliedProbs.reduce((sum, prob) => sum + prob, 0);

    // Remove margin to get true probability
    const trueProbability = impliedProb / overround;

    logger.info('True probability calculation', {
      side,
      bookmakerCount: oddsForSide.length,
      sharpBookCount: sharpOdds.length,
      avgOdds: avgOdds.toFixed(2),
      impliedProb: (impliedProb * 100).toFixed(2) + '%',
      overround: overround.toFixed(4),
      trueProbability: (trueProbability * 100).toFixed(2) + '%',
    });

    return {
      trueProbability,
      avgMarketOdds: avgOdds,
      overround,
      bookmakerCount: oddsForSide.length,
      usedSharpBooks: sharpOdds.length >= 2,
    };
  }

  /**
   * FACTOR 5: Calculate Real Edge
   * Compare Cloudbet odds to sharp market consensus
   */
  calculateRealEdge(cloudbetOdds, trueProbabilityData, informationAsymmetry) {
    if (!trueProbabilityData || !trueProbabilityData.trueProbability) {
      return null;
    }

    // Adjust true probability based on information asymmetry
    let adjustedTrueProbability = trueProbabilityData.trueProbability;
    if (informationAsymmetry && informationAsymmetry.detected) {
      adjustedTrueProbability *= informationAsymmetry.adjustmentFactor;
      // Cap at reasonable values
      adjustedTrueProbability = Math.min(adjustedTrueProbability, 0.95);
    }

    // Cloudbet's implied probability
    const cloudbetImpliedProb = 1 / cloudbetOdds;

    // Real edge = true probability - implied probability
    const edge = adjustedTrueProbability - cloudbetImpliedProb;
    const edgePercentage = edge * 100;

    // Expected value per unit bet
    const expectedValue = (adjustedTrueProbability * cloudbetOdds) - 1;

    logger.info('Real edge calculation', {
      cloudbetOdds,
      cloudbetImpliedProb: (cloudbetImpliedProb * 100).toFixed(2) + '%',
      trueProbability: (trueProbabilityData.trueProbability * 100).toFixed(2) + '%',
      adjustedTrueProbability: (adjustedTrueProbability * 100).toFixed(2) + '%',
      edge: edgePercentage.toFixed(2) + '%',
      expectedValue: (expectedValue * 100).toFixed(2) + '%',
      usedSharpBooks: trueProbabilityData.usedSharpBooks,
    });

    return {
      edge: edgePercentage,
      trueProbability: adjustedTrueProbability,
      expectedValue: expectedValue * 100,
      marketQuality: trueProbabilityData.usedSharpBooks ? 'sharp' : 'soft',
    };
  }

  /**
   * FACTOR 6: Kelly Criterion with True Probability
   */
  calculateOptimalStake(bankroll, odds, trueProbability, edgePercentage) {
    // Kelly Formula: f = (bp - q) / b
    const b = odds - 1;
    const p = trueProbability;
    const q = 1 - p;

    const fullKelly = (b * p - q) / b;

    // Must be positive to bet
    if (fullKelly <= 0) {
      logger.info('Kelly criterion negative - no bet', { fullKelly });
      return 0;
    }

    // Use fractional Kelly for safety
    const kellyFraction = config.riskManagement.kellyFraction || 0.25;
    const fractionalKelly = fullKelly * kellyFraction;

    // Calculate stake
    let stake = bankroll * fractionalKelly;

    // Apply limits
    const maxStake = Math.min(
      config.betting.maxBetAmount,
      bankroll * (config.riskManagement.bankrollPercentagePerBet / 100)
    );
    stake = Math.min(stake, maxStake);

    // Minimum stake
    stake = Math.max(stake, config.betting.minBetAmount);

    // Round to 2 decimals
    stake = Math.round(stake * 100) / 100;

    logger.info('Optimal stake calculation', {
      fullKelly: (fullKelly * 100).toFixed(2) + '%',
      fractionalKelly: (fractionalKelly * 100).toFixed(2) + '%',
      stake,
      bankroll,
      edge: edgePercentage.toFixed(2) + '%',
    });

    return stake;
  }

  /**
   * Main evaluation function with all factors integrated
   */
  async evaluateBet(opportunity, bankroll, currentExposure) {
    logger.info('=== ADVANCED BET EVALUATION START ===', {
      event: `${opportunity.home} vs ${opportunity.away}`,
      market: opportunity.marketType,
      side: opportunity.side,
      cloudbetOdds: opportunity.cloudbetOdds,
    });

    // Check daily limits
    if (this.dailyStats.betsPlaced >= config.riskManagement.maxBetsPerDay) {
      logger.info('Daily bet limit reached');
      return null;
    }

    if (this.dailyStats.profit < -config.betting.maxDailyLoss) {
      logger.info('Daily loss limit reached');
      return null;
    }

    // STEP 1: Analyze Market Efficiency
    const efficiency = await this.analyzeMarketEfficiency(opportunity);
    const minEfficiencyScore = parseInt(process.env.MIN_EFFICIENCY_SCORE) || 50;
    if (efficiency.score < minEfficiencyScore) {
      logger.info('Market efficiency score too low', { score: efficiency.score, required: minEfficiencyScore });
      return null;
    }

    // STEP 2: Detect Information Asymmetries
    const asymmetries = await this.detectInformationAsymmetries(opportunity);

    // STEP 3: Check if we have enough bookmaker data
    if (!opportunity.allBookmakerOdds || opportunity.allBookmakerOdds.length < this.minBookmakersForComparison) {
      logger.info('Insufficient bookmaker comparison data', {
        count: opportunity.allBookmakerOdds?.length,
        required: this.minBookmakersForComparison,
      });
      return null;
    }

    // STEP 4: Calculate True Probability from Sharp Books
    const trueProbData = this.calculateTrueProbabilityFromSharpBooks(
      opportunity.allBookmakerOdds,
      opportunity.side
    );

    if (!trueProbData) {
      logger.info('Could not calculate true probability');
      return null;
    }

    // STEP 5: Calculate Real Edge
    const edgeData = this.calculateRealEdge(
      opportunity.cloudbetOdds,
      trueProbData,
      asymmetries
    );

    if (!edgeData || edgeData.edge < config.riskManagement.minEdgePercentage) {
      logger.info('Edge below minimum threshold', {
        edge: edgeData?.edge,
        threshold: config.riskManagement.minEdgePercentage,
      });
      return null;
    }

    // STEP 6: Calculate Optimal Stake (Kelly)
    const stake = this.calculateOptimalStake(
      bankroll,
      opportunity.cloudbetOdds,
      edgeData.trueProbability,
      edgeData.edge
    );

    if (stake === 0) {
      return null;
    }

    // Check exposure limit
    if (currentExposure + stake > config.betting.maxTotalExposure) {
      logger.info('Total exposure limit would be exceeded');
      return null;
    }

    // STEP 7: Calculate Expected Value
    const expectedValue = edgeData.trueProbability * opportunity.cloudbetOdds * stake - stake;

    logger.info('✅ BET APPROVED', {
      edge: edgeData.edge.toFixed(2) + '%',
      trueProbability: (edgeData.trueProbability * 100).toFixed(2) + '%',
      stake,
      expectedValue: expectedValue.toFixed(2),
      marketQuality: edgeData.marketQuality,
      efficiencyScore: efficiency.score,
      informationEdge: asymmetries.detected,
    });

    logger.info('=== ADVANCED BET EVALUATION END ===');

    return {
      ...opportunity,
      betSize: stake,
      edge: edgeData.edge,
      trueProbability: edgeData.trueProbability,
      expectedValue,
      marketQuality: edgeData.marketQuality,
      efficiencyScore: efficiency.score,
      informationAsymmetry: asymmetries,
    };
  }

  /**
   * Track Closing Line Value (CLV) after event starts
   */
  async trackClosingLineValue(bet, closingOdds) {
    const clv = ((closingOdds - bet.odds) / bet.odds) * 100;

    this.clvHistory.push({
      betId: bet.betId,
      placedOdds: bet.odds,
      closingOdds,
      clv,
      timestamp: new Date().toISOString(),
    });

    // Update average CLV
    const avgCLV = this.clvHistory.reduce((sum, record) => sum + record.clv, 0) / this.clvHistory.length;
    this.dailyStats.avgCLV = avgCLV;

    logger.info('Closing Line Value tracked', {
      betId: bet.betId,
      placedOdds: bet.odds,
      closingOdds,
      clv: clv.toFixed(2) + '%',
      avgCLV: avgCLV.toFixed(2) + '%',
    });

    return clv;
  }

  /**
   * Helper: Detect sport from event data
   */
  detectSport(opportunity) {
    const eventKey = opportunity.eventKey?.toLowerCase() || '';
    if (eventKey.includes('nfl') || eventKey.includes('football')) return 'american-football';
    if (eventKey.includes('nba') || eventKey.includes('basketball')) return 'basketball';
    if (eventKey.includes('soccer') || eventKey.includes('premier') || eventKey.includes('liga')) return 'soccer';
    if (eventKey.includes('tennis') || eventKey.includes('atp') || eventKey.includes('wta')) return 'tennis';
    return 'unknown';
  }

  /**
   * Helper: Detect league from event data
   */
  detectLeague(opportunity) {
    const eventKey = opportunity.eventKey?.toLowerCase() || '';
    if (eventKey.includes('premier')) return 'premier-league';
    if (eventKey.includes('la-liga') || eventKey.includes('laliga')) return 'la-liga';
    if (eventKey.includes('bundesliga')) return 'bundesliga';
    if (eventKey.includes('serie-a')) return 'serie-a';
    if (eventKey.includes('ligue-1')) return 'ligue-1';
    if (eventKey.includes('champions')) return 'champions-league';
    if (eventKey.includes('nfl')) return 'nfl';
    if (eventKey.includes('nba')) return 'nba';
    return 'unknown';
  }

  /**
   * Update performance (including CLV tracking)
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
      trueProbability: bet.trueProbability,
      clv: bet.clv || null,
    });

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
    this.dailyStats = {
      date: new Date().toDateString(),
      betsPlaced: 0,
      wins: 0,
      losses: 0,
      pending: 0,
      totalStaked: 0,
      totalReturns: 0,
      profit: 0,
      avgCLV: 0,
    };
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const totalBets = this.performanceHistory.length;
    const wins = this.performanceHistory.filter(b => b.result === 'win').length;
    const losses = this.performanceHistory.filter(b => b.result === 'loss').length;
    const totalStaked = this.performanceHistory.reduce((sum, b) => sum + b.stake, 0);
    const totalProfit = this.performanceHistory.reduce((sum, b) => sum + b.profit, 0);

    // Calculate average CLV
    const betsWithCLV = this.performanceHistory.filter(b => b.clv !== null);
    const avgCLV = betsWithCLV.length > 0
      ? betsWithCLV.reduce((sum, b) => sum + b.clv, 0) / betsWithCLV.length
      : 0;

    return {
      overall: {
        totalBets,
        wins,
        losses,
        winRate: totalBets > 0 ? (wins / (wins + losses)) * 100 : 0,
        totalStaked,
        totalProfit,
        roi: totalStaked > 0 ? (totalProfit / totalStaked) * 100 : 0,
        avgCLV: avgCLV.toFixed(2) + '%',
      },
      daily: this.dailyStats,
    };
  }
}

module.exports = new AdvancedBettingStrategy();
