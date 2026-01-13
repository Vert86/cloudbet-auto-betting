const aggregator = require('./src/services/multiBookmakerOddsAggregator');

(async () => {
  try {
    console.log('Testing with MIN_BOOKMAKERS=0...\n');

    const opps = await aggregator.findOpportunities('basketball');
    console.log(`Total opportunities found: ${opps.length}`);

    if (opps.length > 0) {
      console.log('\n✅ SUCCESS! Opportunities are now being created even without bookmaker odds\n');
      console.log('First 5 opportunities:\n');
      opps.slice(0, 5).forEach((o, i) => {
        console.log(`${i+1}. ${o.home} vs ${o.away}`);
        console.log(`   Market: ${o.marketType}`);
        console.log(`   Selection: ${o.selection}`);
        console.log(`   Cloudbet Odds: ${o.cloudbetOdds}`);
        console.log(`   Edge: ${o.edge}%`);
        console.log(`   Sport: ${o.sport}\n`);
      });
    } else {
      console.log('\n❌ Still no opportunities - there may be no games available right now');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
