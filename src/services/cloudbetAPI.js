const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class CloudbetAPI {
  constructor() {
    this.baseUrl = 'https://sports-api.cloudbet.com/pub';
    this.apiKey = config.cloudbet.apiKey;

    // Feed API client (for getting odds) - v2/odds
    this.feedClient = axios.create({
      baseURL: `${this.baseUrl}/v2/odds`,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Trading API client (for placing bets) - v3
    this.tradingClient = axios.create({
      baseURL: `${this.baseUrl}/v3`,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Account API client (for balance, etc) - v1/account
    this.accountClient = axios.create({
      baseURL: `${this.baseUrl}/v1/account`,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });
  }

  /**
   * Get available sports
   */
  async getSports() {
    try {
      const response = await this.feedClient.get('/sports');
      logger.info('Retrieved sports list', {
        count: response.data.sports?.length
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching sports', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get competitions for a specific sport
   */
  async getCompetitions(sportKey) {
    try {
      const response = await this.feedClient.get(`/competitions/${sportKey}`);
      logger.info(`Retrieved competitions for sport ${sportKey}`, {
        count: response.data.competitions?.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching competitions for sport ${sportKey}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get events for a specific competition
   */
  async getEvents(competitionKey) {
    try {
      const response = await this.feedClient.get(`/events/${competitionKey}`);
      logger.info(`Retrieved events for ${competitionKey}`, {
        count: response.data.events?.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching events for ${competitionKey}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get all events for a sport
   */
  async getSportEvents(sportKey) {
    try {
      // First get the sport structure to find competitions
      const sportResp = await this.feedClient.get(`/sports/${sportKey}`);
      const categories = sportResp.data.categories || [];

      // Collect all competitions from all categories
      const allCompetitions = [];
      for (const category of categories) {
        if (category.competitions) {
          allCompetitions.push(...category.competitions);
        }
      }

      // Get events from top competitions (limit to avoid too many API calls)
      // Sort by event count descending, take top 10 for broader coverage
      const topCompetitions = allCompetitions
        .filter(c => c.eventCount > 0)
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      logger.info(`Fetching events from ${topCompetitions.length} top competitions for ${sportKey}`);

      // Fetch events from each competition
      const allEvents = [];
      for (const competition of topCompetitions) {
        try {
          const compResp = await this.feedClient.get(`/competitions/${competition.key}`);
          const events = (compResp.data.events || [])
            .filter(e => e.home && e.away && e.status === 'TRADING'); // Only trading events with teams

          allEvents.push(...events);
          logger.info(`  ${competition.name}: ${events.length} trading events`);
        } catch (error) {
          logger.warn(`  Failed to fetch ${competition.name}: ${error.message}`);
        }
      }

      logger.info(`Retrieved ${allEvents.length} total events for sport ${sportKey}`);

      return {
        sport: sportResp.data.key,
        name: sportResp.data.name,
        events: allEvents
      };
    } catch (error) {
      logger.error(`Error fetching events for sport ${sportKey}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get odds for a specific event
   */
  async getEventOdds(eventId) {
    try {
      const response = await this.feedClient.get(`/events/${eventId}`);
      logger.info(`Retrieved odds for event ${eventId}`, {
        markets: response.data.markets?.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching odds for event ${eventId}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get account balance for a specific currency
   */
  async getBalance(currency = null) {
    try {
      // Use configured currency if not specified
      const curr = currency || config.cloudbet.currency || 'BTC';

      const response = await this.accountClient.get(`/currencies/${curr}/balance`);
      logger.info('Retrieved account balance', {
        currency: curr,
        balance: response.data
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching balance', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });

      if (error.response?.status === 401 || error.response?.status === 403) {
        logger.error('Authentication failed. Possible causes:', {
          causes: [
            '1. Invalid API key',
            '2. API key not activated - ensure you deposited minimum 10 EUR',
            '3. Using Affiliate API key instead of Trading API key',
            '4. Trading API endpoints require Trading API key (not Affiliate key)'
          ]
        });
      }

      throw error;
    }
  }

  /**
   * Get all account balances
   */
  async getAllBalances() {
    try {
      // Try to get balances for common currencies
      const currencies = ['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'USDC'];
      const balances = [];

      for (const currency of currencies) {
        try {
          const balance = await this.getBalance(currency);
          if (balance && (balance.available > 0 || balance.bonus > 0)) {
            balances.push({
              currency,
              ...balance
            });
          }
        } catch (error) {
          // Skip currencies that return errors
          continue;
        }
      }

      return balances;
    } catch (error) {
      logger.error('Error fetching all balances', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Place a bet
   */
  async placeBet(betData) {
    try {
      const {
        eventId,
        marketUrl,
        price,
        stake,
        currency,
        selectionKey,
        referenceId
      } = betData;

      // Generate a proper UUID v4 if referenceId not provided
      const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      const payload = {
        acceptPriceChange: 'ALL', // Accept any price changes
        price: String(price), // API expects string
        stake: String(stake), // API expects string
        currency: currency || 'BTC',
        eventId: String(eventId), // API expects string
        marketUrl: marketUrl,
        referenceId: referenceId || generateUUID() // Proper UUID format required
      };

      logger.info('Placing bet', { payload });
      const response = await this.tradingClient.post('/bets/place', payload);

      logger.info('Bet placed successfully', {
        betId: response.data.id,
        status: response.data.status,
        stake: response.data.stake,
        price: response.data.price
      });

      return response.data;
    } catch (error) {
      logger.error('Error placing bet', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get bet history
   */
  async getBets(limit = 50, offset = 0, status = null) {
    try {
      const params = { limit, offset };
      if (status) params.status = status;

      const response = await this.tradingClient.get('/bets/history', { params });
      logger.info('Retrieved bets', {
        count: response.data.bets?.length
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching bets', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get specific bet details
   */
  async getBet(betId) {
    try {
      const response = await this.tradingClient.get(`/bets/${betId}`);
      logger.info('Retrieved bet details', { betId });
      return response.data;
    } catch (error) {
      logger.error('Error fetching bet details', {
        betId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get fixture information
   */
  async getFixture(eventId) {
    try {
      const response = await this.feedClient.get(`/fixtures/${eventId}`);
      logger.info('Retrieved fixture', { eventId });
      return response.data;
    } catch (error) {
      logger.error('Error fetching fixture', {
        eventId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get live events
   */
  async getLiveEvents(sportKey = null) {
    try {
      const url = sportKey ? `/sports/${sportKey}/events/live` : '/events/live';
      const response = await this.feedClient.get(url);
      logger.info('Retrieved live events', {
        sportKey,
        count: response.data.events?.length
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching live events', {
        sportKey,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = new CloudbetAPI();
