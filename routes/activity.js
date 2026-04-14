const express = require('express');
const axios = require('axios');
const router = express.Router();

// POST /activity/save — called when the user saves the activity config
router.post('/save', (req, res) => {
  console.log('[SAVE]', JSON.stringify(req.body));
  res.status(200).json({ success: true });
});

// POST /activity/publish — called when the journey is published
router.post('/publish', (req, res) => {
  console.log('[PUBLISH]', JSON.stringify(req.body));
  res.status(200).json({ success: true });
});

// POST /activity/validate — called to validate configuration
router.post('/validate', (req, res) => {
  console.log('[VALIDATE]', JSON.stringify(req.body));
  res.status(200).json({ success: true });
});

// POST /activity/stop — called when the journey is stopped
router.post('/stop', (req, res) => {
  console.log('[STOP]', JSON.stringify(req.body));
  res.status(200).json({ success: true });
});

// POST /activity/execute — called when a contact reaches the activity
router.post('/execute', async (req, res) => {
  console.log('[EXECUTE] Incoming:', JSON.stringify(req.body));

  try {
    const { inArguments } = req.body;
    if (!inArguments || !inArguments.length) {
      console.error('[EXECUTE] No inArguments found');
      return res.status(200).json({ success: false, error: 'No inArguments' });
    }

    // inArguments[0] contains all the configured data
    const args = inArguments[0];
    const targetUrl = args._targetUrl;
    const method = (args._httpMethod || 'POST').toUpperCase();
    const headers = {};

    // Extract custom headers (keys starting with _header_)
    // Extract payload fields (everything else except internal _ fields)
    const payload = {};
    for (const [key, value] of Object.entries(args)) {
      if (key.startsWith('_header_')) {
        const headerName = key.replace('_header_', '');
        headers[headerName] = value;
      } else if (!key.startsWith('_')) {
        payload[key] = value;
      }
    }

    if (!targetUrl) {
      console.error('[EXECUTE] No target URL configured');
      return res.status(200).json({ success: false, error: 'No target URL' });
    }

    console.log(`[EXECUTE] ${method} ${targetUrl}`, JSON.stringify(payload));

    const response = await axios({
      method,
      url: targetUrl,
      data: payload,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
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
