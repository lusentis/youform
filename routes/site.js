/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, prefix) {

  var async = require('async')
    , coolog = require('coolog')
    , moment = require('moment')
    , logger = coolog.logger('site.js')
    , error_utils = require('../utils/error_utils.js')()
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    ;

  var index = function (req, res) {
    res.render('index', {
      title: 'youform'
    });
  };

  var form = {
    signup: function (req, res) {
      var form = {
        _id: ''
      , token: ''
      , code: ''
      , form_name: ''
      , website_url: ''
      , website_success_page: ''
      , website_error_page: ''
      , form_subject: ''
      , form_intro: ''
      , form_destination: ''
      , creator_email: ''
      , sender_name: ''
      , sender_email: ''
      , colours: ''
      , phone: ''
      , country_code: ''
      };
      res.render('signup', {
        title: 'New form'
      , form: form
      , action: 'create'
      });
    },
    success: function (req, res) {
      var api_key = req.param('api_key', null)
        , token = req.query.token
        ;

      if (!api_key || !token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res);
        return;
      }

      form_utils.get_form(api_key, function (err, form) {
        if (err) {
          throw err;
        } else {
          if (!form || form.token !== token) {
            error_utils.params_error({api_key: api_key, token: token}, req, res);
            return;
          } else if (form.confirmed === true) {
            res.redirect('/dashboard/' + form._id + '?token=' + form.token);
          } else {
            res.render('signup_success', {
              title: 'sign success'
            , form: form
            });
          }
        }
      });
    },
    del: function (req, res) {
      var api_key = req.param('api_key', null)
        , token = req.query.token
        ;

      if (!api_key || !token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res);
        return;
      }

      form_utils.get_form(api_key, function (err, form) {
        if (err) {
          throw err;
        } else {
          var not_found = (!form || form.token !== token);
          logger.info('form not found', not_found);
          res.render('delete', {not_found: not_found, form: form});
        }
      });
    },
    deleted: function (req, res) {
      if (req.flash('form_deleted').length > 0) {
        res.render('deleted', {deleted: req.flash('form_deleted')[0]});
      } else {
        res.redirect('/');
      }
    },
    edit: function (req, res) {
      var api_key = req.param('api_key', null)
        , token = req.query.token
        ;

      if (!api_key || !token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res);
        return;
      }

      form_utils.get_form(api_key, function (err, form) {
        if (err) {
          throw err;
        } else {
          if (!form || form.token !== token) {
            error_utils.params_error({api_key: api_key, token: token}, req, res);
            return;
          }
          res.render('signup', {
            form: form
          , action: 'edit'
          });
        }
      });
    }
  };


  var dashboard = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token
      ;

    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

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
            req.flash('form_not_found', true);
            res.redirect('/404');
          } else if (!form.confirmed) {
            res.redirect(prefix + '/success');
          } else {
            log_utils.get_dashboard(api_key, function (err, dashboard) {
              if (err) {
                next(err);
              } else {
                logger.info('dashboard', dashboard);
                next(null, form, dashboard);
              }
            });
          }
        },
        function (form, dashboard) {
          var not_found = !form;
          if (form) {
            not_found = form.token !== token;
          } else {
            not_found = true;
          }
          var form_saved = req.flash('form_saved').length > 0;
          var form_save_error = req.flash('form_save_error').length > 0;
          form.created_at = moment(form.created_at).format('YYYY-MM-DD');
          res.render('dashboard', {
            not_found: not_found
          , form: form
          , dashboard: dashboard
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

  /*var confirm_sms = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token
      ;

    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

    form_utils.get_form(api_key, function (err, form) {
      if (err) {
        throw err;
      } else {
        if (form.token === token) {
          if (form.phone_confirmed === false) {
            res.render('confirm_phone', {form: form});
          } else {
            res.redirect('/');
          }
        } else {
          error_utils.params_error({api_key: api_key, token: token}, req, res, 'token error');
          return;
        }
      }
    });
  };*/

  /*var confirmed_sms = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token
      ;

    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

    form_utils.get_form(api_key, function (err, form) {
      if (err) {
        throw err;
      } else {
        if (form.token === token) {
          logger.info('Phone confirmed', form.phone_confirmed);
          if (form.phone_confirmed === true) {
            res.render('confirmed_phone', {api_key: api_key, token: token});
          } else {
            res.redirect('/');
          }
        } else {
          error_utils.params_error({api_key: api_key, token: token}, req, res, 'token error');
          return;
        }
      }
    });
  };*/

  var confirmed_email = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.query.token
      ;

    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

    form_utils.get_form(api_key, function (err, form) {
      if (err) {
        throw err;
      } else {
        if (form.token === token) {
          if (form.email_confirmed === true) {
            res.render('confirmed_email', {api_key: api_key, token: token});
          } else {
            res.redirect('/');
          }
        } else {
          error_utils.params_error({api_key: api_key, token: token}, req, res, 'token error');
          return;
        }
      }
    });
  };

  var error_page = function (req, res) {
    var origin_error = req.flash('origin_error');
    if (origin_error.length > 0) {
      var error = 'origin';
      res.render('errors/index', {error: error});
    } else {
      res.redirect('/');
    }
  };

  var form_not_found = function (req, res) {
    var not_found = req.flash('form_not_found')
      , param_error = req.flash('param_error')
      ;

    if (param_error.length > 0 || not_found.length > 0) {
      res.render('errors/404');
    } else {
      res.redirect('/');
    }
  };

  // routes
  app.get(prefix + '/', index);
  app.get(prefix + '/success/:api_key', form.success);
  app.get(prefix + '/deleted', form.deleted);
  app.get(prefix + '/signup', form.signup);
  app.get(prefix + '/delete/:api_key', form.del);
  app.get(prefix + '/edit/:api_key', form.edit);
  app.get(prefix + '/dashboard/:api_key', dashboard);
  //app.get(prefix + '/confirm/sms/:api_key', confirm_sms);
  //app.get(prefix + '/confirm/sms/confirmed/:api_key', confirmed_sms);
  app.get(prefix + '/confirm/email/confirmed/:api_key', confirmed_email);
  // errors
  app.get(prefix + '/error', error_page);
  app.get(prefix + '/404', form_not_found);
};