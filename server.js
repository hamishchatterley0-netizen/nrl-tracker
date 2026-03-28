const express = require('express');
const cors = require('cors');
 
const app = express();
app.use(cors());
 
const PORT = process.env.PORT || 3000;
const CURRENT_SEASON = 2025;
const LEAGUE_ID = 111;
 
let cachedStats = {};
let lastFetch = {};
const CACHE_TTL = 60 * 1000;
 
async function fetchFromNRL(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-AU,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Origin': 'https://www.nrl.com',
      'Referer': 'https://www.nrl.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  if (!res.ok) throw new Error(`NRL API error: ${res.status}`);
  return res.json();
}
 
function calcPerfPoints(p) {
  const metres = Math.floor((p.runMetres || p.metres || 0) / 10);
  const tackles = p.tackles || 0;
  const points = (p.pointsScored || p.points || 0) * 4;
  const tryAssists = (p.tryAssists || 0) * 10;
  return metres + tackles + points + tryAssists;
}
 
function mapPlayer(p) {
  return {
    name: p.playerName || p.name || 'Unknown',
    team: p.teamName || p.team || '',
    position: p.position || '',
    metres: p.runMetres || p.metres || 0,
    tackles: p.tackles || 0,
    points: p.pointsScored || p.points || 0,
    tryAssists: p.tryAssists || 0,
    perfPoints: calcPerfPoints(p),
  };
}
 
async function getStats(round) {
  const now = Date.now();
  const cacheKey = `round_${round}`;
 
  if (cachedStats[cacheKey] && (now - lastFetch[cacheKey]) < CACHE_TTL) {
    return cachedStats[cacheKey];
  }
 
  const url = `https://api.nrl.com/v1/leagues/${LEAGUE_ID}/seasons/${CURRENT_SEASON}/rounds/${round}/stats`;
  const data = await fetchFromNRL(url);
 
  const raw = Array.isArray(data) ? data
    : Array.isArray(data.playerStats) ? data.playerStats
    : [];
 
  const players = raw.map(mapPlayer);
  players.sort((a, b) => b.perfPoints - a.perfPoints);
 
  cachedStats[cacheKey] = players;
  lastFetch[cacheKey] = now;
  return players;
}
 
app.get('/stats', async (req, res) => {
  const round = parseInt(req.query.round) || 1;
  try {
    const players = await getStats(round);
    res.json({ round, players, updatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
app.get('/rounds', async (req, res) => {
  try {
    const url = `https://api.nrl.com/v1/leagues/${LEAGUE_ID}/seasons/${CURRENT_SEASON}/rounds`;
    const data = await fetchFromNRL(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
 
app.get('/', (req, res) => {
  res.json({ status: 'NRL Tracker API running', endpoints: ['/stats?round=1', '/rounds'] });
});
 
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
 
