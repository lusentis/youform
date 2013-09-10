/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';


module.exports = function (app, db, redis, prefix) {

  var akismet = require('akismet-api')
    , async = require('async')
    , coolog = require('coolog')
    , dns = require('dns')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    , uuid = require('node-uuid')
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , spam_list = require('../spam_list.json')
    , utils = require('../utils/utils.js')(redis)
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
    , phone: req.body.phone
    };

    async.waterfall([
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
          res.render('email/signup', { form: form }, function (err, body) {
            if (err) {
              next(err);
            } else {
              next(null, body);
            }
          });
        },
        function (html_body) {
          postmark.send({
            'From': process.env.POSTMARK_FROM
          , 'To': form.creator_email
          , 'Subject': 'Signup youform: ' + form.form_name
          , 'HtmlBody': html_body
          }, function (err) {
            if (err) {
              logger.error('email error', err);
            }
          });
          res.redirect('/success');
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var spam_filter = function (req, res, callback) {
    var ip = req.ip.split('.').reverse().join('.');
    // logger.debug(ip);
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
      function (form, next) {
        // render email template
        res.render('email/email', { intro: form.form_intro, form: req.body }, function (err, body) {
          if (err) {
            next(err);
          } else {
            next(null, form, body);
          }
        });
      },
      function (form, html_body) {
        // send email
        postmark.send({
          'From': process.env.POSTMARK_FROM
        , 'To': form.form_destination
        , 'ReplyTo': form.sender_email
        , 'Subject': form.form_subject
        , 'HtmlBody': html_body
        }, function (err) {
          if (err) {
            logger.error('Postmark error', err);
            logger.info('Redirect to', form.website_error_page);
            res.redirect(form.website_error_page);
          } else {
            logger.info('Redirect to', form.website_success_page);
            res.redirect(form.website_success_page);
          }
        });
      }
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
      , token = req.body.token;
    if (!api_key || !token) {
      res.redirect('/');
      return;
    }
    async.waterfall([
        function (next) {
          form_utils.get_form(api_key, function (err, result) {
            if (err) {
              next(err);
            } else {
              next(null, result);
            }
          });
        },
        function (form, next) {
          if (token === form.token) {
            // save
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
            , phone: req.body.phone
            };
            form_utils.save_form(data, api_key, function (err, result) {
              if (err) {
                next(err);
              } else {
                logger.info('Form updated', result);
                req.flash('form_saved', true);
                res.redirect('/stats/' + form._id + '?token=' + form.token);
              }
            });
          } else {
            res.redirect('/');
          }
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var confirm = function (req, res) {
    var api_key = req.query.api_key
      , email = req.query.email
      , token = req.query.token
      ;
    if (!api_key || !email || !token) {
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
              if (form.token === token && email === form.creator_email) {
                if (form.confirmed === true) {
                  logger.info('Already confirmed');
                  res.redirect('/');
                } else {
                  next(null, form);
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
          if (!form.sms_sent) {
            utils.send_sms(form, function (sent) {
              next(null, form, sent);
            });
          }
        },
        function (form, sent, next) {
          db.atomic('youform', 'forms', api_key, {'action': 'sms_sent'}, function (err) {
            if (err) {
              next(err);
            } else {
              next(null, form);
            }
          });
        },
        function (form) {
          res.render('confirm', {form: form});
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var confirm_sms = function (req, res) {
    var api_key = req.body.api_key
      , email = req.body.email
      , token = req.body.token
      , code = req.body.code
      ;
    
    async.waterfall([
        function (next) {
          // get form
          form_utils.get_form(api_key, function (err, data) {
            if (err) {
              next(err);
            } else {
              if (data.token === token && email === data.creator_email) {
                if (data.confirmed === true) {
                  res.redirect('/');
                } else {
                  next(null, data);
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
          , code: form
          });
          if (form.code === code) {
            db.atomic('youform', 'forms', api_key, {'action': 'confirmed'}, function (err) {
              if (err) {
                next(err);
              } else {
                next(null, form);
              }
            });
          } else {
            req.flash('code_error', true);
            res.redirect('/confirm');
          }
        },
        function (form) {
          logger.info('code confirmed');
          res.render('confirm', {form: form});
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  // routes
  app.get('/confirm', confirm);
  app.post('/confirm/sms', confirm_sms);

  app.post(prefix + '/new-form', new_form);
  app.post(prefix + '/edit-form', edit_form);
  app.post(prefix + '/delete-form', delete_form);
  //app.get(prefix + '/form/:api_key', utils.rateLimit(), form);
  app.post(prefix + '/form/:api_key', utils.rateLimit(), form);
  
};