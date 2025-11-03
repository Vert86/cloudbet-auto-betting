const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const cloudbetAPI = require('./cloudbetAPI');

class CloudbetOddsAggregator {
  constructor() {
    this.oddsApiClient = axios.create({
      baseURL: config.oddsApi.baseUrl,
      timeout: 15000,
    });

    // Map Cloudbet sport keys to The Odds API sport keys
    this.sportMapping = {
      'soccer': 'soccer_epl',
      'basketball': 'basketball_nba',
      'tennis': 'tennis_atp',
      'american-football': 'americanfootball_nfl',
      'baseball': 'baseball_mlb',
      'ice-hockey': 'icehockey_nhl',
    };
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
   * Aggregate odds from Cloudbet and external sources
   */
  async aggregateOdds(sportKey) {
    try {
      logger.info('Aggregating odds from multiple sources', { sportKey });

      // Get Cloudbet odds
      const cloudbetOdds = await cloudbetAPI.getSportEvents(sportKey);

      // Get comparison odds from external source (if available)
      const mappedSport = this.sportMapping[sportKey];
      const externalOdds = mappedSport ?
        await this.getOddsFromTheOddsAPI(mappedSport) : null;

      // Combine and structure the data
      const aggregatedData = {
        cloudbet: this.normalizeCloudbetOdds(cloudbetOdds),
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
   * Normalize Cloudbet odds to common format
   */
  normalizeCloudbetOdds(cloudbetData) {
    if (!cloudbetData || !cloudbetData.events) {
      return [];
    }

    const events = [];

    for (const event of cloudbetData.events) {
      const normalizedEvent = {
        source: 'cloudbet',
        eventId: event.id,
        eventKey: event.key,
        home: event.home?.name || 'Unknown',
        away: event.away?.name || 'Unknown',
        starts: event.cutoffTime || event.startTime,
        status: event.status,
        markets: this.extractCloudbetMarkets(event),
      };

      events.push(normalizedEvent);
    }

    return events;
  }

  /**
   * Extract market data from Cloudbet event
   */
  extractCloudbetMarkets(event) {
    const markets = {};

    if (!event.markets) return markets;

    for (const market of event.markets) {
      const marketKey = market.key;

      if (!markets[marketKey]) {
        markets[marketKey] = {
          marketUrl: market.url,
          marketKey: market.key,
          marketName: market.name,
          selections: []
        };
      }

      // Extract selections (betting options)
      if (market.selections) {
        for (const selection of market.selections) {
          markets[marketKey].selections.push({
            selectionKey: selection.key,
            name: selection.name,
            price: selection.price,
            url: selection.url,
            params: selection.params,
            side: selection.side
          });
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
   * Find value bets by comparing Cloudbet odds with market average
   */
  findValueBets(aggregatedData, minEdgePercentage = 2.0) {
    const valueBets = [];

    if (!aggregatedData.cloudbet || aggregatedData.cloudbet.length === 0) {
      return valueBets;
    }

    for (const cloudbetEvent of aggregatedData.cloudbet) {
      // Skip live events for now
      if (cloudbetEvent.status === 'TRADING_LIVE') {
        continue;
      }

      // Find matching external event
      const externalEvent = this.findMatchingExternalEvent(
        cloudbetEvent,
        aggregatedData.external
      );

      if (!externalEvent) {
        // Even without external comparison, we can look for opportunities
        // based on Cloudbet's own market inefficiencies
        const internalOpportunities = this.findInternalOpportunities(
          cloudbetEvent,
          minEdgePercentage
        );
        valueBets.push(...internalOpportunities);
        continue;
      }

      // Compare markets
      const opportunities = this.compareMarkets(
        cloudbetEvent,
        externalEvent,
        minEdgePercentage
      );

      valueBets.push(...opportunities);
    }

    logger.info(`Found ${valueBets.length} value betting opportunities`);
    return valueBets;
  }

  /**
   * Find opportunities within Cloudbet's own markets
   */
  findInternalOpportunities(cloudbetEvent, minEdgePercentage) {
    const opportunities = [];

    // Look for moneyline (h2h) markets
    const h2hMarket = Object.values(cloudbetEvent.markets).find(
      m => m.marketKey === 'soccer.match_odds' ||
           m.marketKey === 'basketball.match_odds' ||
           m.marketKey.includes('match_odds') ||
           m.marketKey.includes('moneyline')
    );

    if (h2hMarket && h2hMarket.selections && h2hMarket.selections.length >= 2) {
      // Check if odds represent value based on implied probabilities
      const homeSelection = h2hMarket.selections.find(s => s.side === 'home');
      const awaySelection = h2hMarket.selections.find(s => s.side === 'away');

      if (homeSelection && awaySelection) {
        const homeProb = 1 / homeSelection.price;
        const awayProb = 1 / awaySelection.price;
        const totalProb = homeProb + awayProb;

        // If total probability is less than 1, there might be value
        // (though typically bookmaker margin makes this rare)
        const margin = totalProb - 1;

        if (margin < 0.05 && margin > -0.02) { // Low margin, potential value
          // Create opportunity for the higher implied value
          if (homeProb < 0.5) {
            opportunities.push(this.createOpportunity(
              cloudbetEvent,
              h2hMarket,
              homeSelection,
              'home',
              minEdgePercentage / 2 // Lower threshold for internal
            ));
          }
        }
      }
    }

    return opportunities.filter(o => o !== null);
  }

  /**
   * Create opportunity object
   */
  createOpportunity(event, market, selection, side, edge) {
    if (!selection) return null;

    return {
      eventId: event.eventId,
      eventKey: event.eventKey,
      home: event.home,
      away: event.away,
      starts: event.starts,
      marketUrl: market.marketUrl,
      marketKey: market.marketKey,
      marketName: market.marketName,
      selectionKey: selection.selectionKey,
      selectionName: selection.name,
      side: side,
      cloudbetOdds: selection.price,
      edge: edge.toFixed(2),
      price: selection.price,
    };
  }

  /**
   * Find matching event in external data
   */
  findMatchingExternalEvent(cloudbetEvent, externalEvents) {
    if (!externalEvents || externalEvents.length === 0) return null;

    return externalEvents.find(ext => {
      const homeMatch = this.teamsMatch(cloudbetEvent.home, ext.home);
      const awayMatch = this.teamsMatch(cloudbetEvent.away, ext.away);
      const timeMatch = this.timesMatch(cloudbetEvent.starts, ext.starts);

      return homeMatch && awayMatch && timeMatch;
    });
  }

  /**
   * Check if team names match (fuzzy matching)
   */
  teamsMatch(team1, team2) {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    const norm1 = normalize(team1);
    const norm2 = normalize(team2);

    return norm1.includes(norm2) || norm2.includes(norm1);
  }

  /**
   * Check if event times are close (within 2 hours)
   */
  timesMatch(time1, time2) {
    const date1 = new Date(time1);
    const date2 = new Date(time2);
    const diff = Math.abs(date1 - date2);
    return diff < 7200000; // 2 hours in milliseconds
  }

  /**
   * Compare markets and find value
   */
  compareMarkets(cloudbetEvent, externalEvent, minEdgePercentage) {
    const opportunities = [];

    // Compare h2h/moneyline
    const h2hValue = this.compareH2H(
      cloudbetEvent,
      externalEvent,
      minEdgePercentage
    );
    if (h2hValue) opportunities.push(h2hValue);

    return opportunities;
  }

  /**
   * Compare h2h/moneyline odds
   */
  compareH2H(cloudbetEvent, externalEvent, minEdgePercentage) {
    const h2hMarket = Object.values(cloudbetEvent.markets).find(
      m => m.marketKey.includes('match_odds') || m.marketKey.includes('moneyline')
    );

    if (!h2hMarket || !h2hMarket.selections) return null;

    const externalH2H = this.calculateAverageOdds(externalEvent.markets, 'h2h');
    if (!externalH2H) return null;

    // Check home team
    const homeSelection = h2hMarket.selections.find(s => s.side === 'home');
    if (homeSelection) {
      const cloudbetHomeOdds = homeSelection.price;
      const externalHomeOdds = externalH2H[cloudbetEvent.home.toLowerCase()] || 999;

      const edge = ((cloudbetHomeOdds / externalHomeOdds) - 1) * 100;

      if (edge >= minEdgePercentage) {
        return this.createOpportunity(
          cloudbetEvent,
          h2hMarket,
          homeSelection,
          'home',
          edge
        );
      }
    }

    // Check away team
    const awaySelection = h2hMarket.selections.find(s => s.side === 'away');
    if (awaySelection) {
      const cloudbetAwayOdds = awaySelection.price;
      const externalAwayOdds = externalH2H[cloudbetEvent.away.toLowerCase()] || 999;

      const edge = ((cloudbetAwayOdds / externalAwayOdds) - 1) * 100;

      if (edge >= minEdgePercentage) {
        return this.createOpportunity(
          cloudbetEvent,
          h2hMarket,
          awaySelection,
          'away',
          edge
        );
      }
    }

    return null;
  }
}

module.exports = new CloudbetOddsAggregator();
