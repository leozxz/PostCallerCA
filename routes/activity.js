const express = require('express');
const axios = require('axios');
const router = express.Router();

// POST /activity/save
router.post('/save', (req, res) => {
  console.log('[SAVE]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/validate
router.post('/validate', (req, res) => {
  console.log('[VALIDATE]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/publish
router.post('/publish', (req, res) => {
  console.log('[PUBLISH]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/stop
router.post('/stop', (req, res) => {
  console.log('[STOP]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/execute
router.post('/execute', async (req, res) => {
  console.log('[EXECUTE] Incoming:', JSON.stringify(req.body));

  try {
    var inArguments = req.body.inArguments;
    if (!inArguments || !inArguments.length) {
      console.error('[EXECUTE] No inArguments found');
      return res.status(200).json({ success: false, error: 'No inArguments' });
    }

    var args = inArguments[0];
    var targetUrl = args._targetUrl;
    var method = (args._httpMethod || 'POST').toUpperCase();
    var headers = {};
    var payload = {};

    for (var key in args) {
      if (key.startsWith('_header_')) {
        headers[key.replace('_header_', '')] = args[key];
      } else if (!key.startsWith('_')) {
        payload[key] = args[key];
      }
    }

    if (!targetUrl) {
      console.error('[EXECUTE] No target URL configured');
      return res.status(200).json({ success: false, error: 'No target URL' });
    }

    console.log('[EXECUTE] ' + method + ' ' + targetUrl, JSON.stringify(payload));

    var response = await axios({
      method: method,
      url: targetUrl,
      data: payload,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 10000
    });

    console.log('[EXECUTE] Response:', response.status, JSON.stringify(response.data));
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[EXECUTE] Error:', err.message);
    res.status(200).json({ success: false, error: err.message });
  }
});

module.exports = router;
