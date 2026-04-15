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

// ---- Detect field type from saved value ----

function detectFieldType(value) {
  if (typeof value !== 'string' || value.indexOf('{{') === -1) return 'fixed';
  if (value.indexOf('{{Contact.') !== -1) return 'contact';
  return 'journey';
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
      var type = detectFieldType(value);
      addField(key, type, value);
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
    } else if (type === 'contact') {
      var input = row.querySelector('.fvalue-contact');
      var val = input ? input.value.trim() : '';
      // Wrap in {{ }} if user didn't
      if (val && val.indexOf('{{') === -1) {
        val = '{{Contact.Attribute.' + val + '}}';
      }
      inArgs[name] = val;
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

function buildContactInput(value) {
  // Strip {{ }} wrapper for display
  var displayVal = value || '';
  if (displayVal.indexOf('{{Contact.Attribute.') === 0) {
    displayVal = displayVal.replace('{{Contact.Attribute.', '').replace('}}', '');
  } else if (displayVal.indexOf('{{Contact.') === 0) {
    displayVal = displayVal.replace('{{', '').replace('}}', '');
  }
  return '<input type="text" class="fvalue-contact" placeholder="NomeDaDE.Campo" value="' + escapeAttr(displayVal) + '">';
}

function buildValueElement(type, value) {
  if (type === 'journey') return buildJourneySelect(value);
  if (type === 'contact') return buildContactInput(value);
  return '<input type="text" class="fvalue" placeholder="valor fixo" value="' + escapeAttr(value || '') + '">';
}

function addField(name, type, value) {
  var container = document.getElementById('fields-container');
  var row = document.createElement('div');
  row.className = 'field-row';

  row.innerHTML =
    '<input type="text" class="fname" placeholder="nome_campo" value="' + escapeAttr(name || '') + '">' +
    '<select class="ftype" onchange="onTypeChange(this)">' +
      '<option value="fixed"' + (type === 'fixed' || !type ? ' selected' : '') + '>Valor Fixo</option>' +
      '<option value="journey"' + (type === 'journey' ? ' selected' : '') + '>Dado da Jornada</option>' +
      '<option value="contact"' + (type === 'contact' ? ' selected' : '') + '>Dado do Contato</option>' +
    '</select>' +
    buildValueElement(type, value) +
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
  var oldContact = row.querySelector('.fvalue-contact');
  if (oldInput) oldInput.remove();
  if (oldSelect) oldSelect.remove();
  if (oldContact) oldContact.remove();

  var removeBtn = row.querySelector('.btn-remove');
  var wrapper = document.createElement('span');
  wrapper.innerHTML = buildValueElement(select.value, '');
  row.insertBefore(wrapper.firstChild, removeBtn);
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
