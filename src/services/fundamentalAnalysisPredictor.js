const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Fundamental Analysis Predictor
 * Makes predictions based on team performance, rankings, and injuries
 * rather than relying on odds comparison
 */
class FundamentalAnalysisPredictor {
  constructor() {
    // API-Sports provides free access to NBA, NHL, NFL, Soccer data
    this.apiKey = process.env.API_SPORTS_KEY || null;
    this.baseURL = 'https://v1.american-football.api-sports.io'; // NFL
    this.nbaURL = 'https://v2.nba.api-sports.io';
    this.nhlURL = 'https://v1.hockey.api-sports.io';
    this.soccerURL = 'https://v3.football.api-sports.io'; // Soccer/Football

    // BallDontLie - requires API key as of 2025
    this.ballDontLieURL = 'https://api.balldontlie.io/v1';
    this.ballDontLieKey = process.env.BALLDONTLIE_API_KEY || null;

    // Caching to avoid rate limits (BallDontLie has strict limits on free tier)
    this.nbaTeamsCache = null;
    this.nbaTeamsCacheTime = null;
    this.nbaStandingsCache = new Map(); // Cache standings per team
    this.soccerStandingsCache = new Map(); // Cache soccer standings per league
    this.cacheDuration = 2 * 60 * 1000; // 2 minutes - need fresh standings for accurate predictions

    // Thresholds for predictions
    this.strongFavoriteThreshold = 0.65; // Win rate difference
    this.rankingDifferenceThreshold = 5; // Ranking positions
    this.injuryImpactThreshold = 2; // Number of key players injured

    // Soccer-specific: Map league IDs for API-Football
    this.soccerLeagueMap = {
      'Premier League': { id: 39, country: 'England' },
      'La Liga': { id: 140, country: 'Spain' },
      'Bundesliga': { id: 78, country: 'Germany' },
      'Serie A': { id: 135, country: 'Italy' },
      'Ligue 1': { id: 61, country: 'France' },
      'UEFA Champions League': { id: 2, country: 'Europe' },
      'UEFA Europa League': { id: 3, country: 'Europe' },
      'FIFA World Cup': { id: 1, country: 'World' },
      'FIFA World Cup Qualifiers': { id: 32, country: 'World' }
    };
  }

  /**
   * Main prediction method
   * @param {Object} event - CloudBet event with home/away teams
   * @param {string} sport - Sport type (basketball, ice-hockey, american-football)
   * @returns {Object} Prediction with confidence and reasoning
   */
  async predictWinner(event, sport) {
    try {
      logger.info('Running fundamental analysis', {
        home: event.home,
        away: event.away,
        sport
      });

      let prediction;

      if (sport === 'basketball' || sport === 'nba') {
        prediction = await this.predictNBA(event);
      } else if (sport === 'ice-hockey' || sport === 'nhl') {
        prediction = await this.predictNHL(event);
      } else if (sport === 'american-football' || sport === 'nfl') {
        prediction = await this.predictNFL(event);
      } else if (sport === 'soccer' || sport === 'football') {
        prediction = await this.predictSoccer(event);
      } else {
        // For other sports, use basic win rate analysis
        prediction = await this.predictBasic(event, sport);
      }

      return prediction;
    } catch (error) {
      logger.error('Error in fundamental analysis prediction', {
        error: error.message,
        event: `${event.home} vs ${event.away}`
      });
      return null;
    }
  }

  /**
   * NBA prediction using BallDontLie API (free)
   */
  async predictNBA(event) {
    try {
      // Get team standings/records using multi-source fallback
      const standings = await this.getNBAStandingsMultiSource(event.home, event.away);

      if (!standings) {
        logger.warn('Could not get NBA standings from any source', {
          home: event.home,
          away: event.away
        });
        return null;
      }

      // Get injury reports (best effort - don't fail if unavailable)
      let homeInjuries = { count: 0, impactScore: 0 };
      let awayInjuries = { count: 0, impactScore: 0 };

      try {
        if (standings.homeTeamId && standings.awayTeamId) {
          const homeInjuryData = await this.getNBAInjuries(standings.homeTeamId);
          const awayInjuryData = await this.getNBAInjuries(standings.awayTeamId);

          if (homeInjuryData) homeInjuries = homeInjuryData;
          if (awayInjuryData) awayInjuries = awayInjuryData;
        }
      } catch (error) {
        logger.warn('Could not fetch injury data, continuing without it', { error: error.message });
      }

      // Calculate prediction
      return this.calculatePrediction({
        homeTeam: {
          name: event.home,
          record: standings.home,
          injuries: homeInjuries,
          ranking: standings.homeRank
        },
        awayTeam: {
          name: event.away,
          record: standings.away,
          injuries: awayInjuries,
          ranking: standings.awayRank
        },
        sport: 'NBA'
      });

    } catch (error) {
      logger.error('Error predicting NBA game', { error: error.message });
      return null;
    }
  }

  /**
   * Get NBA standings from multiple sources with fallback
   * Priority: 1) API-Sports, 2) ESPN, 3) BallDontLie
   */
  async getNBAStandingsMultiSource(homeTeamName, awayTeamName) {
    // Try API-Sports first (best rate limits, most reliable)
    try {
      logger.info('Attempting to fetch NBA standings from API-Sports');
      const standings = await this.getNBAStandingsFromAPISports(homeTeamName, awayTeamName);
      if (standings) {
        logger.info('Successfully fetched standings from API-Sports');
        return standings;
      }
    } catch (error) {
      logger.warn('API-Sports failed, trying ESPN', { error: error.message });
    }

    // Fallback to ESPN (no API key required, very reliable)
    try {
      logger.info('Attempting to fetch NBA standings from ESPN');
      const standings = await this.getNBAStandingsFromESPN(homeTeamName, awayTeamName);
      if (standings) {
        logger.info('Successfully fetched standings from ESPN');
        return standings;
      }
    } catch (error) {
      logger.warn('ESPN failed, trying BallDontLie', { error: error.message });
    }

    // Last resort: BallDontLie (may hit rate limits)
    try {
      logger.info('Attempting to fetch NBA standings from BallDontLie');
      // We need to get team IDs first from BallDontLie's teams endpoint
      if (!this.nbaTeamsCache || !this.nbaTeamsCacheTime ||
          Date.now() - this.nbaTeamsCacheTime > this.cacheDuration) {
        const headers = this.ballDontLieKey ? { 'Authorization': this.ballDontLieKey } : {};
        const teamsResponse = await axios.get(`${this.ballDontLieURL}/teams`, { headers });
        this.nbaTeamsCache = teamsResponse.data.data;
        this.nbaTeamsCacheTime = Date.now();
      }

      const homeTeam = this.findTeam(this.nbaTeamsCache, homeTeamName);
      const awayTeam = this.findTeam(this.nbaTeamsCache, awayTeamName);

      if (homeTeam && awayTeam) {
        const standings = await this.getNBAStandings(homeTeam.id, awayTeam.id);
        if (standings) {
          logger.info('Successfully fetched standings from BallDontLie');
          return {
            ...standings,
            homeTeamId: homeTeam.id,
            awayTeamId: awayTeam.id
          };
        }
      }
    } catch (error) {
      logger.error('BallDontLie failed (all sources exhausted)', { error: error.message });
    }

    return null;
  }

  /**
   * Get NBA standings from API-Sports (Primary source)
   */
  async getNBAStandingsFromAPISports(homeTeamName, awayTeamName) {
    const currentSeason = new Date().getFullYear();
    const cacheKey = `apisports_standings_${currentSeason}`;

    // Check cache
    if (this.nbaStandingsCache.has(cacheKey)) {
      const cached = this.nbaStandingsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        logger.info('Using cached API-Sports standings');
        return this.extractTeamStandings(cached.data, homeTeamName, awayTeamName);
      }
    }

    // Fetch from API-Sports
    const response = await axios.get(`${this.nbaURL}/standings`, {
      params: {
        league: 'standard',
        season: currentSeason - 1 // API-Sports uses season start year (2024 for 2024-25 season)
      },
      headers: {
        'x-apisports-key': this.apiKey
      },
      timeout: 10000
    });

    if (response.data && response.data.response && response.data.response.length > 0) {
      // Cache the full standings
      this.nbaStandingsCache.set(cacheKey, {
        data: response.data.response,
        timestamp: Date.now()
      });

      return this.extractTeamStandings(response.data.response, homeTeamName, awayTeamName);
    }

    return null;
  }

  /**
   * Get NBA standings from ESPN (Fallback, no API key required)
   */
  async getNBAStandingsFromESPN(homeTeamName, awayTeamName) {
    const cacheKey = 'espn_standings';

    // Check cache
    if (this.nbaStandingsCache.has(cacheKey)) {
      const cached = this.nbaStandingsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        logger.info('Using cached ESPN standings');
        return this.extractTeamStandingsESPN(cached.data, homeTeamName, awayTeamName);
      }
    }

    // Fetch from ESPN
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings',
      { timeout: 10000 }
    );

    if (response.data && response.data.children) {
      // Cache the full standings
      this.nbaStandingsCache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      });

      return this.extractTeamStandingsESPN(response.data, homeTeamName, awayTeamName);
    }

    return null;
  }

  /**
   * Extract team standings from API-Sports response
   */
  extractTeamStandings(standingsData, homeTeamName, awayTeamName) {
    // Find teams by matching names or codes
    const homeTeam = standingsData.find(t =>
      this.matchTeamName(t.team.name, homeTeamName) ||
      this.matchTeamName(t.team.code, homeTeamName) ||
      homeTeamName.includes(t.team.code)
    );

    const awayTeam = standingsData.find(t =>
      this.matchTeamName(t.team.name, awayTeamName) ||
      this.matchTeamName(t.team.code, awayTeamName) ||
      awayTeamName.includes(t.team.code)
    );

    if (!homeTeam || !awayTeam) {
      logger.warn('Could not find teams in API-Sports standings', {
        home: homeTeamName,
        away: awayTeamName
      });
      return null;
    }

    return {
      home: {
        wins: homeTeam.win.total || homeTeam.win.home + homeTeam.win.away,
        losses: homeTeam.loss.total || homeTeam.loss.home + homeTeam.loss.away,
        winPct: homeTeam.win.total / (homeTeam.win.total + homeTeam.loss.total) || 0.5
      },
      away: {
        wins: awayTeam.win.total || awayTeam.win.home + awayTeam.win.away,
        losses: awayTeam.loss.total || awayTeam.loss.home + awayTeam.loss.away,
        winPct: awayTeam.win.total / (awayTeam.win.total + awayTeam.loss.total) || 0.5
      },
      homeRank: homeTeam.conference.rank || 15,
      awayRank: awayTeam.conference.rank || 15,
      homeTeamId: homeTeam.team.id,
      awayTeamId: awayTeam.team.id
    };
  }

  /**
   * Extract team standings from ESPN response
   */
  extractTeamStandingsESPN(espnData, homeTeamName, awayTeamName) {
    const allTeams = [];

    // ESPN groups by conference
    if (espnData.children) {
      espnData.children.forEach(conference => {
        if (conference.standings && conference.standings.entries) {
          conference.standings.entries.forEach(entry => {
            if (entry.team) {
              allTeams.push({
                name: entry.team.displayName || entry.team.name,
                abbrev: entry.team.abbreviation,
                wins: parseFloat(entry.stats.find(s => s.name === 'wins')?.value || 0),
                losses: parseFloat(entry.stats.find(s => s.name === 'losses')?.value || 0),
                winPct: parseFloat(entry.stats.find(s => s.name === 'winPercent')?.value || 0.5),
                rank: parseFloat(entry.stats.find(s => s.name === 'rank')?.value || 15)
              });
            }
          });
        }
      });
    }

    const homeTeam = allTeams.find(t =>
      this.matchTeamName(t.name, homeTeamName) ||
      this.matchTeamName(t.abbrev, homeTeamName) ||
      homeTeamName.includes(t.abbrev)
    );

    const awayTeam = allTeams.find(t =>
      this.matchTeamName(t.name, awayTeamName) ||
      this.matchTeamName(t.abbrev, awayTeamName) ||
      awayTeamName.includes(t.abbrev)
    );

    if (!homeTeam || !awayTeam) {
      logger.warn('Could not find teams in ESPN standings', {
        home: homeTeamName,
        away: awayTeamName,
        availableTeams: allTeams.map(t => t.abbrev).join(', ')
      });
      return null;
    }

    return {
      home: {
        wins: homeTeam.wins,
        losses: homeTeam.losses,
        winPct: homeTeam.winPct
      },
      away: {
        wins: awayTeam.wins,
        losses: awayTeam.losses,
        winPct: awayTeam.winPct
      },
      homeRank: homeTeam.rank,
      awayRank: awayTeam.rank,
      homeTeamId: null, // ESPN doesn't provide team IDs
      awayTeamId: null
    };
  }

  /**
   * Helper to match team names (fuzzy matching)
   */
  matchTeamName(name1, name2) {
    if (!name1 || !name2) return false;
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    return n1 === n2 || n1.includes(n2) || n2.includes(n1);
  }

  /**
   * Get NBA team standings and records from BallDontLie API (Legacy method)
   */
  async getNBAStandings(homeTeamId, awayTeamId) {
    try {
      const currentSeason = new Date().getFullYear();

      // Check cache for each team's standings
      const homeCacheKey = `${homeTeamId}_${currentSeason}`;
      const awayCacheKey = `${awayTeamId}_${currentSeason}`;

      let homeRecord, awayRecord;

      // Fetch home team data (with caching)
      if (this.nbaStandingsCache.has(homeCacheKey)) {
        const cached = this.nbaStandingsCache.get(homeCacheKey);
        if (Date.now() - cached.timestamp < this.cacheDuration) {
          homeRecord = cached.record;
          logger.info('Using cached standings for team', { teamId: homeTeamId });
        }
      }

      if (!homeRecord) {
        const headers = this.ballDontLieKey ? { 'Authorization': this.ballDontLieKey } : {};
        const homeGamesResponse = await axios.get(`${this.ballDontLieURL}/games`, {
          params: {
            seasons: [currentSeason],
            team_ids: [homeTeamId],
            per_page: 100
          },
          headers
        });
        homeRecord = this.calculateRecord(homeGamesResponse.data.data, homeTeamId);
        this.nbaStandingsCache.set(homeCacheKey, { record: homeRecord, timestamp: Date.now() });
      }

      // Fetch away team data (with caching)
      if (this.nbaStandingsCache.has(awayCacheKey)) {
        const cached = this.nbaStandingsCache.get(awayCacheKey);
        if (Date.now() - cached.timestamp < this.cacheDuration) {
          awayRecord = cached.record;
          logger.info('Using cached standings for team', { teamId: awayTeamId });
        }
      }

      if (!awayRecord) {
        const headers = this.ballDontLieKey ? { 'Authorization': this.ballDontLieKey } : {};
        const awayGamesResponse = await axios.get(`${this.ballDontLieURL}/games`, {
          params: {
            seasons: [currentSeason],
            team_ids: [awayTeamId],
            per_page: 100
          },
          headers
        });
        awayRecord = this.calculateRecord(awayGamesResponse.data.data, awayTeamId);
        this.nbaStandingsCache.set(awayCacheKey, { record: awayRecord, timestamp: Date.now() });
      }

      // Estimate rankings based on win percentage
      const homeWinPct = homeRecord.wins / (homeRecord.wins + homeRecord.losses) || 0.5;
      const awayWinPct = awayRecord.wins / (awayRecord.wins + awayRecord.losses) || 0.5;

      return {
        home: {
          wins: homeRecord.wins,
          losses: homeRecord.losses,
          winRate: homeWinPct
        },
        away: {
          wins: awayRecord.wins,
          losses: awayRecord.losses,
          winRate: awayWinPct
        },
        homeRank: this.estimateRankFromWinRate(homeWinPct),
        awayRank: this.estimateRankFromWinRate(awayWinPct)
      };
    } catch (error) {
      logger.error('Error fetching NBA standings from BallDontLie', { error: error.message });
      // Return neutral data on error
      return {
        home: { wins: 0, losses: 0, winRate: 0.5 },
        away: { wins: 0, losses: 0, winRate: 0.5 },
        homeRank: 15,
        awayRank: 15
      };
    }
  }

  /**
   * Calculate win/loss record from game data
   */
  calculateRecord(games, teamId) {
    let wins = 0;
    let losses = 0;

    games.forEach(game => {
      // Only count completed games
      if (!game.home_team_score || !game.visitor_team_score) {
        return;
      }

      const isHome = game.home_team.id === teamId;
      const homeScore = game.home_team_score;
      const awayScore = game.visitor_team_score;

      if (isHome) {
        if (homeScore > awayScore) wins++;
        else losses++;
      } else {
        if (awayScore > homeScore) wins++;
        else losses++;
      }
    });

    return { wins, losses };
  }

  /**
   * Estimate team ranking based on win percentage
   * NBA has 30 teams, so map win% to rank 1-30
   */
  estimateRankFromWinRate(winRate) {
    // 0.750+ = Top 3
    // 0.650-0.749 = Rank 4-8
    // 0.550-0.649 = Rank 9-15
    // 0.450-0.549 = Rank 16-22
    // <0.450 = Rank 23-30

    if (winRate >= 0.750) return Math.floor(Math.random() * 3) + 1; // 1-3
    if (winRate >= 0.650) return Math.floor(Math.random() * 5) + 4; // 4-8
    if (winRate >= 0.550) return Math.floor(Math.random() * 7) + 9; // 9-15
    if (winRate >= 0.450) return Math.floor(Math.random() * 7) + 16; // 16-22
    return Math.floor(Math.random() * 8) + 23; // 23-30
  }

  /**
   * Get NBA injury reports
   * Note: Injury data requires premium APIs or web scraping
   * For now, assume no major injuries (conservative approach)
   */
  async getNBAInjuries(teamId) {
    // Conservative: Assume minimal injury impact
    // This means we rely on win/loss records and rankings only
    return {
      keyPlayersOut: 0,
      totalInjuries: 0,
      impactScore: 0 // 0-10 scale (0 = no impact)
    };
  }

  /**
   * Find team in API response by name matching
   */
  findTeam(teams, teamName) {
    const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');
    return teams.find(team => {
      const apiName = team.full_name.toLowerCase().replace(/[^a-z]/g, '');
      const cityName = team.city.toLowerCase().replace(/[^a-z]/g, '');
      const nickName = team.name.toLowerCase().replace(/[^a-z]/g, '');

      return apiName.includes(normalized) ||
             normalized.includes(apiName) ||
             normalized.includes(cityName) ||
             normalized.includes(nickName);
    });
  }

  /**
   * Calculate final prediction based on all factors
   */
  calculatePrediction(analysis) {
    const { homeTeam, awayTeam, sport } = analysis;

    let homeScore = 50; // Start neutral
    let awayScore = 50;
    let factors = [];

    // Factor 1: Win Rate Analysis
    const homeWinRate = homeTeam.record.wins / (homeTeam.record.wins + homeTeam.record.losses);
    const awayWinRate = awayTeam.record.wins / (awayTeam.record.wins + awayTeam.record.losses);
    const winRateDiff = homeWinRate - awayWinRate;

    // Lower threshold to 10% for more sensitive predictions
    if (Math.abs(winRateDiff) > 0.10) {
      const winRateBonus = winRateDiff * 100;
      homeScore += winRateBonus;
      awayScore -= winRateBonus;

      factors.push({
        factor: 'Win Rate',
        homeWinRate: (homeWinRate * 100).toFixed(1) + '%',
        awayWinRate: (awayWinRate * 100).toFixed(1) + '%',
        impact: winRateBonus.toFixed(1)
      });
    }

    // Factor 2: Rankings
    const rankingDiff = awayTeam.ranking - homeTeam.ranking; // Lower rank is better
    if (Math.abs(rankingDiff) >= this.rankingDifferenceThreshold) {
      const rankBonus = (rankingDiff / 30) * 15; // Scale to max 15 points
      homeScore += rankBonus;
      awayScore -= rankBonus;

      factors.push({
        factor: 'Ranking',
        homeRank: homeTeam.ranking,
        awayRank: awayTeam.ranking,
        impact: rankBonus.toFixed(1)
      });
    }

    // Factor 3: Injuries
    const homeInjuryImpact = homeTeam.injuries.impactScore;
    const awayInjuryImpact = awayTeam.injuries.impactScore;
    const injuryDiff = awayInjuryImpact - homeInjuryImpact;

    if (Math.abs(injuryDiff) > 2) {
      homeScore += injuryDiff * 2;
      awayScore -= injuryDiff * 2;

      factors.push({
        factor: 'Injuries',
        homeImpact: homeInjuryImpact,
        awayImpact: awayInjuryImpact,
        impact: (injuryDiff * 2).toFixed(1)
      });
    }

    // Factor 4: Home Court Advantage (consistent ~3-5% boost)
    const homeCourtBonus = 5;
    homeScore += homeCourtBonus;
    awayScore -= homeCourtBonus;

    factors.push({
      factor: 'Home Court',
      impact: homeCourtBonus
    });

    // Normalize to percentages
    const total = homeScore + awayScore;
    const homeWinProbability = homeScore / total;
    const awayWinProbability = awayScore / total;

    // Determine prediction
    const predicted = homeWinProbability > awayWinProbability ? 'home' : 'away';
    const confidence = Math.max(homeWinProbability, awayWinProbability);
    const predictedTeam = predicted === 'home' ? homeTeam.name : awayTeam.name;

    logger.info('Fundamental analysis complete', {
      predicted: predictedTeam,
      confidence: (confidence * 100).toFixed(1) + '%',
      homeProb: (homeWinProbability * 100).toFixed(1) + '%',
      awayProb: (awayWinProbability * 100).toFixed(1) + '%',
      factors
    });

    return {
      predicted, // 'home' or 'away'
      predictedWinner: predictedTeam, // Team name
      predictedTeam, // Keep for backwards compatibility
      confidence, // 0-1
      homeWinProbability,
      awayWinProbability,
      factors,
      reasoning: this.generateReasoning(homeTeam, awayTeam, factors, predicted)
    };
  }

  /**
   * Generate human-readable reasoning
   */
  generateReasoning(homeTeam, awayTeam, factors, predicted) {
    const predictedTeam = predicted === 'home' ? homeTeam : awayTeam;
    const reasons = [];

    factors.forEach(f => {
      if (f.factor === 'Win Rate') {
        reasons.push(`${predictedTeam.name} has better season record`);
      } else if (f.factor === 'Ranking') {
        reasons.push(`${predictedTeam.name} ranked significantly higher`);
      } else if (f.factor === 'Injuries') {
        const healthier = predicted === 'home' ? homeTeam.name : awayTeam.name;
        reasons.push(`${healthier} has healthier roster`);
      } else if (f.factor === 'Home Court') {
        if (predicted === 'home') {
          reasons.push('Home court advantage');
        }
      }
    });

    return reasons.join('. ') + '.';
  }

  /**
   * Basic prediction for sports without dedicated API
   */
  async predictBasic(event, sport) {
    // Simple heuristic based on team name patterns
    // This is a placeholder - would need sport-specific APIs
    logger.warn('Using basic prediction (limited data)', {
      sport,
      matchup: `${event.home} vs ${event.away}`
    });

    return {
      predicted: 'home',
      confidence: 0.55, // Low confidence for basic prediction
      homeWinProbability: 0.55,
      awayWinProbability: 0.45,
      factors: [{ factor: 'Home advantage', impact: 5 }],
      reasoning: 'Prediction based on home advantage only (limited data available)'
    };
  }

  async predictNHL(event) {
    try {
      // Official NHL API - Free, provides current 2024-2025 season data
      logger.info('Fetching NHL standings from official NHL API');

      const standingsResponse = await axios.get('https://api-web.nhle.com/v1/standings/now', {
        timeout: 10000
      });

      if (!standingsResponse.data || !standingsResponse.data.standings) {
        logger.warn('No NHL standings data available');
        return this.predictBasic(event, 'NHL');
      }

      // Find teams in standings
      const standings = standingsResponse.data.standings;
      const homeTeam = this.findNHLTeamInOfficialAPI(standings, event.home);
      const awayTeam = this.findNHLTeamInOfficialAPI(standings, event.away);

      if (!homeTeam || !awayTeam) {
        logger.warn('Could not find NHL teams in standings', {
          home: event.home,
          away: event.away
        });
        return this.predictBasic(event, 'NHL');
      }

      // Calculate prediction from standings
      return this.calculatePrediction({
        homeTeam: {
          name: event.home,
          record: {
            wins: homeTeam.wins,
            losses: homeTeam.losses,
            winRate: homeTeam.wins / (homeTeam.wins + homeTeam.losses)
          },
          injuries: { keyPlayersOut: 0, totalInjuries: 0, impactScore: 0 },
          ranking: homeTeam.position || 16
        },
        awayTeam: {
          name: event.away,
          record: {
            wins: awayTeam.wins,
            losses: awayTeam.losses,
            winRate: awayTeam.wins / (awayTeam.wins + awayTeam.losses)
          },
          injuries: { keyPlayersOut: 0, totalInjuries: 0, impactScore: 0 },
          ranking: awayTeam.position || 16
        },
        sport: 'NHL'
      });

    } catch (error) {
      logger.error('Error fetching NHL data', { error: error.message });
      return this.predictBasic(event, 'NHL');
    }
  }

  /**
   * Find NHL team in standings data
   */
  findNHLTeam(standings, teamName) {
    const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');

    for (const team of standings) {
      if (!team || !team.team) continue;

      const apiName = team.team.name.toLowerCase().replace(/[^a-z]/g, '');
      if (apiName.includes(normalized) || normalized.includes(apiName)) {
        return {
          wins: team.games.win.total || 0,
          losses: team.games.lose.total || 0,
          position: team.position || 16
        };
      }
    }

    return null;
  }

  /**
   * Find NHL team in official NHL API standings
   */
  findNHLTeamInOfficialAPI(standings, teamName) {
    const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');

    // Common NHL abbreviations
    const abbrevMap = {
      'la': 'losangeles',
      'tb': 'tampabay',
      'sj': 'sanjose',
      'nj': 'newjersey'
    };

    const parts = teamName.split(' ');
    let searchTerms = [normalized];

    if (parts.length > 1) {
      const firstPart = parts[0].toLowerCase().replace(/[^a-z]/g, '');
      const secondPart = parts.slice(1).join('').toLowerCase().replace(/[^a-z]/g, '');

      if (abbrevMap[firstPart]) {
        searchTerms.push(abbrevMap[firstPart] + secondPart);
      }
      searchTerms.push(secondPart);
    }

    for (const team of standings) {
      if (!team || !team.teamName) continue;

      const apiName = team.teamName.default.toLowerCase().replace(/[^a-z]/g, '');

      for (const term of searchTerms) {
        if (apiName.includes(term) || term.includes(apiName)) {
          // NHL uses wins, losses, and OT losses
          // Total losses = regulation losses + OT losses
          const totalLosses = team.losses + team.otLosses;
          return {
            wins: team.wins || 0,
            losses: totalLosses || 0,
            position: team.conferenceSequence || 16
          };
        }
      }
    }

    return null;
  }

  async predictNFL(event) {
    try {
      // ESPN NFL API - Free, unofficial but reliable
      // Provides current 2024-2025 season data
      logger.info('Fetching NFL team data from ESPN API');

      // Get all NFL teams
      const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams', {
        timeout: 10000
      });

      if (!teamsResponse.data || !teamsResponse.data.sports) {
        logger.warn('No NFL teams data available from ESPN');
        return this.predictBasic(event, 'NFL');
      }

      const allTeams = teamsResponse.data.sports[0]?.leagues[0]?.teams || [];

      // Find home and away teams
      const homeTeamData = this.findNFLTeamInESPN(allTeams, event.home);
      const awayTeamData = this.findNFLTeamInESPN(allTeams, event.away);

      if (!homeTeamData || !awayTeamData) {
        logger.warn('Could not find NFL teams in ESPN data', {
          home: event.home,
          away: event.away,
          homeFound: !!homeTeamData,
          awayFound: !!awayTeamData
        });
        return this.predictBasic(event, 'NFL');
      }

      // Fetch detailed team records
      logger.info('Fetching records for NFL teams', {
        homeId: homeTeamData.id,
        homeName: homeTeamData.name,
        awayId: awayTeamData.id,
        awayName: awayTeamData.name
      });

      const [homeTeam, awayTeam] = await Promise.all([
        this.getNFLTeamRecord(homeTeamData.id),
        this.getNFLTeamRecord(awayTeamData.id)
      ]);

      logger.info('Received NFL team records', {
        homeTeam: homeTeam,
        awayTeam: awayTeam
      });

      if (!homeTeam || !awayTeam) {
        logger.warn('Could not get NFL team records', {
          home: event.home,
          away: event.away,
          homeRecord: homeTeam,
          awayRecord: awayTeam
        });
        return this.predictBasic(event, 'NFL');
      }

      // Calculate prediction from standings
      return this.calculatePrediction({
        homeTeam: {
          name: event.home,
          record: {
            wins: homeTeam.wins,
            losses: homeTeam.losses,
            winRate: homeTeam.wins / (homeTeam.wins + homeTeam.losses)
          },
          injuries: { keyPlayersOut: 0, totalInjuries: 0, impactScore: 0 },
          ranking: homeTeam.position || 16
        },
        awayTeam: {
          name: event.away,
          record: {
            wins: awayTeam.wins,
            losses: awayTeam.losses,
            winRate: awayTeam.wins / (awayTeam.wins + awayTeam.losses)
          },
          injuries: { keyPlayersOut: 0, totalInjuries: 0, impactScore: 0 },
          ranking: awayTeam.position || 16
        },
        sport: 'NFL'
      });

    } catch (error) {
      logger.error('Error fetching NFL data', { error: error.message });
      return this.predictBasic(event, 'NFL');
    }
  }

  /**
   * Find NFL team in standings data
   */
  findNFLTeam(standings, teamName) {
    const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');

    // Common NFL abbreviations mapping
    const abbrevMap = {
      'kc': 'kansascity',
      'sf': 'sanfrancisco',
      'la': 'losangeles',
      'ne': 'newengland',
      'no': 'neworleans',
      'tb': 'tampabay',
      'gb': 'greenbay'
    };

    // Extract city abbreviation if present (e.g., "KC" from "KC Chiefs")
    const parts = teamName.split(' ');
    let searchTerms = [normalized];

    if (parts.length > 1) {
      const firstPart = parts[0].toLowerCase().replace(/[^a-z]/g, '');
      const secondPart = parts.slice(1).join('').toLowerCase().replace(/[^a-z]/g, '');

      // If first part is an abbreviation, expand it
      if (abbrevMap[firstPart]) {
        searchTerms.push(abbrevMap[firstPart] + secondPart);
      }
      // Also try just the team name (e.g., "Chiefs")
      searchTerms.push(secondPart);
    }

    // Standings is a flat array of team objects
    for (const teamData of standings) {
      if (!teamData || !teamData.team) continue;

      const apiName = teamData.team.name.toLowerCase().replace(/[^a-z]/g, '');

      // Try all search terms
      for (const term of searchTerms) {
        if (apiName.includes(term) || term.includes(apiName)) {
          return {
            wins: teamData.won || 0,
            losses: teamData.lost || 0,
            position: teamData.position || 16
          };
        }
      }
    }

    return null;
  }

  /**
   * Find NFL team in ESPN teams list
   */
  findNFLTeamInESPN(teams, teamName) {
    const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');

    // Common abbreviations
    const abbrevMap = {
      'kc': 'kansascity',
      'sf': 'sanfrancisco',
      'la': 'losangeles',
      'ne': 'newengland',
      'no': 'neworleans',
      'tb': 'tampabay',
      'gb': 'greenbay'
    };

    const parts = teamName.split(' ');
    let searchTerms = [normalized];

    if (parts.length > 1) {
      const firstPart = parts[0].toLowerCase().replace(/[^a-z]/g, '');
      const secondPart = parts.slice(1).join('').toLowerCase().replace(/[^a-z]/g, '');

      if (abbrevMap[firstPart]) {
        searchTerms.push(abbrevMap[firstPart] + secondPart);
      }
      searchTerms.push(secondPart);
    }

    for (const teamWrapper of teams) {
      if (!teamWrapper || !teamWrapper.team) continue;
      const team = teamWrapper.team;

      const displayName = team.displayName.toLowerCase().replace(/[^a-z]/g, '');

      for (const term of searchTerms) {
        if (displayName.includes(term) || term.includes(displayName)) {
          return { id: team.id, name: team.displayName };
        }
      }
    }

    return null;
  }

  /**
   * Get NFL team current season record from ESPN API
   */
  async getNFLTeamRecord(teamId) {
    try {
      const response = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}`, {
        timeout: 10000
      });

      if (!response.data || !response.data.team) {
        return null;
      }

      const team = response.data.team;
      const recordItem = team.record?.items?.find(item => item.type === 'total');

      if (!recordItem || !recordItem.summary) {
        logger.warn('No record found for NFL team', { teamId, teamName: team.displayName });
        return null;
      }

      // Parse "11-6" format
      const [wins, losses] = recordItem.summary.split('-').map(n => parseInt(n));

      return {
        wins: wins || 0,
        losses: losses || 0,
        position: this.estimateRankFromWinRate(wins / (wins + losses))
      };

    } catch (error) {
      logger.error('Error fetching NFL team record from ESPN', { teamId, error: error.message });
      return null;
    }
  }

  /**
   * Soccer prediction using API-Football (from API-Sports) and ESPN fallback
   */
  async predictSoccer(event) {
    try {
      // Get competition from either competition or league field
      const competition = event.competition || event.league || 'Unknown';

      // Get team standings using multi-source fallback
      const standings = await this.getSoccerStandingsMultiSource(event.home, event.away, competition);

      if (!standings) {
        logger.warn('Could not get soccer standings from any source', {
          home: event.home,
          away: event.away,
          competition
        });
        return null;
      }

      // Calculate prediction using soccer-specific factors
      return this.calculateSoccerPrediction({
        homeTeam: {
          name: event.home,
          stats: standings.home,
          position: standings.homePosition
        },
        awayTeam: {
          name: event.away,
          stats: standings.away,
          position: standings.awayPosition
        },
        competition
      });

    } catch (error) {
      logger.error('Error predicting soccer game', { error: error.message });
      return null;
    }
  }

  /**
   * Get soccer standings from multiple sources with fallback
   * Priority: 1) API-Sports Football API, 2) ESPN Soccer API, 3) Basic analysis
   */
  async getSoccerStandingsMultiSource(homeTeamName, awayTeamName, competition) {
    // Try API-Sports Football API first
    try {
      logger.info('Attempting to fetch soccer standings from API-Sports', {
        home: homeTeamName,
        away: awayTeamName,
        competition
      });
      const standings = await this.getSoccerStandingsFromAPISports(homeTeamName, awayTeamName, competition);
      if (standings) {
        logger.info('Successfully fetched soccer standings from API-Sports');
        return standings;
      }
    } catch (error) {
      logger.warn('API-Sports soccer failed, trying ESPN', { error: error.message });
    }

    // Fallback to ESPN Soccer API (no key required)
    try {
      logger.info('Attempting to fetch soccer standings from ESPN');
      const standings = await this.getSoccerStandingsFromESPN(homeTeamName, awayTeamName, competition);
      if (standings) {
        logger.info('Successfully fetched soccer standings from ESPN');
        return standings;
      }
    } catch (error) {
      logger.warn('ESPN soccer failed', { error: error.message });
    }

    logger.warn('All soccer data sources failed, cannot make prediction');
    return null;
  }

  /**
   * Fetch soccer standings from API-Sports Football API
   */
  async getSoccerStandingsFromAPISports(homeTeamName, awayTeamName, competition) {
    if (!this.apiKey) {
      logger.warn('API-Sports key not configured');
      return null;
    }

    const currentYear = new Date().getFullYear();
    // API-Sports free plan only supports seasons 2022-2024
    // Use 2024 as the most recent available season
    const season = currentYear > 2024 ? 2024 : currentYear;

    // Determine league ID from competition name or team names
    const leagueInfo = this.getLeagueInfo(competition, homeTeamName, awayTeamName);
    if (!leagueInfo) {
      logger.warn('Unknown soccer competition', { competition, home: homeTeamName, away: awayTeamName });
      return null;
    }

    const cacheKey = `soccer_${leagueInfo.id}_${season}`;

    // Check cache
    if (this.soccerStandingsCache.has(cacheKey)) {
      const cached = this.soccerStandingsCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheDuration) {
        logger.info('Using cached soccer standings', { league: competition });
        return this.extractSoccerTeamStandings(cached.data, homeTeamName, awayTeamName);
      }
    }

    try {
      // Fetch standings from API-Sports Football API
      logger.info('Fetching from API-Sports', { league: leagueInfo.id, season });
      const response = await axios.get(`${this.soccerURL}/standings`, {
        params: {
          league: leagueInfo.id,
          season: season
        },
        headers: {
          'x-apisports-key': this.apiKey
        },
        timeout: 10000
      });

      if (response.data && response.data.response && response.data.response.length > 0) {
        const standingsData = response.data.response[0].league.standings;

        // Cache the data
        this.soccerStandingsCache.set(cacheKey, {
          data: standingsData,
          timestamp: Date.now()
        });

        return this.extractSoccerTeamStandings(standingsData, homeTeamName, awayTeamName);
      }
    } catch (error) {
      logger.error('API-Sports soccer request failed', { error: error.message });
    }

    return null;
  }

  /**
   * Fetch soccer standings from ESPN Soccer API (free, no key required)
   */
  async getSoccerStandingsFromESPN(homeTeamName, awayTeamName, competition) {
    try {
      // ESPN has different endpoints for different leagues
      const espnLeague = this.getESPNLeague(competition);
      if (!espnLeague) {
        logger.warn('Competition not available in ESPN API', { competition });
        return null;
      }

      const cacheKey = `espn_soccer_${espnLeague}`;

      // Check cache
      if (this.soccerStandingsCache.has(cacheKey)) {
        const cached = this.soccerStandingsCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheDuration) {
          logger.info('Using cached ESPN soccer standings');
          return this.extractESPNSoccerStandings(cached.data, homeTeamName, awayTeamName);
        }
      }

      // Fetch from ESPN
      const response = await axios.get(
        `https://site.api.espn.com/apis/v2/sports/soccer/${espnLeague}/standings`,
        { timeout: 10000 }
      );

      if (response.data && response.data.children) {
        this.soccerStandingsCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
        return this.extractESPNSoccerStandings(response.data, homeTeamName, awayTeamName);
      }
    } catch (error) {
      logger.error('ESPN soccer request failed', { error: error.message });
    }

    return null;
  }

  /**
   * Get league info from competition name or infer from team names
   */
  getLeagueInfo(competition, homeTeam, awayTeam) {
    if (competition && competition !== 'unknown' && competition !== 'Unknown') {
      const compLower = competition.toLowerCase();

      for (const [leagueName, info] of Object.entries(this.soccerLeagueMap)) {
        if (compLower.includes(leagueName.toLowerCase())) {
          return info;
        }
      }

      // Try partial matching for common leagues
      if (compLower.includes('premier') || compLower.includes('epl')) {
        return this.soccerLeagueMap['Premier League'];
      }
      if (compLower.includes('la liga') || compLower.includes('spain')) {
        return this.soccerLeagueMap['La Liga'];
      }
      if (compLower.includes('bundesliga') || compLower.includes('germany')) {
        return this.soccerLeagueMap['Bundesliga'];
      }
      if (compLower.includes('serie a') || compLower.includes('italy')) {
        return this.soccerLeagueMap['Serie A'];
      }
      if (compLower.includes('ligue 1') || compLower.includes('france')) {
        return this.soccerLeagueMap['Ligue 1'];
      }
      if (compLower.includes('champions')) {
        return this.soccerLeagueMap['UEFA Champions League'];
      }
      if (compLower.includes('europa')) {
        return this.soccerLeagueMap['UEFA Europa League'];
      }
    }

    // If competition unknown, try to infer from team names
    const bundesligaTeams = ['bayern', 'dortmund', 'leipzig', 'leverkusen', 'frankfurt', 'stuttgart', 'wolfsburg', 'freiburg', 'mainz', 'hoffenheim', 'monchengladbach', 'union berlin', 'augsburg', 'bremen', 'pauli', 'heidenheim', 'bochum', 'koln', 'hamburg'];
    const premierTeams = ['arsenal', 'chelsea', 'liverpool', 'manchester', 'city', 'united', 'tottenham', 'newcastle', 'brighton', 'aston', 'villa', 'fulham', 'brentford', 'crystal palace', 'everton', 'leeds', 'wolves', 'bournemouth', 'nottingham', 'burnley', 'sunderland'];
    const laLigaTeams = ['barcelona', 'madrid', 'atletico', 'sevilla', 'valencia', 'villarreal', 'betis', 'sociedad', 'athletic', 'bilbao', 'osasuna'];
    const serieATeams = ['juventus', 'inter', 'milan', 'roma', 'lazio', 'napoli', 'atalanta', 'fiorentina'];
    const ligue1Teams = ['psg', 'paris', 'marseille', 'lyon', 'monaco', 'lille', 'lens', 'rennes', 'nice', 'strasbourg', 'brest', 'montpellier', 'nantes', 'reims', 'toulouse', 'lorient', 'auxerre', 'angers', 'havre', 'metz'];

    const bothTeams = `${homeTeam} ${awayTeam}`.toLowerCase();

    // Check German teams
    if (bundesligaTeams.some(t => bothTeams.includes(t))) {
      logger.info('Inferred Bundesliga from team names');
      return this.soccerLeagueMap['Bundesliga'];
    }

    // Check English teams
    if (premierTeams.some(t => bothTeams.includes(t))) {
      logger.info('Inferred Premier League from team names');
      return this.soccerLeagueMap['Premier League'];
    }

    // Check Spanish teams
    if (laLigaTeams.some(t => bothTeams.includes(t))) {
      logger.info('Inferred La Liga from team names');
      return this.soccerLeagueMap['La Liga'];
    }

    // Check Italian teams
    if (serieATeams.some(t => bothTeams.includes(t))) {
      logger.info('Inferred Serie A from team names');
      return this.soccerLeagueMap['Serie A'];
    }

    // Check French teams
    if (ligue1Teams.some(t => bothTeams.includes(t))) {
      logger.info('Inferred Ligue 1 from team names');
      return this.soccerLeagueMap['Ligue 1'];
    }

    return null;
  }

  /**
   * Get ESPN league identifier
   */
  getESPNLeague(competition) {
    if (!competition) return null;

    const compLower = competition.toLowerCase();

    if (compLower.includes('premier')) return 'eng.1';
    if (compLower.includes('la liga')) return 'esp.1';
    if (compLower.includes('bundesliga')) return 'ger.1';
    if (compLower.includes('serie a')) return 'ita.1';
    if (compLower.includes('ligue 1')) return 'fra.1';
    if (compLower.includes('champions')) return 'uefa.champions';

    return null;
  }

  /**
   * Extract team standings from API-Sports soccer data
   */
  extractSoccerTeamStandings(standingsData, homeTeamName, awayTeamName) {
    let homeTeam = null;
    let awayTeam = null;

    // API-Sports returns array of standings groups (could be multiple groups in league)
    for (const group of standingsData) {
      for (const team of group) {
        const teamName = team.team.name;

        if (this.matchTeamName(teamName, homeTeamName)) {
          homeTeam = {
            played: team.all.played,
            wins: team.all.win,
            draws: team.all.draw,
            losses: team.all.lose,
            goalsFor: team.all.goals.for,
            goalsAgainst: team.all.goals.against,
            goalDifference: team.goalsDiff,
            points: team.points,
            form: team.form, // Last 5 games (e.g., "WWDLW")
            homeRecord: {
              wins: team.home.win,
              draws: team.home.draw,
              losses: team.home.lose
            }
          };
        }

        if (this.matchTeamName(teamName, awayTeamName)) {
          awayTeam = {
            played: team.all.played,
            wins: team.all.win,
            draws: team.all.draw,
            losses: team.all.lose,
            goalsFor: team.all.goals.for,
            goalsAgainst: team.all.goals.against,
            goalDifference: team.goalsDiff,
            points: team.points,
            form: team.form,
            awayRecord: {
              wins: team.away.win,
              draws: team.away.draw,
              losses: team.away.lose
            }
          };
        }

        if (homeTeam && awayTeam) {
          return {
            home: homeTeam,
            away: awayTeam,
            homePosition: team.rank,
            awayPosition: team.rank
          };
        }
      }
    }

    return homeTeam && awayTeam ? { home: homeTeam, away: awayTeam } : null;
  }

  /**
   * Extract team standings from ESPN soccer data
   */
  extractESPNSoccerStandings(espnData, homeTeamName, awayTeamName) {
    let homeTeam = null;
    let awayTeam = null;

    if (!espnData.children || espnData.children.length === 0) {
      return null;
    }

    // ESPN groups standings by conference/division
    for (const group of espnData.children) {
      if (!group.standings || !group.standings.entries) continue;

      for (const entry of group.standings.entries) {
        const team = entry.team;
        const stats = entry.stats;

        if (this.matchTeamName(team.displayName, homeTeamName)) {
          homeTeam = this.parseESPNSoccerStats(stats);
        }

        if (this.matchTeamName(team.displayName, awayTeamName)) {
          awayTeam = this.parseESPNSoccerStats(stats);
        }

        if (homeTeam && awayTeam) break;
      }

      if (homeTeam && awayTeam) break;
    }

    return homeTeam && awayTeam ? { home: homeTeam, away: awayTeam } : null;
  }

  /**
   * Parse ESPN soccer statistics
   */
  parseESPNSoccerStats(stats) {
    const parsed = {};

    for (const stat of stats) {
      switch (stat.name) {
        case 'gamesPlayed':
          parsed.played = stat.value;
          break;
        case 'wins':
          parsed.wins = stat.value;
          break;
        case 'losses':
          parsed.losses = stat.value;
          break;
        case 'ties':
          parsed.draws = stat.value;
          break;
        case 'pointsFor':
          parsed.goalsFor = stat.value;
          break;
        case 'pointsAgainst':
          parsed.goalsAgainst = stat.value;
          break;
        case 'differential':
          parsed.goalDifference = stat.value;
          break;
        case 'points':
          parsed.points = stat.value;
          break;
      }
    }

    return parsed;
  }

  /**
   * Calculate soccer-specific prediction
   */
  calculateSoccerPrediction(data) {
    const { homeTeam, awayTeam, competition } = data;
    const factors = [];
    let homeScore = 50; // Start neutral
    let awayScore = 50;

    // Factor 1: League position (if available)
    if (homeTeam.position && awayTeam.position) {
      const positionDiff = awayTeam.position - homeTeam.position;
      if (Math.abs(positionDiff) >= 3) {
        const impact = Math.min(Math.abs(positionDiff) * 2, 15);
        if (positionDiff > 0) {
          homeScore += impact;
          factors.push({ factor: 'Higher League Position', impact });
        } else {
          awayScore += impact;
          factors.push({ factor: 'Lower League Position', impact: -impact });
        }
      }
    }

    // Factor 2: Points/Win rate
    const homeWinRate = homeTeam.stats.wins / homeTeam.stats.played;
    const awayWinRate = awayTeam.stats.wins / awayTeam.stats.played;
    const winRateDiff = homeWinRate - awayWinRate;

    if (Math.abs(winRateDiff) > 0.15) {
      const impact = Math.min(Math.abs(winRateDiff) * 30, 15);
      if (winRateDiff > 0) {
        homeScore += impact;
        factors.push({ factor: 'Better Win Rate', impact });
      } else {
        awayScore += impact;
        factors.push({ factor: 'Better Win Rate (away)', impact: -impact });
      }
    }

    // Factor 3: Goal difference
    const homeGD = homeTeam.stats.goalDifference || 0;
    const awayGD = awayTeam.stats.goalDifference || 0;
    const gdDiff = homeGD - awayGD;

    if (Math.abs(gdDiff) > 5) {
      const impact = Math.min(Math.abs(gdDiff) / 2, 10);
      if (gdDiff > 0) {
        homeScore += impact;
        factors.push({ factor: 'Superior Goal Difference', impact });
      } else {
        awayScore += impact;
        factors.push({ factor: 'Superior Goal Difference (away)', impact: -impact });
      }
    }

    // Factor 4: Recent form (if available)
    if (homeTeam.stats.form && awayTeam.stats.form) {
      const homeFormScore = this.calculateFormScore(homeTeam.stats.form);
      const awayFormScore = this.calculateFormScore(awayTeam.stats.form);
      const formDiff = homeFormScore - awayFormScore;

      if (Math.abs(formDiff) > 1) {
        const impact = formDiff * 3;
        if (formDiff > 0) {
          homeScore += impact;
          factors.push({ factor: 'Better Recent Form', impact });
        } else {
          awayScore -= impact;
          factors.push({ factor: 'Better Recent Form (away)', impact });
        }
      }
    }

    // Factor 5: Home advantage in soccer (significant)
    const homeAdvantage = 8;
    homeScore += homeAdvantage;
    factors.push({ factor: 'Home Advantage', impact: homeAdvantage });

    // Factor 6: Home/Away specific records
    if (homeTeam.stats.homeRecord && awayTeam.stats.awayRecord) {
      const homeHomeWins = homeTeam.stats.homeRecord.wins;
      const awayAwayWins = awayTeam.stats.awayRecord.wins;

      if (homeHomeWins > awayAwayWins + 3) {
        const impact = 5;
        homeScore += impact;
        factors.push({ factor: 'Strong Home Record', impact });
      } else if (awayAwayWins > homeHomeWins + 3) {
        const impact = 5;
        awayScore += impact;
        factors.push({ factor: 'Strong Away Record', impact });
      }
    }

    // Calculate final probabilities
    const total = homeScore + awayScore;
    const homeWinProbability = homeScore / total;
    const awayWinProbability = awayScore / total;

    // Determine prediction
    const predicted = homeWinProbability > awayWinProbability ? 'home' : 'away';
    const predictedTeam = predicted === 'home' ? homeTeam.name : awayTeam.name;
    const confidence = Math.max(homeWinProbability, awayWinProbability);

    return {
      predicted,
      predictedWinner: predictedTeam,
      predictedTeam,
      confidence,
      homeWinProbability,
      awayWinProbability,
      factors,
      reasoning: this.generateSoccerReasoning(homeTeam, awayTeam, factors, predicted)
    };
  }

  /**
   * Calculate form score from form string (e.g., "WWDLW")
   * W = 3 points, D = 1 point, L = 0 points
   */
  calculateFormScore(form) {
    if (!form) return 0;

    let score = 0;
    for (const result of form.split('')) {
      if (result === 'W') score += 3;
      else if (result === 'D') score += 1;
      // L = 0 points
    }

    return score / form.length; // Average per game
  }

  /**
   * Generate reasoning for soccer prediction
   */
  generateSoccerReasoning(homeTeam, awayTeam, factors, predicted) {
    const predictedTeam = predicted === 'home' ? homeTeam : awayTeam;
    const reasons = [];

    // Summarize key factors
    const significantFactors = factors.filter(f => Math.abs(f.impact) >= 5);
    if (significantFactors.length > 0) {
      reasons.push(significantFactors.map(f => f.factor).join(', '));
    }

    // Add record info
    const teamStats = predictedTeam.stats;
    if (teamStats.wins && teamStats.played) {
      const winRate = ((teamStats.wins / teamStats.played) * 100).toFixed(0);
      reasons.push(`${winRate}% win rate`);
    }

    // Add goal difference if significant
    if (teamStats.goalDifference && Math.abs(teamStats.goalDifference) > 5) {
      reasons.push(`+${teamStats.goalDifference} goal difference`);
    }

    return reasons.join('; ');
  }
}


module.exports = FundamentalAnalysisPredictor;
