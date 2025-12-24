require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

async function diagnoseOddsExtraction() {
  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSING ODDS EXTRACTION BUG');
  console.log('='.repeat(80) + '\n');

  // Get soccer opportunities
  console.log('Fetching soccer opportunities...\n');

  // Temporarily patch the extractBookmakerOdds function to log what it's doing
  const originalExtract = multiBookmakerAggregator.extractBookmakerOdds.bind(multiBookmakerAggregator);

  let callCount = 0;
  multiBookmakerAggregator.extractBookmakerOdds = function(oddsApiEvent, cloudbetSide) {
    const result = originalExtract(oddsApiEvent, cloudbetSide);

    if (callCount < 5) {  // Only log first 5 calls
      console.log(`\nCall #${callCount + 1}:`);
      console.log(`  Event: ${oddsApiEvent?.home_team} vs ${oddsApiEvent?.away_team}`);
      console.log(`  CloudBet side: ${cloudbetSide}`);
      console.log(`  Bookmakers returned: ${result.length}`);

      if (result.length > 0) {
        console.log(`  Sample bookmaker #1: ${result[0].bookmaker}`);
        console.log(`  Odds object:`, result[0].odds);
        console.log(`  Has odds for '${cloudbetSide}': ${result[0].odds[cloudbetSide] !== undefined}`);
      }

      callCount++;
    }

    return result;
  };

  const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');

  console.log('\n' + '='.repeat(80));
  console.log(`RESULT: Found ${opportunities.length} opportunities`);
  console.log('='.repeat(80) + '\n');

  if (opportunities.length > 0) {
    console.log('Sample opportunity:\n');
    const opp = opportunities[0];
    console.log(`  ${opp.home} vs ${opp.away}`);
    console.log(`  Side: ${opp.side}`);
    console.log(`  CloudBet odds: ${opp.cloudbetOdds}`);
    console.log(`  Bookmakers: ${opp.totalBookmakers}`);
    console.log(`  Sharp bookmakers: ${opp.sharpBookCount}`);
    console.log('');
  }
}

diagnoseOddsExtraction().catch(console.error);
