require('dotenv').config();
const axios = require('axios');

async function testFreeAPIs() {
  console.log('Testing Free NFL/NHL APIs for Current Season Data...\n');
  console.log('='.repeat(80) + '\n');

  // Test 1: BallDontLie NFL API
  console.log('1. Testing BallDontLie NFL API...\n');
  try {
    const nflResponse = await axios.get('https://api.balldontlie.io/nfl/v1/standings', {
      params: { season: 2024 },
      headers: {
        'Authorization': process.env.BALLDONTLIE_API_KEY
      }
    });

    if (nflResponse.data && nflResponse.data.data) {
      console.log('✅ BallDontLie NFL API works!');
      console.log(`Found ${nflResponse.data.data.length} teams\n`);

      // Show sample teams
      nflResponse.data.data.slice(0, 3).forEach(team => {
        console.log(`- ${team.team.full_name}: ${team.wins}-${team.losses} (${team.win_percentage})`);
      });
      console.log();
    }
  } catch (error) {
    console.log('❌ BallDontLie NFL API failed:', error.response?.status, error.message);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data).slice(0, 200));
    }
    console.log();
  }

  // Test 2: ESPN NFL API (Unofficial)
  console.log('2. Testing ESPN NFL API (Unofficial)...\n');
  try {
    const espnResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings', {
      timeout: 10000
    });

    if (espnResponse.data && espnResponse.data.children) {
      console.log('✅ ESPN NFL API works!');
      const teams = espnResponse.data.children[0]?.standings?.entries || [];
      console.log(`Found ${teams.length} teams\n`);

      // Show sample teams
      teams.slice(0, 3).forEach(team => {
        const stats = team.stats.find(s => s.name === 'wins');
        const losses = team.stats.find(s => s.name === 'losses');
        console.log(`- ${team.team.displayName}: ${stats?.value}-${losses?.value}`);
      });
      console.log();
    }
  } catch (error) {
    console.log('❌ ESPN NFL API failed:', error.message);
    console.log();
  }

  console.log('='.repeat(80) + '\n');

  // Test 3: Official NHL API
  console.log('3. Testing Official NHL API...\n');
  try {
    const nhlResponse = await axios.get('https://api-web.nhle.com/v1/standings/now', {
      timeout: 10000
    });

    if (nhlResponse.data && nhlResponse.data.standings) {
      console.log('✅ NHL Official API works!');
      const teams = nhlResponse.data.standings;
      console.log(`Found ${teams.length} teams\n`);

      // Show sample teams
      teams.slice(0, 3).forEach(team => {
        console.log(`- ${team.teamName?.default}: ${team.wins}-${team.losses}-${team.otLosses} (${team.points} pts)`);
      });
      console.log();
    }
  } catch (error) {
    console.log('❌ NHL Official API failed:', error.message);
    console.log();
  }

  console.log('='.repeat(80) + '\n');
  console.log('Testing complete!\n');
}

testFreeAPIs();
