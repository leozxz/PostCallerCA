'use strict';

var connection = new Postmonger.Session();
var activityPayload = {};
var schema = {};

// ---- Journey Builder lifecycle events ----

connection.on('initActivity', function(payload) {
  activityPayload = payload || {};
  console.log('[CA] initActivity', JSON.stringify(activityPayload));

  var args = activityPayload.arguments &&
             activityPayload.arguments.execute &&
             activityPayload.arguments.execute.inArguments;

  if (args && args.length > 0) {
    restoreConfig(args[0]);
  }
});

connection.on('requestedSchema', function(data) {
  schema = data;
  console.log('[CA] schema', JSON.stringify(schema));
});

connection.on('clickedNext', function() {
  saveConfig();
  connection.trigger('nextStep');
});

connection.on('clickedBack', function() {
  connection.trigger('prevStep');
});

connection.on('gotoStep', function(step) {
  // single step wizard
});

// ---- Restore saved config into UI ----

function restoreConfig(args) {
  if (args._targetUrl) {
    document.getElementById('targetUrl').value = args._targetUrl;
  }
  if (args._httpMethod) {
    document.getElementById('httpMethod').value = args._httpMethod;
  }

  // Restore headers
  for (var key in args) {
    if (key.startsWith('_header_')) {
      var headerName = key.replace('_header_', '');
      addHeader(headerName, args[key]);
    }
  }

  // Restore body fields
  for (var key in args) {
    if (!key.startsWith('_')) {
      var value = args[key];
      // Check if it's a journey data binding (contains {{)
      var isJourney = typeof value === 'string' && value.indexOf('{{') !== -1;
      addField(key, isJourney ? 'journey' : 'fixed', value);
    }
  }
}

// ---- Save config from UI into payload ----

function saveConfig() {
  var targetUrl = document.getElementById('targetUrl').value.trim();
  var httpMethod = document.getElementById('httpMethod').value;

  var inArgs = {
    _targetUrl: targetUrl,
    _httpMethod: httpMethod
  };

  // Collect headers
  var headerRows = document.querySelectorAll('#headers-container .field-row');
  headerRows.forEach(function(row) {
    var hName = row.querySelector('.hname').value.trim();
    var hValue = row.querySelector('.hvalue').value.trim();
    if (hName) {
      inArgs['_header_' + hName] = hValue;
    }
  });

  // Collect body fields
  var fieldRows = document.querySelectorAll('#fields-container .field-row');
  fieldRows.forEach(function(row) {
    var name = row.querySelector('.fname').value.trim();
    var type = row.querySelector('.ftype').value;
    var value = row.querySelector('.fvalue').value.trim();

    if (!name) return;

    if (type === 'journey') {
      // Journey data: use the selected data binding
      inArgs[name] = value;
    } else {
      // Fixed value
      inArgs[name] = value;
    }
  });

  activityPayload.arguments = activityPayload.arguments || {};
  activityPayload.arguments.execute = activityPayload.arguments.execute || {};
  activityPayload.arguments.execute.inArguments = [inArgs];

  activityPayload.metaData = activityPayload.metaData || {};
  activityPayload.metaData.isConfigured = !!(targetUrl);

  console.log('[CA] saveConfig', JSON.stringify(activityPayload));
  connection.trigger('updateActivity', activityPayload);
}

// ---- Dynamic field management ----

function addField(name, type, value) {
  var container = document.getElementById('fields-container');
  var row = document.createElement('div');
  row.className = 'field-row';

  row.innerHTML =
    '<input type="text" class="fname" placeholder="nome_campo" value="' + escapeAttr(name || '') + '">' +
    '<select class="ftype" onchange="onTypeChange(this)">' +
      '<option value="fixed"' + (type === 'fixed' || !type ? ' selected' : '') + '>Valor Fixo</option>' +
      '<option value="journey"' + (type === 'journey' ? ' selected' : '') + '>Dado da Jornada</option>' +
    '</select>' +
    '<input type="text" class="fvalue" placeholder="' + (type === 'journey' ? '{{Contact.Attribute.NomeDe.Campo}}' : 'valor fixo') + '" value="' + escapeAttr(value || '') + '">' +
    '<button class="btn btn-remove" onclick="removeRow(this)" title="Remover">&times;</button>';

  container.appendChild(row);
}

function addHeader(name, value) {
  var container = document.getElementById('headers-container');
  var row = document.createElement('div');
  row.className = 'field-row';

  row.innerHTML =
    '<input type="text" class="hname" placeholder="Authorization" value="' + escapeAttr(name || '') + '" style="flex:1">' +
    '<input type="text" class="hvalue" placeholder="Bearer token..." value="' + escapeAttr(value || '') + '" style="flex:2">' +
    '<button class="btn btn-remove" onclick="removeRow(this)" title="Remover">&times;</button>';

  container.appendChild(row);
}

function removeRow(btn) {
  btn.parentElement.remove();
}

function onTypeChange(select) {
  var row = select.closest('.field-row');
  var input = row.querySelector('.fvalue');
  if (select.value === 'journey') {
    input.placeholder = '{{Contact.Attribute.NomeDe.Campo}}';
  } else {
    input.placeholder = 'valor fixo';
  }
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- Initialize ----

connection.on('requestedInteraction', function(settings) {
  console.log('[CA] requestedInteraction', JSON.stringify(settings));
});

// Tell Journey Builder we're ready — only once
connection.trigger('ready');
connection.trigger('requestSchema');
