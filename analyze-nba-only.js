const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('🏀 NBA FUNDAMENTAL ANALYSIS - LIVE BETTING QUALIFICATION CHECK\n');
    console.log('='.repeat(80) + '\n');

    // Get all basketball opportunities
    const allBasketballOpps = await aggregator.findOpportunities('basketball');
    console.log(`Total basketball opportunities: ${allBasketballOpps.length}`);

    // Filter to ONLY NBA games (not college basketball)
    const nbaOpps = allBasketballOpps.filter(opp => {
      const competition = (opp.competition || '').toLowerCase();
      const isNBA = competition.includes('nba') && !competition.includes('wnba');
      return isNBA;
    });

    console.log(`Filtered to NBA games only: ${nbaOpps.length}\n`);

    if (nbaOpps.length === 0) {
      console.log('❌ No NBA games available right now');
      console.log('\nPossible reasons:');
      console.log('  • No NBA games scheduled today');
      console.log('  • Games already started (bot only bets pre-game)');
      console.log('  • Off-season period');
      console.log('\nNBA games typically available: 4-10 PM EST on game days');
      return;
    }

    console.log('NBA GAMES FOUND:\n');
    nbaOpps.forEach((opp, i) => {
      console.log(`${i + 1}. ${opp.home} vs ${opp.away}`);
      console.log(`   Competition: ${opp.competition}`);
      console.log(`   Start Time: ${opp.starts || 'Unknown'}`);
      console.log(`   Selection: ${opp.selection} @ ${opp.cloudbetOdds}\n`);
    });

    console.log('='.repeat(80));
    console.log('RUNNING FUNDAMENTAL ANALYSIS ON EACH GAME\n');
    console.log('='.repeat(80) + '\n');

    const predictor = new FundamentalAnalysisPredictor();
    const qualifiedBets = [];

    for (let i = 0; i < nbaOpps.length; i++) {
      const opp = nbaOpps[i];
      console.log(`\n[${i + 1}/${nbaOpps.length}] ${opp.home} vs ${opp.away}`);
      console.log('-'.repeat(80));

      try {
        // Run fundamental analysis
        const prediction = await predictor.predictWinner(opp, 'basketball');

        if (!prediction) {
          console.log('❌ No prediction available (insufficient data or API error)');
          continue;
        }

        // Display prediction details
        console.log(`\n📊 FUNDAMENTAL ANALYSIS RESULTS:`);
        console.log(`   Predicted Winner: ${prediction.predictedWinner}`);
        console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${prediction.reasoning}`);

        // Check if prediction matches the opportunity
        const selectionLower = opp.selection.toLowerCase();
        const predictedLower = prediction.predictedWinner.toLowerCase();

        let matches = false;
        if (selectionLower === 'home' && (predictedLower.includes('home') || predictedLower.includes(opp.home.toLowerCase()))) {
          matches = true;
        } else if (selectionLower === 'away' && (predictedLower.includes('away') || predictedLower.includes(opp.away.toLowerCase()))) {
          matches = true;
        } else if (predictedLower.includes(selectionLower)) {
          matches = true;
        }

        console.log(`\n🎯 BET OPPORTUNITY ANALYSIS:`);
        console.log(`   Cloudbet offering: ${opp.selection} @ ${opp.cloudbetOdds}`);
        console.log(`   Fundamental analysis predicts: ${prediction.predictedWinner}`);
        console.log(`   Match: ${matches ? '✅ YES' : '❌ NO'}`);
        console.log(`   Confidence threshold: ${(parseFloat(process.env.MIN_PREDICTION_CONFIDENCE) * 100).toFixed(0)}%`);

        // Check if bet qualifies
        const meetsConfidence = prediction.confidence >= parseFloat(process.env.MIN_PREDICTION_CONFIDENCE || 0.6);

        if (matches && meetsConfidence) {
          console.log(`\n✅ BET QUALIFIES!`);
          qualifiedBets.push({
            game: `${opp.home} vs ${opp.away}`,
            selection: opp.selection,
            odds: opp.cloudbetOdds,
            prediction: prediction.predictedWinner,
            confidence: prediction.confidence,
            reasoning: prediction.reasoning
          });
        } else {
          console.log(`\n❌ BET DOES NOT QUALIFY`);
          if (!matches) console.log(`   Reason: Prediction doesn't match opportunity`);
          if (!meetsConfidence) console.log(`   Reason: Confidence too low (${(prediction.confidence * 100).toFixed(1)}% < ${(parseFloat(process.env.MIN_PREDICTION_CONFIDENCE) * 100).toFixed(0)}%)`);
        }

      } catch (error) {
        console.log(`❌ Error analyzing game: ${error.message}`);
      }
    }

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('FINAL BETTING SUMMARY');
    console.log('='.repeat(80) + '\n');

    console.log(`Total NBA games analyzed: ${nbaOpps.length}`);
    console.log(`Qualified bets: ${qualifiedBets.length}\n`);

    if (qualifiedBets.length > 0) {
      console.log('🎯 BETS THAT QUALIFY FOR PLACEMENT:\n');
      qualifiedBets.forEach((bet, i) => {
        console.log(`${i + 1}. ${bet.game}`);
        console.log(`   Bet: ${bet.selection} @ ${bet.odds}`);
        console.log(`   Prediction: ${bet.prediction}`);
        console.log(`   Confidence: ${(bet.confidence * 100).toFixed(1)}%`);
        console.log(`   Reasoning: ${bet.reasoning}\n`);
      });

      console.log('✅ These bets meet your criteria:');
      console.log(`   • Fundamental analysis confidence >= ${(parseFloat(process.env.MIN_PREDICTION_CONFIDENCE) * 100).toFixed(0)}%`);
      console.log(`   • Prediction matches Cloudbet opportunity`);
      console.log(`   • Based on current team win-loss records`);

    } else {
      console.log('❌ No NBA bets qualify at this time\n');
      console.log('Possible reasons:');
      console.log('  • Fundamental analysis disagrees with Cloudbet opportunities');
      console.log('  • Predictions don\'t meet minimum confidence threshold');
      console.log('  • Insufficient team data to make predictions');
      console.log('  • Evenly matched games (no clear favorite)');
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
    console.error(error.stack);
  }
})();
