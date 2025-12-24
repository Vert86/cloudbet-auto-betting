/**
 * Test internal opportunity finding (without external API)
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');
const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');

async function testInternalOpportunities() {
  console.log('\n=== Testing Internal Opportunity Finding ===\n');
  console.log('Mode: Cloudbet internal analysis only (no external comparison)\n');

  try {
    // Test with multiple sports
    const sports = ['soccer', 'basketball', 'american-football'];
    let totalOpportunities = 0;

    for (const sport of sports) {
      console.log(`\nAnalyzing ${sport}...`);

      const data = await cloudbetAPI.getSportEvents(sport);
      console.log(`  Events found: ${data.events.length}`);

      if (data.events.length === 0) continue;

      // Aggregate odds (will use internal only since external API is disabled)
      const aggregated = await cloudbetOddsAggregator.aggregateOdds(sport);

      // Find opportunities with 1% minimum edge
      const opportunities = cloudbetOddsAggregator.findValueBets(aggregated, 1.0);
      totalOpportunities += opportunities.length;

      console.log(`  Opportunities found: ${opportunities.length}`);

      if (opportunities.length > 0) {
        console.log(`\n  Sample opportunities:`);
        opportunities.slice(0, 3).forEach((opp, i) => {
          console.log(`    ${i + 1}. ${opp.home} vs ${opp.away}`);
          console.log(`       ${opp.selectionName} @ ${opp.price} (edge: ${opp.edge}%)`);
          console.log(`       Market: ${opp.marketName}`);
        });
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total opportunities across all sports: ${totalOpportunities}`);
    console.log(`\nSettings:`);
    console.log(`  - MIN_EDGE_PERCENTAGE: 1.0%`);
    console.log(`  - Odds range: 1.5 - 10.0`);
    console.log(`  - Max bookmaker margin: 8%`);
    console.log(`  - Scanning 10 competitions per sport`);
    console.log(`\n=== Test Complete ===\n`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testInternalOpportunities();
