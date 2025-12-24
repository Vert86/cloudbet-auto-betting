require('dotenv').config();
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

async function testNFLMatching() {
  const predictor = new FundamentalAnalysisPredictor();

  console.log('Testing NFL team matching with CloudBet names...\n');

  const testGames = [
    { home: 'DAL Cowboys', away: 'LA Chargers' },
    { home: 'MIA Dolphins', away: 'CIN Bengals' },
    { home: 'NO Saints', away: 'NY Jets' },
    { home: 'NY Giants', away: 'MIN Vikings' },
    { home: 'TEN Titans', away: 'KC Chiefs' }
  ];

  for (const game of testGames) {
    console.log(`Testing: ${game.home} vs ${game.away}`);

    try {
      const prediction = await predictor.predictNFL(game);

      if (prediction && prediction.confidence > 0.55) {
        console.log(`  ✅ Success! Predicted: ${prediction.predictedTeam} (${(prediction.confidence * 100).toFixed(1)}%)`);
      } else {
        console.log(`  ⚠️  Basic prediction only (${prediction ? (prediction.confidence * 100).toFixed(1) : 'null'}%)`);
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    console.log();
  }
}

testNFLMatching();
