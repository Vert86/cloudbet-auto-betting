/**
 * Test odds extraction and opportunity finding
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');
const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');
const logger = require('./src/utils/logger');

async function testOddsExtraction() {
  console.log('\n=== Testing Odds Extraction ===\n');

  try {
    // Test basketball
    console.log('1. Fetching basketball events...');
    const basketballEvents = await cloudbetAPI.getSportEvents('basketball');
    console.log(`   Found ${basketballEvents.events.length} trading events`);

    if (basketballEvents.events.length > 0) {
      const sampleEvent = basketballEvents.events[0];
      console.log(`\n2. Sample event: ${sampleEvent.home.name} vs ${sampleEvent.away.name}`);
      console.log(`   Status: ${sampleEvent.status}`);
      console.log(`   Markets: ${Object.keys(sampleEvent.markets || {}).length}`);

      // Test aggregation
      console.log(`\n3. Aggregating odds for basketball...`);
      const aggregated = await cloudbetOddsAggregator.aggregateOdds('basketball');
      console.log(`   Cloudbet events normalized: ${aggregated.cloudbet.length}`);
      console.log(`   External events: ${aggregated.external.length}`);

      if (aggregated.cloudbet.length > 0) {
        const firstEvent = aggregated.cloudbet[0];
        console.log(`\n4. First normalized event:`);
        console.log(`   ${firstEvent.home} vs ${firstEvent.away}`);
        console.log(`   Markets: ${Object.keys(firstEvent.markets).join(', ')}`);

        const markets = firstEvent.markets;
        const moneylineKey = Object.keys(markets).find(k => k.includes('moneyline'));
        if (moneylineKey) {
          console.log(`\n5. Moneyline market (${moneylineKey}):`);
          const moneyline = markets[moneylineKey];
          moneyline.selections.forEach(sel => {
            console.log(`     ${sel.side}: ${sel.price} (${sel.name})`);
          });
        }
      }

      // Test opportunity finding
      console.log(`\n6. Finding value bets...`);
      const valueBets = cloudbetOddsAggregator.findValueBets(aggregated, 2.0);
      console.log(`   Found ${valueBets.length} opportunities with 2% edge`);

      if (valueBets.length > 0) {
        console.log(`\n7. Sample opportunity:`);
        const opp = valueBets[0];
        console.log(`   ${opp.home} vs ${opp.away}`);
        console.log(`   Market: ${opp.marketName}`);
        console.log(`   Selection: ${opp.selectionName} (${opp.side})`);
        console.log(`   Odds: ${opp.price}`);
        console.log(`   Edge: ${opp.edge}%`);
      } else {
        console.log(`   Try lowering MIN_EDGE_PERCENTAGE in .env for testing`);
      }
    }

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testOddsExtraction();
