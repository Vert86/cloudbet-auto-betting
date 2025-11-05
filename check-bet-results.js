const cloudbetAPI = require('./src/services/cloudbetAPI');
const fs = require('fs').promises;

async function checkBetResults() {

  try {
    console.log('\n🔍 Fetching bet results from Cloudbet...\n');

    // First, let's try to get account info to verify API connection
    try {
      const balance = await cloudbetAPI.getAccountBalance();
      console.log(`✅ API Connected - Balance: ${balance.toFixed(2)} USDT\n`);
    } catch (err) {
      console.log('⚠️  Could not fetch balance:', err.message);
    }

    // Fetch all bets with different statuses
    let allBets;
    try {
      allBets = await cloudbetAPI.getBets(200, 0);
    } catch (err) {
      console.log('❌ Error with /bets/history endpoint:', err.message);
      console.log('\n📝 Note: The /bets/history endpoint may not be available.');
      console.log('Cloudbet API may only provide bet data through websocket or limited endpoints.\n');
      return;
    }

    if (!allBets.bets || allBets.bets.length === 0) {
      console.log('No bets found in history.');
      return;
    }

    console.log(`Found ${allBets.bets.length} total bets\n`);

    // Categorize bets by status
    const won = [];
    const lost = [];
    const voided = [];
    const pending = [];
    const other = [];

    allBets.bets.forEach(bet => {
      if (bet.status === 'RESULTED_WON') {
        won.push(bet);
      } else if (bet.status === 'RESULTED_LOST') {
        lost.push(bet);
      } else if (bet.status === 'RESULTED_VOID' || bet.status === 'CANCELLED') {
        voided.push(bet);
      } else if (bet.status === 'OPEN' || bet.status === 'ACCEPTED') {
        pending.push(bet);
      } else {
        other.push(bet);
      }
    });

    // Display summary
    console.log('='.repeat(60));
    console.log('📊 BET RESULTS SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Won: ${won.length} bets`);
    console.log(`❌ Lost: ${lost.length} bets`);
    console.log(`⏳ Pending: ${pending.length} bets`);
    console.log(`🚫 Voided/Cancelled: ${voided.length} bets`);
    if (other.length > 0) console.log(`❓ Other: ${other.length} bets`);
    console.log('='.repeat(60));

    // Calculate P&L for settled bets
    if (won.length > 0 || lost.length > 0) {
      console.log('\n💰 PROFIT & LOSS ANALYSIS');
      console.log('─'.repeat(60));

      const totalStaked = [...won, ...lost].reduce((sum, bet) => sum + parseFloat(bet.stake || 0), 0);
      const totalReturns = won.reduce((sum, bet) => sum + parseFloat(bet.returnAmount || 0), 0);
      const netProfitLoss = totalReturns - totalStaked;
      const roi = totalStaked > 0 ? (netProfitLoss / totalStaked * 100) : 0;

      console.log(`Total Staked: ${totalStaked.toFixed(2)} USDT`);
      console.log(`Total Returns: ${totalReturns.toFixed(2)} USDT`);
      console.log(`Net P/L: ${netProfitLoss >= 0 ? '+' : ''}${netProfitLoss.toFixed(2)} USDT`);
      console.log(`ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`);
      console.log(`Win Rate: ${((won.length / (won.length + lost.length)) * 100).toFixed(2)}%`);
    }

    // Show won bets
    if (won.length > 0) {
      console.log('\n✅ WINNING BETS');
      console.log('─'.repeat(60));
      won.forEach((bet, i) => {
        const profit = parseFloat(bet.returnAmount || 0) - parseFloat(bet.stake || 0);
        console.log(`${i + 1}. ${bet.eventDescription || 'Unknown Event'}`);
        console.log(`   Selection: ${bet.selectionName || bet.selection || 'N/A'}`);
        console.log(`   Stake: ${bet.stake} ${bet.currency} | Odds: ${bet.price || 'N/A'}`);
        console.log(`   Return: ${bet.returnAmount} ${bet.currency} | Profit: +${profit.toFixed(2)} ${bet.currency}`);
        console.log(`   Ref: ${bet.referenceId || bet.id}`);
        console.log();
      });
    }

    // Show lost bets
    if (lost.length > 0) {
      console.log('\n❌ LOSING BETS');
      console.log('─'.repeat(60));
      lost.slice(0, 20).forEach((bet, i) => {
        console.log(`${i + 1}. ${bet.eventDescription || 'Unknown Event'}`);
        console.log(`   Selection: ${bet.selectionName || bet.selection || 'N/A'}`);
        console.log(`   Stake: ${bet.stake} ${bet.currency} | Odds: ${bet.price || 'N/A'}`);
        console.log(`   Loss: -${bet.stake} ${bet.currency}`);
        console.log(`   Ref: ${bet.referenceId || bet.id}`);
        console.log();
      });
      if (lost.length > 20) {
        console.log(`... and ${lost.length - 20} more losing bets\n`);
      }
    }

    // Show pending bets
    if (pending.length > 0) {
      console.log('\n⏳ PENDING BETS (Not Yet Settled)');
      console.log('─'.repeat(60));
      pending.slice(0, 10).forEach((bet, i) => {
        console.log(`${i + 1}. ${bet.eventDescription || 'Unknown Event'}`);
        console.log(`   Selection: ${bet.selectionName || bet.selection || 'N/A'}`);
        console.log(`   Stake: ${bet.stake} ${bet.currency} | Odds: ${bet.price || 'N/A'}`);
        console.log(`   Status: ${bet.status}`);
        console.log(`   Ref: ${bet.referenceId || bet.id}`);
        console.log();
      });
      if (pending.length > 10) {
        console.log(`... and ${pending.length - 10} more pending bets\n`);
      }
    }

    // Save detailed results to file
    const results = {
      timestamp: new Date().toISOString(),
      summary: {
        total: allBets.bets.length,
        won: won.length,
        lost: lost.length,
        pending: pending.length,
        voided: voided.length
      },
      wonBets: won,
      lostBets: lost,
      pendingBets: pending,
      voidedBets: voided
    };

    await fs.writeFile(
      'data/bet_results.json',
      JSON.stringify(results, null, 2),
      'utf8'
    );

    console.log('\n✅ Results saved to: data/bet_results.json');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('❌ Error fetching bet results:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkBetResults();
