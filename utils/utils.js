/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (redis) {

  // npm modules
  var rate = require('express-rate')
    , coolog = require('coolog')
    , logger = coolog.logger('utils.js')
    ;

  var rateLimitMiddleware
    , rateLimit
    , check_origin
    , rl_client = redis.createClient()
    ;

  rateLimitMiddleware = rate.middleware({
    handler: new rate.Redis.RedisRateHandler({ client: rl_client })
  , interval: 5
  , limit: 2
  , onLimitReached: function (req, res, rate, limit, resetTime, next) {
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

  return {
    'rateLimit': rateLimit
  , 'check_origin': check_origin
  };
};