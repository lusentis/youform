/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, redis, prefix) {

  var async = require('async')
    , form_utils = require('../utils/form_utils.js')(db)
    , utils = require('../utils/utils.js')(redis)
    , coolog = require('coolog')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    ;

  var logger = coolog.logger('api.js');

  var new_form = function (req, res) {
    var form;
    var data = {
      website_name: req.body['w-name']
    , website_url: req.body['w-url']
    , website_success_page: req.body['w-success-page']
    , website_error_page: req.body['w-error-page']
    , form_subject: req.body['f-subject']
    , form_intro: req.body['f-intro']
    , form_destination: req.body['email-dest']
    , creator_email: req.body['email-crt']
    , sender_name: req.body['snd-name']
    , sender_email: req.body['snd-email']
    };

    async.waterfall([
        function (next) {
          form_utils.save_form(data, function (err, form) {
            if (err) {
              next(err);
            } else {
              logger.ok('saved form', form);
              next(null);
            }
          });
        },
        function (next) {
          res.redirect('/success');
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var form = function (req, res) {
    var form_id = req.param('id', null);
    logger.info(form_id);
    var data;
    async.waterfall([
      function (next) {
        form_utils.get_form(form_id, function (err, result) {
          if (!result) {
            logger.error({
              error: true
            , form_id: form_id
            , description: 'Form not found'
            });
            res.json({
              error: true
            , description: 'Form not found. Check your API key'
            });
          } else {
            data = result;
            logger.debug('results', data);
            next(null);
          }
        });
      },
      function (next) {
        res.render('email/email', { intro: data.form_intro, form: req.body }, function (err, body) {
          next(null, body);
        });
      },
      function (html_body, next) {
        postmark.send({
          'From': 'hello@plasticpanda.com'
        , 'To': data.form_destination
        , 'Subject': data.form_subject
        , 'HtmlBody': html_body
        });
        res.redirect(data.website_success_page);
      }
    ], function (err) {
      if (err) {
        throw err;
      }
    });
  };

  // routes
  app.post(prefix + '/new-form', new_form);
  app.get(prefix + '/form/:id', utils.rateLimit(), form);
};
