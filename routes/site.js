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
    res.render('index');
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
      , form_subject: ''
      , form_intro: ''
      , form_destination: ''
      , creator_email: ''
      , colours: ''
      , phone: ''
      , country_code: ''
      , replyto_field: ''
      };
      res.render('signup', {
        form: form
      , action: 'create'
      });
    },
    success: function (req, res) {
      var api_key = req.params.api_key
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
            res.render('success', {form: form});
          }
        }
      });
    },
    del: function (req, res) {
      var api_key = req.params.api_key
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
      var api_key = req.params.api_key
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
    var api_key = req.params.api_key
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
            res.redirect('/success/' + form._id + '?token=' + form.token);
          } else {
            log_utils.get_graph(api_key, function (err, graph) {
              if (err) {
                next(err);
              } else {
                logger.info('graph', graph);
                next(null, form, graph);
              }
            });
          }
        },
        function (form, graph) {
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
          , graph: JSON.stringify(graph)
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

  var confirmed_email = function (req, res) {
    var api_key = req.params.api_key
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
            res.render('confirmed_email', {form: form});
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

  var server_error = function (req, res) {
    res.render('errors/500');
  };

  // routes
  app.get(prefix + '/', index);
  app.get(prefix + '/success/:api_key', form.success);
  app.get(prefix + '/deleted', form.deleted);
  app.get(prefix + '/signup', form.signup);
  app.get(prefix + '/delete/:api_key', form.del);
  app.get(prefix + '/edit/:api_key', form.edit);
  app.get(prefix + '/dashboard/:api_key', dashboard);
  app.get(prefix + '/confirm/email/confirmed/:api_key', confirmed_email);
  // errors
  app.get(prefix + '/error', error_page);
  app.get(prefix + '/404', form_not_found);
  app.get(prefix + '/500', server_error);
};