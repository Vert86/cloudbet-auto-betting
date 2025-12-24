require('dotenv').config();
const axios = require('axios');

async function testTeamMatching() {
  const apiKey = process.env.API_SPORTS_KEY;

  console.log('Testing NFL team matching with 2023 season...\n');

  try {
    const response = await axios.get('https://v1.american-football.api-sports.io/standings', {
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': 'v1.american-football.api-sports.io'
      },
      params: {
        league: 1,
        season: 2023
      }
    });

    const standings = response.data.response || [];
    console.log(`✅ Got ${standings.length} conferences\n`);

    // Flatten all teams
    const allTeams = [];
    for (const conference of standings) {
      if (Array.isArray(conference)) {
        allTeams.push(...conference);
      }
    }

    console.log(`Total teams: ${allTeams.length}\n`);

    // Show all team names
    console.log('All team names in API:\n');
    allTeams.forEach(team => {
      if (team && team.team) {
        console.log(`- ${team.team.name} (${team.games.win}-${team.games.lose})`);
      }
    });

    // Test matching CloudBet abbreviated names
    console.log('\n\nTesting CloudBet name matching:\n');

    const cloudbetNames = [
      'KC Chiefs',
      'TEN Titans',
      'SF 49ers',
      'DAL Cowboys'
    ];

    const findNFLTeam = (standings, teamName) => {
      const normalized = teamName.toLowerCase().replace(/[^a-z]/g, '');

      for (const conference of standings) {
        if (!Array.isArray(conference)) continue;

        for (const team of conference) {
          if (!team || !team.team) continue;

          const apiName = team.team.name.toLowerCase().replace(/[^a-z]/g, '');
          if (apiName.includes(normalized) || normalized.includes(apiName)) {
            return {
              name: team.team.name,
              wins: team.games.win || 0,
              losses: team.games.lose || 0
            };
          }
        }
      }
      return null;
    };

    cloudbetNames.forEach(name => {
      const found = findNFLTeam(standings, name);
      if (found) {
        console.log(`✅ "${name}" → ${found.name} (${found.wins}-${found.losses})`);
      } else {
        console.log(`❌ "${name}" → NOT FOUND`);
      }
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

testTeamMatching();
