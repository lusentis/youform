/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';


module.exports = function (app, db, redis, prefix) {

  var async = require('async')
    , coolog = require('coolog')
    , uuid = require('node-uuid')
    , comm_utils = require('../utils/comm_utils.js')()
    , error_utils = require('../utils/error_utils.js')()
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , utils = require('../utils/utils.js')(redis)
    , email_regex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9\-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/
    , phone_regex = /^[0-9\-().\s]{10,15}$/
    , country_code_regex = /^\+{0,1}[0-9]{1,4}$/
    ;
  
  var logger = coolog.logger('api.js');

  var test_email = function (email) {
    return email_regex.test(email) && email.length < 100;
  };

  var new_form = function (req, res) {

    var form = {
      _id: uuid.v4()
    , token: uuid.v4()
    , code: uuid.v4().replace(/-/).substring(0, 6).toUpperCase()
    , form_name: req.body['f-name']
    , website_url: req.body['w-url']
    , website_success_page: req.body['w-success-page']
    , website_error_page: req.body['w-error-page']
    , form_subject: req.body['f-subject']
    , form_intro: req.body['f-intro']
    , form_destination: req.body['email-dest']
    , creator_email: req.body['email-crt']
    , sender_name: req.body['snd-name']
    , sender_email: req.body['snd-email']
    , colours: req.body.colours
    };

    form.country_code = req.body['country-code'].trim().replace(/\+/g, '');
    form.phone = req.body.phone.trim().replace(/[\-]/g, '');

    if (!test_email(form.creator_email) || !test_email(form.sender_email) || !test_email(form.form_destination)) {
      req.flash('email_error', true);
      res.redirect('/signup');
      return;
    }
    if (!phone_regex.test(form.phone.trim()) || !country_code_regex.test(form.country_code.trim())) {
      req.flash('phone_error', true);
      res.redirect('/signup');
    }

    async.series([
        function (next) {
          form_utils.save_form(form, null, function (err, data) {
            if (err) {
              next(err);
            } else {
              logger.ok('saved form', data);
              form = data;
              next(null);
            }
          });
        },
        function (next) {
          comm_utils.send_form_info(form, res, function (err) {
            if (err) {
              next(err);
            } else {
              next(null);
            }
          });
        },
        function (next) {
          comm_utils.send_confirm_email(form, res, function (err) {
            if (err) {
              next(err);
            } else {
              logger.info('email sent', form.form_destination_not_confirmed);
              req.flash('waiting_confirm', true);
              next(null);
            }
          });
        },
        function () {
          // send sms
          comm_utils.send_sms(form, function () {
            res.redirect('/confirm/sms/' + form._id + '?token=' + form.token);
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var form = function (req, res) {
    var api_key = req.param('api_key', null);

    if (!api_key) {
      error_utils.param_errors({api_key: api_key}, req, res);
      return;
    }

    async.waterfall([
      function (next) {
        // save connection
        var data = {
          user_ip: req.connection.remoteAddress
        , api_key: api_key
        };
        log_utils.save_log(data, function (err, log) {
          if (err) {
            next(err);
          } else {
            logger.info('log saved', log);
            next(null);
          }
        });
      },
      function (next) {
        // get form
        form_utils.get_form(api_key, function (err, result) {
          if (!result) {
            error_utils.form_not_found(api_key, req, res);
            return;
          }
          // check origin url
          if (utils.check_origin(req, result)) {
            logger.debug('results', result);
            if (result.deleted === true) {
              // deleted
              logger.error({
                error: true
              , form_id: api_key
              , description: 'Form deleted'
              });
              res.json({
                error: true
              , description: 'Form deleted.'
              });
            } else {
              next(null, result);
              
            }
          } else {
            logger.error({
              error: true
            , form_id: api_key
            , description: 'Origin error'
            });
            req.flash('origin_error', true);
            res.redirect('/error');
          }
        });
      },
      function (form, next) {
        utils.spam_filter(req, res, function (err, spam) {
          if (err) {
            next(err);
          } else {
            if (spam) {
              logger.info('Redirect to', form.website_error_page);
              res.redirect(form.website_error_page);
            } else {
              next(null, form);
            }
          }
        });
      },
      function (form) {
        comm_utils.send_form(form, req.body, res, function (err) {
          if (err) {
            logger.error('Postmark error', err);
            logger.info('Redirect to', form.website_error_page);
            res.redirect(form.website_error_page);
          } else {
            logger.info('Redirect to', form.website_success_page);
            res.redirect(form.website_success_page);
          }
        });
      },
    ], function (err) {
      if (err) {
        throw err;
      }
    });
  };
  
  var delete_form = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.body.token
      ;
    
    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

    async.waterfall([
        function (next) {
          db.get(api_key, { include_docs: true }, function (err, form) {
            if (err) {
              // form not found
              if (err.status_code === 404) {
                error_utils.form_not_found(api_key, req, res);
                return;
              }
              next(err);
            } else {
              // check token
              if (form.token !== token) {
                error_utils.params_error({api_key: api_key, token: token}, req, res, 'token error');
                return;
              }
              next(null, form);
            }
          });
        },
        function (form, next) {
          form_utils.delete_form(form, function (err) {
            if (err) {
              next(err);
            } else {
              req.flash('form_deleted', true);
              res.redirect('/deleted');
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var edit_form = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.body.token
      , form
      ;

    var data = {
      form_name: req.body['f-name']
    , website_url: req.body['w-url']
    , website_success_page: req.body['w-success-page']
    , website_error_page: req.body['w-error-page']
    , form_subject: req.body['f-subject']
    , form_intro: req.body['f-intro']
    , form_destination: req.body['email-dest']
    , creator_email: req.body['email-crt']
    , sender_name: req.body['snd-name']
    , sender_email: req.body['snd-email']
    , colours: req.body.colours
    };

    if (!api_key || !token) {
      error_utils.params_error({api_key: api_key, token: token}, req, res);
      return;
    }

    if (!test_email(data.creator_email) || !test_email(data.sender_email) || !test_email(data.form_destination)) {
      logger.error('emails format error');
      req.flash('email_error', true);
      res.redirect('/edit-form/' + api_key + '?token=' + token);
      return;
    }

    async.waterfall([
        function (next) {
          form_utils.get_form(api_key, function (err, result) {
            if (err) {
              next(err);
            } else {
              form = result;
              if (token === form.token && form.confirmed === true) {
                next(null);
              } else {
                res.redirect('/');
              }
            }
          });
        },
        function (next) {
          if (data.form_destination.trim() !== form.form_destination) {
            db.atomic('youform', 'forms', api_key, {'action': 'change_email', email: data.form_destination}, function (err) {
              if (err) {
                next(err);
              } else {
                comm_utils.send_confirm_email(form, res, function (err) {
                  if (err) {
                    req.flash('send_email_error', true);
                    res.redirect('/edit-form/' + api_key + '?token=' + token);
                  } else {
                    logger.info('email sent', form.form_destination_not_confirmed);
                    req.flash('waiting_confirm', true);
                    next(null, form);
                  }
                });
              }
            });
          } else {
            next(null);
          }
        },
        function (next) {
          // save
          form_utils.save_form(data, api_key, function (err, result) {
            if (err) {
              next(err);
            } else {
              form = result;
              logger.info('Form updated', form);
              req.flash('form_saved', true);
              res.redirect('/stats/' + form._id + '?token=' + form.token);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var confirm_email = function (req, res) {
    var api_key = req.param('api_key', null)
      , email = req.query.email
      , token = req.query.token
      ;

    if (!api_key || !email_regex.test(email) || !token) {
      error_utils.params_error({api_key: api_key, token: token, email: email}, req, res);
      return;
    }

    async.waterfall([
        function (next) {
          // get form
          form_utils.get_form(api_key, function (err, form) {
            if (err) {
              next(err);
            } else {
              if (form.token === token) {
                if (email === form.form_destination_not_confirmed && form.email_confirmed === false) {
                  next(null, form);
                } else {
                  res.redirect('/');
                }
              } else {
                logger.info('Token/email error');
                req.flash('confirm_error', true);
                res.redirect('/');
              }
            }
          });
        },
        function (form, next) {
          db.atomic('youform', 'forms', api_key, {'action': 'confirm_email'}, function (err) {
            if (err) {
              next(err);
            } else {
              res.redirect('/confirm/email/confirmed/' + api_key + '?token=' + token);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var confirm_sms = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.body.token
      , code = req.body.code
      ;

    if (!api_key || !token || !code) {
      error_utils.param_errors({api_key: api_key, token: token, code: code}, req, res);
      return;
    }

    async.waterfall([
        function (next) {
          // get form
          form_utils.get_form(api_key, function (err, form) {
            if (err) {
              next(err);
            } else {
              if (form.token === token) {
                if (form.phone_confirmed === false) {
                  next(null, form);
                } else {
                  res.redirect('/');
                }
              } else {
                req.flash('confirm_error', true);
                res.redirect('/');
              }
            }
          });
        },
        function (form, next) {
          logger.info({
            user_code: code
          , code: form.code
          });
          if (form.code === code) {
            db.atomic('youform', 'forms', api_key, {'action': 'phone'}, function (err, form_updated) {
              if (err) {
                next(err);
              } else {
                logger.info('updated', form_updated);
                next(null, form);
              }
            });
          } else {
            req.flash('code_error', true);
            res.redirect('/confirm/sms/' + api_key + '?token=' + token);
          }
        },
        function () {
          logger.info('code confirmed');
          res.redirect('/confirm/sms/confirmed/' + api_key + '?token=' + token);
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var send_confirm_email = function (req, res) {
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
                error_utils.form_not_found(api_key, req, res);
                return;
              }
              next(null, form);
            }
          });
        },
        function (form, next) {
          comm_utils.send_confirm_email(form, res, function (err) {
            if (err) {
              next(err);
            } else {
              logger.info('email sent', form.form_destination_not_confirmed);
              logger.info('redirect to stats');
              req.flash('waiting_confirm', true);
              res.redirect('/stats/' + form._id + '?token=' + form.token);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  // routes
  app.post(prefix + '/confirm/sms/:api_key', confirm_sms);
  app.get(prefix + '/confirm/send-email/:api_key', send_confirm_email);
  app.post(prefix + '/new-form', new_form);
  app.post(prefix + '/edit-form/:api_key', edit_form);
  app.post(prefix + '/delete-form/:api_key', delete_form);
  app.post(prefix + '/form/:api_key', utils.rateLimit(), form);

  app.get('/confirm/email/:api_key', confirm_email);
};