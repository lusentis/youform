/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  var coolog = require('coolog')
    , fs = require('fs')
    , mime = require('mime')
    , moment = require('moment')
    , thunkify = require('thunkify')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    , querystring = require('querystring')
    , thenJade = require('then-jade')
    , request = require('co-request')
    , email_regex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9\-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/
    ;

  let sendEmail = thunkify(postmark.send);
  let logger = coolog.logger('comm_utils.js');

  let send_confirm_email = function* (form) {
    let html_body = yield thenJade.renderFile('./views/email/confirm.jade', {form: form});
    try {
      let result = yield sendEmail({
        'From': process.env.POSTMARK_FROM
      , 'To': form.form_destination_not_confirmed
      , 'Subject': 'YouForm - Email address confirmation'
      , 'HtmlBody': html_body
      });
    } catch (err) {
      console.log(err);
    }
  };

  var send_form_info = function* (form) {
   let html_body = yield thenJade.renderFile('./views/email/config.jade', {form: form});
   try {
    let result = yield sendEmail({
       'From': process.env.POSTMARK_FROM
     , 'To': form.creator_email
     , 'Subject': 'YouForm - Details for ' + form.form_name
     , 'HtmlBody': html_body
     });
    } catch (err) {
      throw err;
    }
  };

  var _send_thanks = function* (form) {
    let result = null;
    let html_body = yield thenJade.renderFile('./views/email/thanks.jade', { form: form });
    try {
      result = yield sendEmail({
        'From': process.env.POSTMARK_FROM
      , 'To': form.creator_email
      , 'Subject': 'YouForm - Welcome!'
      , 'HtmlBody': html_body
      });
    } catch (err) {
      throw err;
    }
    return result;
  };

  var send_form = function* (form, post_data, files) {
    async.waterfall([
        function (next) {
          var attachments = [];

          if (Object.size(files) === 0) {
            next(null, attachments);
            return;
          }
          async.each(Object.keys(files),
            function (key, cb) {
              var file = files[key];
              fs.readFile(file.path, function (err, data) {
                if (err) {
                  cb(err);
                } else {
                  attachments.push({
                    'Content': data.toString('base64')
                  , 'Name': file.name
                  , 'ContentType': mime.lookup(file.path)
                  });
                  cb(null);
                }
              });
            },
            function (err) {
              if (err) {
                next(err);
              } else {
                // end
                logger.debug('end attach');
                next(null, attachments.to(1));
              }
            });
        },
        function (attachments, next) {
          // render email template
          var date = moment().format('D MMMM YYYY');

          res.render('email/email', { form: form, user_form: post_data, date: date }, function (err, body) {
            if (err) {
              next(err);
            } else {
              next(null, body, attachments);
            }
          });
        },
        function (html_body, attachments) {
          // send email
          var replyto = email_regex.test(post_data[form.replyto_field]) ? post_data[form.replyto_field] : '';
          postmark.send({
            'From': process.env.POSTMARK_FROM
          , 'To': form.form_destination
          , 'ReplyTo': replyto
          , 'Subject': form.form_subject
          , 'HtmlBody': html_body
          , 'Attachments': attachments
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

  let send_sms = function* (form) {

    let hq_response = null;
    let data = querystring.stringify({
      'username': process.env.HQ_USERNAME
    , 'password': process.env.HQ_PASSWORD
    , 'to': form.country_code + '' + form.phone
    , 'from': process.env.HQ_SENDER
    , 'message': 'Hi, your confirmation code is: ' + form.code + '. Thank you!'
    });

    try {
      hq_response = yield request({
        uri: 'https://ssl.hqsms.com/sms.do',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': data.length
        },
        body: data
      });
    } catch (err) {
      throw err;
    }

    if (hq_response.body.has('ERROR')) {
      throw new Error(hq_response.body.has('ERROR'));
    }

    return hq_response;
  };

  return {
    'send_form': send_form
  , 'send_form_info': send_form_info
  , 'send_thanks': _send_thanks
  , 'send_confirm_email': send_confirm_email
  , 'send_sms': send_sms
  };
};