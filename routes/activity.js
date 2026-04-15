var express = require('express');
var axios = require('axios');
var router = express.Router();

// POST /activity/save -- echo body (200 required by JB)
router.post('/save', function (req, res) {
  console.log('[SAVE]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/validate -- echo body (200 required by JB)
router.post('/validate', function (req, res) {
  console.log('[VALIDATE]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/publish -- echo body (200 required by JB)
router.post('/publish', function (req, res) {
  console.log('[PUBLISH]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/stop -- echo body (200 required by JB)
router.post('/stop', function (req, res) {
  console.log('[STOP]', JSON.stringify(req.body));
  res.status(200).json(req.body);
});

// POST /activity/execute -- called when a contact reaches the activity
router.post('/execute', function (req, res) {
  console.log('[EXECUTE] Incoming:', JSON.stringify(req.body));

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
    if (key.indexOf('_header_') === 0) {
      headers[key.replace('_header_', '')] = args[key];
    } else if (key.indexOf('_') !== 0) {
      payload[key] = args[key];
    }
  }

  if (!targetUrl) {
    console.error('[EXECUTE] No target URL configured');
    return res.status(200).json({ success: false, error: 'No target URL' });
  }

  console.log('[EXECUTE] ' + method + ' ' + targetUrl, JSON.stringify(payload));

  axios({
    method: method,
    url: targetUrl,
    data: payload,
    headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    timeout: 10000
  })
    .then(function (response) {
      console.log('[EXECUTE] Response:', response.status, JSON.stringify(response.data));
      res.status(200).json({ success: true });
    })
    .catch(function (err) {
      console.error('[EXECUTE] Error:', err.message);
      res.status(200).json({ success: false, error: err.message });
    });
});

module.exports = router;
