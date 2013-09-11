/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  var async = require('async')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    , coolog = require('coolog')
    ;

  var logger = coolog.logger('email_utils.js');

  var send_confirm_email = function (form, res, callback) {
    async.waterfall([
        function (next) {
          // render email template
          logger.info(form);
          res.render('email/confirm', {form: form}, function (err, body) {
            if (err) {
              next(err);
            } else {
              next(null, body);
            }
          });
        },
        function (html_body) {
          // send email
          postmark.send({
            'From': process.env.POSTMARK_FROM
          , 'To': form.form_destination
          , 'Subject': 'Youform: confirm your email address'
          , 'HtmlBody': html_body
          }, function (err) {
            if (err) {
              logger.error('Postmark error', err);
              callback(err);
            } else {
              callback(null);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var send_form_info = function (form, res, callback) {
    async.waterfall([
        function (next) {
          // render email template
          res.render('email/signup', { form: form }, function (err, body) {
            if (err) {
              next(err);
            } else {
              next(null, body);
            }
          });
        },
        function (html_body) {
          // send email
          postmark.send({
            'From': process.env.POSTMARK_FROM
          , 'To': form.creator_email
          , 'Subject': 'Signup youform: ' + form.form_name
          , 'HtmlBody': html_body
          }, function (err) {
            if (err) {
              logger.error('Postmark error', err);
              callback(err);
            } else {
              callback(null);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  var send_form = function (form, post_data, res, callback) {
    async.waterfall([
        function (next) {
          // render email template
          res.render('email/email', { intro: form.form_intro, form: post_data }, function (err, body) {
            if (err) {
              next(err);
            } else {
              next(null, form, body);
            }
          });
        },
        function (html_body) {
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
              callback(err);
            } else {
              callback(null);
            }
          });
        }
      ], function (err) {
        if (err) {
          throw err;
        }
      });
  };

  return {
    'send_form': send_form
  , 'send_form_info': send_form_info
  , 'send_confirm_email': send_confirm_email
  };
};