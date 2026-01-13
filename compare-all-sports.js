const aggregator = require('./src/services/multiBookmakerOddsAggregator');

(async () => {
  try {
    console.log('🔍 COMPARING ALL SPORTS FOR BETTING OPPORTUNITIES\n');
    console.log('=' .repeat(80) + '\n');

    const sports = [
      { key: 'basketball', emoji: '🏀', name: 'NBA' },
      { key: 'american-football', emoji: '🏈', name: 'NFL' },
      { key: 'ice-hockey', emoji: '🏒', name: 'NHL' }
    ];

    for (const sport of sports) {
      console.log(`\n${sport.emoji} ${sport.name.toUpperCase()}`);
      console.log('-'.repeat(80));

      const opportunities = await aggregator.findOpportunities(sport.key);
      console.log(`Total opportunities found: ${opportunities.length}`);

      if (opportunities.length === 0) {
        console.log('❌ No opportunities\n');
        continue;
      }

      // Sort by edge descending
      opportunities.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));

      // Show edge distribution
      const edgeRanges = {
        '5%+': opportunities.filter(o => parseFloat(o.edge) >= 5.0).length,
        '3-5%': opportunities.filter(o => parseFloat(o.edge) >= 3.0 && parseFloat(o.edge) < 5.0).length,
        '2-3%': opportunities.filter(o => parseFloat(o.edge) >= 2.0 && parseFloat(o.edge) < 3.0).length,
        '1-2%': opportunities.filter(o => parseFloat(o.edge) >= 1.0 && parseFloat(o.edge) < 2.0).length,
        '<1%': opportunities.filter(o => parseFloat(o.edge) < 1.0).length
      };

      console.log('\nEdge Distribution:');
      Object.entries(edgeRanges).forEach(([range, count]) => {
        console.log(`  ${range.padEnd(8)}: ${count} opportunities`);
      });

      console.log(`\nTop 5 by Edge:`);
      opportunities.slice(0, 5).forEach((opp, i) => {
        console.log(`  ${i+1}. ${opp.home} vs ${opp.away}`);
        console.log(`     Edge: ${opp.edge}% | Market: ${opp.marketType} | Selection: ${opp.selection}`);
      });

      // Check what passes 2% threshold
      const minEdge = 2.0;
      const withEdge = opportunities.filter(o => parseFloat(o.edge) >= minEdge);
      console.log(`\n✅ Opportunities with edge >= ${minEdge}%: ${withEdge.length}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('\nWhy you\'re only getting NFL bets:');
    console.log('  1. Check if NBA/NHL have sufficient edge (>= 2%)');
    console.log('  2. Check if fundamental analysis is rejecting NBA/NHL bets');
    console.log('  3. Check if there are enough games available\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
