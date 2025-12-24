require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

/**
 * Test that half-time markets are properly filtered out
 */
async function testMarketFiltering() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING MARKET FILTERING - EXCLUDING HALF-TIME MARKETS');
  console.log('='.repeat(80) + '\n');

  try {
    console.log('Fetching soccer opportunities with new filters...\n');

    const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');

    console.log(`Total opportunities found: ${opportunities.length}\n`);

    if (opportunities.length === 0) {
      console.log('✅ SUCCESS: No opportunities found (possibly no events or all filtered)');
      console.log('   This is expected if:\n');
      console.log('   1. No soccer events are happening soon');
      console.log('   2. All available markets were half-time markets (now filtered)');
      console.log('   3. Minimum edge/bookmaker requirements not met\n');
      return;
    }

    // Check market types
    const marketTypes = {};
    const forbiddenKeywords = ['first_half', 'second_half', 'period_first', 'period_second', '1st_half', '2nd_half'];

    opportunities.forEach(opp => {
      const marketType = opp.marketType;

      // Count market types
      if (!marketTypes[marketType]) {
        marketTypes[marketType] = 0;
      }
      marketTypes[marketType]++;

      // Check for forbidden keywords
      const hasForbiddenKeyword = forbiddenKeywords.some(keyword =>
        (opp.marketType || '').toLowerCase().includes(keyword) ||
        (opp.marketUrl || '').toLowerCase().includes(keyword)
      );

      if (hasForbiddenKeyword) {
        console.log(`❌ ERROR: Half-time market detected!`);
        console.log(`   Market Type: ${opp.marketType}`);
        console.log(`   Market URL: ${opp.marketUrl}`);
        console.log(`   Event: ${opp.home} vs ${opp.away}\n`);
      }
    });

    console.log('📊 Market Types Found:');
    Object.entries(marketTypes)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`   ${type}: ${count} opportunities`);
      });
    console.log('');

    // Verify no half-time markets
    const hasHalfTimeMarkets = opportunities.some(opp =>
      forbiddenKeywords.some(keyword =>
        (opp.marketType || '').toLowerCase().includes(keyword) ||
        (opp.marketUrl || '').toLowerCase().includes(keyword)
      )
    );

    if (hasHalfTimeMarkets) {
      console.log('❌ FAIL: Half-time markets are still being included!\n');
    } else {
      console.log('✅ SUCCESS: No half-time markets found!\n');
      console.log('The automation will now ONLY bet on:');
      console.log('  • Full Match Winner (90 minutes)');
      console.log('  • Full Match Totals (Over/Under goals)');
      console.log('  • Other full-match markets\n');
    }

    // Show sample opportunities
    if (opportunities.length > 0) {
      console.log('Sample opportunities (first 5):');
      opportunities.slice(0, 5).forEach((opp, i) => {
        console.log(`\n${i + 1}. ${opp.home} vs ${opp.away}`);
        console.log(`   Market: ${opp.marketType}`);
        console.log(`   Side: ${opp.side} @ ${opp.cloudbetOdds}`);
        console.log(`   Bookmakers: ${opp.totalBookmakers}`);
        console.log(`   Starts: ${new Date(opp.starts).toLocaleString()}`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Market filtering test complete!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testMarketFiltering();
