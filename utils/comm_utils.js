/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  // npm dependencies
  let coolog = require('coolog'),
      fs = require('fs'),
      mime = require('mime'),
      moment = require('moment'),
      querystring = require('querystring'),
      request = require('co-request'),
      path = require('path');
  // locals dependencies
  let regex = require('../routes/regex');

  let logger = coolog.logger(path.basename(__filename));


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
          var replyto = regex.email.test(post_data[form.replyto_field]) ? post_data[form.replyto_field] : '';
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
    let obj = {
      'username': process.env.HQ_USERNAME,
      'password': process.env.HQ_PASSWORD,
      'to': form.country_code + '' + form.phone,
      'from': process.env.HQ_SENDER,
      'message': 'Hi, your confirmation code is: ' + form.code + '. Thank you!'
    };

    let data = querystring.stringify(obj);

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
    'send_form': send_form,
    'send_sms': send_sms
  };
};