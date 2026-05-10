const express = require('express');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_PATH || path.join(__dirname, 'data.json');

app.use(express.json({ limit: '20mb' })); // Increased for base64 scorecard photos
app.use(express.static(path.join(__dirname, 'public')));

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { players: [] };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { players: [] }; }
}
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/players', (req, res) => res.json(loadData().players));

app.post('/api/players', (req, res) => {
  const { name, hcp, password } = req.body;
  if (!name || hcp === undefined || !password)
    return res.status(400).json({ error: 'Name, handicap, and password required.' });
  const data = loadData();
  if (data.players.find(p => p.name.toLowerCase() === name.toLowerCase()))
    return res.status(409).json({ error: 'A player with that name already exists.' });
  const player = { id: Date.now().toString(), name: name.trim(), hcp: parseFloat(hcp), password, rounds: [], joined: new Date().toISOString() };
  data.players.push(player);
  saveData(data);
  const { password: _, ...safe } = player;
  res.json(safe);
});

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!player || player.password !== password)
    return res.status(401).json({ error: 'Incorrect name or password.' });
  const { password: _, ...safe } = player;
  res.json(safe);
});

app.patch('/api/players/:id', (req, res) => {
  const { hcp, password } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (player.password !== password) return res.status(403).json({ error: 'Wrong password.' });
  if (hcp !== undefined) player.hcp = parseFloat(hcp);
  saveData(data);
  const { password: _, ...safe } = player;
  res.json(safe);
});

app.post('/api/players/:id/rounds', (req, res) => {
  const { password, ...round } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (player.password !== password) return res.status(403).json({ error: 'Wrong password.' });
  round.id = Date.now().toString();
  round.createdAt = new Date().toISOString();
  if (!player.rounds) player.rounds = [];
  player.rounds.push(round);
  saveData(data);
  res.json(round);
});

app.delete('/api/players/:id/rounds/:rid', (req, res) => {
  const { password } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (player.password !== password) return res.status(403).json({ error: 'Wrong password.' });
  player.rounds = player.rounds.filter(r => r.id !== req.params.rid);
  saveData(data);
  res.json({ ok: true });
});

app.delete('/api/players/:id', (req, res) => {
  const { password } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found.' });
  if (player.password !== password) return res.status(403).json({ error: 'Wrong password.' });
  data.players = data.players.filter(p => p.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// Proxy for Anthropic API — keeps key secret on server side
app.post('/api/ask-pro', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server.' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Fairway Club running on port ${PORT}`));
