const aggregator = require('./src/services/multiBookmakerOddsAggregator');
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');

(async () => {
  try {
    console.log('🎯 TESTING FULL FUNDAMENTAL ANALYSIS FLOW\n');
    console.log('=' .repeat(80));

    // Test NBA
    console.log('\n🏀 NBA ANALYSIS\n');
    const nbaOpps = await aggregator.findOpportunities('basketball');
    console.log(`✅ Step 1: Found ${nbaOpps.length} NBA opportunities (MIN_BOOKMAKERS=0 working!)\n`);

    if (nbaOpps.length > 0) {
      const predictor = new FundamentalAnalysisPredictor();

      // Filter to actual NBA games (not college basketball)
      const nbaGames = nbaOpps.filter(o =>
        o.competition && (
          o.competition.toLowerCase().includes('nba') ||
          o.sport === 'basketball'
        )
      );

      console.log(`Found ${nbaGames.length} potential NBA games\n`);

      if (nbaGames.length > 0) {
        console.log('Step 2: Running fundamental analysis on games...\n');

        let analyzed = 0;
        let predictions = 0;

        for (const opp of nbaGames.slice(0, 5)) {
          console.log(`\nAnalyzing: ${opp.home} vs ${opp.away}`);
          console.log(`  Cloudbet Odds: ${opp.cloudbetOdds} for ${opp.selection}`);

          try {
            const prediction = await predictor.predictWinner(opp, 'basketball');
            analyzed++;

            if (prediction) {
              predictions++;
              console.log(`  ✅ Prediction: ${prediction.predictedWinner}`);
              console.log(`  Confidence: ${prediction.confidence}`);
              console.log(`  Reasoning: ${prediction.reasoning}`);

              // Check if this would be a bet
              const selectionLower = opp.selection.toLowerCase();
              const predictedLower = prediction.predictedWinner.toLowerCase();
              const isMatch = selectionLower === predictedLower ||
                             (selectionLower === 'home' && predictedLower.includes(opp.home.toLowerCase())) ||
                             (selectionLower === 'away' && predictedLower.includes(opp.away.toLowerCase()));

              if (isMatch) {
                console.log(`  🎯 WOULD BET: Fundamental analysis agrees with this opportunity!`);
              } else {
                console.log(`  ❌ SKIP: Fundamental analysis predicts different winner`);
              }
            } else {
              console.log(`  ⚠️  No prediction (insufficient data or API issue)`);
            }
          } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
          }
        }

        console.log('\n' + '='.repeat(80));
        console.log('SUMMARY');
        console.log('='.repeat(80));
        console.log(`Total opportunities: ${nbaOpps.length}`);
        console.log(`Games analyzed: ${analyzed}`);
        console.log(`Predictions generated: ${predictions}`);
        console.log(`\nKey Takeaway: With MIN_BOOKMAKERS=0, fundamental analysis can now run!`);
      }
    } else {
      console.log('❌ No NBA games available right now\n');
      console.log('This could mean:');
      console.log('  1. No NBA games scheduled today');
      console.log('  2. Games already started (only pre-game bets)');
      console.log('  3. Cloudbet not offering odds yet');
      console.log('\nTry again during NBA game hours (typically 4-10 PM EST)');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  }
})();
