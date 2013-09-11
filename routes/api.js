/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';


module.exports = function (app, db, redis, prefix) {

  var akismet = require('akismet-api')
    , async = require('async')
    , coolog = require('coolog')
    , dns = require('dns')
    , uuid = require('node-uuid')
    , email_utils = require('../utils/email_utils.js')()
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , spam_list = require('../spam_list.json')
    , utils = require('../utils/utils.js')(redis)
    , email_regex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9\-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/
    , phone_regex = /^[0-9\-().\s]{10,15}$/
    , country_code_regex = /^\+{0,1}[0-9]{1,4}$/
    ;
  
  var logger = coolog.logger('api.js');

  var akismet_client = akismet.client({
    key  : process.env.AKISMET_API_KEY,
    blog : 'http://youform.me'
  });

  //akismet_client.verifyKey(function (err, valid) {
  //  if (valid) {
  //    logger.info('Valid key!');
  //  } else {
  //    logger.err('Key validation failed...');
  //    logger.err(err.message);
  //  }
  //});

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
          email_utils.send_form_info(form, res, function (err) {
            if (err) {
              next(err);
            } else {
              next(null);
            }
          });
        },
        function () {
          // send sms
          utils.send_sms(form, function () {
            res.redirect('/confirm/sms?api_key=' + form._id + '&token=' + form.token);
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
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
                logger.error(domain + ' has your IP on it\'s blacklist!');
                next(true);
              }
            });
          };
          async.detect(spam_list, host, function (result) {
            logger.debug(result);
            result = result !== undefined;
            logger.debug('Check Spam', result);
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

  var form = function (req, res) {
    var api_key = req.param('api_key', null);
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
            logger.error({
              error: true
            , form_id: api_key
            , description: 'Form not found'
            });
            res.json({
              error: true
            , description: 'Form not found. Check your API key'
            });
          } else {
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
              res.json({
                error: true
              , description: 'Origin error.'
              });
            }
          }
        });
      },
      function (form, next) {
        spam_filter(req, res, function (err, spam) {
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
        email_utils.send_form(form, req.body, res, function (err) {
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
    var api_key = req.body.api_key
      , token = req.body.token;
    
    if (api_key && token) {
      req.flash('form_deleted', false);
      res.redirect('/deleted');
      return;
    }

    form_utils.delete_form(api_key, token, function (err, deleted) {
      if (err) {
        throw err;
      } else {
        req.flash('form_deleted', deleted);
        res.redirect('/deleted');
      }
    });
  };

  var edit_form = function (req, res) {
    var api_key = req.body.api_key
      , token = req.body.token
      , form;

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
      res.redirect('/');
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
                email_utils.send_confirm_email(form, res, function (err) {
                  if (err) {
                    req.flash('send_email_error', true);
                    res.redirect('/edit-form/' + api_key + '?token=' + token);
                  } else {
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
    var api_key = req.query.api_key
      , email = req.query.email
      , token = req.query.token
      ;

    if (!api_key || !email_regex.test(email) || !token) {
      res.redirect('/signup');
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
                logger.debug(form.form_destination_not_confirmed);
                logger.debug(form.form_destination);
                logger.debug(email);
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
              res.redirect('/confirm/sms/confirmed?api_key=' + api_key + '&token=' + token);
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
    var api_key = req.body.api_key
      , token = req.body.token
      , code = req.body.code
      ;
    
    if (!api_key || !token || !code) {
      req.flash('confirm_error', true);
      res.redirect('/');
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
            res.redirect('/confirm/sms');
          }
        },
        function () {
          logger.info('code confirmed');
          res.redirect('/confirm/sms/confirmed?api_key=' + api_key + '&token=' + token);
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var send_confirm_email = function (req, res) {
    var api_key = req.query.api_key
      , token = req.query.token
      ;

    if (!api_key || !token) {
      logger.error('apikey/token error');
      res.redirect('/');
    }

    async.waterfall([
        function (next) {
          form_utils.get_form(api_key, function (err, form) {
            if (err) {
              next(err);
            } else {
              if (!form) {
                logger.error('form not found');
                res.redirect('/');
                return;
              } else {
                next(null, form);
              }
            }
          });
        },
        function (form, next) {
          email_utils.send_confirm_email(form, res, function (err) {
            if (err) {
              next(err);
            } else {
              logger.info('email sent', form.form_destination);
              logger.info('redirect to stats');
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
  app.get('/confirm/email', confirm_email);
  app.post(prefix + '/confirm/sms', confirm_sms);
  app.get(prefix + '/confirm/send-email', send_confirm_email);

  app.post(prefix + '/new-form', new_form);
  app.post(prefix + '/edit-form', edit_form);
  app.post(prefix + '/delete-form', delete_form);
  //app.get(prefix + '/form/:api_key', utils.rateLimit(), form);
  app.post(prefix + '/form/:api_key', utils.rateLimit(), form);
  
};