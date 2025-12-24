const cloudbetAPI = require('./src/services/cloudbetAPI');

async function checkActiveBets() {
  console.log('=== FETCHING ACTIVE BETS FROM CLOUDBET ===\n');

  try {
    // Fetch active bets
    console.log('Fetching open bets...');
    const openBets = await cloudbetAPI.getBets(100, 0, 'OPEN');

    console.log('\nOPEN BETS:');
    console.log('Count:', openBets.length);

    if (openBets.length > 0) {
      const totalStaked = openBets.reduce((sum, bet) => sum + parseFloat(bet.stake || 0), 0);
      console.log('Total staked in open bets:', totalStaked.toFixed(2), 'USDT');

      console.log('\nFirst 5 open bets:');
      openBets.slice(0, 5).forEach((bet, i) => {
        console.log(`[${i+1}] Stake: ${bet.stake}, Price: ${bet.price}, Status: ${bet.status}`);
      });
    }

    // Also check settled bets
    console.log('\n\nFetching settled bets...');
    const settledBets = await cloudbetAPI.getBets(100, 0, 'SETTLED');

    console.log('\nSETTLED BETS:');
    console.log('Count:', settledBets.length);

    if (settledBets.length > 0) {
      const totalStaked = settledBets.reduce((sum, bet) => sum + parseFloat(bet.stake || 0), 0);
      const totalReturns = settledBets.reduce((sum, bet) => sum + parseFloat(bet.returnAmount || 0), 0);
      console.log('Total staked:', totalStaked.toFixed(2), 'USDT');
      console.log('Total returns:', totalReturns.toFixed(2), 'USDT');
      console.log('Net profit/loss:', (totalReturns - totalStaked).toFixed(2), 'USDT');
    }

    // Check all bets
    console.log('\n\nFetching ALL recent bets...');
    const allBets = await cloudbetAPI.getBets(100, 0);
    console.log('Total recent bets:', allBets.length);

  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkActiveBets();
