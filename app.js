const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const activityRouter = require('./routes/activity');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve config.json dynamically so the key comes from env var
app.get('/config.json', (req, res) => {
  res.json({
    workflowApiVersion: '1.1',
    key: process.env.ACTIVITY_KEY || 'REST-ACTIVITY-POST-CALLER',
    metaData: {
      icon: 'images/icon.svg',
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
        url: '{{=activity.rootUrl}}activity/execute'
      }
    },
    configurationArguments: {
      save: { url: '{{=activity.rootUrl}}activity/save' },
      publish: { url: '{{=activity.rootUrl}}activity/publish' },
      validate: { url: '{{=activity.rootUrl}}activity/validate' },
      stop: { url: '{{=activity.rootUrl}}activity/stop' }
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

app.listen(PORT, () => {
  console.log(`CA Post running on port ${PORT}`);
});
