/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (redis_client) {

  // npm modules
  var akismet = require('akismet-api')
    , rate = require('express-rate')
    , coolog = require('coolog')
    , dns = require('dns')
    , spam_list = require('../spam_list.json')
    ;

  var logger = coolog.logger('utils.js');

  var akismet_client = akismet.client({
    key  : process.env.AKISMET_API_KEY,
    blog : 'http:/www.youform.me'
  });

  var rateLimitMiddleware = rate.middleware({
    handler: new rate.Redis.RedisRateHandler({ client: redis_client })
  , interval: 5
  , limit: 2
  , onLimitReached: function (req, res) {
      res.json({
        error: true
      , description: 'rate limit exceeded'
      });
    }
  });

  var rateLimit = function () {
    return function (req, res, next) {
      return rateLimitMiddleware(req, res, next);
    };
  };

  var check_origin = function (req, form) {
    var origin =  req.headers.referer || req.headers.origin;
    logger.info('origin', {
      referer: req.headers.referer
    , origin: req.headers.origin
    , website_url: form.website_url
    });
    return (origin && (origin.has(form.website_url) || form.website_url.has(origin)));
  };

  var spam_filter = function (req, res, callback) {
    var ip = req.ip.split('.').reverse().join('.');
    async.parallel([
        function (ret) {
          // Akismet filter
          akismet_client.checkSpam({
            user_ip : req.ip,
            user_agent : req.headers['user-agent'],
            referer : req.headers.referer
          }, function (err, spam) {
            if (err) {
              ret(err);
            }
            if (spam) {
              logger.error({
                spam: true
              , user_ip: req.ip
              , referrer: req.headers.referer
              });
            }
            ret(null, spam);
          });
        },
        function (ret) {
          var host = function (item, next) {
            dns.resolve4(ip + '.' + item.dns, function (err, domain) {
              if (err) {
                if (err.code === 'ENOTFOUND') {
                  next(false);
                } else {
                  ret(err);
                }
              } else {
                logger.error(domain + ' has your IP on it\'s blacklist');
                next(true);
              }
            });
          };
          async.detect(spam_list, host, function (result) {
            result = result !== undefined;
            logger.debug('check Spam', result);
            ret(null, result);
          });
        }
      ],
      function (err, results) {
        if (err) {
          callback(err);
        } else {
          var spam = (results[0] || results[1]);
          logger.info('Spam', spam);
          callback(null, spam);
        }
      });
  };

  return {
    'rateLimit': rateLimit
  , 'check_origin': check_origin
  , 'spam_filter': spam_filter
  };
};