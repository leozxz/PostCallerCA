var axios = require('axios');

function buildEnvelope(soapUrl, token, body) {
  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" ' +
    'xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" ' +
    'xmlns:u="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">' +
    '<s:Header>' +
    '<a:Action s:mustUnderstand="1">Retrieve</a:Action>' +
    '<a:To s:mustUnderstand="1">' + soapUrl + '/Service.asmx</a:To>' +
    '<fueloauth xmlns="http://exacttarget.com">' + token + '</fueloauth>' +
    '</s:Header>' +
    '<s:Body xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">' +
    body +
    '</s:Body>' +
    '</s:Envelope>';
}

function soapRequest(soapUrl, token, body) {
  var envelope = buildEnvelope(soapUrl, token, body);
  return axios.post(soapUrl + '/Service.asmx', envelope, {
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': 'Retrieve'
    },
    timeout: 15000
  }).then(function (resp) {
    return resp.data;
  });
}

// Extract values between XML tags (simple parser, no dependency needed)
function extractAll(xml, tag) {
  var results = [];
  var openTag = '<' + tag + '>';
  var closeTag = '</' + tag + '>';
  var idx = 0;
  while (true) {
    var start = xml.indexOf(openTag, idx);
    if (start === -1) break;
    start += openTag.length;
    var end = xml.indexOf(closeTag, start);
    if (end === -1) break;
    results.push(xml.substring(start, end));
    idx = end + closeTag.length;
  }
  return results;
}

function extractFirst(xml, tag) {
  var results = extractAll(xml, tag);
  return results.length > 0 ? results[0] : '';
}

// List all Data Extensions (name + customerKey)
function listDataExtensions(soapUrl, token) {
  var body =
    '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">' +
    '<RetrieveRequest>' +
    '<ObjectType>DataExtension</ObjectType>' +
    '<Properties>Name</Properties>' +
    '<Properties>CustomerKey</Properties>' +
    '</RetrieveRequest>' +
    '</RetrieveRequestMsg>';

  return soapRequest(soapUrl, token, body).then(function (xml) {
    var results = extractAll(xml, 'Results');
    var des = [];
    for (var i = 0; i < results.length; i++) {
      var name = extractFirst(results[i], 'Name');
      var key = extractFirst(results[i], 'CustomerKey');
      if (name && key) {
        des.push({ name: name, key: key });
      }
    }
    return des;
  });
}

// Get fields of a Data Extension by CustomerKey
function getDataExtensionFields(soapUrl, token, deKey) {
  var body =
    '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">' +
    '<RetrieveRequest>' +
    '<ObjectType>DataExtensionField</ObjectType>' +
    '<Properties>Name</Properties>' +
    '<Properties>FieldType</Properties>' +
    '<Properties>IsPrimaryKey</Properties>' +
    '<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<Property>DataExtension.CustomerKey</Property>' +
    '<SimpleOperator>equals</SimpleOperator>' +
    '<Value>' + escapeXml(deKey) + '</Value>' +
    '</Filter>' +
    '</RetrieveRequest>' +
    '</RetrieveRequestMsg>';

  return soapRequest(soapUrl, token, body).then(function (xml) {
    console.log('[SOAP] getDataExtensionFields raw response:', String(xml).substring(0, 1000));
    var results = extractAll(xml, 'Results');
    console.log('[SOAP] Found ' + results.length + ' Results blocks');
    var fields = [];
    for (var i = 0; i < results.length; i++) {
      var name = extractFirst(results[i], 'Name');
      var isPK = extractFirst(results[i], 'IsPrimaryKey');
      if (name) {
        fields.push({ name: name, isPrimaryKey: isPK === 'true' });
      }
    }
    return fields;
  });
}

// Query a DE row by key field
function queryDataExtension(soapUrl, token, deName, fields, keyField, keyValue) {
  var propsXml = '';
  for (var i = 0; i < fields.length; i++) {
    propsXml += '<Properties>' + escapeXml(fields[i]) + '</Properties>';
  }

  var body =
    '<RetrieveRequestMsg xmlns="http://exacttarget.com/wsdl/partnerAPI">' +
    '<RetrieveRequest>' +
    '<ObjectType>DataExtensionObject[' + escapeXml(deName) + ']</ObjectType>' +
    propsXml +
    '<Filter xsi:type="SimpleFilterPart" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<Property>' + escapeXml(keyField) + '</Property>' +
    '<SimpleOperator>equals</SimpleOperator>' +
    '<Value>' + escapeXml(keyValue) + '</Value>' +
    '</Filter>' +
    '</RetrieveRequest>' +
    '</RetrieveRequestMsg>';

  return soapRequest(soapUrl, token, body).then(function (xml) {
    var results = extractAll(xml, 'Results');
    if (results.length === 0) return null;

    var properties = extractAll(results[0], 'Property');
    var row = {};
    for (var i = 0; i < properties.length; i++) {
      var pName = extractFirst(properties[i], 'Name');
      var pValue = extractFirst(properties[i], 'Value');
      if (pName) row[pName] = pValue;
    }
    return row;
  });
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = {
  listDataExtensions: listDataExtensions,
  getDataExtensionFields: getDataExtensionFields,
  queryDataExtension: queryDataExtension
};
