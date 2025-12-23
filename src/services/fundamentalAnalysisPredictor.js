const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Fundamental Analysis Predictor
 * Makes predictions based on team performance, rankings, and injuries
 * rather than relying on odds comparison
 */
class FundamentalAnalysisPredictor {
  constructor() {
    // API-Sports provides free access to NBA, NHL, NFL data
    this.apiKey = process.env.API_SPORTS_KEY || null;
    this.baseURL = 'https://v1.american-football.api-sports.io'; // NFL
    this.nbaURL = 'https://v2.nba.api-sports.io';
    this.nhlURL = 'https://v1.hockey.api-sports.io';

    // BallDontLie - requires API key as of 2025
    this.ballDontLieURL = 'https://api.balldontlie.io/v1';
    this.ballDontLieKey = process.env.BALLDONTLIE_API_KEY || null;

    // Caching to avoid rate limits (BallDontLie has strict limits on free tier)
    this.nbaTeamsCache = null;
    this.nbaTeamsCacheTime = null;
    this.nbaStandingsCache = new Map(); // Cache standings per team
    this.cacheDuration = 30 * 60 * 1000; // 30 minutes

    // Thresholds for predictions
    this.strongFavoriteThreshold = 0.65; // Win rate difference
    this.rankingDifferenceThreshold = 5; // Ranking positions
    this.injuryImpactThreshold = 2; // Number of key players injured
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
      // Check cache for NBA teams to avoid rate limits
      if (!this.nbaTeamsCache || !this.nbaTeamsCacheTime ||
          Date.now() - this.nbaTeamsCacheTime > this.cacheDuration) {
        // BallDontLie provides team stats - requires API key as of 2025
        const headers = this.ballDontLieKey ? { 'Authorization': this.ballDontLieKey } : {};
        const teamsResponse = await axios.get(`${this.ballDontLieURL}/teams`, { headers });
        this.nbaTeamsCache = teamsResponse.data.data;
        this.nbaTeamsCacheTime = Date.now();
        logger.info('Fetched and cached NBA teams', { count: this.nbaTeamsCache.length });
      } else {
        logger.info('Using cached NBA teams', { count: this.nbaTeamsCache.length });
      }

      const teams = this.nbaTeamsCache;

      // Find home and away teams
      const homeTeam = this.findTeam(teams, event.home);
      const awayTeam = this.findTeam(teams, event.away);

      if (!homeTeam || !awayTeam) {
        logger.warn('Could not find NBA teams', {
          home: event.home,
          away: event.away
        });
        return null;
      }

      // Get team standings/records
      const standings = await this.getNBAStandings(homeTeam.id, awayTeam.id);

      // Get injury reports
      const homeInjuries = await this.getNBAInjuries(homeTeam.id);
      const awayInjuries = await this.getNBAInjuries(awayTeam.id);

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
   * Get NBA team standings and records from BallDontLie API
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

    if (Math.abs(winRateDiff) > 0.2) {
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
      predictedTeam,
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
    if (!this.apiKey) {
      logger.warn('API-Sports key not configured, using basic NHL prediction');
      return this.predictBasic(event, 'NHL');
    }

    try {
      // API-Sports Hockey endpoint for standings
      // NOTE: Free tier only has 2023 season data; current season requires paid tier
      // Using 2023 standings as baseline for team strength (still valuable for predictions)
      const season = 2023; // Most recent available season on free tier
      const standingsResponse = await axios.get(`${this.nhlURL}/standings`, {
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v1.hockey.api-sports.io'
        },
        params: {
          league: 57, // NHL
          season: season
        }
      });

      if (!standingsResponse.data || !standingsResponse.data.response || !standingsResponse.data.response[0]) {
        logger.warn('No NHL standings data available');
        return this.predictBasic(event, 'NHL');
      }

      // Find teams in standings
      const standings = standingsResponse.data.response[0]; // First array contains all teams
      const homeTeam = this.findNHLTeam(standings, event.home);
      const awayTeam = this.findNHLTeam(standings, event.away);

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

  async predictNFL(event) {
    if (!this.apiKey) {
      logger.warn('API-Sports key not configured, using basic NFL prediction');
      return this.predictBasic(event, 'NFL');
    }

    try {
      // API-Sports American Football endpoint for standings
      // NOTE: Free tier only has 2023 season data; current season requires paid tier
      // Using 2023 standings as baseline for team strength (still valuable for predictions)
      const season = 2023; // Most recent available season on free tier
      const standingsResponse = await axios.get(`${this.baseURL}/standings`, {
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v1.american-football.api-sports.io'
        },
        params: {
          league: 1, // NFL
          season: season
        }
      });

      if (!standingsResponse.data || !standingsResponse.data.response) {
        logger.warn('No NFL standings data available');
        return this.predictBasic(event, 'NFL');
      }

      // Find teams in standings
      const standings = standingsResponse.data.response;
      const homeTeam = this.findNFLTeam(standings, event.home);
      const awayTeam = this.findNFLTeam(standings, event.away);

      if (!homeTeam || !awayTeam) {
        logger.warn('Could not find NFL teams in standings', {
          home: event.home,
          away: event.away
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
   * Soccer prediction using API-Football (from API-Sports)
   */
  async predictSoccer(event) {
    // For now, disable soccer predictions since we don't have proper data
    // Soccer requires league-specific standings which varies by country
    logger.info('Soccer predictions not yet implemented', {
      matchup: `${event.home} vs ${event.away}`,
      recommendation: 'Focus on NBA/NFL/NHL for best results'
    });

    return null; // Return null to skip soccer bets for now
  }
}


module.exports = FundamentalAnalysisPredictor;
