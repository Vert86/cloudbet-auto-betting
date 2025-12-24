/**
 * Debug selection structure
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');
const cloudbetOddsAggregator = require('./src/services/cloudbetOddsAggregator');

async function debugSelections() {
  console.log('\n=== Debugging Selection Structure ===\n');

  try {
    const data = await cloudbetAPI.getSportEvents('basketball');
    const firstEvent = data.events[0];

    console.log(`Event: ${firstEvent.home.name} vs ${firstEvent.away.name}\n`);

    // Check raw moneyline structure
    const moneylineKey = Object.keys(firstEvent.markets).find(k => k.includes('moneyline'));
    if (moneylineKey) {
      console.log(`Raw market structure for ${moneylineKey}:`);
      const market = firstEvent.markets[moneylineKey];
      console.log(`Submarkets: ${Object.keys(market.submarkets).join(', ')}\n`);

      const submarket = market.submarkets.default || market.submarkets[Object.keys(market.submarkets)[0]];
      console.log(`Selections:`);
      submarket.selections.forEach((sel, i) => {
        console.log(`  [${i}] outcome: "${sel.outcome}", side: "${sel.side}", price: ${sel.price}, status: ${sel.status}`);
      });
    }

    // Now check normalized version
    console.log(`\n\nNormalized version:`);
    const aggregated = await cloudbetOddsAggregator.aggregateOdds('basketball');
    const normalized = aggregated.cloudbet[0];

    const normMoneylineKey = Object.keys(normalized.markets).find(k => k.includes('moneyline'));
    if (normMoneylineKey) {
      const normMarket = normalized.markets[normMoneylineKey];
      console.log(`\nNormalized selections:`);
      normMarket.selections.forEach((sel, i) => {
        console.log(`  [${i}] side: "${sel.side}", name: "${sel.name}", price: ${sel.price}`);
      });
    }

    console.log('\n=== Debug Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugSelections();
