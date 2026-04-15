'use strict';

var connection = new Postmonger.Session();
var activityPayload = {};
var schemaFields = [];

// Fire ready immediately at top level
connection.trigger('ready');

connection.on('initActivity', function(payload) {
  activityPayload = payload || {};
  console.log('[CA] initActivity', JSON.stringify(activityPayload));

  var args = activityPayload.arguments &&
             activityPayload.arguments.execute &&
             activityPayload.arguments.execute.inArguments;

  if (args && args.length > 0) {
    restoreConfig(args[0]);
  }

  connection.trigger('requestSchema');
});

connection.on('requestedSchema', function(data) {
  console.log('[CA] schema', JSON.stringify(data));
  schemaFields = parseSchema(data);
  updateAllJourneyDropdowns();
});

connection.on('clickedNext', function() {
  saveActivity();
  connection.trigger('nextStep');
});

connection.on('clickedBack', function() {
  connection.trigger('prevStep');
});

connection.on('gotoStep', function(step) {
  console.log('[CA] gotoStep', JSON.stringify(step));
});

// ---- Parse schema ----

function parseSchema(data) {
  var fields = [];
  if (!data || !data.schema) return fields;
  var items = data.schema;
  for (var i = 0; i < items.length; i++) {
    var key = items[i].key;
    var parts = key.split('.');
    fields.push({
      key: '{{' + key + '}}',
      label: parts[parts.length - 1]
    });
  }
  return fields;
}

// ---- Restore saved config ----

function restoreConfig(args) {
  if (args._targetUrl) {
    document.getElementById('targetUrl').value = args._targetUrl;
  }
  if (args._httpMethod) {
    document.getElementById('httpMethod').value = args._httpMethod;
  }

  for (var key in args) {
    if (key.startsWith('_header_')) {
      addHeader(key.replace('_header_', ''), args[key]);
    }
  }

  for (var key in args) {
    if (!key.startsWith('_')) {
      var value = args[key];
      var isJourney = typeof value === 'string' && value.indexOf('{{') !== -1;
      addField(key, isJourney ? 'journey' : 'fixed', value);
    }
  }
}

// ---- Save activity ----

function saveActivity() {
  var targetUrl = document.getElementById('targetUrl').value.trim();
  var httpMethod = document.getElementById('httpMethod').value;

  var inArgs = {
    _targetUrl: targetUrl,
    _httpMethod: httpMethod
  };

  var headerRows = document.querySelectorAll('#headers-container .field-row');
  headerRows.forEach(function(row) {
    var hName = row.querySelector('.hname').value.trim();
    var hValue = row.querySelector('.hvalue').value.trim();
    if (hName) inArgs['_header_' + hName] = hValue;
  });

  var fieldRows = document.querySelectorAll('#fields-container .field-row');
  fieldRows.forEach(function(row) {
    var name = row.querySelector('.fname').value.trim();
    var type = row.querySelector('.ftype').value;
    if (!name) return;
    if (type === 'journey') {
      var sel = row.querySelector('.fvalue-select');
      inArgs[name] = sel ? sel.value : '';
    } else {
      var input = row.querySelector('.fvalue');
      inArgs[name] = input ? input.value.trim() : '';
    }
  });

  activityPayload.arguments = activityPayload.arguments || {};
  activityPayload.arguments.execute = activityPayload.arguments.execute || {};
  activityPayload.arguments.execute.inArguments = [inArgs];

  activityPayload.metaData = activityPayload.metaData || {};
  activityPayload.metaData.isConfigured = true;

  console.log('[CA] saveActivity', JSON.stringify(activityPayload));
  connection.trigger('updateActivity', activityPayload);
}

// ---- UI helpers ----

function buildJourneySelect(selectedValue) {
  var html = '<select class="fvalue-select">';
  html += '<option value="">-- Selecione um campo --</option>';
  for (var i = 0; i < schemaFields.length; i++) {
    var f = schemaFields[i];
    var sel = (selectedValue && selectedValue === f.key) ? ' selected' : '';
    html += '<option value="' + escapeAttr(f.key) + '"' + sel + '>' + escapeAttr(f.label) + '</option>';
  }
  html += '</select>';
  return html;
}

function addField(name, type, value) {
  var container = document.getElementById('fields-container');
  var row = document.createElement('div');
  row.className = 'field-row';

  var valueHtml = (type === 'journey')
    ? buildJourneySelect(value)
    : '<input type="text" class="fvalue" placeholder="valor fixo" value="' + escapeAttr(value || '') + '">';

  row.innerHTML =
    '<input type="text" class="fname" placeholder="nome_campo" value="' + escapeAttr(name || '') + '">' +
    '<select class="ftype" onchange="onTypeChange(this)">' +
      '<option value="fixed"' + (type === 'fixed' || !type ? ' selected' : '') + '>Valor Fixo</option>' +
      '<option value="journey"' + (type === 'journey' ? ' selected' : '') + '>Dado da Jornada</option>' +
    '</select>' +
    valueHtml +
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

function removeRow(btn) { btn.parentElement.remove(); }

function onTypeChange(select) {
  var row = select.closest('.field-row');
  var oldInput = row.querySelector('.fvalue');
  var oldSelect = row.querySelector('.fvalue-select');
  if (oldInput) oldInput.remove();
  if (oldSelect) oldSelect.remove();

  var removeBtn = row.querySelector('.btn-remove');
  if (select.value === 'journey') {
    var wrapper = document.createElement('span');
    wrapper.innerHTML = buildJourneySelect('');
    row.insertBefore(wrapper.firstChild, removeBtn);
  } else {
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'fvalue';
    input.placeholder = 'valor fixo';
    row.insertBefore(input, removeBtn);
  }
}

function updateAllJourneyDropdowns() {
  var selects = document.querySelectorAll('.fvalue-select');
  selects.forEach(function(sel) {
    var currentVal = sel.value;
    var wrapper = document.createElement('span');
    wrapper.innerHTML = buildJourneySelect(currentVal);
    sel.parentNode.replaceChild(wrapper.firstChild, sel);
  });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
