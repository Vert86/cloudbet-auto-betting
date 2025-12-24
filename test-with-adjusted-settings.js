require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

/**
 * Test with adjusted settings to see how many bets would qualify
 */
async function testAdjustedSettings() {
  console.log('\n' + '='.repeat(80));
  console.log('TESTING WITH ADJUSTED SETTINGS');
  console.log('='.repeat(80) + '\n');

  const scenarios = [
    { name: 'Current (Too Strict)', edge: 5, bookmakers: 5, efficiency: 20 },
    { name: 'Recommended', edge: 4, bookmakers: 4, efficiency: 18 },
    { name: 'Moderate', edge: 3.5, bookmakers: 4, efficiency: 16 },
    { name: 'Relaxed', edge: 3, bookmakers: 3, efficiency: 15 }
  ];

  const MIN_ODDS = parseFloat(process.env.MIN_ODDS || '1.50');
  const MAX_ODDS = parseFloat(process.env.MAX_ODDS || '4.00');

  console.log('Fetching basketball opportunities...\n');
  const opportunities = await multiBookmakerAggregator.findOpportunities('basketball');

  console.log(`Total opportunities fetched: ${opportunities.length}\n`);

  if (opportunities.length === 0) {
    console.log('❌ No opportunities found\n');
    return;
  }

  console.log('📊 COMPARISON OF DIFFERENT SETTINGS:\n');
  console.log('='.repeat(80) + '\n');

  scenarios.forEach(scenario => {
    const qualified = opportunities.filter(opp => {
      const edge = parseFloat(opp.edge || 0);
      const bookmakers = parseInt(opp.totalBookmakers || 0);
      const efficiency = parseFloat(opp.efficiencyScore || 0);
      const odds = parseFloat(opp.cloudbetOdds || 0);

      return edge >= scenario.edge &&
             bookmakers >= scenario.bookmakers &&
             efficiency >= scenario.efficiency &&
             odds >= MIN_ODDS &&
             odds <= MAX_ODDS;
    });

    console.log(`${scenario.name}:`);
    console.log(`  Settings: Edge≥${scenario.edge}% | Bookmakers≥${scenario.bookmakers} | Efficiency≥${scenario.efficiency}`);
    console.log(`  ✅ Qualified: ${qualified.length} bets\n`);

    if (qualified.length > 0 && qualified.length <= 5) {
      console.log('  Example bets:');
      qualified.forEach((opp, i) => {
        console.log(`    ${i + 1}. ${opp.home} vs ${opp.away}`);
        console.log(`       Edge: ${opp.edge}% | Odds: ${opp.cloudbetOdds} | Bookmakers: ${opp.totalBookmakers}`);
      });
      console.log('');
    } else if (qualified.length > 5) {
      console.log('  Top 3 bets by edge:');
      const sorted = [...qualified].sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));
      sorted.slice(0, 3).forEach((opp, i) => {
        console.log(`    ${i + 1}. ${opp.home} vs ${opp.away}`);
        console.log(`       Edge: ${opp.edge}% | Odds: ${opp.cloudbetOdds} | Bookmakers: ${opp.totalBookmakers}`);
      });
      console.log('');
    }
  });

  console.log('='.repeat(80));
  console.log('💡 RECOMMENDATION');
  console.log('='.repeat(80) + '\n');

  console.log('Based on the analysis above, I recommend:');
  console.log('');
  console.log('Update your .env file to:');
  console.log('  MIN_EDGE_PERCENTAGE=4.0');
  console.log('  MIN_BOOKMAKERS=4');
  console.log('  MIN_EFFICIENCY_SCORE=18');
  console.log('');
  console.log('This balances quality with volume, ensuring you get bets while');
  console.log('maintaining high standards to avoid the half-time betting losses.');
  console.log('');
}

testAdjustedSettings().catch(console.error);
