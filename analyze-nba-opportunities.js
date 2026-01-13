const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('🏀 ANALYZING NBA GAMES\n');
    console.log('Step 1: Fetching NBA opportunities...\n');
    const opportunities = await aggregator.findOpportunities('basketball');

    console.log(`Found ${opportunities.length} total NBA opportunities\n`);

    if (opportunities.length === 0) {
      console.log('❌ No NBA opportunities found at all');
      console.log('This could mean:');
      console.log('  - No NBA games today');
      console.log('  - API issues');
      console.log('  - No odds available on Cloudbet');
      process.exit(0);
    }

    // Filter by edge threshold
    const minEdge = 2.0;
    const withEdge = opportunities.filter(o => parseFloat(o.edge) >= minEdge);
    console.log(`Opportunities with edge >= ${minEdge}%: ${withEdge.length}\n`);

    if (withEdge.length > 0) {
      console.log('TOP NBA OPPORTUNITIES BY EDGE:\n');
      withEdge.slice(0, 10).forEach((opp, i) => {
        console.log(`${i+1}. ${opp.home} vs ${opp.away}`);
        console.log(`   Market: ${opp.marketType}`);
        console.log(`   Selection: ${opp.selection}`);
        console.log(`   Edge: ${opp.edge}%`);
        console.log(`   Cloudbet Odds: ${opp.cloudbetOdds}`);
        console.log(`   Fair Odds: ${opp.fairOdds}\n`);
      });
    }

    // Now run fundamental analysis
    console.log('\n\nStep 2: Running Fundamental Analysis...\n');
    const predictor = new FundamentalAnalysisPredictor();

    let analysisResults = [];
    for (const opp of withEdge.slice(0, 5)) {
      console.log(`Analyzing: ${opp.home} vs ${opp.away}`);
      const prediction = await predictor.predictWinner(opp, 'basketball');
      analysisResults.push({ opp, prediction });

      if (prediction) {
        console.log(`  ✅ Prediction: ${prediction.predictedWinner}`);
        console.log(`  Confidence: ${prediction.confidence}`);
        console.log(`  Reasoning: ${prediction.reasoning}\n`);
      } else {
        console.log(`  ❌ No prediction (insufficient data)\n`);
      }
    }

    // Check which would actually be bet on
    console.log('\n\nStep 3: Final Bet Approval Check...\n');
    const approved = analysisResults.filter(r => {
      if (!r.prediction) return false;
      // Check if fundamental analysis approves the bet
      const selectionLower = r.opp.selection.toLowerCase();
      const predictedLower = r.prediction.predictedWinner.toLowerCase();
      return selectionLower === predictedLower ||
             (selectionLower === 'home' && predictedLower.includes(r.opp.home.toLowerCase())) ||
             (selectionLower === 'away' && predictedLower.includes(r.opp.away.toLowerCase()));
    });

    console.log(`Bets approved by fundamental analysis: ${approved.length}`);
    if (approved.length > 0) {
      console.log('\nAPPROVED NBA BETS:');
      approved.forEach((a, i) => {
        console.log(`${i+1}. ${a.opp.home} vs ${a.opp.away} - ${a.opp.selection} @ ${a.opp.cloudbetOdds}`);
      });
    } else {
      console.log('⚠️  No NBA bets approved by fundamental analysis');
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
