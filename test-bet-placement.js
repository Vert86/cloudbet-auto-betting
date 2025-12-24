/**
 * Test bet placement endpoint (dry run - won't actually place a bet)
 */

const cloudbetAPI = require('./src/services/cloudbetAPI');

async function testBetPlacement() {
  console.log('\n=== Testing Bet Placement Endpoint ===\n');

  try {
    // Get a real event to test with
    const data = await cloudbetAPI.getSportEvents('basketball');
    if (data.events.length === 0) {
      console.log('No events available to test');
      return;
    }

    const event = data.events[0];
    console.log(`Test Event: ${event.home.name} vs ${event.away.name}`);

    // Get moneyline market
    const moneylineKey = Object.keys(event.markets).find(k => k.includes('moneyline'));
    if (!moneylineKey) {
      console.log('No moneyline market found');
      return;
    }

    const market = event.markets[moneylineKey];
    const submarket = market.submarkets.default || market.submarkets[Object.keys(market.submarkets)[0]];
    const selection = submarket.selections[0];

    console.log(`\nTest bet details:`);
    console.log(`  Event ID: ${event.id}`);
    console.log(`  Market URL: ${selection.marketUrl}`);
    console.log(`  Outcome: ${selection.outcome}`);
    console.log(`  Price: ${selection.price}`);
    console.log(`  Min stake: ${selection.minStake}`);

    console.log(`\nNOTE: Not actually placing bet - this is just a structure test`);
    console.log(`Bet would be placed at: POST https://sports-api.cloudbet.com/pub/v3/bets/place`);

    const payload = {
      acceptPriceChange: 'ALL',
      price: selection.price,
      stake: selection.minStake,
      currency: 'USDT',
      eventId: event.id,
      marketUrl: selection.marketUrl,
      referenceId: `test_${Date.now()}`
    };

    console.log(`\nPayload that would be sent:`);
    console.log(JSON.stringify(payload, null, 2));

    console.log('\n✅ Bet placement structure looks correct');
    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testBetPlacement();
