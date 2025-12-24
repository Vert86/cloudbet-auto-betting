/**
 * Test script to understand Cloudbet API structure for odds
 */

require('dotenv').config();
const axios = require('axios');

const apiKey = process.env.CLOUDBET_API_KEY;

const client = axios.create({
  baseURL: 'https://sports-api.cloudbet.com/pub/v2/odds',
  headers: {
    'X-API-Key': apiKey,
    'Accept': 'application/json',
  },
  timeout: 30000,
});

async function testOddsStructure() {
  console.log('\n=== Testing Cloudbet Odds API Structure ===\n');

  try {
    // 1. Get sports
    console.log('1. Getting sports list...');
    const sportsResp = await client.get('/sports');
    const sports = sportsResp.data.sports;
    console.log(`   Found ${sports.length} sports`);
    const basketball = sports.find(s => s.key === 'basketball');
    console.log(`   Basketball has ${basketball.competitionCount} competitions\n`);

    // 2. Get sport structure (competitions)
    console.log('2. Getting basketball structure...');
    const sportResp = await client.get('/sports/basketball');
    const categories = sportResp.data.categories;
    console.log(`   Found ${categories.length} categories`);

    // Get first competition from USA category
    const usaCategory = categories.find(c => c.key === 'usa');
    const firstComp = usaCategory.competitions[0];
    console.log(`   First USA competition: ${firstComp.name} (${firstComp.key})`);
    console.log(`   Event count: ${firstComp.eventCount}\n`);

    // 3. Get competition events
    console.log(`3. Getting events for ${firstComp.key}...`);
    const compResp = await client.get(`/competitions/${firstComp.key}`);
    const events = compResp.data.events || [];
    console.log(`   Found ${events.length} events`);

    // Find a match event (has home and away teams)
    const matchEvents = events.filter(e => e.home && e.away);
    console.log(`   Match events (with home/away): ${matchEvents.length}`);

    if (matchEvents.length > 0) {
      const match = matchEvents[0];
      console.log(`\n4. Sample match event:`);
      console.log(`   ${match.home.name} vs ${match.away.name}`);
      console.log(`   Status: ${match.status}`);
      console.log(`   Event ID: ${match.id}`);
      console.log(`   Markets: ${Object.keys(match.markets || {}).length}`);

      if (match.markets) {
        console.log(`   Market keys: ${Object.keys(match.markets).join(', ')}`);

        // Look for match odds market
        const matchOddsMarket = Object.entries(match.markets).find(([key]) =>
          key.includes('match_odds') || key.includes('moneyline') || key.includes('winner')
        );

        if (matchOddsMarket) {
          console.log(`\n5. Match odds market found: ${matchOddsMarket[0]}`);
          const submarkets = matchOddsMarket[1].submarkets || {};
          const defaultSubmarket = submarkets.default || submarkets[Object.keys(submarkets)[0]];

          if (defaultSubmarket && defaultSubmarket.selections) {
            console.log(`   Selections:`);
            defaultSubmarket.selections.forEach(sel => {
              console.log(`     - ${sel.outcome}: ${sel.price} (${sel.status})`);
            });
          }
        } else {
          console.log(`\n5. No match odds market found. Available markets:`);
          Object.keys(match.markets).forEach(mk => {
            console.log(`     - ${mk}`);
          });
        }
      }
    } else {
      console.log(`\n   No match events found in ${firstComp.name}`);
      console.log(`   All events are outrights/futures`);
    }

    console.log('\n=== Test Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testOddsStructure();
