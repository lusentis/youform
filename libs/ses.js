'use strict';

module.exports = function () {
  // npm dependencies
  let AWS = require('aws-sdk'),
      moment = require('moment'),
      thenJade = require('then-jade');
  // locals dependencies
  let utils = require('./utils')();
  let regex = require('./regex');

  // load AWS SES
  let SES = new AWS.SES();
  let coSES = utils.wrap(SES);


  let _send = function* (to, subject, body, replyTo) {
    replyTo = Array.isArray(replyTo) ? replyTo : []; // default values

    yield coSES.sendEmail({ 
      Source: 'Your Contact Form <noreply@youform.me>',
      Destination: {
        ToAddresses: to,
      },
      ReplyToAddresses: replyTo,
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


  let _send_form = function* (form, data) {
    let body = yield thenJade.renderFile('./views/email/email.jade',  { form: form, user_form: data, date: moment().format('D MMMM YYYY') });
    let replyto = [];
    if (regex.email(data[form.replyto_field])) {
      replyto.push(data[form.replyto_field]);
    }
    yield _send([ form.form_destination ], form.form_subject, body, replyto);
  };


  return {
    confirm: _send_confirm,
    info: _send_info,
    thanks: _send_thanks,
    form: _send_form
  };
};