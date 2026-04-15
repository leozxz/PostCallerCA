var express = require('express');
var axios = require('axios');
var router = express.Router();
var sfmcAuth = require('../helpers/sfmcAuth');

// GET /activity/contact-attributes -- fetch Contact Builder attribute groups
router.get('/contact-attributes', function (req, res) {
  if (!process.env.SFMC_CLIENT_ID) {
    console.log('[CONTACT-ATTRS] No SFMC_CLIENT_ID configured');
    return res.json({ groups: [] });
  }

  console.log('[CONTACT-ATTRS] Fetching token...');
  console.log('[CONTACT-ATTRS] AUTH_URL:', process.env.SFMC_AUTH_URL);
  console.log('[CONTACT-ATTRS] API_BASE:', process.env.SFMC_API_BASE);

  sfmcAuth.getAccessToken()
    .then(function (token) {
      console.log('[CONTACT-ATTRS] Got token, fetching attribute sets...');
      var url = process.env.SFMC_API_BASE.replace(/\/+$/, '') + '/contacts/v1/attributeSetDefinitions';
      console.log('[CONTACT-ATTRS] URL:', url);
      return axios.get(url, { headers: { Authorization: 'Bearer ' + token } });
    })
    .then(function (response) {
      console.log('[CONTACT-ATTRS] Response keys:', Object.keys(response.data));
      console.log('[CONTACT-ATTRS] Raw response (first 500 chars):', JSON.stringify(response.data).substring(0, 500));

      var sets = response.data.setDefinitions || response.data.items || [];
      console.log('[CONTACT-ATTRS] Found ' + sets.length + ' attribute sets');

      var groups = [];

      sets.forEach(function (set) {
        var groupName = set.name;
        var attrs = set.valueDefinitions || set.values || [];

        var fields = [];

        attrs.forEach(function (attr) {
          if (attr.name && !attr.isHidden) {
            fields.push({
              key: '{{Contact.Attribute.' + groupName + '.' + attr.name + '}}',
              label: attr.name,
              type: attr.dataType || 'Text'
            });
          }
        });

        if (fields.length > 0) {
          groups.push({ name: groupName, fields: fields });
        }
      });

      console.log('[CONTACT-ATTRS] Returning ' + groups.length + ' groups');
      res.json({ groups: groups });
    })
    .catch(function (err) {
      console.error('[CONTACT-ATTRS] Error:', err.message);
      if (err.response) {
        console.error('[CONTACT-ATTRS] Status:', err.response.status);
        console.error('[CONTACT-ATTRS] Data:', JSON.stringify(err.response.data).substring(0, 300));
      }
      res.json({ groups: [] });
    });
});

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
