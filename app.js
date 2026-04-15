const express = require('express');
const cors = require('cors');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Log ALL incoming requests
app.use((req, res, next) => {
  console.log('[REQUEST]', req.method, req.url, 'Content-Type:', req.headers['content-type']);
  next();
});

// Parse body - try JSON first, fallback to raw text for JWT
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
// Catch JSON parse errors (MC may send JWT as body with application/json content-type)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    console.log('[BODY-PARSE] JSON parse failed, reading raw body');
    req.body = err.body || '';
    next();
  } else {
    next(err);
  }
});

// Serve config.json dynamically
app.get('/config.json', (req, res) => {
  var baseUrl = process.env.BASE_URL || 'https://postcallerca-production.up.railway.app/';
  if (!baseUrl.endsWith('/')) baseUrl += '/';

  res.json({
    workflowApiVersion: '1.1',
    key: process.env.ACTIVITY_KEY || 'REST-ACTIVITY-POST-CALLER',
    metaData: {
      icon: baseUrl + 'images/icon.svg',
      category: 'message',
      isConfigured: false
    },
    type: 'REST',
    lang: {
      'en-US': {
        name: 'API POST',
        description: 'Envia dados da jornada via POST para uma API externa'
      }
    },
    arguments: {
      execute: {
        inArguments: [],
        outArguments: [],
        timeout: 30000,
        retryCount: 1,
        retryDelay: 1000,
        concurrentRequests: 5,
        url: baseUrl + 'activity/execute'
      }
    },
    configurationArguments: {
      save: { url: baseUrl + 'activity/save' },
      publish: { url: baseUrl + 'activity/publish' },
      validate: { url: baseUrl + 'activity/validate' },
      stop: { url: baseUrl + 'activity/stop' }
    },
    wizardSteps: [
      { label: 'Configurar API', key: 'step1' }
    ],
    userInterfaces: {
      configModal: { height: 600, width: 800, fullscreen: false }
    },
    schema: {
      arguments: {
        execute: { inArguments: [], outArguments: [] }
      }
    }
  });
});

// Serve frontend files
app.use(express.static('public'));

// Activity endpoints
app.use('/activity', activityRouter);

// Health check
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', req.method, req.url, err.message);
  res.status(200).json({ success: true });
});

app.listen(PORT, () => {
  console.log('CA Post running on port ' + PORT);
  console.log('BASE_URL:', process.env.BASE_URL || '(not set)');
  console.log('ACTIVITY_KEY:', process.env.ACTIVITY_KEY || '(not set)');
  console.log('JWT_SECRET:', process.env.JWT_SECRET ? '(set)' : '(not set)');
});
