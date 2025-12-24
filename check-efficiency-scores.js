require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');
const advancedBettingStrategy = require('./src/services/advancedBettingStrategy');

async function checkScores() {
  console.log('Checking efficiency scores for current opportunities...\n');

  const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');
  console.log(`Found ${opportunities.length} opportunities\n`);

  // Sample first 5
  for (let i = 0; i < Math.min(5, opportunities.length); i++) {
    const opp = opportunities[i];
    const efficiency = await advancedBettingStrategy.analyzeMarketEfficiency(opp);

    console.log(`${i + 1}. ${opp.home} vs ${opp.away}`);
    console.log(`   Market: ${opp.marketType}`);
    console.log(`   Side: ${opp.side}`);
    console.log(`   Efficiency Score: ${efficiency.score}/100`);
    console.log(`   Required: ${process.env.MIN_EFFICIENCY_SCORE || 50}`);
    console.log(`   Status: ${efficiency.score >= (parseInt(process.env.MIN_EFFICIENCY_SCORE) || 50) ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   Reasons: ${efficiency.reasons.join(', ')}`);
    console.log('');
  }
}

checkScores().catch(console.error);
