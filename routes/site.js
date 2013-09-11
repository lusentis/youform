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

  var delete_form = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token;
    if (api_key && token) {
      form_utils.get_form(api_key, function (err, form) {
        if (err) {
          throw err;
        } else {
          var not_found = (!form || form.token !== token);
          logger.info('form not found', not_found);
          res.render('delete', {not_found: not_found, form: form});
        }
      });
    } else {
      res.render('delete', {not_found: true});
    }
  };

  var stats = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token;
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
            log_utils.get_stats(api_key, function (err, stats) {
              if (err) {
                next(err);
              } else {
                logger.info('stats', stats);
                next(null, form, stats);
              }
            });
          }
        },
        function (form, stats) {
          var not_found = !form;
          if (form) {
            not_found = form.token !== token;
          } else {
            not_found = true;
          }
          var form_saved = req.flash('form_saved').length > 0;
          var form_save_error = req.flash('form_save_error').length > 0;
          res.render('stats', {
            not_found: not_found
          , form: form
          , stats: stats
          , form_saved: form_saved
          , form_save_error: form_save_error
          });
        }
      ],
      function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var form_deleted = function (req, res) {
    if (req.flash('form_deleted').length > 0) {
      res.render('deleted', {deleted: req.flash('form_deleted')[0]});
    } else {
      res.redirect('/');
    }
  };

  var edit_form = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token;

    if (!api_key || !token) {
      req.flash('param_error', true);
      res.redirect('/');
      return;
    }

    form_utils.get_form(api_key, function (err, form) {
      if (err) {
        throw err;
      } else {
        var not_found = (!form || form.token !== token);
        logger.info('form not found', not_found);
        res.render('edit', {not_found: not_found, form: form});
      }
    });
  };

  var confirm_sms = function (req, res) {
    var api_key = req.query.api_key
      , token = req.query.token
      ;

    if (!api_key || !token) {
      res.redirect('/');
      return;
    }

    form_utils.get_form(api_key, function (err, form) {
      if (err) {
        throw err;
      } else {
        if (form.token === token) {
          if (!form.confirmed) {
            res.render('confirm', {form: form});
          } else {
            res.redirect('/');
          }
        } else {
          logger.info('Token error');
          req.flash('confirm_error', true);
          res.redirect('/');
        }
      }
    });
  };

  // routes
  app.get(prefix + '/', index);
  app.get(prefix + '/success', signup_success);
  app.get(prefix + '/deleted', form_deleted);
  app.get(prefix + '/signup', new_form);
  app.get(prefix + '/delete-form/:api_key', delete_form);
  app.get(prefix + '/edit-form/:api_key', edit_form);
  app.get(prefix + '/stats/:api_key', stats);
  app.get(prefix + '/confirm/sms', confirm_sms);
};