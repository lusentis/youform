/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, prefix) {

  var async = require('async')
    , coolog = require('coolog')
    , logger = coolog.logger('site.js')
    , log_utils = require('../utils/log_utils.js')(db)
    , form_utils = require('../utils/form_utils.js')(db)
    ;

  var index = function (req, res) {
    res.render('index', {
      title: 'youform'
    });
  };

  var new_form = function (req, res) {
    res.render('signup', {
      title: 'New form'
    });
  };

  var signup_success = function (req, res) {
    res.render('signup_success', {
      title: 'Sign success'
    });
  };

  //var delete_form = function (req, res) {
  //
  //};

  var stats = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.params.token;
    async.waterfall([
        function (next) {
          form_utils.get_form(api_key, function (err, form) {
            if (err) {
              next(err);
            } else {
              if (!form) {
                next(null, null);
              } else {
                next(null, form);
              }
            }
          });
        },
        function (form, next) {
          if (!form) {
            next(null, null, null);
          } else {
            var args = {
              api_key: api_key
            , token: token
            };
            logger.info('stats args', args);
            log_utils.get_stats(args.api_key, function (err, stats) {
              if (err) {
                next(err);
              } else {
                next(null, stats);
              }
            });
          }
        },
        function (form, stats) {
          var not_found = !form;
          res.render('stats', {not_found: not_found, form: form, stats: stats});
        }
      ],
      function (err) {
        if (err) {
          throw err;
        }
      });
  };
  

  // routes
  app.get(prefix + '/', index);
  app.get(prefix + '/success', signup_success);
  app.get(prefix + '/signup', new_form);
  //app.get(prefix + '/delete-form', delete_form);
  app.get(prefix + '/stats/:api_key', stats);
};