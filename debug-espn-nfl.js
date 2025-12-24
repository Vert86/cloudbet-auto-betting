require('dotenv').config();
const axios = require('axios');

async function debugESPN() {
  console.log('1. Fetching teams list...\n');

  const teamsResponse = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams');
  const allTeams = teamsResponse.data.sports[0]?.leagues[0]?.teams || [];

  console.log(`Found ${allTeams.length} teams\n`);

  // Find Chiefs and Titans
  const chiefs = allTeams.find(t => t.team.displayName.includes('Chiefs'));
  const titans = allTeams.find(t => t.team.displayName.includes('Titans'));

  console.log('Chiefs team:', chiefs?.team.displayName, 'ID:', chiefs?.team.id);
  console.log('Titans team:', titans?.team.displayName, 'ID:', titans?.team.id);

  console.log('\n2. Fetching team records...\n');

  // Get Chiefs record
  const chiefsResponse = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${chiefs.team.id}`);
  const chiefsRecord = chiefsResponse.data.team.record?.items?.find(item => item.type === 'total');

  console.log('Chiefs record:', chiefsRecord?.summary);

  // Get Titans record
  const titansResponse = await axios.get(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${titans.team.id}`);
  const titansRecord = titansResponse.data.team.record?.items?.find(item => item.type === 'total');

  console.log('Titans record:', titansRecord?.summary);
}

debugESPN();
