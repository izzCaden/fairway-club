const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load data from file
function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { players: [] };
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { players: [] }; }
}

// Save data to file
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all players
app.get('/api/players', (req, res) => {
  res.json(loadData().players);
});

// POST add player
app.post('/api/players', (req, res) => {
  const { name, hcp, password } = req.body;
  if (!name || hcp === undefined || !password)
    return res.status(400).json({ error: 'Name, handicap, and password required.' });
  const data = loadData();
  if (data.players.find(p => p.name.toLowerCase() === name.toLowerCase()))
    return res.status(409).json({ error: 'A player with that name already exists.' });
  const player = {
    id: Date.now().toString(),
    name: name.trim(),
    hcp: parseFloat(hcp),
    password, // plaintext for simplicity — fine for a friends site
    rounds: [],
    joined: new Date().toISOString()
  };
  data.players.push(player);
  saveData(data);
  const { password: _, ...safe } = player;
  res.json(safe);
});

// POST login (just returns player without password)
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const data = loadData();
  const player = data.players.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (!player || player.password !== password)
    return res.status(401).json({ error: 'Incorrect name or password.' });
  const { password: _, ...safe } = player;
  res.json(safe);
});

// PATCH update handicap
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

// POST add round
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

// DELETE round
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

app.listen(PORT, () => console.log(`Fairway Club running on port ${PORT}`));
