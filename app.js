
 // https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow


var express = require('express'); 
var request = require('request'); 
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const port = process.env.PORT || 8888;

var client_id = 'fa67147631b041d3b88160eebc396031'; // spotify client id
var client_secret = '30eda4f123d34a09a13bc9c7dc2c63e5'; // spotify secret
var redirect_uri = 'http://localhost:8888/callback'; // spotify redirect uri

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function (length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-library-read'; // Add necessary scopes here
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token,
          timeout = body.expires_in;

        // Make a request to the Spotify API to get the user's saved tracks
        var options = {
          url: 'https://api.spotify.com/v1/me/tracks',
          headers: {
            'Authorization': 'Bearer ' + access_token
          },
          json: true
        };

        request.get(options, function (error, response, body) {
          if (!error && response.statusCode === 200) {
            // body contains the user's saved tracks
            console.log(body);
            res.redirect('/#' +
              querystring.stringify({
                access_token: access_token,
                refresh_token: refresh_token,
                timeout: timeout
              }));
          } else {
            // Handle error
            console.log(error);
            res.redirect('/#' +
              querystring.stringify({
                error: 'api_error'
              }));
          }
        });
      } else {
        // Handle error
        console.log(error);
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      var timeout = body.expires_in;
      res.send({
        'access_token': access_token,
        'timeout': timeout
      });
    }
  });
});

app.listen(port);
