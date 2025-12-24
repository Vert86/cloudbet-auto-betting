require('dotenv').config();
const axios = require('axios');

async function testNFLAPI() {
  const apiKey = process.env.API_SPORTS_KEY;

  console.log('Testing NFL API...\n');

  try {
    const response = await axios.get('https://v1.american-football.api-sports.io/standings', {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v1.american-football.api-sports.io'
      },
      params: {
        league: 1, // NFL
        season: 2025
      }
    });

    console.log('✅ NFL API Response received\n');

    if (response.data && response.data.response) {
      const standings = response.data.response;
      console.log('Total conferences:', standings.length);

      // Show first 5 teams from first conference
      if (standings[0] && Array.isArray(standings[0])) {
        console.log('\nSample teams from standings:\n');
        standings[0].slice(0, 5).forEach(team => {
          if (team && team.team) {
            console.log(`- ${team.team.name} (${team.games.win}-${team.games.lose})`);
          }
        });
      }

      // Try to find Chiefs
      console.log('\n\nSearching for Kansas City Chiefs...\n');
      let found = false;
      for (const conference of standings) {
        if (!Array.isArray(conference)) continue;
        for (const team of conference) {
          if (team && team.team && team.team.name.toLowerCase().includes('chiefs')) {
            console.log('✅ Found Chiefs!');
            console.log('Full name:', team.team.name);
            console.log('Record:', `${team.games.win}-${team.games.lose}`);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        console.log('❌ Could not find Chiefs in standings');
      }

    } else {
      console.log('❌ No standings data in response');
    }

  } catch (error) {
    console.log('❌ Error:', error.response?.status, error.message);
    if (error.response?.data) {
      console.log('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNFLAPI();
