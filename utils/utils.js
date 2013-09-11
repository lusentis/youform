/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (redis) {

  // npm modules
  var rate = require('express-rate')
    , coolog = require('coolog')
    , crypto = require('crypto')
    , querystring = require('querystring')
    , https = require('https')
    , logger = coolog.logger('utils.js')
    ;

  var rateLimitMiddleware
    , rateLimit
    , check_origin
    , send_sms
    , rl_client = redis.createClient()
    ;

  rateLimitMiddleware = rate.middleware({
    handler: new rate.Redis.RedisRateHandler({ client: rl_client })
  , interval: 5
  , limit: 2
  , onLimitReached: function (req, res) {
      res.json({
        error: true
      , description: 'rate limit exceeded'
      });
    }
  });

  rateLimit = function () {
    return function (req, res, next) {
      return rateLimitMiddleware(req, res, next);
    };
  };

  check_origin = function (req, form) {
    var origin =  req.headers.referer;
    logger.debug({
      'origin': origin
    , 'website_url': form.website_url
    });
    return (origin && (origin.has(form.website_url) || form.website_url.has(origin)));
  };

  send_sms = function (form, callback) {
    var message = 'Youform.me confirmation code: ' + form.code
      , response = ''
      , data
      , post_options
      ;
    data = querystring.stringify({
      'username': process.env.HQ_USERNAME
    , 'password': crypto.createHash('md5').update(process.env.HQ_PASSWORD).digest('hex')
    , 'to': form.country_code + '' + form.phone
    , 'from': process.env.HQ_SENDER
    , 'message': message
    });
    post_options = {
      host: 'ssl.hqsms.com',
      port: '443',
      path: '/sms.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      }
    };
    var hq_request = https.request(post_options, function (res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        response += chunk;
      });
      res.on('end', function () {
        logger.info('HQSMS response', response);
        callback(response.has('ERROR'));
      });
    });
    hq_request.write(data);
    hq_request.end();
  };

  return {
    'rateLimit': rateLimit
  , 'check_origin': check_origin
  , 'send_sms': send_sms
  };
};