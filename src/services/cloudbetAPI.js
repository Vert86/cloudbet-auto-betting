const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class CloudbetAPI {
  constructor() {
    this.feedBaseUrl = 'https://sports-api.cloudbet.com/pub/v2';
    this.tradingBaseUrl = 'https://sports-api.cloudbet.com/pub/v3';
    this.accountBaseUrl = 'https://sports-api.cloudbet.com/pub/v1';

    this.apiKey = config.cloudbet.apiKey;

    // Feed API client (for getting odds)
    this.feedClient = axios.create({
      baseURL: this.feedBaseUrl,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Trading API client (for placing bets)
    this.tradingClient = axios.create({
      baseURL: this.tradingBaseUrl,
      headers: {
        'X-API-Key': this.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Account API client (for balance, etc)
    this.accountClient = axios.create({
      baseURL: this.accountBaseUrl,
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
      const response = await this.feedClient.get(`/sports/${sportKey}/competitions`);
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
  async getEvents(sportKey, competitionKey) {
    try {
      const response = await this.feedClient.get(
        `/sports/${sportKey}/competitions/${competitionKey}/events`
      );
      logger.info(`Retrieved events for ${sportKey}/${competitionKey}`, {
        count: response.data.events?.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching events for ${sportKey}/${competitionKey}`, {
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
      const response = await this.feedClient.get(`/sports/${sportKey}/events`);
      logger.info(`Retrieved all events for sport ${sportKey}`, {
        count: response.data.events?.length
      });
      return response.data;
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
   * Get account balance
   */
  async getBalance() {
    try {
      const response = await this.accountClient.get('/account/balances');
      logger.info('Retrieved account balance', {
        balances: response.data
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
            '3. Using Affiliate API key instead of Trading API key'
          ]
        });
      }

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

      const payload = {
        price: parseFloat(price),
        stake: parseFloat(stake),
        currency: currency || 'BTC',
        eventId: eventId,
        marketUrl: marketUrl,
        selectionKey: selectionKey,
        referenceId: referenceId || `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      logger.info('Placing bet', { payload });
      const response = await this.tradingClient.post('/bets', payload);

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

      const response = await this.tradingClient.get('/bets', { params });
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
