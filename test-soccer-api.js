const axios = require('axios');
require('dotenv').config();

async function testSoccerAPI() {
  const apiKey = process.env.API_SPORTS_KEY;
  console.log('API Key:', apiKey ? 'Present' : 'Missing');

  if (!apiKey) {
    console.error('No API key found');
    return;
  }

  // Test Bundesliga (league ID 78) for 2024 season (free plan limitation)
  console.log('\nTesting API-Sports Football API...');
  console.log('League: Bundesliga (78)');
  console.log('Season: 2024\n');

  try {
    const response = await axios.get('https://v3.football.api-sports.io/standings', {
      params: {
        league: 78,
        season: 2024
      },
      headers: {
        'x-apisports-key': apiKey
      },
      timeout: 10000
    });

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2).substring(0, 1000));

    if (response.data.response && response.data.response.length > 0) {
      const standings = response.data.response[0].league.standings[0];
      console.log(`\n✅ Found ${standings.length} teams in Bundesliga`);
      console.log('First 3 teams:');
      standings.slice(0, 3).forEach(team => {
        console.log(`  ${team.rank}. ${team.team.name} - ${team.points} pts (${team.all.win}W-${team.all.draw}D-${team.all.lose}L)`);
      });
    } else {
      console.log('\n❌ No data returned');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSoccerAPI();
