const fs = require('fs');
const path = require('path');

/**
 * Analyze all bets from production_bets.json
 */
function analyzeBets() {
  const betsFile = path.join(__dirname, 'data', 'production_bets.json');

  if (!fs.existsSync(betsFile)) {
    console.log('❌ No bets file found at:', betsFile);
    return;
  }

  const bets = JSON.parse(fs.readFileSync(betsFile, 'utf8'));

  console.log('\n' + '='.repeat(80));
  console.log('ALL BETS ANALYSIS');
  console.log('='.repeat(80));
  console.log(`Total bets in file: ${bets.length}\n`);

  // Group by date
  const betsByDate = {};
  const betsBySport = {};

  bets.forEach((bet, index) => {
    const timestamp = new Date(bet.timestamp);
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!betsByDate[dateStr]) {
      betsByDate[dateStr] = [];
    }
    betsByDate[dateStr].push({ ...bet, index: index + 1 });

    const sport = bet.opportunity?.sport || 'unknown';
    if (!betsBySport[sport]) {
      betsBySport[sport] = 0;
    }
    betsBySport[sport]++;
  });

  // Show bets by sport
  console.log('BETS BY SPORT:');
  Object.entries(betsBySport)
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count} bets`);
    });

  console.log('\n' + '='.repeat(80));
  console.log('BETS BY DATE:');
  console.log('='.repeat(80) + '\n');

  // Sort dates
  const sortedDates = Object.keys(betsByDate).sort();

  sortedDates.forEach(date => {
    const dateBets = betsByDate[date];
    console.log(`\n📅 ${date} (${dateBets.length} bets)`);
    console.log('-'.repeat(80));

    dateBets.forEach(bet => {
      const opp = bet.opportunity;
      const eval = bet.evaluation;
      const result = bet.result;

      console.log(`\n${bet.index}. ${opp.home} vs ${opp.away}`);
      console.log(`   Sport: ${opp.sport}`);
      console.log(`   Market: ${opp.marketType}`);
      console.log(`   Bet: ${opp.side} @ ${opp.cloudbetOdds}`);
      console.log(`   Stake: ${eval?.betSize || 'N/A'} USDT`);
      console.log(`   Edge: ${eval?.edge?.toFixed(2) || 'N/A'}%`);
      console.log(`   Event starts: ${opp.starts}`);
      console.log(`   Status: ${result?.status || bet.success ? 'PLACED' : 'FAILED'}`);
      console.log(`   Bet ID: ${result?.id || 'N/A'}`);

      // Check if it's UFC/MMA
      if (opp.sport === 'mma' || opp.home?.toLowerCase().includes('maddalena') ||
          opp.away?.toLowerCase().includes('maddalena') ||
          opp.home?.toLowerCase().includes('makhachev') ||
          opp.away?.toLowerCase().includes('makhachev')) {
        console.log(`   ⚠️  UFC/MMA FIGHT DETECTED`);
      }
    });
  });

  // Look specifically for Nov 16 bets
  console.log('\n' + '='.repeat(80));
  console.log('NOVEMBER 16 BETS (if any):');
  console.log('='.repeat(80));

  const nov16Bets = betsByDate['2025-11-16'] || betsByDate['2024-11-16'];
  if (nov16Bets) {
    console.log(`\nFound ${nov16Bets.length} bets on Nov 16:\n`);
    nov16Bets.forEach(bet => {
      const opp = bet.opportunity;
      console.log(`- ${opp.home} vs ${opp.away} (${opp.sport}) - Bet: ${opp.side} @ ${opp.cloudbetOdds}`);
    });
  } else {
    console.log('\n⚠️  No bets found for November 16, 2025 or 2024');
  }

  // Search for any UFC/MMA bets
  console.log('\n' + '='.repeat(80));
  console.log('ALL UFC/MMA BETS:');
  console.log('='.repeat(80));

  const mmaBets = bets.filter(bet =>
    bet.opportunity?.sport === 'mma' ||
    bet.opportunity?.sport === 'boxing' ||
    bet.opportunity?.home?.toLowerCase().includes('maddalena') ||
    bet.opportunity?.away?.toLowerCase().includes('maddalena') ||
    bet.opportunity?.home?.toLowerCase().includes('makhachev') ||
    bet.opportunity?.away?.toLowerCase().includes('makhachev')
  );

  if (mmaBets.length > 0) {
    console.log(`\nFound ${mmaBets.length} UFC/MMA bets:\n`);
    mmaBets.forEach((bet, i) => {
      const opp = bet.opportunity;
      const eval = bet.evaluation;
      const timestamp = new Date(bet.timestamp);
      console.log(`${i + 1}. ${timestamp.toISOString()}`);
      console.log(`   ${opp.home} vs ${opp.away}`);
      console.log(`   Bet: ${opp.side} @ ${opp.cloudbetOdds}`);
      console.log(`   Stake: ${eval?.betSize || 'N/A'} USDT`);
      console.log('');
    });
  } else {
    console.log('\n⚠️  No UFC/MMA bets found in the file');
  }

  console.log('='.repeat(80) + '\n');
}

analyzeBets();
