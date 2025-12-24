require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

async function testImprovedSettings() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING IMPROVED SETTINGS');
  console.log('='.repeat(80) + '\n');

  console.log('New Restrictions:');
  console.log('  ✅ Only standard match_odds markets (no exotics)');
  console.log('  ✅ Max 2 bets per event');
  console.log('  ✅ No half-time markets');
  console.log('  ✅ No corners, bookings, cards, etc.\n');

  console.log('Scanning soccer for opportunities...\n');

  const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');

  console.log(`Total opportunities found: ${opportunities.length}\n`);

  if (opportunities.length === 0) {
    console.log('❌ No opportunities found.\n');
    return;
  }

  // Check market types
  const marketTypes = {};
  opportunities.forEach(opp => {
    const market = opp.marketKey || 'unknown';
    marketTypes[market] = (marketTypes[market] || 0) + 1;
  });

  console.log('Market Type Distribution:\n');
  Object.entries(marketTypes).forEach(([market, count]) => {
    console.log(`  ${market}: ${count}`);
  });
  console.log('');

  // Check for exotic markets
  const exoticMarkets = opportunities.filter(opp => {
    const market = (opp.marketKey || '').toLowerCase();
    return market.includes('corner') ||
           market.includes('booking') ||
           market.includes('card') ||
           market.includes('penalty');
  });

  if (exoticMarkets.length > 0) {
    console.log(`❌ FAILED: Found ${exoticMarkets.length} exotic markets!\n`);
    exoticMarkets.slice(0, 5).forEach(opp => {
      console.log(`  - ${opp.home} vs ${opp.away}: ${opp.marketKey}`);
    });
  } else {
    console.log('✅ PASSED: No exotic markets found!\n');
  }

  // Check for half-time markets
  const halfTimeMarkets = opportunities.filter(opp => {
    const market = (opp.marketKey || '').toLowerCase();
    return market.includes('half') || market.includes('period');
  });

  if (halfTimeMarkets.length > 0) {
    console.log(`❌ FAILED: Found ${halfTimeMarkets.length} half-time markets!\n`);
  } else {
    console.log('✅ PASSED: No half-time markets found!\n');
  }

  // Show top 5 opportunities
  console.log('Top 5 Opportunities:\n');
  opportunities.slice(0, 5).forEach((opp, i) => {
    console.log(`${i + 1}. ${opp.home} vs ${opp.away}`);
    console.log(`   Market: ${opp.marketKey}`);
    console.log(`   Edge: ${parseFloat(opp.edge || 0).toFixed(2)}%`);
    console.log(`   Odds: ${opp.cloudbetOdds}`);
    console.log(`   Bookmakers: ${opp.totalBookmakers}\n`);
  });

  console.log('='.repeat(80));
  console.log('✅ Configuration test complete!');
  console.log('='.repeat(80) + '\n');
}

testImprovedSettings().catch(console.error);
