const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

// MC may send the body as a JWT string when JWT signing is enabled.
// This helper decodes it (without verification if no secret is set).
function decodeBody(req) {
  var body = req.body;

  // If body-parser gave us an object with a token-like string, try to decode
  if (typeof body === 'string') {
    try {
      var secret = process.env.JWT_SECRET;
      if (secret) {
        return jwt.verify(body, secret);
      }
      return jwt.decode(body);
    } catch (e) {
      console.log('[JWT] decode failed, using raw body');
    }
  }

  // MC sometimes sends { toString: [Function] } or raw text
  // Check if any key looks like a JWT (3 dot-separated base64 parts)
  if (body && typeof body === 'object') {
    var keys = Object.keys(body);
    if (keys.length === 1 && keys[0].split('.').length === 3) {
      try {
        var token = keys[0];
        var secret = process.env.JWT_SECRET;
        if (secret) {
          return jwt.verify(token, secret);
        }
        return jwt.decode(token);
      } catch (e) {
        console.log('[JWT] key decode failed, using parsed body');
      }
    }
  }

  return body;
}

// POST /activity/save
router.post('/save', (req, res) => {
  var body = decodeBody(req);
  console.log('[SAVE]', JSON.stringify(body));
  res.status(200).json({ success: true });
});

// POST /activity/publish
router.post('/publish', (req, res) => {
  var body = decodeBody(req);
  console.log('[PUBLISH]', JSON.stringify(body));
  res.status(200).json({ success: true });
});

// POST /activity/validate
router.post('/validate', (req, res) => {
  var body = decodeBody(req);
  console.log('[VALIDATE]', JSON.stringify(body));
  res.status(200).json({ success: true });
});

// POST /activity/stop
router.post('/stop', (req, res) => {
  var body = decodeBody(req);
  console.log('[STOP]', JSON.stringify(body));
  res.status(200).json({ success: true });
});

// POST /activity/execute
router.post('/execute', async (req, res) => {
  var body = decodeBody(req);
  console.log('[EXECUTE] Incoming:', JSON.stringify(body));

  try {
    var inArguments = body.inArguments;
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
        var headerName = key.replace('_header_', '');
        headers[headerName] = args[key];
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
