require('dotenv').config();
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

async function test() {
  console.log('Testing NBA prediction for Trail Blazers vs Magic...\n');

  const predictor = new FundamentalAnalysisPredictor();

  const event = {
    home: 'POR Trail Blazers',
    away: 'ORL Magic'
  };

  try {
    const prediction = await predictor.predictNBA(event);

    if (prediction) {
      console.log('✅ Prediction received:');
      console.log(`   Predicted winner: ${prediction.predictedTeam}`);
      console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
      console.log(`   Minimum threshold: 60%`);
      console.log(`   Passes threshold: ${prediction.confidence >= 0.60 ? 'YES ✅' : 'NO ❌'}`);

      if (prediction.homeAnalysis && prediction.awayAnalysis) {
        console.log(`\n   Home (Trail Blazers): ${prediction.homeAnalysis.wins}-${prediction.homeAnalysis.losses} (${(prediction.homeAnalysis.winRate * 100).toFixed(1)}%)`);
        console.log(`   Away (Magic): ${prediction.awayAnalysis.wins}-${prediction.awayAnalysis.losses} (${(prediction.awayAnalysis.winRate * 100).toFixed(1)}%)`);
      }
    } else {
      console.log('❌ No prediction returned');
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error.stack);
  }
}

test();
