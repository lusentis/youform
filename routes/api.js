
'use strict';


module.exports = function (db, redis_client) {

  let coolog = require('coolog')
    , mime = require('mime')
    , moment = require('moment')
    , inflection = require('inflection')
    , uuid = require('node-uuid')
    , path = require('path')
    , comm_utils = require('../utils/comm_utils.js')()
    , error_utils = require('../utils/error_utils.js')()
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , utils = require('../utils/utils.js')(redis_client)
    , Form = require('./Form.js')
    , regex = require('./regex')
    ;
  
  let logger = coolog.logger(path.basename(__filename));

  let test_email = function (email) {
    return regex.email.test(email) && email.length < 100;
  };

  let _form = {
    create: function* () {

      let body = this.request.body;
      let data = new Form();
      data._id = uuid.v4();
      data.token = uuid.v4();
      data.code = uuid.v4().replace(/-/).substring(0, 6).toUpperCase();
      data.form_name = body['f-name'];
      data.website_url = body['w-url'].toLowerCase();
      data.website_success_page = body['w-success-page'].toLowerCase();
      data.form_subject = body['f-subject'];
      data.form_intro = body['f-intro'];
      data.form_destination = body['email-dest'];
      data.creator_email = body['email-crt'].toLowerCase();
      data.colours = body.colours.trim();
      data.country_code = body['country-code'].trim().replace(/\+/g, '');
      data.phone = body.phone.trim().replace(/[\-]/g, '');
      data.replyto_field = body['replyto-field'].trim();      

      if (data.form_subject.isBlank() || data.form_intro.isBlank() || data.form_name.isBlank() || !regex.colours.test(data.colours)) {
        this.flash.param_error =  true;
        this.redirect('/signup');
        return;
      }

      if (!test_email(data.creator_email) || !test_email(data.form_destination)) {
        this.flash('email_error', true);
        this.redirect('/signup');
        return;
      }
      if (!regex.phone.test(data.phone) || !regex.country_code.test(data.country_code)) {
        this.flash.phone_error = true;
        this.redirect('/signup');
        return;
      }

      let form_saved = null;
      try {
        form_saved  = yield form_utils.save_form(data, null);
      } catch (err) {
        logger.error('Error saving form', err);
      }
      if (form_saved) {
        // send email
        try {
          let email_response = yield comm_utils.send_thanks(data);
          logger.info('Email sent', email_response);
        } catch (err) {
          logger.error('Error sending thanks email', err);
        }
        // send SMS
        try {
          let sms_response = yield comm_utils.send_sms(data);
          logger.info('SMS sent', sms_response);
        } catch (err) {
          logger.error('Error sending sms', err);
        }
      }
      
      this.redirect('/success/' + form_saved._id + '?token=' + form_saved.token);
    },
    get: function* () {

      var api_key = this.params.api_key;

      if (!api_key) {
        error_utils.params_error({api_key: api_key}, this);
        return;
      }

      let form_data =  yield form_utils.get_form(api_key);
      
      if (!form_data) {
        // todo: handle not found
        // error_utils.form_not_found(api_key, req, res);
        return;
      }

      if (!utils.check_origin(this.request, form_data)) {
        logger.error({
          error: true
        , form_id: api_key
        , description: 'origin error'
        });
        this.flash('origin_error', true);
        this.redirect('/error');
        return;
      }

      if (form_data.deleted) {
        this.status = 403;
        this.body = {
          error: true
        , description: 'not found.'
        };
        return;
      }
      if (!form_data.confirmed) {
        // deleted
        logger.error({
          error: true
        , form_id: api_key
        , description: 'not found'
        });
        this.status = 403;
        this.body = {
          error: true
        , description: 'not found'
        };
        return;
      }

      let spam = yield utils.spam_filter(req, res);
      
      // save connection
      let data = {
        user_ip: this.request.connection.remoteAddress
      , api_key: api_key
      , spam: spam
      };

      yield log_utils.save_log(data);
      
      if (spam) {
        logger.info('Redirect to 500 page');
        this.redirect('/500');
      }

      let user_form = {}
        , files = {}
        ;
      
      // parse form data
      Object.keys(this.request.body).forEach(function (key) {
        user_form[inflection.humanize(key)] = req.body[key];
      });

      if (this.request.files !== undefined) {
        Object.keys(this.request.files).forEach(function(key) {
          // check MIME type
          user_form = Object.reject(user_form, key);
          if (/(doc|docx|pdf|jpg|jpeg|png|gif)/.test(mime.extension(mime.lookup(req.files[key].path)))) {
            files[key] = this.request.files[key];
          }
        });
      }
      try {
        yield comm_utils.send_form(form_data, user_form, files, res);
        logger.info('Redirect to', form_data.website_success_page);
        let url = regex.url.test(form_data.website_success_page) ? form_data.website_success_page : form_data.website_url;
        res.redirect(url);
      } catch (err) {
        logger.error('Postmark error', err);
        logger.info('Redirect to 500 page');
        this.redirect('/500');
      }
    },
    del: function* () {
      var api_key = this.param.api_key
        , token = this.body.token
        ;
      
      if (!api_key || !token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res);
        return;
      }

      let form_data = null;
      try {
        form_data = yield db.get(api_key, { include_docs: true });
      } catch (err) {
        error_utils.form_not_found(api_key, req, res);
        return;
      }

      if (form_data.token !== token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res, 'token error');
        return;
      }

     yield form_utils.delete_form(form_data);
     this.flash.form_deleted =  true;
     this.redirect('/deleted');
    },
    edit: function (req, res) {
      var api_key = req.param('api_key', null)
        , token = req.body.token
        , form
        ;

      var data = {
        form_name: req.body['f-name'],
        website_url: req.body['w-url'],
        website_success_page: req.body['w-success-page'],
        form_subject: req.body['f-subject'],
        form_intro: req.body['f-intro'],
        form_destination: req.body['email-dest'],
        creator_email: req.body['email-crt'],
        colours: req.body.colours,
        country_code: req.body['country-code'].trim().replace(/\+/g, ''),
        phone: req.body.phone.trim().replace(/[\-]/g, ''),
        replyto_field: req.body['replyto-field']
      };


      if (!api_key || !token) {
        error_utils.params_error({api_key: api_key, token: token}, req, res);
        return;
      }

      if (!test_email(data.creator_email) || !test_email(data.form_destination)) {
        logger.error('emails format error');
        req.flash('email_error', true);
        res.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      if (!regex.phone.test(data.phone.trim()) || !regex.country_code.test(data.country_code.trim())) {
        req.flash('phone_error', true);
        res.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      async.waterfall([
          function (next) {
            form_utils.get_form(api_key, function (err, result) {
              if (err) {
                next(err);
              } else {
                form = result;
                if (token === form.token) {
                  next(null);
                } else {
                  res.redirect('/');
                }
              }
            });
          },
          function (next) {
            if (data.form_destination.trim() !== form.form_destination) {
              db.atomic('youform', 'forms', api_key, {'action': 'change_email', email: data.form_destination}, function (err, data) {
                if (err) {
                  next(err);
                } else {
                  form = data;
                  comm_utils.send_confirm_email(form, res, function (err) {
                    if (err) {
                      req.flash('send_email_error', true);
                      res.redirect('/edit/' + api_key + '?token=' + token);
                    } else {
                      logger.ok('email sent', form.form_destination_not_confirmed);
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
                logger.ok('Form updated', form);
                req.flash('form_saved', true);
                res.redirect('/dashboard/' + form._id + '?token=' + form.token);
              }
            });
          }
        ], function (err) {
          if (err) {
            throw err;
          }
        });
    }
  };
  var _confirm_email = function (req, res) {
    var api_key = req.param('api_key', null)
      , email = req.query.email
      , token = req.query.token
      ;

    if (!api_key || !regex.email.test(email) || !token) {
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
                  next(null, form, (form.confirmed && !form.email_confirmed));
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
        function (form, replace, next) {
          db.atomic('youform', 'forms', api_key, {'action': 'confirm_email'}, function (err, data) {
            if (err) {
              next(err);
            } else {
              if (data.confirmed === true && !replace) {
                comm_utils.send_form_info(data, res, function (err) {
                  if (err) {
                    next(err);
                  } else {
                    logger.ok('info email sent', {
                      email: form.creator_email
                    });
                  }
                });
              }
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

  var _confirm_sms = function (req, res) {
    var api_key = req.param('api_key', null)
      , token = req.body.token
      , code = req.body.code
      ;

    if (!api_key || !token || !code) {
      error_utils.params_error({api_key: api_key, token: token, code: code}, req, res);
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
            db.atomic('youform', 'forms', api_key, {'action': 'phone'}, function (err, data) {
              if (err) {
                next(err);
              } else {
                logger.info('updated', data);
                next(null, data);
              }
            });
          } else {
            req.flash('code_error', true);
            res.redirect('/success/' + api_key + '?token=' + token);
          }
        },
        function (form, next) {
          logger.ok('code confirmed');
          if (form.confirmed === true) {
            comm_utils.send_form_info(form, res, function (err) {
              if (err) {
                next(err);
              } else {
                logger.ok('info email sent', {
                  email: form.creator_email
                });
              }
            });
          }
          res.redirect('/success/' + api_key + '?token=' + token);
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var _send_confirm_email = function (req, res) {
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
              logger.ok('email sent', form.form_destination_not_confirmed);
              logger.info('redirect to dashboard');
              req.flash('waiting_confirm', true);
              res.redirect('/dashboard/' + form._id + '?token=' + form.token);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var _send_confirm_sms = function (req, res) {
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
              if (form.confirmed_phone === true) {
                res.redirect('/');
                return;
              }
              next(null, form);
            }
          });
        },
        function (form, next) {
          redis_client.get(api_key, function (err, time) {
            if (err) {
              next(err);
            } else {
              var now = moment();
              if (!time || now.diff(time, 'seconds') > 300) {
                redis_client.set(api_key, now);
                logger.ok('saved', {
                  sms_date: now.format('YYYY-MM-DD')
                });
                next(null, form);
              } else {
                logger.info({
                  message: 'waiting 5 minutes'
                , now: now.format('YYYY-MM-DD')
                , sms_date: moment(time).format('YYYY-MM-DD')
                });
                res.redirect('/dashboard/' + form._id + '?token=' + form.token);
              }
            }
          });
        },
        function (form) {
          comm_utils.send_sms(form, function () {
            res.redirect('/dashboard/' + form._id + '?token=' + form.token);
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  // routes

  return {
    form: _form,
    confirm_sms: _confirm_sms,
    send_confirm_sms: _send_confirm_sms,
    send_confirm_email: _send_confirm_email,
    confirm_email: _confirm_email
  };
};