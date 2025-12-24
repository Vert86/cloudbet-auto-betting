/**
 * Analyze funds and losses from the latest bet history
 */

console.log('\n' + '='.repeat(80));
console.log('ANALYZING LATEST BET RESULTS');
console.log('='.repeat(80) + '\n');

// Data from latest_bet_history.png
const recentBets = [
  // Nov 23 - Boxing/MMA
  { date: 'Nov 23', event: 'Anthony Yarde vs David Benavidez', sport: 'Boxing', bets: 4, stake: 4, result: 'LOSS', pl: -4 },
  { date: 'Nov 23', event: 'Fernando Martinez vs Jesse Rodriguez', sport: 'Boxing', bets: 4, stake: 4, result: 'LOSS', pl: -4 },
  { date: 'Nov 23', event: 'Sam Noakes vs Abdullah Mason', sport: 'Boxing', bets: 3, stake: 3, result: 'LOSS', pl: -3 },

  // Nov 22 - Soccer (Automation bets)
  { date: 'Nov 22', event: 'Liverpool vs Nottingham Forest', sport: 'Soccer', bets: 3, stake: 5.57, result: 'LOSS', pl: -5.57 },
  { date: 'Nov 22', event: 'Brighton vs Brentford', sport: 'Soccer', bets: 8, stake: 13.97, result: 'LOSS', pl: -3.53 },
  { date: 'Nov 22', event: 'AFC Bournemouth vs West Ham', sport: 'Soccer', bets: 10, stake: 18.58, result: 'DRAW', pl: -0.58 },
  { date: 'Nov 22', event: 'Fulham vs Sunderland', sport: 'Soccer', bets: 9, stake: 13.39, result: 'LOSS', pl: -1.96 },
];

// Calculate totals
let totalBets = 0;
let totalStaked = 0;
let totalLoss = 0;
let boxingBets = 0;
let boxingLoss = 0;
let soccerBets = 0;
let soccerLoss = 0;

recentBets.forEach(bet => {
  totalBets += bet.bets;
  totalStaked += bet.stake;
  totalLoss += bet.pl;

  if (bet.sport === 'Boxing') {
    boxingBets += bet.bets;
    boxingLoss += bet.pl;
  } else {
    soccerBets += bet.bets;
    soccerLoss += bet.pl;
  }
});

console.log('📊 OVERALL RESULTS:');
console.log(\`Total bets placed: \${totalBets}\`);
console.log(\`Total staked: \${totalStaked.toFixed(2)} USDT\`);
console.log(\`Total P/L: \${totalLoss.toFixed(2)} USDT\n\`);

console.log('🥊 BOXING/MMA BETS (Nov 23):');
console.log(\`Bets: \${boxingBets}\`);
console.log(\`Loss: \${boxingLoss.toFixed(2)} USDT\`);
console.log(\`Win rate: 0% (0 wins)\`);
console.log('');

console.log('⚽ SOCCER BETS (Nov 22):');
console.log(\`Bets: \${soccerBets}\`);
console.log(\`Loss: \${soccerLoss.toFixed(2)} USDT\`);
console.log('');

console.log('='.repeat(80));
console.log('🔍 THE PROBLEM: HALF-TIME BETTING');
console.log('='.repeat(80) + '\n');

console.log('❌ Your automation is betting on HALF-TIME markets:\n');
console.log('   • First Half Winner');
console.log('   • Second Half Winner\n');

console.log('This is EXTREMELY difficult because:\n');
console.log('   1. Half-time results are highly random');
console.log('   2. Many matches are 0-0 at half time');
console.log('   3. Teams change tactics between halves');
console.log('   4. Much harder to predict than full match\n');

console.log('✅ SOLUTION: Switch to FULL MATCH markets\n');
console.log('   Instead of: "First Half: Chelsea to win"');
console.log('   Bet on:     "Full Match: Chelsea to win"\n');

console.log('='.repeat(80) + '\n');
