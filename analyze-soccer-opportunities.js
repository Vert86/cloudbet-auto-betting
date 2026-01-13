const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('⚽ SOCCER GAMES - FUNDAMENTAL ANALYSIS\n');
    console.log('='.repeat(80) + '\n');

    const allSoccerOpps = await aggregator.findOpportunities('soccer');
    console.log(`Total soccer opportunities found: ${allSoccerOpps.length}\n`);

    if (allSoccerOpps.length === 0) {
      console.log('❌ No soccer games with odds available');
      return;
    }

    // Group by matchup to avoid duplicates
    const gamesByMatchup = {};
    allSoccerOpps.forEach(opp => {
      const matchup = `${opp.home} vs ${opp.away}`;
      if (!gamesByMatchup[matchup]) {
        gamesByMatchup[matchup] = [];
      }
      gamesByMatchup[matchup].push(opp);
    });

    console.log(`Unique soccer games: ${Object.keys(gamesByMatchup).length}\n`);

    // Show competitions
    const byCompetition = {};
    allSoccerOpps.forEach(opp => {
      const comp = opp.competition || 'Unknown';
      if (!byCompetition[comp]) {
        byCompetition[comp] = 0;
      }
      byCompetition[comp]++;
    });

    console.log('COMPETITIONS AVAILABLE:');
    Object.keys(byCompetition).sort().forEach(comp => {
      console.log(`  ${comp}: ${byCompetition[comp]} opportunities`);
    });
    console.log('');

    const predictor = new FundamentalAnalysisPredictor();
    const qualifiedBets = [];
    let gamesAnalyzed = 0;
    let gamesWithPredictions = 0;

    // Analyze first 10 games as sample
    const gamesToAnalyze = Object.entries(gamesByMatchup).slice(0, 10);

    for (const [matchup, opportunities] of gamesToAnalyze) {
      console.log('\n' + '='.repeat(80));
      console.log(`GAME: ${matchup}`);
      console.log('='.repeat(80));

      const firstOpp = opportunities[0];
      const competition = firstOpp.competition || firstOpp.league || 'Unknown';
      console.log(`Competition: ${competition}`);
      console.log(`Start time: ${new Date(firstOpp.starts).toLocaleString('en-US')}`);
      console.log(`\nAvailable opportunities (${opportunities.length}):`);
      opportunities.forEach((opp, i) => {
        console.log(`  ${i+1}. ${opp.selection} @ ${opp.cloudbetOdds}`);
      });

      // Try to run fundamental analysis
      console.log(`\n📊 Attempting fundamental analysis...`);
      try {
        const prediction = await predictor.predictWinner(firstOpp, 'soccer');

        gamesAnalyzed++;

        if (!prediction) {
          console.log('❌ No prediction available (insufficient data or not implemented)');
          continue;
        }

        gamesWithPredictions++;

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
              game: matchup,
              competition: firstOpp.competition,
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

    console.log(`Total soccer opportunities: ${allSoccerOpps.length}`);
    console.log(`Unique games: ${Object.keys(gamesByMatchup).length}`);
    console.log(`Games analyzed (sample): ${gamesAnalyzed}`);
    console.log(`Games with predictions: ${gamesWithPredictions}`);
    console.log(`Qualified bets: ${qualifiedBets.length}\n`);

    if (qualifiedBets.length > 0) {
      console.log('✅ BETS READY TO PLACE:\n');
      qualifiedBets.forEach((bet, i) => {
        const startTime = new Date(bet.starts).toLocaleString('en-US');
        console.log(`${i + 1}. ${bet.game} - ${startTime}`);
        console.log(`   Competition: ${bet.competition}`);
        console.log(`   Bet: ${bet.selection} @ ${bet.odds}`);
        console.log(`   Prediction: ${bet.prediction}`);
        console.log(`   Confidence: ${(bet.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${bet.reasoning}\n`);
      });
    } else {
      console.log('❌ No soccer bets qualify based on current criteria\n');
      console.log('Possible reasons:');
      console.log('  • Fundamental analysis not implemented for soccer');
      console.log('  • Predictions below minimum confidence threshold');
      console.log('  • No team statistics API available');
      console.log('  • Insufficient data for predictions');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();
