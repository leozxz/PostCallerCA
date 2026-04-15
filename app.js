require('dotenv').config();
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var fs = require('fs');

var activityRoutes = require('./routes/activity');

var app = express();
var PORT = process.env.PORT || 3000;

// CORS for all requests
app.use(function (req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-sfmc-activity-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// Normalize double slashes in URL
app.use(function (req, res, next) {
  if (req.url.includes('//')) req.url = req.url.replace(/\/\/+/g, '/');
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Log all requests
app.use(function (req, res, next) {
  console.log('[' + new Date().toISOString() + '] ' + req.method + ' ' + req.url);
  next();
});

// Serve config.json dynamically with BASE_URL replacement (BEFORE static)
app.get('/config.json', function (req, res) {
  var configPath = path.join(__dirname, 'public', 'config.json');
  var raw = fs.readFileSync(configPath, 'utf8');
  var baseUrl = (process.env.BASE_URL || '').replace(/\/+$/, '');
  var config = raw.replace(/\{\{BASE_URL\}\}/g, baseUrl);
  res.type('application/json').send(config);
});

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/activity', activityRoutes);

// Health check
app.get('/health', function (req, res) {
  res.json({ status: 'ok', baseUrl: process.env.BASE_URL, timestamp: new Date().toISOString() });
});

// Catch-all
app.use(function (req, res) {
  console.log('[404] ' + req.method + ' ' + req.url);
  res.status(404).json({ error: 'Not found', path: req.url });
});

app.listen(PORT, function () {
  console.log('Custom Activity server running on port ' + PORT);
  console.log('BASE_URL: ' + process.env.BASE_URL);
});
