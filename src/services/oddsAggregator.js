const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const pinnacleAPI = require('./pinnacleAPI');

class OddsAggregator {
  constructor() {
    this.oddsApiClient = axios.create({
      baseURL: config.oddsApi.baseUrl,
      timeout: 15000,
    });
  }

  /**
   * Get odds from The Odds API for comparison
   */
  async getOddsFromTheOddsAPI(sport = 'upcoming') {
    try {
      if (!config.oddsApi.apiKey) {
        logger.warn('Odds API key not configured, skipping external odds fetch');
        return null;
      }

      const response = await this.oddsApiClient.get(`/sports/${sport}/odds`, {
        params: {
          apiKey: config.oddsApi.apiKey,
          regions: 'us,uk,eu',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'decimal',
        },
      });

      logger.info(`Retrieved odds from The Odds API`, {
        sport,
        eventCount: response.data?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Error fetching odds from The Odds API', {
        error: error.message
      });
      return null;
    }
  }

  /**
   * Aggregate odds from multiple sources
   */
  async aggregateOdds(sportId, leagueIds = [], isLive = false) {
    try {
      logger.info('Aggregating odds from multiple sources', { sportId, isLive });

      // Get Pinnacle odds
      const pinnacleOdds = await pinnacleAPI.getOdds(sportId, leagueIds, 'DECIMAL', isLive);

      // Get comparison odds from external source
      const externalOdds = await this.getOddsFromTheOddsAPI();

      // Combine and structure the data
      const aggregatedData = {
        pinnacle: this.normalizePinnacleOdds(pinnacleOdds),
        external: this.normalizeExternalOdds(externalOdds),
        timestamp: new Date().toISOString(),
      };

      return aggregatedData;
    } catch (error) {
      logger.error('Error aggregating odds', { error: error.message });
      throw error;
    }
  }

  /**
   * Normalize Pinnacle odds to common format
   */
  normalizePinnacleOdds(pinnacleData) {
    if (!pinnacleData || !pinnacleData.leagues) {
      return [];
    }

    const events = [];

    for (const league of pinnacleData.leagues) {
      if (!league.events) continue;

      for (const event of league.events) {
        const normalizedEvent = {
          source: 'pinnacle',
          eventId: event.id,
          leagueId: league.id,
          sportId: event.sportId,
          starts: event.starts,
          home: event.home,
          away: event.away,
          rotNum: event.rotNum,
          liveStatus: event.liveStatus,
          markets: this.extractPinnacleMarkets(event),
        };

        events.push(normalizedEvent);
      }
    }

    return events;
  }

  /**
   * Extract market data from Pinnacle event
   */
  extractPinnacleMarkets(event) {
    const markets = {};

    if (event.periods) {
      for (const period of event.periods) {
        const periodKey = `period_${period.number}`;
        markets[periodKey] = {};

        // Moneyline
        if (period.moneyline) {
          markets[periodKey].moneyline = {
            home: period.moneyline.home,
            away: period.moneyline.away,
            draw: period.moneyline.draw,
            lineId: period.lineId,
          };
        }

        // Spreads
        if (period.spreads) {
          markets[periodKey].spreads = period.spreads.map(spread => ({
            hdp: spread.hdp,
            home: spread.home,
            away: spread.away,
            altLineId: spread.altLineId,
            lineId: period.lineId,
          }));
        }

        // Totals
        if (period.totals) {
          markets[periodKey].totals = period.totals.map(total => ({
            points: total.points,
            over: total.over,
            under: total.under,
            altLineId: total.altLineId,
            lineId: period.lineId,
          }));
        }

        // Team Totals
        if (period.teamTotal) {
          markets[periodKey].teamTotals = {
            home: period.teamTotal.home,
            away: period.teamTotal.away,
            lineId: period.lineId,
          };
        }
      }
    }

    return markets;
  }

  /**
   * Normalize external odds to common format
   */
  normalizeExternalOdds(externalData) {
    if (!externalData || !Array.isArray(externalData)) {
      return [];
    }

    return externalData.map(event => ({
      source: 'external',
      eventId: event.id,
      sport: event.sport_key,
      starts: event.commence_time,
      home: event.home_team,
      away: event.away_team,
      markets: this.extractExternalMarkets(event.bookmakers),
    }));
  }

  /**
   * Extract market data from external bookmaker data
   */
  extractExternalMarkets(bookmakers) {
    if (!bookmakers || !Array.isArray(bookmakers)) {
      return {};
    }

    const markets = {};

    for (const bookmaker of bookmakers) {
      for (const market of bookmaker.markets) {
        if (!markets[market.key]) {
          markets[market.key] = [];
        }

        const outcomes = {};
        for (const outcome of market.outcomes) {
          outcomes[outcome.name.toLowerCase()] = {
            price: outcome.price,
            point: outcome.point,
          };
        }

        markets[market.key].push({
          bookmaker: bookmaker.key,
          outcomes,
        });
      }
    }

    return markets;
  }

  /**
   * Calculate average odds across bookmakers
   */
  calculateAverageOdds(markets, marketType) {
    if (!markets || !markets[marketType]) {
      return null;
    }

    const bookmakerOdds = markets[marketType];
    const avgOdds = {};

    // Collect all odds by outcome
    const oddsByOutcome = {};

    for (const book of bookmakerOdds) {
      for (const [outcome, data] of Object.entries(book.outcomes)) {
        if (!oddsByOutcome[outcome]) {
          oddsByOutcome[outcome] = [];
        }
        oddsByOutcome[outcome].push(data.price);
      }
    }

    // Calculate averages
    for (const [outcome, odds] of Object.entries(oddsByOutcome)) {
      const sum = odds.reduce((a, b) => a + b, 0);
      avgOdds[outcome] = sum / odds.length;
    }

    return avgOdds;
  }

  /**
   * Find value bets by comparing Pinnacle odds with market average
   */
  findValueBets(aggregatedData, minEdgePercentage = 2.0) {
    const valueBets = [];

    if (!aggregatedData.pinnacle || aggregatedData.pinnacle.length === 0) {
      return valueBets;
    }

    for (const pinnacleEvent of aggregatedData.pinnacle) {
      // Find matching external event
      const externalEvent = this.findMatchingExternalEvent(
        pinnacleEvent,
        aggregatedData.external
      );

      if (!externalEvent) continue;

      // Compare markets
      const opportunities = this.compareMarkets(
        pinnacleEvent,
        externalEvent,
        minEdgePercentage
      );

      valueBets.push(...opportunities);
    }

    logger.info(`Found ${valueBets.length} value betting opportunities`);
    return valueBets;
  }

  /**
   * Find matching event in external data
   */
  findMatchingExternalEvent(pinnacleEvent, externalEvents) {
    if (!externalEvents || externalEvents.length === 0) return null;

    // Simple matching by team names and time window
    return externalEvents.find(ext => {
      const homeMatch = this.teamsMatch(pinnacleEvent.home, ext.home);
      const awayMatch = this.teamsMatch(pinnacleEvent.away, ext.away);
      const timeMatch = this.timesMatch(pinnacleEvent.starts, ext.starts);

      return homeMatch && awayMatch && timeMatch;
    });
  }

  /**
   * Check if team names match (fuzzy matching)
   */
  teamsMatch(team1, team2) {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return normalize(team1).includes(normalize(team2)) ||
           normalize(team2).includes(normalize(team1));
  }

  /**
   * Check if event times are close (within 1 hour)
   */
  timesMatch(time1, time2) {
    const date1 = new Date(time1);
    const date2 = new Date(time2);
    const diff = Math.abs(date1 - date2);
    return diff < 3600000; // 1 hour in milliseconds
  }

  /**
   * Compare markets and find value
   */
  compareMarkets(pinnacleEvent, externalEvent, minEdgePercentage) {
    const opportunities = [];

    // Compare moneyline
    const moneylineValue = this.compareMoneyline(
      pinnacleEvent,
      externalEvent,
      minEdgePercentage
    );
    if (moneylineValue) opportunities.push(moneylineValue);

    return opportunities;
  }

  /**
   * Compare moneyline odds
   */
  compareMoneyline(pinnacleEvent, externalEvent, minEdgePercentage) {
    const pinnacleMoneyline = pinnacleEvent.markets?.period_0?.moneyline;
    if (!pinnacleMoneyline) return null;

    const externalMoneyline = this.calculateAverageOdds(
      externalEvent.markets,
      'h2h'
    );
    if (!externalMoneyline) return null;

    // Calculate implied probabilities
    const pinnacleHomeProb = 1 / pinnacleMoneyline.home;
    const pinnacleAwayProb = 1 / pinnacleMoneyline.away;

    const externalHomeProb = 1 / (externalMoneyline[pinnacleEvent.home.toLowerCase()] || 999);
    const externalAwayProb = 1 / (externalMoneyline[pinnacleEvent.away.toLowerCase()] || 999);

    // Calculate edge (value)
    const homeEdge = ((1 / externalHomeProb) - (1 / pinnacleHomeProb)) / (1 / pinnacleHomeProb) * 100;
    const awayEdge = ((1 / externalAwayProb) - (1 / pinnacleAwayProb)) / (1 / pinnacleAwayProb) * 100;

    // Return if edge exceeds minimum threshold
    if (homeEdge >= minEdgePercentage) {
      return {
        eventId: pinnacleEvent.eventId,
        leagueId: pinnacleEvent.leagueId,
        sportId: pinnacleEvent.sportId,
        home: pinnacleEvent.home,
        away: pinnacleEvent.away,
        starts: pinnacleEvent.starts,
        betType: 'MONEYLINE',
        team: 'TEAM1',
        side: 'home',
        pinnacleOdds: pinnacleMoneyline.home,
        marketOdds: externalMoneyline[pinnacleEvent.home.toLowerCase()],
        edge: homeEdge.toFixed(2),
        lineId: pinnacleMoneyline.lineId,
      };
    }

    if (awayEdge >= minEdgePercentage) {
      return {
        eventId: pinnacleEvent.eventId,
        leagueId: pinnacleEvent.leagueId,
        sportId: pinnacleEvent.sportId,
        home: pinnacleEvent.home,
        away: pinnacleEvent.away,
        starts: pinnacleEvent.starts,
        betType: 'MONEYLINE',
        team: 'TEAM2',
        side: 'away',
        pinnacleOdds: pinnacleMoneyline.away,
        marketOdds: externalMoneyline[pinnacleEvent.away.toLowerCase()],
        edge: awayEdge.toFixed(2),
        lineId: pinnacleMoneyline.lineId,
      };
    }

    return null;
  }
}

module.exports = new OddsAggregator();
