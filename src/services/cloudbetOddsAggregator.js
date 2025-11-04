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
      // 404 means sport not available in The Odds API - this is normal, not an error
      if (error.response?.status === 404) {
        logger.info('Sport not available in The Odds API, skipping external comparison', {
          sport
        });
        return null;
      }

      // 401 means API key issue or quota exceeded
      if (error.response?.status === 401) {
        const remaining = error.response?.headers?.['x-requests-remaining'];
        logger.warn('The Odds API quota exceeded or invalid key', {
          sport,
          requestsRemaining: remaining || 0,
          message: 'System will continue using Cloudbet odds only'
        });
        return null;
      }

      logger.error('Error fetching odds from The Odds API', {
        error: error.message,
        sport,
        status: error.response?.status
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

    // Cloudbet markets is an object like { "basketball.moneyline": { submarkets: {...} } }
    for (const [marketKey, marketData] of Object.entries(event.markets)) {
      if (!marketData.submarkets) continue;

      // Get the default submarket or first available
      const submarketKey = 'default' in marketData.submarkets ?
        'default' : Object.keys(marketData.submarkets)[0];

      const submarket = marketData.submarkets[submarketKey];
      if (!submarket || !submarket.selections) continue;

      markets[marketKey] = {
        marketKey: marketKey,
        marketName: marketKey.split('.').pop(), // e.g., "moneyline" from "basketball.moneyline"
        selections: []
      };

      // Extract selections (betting options)
      for (const selection of submarket.selections) {
        // Only include enabled selections
        if (selection.status === 'SELECTION_ENABLED') {
          markets[marketKey].selections.push({
            selectionKey: selection.outcome,
            name: selection.outcome,
            price: selection.price,
            marketUrl: selection.marketUrl,
            params: selection.params,
            side: selection.outcome, // Use outcome as side (home/away/draw)
            minStake: selection.minStake,
            maxStake: selection.maxStake
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
   * Without external comparison, look for favorable odds based on:
   * 1. Low bookmaker margins (under 5%)
   * 2. Odds in acceptable range (1.5-10.0)
   * 3. Good liquidity (sufficient max stake)
   */
  findInternalOpportunities(cloudbetEvent, minEdgePercentage) {
    const opportunities = [];

    // Look for all match odds / moneyline markets
    const mainMarkets = Object.values(cloudbetEvent.markets).filter(
      m => m.marketKey.includes('match_odds') ||
           m.marketKey.includes('moneyline') ||
           m.marketKey.includes('1x2') ||
           m.marketKey.includes('winner')
    );

    for (const market of mainMarkets) {
      if (!market.selections || market.selections.length < 2) continue;

      // Analyze each selection
      for (const selection of market.selections) {
        const price = selection.price;

        // Skip if odds outside acceptable range
        if (price < 1.5 || price > 10.0) continue;

        // Skip if max stake is too low (less than 5 USDT)
        if (selection.maxStake && selection.maxStake < 5) continue;

        // Calculate implied probability
        const impliedProb = 1 / price;

        // Calculate total market probability to find bookmaker margin
        const totalProb = market.selections.reduce((sum, s) => sum + (1 / s.price), 0);
        const margin = totalProb - 1;

        // Only bet if bookmaker margin is reasonable (under 8%)
        if (margin > 0.08) continue;

        // For internal opportunities without external comparison:
        // Look for odds where the bookmaker margin is low AND
        // the odds suggest value (higher odds = more potential value)

        // Calculate a pseudo-edge based on:
        // 1. Low margin = better value
        // 2. Reasonable odds (not too short, not too long)
        const marginScore = Math.max(0, (0.08 - margin) * 100); // Higher when margin is lower
        const oddsScore = Math.min(price / 3, 2); // Favor odds between 2-6
        const pseudoEdge = marginScore * oddsScore;

        // Only create opportunity if it meets minimum threshold
        if (pseudoEdge >= minEdgePercentage) {
          const opportunity = this.createOpportunity(
            cloudbetEvent,
            market,
            selection,
            selection.side,
            pseudoEdge
          );

          if (opportunity) {
            opportunities.push(opportunity);
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
      marketUrl: selection.marketUrl, // URL is in selection
      marketKey: market.marketKey,
      marketName: market.marketName,
      selectionKey: selection.selectionKey,
      selectionName: selection.name,
      side: side,
      cloudbetOdds: selection.price,
      edge: edge.toFixed(2),
      price: selection.price,
      minStake: selection.minStake,
      maxStake: selection.maxStake
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
   * Check if team names match (fuzzy matching with abbreviation support)
   */
  teamsMatch(team1, team2) {
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const norm1 = normalize(team1);
    const norm2 = normalize(team2);

    // Direct substring match
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return true;
    }

    // Extract last word (team name without city)
    const getTeamName = (str) => {
      const parts = str.trim().split(/\s+/);
      return parts[parts.length - 1];
    };

    const teamName1 = getTeamName(norm1);
    const teamName2 = getTeamName(norm2);

    // Match on team name only (e.g., "Nets" matches "Nets")
    if (teamName1 === teamName2) {
      return true;
    }

    // Handle abbreviations by checking if abbreviation matches first letters
    // e.g., "BKN" should match "Brooklyn" or "MIN" should match "Minnesota"
    const words1 = norm1.split(/\s+/);
    const words2 = norm2.split(/\s+/);

    // Check if either is an abbreviation (short string without spaces or single word)
    if (words1.length === 1 && words1[0].length <= 4) {
      // team1 might be abbreviation
      const abbr = words1[0];
      // Check if it matches first letters of words in team2
      const firstLetters = words2.slice(0, -1).map(w => w[0]).join(''); // Exclude last word (team name)
      if (abbr === firstLetters) {
        return true;
      }
    }

    if (words2.length === 1 && words2[0].length <= 4) {
      // team2 might be abbreviation
      const abbr = words2[0];
      // Check if it matches first letters of words in team1
      const firstLetters = words1.slice(0, -1).map(w => w[0]).join(''); // Exclude last word (team name)
      if (abbr === firstLetters) {
        return true;
      }
    }

    // Special case: Check if abbreviation appears in full name
    // e.g., "BKN Nets" vs "Brooklyn Nets" - extract "bkn" and check if "brooklyn" starts with "b", etc.
    const checkAbbreviation = (abbr, fullName) => {
      if (abbr.length > fullName.length) return false;

      // Common team abbreviations mapping
      const abbreviations = {
        'bkn': 'brooklyn',
        'min': 'minnesota',
        'phi': 'philadelphia',
        'was': 'washington',
        'nyk': 'newyork',
        'nop': 'neworleans',
        'por': 'portland',
        'sac': 'sacramento',
        'atl': 'atlanta',
        'cha': 'charlotte',
        'chi': 'chicago',
        'cle': 'cleveland',
        'dal': 'dallas',
        'den': 'denver',
        'det': 'detroit',
        'gsw': 'goldenstate',
        'hou': 'houston',
        'ind': 'indiana',
        'lac': 'losangelesclippers',
        'lal': 'losangeleslakers',
        'mem': 'memphis',
        'mia': 'miami',
        'mil': 'milwaukee',
        'okc': 'oklahomacity',
        'orl': 'orlando',
        'phx': 'phoenix',
        'sas': 'sanantonio',
        'tor': 'toronto',
        'uta': 'utah'
      };

      // Check if abbreviation is in our mapping
      if (abbreviations[abbr]) {
        return fullName.includes(abbreviations[abbr]) || abbreviations[abbr].includes(fullName);
      }

      return false;
    };

    // Try both directions
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (checkAbbreviation(word1, word2) || checkAbbreviation(word2, word1)) {
          return true;
        }
      }
    }

    return false;
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
