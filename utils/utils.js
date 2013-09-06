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

  return {
    'rateLimit': rateLimit
  };
};