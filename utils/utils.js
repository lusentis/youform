/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {

  // npm modules
  var dns = require('dns')
    , spam_list = require('../spam_list.json')
    ;

  var spam_filter = function (req, res, callback) {
    var ip = req.ip.split('.').reverse().join('.');
    async.parallel([
        
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
    'spam_filter': spam_filter
  };
};