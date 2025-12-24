const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');
const logger = require('./src/utils/logger');

async function testAPIIntegration() {
  console.log('=== Testing Fundamental Analysis API Integration ===\n');

  const predictor = new FundamentalAnalysisPredictor();

  // Test NBA
  console.log('1. Testing NBA (BallDontLie API)...');
  try {
    const nbaPrediction = await predictor.predictWinner({
      home: 'Lakers',
      away: 'Pistons'
    }, 'basketball');

    if (nbaPrediction) {
      console.log('✅ NBA prediction successful!');
      console.log(`   Predicted: ${nbaPrediction.predictedTeam}`);
      console.log(`   Confidence: ${(nbaPrediction.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${nbaPrediction.reasoning}\n`);
    } else {
      console.log('❌ NBA prediction returned null\n');
    }
  } catch (error) {
    console.log(`❌ NBA test failed: ${error.message}\n`);
  }

  // Test NFL
  console.log('2. Testing NFL (API-Sports)...');
  try {
    const nflPrediction = await predictor.predictWinner({
      home: '49ers',
      away: 'Cardinals'
    }, 'american-football');

    if (nflPrediction) {
      console.log('✅ NFL prediction successful!');
      console.log(`   Predicted: ${nflPrediction.predictedTeam}`);
      console.log(`   Confidence: ${(nflPrediction.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${nflPrediction.reasoning}\n`);
    } else {
      console.log('❌ NFL prediction returned null\n');
    }
  } catch (error) {
    console.log(`❌ NFL test failed: ${error.message}\n`);
  }

  // Test NHL
  console.log('3. Testing NHL (API-Sports)...');
  try {
    const nhlPrediction = await predictor.predictWinner({
      home: 'Bruins',
      away: 'Sabres'
    }, 'ice-hockey');

    if (nhlPrediction) {
      console.log('✅ NHL prediction successful!');
      console.log(`   Predicted: ${nhlPrediction.predictedTeam}`);
      console.log(`   Confidence: ${(nhlPrediction.confidence * 100).toFixed(1)}%`);
      console.log(`   Reasoning: ${nhlPrediction.reasoning}\n`);
    } else {
      console.log('❌ NHL prediction returned null\n');
    }
  } catch (error) {
    console.log(`❌ NHL test failed: ${error.message}\n`);
  }

  console.log('=== Test Complete ===');
  console.log('\nIf you see ✅ for all three sports, the integration is working!');
  console.log('If you see "basic prediction" warnings, check your API keys in .env\n');
}

testAPIIntegration();
