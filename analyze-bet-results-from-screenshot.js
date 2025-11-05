// Analysis based on the bet history screenshot
// This represents the ACTUAL results from your bets

console.log('\n' + '='.repeat(70));
console.log('📊 BET RESULTS ANALYSIS - FROM CLOUDBET SCREENSHOT');
console.log('='.repeat(70));

const visibleResults = [
  {
    event: 'FK/Glimt vs AS Monaco (Champions League)',
    result: 'Loss',
    amount: -1,
    bets: 1,
    note: 'Drew 0-0, bet on Draw lost'
  },
  {
    event: 'Atletico Madrid vs Union Saint-Gilloise (Champions League)',
    result: 'Loss',
    amount: -3,
    bets: 3,
    note: 'Atletico won 3-1, bets on Draw/USG lost'
  },
  {
    event: 'Coventry City vs Sheff Utd (Championship)',
    result: 'WIN',
    amount: +3.18,
    bets: 2,
    note: 'Coventry won 3-1, bet on Sheff Utd away won!'
  },
  {
    event: 'Tottenham Hotspur vs FC Copenhagen (Champions League)',
    result: 'Loss',
    amount: -5,
    bets: 5,
    note: 'Spurs won 4-0, bets on Copenhagen away lost'
  },
  {
    event: 'Birmingham City vs Millwall (Championship)',
    result: 'Loss',
    amount: -1,
    bets: 1,
    note: 'Birmingham won 4-0, bet on Millwall away lost'
  },
  {
    event: 'Ipswich Town vs Watford (Championship)',
    result: 'Loss',
    amount: -2,
    bets: 2,
    note: 'Draw 1-1, bets on Watford away lost'
  }
];

console.log('\n📈 VISIBLE RESULTS SUMMARY');
console.log('─'.repeat(70));

let totalStaked = 0;
let totalReturns = 0;
let wins = 0;
let losses = 0;
let totalBets = 0;

visibleResults.forEach((bet, i) => {
  totalBets += bet.bets;
  if (bet.result === 'WIN') {
    wins++;
    totalReturns += bet.amount;
    console.log(`\n${i + 1}. ✅ ${bet.event}`);
    console.log(`   Result: ${bet.result} | Profit: +${bet.amount.toFixed(2)} USDT (${bet.bets} bets)`);
    console.log(`   ${bet.note}`);
  } else {
    losses++;
    totalStaked += Math.abs(bet.amount);
    console.log(`\n${i + 1}. ❌ ${bet.event}`);
    console.log(`   Result: ${bet.result} | Loss: ${bet.amount.toFixed(2)} USDT (${bet.bets} bets)`);
    console.log(`   ${bet.note}`);
  }
});

console.log('\n' + '='.repeat(70));
console.log('💰 FINANCIAL SUMMARY (Visible Results Only)');
console.log('='.repeat(70));
console.log(`Total Bets Visible: ${totalBets}`);
console.log(`Winning Events: ${wins}`);
console.log(`Losing Events: ${losses}`);
console.log(`Total Losses: -${totalStaked.toFixed(2)} USDT`);
console.log(`Total Winnings: +${totalReturns.toFixed(2)} USDT`);
console.log(`Net P/L: ${(totalReturns - totalStaked) >= 0 ? '+' : ''}${(totalReturns - totalStaked).toFixed(2)} USDT`);
console.log(`Win Rate: ${((wins / (wins + losses)) * 100).toFixed(1)}%`);

console.log('\n' + '='.repeat(70));
console.log('📊 FULL BETTING HISTORY COMPARISON');
console.log('='.repeat(70));

const fs = require('fs');
const fullHistory = JSON.parse(fs.readFileSync('data/cloudbet_bets_history.json', 'utf8'));

console.log(`\nTotal Bets Placed: ${fullHistory.length} bets`);
console.log(`Total Stake: ${fullHistory.length} USDT (1 USDT per bet)`);
console.log(`Bets Visible in Screenshot: ${totalBets} bets`);
console.log(`Bets Not Yet Visible: ${fullHistory.length - totalBets} bets`);

console.log('\n⏳ ESTIMATED TOTAL PERFORMANCE');
console.log('─'.repeat(70));
console.log('Note: This is a partial view. Many bets may still be pending or');
console.log('not shown in the screenshot.');

const estimatedTotalStaked = fullHistory.length;
const knownNetPL = totalReturns - totalStaked;
const knownBetsCount = totalBets;
const unknownBetsCount = estimatedTotalStaked - knownBetsCount;

console.log(`\nKnown Results: ${knownBetsCount} bets with ${knownNetPL >= 0 ? '+' : ''}${knownNetPL.toFixed(2)} USDT P/L`);
console.log(`Unknown Results: ${unknownBetsCount} bets (still pending or not visible)`);

console.log('\n' + '='.repeat(70));
console.log('🎯 KEY INSIGHTS');
console.log('='.repeat(70));
console.log('✅ ONE WIN: Coventry vs Sheff Utd bet paid +3.18 USDT');
console.log('❌ LOSSES: Multiple losses on Champions League underdogs');
console.log('📊 Current visible ROI: ' + ((knownNetPL / knownBetsCount) * 100).toFixed(1) + '%');
console.log('\n⚠️  Important: Many boxing/tennis/other soccer bets from your history');
console.log('   are not visible in this screenshot. Scroll down in Cloudbet to see all results.');

console.log('\n' + '='.repeat(70));
console.log('📋 RECOMMENDATIONS');
console.log('='.repeat(70));
console.log('1. Check the full bet history on Cloudbet (scroll down to see all 66 bets)');
console.log('2. Look for boxing matches (Fernando Martinez, Erickson Lubin, etc.)');
console.log('3. Check tennis matches (Djokovic, Wawrinka, etc.)');
console.log('4. Check other soccer matches (Chelsea, Man City, Arsenal, etc.)');
console.log('\nThese represent the other ~52 bets that need to be checked for results.');
console.log('='.repeat(70) + '\n');
