/**
 * Test actual odds comparison to see if Cloudbet has value
 */

const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');

async function testActualComparison() {
  console.log('\n=== Testing Actual Odds Comparison ===\n');

  try {
    const aggregated = await cloudbetOddsAggregator.aggregateOdds('basketball');

    // Find a matched event
    for (const cbEvent of aggregated.cloudbet) {
      const extEvent = cloudbetOddsAggregator.findMatchingExternalEvent(cbEvent, aggregated.external);

      if (extEvent) {
        console.log(`\nMatched Event: ${cbEvent.home} vs ${cbEvent.away}`);

        // Get moneyline markets
        const cbMoneylineKey = Object.keys(cbEvent.markets).find(k => k.includes('moneyline'));
        if (!cbMoneylineKey) continue;

        const cbMoneyline = cbEvent.markets[cbMoneylineKey];
        const homeSelection = cbMoneyline.selections.find(s => s.side === 'home' || s.side === 'BACK');
        const awaySelection = cbMoneyline.selections.find(s => s.side === 'away' || s.side === 'BACK');

        if (!homeSelection || !awaySelection) continue;

        console.log(`Cloudbet odds:`);
        console.log(`  Home: ${homeSelection.price}`);
        console.log(`  Away: ${awaySelection.price}`);

        // Get external average
        const externalH2H = cloudbetOddsAggregator.calculateAverageOdds(extEvent.markets, 'h2h');
        if (externalH2H) {
          console.log(`\nExternal average odds:`);
          console.log(`  ${JSON.stringify(externalH2H, null, 2)}`);

          // Calculate edges
          const homeKey = Object.keys(externalH2H).find(k => k.toLowerCase().includes(cbEvent.home.toLowerCase().split(' ').pop()));
          const awayKey = Object.keys(externalH2H).find(k => k.toLowerCase().includes(cbEvent.away.toLowerCase().split(' ').pop()));

          if (homeKey && awayKey) {
            const homeEdge = ((homeSelection.price / externalH2H[homeKey]) - 1) * 100;
            const awayEdge = ((awaySelection.price / externalH2H[awayKey]) - 1) * 100;

            console.log(`\nEdge calculation:`);
            console.log(`  Home edge: ${homeEdge.toFixed(2)}%`);
            console.log(`  Away edge: ${awayEdge.toFixed(2)}%`);

            if (homeEdge > 0 || awayEdge > 0) {
              console.log(`  ✅ VALUE FOUND!`);
            } else {
              console.log(`  ❌ No value (Cloudbet odds worse than market average)`);
            }
          }
        }

        // Only show first matched event
        break;
      }
    }

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

testActualComparison();
