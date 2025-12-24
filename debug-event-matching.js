require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

/**
 * Debug event matching between Cloudbet and The Odds API
 */
async function debugMatching() {
  console.log('DEBUG: Event Matching Analysis\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Get Cloudbet events for soccer
    const cloudbetData = await multiBookmakerAggregator.getCloudbetOdds('soccer');
    console.log(`Cloudbet Events: ${cloudbetData.events.length}\n`);

    // Show sample Cloudbet events
    console.log('Sample Cloudbet Events:');
    cloudbetData.events.slice(0, 5).forEach(event => {
      console.log(`  ${event.home} vs ${event.away}`);
      console.log(`    Competition: ${event.competition?.name || 'Unknown'}`);
      console.log(`    Starts: ${new Date(event.starts).toLocaleString()}`);
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // Get The Odds API events
    const oddsApiEvents = [];
    const sports = ['soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga',
                    'soccer_italy_serie_a', 'soccer_france_ligue_one'];

    for (const sport of sports) {
      const events = await multiBookmakerAggregator.getOddsFromTheOddsAPI(sport);
      if (events && events.length > 0) {
        console.log(`The Odds API - ${sport}: ${events.length} events`);
        oddsApiEvents.push(...events);
      }
    }

    console.log(`\nTotal Odds API Events: ${oddsApiEvents.length}\n`);

    // Show sample Odds API events
    console.log('Sample Odds API Events:');
    oddsApiEvents.slice(0, 5).forEach(event => {
      console.log(`  ${event.home_team} vs ${event.away_team}`);
      console.log(`    Sport: ${event.sport_key}`);
      console.log(`    Starts: ${new Date(event.commence_time).toLocaleString()}`);
      console.log(`    Bookmakers: ${event.bookmakers?.length || 0}`);
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // Test matching with normalization
    console.log('Testing Normalization Function:\n');

    const normalize = (str) => {
      if (!str || typeof str !== 'string') return '';
      let cleaned = str.toLowerCase();
      cleaned = cleaned.replace(/\s*(fc|afc|cf|srl|srl\s*fc|united|city|town|athletic|club)\s*$/gi, '');
      cleaned = cleaned.replace(/[^a-z0-9\s]/g, '');
      cleaned = cleaned.replace(/\s+/g, '');
      return cleaned;
    };

    // Try to find some manual matches
    const testPairs = [
      ['Burnley FC', 'Burnley'],
      ['Chelsea', 'Chelsea FC'],
      ['Manchester United', 'Man Utd'],
      ['Brighton & Hove Albion', 'Brighton'],
    ];

    testPairs.forEach(([cb, oa]) => {
      const cbNorm = normalize(cb);
      const oaNorm = normalize(oa);
      console.log(`Cloudbet: "${cb}" → "${cbNorm}"`);
      console.log(`Odds API: "${oa}" → "${oaNorm}"`);
      console.log(`Match: ${cbNorm === oaNorm ? '✅' : '❌'}\n`);
    });

    console.log('='.repeat(80) + '\n');

    // Try to match first 10 Cloudbet events
    console.log('Attempting to match first 10 Cloudbet events:\n');

    for (let i = 0; i < Math.min(10, cloudbetData.events.length); i++) {
      const cbEvent = cloudbetData.events[i];
      console.log(`${i + 1}. ${cbEvent.home} vs ${cbEvent.away}`);
      console.log(`   Competition: ${cbEvent.competition?.name}`);

      const cbHome = normalize(cbEvent.home);
      const cbAway = normalize(cbEvent.away);
      console.log(`   Normalized: "${cbHome}" vs "${cbAway}"`);

      // Try to find match
      let found = false;
      for (const oaEvent of oddsApiEvents) {
        const oaHome = normalize(oaEvent.home_team);
        const oaAway = normalize(oaEvent.away_team);

        if ((cbHome === oaHome && cbAway === oaAway) ||
            (cbHome.includes(oaHome) && cbAway.includes(oaAway)) ||
            (oaHome.includes(cbHome) && oaAway.includes(cbAway))) {
          console.log(`   ✅ MATCH: ${oaEvent.home_team} vs ${oaEvent.away_team} (${oaEvent.sport_key})`);
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(`   ❌ NO MATCH`);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}

debugMatching();
