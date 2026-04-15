var express = require('express');
var axios = require('axios');
var router = express.Router();
var sfmcAuth = require('../helpers/sfmcAuth');

// GET /activity/contact-attributes -- fetch Contact Builder attribute groups
router.get('/contact-attributes', async function (req, res) {
  if (!process.env.SFMC_CLIENT_ID) {
    return res.json({ groups: [] });
  }

  try {
    var apiBase = process.env.SFMC_API_BASE.replace(/\/+$/, '');
    var token = await sfmcAuth.getAccessToken();

    // Fetch attribute set definitions
    var setsResp = await axios.get(
      apiBase + '/contacts/v1/attributeSetDefinitions?$pageSize=200',
      { headers: { Authorization: 'Bearer ' + token } }
    );

    var sets = setsResp.data.items || [];
    console.log('[CONTACT-ATTRS] Found ' + sets.length + ' attribute sets');

    var validSets = [];
    sets.forEach(function (set) {
      var setName = (set.name && set.name.value) ? set.name.value : (set.name || '');
      var setKey = set.key || '';
      if (setName && setKey && !set.isHidden) {
        validSets.push({ key: setKey, name: setName });
      }
    });

    console.log('[CONTACT-ATTRS] Valid sets: ' + validSets.length);

    // The initial response already contains all we need - each set has
    // valueDefinitions nested. But the list endpoint doesn't include them.
    // We need to fetch each set individually to get valueDefinitions.
    // The response wraps in "item" (singular).

    // Fetch value definitions for each set (limit to first 30 to avoid timeout)
    var groups = [];
    // Debug: fetch first set and log full structure
    if (validSets.length > 0) {
      try {
        var dbg = await axios.get(
          apiBase + '/contacts/v1/attributeSetDefinitions/key:' + validSets[0].key,
          { headers: { Authorization: 'Bearer ' + token } }
        );
        var item = dbg.data.item || dbg.data;
        console.log('[CONTACT-ATTRS] Full keys of set:', Object.keys(item));
        // Log any key that contains array
        Object.keys(item).forEach(function(k) {
          if (Array.isArray(item[k])) {
            console.log('[CONTACT-ATTRS] Array key "' + k + '" length:', item[k].length);
            if (item[k].length > 0) {
              console.log('[CONTACT-ATTRS] First item of "' + k + '":', JSON.stringify(item[k][0]).substring(0, 400));
            }
          }
        });
      } catch(e) {
        console.error('[CONTACT-ATTRS] Debug error:', e.message);
      }
    }

    var setsToFetch = validSets.slice(0, 30);
    var fetchResults = await Promise.all(setsToFetch.map(function (set) {
      return axios.get(
        apiBase + '/contacts/v1/attributeSetDefinitions/key:' + set.key,
        { headers: { Authorization: 'Bearer ' + token } }
      )
        .then(function (resp) {
          var setData = resp.data.item || resp.data;
          var attrs = setData.valueDefinitions || setData.values || setData.attributes || [];

          // Log first successful result for debugging
          if (attrs.length > 0 && groups.length === 0) {
            console.log('[CONTACT-ATTRS] Sample attr:', JSON.stringify(attrs[0]).substring(0, 300));
          }

          var fields = [];
          attrs.forEach(function (attr) {
            var attrName = (attr.name && attr.name.value) ? attr.name.value : (attr.name || '');
            var isHidden = attr.isHidden || (attr.access && attr.access === 'Hidden');
            if (attrName && !isHidden) {
              fields.push({
                key: '{{Contact.Attribute.' + set.name + '.' + attrName + '}}',
                label: attrName
              });
            }
          });
          if (fields.length > 0) {
            return { name: set.name, fields: fields };
          }
          return null;
        })
        .catch(function () { return null; });
    }));

    fetchResults.forEach(function (g) {
      if (g) groups.push(g);
    });

    console.log('[CONTACT-ATTRS] Returning ' + groups.length + ' groups');
    res.json({ groups: groups });
  } catch (err) {
    console.error('[CONTACT-ATTRS] Error:', err.message);
    res.json({ groups: [] });
  }
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
