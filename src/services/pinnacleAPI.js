const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class PinnacleAPI {
  constructor() {
    this.baseUrl = config.pinnacle.baseUrl;
    this.credentials = Buffer.from(
      `${config.pinnacle.username}:${config.pinnacle.password}`
    ).toString('base64');

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Basic ${this.credentials}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'PinnacleAutoBetting/1.0',
        'Accept-Encoding': 'gzip, deflate',
      },
      timeout: 30000,
    });

    this.lastRequestTime = {};
  }

  /**
   * Rate limiting: 1 request per 2 minutes per endpoint per sportId
   */
  async enforceRateLimit(endpoint, sportId = 'general') {
    const key = `${endpoint}_${sportId}`;
    const now = Date.now();
    const lastRequest = this.lastRequestTime[key] || 0;
    const timeSinceLastRequest = now - lastRequest;
    const minInterval = 120000; // 2 minutes in milliseconds

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      logger.info(`Rate limit: waiting ${waitTime}ms for ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime[key] = Date.now();
  }

  /**
   * Get available sports
   */
  async getSports() {
    try {
      await this.enforceRateLimit('/v2/sports');
      const response = await this.client.get('/v2/sports');
      logger.info('Retrieved sports list', { count: response.data.sports?.length });
      return response.data;
    } catch (error) {
      logger.error('Error fetching sports', { error: error.message });
      throw error;
    }
  }

  /**
   * Get leagues for a specific sport
   */
  async getLeagues(sportId) {
    try {
      await this.enforceRateLimit('/v2/leagues', sportId);
      const response = await this.client.get(`/v2/leagues`, {
        params: { sportId }
      });
      logger.info(`Retrieved leagues for sport ${sportId}`, {
        count: response.data.leagues?.length
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching leagues for sport ${sportId}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get odds (lines) for a specific sport
   */
  async getOdds(sportId, leagueIds = [], oddsFormat = 'DECIMAL', isLive = false) {
    try {
      await this.enforceRateLimit('/v2/odds', sportId);

      const params = {
        sportId,
        oddsFormat,
        isLive: isLive ? 1 : 0,
      };

      if (leagueIds.length > 0) {
        params.leagueIds = leagueIds.join(',');
      }

      const response = await this.client.get('/v2/odds', { params });
      logger.info(`Retrieved odds for sport ${sportId}`, {
        eventCount: response.data.leagues?.reduce((acc, league) =>
          acc + (league.events?.length || 0), 0
        ),
        isLive
      });
      return response.data;
    } catch (error) {
      logger.error(`Error fetching odds for sport ${sportId}`, {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get specific line for bet verification before placing
   */
  async getLine(sportId, leagueId, eventId, periodNumber, betType, team, side, oddsFormat = 'DECIMAL') {
    try {
      const params = {
        sportId,
        leagueId,
        eventId,
        periodNumber,
        betType,
        oddsFormat,
      };

      if (team) params.team = team;
      if (side) params.side = side;

      const response = await this.client.get('/v2/line', { params });
      logger.info('Retrieved line for verification', { eventId, betType });
      return response.data;
    } catch (error) {
      logger.error('Error fetching line', {
        eventId,
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
      const response = await this.client.get('/v1/client/balance');
      logger.info('Retrieved account balance', {
        balance: response.data.availableBalance
      });
      return response.data;
    } catch (error) {
      logger.error('Error fetching balance', { error: error.message });
      throw error;
    }
  }

  /**
   * Place a bet
   */
  async placeBet(betData) {
    try {
      const {
        uniqueRequestId,
        acceptBetterLine,
        oddsFormat,
        stake,
        winRiskStake,
        lineId,
        altLineId,
        pitcher1MustStart,
        pitcher2MustStart,
        fillType,
        sportId,
        eventId,
        periodNumber,
        betType,
        team,
        side,
      } = betData;

      const payload = {
        uniqueRequestId: uniqueRequestId || `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        acceptBetterLine: acceptBetterLine !== undefined ? acceptBetterLine : true,
        oddsFormat: oddsFormat || 'DECIMAL',
        stake,
        winRiskStake: winRiskStake || 'RISK',
        lineId,
        sportId,
        eventId,
        periodNumber,
        betType,
      };

      if (altLineId) payload.altLineId = altLineId;
      if (team) payload.team = team;
      if (side) payload.side = side;
      if (pitcher1MustStart !== undefined) payload.pitcher1MustStart = pitcher1MustStart;
      if (pitcher2MustStart !== undefined) payload.pitcher2MustStart = pitcher2MustStart;
      if (fillType) payload.fillType = fillType;

      logger.info('Placing bet', { payload });
      const response = await this.client.post('/v4/bets/place', payload);

      logger.info('Bet placed successfully', {
        betId: response.data.betId,
        status: response.data.status,
        stake: response.data.risk,
        toWin: response.data.win,
      });

      return response.data;
    } catch (error) {
      logger.error('Error placing bet', {
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Get straight bets
   */
  async getBets(betIds = [], fromDate = null, toDate = null, betlist = 'ALL') {
    try {
      const params = { betlist };

      if (betIds.length > 0) {
        params.betids = betIds.join(',');
      }
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const response = await this.client.get('/v4/bets/straight', { params });
      logger.info('Retrieved bets', { count: response.data.straightBets?.length });
      return response.data;
    } catch (error) {
      logger.error('Error fetching bets', { error: error.message });
      throw error;
    }
  }
}

module.exports = new PinnacleAPI();
