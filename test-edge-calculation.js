require('dotenv').config();
const multiBookmakerAggregator = require('./src/services/multiBookmakerOddsAggregator');

/**
 * Test edge calculation without efficiency filters
 */
async function testEdgeCalculation() {
  console.log('\n' + '='.repeat(80));
  console.log('EDGE CALCULATION TEST - BYPASSING EFFICIENCY FILTERS');
  console.log('='.repeat(80) + '\n');

  try {
    // Get opportunities
    const opportunities = await multiBookmakerAggregator.findOpportunities('soccer');
    console.log(`Found ${opportunities.length} opportunities\n`);

    if (opportunities.length === 0) {
      console.log('No opportunities found.');
      return;
    }

    // Calculate edge for each opportunity
    const opportunitiesWithEdge = opportunities.map(opp => {
      // Get sharp book consensus if available
      const sharpBooks = opp.allBookmakerOdds.filter(b => b.isSharp);
      let sharpConsensusOdds = null;

      if (sharpBooks.length > 0) {
        const sharpOddsForSide = sharpBooks.map(b => b.odds[opp.side]).filter(o => o);
        if (sharpOddsForSide.length > 0) {
          sharpConsensusOdds = sharpOddsForSide.reduce((a, b) => a + b) / sharpOddsForSide.length;
        }
      }

      // Get market average
      const allOddsForSide = opp.allBookmakerOdds.map(b => b.odds[opp.side]).filter(o => o);
      const marketAvgOdds = allOddsForSide.length > 0
        ? allOddsForSide.reduce((a, b) => a + b) / allOddsForSide.length
        : null;

      // Calculate edge based on sharp consensus (if available) or market average
      const referenceOdds = sharpConsensusOdds || marketAvgOdds;
      let edge = 0;

      if (referenceOdds && opp.cloudbetOdds && referenceOdds > 0) {
        // Implied probability from reference
        const refImpliedProb = 1 / referenceOdds;
        // Implied probability from Cloudbet
        const cbImpliedProb = 1 / opp.cloudbetOdds;
        // Edge = difference in implied probabilities
        edge = (refImpliedProb - cbImpliedProb) * 100;
      }

      return {
        ...opp,
        sharpConsensusOdds,
        marketAvgOdds,
        edge,
        sharpBookCount: sharpBooks.length,
      };
    });

    // Sort by edge (highest first)
    opportunitiesWithEdge.sort((a, b) => b.edge - a.edge);

    // Show top 20
    console.log('TOP 20 OPPORTUNITIES BY EDGE:\n');
    console.log('='.repeat(80) + '\n');

    for (let i = 0; i < Math.min(20, opportunitiesWithEdge.length); i++) {
      const opp = opportunitiesWithEdge[i];

      console.log(`${i + 1}. ${opp.home} vs ${opp.away} - ${opp.side.toUpperCase()}`);
      console.log(`   League: ${opp.league}`);
      console.log(`   Market: ${opp.marketType}`);
      console.log(`   Cloudbet Odds: ${opp.cloudbetOdds.toFixed(3)}`);

      if (opp.sharpConsensusOdds) {
        console.log(`   Sharp Consensus: ${opp.sharpConsensusOdds.toFixed(3)} (${opp.sharpBookCount} sharp books)`);
      }

      console.log(`   Market Average: ${opp.marketAvgOdds ? opp.marketAvgOdds.toFixed(3) : 'N/A'}`);
      console.log(`   EDGE: ${opp.edge >= 0 ? '+' : ''}${opp.edge.toFixed(2)}%`);
      console.log(`   Bookmakers: ${opp.totalBookmakers} total`);

      // Show value analysis
      if (opp.edge > 2) {
        console.log(`   ✅ POSITIVE EDGE - Cloudbet odds are ${(opp.cloudbetOdds / (opp.sharpConsensusOdds || opp.marketAvgOdds) * 100 - 100).toFixed(1)}% higher than reference`);
      } else if (opp.edge < -2) {
        console.log(`   ❌ NEGATIVE EDGE - Cloudbet odds are ${(opp.cloudbetOdds / (opp.sharpConsensusOdds || opp.marketAvgOdds) * 100 - 100).toFixed(1)}% lower than reference`);
      } else {
        console.log(`   ⚪ NEUTRAL - No significant edge`);
      }

      console.log('');
    }

    // Statistics
    console.log('='.repeat(80));
    console.log('\nEDGE STATISTICS:\n');

    const positiveEdge = opportunitiesWithEdge.filter(o => o.edge > 2);
    const negativeEdge = opportunitiesWithEdge.filter(o => o.edge < -2);
    const neutral = opportunitiesWithEdge.filter(o => o.edge >= -2 && o.edge <= 2);

    console.log(`Positive Edge (>2%): ${positiveEdge.length} (${(positiveEdge.length / opportunitiesWithEdge.length * 100).toFixed(1)}%)`);
    console.log(`Negative Edge (<-2%): ${negativeEdge.length} (${(negativeEdge.length / opportunitiesWithEdge.length * 100).toFixed(1)}%)`);
    console.log(`Neutral (-2% to 2%): ${neutral.length} (${(neutral.length / opportunitiesWithEdge.length * 100).toFixed(1)}%)`);

    if (positiveEdge.length > 0) {
      const avgPositiveEdge = positiveEdge.reduce((sum, o) => sum + o.edge, 0) / positiveEdge.length;
      console.log(`\nAverage Positive Edge: +${avgPositiveEdge.toFixed(2)}%`);
      console.log(`Max Edge: +${Math.max(...positiveEdge.map(o => o.edge)).toFixed(2)}%`);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  }
}

testEdgeCalculation();
