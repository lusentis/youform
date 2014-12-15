'use strict';


module.exports = function (db, redis_client) {

  // npm dependencies
  let coolog = require('coolog'),
    //mime = require('mime'),
    inflection = require('inflection'),
    uuid = require('node-uuid'),
    path = require('path'),
    error_utils = require('../utils/error_utils.js')(),
    utils = require('../utils/utils.js')(redis_client),
    Form = require('../db/models/Form'),
    regex = require('../libs/regex');

  // locals dependencies
  let formDB = require('../db/form')(db),
      logDB = require('../db/log')(db),
      ses = require('../libs/ses')(),
      sms = require('../libs/sms')(),
      security = require('../libs/security')();
  
  let logger = coolog.logger(path.basename(__filename));


  let _form = {
    create: function* () {
      let body = this.request.body;
      let data = Form.default;
      data.id = uuid.v4();
      data.token = uuid.v4();
      data.code = uuid.v4().replace(/-/).substring(0, 6).toUpperCase();
      data.form_name = body['f-name'];
      data.website_url = body['w-url'].toLowerCase();
      data.website_success_page = body['w-success-page'].toLowerCase();
      data.form_subject = body['f-subject'];
      data.form_intro = body['f-intro'];
      data.form_destination = body['email-dest'].toLowerCase();
      data.form_destination_not_confirmed = body['email-dest'].toLowerCase();
      data.creator_email = body['email-crt'].toLowerCase();
      data.colours = body.colours.trim();
      data.country_code = body['country-code'].trim().replace(/\+/g, '');
      data.phone = body.phone.trim().replace(/[\-]/g, '');
      data.replyto_field = body['replyto-field'].trim();

      if (data.form_subject.isBlank() || data.form_intro.isBlank() || data.form_name.isBlank() || !regex.colours(data.colours)) {
        this.redirect('/signup');
        return;
      }

      console.log(regex.email(data.creator_email));
      console.log(regex.email(data.form_destination));

      if (!regex.email(data.creator_email) || !regex.email(data.form_destination)) {
        this.redirect('/signup');
        return;
      }
      if (!regex.phone(data.phone) || !regex.country_code(data.country_code)) {
        this.redirect('/signup');
        return;
      }

      let form_saved = null;
      try {
        yield formDB.save(data.id, data);
        form_saved = yield formDB.get(data.id);
        logger.info('form saved', form_saved);
      } catch (err) {
        logger.error('Error saving form', err);
      }
      if (form_saved) {
        // send thanks email
        try {
          let email_response = yield ses.thanks(data);
          logger.info('Email sent', email_response);
        } catch (err) {
          logger.error('Error sending thanks email', err);
        }
        // send confirm email
        try {
          let email_response = yield ses.confirm(data);
          logger.info('Email sent', email_response);
        } catch (err) {
          logger.error('Error sending thanks email', err);
        }
        // send SMS
        try {
          yield sms.send(data);
          logger.info('SMS sent');
        } catch (err) {
          logger.error('Error sending sms', err);
        }
      }
      
      this.redirect('/success/' + form_saved.id + '?token=' + form_saved.token);
    },
    get: function* () {

      let json = true; // todo: implement routing for JSON response
      let api_key = this.params.api_key;
      let form;

      if (!api_key) {
        error_utils.params({api_key: api_key}, this);
        return;
      }

      try {
        form =  yield formDB.get(api_key);  
      } catch (err) {
        // todo: handle form not found
        throw err;
      }
      
      
      if (!form) {
        // todo: handle not found
        // error_utils.not_found(api_key, req, res);
        return;
      }


      if (!security.origin(this.request, form.website_url)) {
        // todo: handle origin error 
        return;
      }


      if (form.deleted) {
        // todo: handle form deleted 

        // this.status = 403;
        // this.body = {
        //   error: true
        // , description: 'not found'
        // };
        return;
      }
      if (!form.confirmed) {
        // todo: handle not confirmed

        // logger.error({
        //   error: true
        // , form_id: api_key
        // , description: 'not found'
        // });
        // this.status = 403;
        // this.body = {
        //   error: true
        // , description: 'not found'
        // };
        return;
      }

      // check spam with akismet
      let isSpam = yield security.akismet(this.ip, this.request);
      
      // save connection
      let data = {
        userId: api_key,
        id: uuid.v4(),
        user_ip: this.request.socket.remoteAddress,
        spam: isSpam,
        created_at: new Date().toUTCString()
      };

      console.log(data);

      yield logDB.save(api_key, data);
      
      if (isSpam) {
        logger.error('Spam message');
        
        if (json) {
          this.body = {status: "error"};
        } else {
          this.redirect('/500');  
        }
      }

      let user_form = {};
      //let files = {};
      
      // parse form data
      Object.keys(this.request.body).forEach(function (key) {
        user_form[inflection.humanize(key)] = this.request.body[key];
      });

      // if (this.request.files !== undefined) {
      //   Object.keys(this.request.files).forEach(function(key) {
      //     // check MIME type
      //     user_form = Object.reject(user_form, key);
      //     if (/(doc|docx|pdf|jpg|jpeg|png|gif)/.test(mime.extension(mime.lookup(req.files[key].path)))) {
      //       files[key] = this.request.files[key];
      //     }
      //   });
      // }
      try {
        // send email 
        yield ses.form(form, user_form);
        logger.info('Redirect to', form.website_success_page);
        let url = regex.url(form.website_success_page) ? form.website_success_page : form.website_url;

        if (json) {
          this.body = {
            status: 'ok'
          };
        } else {
          this.redirect(url);
        }
      } catch (err) {
        logger.error('SES error', err);
        if (json) {
          this.body = {status: 'error'};
        } else {
          this.redirect('/500');
        }
      }
    },
    del: function* () {
      let api_key = this.params.api_key,
          token = this.request.body.token;
      

      let form_data = null;
      try {
        form_data = yield formDB.get(api_key);
        if (form_data.token !== token) {
          error_utils.token(api_key, token, this);
          return;
        }

       yield formDB.del(api_key);
       this.redirect('/deleted');
      } catch (err) {
        logger.error(err);
        error_utils.not_found(api_key, this);
        return;
      }
    },
    edit: function* () {
      let api_key = this.params.api_key,
          body = this.request.body,
          token = body.token;

      let email = body['email-dest'];
      let data = {
        form_name: body['f-name'],
        website_url: body['w-url'],
        website_success_page: body['w-success-page'],
        form_subject: body['f-subject'],
        form_intro: body['f-intro'],
        form_destination: body['email-dest'],
        creator_email: body['email-crt'],
        colours: body.colours,
        country_code: body['country-code'].trim().replace(/\+/g, ''),
        phone: body.phone.trim().replace(/[\-]/g, ''),
        replyto_field: body['replyto-field'] || ''
      };

      if (!regex.email(data.creator_email) || !regex.email(data.form_destination)) {
        this.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      if (!regex.phone(data.phone.trim()) || !regex.country_code(data.country_code)) {
        this.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      try {
        let form_data = yield formDB.get(api_key);

        // form mismatch
        if (form_data.token !== token) {
          error_utils.token(api_key, token, this);
        }

        let change_email = (email.trim() !== form_data.form_destination);
        if (change_email) {
          form_data.confirmed = false;
          form_data.email_confirmed = false;
          form_data.form_destination_not_confirmed = email;
        }

        yield formDB.save(form_data.id, data);

        if (change_email) {
          let new_form = yield formDB.get(form_data.id);
          yield ses.confirm(new_form);
        }

        this.redirect('/dashboard/' + form_data.id + '?token=' + form_data.token);
      } catch (err) {
        logger.error(err);
        this.redirect('/edit/' + api_key + '?token=' + token);
      }
    }
  };
  let _confirm_email = function* () {
    let api_key = this.params.api_key,
        email = this.query.email,
        token = this.query.token;

    if (!regex.email(email)) {
      error_utils.params({api_key: api_key, token: token, email: email}, this);
      return;
    }

    try {
      let form = yield formDB.get(api_key);

      if (form.token !== token) {
        // fix here
        error_utils.token(api_key, token, this);
      }

      if (email === form.form_destination_not_confirmed && form.email_confirmed === false) {
        
        form.form_destination = form.form_destination_not_confirmed;
        form.form_destination_not_confirmed = null;
        form.email_confirmed = true;
        if (form.phone_confirmed) {
          form.confirmed = true;
        }
        yield formDB.save(form.id, form);

        if (form.confirmed) {
          logger.info('Sending email');
          yield ses.info(form);

          // todo: fix missing id
        }
        this.redirect('/confirm/email/confirmed/' + form.id + '?token=' + token);
      }

      this.redirect('/confirm/email/confirmed/' + form.id + '?token=' + token);
    } catch(err) {
      logger.error(err);
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };

  let _confirm_sms = function* () {
    let api_key = this.params.api_key,
       token = this.request.body.token,
        code = this.request.body.code;

    if (!code) {
      error_utils.params({api_key: api_key, token: token, code: code}, this);
      return;
    }

    code = code.toUpperCase();

    try {
      let form = yield formDB.get(api_key);

      // token mismatch
      if (form.token !== token) {
        error_utils.token(api_key, token, this);
        return;
      }

      // phone already confirmed
      if (form.phone_confirmed) {
        this.redirect('/dashboard/' + form.id + '?token=' + form.token);
        return;
      }

      if (form.code !== code) {
        this.redirect('/success/' + form.id + '?token=' + token);
        return; 
      }

      
      form.phone_confirmed = true;
      form.confirmed = (form.email_confirmed === true && form.phone_confirmed === true);
      yield formDB.save(form.id, form);

      if (form.confirmed) {
        yield ses.info(form);
      }

      this.redirect('/success/' + form.id + '?token=' + token);
    } catch (err) {
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };


  let _resend_email = function* () {
    let api_key = this.params.api_key,
        token = this.query.token;

    try {
      let form = yield formDB.get(api_key);
      yield ses.confirm(form);
      this.redirect('/dashboard/' + form.id + '?token=' + form.token);
    } catch (err) {
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };


  let _send_confirm_sms = function* () {
    let api_key = this.params.api_key,
        token = this.query.token;

    try {
      let form = yield formDB.get(api_key);
      if (form.confirmed_phone) {
        this.redirect('/');
        return;
      }
      // todo: limit sms
      yield sms.send(form);
      this.redirect('/dashboard/' + form.id + '?token=' + form.token);
    } catch (err) {
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };


  let _graph = function* () {
    let api_key = this.params.api_key,
        token = this.query.token;

    try {
      let graph = yield logDB.get(api_key);
      this.body = {
        status: 'ok',
        data: graph
      };
    } catch (err) {
      logger.error(err);
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };


  return {
    form: _form,
    confirm_sms: _confirm_sms,
    send_confirm_sms: _send_confirm_sms,
    send_confirm_email: _resend_email,
    confirm_email: _confirm_email,
    graph: _graph
  };
};