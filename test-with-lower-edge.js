/**
 * Test with lower edge threshold
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');
const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');

async function testWithLowerEdge() {
  console.log('\n=== Testing with Different Edge Thresholds ===\n');

  try {
    console.log('Aggregating basketball odds...');
    const aggregated = await cloudbetOddsAggregator.aggregateOdds('basketball');
    console.log(`Cloudbet events: ${aggregated.cloudbet.length}`);
    console.log(`External events: ${aggregated.external.length}\n`);

    // Test with different thresholds
    const thresholds = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

    for (const threshold of thresholds) {
      const valueBets = cloudbetOddsAggregator.findValueBets(aggregated, threshold);
      console.log(`Edge ${threshold}%: ${valueBets.length} opportunities`);

      if (valueBets.length > 0 && threshold === thresholds.find(t => valueBets.length > 0)) {
        console.log(`\nFirst opportunity at ${threshold}% edge:`);
        const opp = valueBets[0];
        console.log(`  ${opp.home} vs ${opp.away}`);
        console.log(`  ${opp.selectionName} @ ${opp.price}`);
        console.log(`  Edge: ${opp.edge}%`);
        console.log(`  Market: ${opp.marketKey}\n`);
      }
    }

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWithLowerEdge();
