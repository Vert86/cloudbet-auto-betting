const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('🏀 TONIGHT\'S NBA GAMES - FUNDAMENTAL ANALYSIS\n');
    console.log('='.repeat(80) + '\n');

    const allBasketballOpps = await aggregator.findOpportunities('basketball');

    // Filter to actual NBA games (use team abbreviations)
    const nbaTeamAbbrevs = [
      'CLE', 'MIN', 'IND', 'MIA', 'DET', 'LA', 'BOS', 'SA', 'CHI', 'DAL', 'UTA', 'CHA',
      'LAL', 'LAC', 'GSW', 'PHX', 'SAC', 'POR', 'DEN', 'OKC', 'MEM', 'NOP', 'SAS',
      'HOU', 'PHI', 'BKN', 'NYK', 'TOR', 'MIL', 'ATL', 'ORL', 'WAS'
    ];

    const nbaGames = allBasketballOpps.filter(opp => {
      const home = opp.home || '';
      const away = opp.away || '';

      // Check if either team starts with NBA abbreviation
      const hasNBATeam = nbaTeamAbbrevs.some(abbrev =>
        home.startsWith(abbrev + ' ') || away.startsWith(abbrev + ' ')
      );

      return hasNBATeam;
    });

    console.log(`Found ${nbaGames.length} NBA opportunities\n`);

    if (nbaGames.length === 0) {
      console.log('❌ No NBA games with odds available');
      return;
    }

    // Group by matchup to avoid duplicates
    const gamesByMatchup = {};
    nbaGames.forEach(opp => {
      const matchup = `${opp.home} vs ${opp.away}`;
      if (!gamesByMatchup[matchup]) {
        gamesByMatchup[matchup] = [];
      }
      gamesByMatchup[matchup].push(opp);
    });

    console.log(`Unique NBA games tonight: ${Object.keys(gamesByMatchup).length}\n`);

    const predictor = new FundamentalAnalysisPredictor();
    const qualifiedBets = [];
    let gamesAnalyzed = 0;

    for (const [matchup, opportunities] of Object.entries(gamesByMatchup)) {
      console.log('\n' + '='.repeat(80));
      console.log(`GAME: ${matchup}`);
      console.log('='.repeat(80));

      // Show all available betting opportunities for this game
      console.log(`\nAvailable opportunities (${opportunities.length}):`);
      opportunities.forEach((opp, i) => {
        const startTime = new Date(opp.starts).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York'
        });
        console.log(`  ${i+1}. ${opp.selection} @ ${opp.cloudbetOdds} (starts ${startTime} EST)`);
      });

      // Run fundamental analysis once per game
      console.log(`\n📊 Running fundamental analysis...`);
      try {
        const firstOpp = opportunities[0];
        const prediction = await predictor.predictWinner(firstOpp, 'basketball');

        gamesAnalyzed++;

        if (!prediction) {
          console.log('❌ No prediction available (insufficient data)');
          continue;
        }

        console.log(`\n✅ PREDICTION RESULTS:`);
        console.log(`   Predicted Winner: ${prediction.predictedWinner}`);
        console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${prediction.reasoning}`);

        // Check each opportunity against prediction
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

    console.log(`NBA games analyzed: ${gamesAnalyzed}`);
    console.log(`Qualified bets: ${qualifiedBets.length}\n`);

    if (qualifiedBets.length > 0) {
      console.log('✅ BETS READY TO PLACE:\n');
      qualifiedBets.forEach((bet, i) => {
        const startTime = new Date(bet.starts).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York'
        });
        console.log(`${i + 1}. ${bet.game} - ${startTime} EST`);
        console.log(`   Bet: ${bet.selection} @ ${bet.odds}`);
        console.log(`   Prediction: ${bet.prediction}`);
        console.log(`   Confidence: ${(bet.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${bet.reasoning}\n`);
      });
    } else {
      console.log('❌ No bets qualify based on current criteria\n');
      console.log('Possible reasons:');
      console.log('  • Fundamental analysis disagrees with available opportunities');
      console.log('  • Predictions below minimum confidence threshold');
      console.log('  • No clear statistical advantage detected');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();
