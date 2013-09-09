/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, redis, prefix) {

  var async = require('async')
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , utils = require('../utils/utils.js')(redis)
    , coolog = require('coolog')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    ;

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
            res.redirect(form.website_success_page);
          } else {
            res.redirect(form.website_error_page);
          }
        });
      }
    ], function (err) {
      if (err) {
        throw err;
      }
    });
  };

  // @FIXME
  var stats = function (api_key, callback) {
    log_utils.get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        var counter;
        result.rows.forEach(function (row) {
          if (!Object.has(counter[row.date.year], row.date.mounth)) {
            counter[row.date.year][row.date.mounth] = 0;
          }
          counter[row.date.year][row.date.mounth] += 1;
        });
        callback(null, {
          rows: result.rows
        , total_rows: result.rows
        , counter: counter
        });
      }
    });
  };

  var check_origin = function (req, form) {
    var origin = req.headers.origin;
    logger.debug('origin', origin);
    return (origin.has(form.website_url));
  };

  // routes
  app.post(prefix + '/new-form', new_form);
  //app.get(prefix + '/form/:api_key', utils.rateLimit(), form);
  app.post(prefix + '/form/:api_key', utils.rateLimit(), form);
};
