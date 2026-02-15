require('dotenv').config();
const FundamentalAnalysisPredictor = require('./src/services/fundamentalAnalysisPredictor');
const axios = require('axios');

const predictor = new FundamentalAnalysisPredictor();

// These are the team names Cloudbet uses (from production_bets.json and aggregator output)
const cloudbetNBATeams = [
  'LA Lakers', 'SA Spurs', 'GS Warriors', 'LA Clippers',
  'NY Knicks', 'OKC Thunder', 'NO Pelicans', 'CLE Cavaliers',
  'MIN Timberwolves', 'DEN Nuggets', 'BOS Celtics', 'MIL Bucks',
  'PHI 76ers', 'MIA Heat', 'ATL Hawks', 'CHI Bulls',
  'BKN Nets', 'TOR Raptors', 'IND Pacers', 'CHA Hornets',
  'WAS Wizards', 'ORL Magic', 'DET Pistons', 'SAC Kings',
  'PHX Suns', 'HOU Rockets', 'MEM Grizzlies', 'DAL Mavericks',
  'POR Trail Blazers', 'UTAH Jazz'
];

const cloudbetNFLTeams = [
  'CAR Panthers', 'LA Rams', 'KC Chiefs', 'SF 49ers',
  'PHI Eagles', 'DAL Cowboys', 'NYG Giants', 'NYJ Jets',
  'NE Patriots', 'BUF Bills', 'MIA Dolphins', 'BAL Ravens',
  'CIN Bengals', 'CLE Browns', 'PIT Steelers', 'HOU Texans',
  'IND Colts', 'JAX Jaguars', 'TEN Titans', 'DEN Broncos',
  'LV Raiders', 'LAC Chargers', 'SEA Seahawks', 'ARI Cardinals',
  'GB Packers', 'CHI Bears', 'MIN Vikings', 'DET Lions',
  'ATL Falcons', 'NO Saints', 'TB Buccaneers', 'WAS Commanders'
];

const cloudbetSoccerGames = [
  // Bundesliga
  { home: 'Stuttgart', away: 'Eintracht Frankfurt', league: 'Bundesliga' },
  { home: 'Borussia Dortmund', away: 'Werder Bremen', league: 'Bundesliga' },
  { home: 'Bayern Munich', away: 'RB Leipzig', league: 'Bundesliga' },
  { home: 'Bayer Leverkusen', away: 'Wolfsburg', league: 'Bundesliga' },
  { home: 'TSG Hoffenheim', away: 'FC Augsburg', league: 'Bundesliga' },
  // Premier League
  { home: 'Manchester United', away: 'Manchester City', league: 'Premier League' },
  { home: 'Chelsea', away: 'Brentford', league: 'Premier League' },
  { home: 'Liverpool', away: 'Burnley', league: 'Premier League' },
  { home: 'Arsenal', away: 'Tottenham Hotspur', league: 'Premier League' },
  { home: 'Newcastle United', away: 'Aston Villa', league: 'Premier League' },
  // Ligue 1
  { home: 'Paris Saint Germain', away: 'Lille OSC', league: 'Ligue 1' },
  { home: 'AS Monaco', away: 'Lorient', league: 'Ligue 1' },
  { home: 'Lyon', away: 'Brest', league: 'Ligue 1' },
];

async function testNBA() {
  console.log('\n' + '='.repeat(80));
  console.log('NBA TEAM MATCHING TEST (API-Sports + ESPN)');
  console.log('='.repeat(80));

  const apiKey = process.env.API_SPORTS_KEY;
  const season = 2024;

  // Fetch API-Sports standings
  let apiSportsTeams = [];
  try {
    const res = await axios.get('https://v2.nba.api-sports.io/standings', {
      params: { league: 'standard', season },
      headers: { 'x-apisports-key': apiKey },
      timeout: 10000
    });
    if (res.data.response) {
      apiSportsTeams = res.data.response;
      console.log(`\nAPI-Sports: ${apiSportsTeams.length} teams loaded (season ${season})`);
    }
  } catch (e) {
    console.log('API-Sports failed:', e.message);
  }

  // Fetch ESPN standings
  let espnTeams = [];
  try {
    const res = await axios.get('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings', { timeout: 10000 });
    if (res.data.children) {
      res.data.children.forEach(conf => {
        if (conf.standings && conf.standings.entries) {
          conf.standings.entries.forEach(entry => {
            espnTeams.push({
              name: entry.team.displayName,
              abbrev: entry.team.abbreviation,
              wins: parseFloat(entry.stats.find(s => s.name === 'wins')?.value || 0),
              losses: parseFloat(entry.stats.find(s => s.name === 'losses')?.value || 0),
            });
          });
        }
      });
      console.log(`ESPN: ${espnTeams.length} teams loaded (current season)\n`);
    }
  } catch (e) {
    console.log('ESPN failed:', e.message);
  }

  let passed = 0, failed = 0;
  const failures = [];

  for (const cbTeam of cloudbetNBATeams) {
    // Check API-Sports match (use matchTeamName only - no greedy includes)
    const apiMatch = apiSportsTeams.find(t =>
      predictor.matchTeamName(t.team.name, cbTeam) ||
      predictor.matchTeamName(t.team.code, cbTeam)
    );

    // Check ESPN match
    const espnMatch = espnTeams.find(t =>
      predictor.matchTeamName(t.name, cbTeam) ||
      predictor.matchTeamName(t.abbrev, cbTeam)
    );

    const apiWins = apiMatch ? (apiMatch.win.total || (apiMatch.win.home + apiMatch.win.away)) : null;
    const apiLosses = apiMatch ? (apiMatch.loss.total || (apiMatch.loss.home + apiMatch.loss.away)) : null;

    if (apiMatch || espnMatch) {
      const source = apiMatch ? 'API-Sports' : 'ESPN';
      const w = apiMatch ? apiWins : espnMatch.wins;
      const l = apiMatch ? apiLosses : espnMatch.losses;
      const pct = (w / (w + l) * 100).toFixed(1);
      console.log(`  ✅ ${cbTeam.padEnd(22)} → ${(apiMatch?.team?.name || espnMatch?.name).padEnd(25)} ${w}W-${l}L (${pct}%) [${source}]`);
      passed++;
    } else {
      console.log(`  ❌ ${cbTeam.padEnd(22)} → NO MATCH FOUND`);
      failed++;
      failures.push({ team: cbTeam, sport: 'NBA' });
    }
  }

  console.log(`\nNBA: ${passed}/${cloudbetNBATeams.length} matched, ${failed} failed`);
  return failures;
}

async function testNFL() {
  console.log('\n' + '='.repeat(80));
  console.log('NFL TEAM MATCHING TEST (API-Sports)');
  console.log('='.repeat(80));

  const apiKey = process.env.API_SPORTS_KEY;
  const season = 2024;

  let apiSportsTeams = [];
  try {
    const res = await axios.get('https://v1.american-football.api-sports.io/standings', {
      params: { league: 1, season },
      headers: { 'x-apisports-key': apiKey },
      timeout: 10000
    });
    if (res.data.response) {
      apiSportsTeams = res.data.response;
      console.log(`\nAPI-Sports: ${apiSportsTeams.length} teams loaded (season ${season})\n`);
    }
  } catch (e) {
    console.log('API-Sports failed:', e.message);
  }

  let passed = 0, failed = 0;
  const failures = [];

  for (const cbTeam of cloudbetNFLTeams) {
    const match = apiSportsTeams.find(t =>
      predictor.matchTeamName(t.team.name, cbTeam) ||
      predictor.matchTeamName(t.team.code, cbTeam)
    );

    if (match) {
      const w = match.won;
      const l = match.lost;
      const pct = (w / (w + l) * 100).toFixed(1);
      console.log(`  ✅ ${cbTeam.padEnd(22)} → ${match.team.name.padEnd(28)} ${w}W-${l}L (${pct}%)`);
      passed++;
    } else {
      console.log(`  ❌ ${cbTeam.padEnd(22)} → NO MATCH FOUND`);
      failed++;
      failures.push({ team: cbTeam, sport: 'NFL' });
    }
  }

  console.log(`\nNFL: ${passed}/${cloudbetNFLTeams.length} matched, ${failed} failed`);
  return failures;
}

async function testSoccer() {
  console.log('\n' + '='.repeat(80));
  console.log('SOCCER TEAM MATCHING TEST (API-Sports)');
  console.log('='.repeat(80));

  const apiKey = process.env.API_SPORTS_KEY;
  const season = 2024;
  const failures = [];
  let passed = 0, failed = 0;

  const leagues = [
    { name: 'Bundesliga', id: 78 },
    { name: 'Premier League', id: 39 },
    { name: 'Ligue 1', id: 61 },
  ];

  for (const league of leagues) {
    console.log(`\n--- ${league.name} (ID: ${league.id}) ---`);

    let standings = [];
    try {
      const res = await axios.get('https://v3.football.api-sports.io/standings', {
        params: { league: league.id, season },
        headers: { 'x-apisports-key': apiKey },
        timeout: 10000
      });
      if (res.data.response && res.data.response.length > 0) {
        standings = res.data.response[0].league.standings[0];
        console.log(`API-Sports: ${standings.length} teams loaded\n`);
      }
    } catch (e) {
      console.log('API-Sports failed:', e.message);
    }

    const gamesForLeague = cloudbetSoccerGames.filter(g => g.league === league.name);

    for (const game of gamesForLeague) {
      for (const teamName of [game.home, game.away]) {
        const match = standings.find(t => predictor.matchTeamName(t.team.name, teamName));

        if (match) {
          const w = match.all.win;
          const d = match.all.draw;
          const l = match.all.lose;
          const pts = match.points;
          console.log(`  ✅ ${teamName.padEnd(25)} → ${match.team.name.padEnd(25)} ${w}W-${d}D-${l}L (${pts}pts)`);
          passed++;
        } else {
          console.log(`  ❌ ${teamName.padEnd(25)} → NO MATCH FOUND`);
          failed++;
          failures.push({ team: teamName, sport: 'Soccer', league: league.name });
        }
      }
    }
  }

  console.log(`\nSoccer: ${passed}/${passed + failed} matched, ${failed} failed`);
  return failures;
}

async function testNHL() {
  console.log('\n' + '='.repeat(80));
  console.log('NHL TEAM MATCHING TEST (Official NHL API)');
  console.log('='.repeat(80));

  let standings = [];
  try {
    const res = await axios.get('https://api-web.nhle.com/v1/standings/now', { timeout: 10000 });
    if (res.data && res.data.standings) {
      standings = res.data.standings;
      console.log(`\nNHL API: ${standings.length} teams loaded (current season)\n`);
    }
  } catch (e) {
    console.log('NHL API failed:', e.message);
  }

  // Common Cloudbet NHL team names
  // Note: Arizona Coyotes → Utah Hockey Club → Utah Mammoth (2024-25 rebrand)
  const cloudbetNHLTeams = [
    'NY Rangers', 'NY Islanders', 'NJ Devils', 'Carolina Hurricanes',
    'Washington Capitals', 'Pittsburgh Penguins', 'Philadelphia Flyers',
    'Columbus Blue Jackets', 'Boston Bruins', 'Toronto Maple Leafs',
    'Tampa Bay Lightning', 'Florida Panthers', 'Montreal Canadiens',
    'Detroit Red Wings', 'Ottawa Senators', 'Buffalo Sabres',
    'Winnipeg Jets', 'Dallas Stars', 'Minnesota Wild', 'Colorado Avalanche',
    'Nashville Predators', 'St Louis Blues', 'Chicago Blackhawks',
    'Utah Mammoth', 'Edmonton Oilers', 'Calgary Flames',
    'Vancouver Canucks', 'Seattle Kraken', 'LA Kings', 'SJ Sharks',
    'Vegas Golden Knights', 'Anaheim Ducks'
  ];

  let passed = 0, failed = 0;
  const failures = [];

  for (const cbTeam of cloudbetNHLTeams) {
    const match = standings.find(t => {
      const teamName = t.teamName?.default || '';
      const placePlusCommon = `${t.placeName?.default || ''} ${t.teamCommonName?.default || ''}`;
      return predictor.matchTeamName(teamName, cbTeam) ||
             predictor.matchTeamName(placePlusCommon, cbTeam);
    });

    if (match) {
      const w = match.wins;
      const l = match.losses;
      const pct = (w / (w + l) * 100).toFixed(1);
      const name = `${match.teamName?.default || match.placeName?.default}`;
      console.log(`  ✅ ${cbTeam.padEnd(25)} → ${name.padEnd(28)} ${w}W-${l}L (${pct}%)`);
      passed++;
    } else {
      console.log(`  ❌ ${cbTeam.padEnd(25)} → NO MATCH FOUND`);
      failed++;
      failures.push({ team: cbTeam, sport: 'NHL' });
    }
  }

  console.log(`\nNHL: ${passed}/${cloudbetNHLTeams.length} matched, ${failed} failed`);
  return failures;
}

(async () => {
  console.log('🏟️  COMPREHENSIVE TEAM MATCHING TEST');
  console.log('Testing all Cloudbet team names against data source APIs\n');

  const nbaFailures = await testNBA();
  const nflFailures = await testNFL();
  const soccerFailures = await testSoccer();
  const nhlFailures = await testNHL();

  const allFailures = [...nbaFailures, ...nflFailures, ...soccerFailures, ...nhlFailures];

  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL SUMMARY');
  console.log('='.repeat(80));

  if (allFailures.length === 0) {
    console.log('\n✅ ALL TEAMS MATCHED SUCCESSFULLY! No gaps in data.\n');
  } else {
    console.log(`\n❌ ${allFailures.length} TEAM MATCHING FAILURES:\n`);
    allFailures.forEach(f => {
      console.log(`  ${f.sport}${f.league ? ' (' + f.league + ')' : ''}: "${f.team}"`);
    });
    console.log('\nThese teams will NOT get win-loss data and predictions will be blocked.');
  }
})();
