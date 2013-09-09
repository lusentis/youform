/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';



module.exports = function (app, db, redis, prefix) {

  var async = require('async')
    , dns = require('dns')
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , utils = require('../utils/utils.js')(redis)
    , spam_list = require('../spam_list.json')
    , coolog = require('coolog')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    , moment = require('moment')
    , akismet = require('akismet-api')
    ;

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

  var logger = coolog.logger('api.js');

  var new_form = function (req, res) {
    var form = {
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

    async.waterfall([
        function (next) {
          form_utils.save_form(form, function (err, data) {
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
          res.render('email/signup', { api_key: form._id }, function (err, body) {
            next(null, body);
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

            // @DEBUG
            //next(null, result);
            //return;

            if (check_origin(req, result)) {
              logger.debug('results', result);
              next(null, result);
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
          next(null, form, body);
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

  var stats = function (api_key, callback) {
    log_utils.get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        var counter = {};
        var logs = [];
        result.rows.forEach(function (row) {
          var date = moment(row.doc.date);
          if (!Object.has(counter[date.year()], date.month() + 1)) {
            counter[date.year()] = {};
            counter[date.year()][date.month() + 1] = 0;
          }
          counter[date.year()][date.month() + 1] += 1;
          logs.push({
            date: row.doc.date
          , user_ip: row.doc.user_ip
          });
        });
        callback(null, {
          api_key: api_key
        , rows: logs
        , total_rows: logs.length
        , counter: counter
        });
      }
    });
  };

  //var test_stats = function (req, res) {
  //  var api_key = req.param('api_key', null);
  //  stats(api_key, function (err, obj) {
  //    if (err) {
  //      throw err;
  //    } else {
  //      res.json(obj);
  //    }
  //  });
  //};

  var check_origin = function (req, form) {
    var origin = req.headers.origin;
    logger.debug('origin', origin);
    return (origin && origin.has(form.website_url));
  };

  // routes
  app.post(prefix + '/new-form', new_form);
  //app.get(prefix + '/form/:api_key', utils.rateLimit(), form);
  app.post(prefix + '/form/:api_key', utils.rateLimit(), form);
  //app.get(prefix + '/test/stats/:api_key', test_stats);
};
