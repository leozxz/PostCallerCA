'use strict';

var connection = new Postmonger.Session();
var activityPayload = {};
var schemaFields = [];
var contactGroups = [];

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
  loadContactAttributes();
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

// ---- Load contact attributes ----

function loadContactAttributes() {
  fetch('/activity/contact-attributes')
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      contactGroups = data.groups || [];
      updateAllContactDropdowns();
    })
    .catch(function(err) {
      console.error('[CA] Error loading contact attributes:', err);
    });
}

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

// ---- Detect field type ----

function detectFieldType(value) {
  if (typeof value !== 'string') return 'fixed';
  if (value.indexOf('_lookup_:') === 0) return 'lookup';
  if (value.indexOf('{{Contact.') !== -1) return 'contact';
  if (value.indexOf('{{') !== -1) return 'journey';
  return 'fixed';
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
      var sel = row.querySelector('.fvalue-contact-select');
      inArgs[name] = sel ? sel.value : '';
    } else if (type === 'lookup') {
      var deInput = row.querySelector('.lookup-de');
      var deKey = deInput ? deInput.value.trim() : '';
      var keyFieldSel = row.querySelector('.lookup-key-field');
      var keyField = keyFieldSel ? keyFieldSel.value : '';
      var keyValueSel = row.querySelector('.lookup-key-value');
      var keyValue = keyValueSel ? keyValueSel.value : '';
      var returnFieldSel = row.querySelector('.lookup-return');
      var returnField = returnFieldSel ? returnFieldSel.value : '';
      inArgs[name] = '_lookup_:' + deKey + ':' + keyField + ':' + keyValue + ':' + returnField;
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

// ---- UI builders ----

function buildJourneySelect(selectedValue) {
  var html = '<select class="fvalue-select">';
  html += '<option value="">-- Selecione --</option>';
  for (var i = 0; i < schemaFields.length; i++) {
    var f = schemaFields[i];
    var sel = (selectedValue && selectedValue === f.key) ? ' selected' : '';
    html += '<option value="' + escapeAttr(f.key) + '"' + sel + '>' + escapeAttr(f.label) + '</option>';
  }
  html += '</select>';
  return html;
}

function buildContactSelect(selectedValue) {
  var html = '<select class="fvalue-contact-select">';
  html += '<option value="">-- Selecione --</option>';
  for (var g = 0; g < contactGroups.length; g++) {
    var group = contactGroups[g];
    html += '<optgroup label="' + escapeAttr(group.name) + '">';
    for (var f = 0; f < group.fields.length; f++) {
      var field = group.fields[f];
      var sel = (selectedValue && selectedValue === field.key) ? ' selected' : '';
      html += '<option value="' + escapeAttr(field.key) + '"' + sel + '>' + escapeAttr(field.label) + '</option>';
    }
    html += '</optgroup>';
  }
  html += '</select>';
  return html;
}

function buildLookupFields(value) {
  // Parse: _lookup_:DEName:keyField:keyValue:returnField
  var deName = '', keyField = '', keyValue = '', returnField = '';
  if (value && value.indexOf('_lookup_:') === 0) {
    var parts = value.split(':');
    deName = parts[1] || '';
    keyField = parts[2] || '';
    keyValue = parts[3] || '';
    returnField = parts[4] || '';
  }

  var html = '<div class="lookup-container">' +
    '<input type="text" class="lookup-de" placeholder="External Key da DE" value="' + escapeAttr(deName) + '">' +
    '<button type="button" class="btn-lookup-load" onclick="onLookupDeLoad(this)">Carregar campos</button>' +
    '<select class="lookup-key-field"><option value="">-- Campo chave --</option></select>' +
    buildJourneySelectForLookup(keyValue) +
    '<select class="lookup-return"><option value="">-- Campo retorno --</option></select>' +
    '</div>';

  // If restoring, schedule field loading after DOM insert
  if (deName) {
    setTimeout(function () {
      var containers = document.querySelectorAll('.lookup-container');
      var container = containers[containers.length - 1];
      if (container) {
        loadDeFields(container, deName, keyField, returnField);
      }
    }, 100);
  }

  return html;
}

function onLookupDeLoad(btn) {
  var container = btn.closest('.lookup-container');
  var deKey = container.querySelector('.lookup-de').value.trim();
  if (!deKey) return;
  loadDeFields(container, deKey, '', '');
}

function loadDeFields(container, deKey, selectedKeyField, selectedReturnField) {
  var keySelect = container.querySelector('.lookup-key-field');
  var returnSelect = container.querySelector('.lookup-return');

  keySelect.innerHTML = '<option value="">Carregando...</option>';
  returnSelect.innerHTML = '<option value="">Carregando...</option>';

  fetch('/activity/de-fields?key=' + encodeURIComponent(deKey))
    .then(function (resp) { return resp.json(); })
    .then(function (data) {
      var fields = data.fields || [];
      if (fields.length === 0) {
        keySelect.innerHTML = '<option value="">Nenhum campo encontrado</option>';
        returnSelect.innerHTML = '<option value="">Nenhum campo encontrado</option>';
        return;
      }

      var keyHtml = '<option value="">-- Campo chave --</option>';
      var retHtml = '<option value="">-- Campo retorno --</option>';
      for (var i = 0; i < fields.length; i++) {
        var f = fields[i];
        var selKey = (selectedKeyField && selectedKeyField === f) ? ' selected' : '';
        var selRet = (selectedReturnField && selectedReturnField === f) ? ' selected' : '';
        keyHtml += '<option value="' + escapeAttr(f) + '"' + selKey + '>' + escapeAttr(f) + '</option>';
        retHtml += '<option value="' + escapeAttr(f) + '"' + selRet + '>' + escapeAttr(f) + '</option>';
      }
      keySelect.innerHTML = keyHtml;
      returnSelect.innerHTML = retHtml;
    })
    .catch(function (err) {
      console.error('[CA] Error loading DE fields:', err);
      keySelect.innerHTML = '<option value="">Erro ao carregar</option>';
      returnSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    });
}

function buildJourneySelectForLookup(selectedValue) {
  var html = '<select class="lookup-key-value">';
  html += '<option value="">-- Valor chave (jornada) --</option>';
  for (var i = 0; i < schemaFields.length; i++) {
    var f = schemaFields[i];
    var sel = (selectedValue && selectedValue === f.key) ? ' selected' : '';
    html += '<option value="' + escapeAttr(f.key) + '"' + sel + '>' + escapeAttr(f.label) + '</option>';
  }
  html += '</select>';
  return html;
}

function buildValueElement(type, value) {
  if (type === 'journey') return buildJourneySelect(value);
  if (type === 'contact') return buildContactSelect(value);
  if (type === 'lookup') return buildLookupFields(value);
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
      '<option value="lookup"' + (type === 'lookup' ? ' selected' : '') + '>Lookup DE</option>' +
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
  // Remove all value elements
  var toRemove = row.querySelectorAll('.fvalue, .fvalue-select, .fvalue-contact-select, .lookup-container');
  toRemove.forEach(function(el) { el.remove(); });

  var removeBtn = row.querySelector('.btn-remove');
  var wrapper = document.createElement('span');
  wrapper.innerHTML = buildValueElement(select.value, '');
  row.insertBefore(wrapper.firstChild, removeBtn);
}

function updateAllJourneyDropdowns() {
  document.querySelectorAll('.fvalue-select').forEach(function(sel) {
    var val = sel.value;
    var wrapper = document.createElement('span');
    wrapper.innerHTML = buildJourneySelect(val);
    sel.parentNode.replaceChild(wrapper.firstChild, sel);
  });
  // Also update lookup key value dropdowns
  document.querySelectorAll('.lookup-key-value').forEach(function(sel) {
    var val = sel.value;
    var wrapper = document.createElement('span');
    wrapper.innerHTML = buildJourneySelectForLookup(val);
    sel.parentNode.replaceChild(wrapper.firstChild, sel);
  });
}

function updateAllContactDropdowns() {
  document.querySelectorAll('.fvalue-contact-select').forEach(function(sel) {
    var val = sel.value;
    var wrapper = document.createElement('span');
    wrapper.innerHTML = buildContactSelect(val);
    sel.parentNode.replaceChild(wrapper.firstChild, sel);
  });
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
