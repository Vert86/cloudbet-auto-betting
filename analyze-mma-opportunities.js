const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('🥊 MMA FIGHTS - FUNDAMENTAL ANALYSIS\n');
    console.log('='.repeat(80) + '\n');

    const allMMAOpps = await aggregator.findOpportunities('mma');
    console.log(`Total MMA opportunities found: ${allMMAOpps.length}\n`);

    if (allMMAOpps.length === 0) {
      console.log('❌ No MMA fights with odds available');
      return;
    }

    // Group by matchup to avoid duplicates
    const fightsByMatchup = {};
    allMMAOpps.forEach(opp => {
      const matchup = `${opp.home} vs ${opp.away}`;
      if (!fightsByMatchup[matchup]) {
        fightsByMatchup[matchup] = [];
      }
      fightsByMatchup[matchup].push(opp);
    });

    console.log(`Unique MMA fights: ${Object.keys(fightsByMatchup).length}\n`);

    // Show competitions/organizations
    const byCompetition = {};
    allMMAOpps.forEach(opp => {
      const comp = opp.competition || 'Unknown';
      if (!byCompetition[comp]) {
        byCompetition[comp] = 0;
      }
      byCompetition[comp]++;
    });

    console.log('ORGANIZATIONS AVAILABLE:');
    Object.keys(byCompetition).sort().forEach(comp => {
      console.log(`  ${comp}: ${byCompetition[comp]} opportunities`);
    });
    console.log('');

    const predictor = new FundamentalAnalysisPredictor();
    const qualifiedBets = [];
    let fightsAnalyzed = 0;
    let fightsWithPredictions = 0;

    // Analyze all fights (usually not too many)
    for (const [matchup, opportunities] of Object.entries(fightsByMatchup)) {
      console.log('\n' + '='.repeat(80));
      console.log(`FIGHT: ${matchup}`);
      console.log('='.repeat(80));

      const firstOpp = opportunities[0];
      console.log(`Organization: ${firstOpp.competition}`);
      console.log(`Start time: ${new Date(firstOpp.starts).toLocaleString('en-US')}`);
      console.log(`\nAvailable opportunities (${opportunities.length}):`);
      opportunities.forEach((opp, i) => {
        console.log(`  ${i+1}. ${opp.selection} @ ${opp.cloudbetOdds}`);
      });

      // Try to run fundamental analysis
      console.log(`\n📊 Attempting fundamental analysis...`);
      try {
        const prediction = await predictor.predictWinner(firstOpp, 'mma');

        fightsAnalyzed++;

        if (!prediction) {
          console.log('❌ No prediction available (insufficient data or not implemented)');
          continue;
        }

        fightsWithPredictions++;

        console.log(`\n✅ PREDICTION RESULTS:`);
        console.log(`   Predicted Winner: ${prediction.predictedWinner}`);
        console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${prediction.reasoning}`);

        // Check opportunities
        const minConfidence = parseFloat(process.env.MIN_PREDICTION_CONFIDENCE) || 0.6;
        console.log(`\n🎯 CHECKING OPPORTUNITIES (min confidence: ${(minConfidence * 100).toFixed(0)}%):`);

        for (const opp of opportunities) {
          const selectionLower = opp.selection.toLowerCase();
          const predictedLower = prediction.predictedWinner.toLowerCase();
          const homeLower = opp.home.toLowerCase();
          const awayLower = opp.away.toLowerCase();

          let matches = false;
          if (selectionLower === 'home' && (predictedLower.includes('home') || predictedLower.includes(homeLower))) {
            matches = true;
          } else if (selectionLower === 'away' && (predictedLower.includes('away') || predictedLower.includes(awayLower))) {
            matches = true;
          }

          const meetsConfidence = prediction.confidence >= minConfidence;

          if (matches && meetsConfidence) {
            console.log(`   ✅ ${opp.selection} @ ${opp.cloudbetOdds} - QUALIFIES!`);
            qualifiedBets.push({
              fight: matchup,
              organization: firstOpp.competition,
              selection: opp.selection,
              odds: opp.cloudbetOdds,
              prediction: prediction.predictedWinner,
              confidence: prediction.confidence,
              reasoning: prediction.reasoning,
              starts: opp.starts
            });
          } else {
            console.log(`   ❌ ${opp.selection} @ ${opp.cloudbetOdds} - ${!matches ? 'Wrong side' : 'Low confidence'}`);
          }
        }

      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }
    }

    // Final summary
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`Total MMA opportunities: ${allMMAOpps.length}`);
    console.log(`Unique fights: ${Object.keys(fightsByMatchup).length}`);
    console.log(`Fights analyzed: ${fightsAnalyzed}`);
    console.log(`Fights with predictions: ${fightsWithPredictions}`);
    console.log(`Qualified bets: ${qualifiedBets.length}\n`);

    if (qualifiedBets.length > 0) {
      console.log('✅ BETS READY TO PLACE:\n');
      qualifiedBets.forEach((bet, i) => {
        const startTime = new Date(bet.starts).toLocaleString('en-US');
        console.log(`${i + 1}. ${bet.fight} - ${startTime}`);
        console.log(`   Organization: ${bet.organization}`);
        console.log(`   Bet: ${bet.selection} @ ${bet.odds}`);
        console.log(`   Prediction: ${bet.prediction}`);
        console.log(`   Confidence: ${(bet.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${bet.reasoning}\n`);
      });
    } else {
      console.log('❌ No MMA bets qualify based on current criteria\n');
      console.log('Possible reasons:');
      console.log('  • Fundamental analysis not implemented for MMA');
      console.log('  • Predictions below minimum confidence threshold');
      console.log('  • No fighter statistics API available');
      console.log('  • Insufficient data for predictions');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();
