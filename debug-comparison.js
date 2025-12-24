/**
 * Debug odds comparison
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');
const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');

async function debugComparison() {
  console.log('\n=== Debugging Odds Comparison ===\n');

  try {
    const aggregated = await cloudbetOddsAggregator.aggregateOdds('basketball');

    console.log(`Total Cloudbet events: ${aggregated.cloudbet.length}`);
    console.log(`Total External events: ${aggregated.external.length}\n`);

    // Show first Cloudbet event
    if (aggregated.cloudbet.length > 0) {
      const cbEvent = aggregated.cloudbet[0];
      console.log('Sample Cloudbet event:');
      console.log(`  ${cbEvent.home} vs ${cbEvent.away}`);
      console.log(`  Has moneyline: ${Object.keys(cbEvent.markets).some(k => k.includes('moneyline'))}`);

      const moneylineKey = Object.keys(cbEvent.markets).find(k => k.includes('moneyline'));
      if (moneylineKey) {
        const moneyline = cbEvent.markets[moneylineKey];
        console.log(`  Selections:`);
        moneyline.selections.forEach(sel => {
          console.log(`    ${sel.side || sel.name}: ${sel.price}`);
        });
      }
    }

    console.log('\n');

    // Show first External event
    if (aggregated.external.length > 0) {
      const extEvent = aggregated.external[0];
      console.log('Sample External event:');
      console.log(`  ${extEvent.home} vs ${extEvent.away}`);
      console.log(`  Markets: ${Object.keys(extEvent.markets).join(', ')}`);

      if (extEvent.markets.h2h) {
        console.log(`  H2H market bookmakers: ${extEvent.markets.h2h.length}`);
        const avgOdds = cloudbetOddsAggregator.calculateAverageOdds(extEvent.markets, 'h2h');
        console.log(`  Average H2H odds:`, avgOdds);
      }
    }

    console.log('\n');

    // Test team matching
    if (aggregated.cloudbet.length > 0 && aggregated.external.length > 0) {
      const cbEvent = aggregated.cloudbet[0];
      console.log('Testing team matching:');
      console.log(`  Cloudbet: "${cbEvent.home}" vs "${cbEvent.away}"`);

      for (let i = 0; i < Math.min(3, aggregated.external.length); i++) {
        const extEvent = aggregated.external[i];
        const homeMatch = cloudbetOddsAggregator.teamsMatch(cbEvent.home, extEvent.home);
        const awayMatch = cloudbetOddsAggregator.teamsMatch(cbEvent.away, extEvent.away);
        console.log(`  External[${i}]: "${extEvent.home}" vs "${extEvent.away}"`);
        console.log(`    Home match: ${homeMatch}, Away match: ${awayMatch}`);
      }
    }

    console.log('\n=== Debug Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugComparison();
