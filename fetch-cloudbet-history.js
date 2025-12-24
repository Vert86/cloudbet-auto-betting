require('dotenv').config();
const axios = require('axios');

/**
 * Fetch ACTUAL bet history from CloudBet API
 */
async function fetchActualHistory() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('FETCHING ACTUAL BET HISTORY FROM CLOUDBET API');
    console.log('='.repeat(80) + '\n');

    const tradingClient = axios.create({
      baseURL: 'https://trading-api.cloudbet.com/v2',
      headers: {
        'X-API-Key': process.env.CLOUDBET_API_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Fetch bet history
    const response = await tradingClient.get('/bets', {
      params: {
        limit: 100,
        status: 'ALL'
      }
    });

    const bets = response.data || [];
    console.log(`Found ${bets.length} total bets in your CloudBet account\n`);

    if (bets.length === 0) {
      console.log('No bets found.');
      return;
    }

    // Group by date
    const betsByDate = {};
    const betsBySport = {};

    bets.forEach(bet => {
      const createDate = new Date(bet.createTime).toISOString().split('T')[0];

      if (!betsByDate[createDate]) {
        betsByDate[createDate] = [];
      }
      betsByDate[createDate].push(bet);

      // Try to determine sport from eventName or marketUrl
      let sport = 'unknown';
      if (bet.marketUrl) {
        if (bet.marketUrl.includes('soccer')) sport = 'soccer';
        else if (bet.marketUrl.includes('mma') || bet.marketUrl.includes('ufc')) sport = 'mma';
        else if (bet.marketUrl.includes('basketball')) sport = 'basketball';
        else if (bet.marketUrl.includes('americanfootball')) sport = 'american-football';
        else if (bet.marketUrl.includes('icehockey')) sport = 'ice-hockey';
        else if (bet.marketUrl.includes('boxing')) sport = 'boxing';
      }

      if (!betsBySport[sport]) {
        betsBySport[sport] = 0;
      }
      betsBySport[sport]++;
    });

    // Show summary
    console.log('BETS BY SPORT:');
    Object.entries(betsBySport)
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count} bets`);
      });

    console.log('\n' + '='.repeat(80));

    // Sort and show by date
    const sortedDates = Object.keys(betsByDate).sort();

    sortedDates.forEach(date => {
      const dateBets = betsByDate[date];
      console.log(`\n📅 ${date} (${dateBets.length} bets)`);
      console.log('-'.repeat(80));

      dateBets.forEach((bet, i) => {
        const createTime = new Date(bet.createTime);
        const eventTime = bet.eventTime ? new Date(bet.eventTime) : null;

        console.log(`\n${i + 1}. ${bet.eventName || 'Unknown Event'}`);
        console.log(`   Bet ID: ${bet.id}`);
        console.log(`   Selection: ${bet.selectionName || bet.marketUrl}`);
        console.log(`   Odds: ${bet.price} | Stake: ${bet.stake} ${bet.currency}`);
        console.log(`   Status: ${bet.status}`);
        console.log(`   Placed: ${createTime.toLocaleString()}`);
        if (eventTime) {
          console.log(`   Event time: ${eventTime.toLocaleString()}`);
        }

        if (bet.status === 'RESULTED_WIN') {
          const payout = parseFloat(bet.returnAmount || 0);
          const profit = payout - parseFloat(bet.stake);
          console.log(`   ✅ WON - Profit: +${profit.toFixed(2)} ${bet.currency}`);
        } else if (bet.status === 'RESULTED_LOSS') {
          console.log(`   ❌ LOST - Loss: -${bet.stake} ${bet.currency}`);
        } else if (bet.status === 'RESULTED_VOID') {
          console.log(`   ⚪ VOID - Stake returned`);
        }

        // Check for UFC/MMA
        const eventNameLower = (bet.eventName || '').toLowerCase();
        if (eventNameLower.includes('maddalena') ||
            eventNameLower.includes('makhachev') ||
            eventNameLower.includes('ufc') ||
            bet.marketUrl?.includes('mma')) {
          console.log(`   ⚠️  UFC/MMA BET DETECTED!`);
        }
      });
    });

    // Look for Nov 16 specifically
    console.log('\n' + '='.repeat(80));
    console.log('NOVEMBER 16, 2024 BETS:');
    console.log('='.repeat(80));

    const nov16 = betsByDate['2024-11-16'] || betsByDate['2025-11-16'];
    if (nov16) {
      console.log(`\nFound ${nov16.length} bets on November 16:\n`);
      nov16.forEach(bet => {
        console.log(`- ${bet.eventName}`);
        console.log(`  Selection: ${bet.selectionName || bet.marketUrl}`);
        console.log(`  Status: ${bet.status}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No bets found for November 16');
    }

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

fetchActualHistory();
