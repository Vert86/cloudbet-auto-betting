const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const cloudbetAPI = require('./cloudbetAPI');

/**
 * Multi-Bookmaker Odds Aggregator
 * Combines odds from The Odds API (for sharp consensus) + Cloudbet API (for betting)
 */
class MultiBookmakerOddsAggregator {
  constructor() {
    this.oddsApiKey = process.env.ODDS_API_KEY;
    this.oddsApiBaseUrl = 'https://api.the-odds-api.com/v4';

    // Sport mapping: Cloudbet keys -> The Odds API keys
    this.sportMapping = {
      'soccer': ['soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_france_ligue_one', 'soccer_fifa_world_cup_qualifiers_europe'],
      'basketball': ['basketball_nba', 'basketball_ncaab', 'basketball_euroleague'],
      'american-football': ['americanfootball_nfl', 'americanfootball_ncaaf'],
      'ice-hockey': ['icehockey_nhl', 'icehockey_sweden_hockey_league'],
      'tennis': ['tennis_atp', 'tennis_wta'],
    };

    // Sharp bookmakers (for establishing true probability)
    this.sharpBookmakers = ['pinnacle', 'bookmaker', 'betcris', 'circa'];

    // Minimum bookmakers required for reliable edge detection
    // Use ?? instead of || to allow 0 as a valid value (for fundamental analysis mode)
    this.minBookmakers = parseInt(process.env.MIN_BOOKMAKERS) ?? 2;

    // Cache for reducing API calls
    this.oddsCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get odds from The Odds API for a specific sport
   */
  async getOddsFromTheOddsAPI(sportKey) {
    try {
      // Check cache first
      const cacheKey = `odds_api_${sportKey}`;
      const cached = this.oddsCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        logger.info('Using cached Odds API data', { sportKey });
        return cached.data;
      }

      logger.info('Fetching odds from The Odds API', { sportKey });

      const response = await axios.get(`${this.oddsApiBaseUrl}/sports/${sportKey}/odds`, {
        params: {
          apiKey: this.oddsApiKey,
          regions: 'us,uk,eu',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'decimal',
          // Request multiple bookmakers including sharp ones
          bookmakers: 'pinnacle,bookmaker,betcris,bovada,betonline,betfair,bet365,unibet,williamhill,marathonbet',
        },
        timeout: 15000,
      });

      // Cache the response
      this.oddsCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now(),
      });

      // Log quota usage
      const remaining = response.headers['x-requests-remaining'];
      const used = response.headers['x-requests-used'];
      logger.info('Odds API quota', {
        sportKey,
        used: used || 'unknown',
        remaining: remaining || 'unknown',
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('Odds API authentication failed', {
          message: error.response?.data?.message,
          errorCode: error.response?.data?.error_code,
        });
      } else if (error.response?.status === 429) {
        logger.error('Odds API rate limit exceeded', {
          remaining: error.response.headers['x-requests-remaining'],
        });
      } else if (error.response?.status === 404) {
        logger.info('Sport not found in Odds API', { sportKey });
      } else {
        logger.error('Error fetching from Odds API', {
          sportKey,
          error: error.message,
        });
      }
      return null;
    }
  }

  /**
   * Get odds from Cloudbet API
   */
  async getCloudbetOdds(sportKey) {
    try {
      logger.info('Fetching odds from Cloudbet', { sportKey });
      const cloudbetEvents = await cloudbetAPI.getSportEvents(sportKey);
      return cloudbetEvents;
    } catch (error) {
      logger.error('Error fetching Cloudbet odds', {
        sportKey,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Match Cloudbet event to The Odds API event
   */
  matchEvents(cloudbetEvent, oddsApiEvents) {
    if (!oddsApiEvents || oddsApiEvents.length === 0) {
      return null;
    }

    // Normalize team names for matching
    const normalize = (str) => {
      if (!str || typeof str !== 'string') return '';
      // Remove common suffixes
      let cleaned = str.toLowerCase();
      cleaned = cleaned.replace(/\s*(fc|afc|cf|srl|srl\s*fc|united|city|town|athletic|club)\s*$/gi, '');
      // Remove all non-alphanumeric except spaces
      cleaned = cleaned.replace(/[^a-z0-9\s]/g, '');
      // Remove extra spaces
      cleaned = cleaned.replace(/\s+/g, '');
      return cleaned;
    };

    const cbHome = normalize(cloudbetEvent.home);
    const cbAway = normalize(cloudbetEvent.away);

    // Check if cutoffTime or starts exists
    const cbTimeField = cloudbetEvent.cutoffTime || cloudbetEvent.starts;
    const cbTime = cbTimeField ? new Date(cbTimeField) : null;

    // Find matching event
    for (const oddsEvent of oddsApiEvents) {
      const oaHome = normalize(oddsEvent.home_team);
      const oaAway = normalize(oddsEvent.away_team);
      const oaTime = new Date(oddsEvent.commence_time);

      // Check team names match (after normalization, exact match or contains)
      const homeMatch = cbHome === oaHome || cbHome.includes(oaHome) || oaHome.includes(cbHome) ||
                       this.fuzzyMatch(cloudbetEvent.home, oddsEvent.home_team);
      const awayMatch = cbAway === oaAway || cbAway.includes(oaAway) || oaAway.includes(cbAway) ||
                       this.fuzzyMatch(cloudbetEvent.away, oddsEvent.away_team);

      // Check time is within 6 hours (skip if cbTime not available)
      let timeMatch = true; // Default to true if time not available
      if (cbTime && !isNaN(cbTime)) {
        const timeDiff = Math.abs(cbTime - oaTime) / (1000 * 60 * 60);
        timeMatch = timeDiff < 6;
      }

      if (homeMatch && awayMatch && timeMatch) {
        logger.info('Matched Cloudbet event to Odds API', {
          cloudbetEvent: `${cloudbetEvent.home} vs ${cloudbetEvent.away}`,
          oddsApiEvent: `${oddsEvent.home_team} vs ${oddsEvent.away_team}`,
        });
        return oddsEvent;
      }
    }

    logger.info('No match found for Cloudbet event', {
      event: `${cloudbetEvent.home} vs ${cloudbetEvent.away}`,
    });
    return null;
  }

  /**
   * Fuzzy match team names (handles abbreviations, city names, etc.)
   */
  fuzzyMatch(name1, name2) {
    if (!name1 || !name2) return false;

    // Normalize: lowercase, remove common words
    const normalize = (str) => {
      return str.toLowerCase()
        .replace(/\b(fc|afc|cf|cd|sc|united|city|town|athletic|Real|FK|PFK|RFK)\b/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();
    };

    const norm1 = normalize(name1);
    const norm2 = normalize(name2);

    // Exact match after normalization
    if (norm1 === norm2) return true;

    // Split into words
    const words1 = norm1.split(/\s+/).filter(w => w.length > 2);
    const words2 = norm2.split(/\s+/).filter(w => w.length > 2);

    // If any significant word matches, consider it a match
    // This handles "Lakers" vs "Los Angeles Lakers"
    const commonWords = words1.filter(w => words2.includes(w));
    if (commonWords.length > 0) return true;

    // Check if one name contains the other
    if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

    // Last resort: check last word only (team nickname)
    const last1 = words1[words1.length - 1];
    const last2 = words2[words2.length - 1];

    return last1 && last2 && last1 === last2;
  }

  /**
   * Extract bookmaker odds for a specific side
   */
  extractBookmakerOdds(oddsApiEvent, cloudbetSide) {
    if (!oddsApiEvent || !oddsApiEvent.bookmakers) {
      return [];
    }

    const bookmakerOdds = [];

    for (const bookmaker of oddsApiEvent.bookmakers) {
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      if (!h2hMarket) continue;

      // Map Cloudbet side to The Odds API team name
      let targetTeam;
      if (cloudbetSide === 'home') {
        targetTeam = oddsApiEvent.home_team;
      } else if (cloudbetSide === 'away') {
        targetTeam = oddsApiEvent.away_team;
      } else if (cloudbetSide === 'draw') {
        targetTeam = 'Draw';
      }

      // Build odds object for all sides
      const odds = {};
      h2hMarket.outcomes.forEach(outcome => {
        if (outcome.name === oddsApiEvent.home_team) {
          odds.home = outcome.price;
        } else if (outcome.name === oddsApiEvent.away_team) {
          odds.away = outcome.price;
        } else if (outcome.name === 'Draw') {
          odds.draw = outcome.price;
        }
      });

      bookmakerOdds.push({
        bookmaker: bookmaker.key,
        title: bookmaker.title,
        odds: odds,
        isSharp: this.sharpBookmakers.includes(bookmaker.key),
      });
    }

    return bookmakerOdds;
  }

  /**
   * Find betting opportunities with complete multi-bookmaker data
   */
  async findOpportunities(sportKey) {
    logger.info('Finding opportunities with multi-bookmaker data', { sportKey });

    const opportunities = [];

    // Get The Odds API sports keys for this sport
    const oddsApiSports = this.sportMapping[sportKey] || [];
    if (oddsApiSports.length === 0) {
      logger.warn('Sport not mapped to Odds API', { sportKey });
      return opportunities;
    }

    // Get Cloudbet odds
    const cloudbetData = await this.getCloudbetOdds(sportKey);
    if (!cloudbetData || !cloudbetData.events) {
      logger.warn('No Cloudbet events found', { sportKey });
      return opportunities;
    }

    // Get The Odds API odds for all relevant sports
    const allOddsApiEvents = [];
    for (const oddsApiSport of oddsApiSports) {
      const oddsApiData = await this.getOddsFromTheOddsAPI(oddsApiSport);
      if (oddsApiData && Array.isArray(oddsApiData)) {
        allOddsApiEvents.push(...oddsApiData);
      }
    }

    if (allOddsApiEvents.length === 0) {
      logger.warn('No Odds API events found', { sportKey });
      return opportunities;
    }

    logger.info('Processing events for opportunities', {
      cloudbetEvents: cloudbetData.events.length,
      oddsApiEvents: allOddsApiEvents.length,
    });

    // Match events and create opportunities
    for (const cbEvent of cloudbetData.events) {
      // Skip live events
      if (cbEvent.status === 'TRADING_LIVE') {
        continue;
      }

      // Match to Odds API event
      const oddsApiEvent = this.matchEvents(cbEvent, allOddsApiEvents);
      if (!oddsApiEvent) {
        continue;
      }

      // Process markets
      const cbMarkets = cbEvent.markets || {};

      // DEBUG: Log what markets CloudBet actually has
      const marketKeys = Object.keys(cbMarkets);
      if (marketKeys.length > 0) {
        logger.debug('CloudBet markets for event', {
          event: `${cbEvent.home} vs ${cbEvent.away}`,
          marketKeys: marketKeys.slice(0, 5), // Show first 5
          totalMarkets: marketKeys.length
        });
      }

      for (const [marketKey, marketData] of Object.entries(cbMarkets)) {
        // ✅ ONLY ALLOW STANDARD MATCH ODDS (full match winner)
        // CloudBet uses format like "soccer.match_odds" or "basketball.moneyline"
        // Extract the market type after the sport prefix
        const marketType = marketKey.includes('.') ? marketKey.split('.').pop() : marketKey;

        // Skip all markets except standard match winner
        if (marketType !== 'match_odds' && marketType !== 'moneyline') {
          logger.debug('Skipping non-match-odds market', { marketKey, marketType });
          continue;
        }

        // ❌ EXCLUDE HALF-TIME MARKETS - These are too volatile and unpredictable
        if (marketKey.includes('first_half') ||
            marketKey.includes('second_half') ||
            marketKey.includes('period_first') ||
            marketKey.includes('period_second') ||
            marketKey.includes('1st_half') ||
            marketKey.includes('2nd_half')) {
          logger.debug('Skipping half-time market', { marketKey });
          continue;
        }

        // Get submarkets
        const submarkets = marketData.submarkets || {};
        for (const [submarketKey, submarket] of Object.entries(submarkets)) {
          if (!submarket.selections) continue;

          // Process each selection (home/away/draw)
          for (const selection of submarket.selections) {
            if (selection.status !== 'SELECTION_ENABLED') continue;

            const cloudbetOdds = selection.price;
            const side = selection.outcome; // home, away, or draw

            // Get all bookmaker odds for this side
            const allBookmakerOdds = this.extractBookmakerOdds(oddsApiEvent, side);

            // DEBUG: Count how many bookmakers actually have odds for this side
            const bookmakersWithOddsForSide = allBookmakerOdds.filter(b => b.odds[side] !== undefined);

            logger.debug('Bookmaker odds extraction', {
              event: `${cbEvent.home} vs ${cbEvent.away}`,
              side,
              totalBookmakers: allBookmakerOdds.length,
              withOddsForSide: bookmakersWithOddsForSide.length,
              required: this.minBookmakers,
            });

            if (bookmakersWithOddsForSide.length < this.minBookmakers) {
              logger.info('Insufficient bookmakers with odds for this side', {
                event: `${cbEvent.home} vs ${cbEvent.away}`,
                side,
                bookmakersWithOdds: bookmakersWithOddsForSide.length,
                required: this.minBookmakers,
              });
              continue;
            }

            // Create opportunity object
            const opportunity = {
              // Event info
              eventId: cbEvent.eventId || cbEvent.id,
              eventKey: cbEvent.eventKey || cbEvent.key,
              home: cbEvent.home,
              away: cbEvent.away,
              starts: oddsApiEvent.commence_time, // Use Odds API commence time
              cutoffTime: cbEvent.cutoffTime, // Keep Cloudbet cutoffTime if available
              sport: sportKey,
              league: cbEvent.competition?.name || 'unknown',

              // Market info
              marketType: marketKey.split('.').pop(),
              marketUrl: selection.marketUrl,
              side: side,
              selection: selection.outcome,

              // Cloudbet odds
              cloudbetOdds: cloudbetOdds,

              // Multi-bookmaker comparison data (FIXED: only bookmakers with odds for this side)
              allBookmakerOdds: bookmakersWithOddsForSide,

              // Count sharp books
              sharpBookCount: bookmakersWithOddsForSide.filter(b => b.isSharp).length,
              totalBookmakers: bookmakersWithOddsForSide.length,
            };

            opportunities.push(opportunity);
          }
        }
      }
    }

    // Sort opportunities by start time (nearest events first)
    opportunities.sort((a, b) => {
      const timeA = new Date(a.starts || a.cutoffTime);
      const timeB = new Date(b.starts || b.cutoffTime);
      return timeA - timeB;
    });

    logger.info('Opportunities found and sorted by start time', {
      sportKey,
      count: opportunities.length,
      firstEventTime: opportunities.length > 0 ? opportunities[0].starts : null,
      lastEventTime: opportunities.length > 0 ? opportunities[opportunities.length - 1].starts : null,
    });

    return opportunities;
  }

  /**
   * Get opportunities for multiple sports
   */
  async findAllOpportunities(sports = ['soccer', 'basketball', 'american-football']) {
    const allOpportunities = [];

    for (const sport of sports) {
      try {
        const opportunities = await this.findOpportunities(sport);
        allOpportunities.push(...opportunities);
      } catch (error) {
        logger.error('Error finding opportunities for sport', {
          sport,
          error: error.message,
        });
      }
    }

    logger.info('Total opportunities found across all sports', {
      count: allOpportunities.length,
      sports: sports.length,
    });

    return allOpportunities;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.oddsCache.clear();
    logger.info('Odds cache cleared');
  }
}

module.exports = new MultiBookmakerOddsAggregator();
