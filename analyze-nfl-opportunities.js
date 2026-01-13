const aggregator = require('./src/services/multiBookmakerOddsAggregator');

(async () => {
  try {
    console.log('🏈 ANALYZING NFL GAMES\n');
    console.log('Fetching NFL opportunities...\n');

    const opportunities = await aggregator.findOpportunities('american-football');

    console.log(`Found ${opportunities.length} total NFL opportunities\n`);

    if (opportunities.length === 0) {
      console.log('❌ No NFL opportunities found');
      process.exit(0);
    }

    // Filter by edge threshold
    const minEdge = 2.0;
    const withEdge = opportunities.filter(o => parseFloat(o.edge) >= minEdge);
    console.log(`Opportunities with edge >= ${minEdge}%: ${withEdge.length}\n`);

    if (withEdge.length > 0) {
      console.log('TOP NFL OPPORTUNITIES BY EDGE:\n');
      withEdge.slice(0, 15).forEach((opp, i) => {
        console.log(`${i+1}. ${opp.home} vs ${opp.away}`);
        console.log(`   Market: ${opp.marketType}`);
        console.log(`   Selection: ${opp.selection}`);
        console.log(`   Edge: ${opp.edge}%`);
        console.log(`   Cloudbet Odds: ${opp.cloudbetOdds}`);
        console.log(`   Fair Odds: ${opp.fairOdds}\n`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
