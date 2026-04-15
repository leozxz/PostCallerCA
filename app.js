const express = require('express');
const path = require('path');
const fs = require('fs');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-sfmc-activity-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Normalize double slashes
app.use((req, res, next) => {
  if (req.url.includes('//')) req.url = req.url.replace(/\/\/+/g, '/');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log all requests
app.use((req, res, next) => {
  console.log('[' + new Date().toISOString() + ']', req.method, req.url);
  next();
});

// Serve config.json dynamically with BASE_URL replacement (BEFORE static)
app.get('/config.json', (req, res) => {
  var configPath = path.join(__dirname, 'public', 'config.json');
  var raw = fs.readFileSync(configPath, 'utf8');
  var baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
  var config = raw.replace(/\{\{BASE_URL\}\}/g, baseUrl);
  res.type('application/json').send(config);
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Activity endpoints
app.use('/activity', activityRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', baseUrl: process.env.BASE_URL, timestamp: new Date().toISOString() });
});

// Catch-all
app.use((req, res) => {
  console.log('[404]', req.method, req.url);
  res.status(404).json({ error: 'Not found', path: req.url });
});

app.listen(PORT, () => {
  console.log('CA Post running on port ' + PORT);
  console.log('BASE_URL:', process.env.BASE_URL);
});
