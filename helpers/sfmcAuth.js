var axios = require('axios');

var tokenCache = {};
var buTokenCache = {};

function getAccessToken() {
  var now = Date.now();

  if (tokenCache.token && now < tokenCache.expiresAt - 60000) {
    return Promise.resolve(tokenCache.token);
  }

  var body = {
    grant_type: 'client_credentials',
    client_id: process.env.SFMC_CLIENT_ID,
    client_secret: process.env.SFMC_CLIENT_SECRET
  };

  return axios.post(process.env.SFMC_AUTH_URL + '/v2/token', body)
    .then(function (response) {
      tokenCache = {
        token: response.data.access_token,
        expiresAt: now + response.data.expires_in * 1000,
        soapUrl: (response.data.soap_instance_url || '').replace(/\/+$/, '')
      };
      return tokenCache.token;
    })
    .catch(function (err) {
      tokenCache = {};
      throw new Error('SFMC Auth failed: ' + (err.response && err.response.data && err.response.data.message || err.message));
    });
}

function getAccessTokenForBU(mid) {
  if (!mid) return getAccessToken();

  var now = Date.now();
  var cached = buTokenCache[mid];

  if (cached && cached.token && now < cached.expiresAt - 60000) {
    return Promise.resolve(cached.token);
  }

  var body = {
    grant_type: 'client_credentials',
    client_id: process.env.SFMC_CLIENT_ID,
    client_secret: process.env.SFMC_CLIENT_SECRET,
    account_id: mid
  };

  return axios.post(process.env.SFMC_AUTH_URL + '/v2/token', body)
    .then(function (response) {
      buTokenCache[mid] = {
        token: response.data.access_token,
        expiresAt: now + response.data.expires_in * 1000,
        soapUrl: (response.data.soap_instance_url || '').replace(/\/+$/, '')
      };
      return buTokenCache[mid].token;
    })
    .catch(function (err) {
      delete buTokenCache[mid];
      throw new Error('SFMC Auth failed for MID ' + mid + ': ' + (err.response && err.response.data && err.response.data.message || err.message));
    });
}

function getSoapUrl(mid) {
  if (mid && buTokenCache[mid]) return buTokenCache[mid].soapUrl || '';
  return tokenCache.soapUrl || '';
}

module.exports = { getAccessToken: getAccessToken, getAccessTokenForBU: getAccessTokenForBU, getSoapUrl: getSoapUrl };
