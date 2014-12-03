'use strict';

module.exports = function () {
   let AWS = require('aws-sdk'),
      thenJade = require('then-jade');
  // locals dependencies
  let utils = require('./utils')();

  // load AWS SES
  let SES = new AWS.SES();
  let coSES = utils.wrap(SES);


  let _send = function* (to, subject, body) {
    yield coSES.sendEmail({ 
       Source: 'Your Contact Form <noreply@youform.me>',
       Destination: {
        ToAddresses: to, 
      },
       Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: body }
        }
       }
    });
  };


  let _send_confirm = function* (form) {
    let body = yield thenJade.renderFile('./views/email/confirm.jade', {form: form});
    yield _send([ form.form_destination_not_confirmed ], 'YouForm - Email address confirmation', body);
  };


  let _send_info = function* (form) {
    let body = yield thenJade.renderFile('./views/email/config.jade', {form: form});
    yield _send([ form.creator_email ], 'YouForm - Details for ' + form.form_name, body);
  };


  let _send_thanks = function* (form) {
    let body = yield thenJade.renderFile('./views/email/thanks.jade', { form: form });
    yield _send([ form.creator_email ],  'YouForm - Welcome!', body);
  };


  return {
    confirm: _send_confirm,
    info: _send_info,
    thanks: _send_thanks
  };
};