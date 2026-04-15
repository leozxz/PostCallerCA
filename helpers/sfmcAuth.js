var axios = require('axios');

var tokenCache = {};

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
        expiresAt: now + response.data.expires_in * 1000
      };
      return tokenCache.token;
    })
    .catch(function (err) {
      tokenCache = {};
      throw new Error('SFMC Auth failed: ' + (err.response && err.response.data && err.response.data.message || err.message));
    });
}

module.exports = { getAccessToken: getAccessToken };
