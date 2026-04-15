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
    var validSets = [];
    sets.forEach(function (set) {
      var setName = (set.name && set.name.value) ? set.name.value : (set.name || '');
      var setKey = set.key || '';
      if (setName && setKey && !set.isHidden) {
        validSets.push({ key: setKey, name: setName });
      }
    });

    // Fetch value definitions for each set
    var groups = [];
    var setsToFetch = validSets.slice(0, 50);
    var fetchResults = await Promise.all(setsToFetch.map(function (set) {
      return axios.get(
        apiBase + '/contacts/v1/attributeSetDefinitions/key:' + set.key,
        { headers: { Authorization: 'Bearer ' + token } }
      )
        .then(function (resp) {
          var setData = resp.data.item || resp.data;
          var attrs = setData.valueDefinitions || [];
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

// GET /activity/de-list -- list available Data Extensions
router.get('/de-list', async function (req, res) {
  if (!process.env.SFMC_CLIENT_ID) {
    return res.json({ items: [] });
  }

  try {
    var apiBase = process.env.SFMC_API_BASE.replace(/\/+$/, '');
    var token = await sfmcAuth.getAccessToken();

    var resp = await axios.get(
      apiBase + '/data/v1/customobjectdata',
      { headers: { Authorization: 'Bearer ' + token } }
    );
    console.log('[DE-LIST] response keys:', Object.keys(resp.data));

    var items = resp.data.items || [];
    var deList = [];
    for (var i = 0; i < items.length; i++) {
      var de = items[i];
      deList.push({
        key: de.key || de.customerKey || de.externalKey || '',
        name: de.name || ''
      });
    }

    console.log('[DE-LIST] Found ' + deList.length + ' DEs');
    res.json({ items: deList });
  } catch (err) {
    console.error('[DE-LIST] Error:', err.response ? err.response.status + ' ' + JSON.stringify(err.response.data).substring(0, 300) : err.message);
    res.json({ items: [], error: err.message });
  }
});

// GET /activity/de-fields -- fetch fields of a Data Extension by key or name
router.get('/de-fields', async function (req, res) {
  var deKey = req.query.key;
  if (!deKey || !process.env.SFMC_CLIENT_ID) {
    return res.json({ fields: [] });
  }

  try {
    var apiBase = process.env.SFMC_API_BASE.replace(/\/+$/, '');
    var token = await sfmcAuth.getAccessToken();
    var fields = [];

    // Try multiple endpoints to get DE fields
    var endpoints = [
      { name: 'dataevents', url: apiBase + '/hub/v1/dataevents/key:' + encodeURIComponent(deKey) },
      { name: 'customobjectdata', url: apiBase + '/data/v1/customobjectdata/key/' + encodeURIComponent(deKey) }
    ];

    for (var i = 0; i < endpoints.length; i++) {
      if (fields.length > 0) break;
      try {
        var resp = await axios.get(endpoints[i].url, { headers: { Authorization: 'Bearer ' + token } });
        console.log('[DE-FIELDS] ' + endpoints[i].name + ' response:', JSON.stringify(resp.data).substring(0, 800));

        // Try to extract fields from various response formats
        var dataFields = resp.data.dataFields || resp.data.fields || resp.data.columns || [];
        for (var j = 0; j < dataFields.length; j++) {
          var fname = dataFields[j].name || dataFields[j].Name || '';
          if (fname) fields.push(fname);
        }
      } catch (e) {
        console.log('[DE-FIELDS] ' + endpoints[i].name + ' failed:', e.response ? e.response.status + ' ' + JSON.stringify(e.response.data).substring(0, 200) : e.message);
      }
    }

    // Fallback: read a row and extract field names
    if (fields.length === 0) {
      try {
        var rowResp = await axios.get(
          apiBase + '/data/v1/customobjectdata/key/' + encodeURIComponent(deKey) + '/rowset?$page=1&$pageSize=1',
          { headers: { Authorization: 'Bearer ' + token } }
        );
        console.log('[DE-FIELDS] rowset response:', JSON.stringify(rowResp.data).substring(0, 500));
        var items = rowResp.data.items || [];
        if (items.length > 0) {
          var row = items[0];
          if (row.keys) Object.keys(row.keys).forEach(function (f) { fields.push(f); });
          if (row.values) Object.keys(row.values).forEach(function (f) { fields.push(f); });
        }
      } catch (e2) {
        console.log('[DE-FIELDS] rowset failed:', e2.response ? e2.response.status : e2.message);
      }
    }

    console.log('[DE-FIELDS] DE=' + deKey + ' fields=' + fields.join(', '));
    res.json({ fields: fields });
  } catch (err) {
    console.error('[DE-FIELDS] Error:', err.message);
    res.json({ fields: [], error: err.message });
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

// Helper: resolve DE lookups in payload
async function resolveLookups(payload, token) {
  var apiBase = (process.env.SFMC_API_BASE || '').replace(/\/+$/, '');
  if (!apiBase || !token) return payload;

  var resolved = {};
  var lookupPromises = [];

  for (var key in payload) {
    var val = payload[key];
    // Lookup format: _lookup_:DEName:keyField:keyValue:returnField
    if (typeof val === 'string' && val.indexOf('_lookup_:') === 0) {
      var parts = val.split(':');
      // parts[0]=_lookup_, parts[1]=DE, parts[2]=keyField, parts[last]=returnField
      // keyValue is everything between keyField and returnField (may contain colons)
      if (parts.length >= 5) {
        (function (fieldName, deName, keyField, keyValue, returnField) {
          var url = apiBase + '/data/v1/customobjectdata/key/' + encodeURIComponent(deName)
            + '/rows/' + encodeURIComponent(keyField) + '/' + encodeURIComponent(keyValue);
          console.log('[LOOKUP] GET ' + url);
          lookupPromises.push(
            axios.get(url, { headers: { Authorization: 'Bearer ' + token } })
              .then(function (resp) {
                // Response can be a single row object or an array
                var row = Array.isArray(resp.data.items) ? resp.data.items[0] : resp.data;
                var val = '';
                if (row) {
                  // Check both keys and values objects for the return field
                  if (row.values && row.values[returnField] !== undefined) {
                    val = row.values[returnField];
                  } else if (row.keys && row.keys[returnField] !== undefined) {
                    val = row.keys[returnField];
                  }
                }
                resolved[fieldName] = val;
                console.log('[LOOKUP] ' + deName + '.' + returnField + ' = ' + val);
              })
              .catch(function (err) {
                console.error('[LOOKUP] Error for ' + deName + ':', err.response ? JSON.stringify(err.response.data) : err.message);
                resolved[fieldName] = '';
              })
          );
        })(key, parts[1], parts[2], parts.slice(3, parts.length - 1).join(':'), parts[parts.length - 1]);
      }
    } else {
      resolved[key] = val;
    }
  }

  if (lookupPromises.length > 0) {
    await Promise.all(lookupPromises);
  }
  return resolved;
}

// POST /activity/execute -- called when a contact reaches the activity
router.post('/execute', async function (req, res) {
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

    // Resolve any DE lookups
    var token = null;
    var hasLookups = Object.values(payload).some(function (v) {
      return typeof v === 'string' && v.indexOf('_lookup_:') === 0;
    });
    if (hasLookups && process.env.SFMC_CLIENT_ID) {
      token = await sfmcAuth.getAccessToken();
      payload = await resolveLookups(payload, token);
    }

    console.log('[EXECUTE] ' + method + ' ' + targetUrl, JSON.stringify(payload));

    var response = await axios({
      method: method,
      url: targetUrl,
      data: payload,
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
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
