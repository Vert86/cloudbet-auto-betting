require('dotenv').config();

module.exports = {
  pinnacle: {
    username: process.env.PINNACLE_USERNAME,
    password: process.env.PINNACLE_PASSWORD,
    baseUrl: process.env.PINNACLE_API_BASE_URL || 'https://api.pinnacle.com',
  },
  betting: {
    minOdds: parseFloat(process.env.MIN_ODDS) || 1.50,
    maxOdds: parseFloat(process.env.MAX_ODDS) || 5.00,
    minBetAmount: parseFloat(process.env.MIN_BET_AMOUNT) || 10,
    maxBetAmount: parseFloat(process.env.MAX_BET_AMOUNT) || 100,
    maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS) || 500,
    maxTotalExposure: parseFloat(process.env.MAX_TOTAL_EXPOSURE) || 1000,
  },
  riskManagement: {
    kellyFraction: parseFloat(process.env.KELLY_FRACTION) || 0.25,
    minEdgePercentage: parseFloat(process.env.MIN_EDGE_PERCENTAGE) || 2.0,
    maxBetsPerDay: parseInt(process.env.MAX_BETS_PER_DAY) || 10,
    bankrollPercentagePerBet: parseFloat(process.env.BANKROLL_PERCENTAGE_PER_BET) || 2,
  },
  oddsApi: {
    apiKey: process.env.ODDS_API_KEY,
    baseUrl: 'https://api.the-odds-api.com/v4',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};
