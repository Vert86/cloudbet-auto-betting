require('dotenv').config();
const axios = require('axios');
const config = require('./src/config/config');
const fs = require('fs');
const path = require('path');

/**
 * Fetch bet results from Cloudbet API
 * The /bets endpoint returns bet details including settlement status
 */
async function updateBetResults() {
  console.log('Fetching bet results from Cloudbet...\n');

  try {
    const tradingClient = axios.create({
      baseURL: 'https://trading-api.cloudbet.com/v2',
      headers: {
        'X-API-Key': config.cloudbet.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Fetch all bets
    const response = await tradingClient.get('/bets', {
      params: {
        status: 'ALL', // Get all bets regardless of status
        limit: 100, // Max 100 per request
      }
    });

    const bets = response.data || [];
    console.log(`Found ${bets.length} bets from Cloudbet API\n`);

    if (bets.length === 0) {
      console.log('No bets found in your account.');
      return;
    }

    // Categorize bets
    const byStatus = {
      WON: [],
      LOST: [],
      VOID: [],
      PENDING: [],
      ACCEPTED: [],
    };

    let totalStake = 0;
    let totalReturn = 0;

    bets.forEach(bet => {
      const status = bet.status || 'UNKNOWN';
      const stake = parseFloat(bet.stake) || 0;
      const potentialReturn = parseFloat(bet.returnAmount) || 0;

      totalStake += stake;

      if (status === 'WON') {
        totalReturn += potentialReturn;
        byStatus.WON.push(bet);
      } else if (status === 'LOST') {
        byStatus.LOST.push(bet);
      } else if (status === 'VOID') {
        totalReturn += stake; // Void bets return stake
        byStatus.VOID.push(bet);
      } else if (status === 'PENDING' || status === 'ACCEPTED') {
        byStatus.PENDING.push(bet);
      }
    });

    // Display results
    console.log('=' .repeat(80));
    console.log('BET RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log('');
    console.log(`Total Bets: ${bets.length}`);
    console.log(`  Won: ${byStatus.WON.length}`);
    console.log(`  Lost: ${byStatus.LOST.length}`);
    console.log(`  Void: ${byStatus.VOID.length}`);
    console.log(`  Pending: ${byStatus.PENDING.length}`);
    console.log('');
    console.log(`Total Staked: ${totalStake.toFixed(3)} ${config.cloudbet.currency}`);
    console.log(`Total Returned: ${totalReturn.toFixed(3)} ${config.cloudbet.currency}`);
    console.log(`Net Profit/Loss: ${(totalReturn - totalStake >= 0 ? '+' : '')}${(totalReturn - totalStake).toFixed(3)} ${config.cloudbet.currency}`);

    if (totalStake > 0) {
      const roi = ((totalReturn - totalStake) / totalStake * 100);
      console.log(`ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`);
    }

    console.log('');
    console.log('=' .repeat(80));

    // Show recent settled bets
    const settledBets = [...byStatus.WON, ...byStatus.LOST, ...byStatus.VOID]
      .sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
      .slice(0, 20);

    if (settledBets.length > 0) {
      console.log('\nLAST 20 SETTLED BETS:\n');

      settledBets.forEach((bet, i) => {
        const status = bet.status;
        const stake = parseFloat(bet.stake) || 0;
        const odds = parseFloat(bet.price) || 0;
        const returnAmt = parseFloat(bet.returnAmount) || 0;
        const profit = status === 'WON' ? (returnAmt - stake) : (status === 'VOID' ? 0 : -stake);

        const statusIcon = status === 'WON' ? '✅' : status === 'LOST' ? '❌' : '⚪';

        console.log(`${i + 1}. ${statusIcon} ${status}`);
        console.log(`   Event: ${bet.eventName || 'Unknown'}`);
        console.log(`   Selection: ${bet.selectionName || bet.marketUrl || 'Unknown'}`);
        console.log(`   Odds: ${odds.toFixed(2)} | Stake: ${stake.toFixed(2)} ${config.cloudbet.currency}`);
        console.log(`   Profit/Loss: ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${config.cloudbet.currency}`);
        console.log(`   Date: ${new Date(bet.createTime).toLocaleString()}`);
        console.log('');
      });
    }

    // Save updated results to file
    const resultsFile = path.join(__dirname, 'data', 'bet_results_latest.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      fetchTime: new Date().toISOString(),
      summary: {
        total: bets.length,
        won: byStatus.WON.length,
        lost: byStatus.LOST.length,
        void: byStatus.VOID.length,
        pending: byStatus.PENDING.length,
        totalStaked: totalStake,
        totalReturned: totalReturn,
        netProfit: totalReturn - totalStake,
        roi: totalStake > 0 ? ((totalReturn - totalStake) / totalStake * 100) : 0,
      },
      bets: bets,
    }, null, 2));

    console.log(`\n✅ Results saved to: ${resultsFile}\n`);

  } catch (error) {
    console.error('❌ Error fetching bet results:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

updateBetResults();
