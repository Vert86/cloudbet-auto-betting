require('dotenv').config();
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

async function testNFLFix() {
  console.log('Testing NFL prediction with fixed code...\n');

  const predictor = new FundamentalAnalysisPredictor();

  // Test with a real NFL game from CloudBet
  const testEvent = {
    home: 'TEN Titans',
    away: 'KC Chiefs'
  };

  try {
    const prediction = await predictor.predictNFL(testEvent);

    if (prediction) {
      console.log('✅ NFL Prediction successful!\n');
      console.log('Predicted winner:', prediction.predictedTeam);
      console.log('Confidence:', (prediction.confidence * 100).toFixed(1) + '%');
      console.log('Reasoning:', prediction.reasoning);
    } else {
      console.log('❌ Prediction returned null');
    }

  } catch (error) {
    console.log('❌ Error:', error.message);
    console.log(error.stack);
  }
}

testNFLFix();
