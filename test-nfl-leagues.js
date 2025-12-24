require('dotenv').config();
const axios = require('axios');

async function testNFLLeagues() {
  const apiKey = process.env.API_SPORTS_KEY;

  console.log('Testing what NFL leagues/seasons are available...\n');

  try {
    // Test 1: Get leagues
    console.log('1. Fetching available leagues...\n');
    const leaguesResponse = await axios.get('https://v1.american-football.api-sports.io/leagues', {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v1.american-football.api-sports.io'
      }
    });

    if (leaguesResponse.data && leaguesResponse.data.response) {
      console.log('Available leagues:', leaguesResponse.data.response.length);
      leaguesResponse.data.response.slice(0, 5).forEach(league => {
        console.log(`- ID: ${league.league.id}, Name: ${league.league.name}`);
      });
    }

    // Test 2: Try different seasons
    console.log('\n2. Testing different seasons for NFL (league 1)...\n');

    for (const season of [2024, 2025, 2023]) {
      try {
        const response = await axios.get('https://v1.american-football.api-sports.io/standings', {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'v1.american-football.api-sports.io'
          },
          params: {
            league: 1,
            season: season
          }
        });

        const standings = response.data.response || [];
        console.log(`Season ${season}: ${standings.length} conferences`);

        if (standings.length > 0 && Array.isArray(standings[0])) {
          console.log(`  ✅ Has data! (${standings[0].length} teams in first conference)`);
          if (standings[0][0] && standings[0][0].team) {
            console.log(`  Sample team: ${standings[0][0].team.name}`);
          }
        }
      } catch (e) {
        console.log(`Season ${season}: Error - ${e.message}`);
      }
    }

  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.message);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNFLLeagues();
