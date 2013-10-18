/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  var async = require('async')
    , coolog = require('coolog')
    , fs = require('fs')
    , https = require('https')
    , mime = require('mime')
    , moment = require('moment')
    , postmark = require('postmark')(process.env.POSTMARK_API_KEY)
    , querystring = require('querystring')
    , email_regex = /^(?:[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9\-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/
    ;

  var logger = coolog.logger('comm_utils.js');

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
          , 'To': form.form_destination_not_confirmed
          , 'Subject': 'YouForm.me - Email address confirmation'
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
          res.render('email/config', { form: form }, function (err, body) {
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
          , 'Subject': 'YouForm - Signup confirmation'
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

  var send_thanks = function (form, res, callback) {
    async.waterfall([
        function (next) {
          // render email template
          res.render('email/thanks', { form: form }, function (err, body) {
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
          , 'Subject': 'YouForm - Your form details' + form.form_name
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

  var send_form = function (form, post_data, files, res, callback) {
    logger.debug('send form');
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
          logger.debug('here');
          return;

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

  var send_sms = function (form, callback) {
    var message = 'Hi, your confirmation code is: ' + form.code + '. Thank you!'
      , response = ''
      , data
      , post_options
      ;
    data = querystring.stringify({
      'username': process.env.HQ_USERNAME
    , 'password': process.env.HQ_PASSWORD
    , 'to': form.country_code + '' + form.phone
    , 'from': process.env.HQ_SENDER
    , 'message': message
    });
    post_options = {
      host: 'ssl.hqsms.com',
      port: '443',
      path: '/sms.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': data.length
      }
    };
    var hq_request = https.request(post_options, function (res) {
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        response += chunk;
      });
      res.on('end', function () {
        logger.ok('HQSMS response', response);
        callback(response.has('ERROR'));
      });
    });
    hq_request.write(data);
    hq_request.end();
  };

  return {
    'send_form': send_form
  , 'send_form_info': send_form_info
  , 'send_thanks': send_thanks
  , 'send_confirm_email': send_confirm_email
  , 'send_sms': send_sms
  };
};