'use strict';


module.exports = function (db, redis_client) {

  // npm dependencies
  let coolog = require('coolog')
    , mime = require('mime')
    , inflection = require('inflection')
    , uuid = require('node-uuid')
    , path = require('path')
    , comm_utils = require('../utils/comm_utils.js')()
    , error_utils = require('../utils/error_utils.js')()
    , form_utils = require('../utils/form_utils.js')(db)
    , log_utils = require('../utils/log_utils.js')(db)
    , utils = require('../utils/utils.js')(redis_client)
    , Form = require('./Form.js')
    , regex = require('./regex')
    ;

  // locals dependencies
  let formDB = require('../db/form')(db),
      ses = require('../libs/ses')(),
      sms = require('../libs/sms')();
  
  let logger = coolog.logger(path.basename(__filename));

  let test_email = function (email) {
    return regex.email.test(email) && email.length < 100;
  };

  let _form = {
    create: function* () {

      let body = this.request.body;
      let data = new Form();
      data.id = uuid.v4();
      data.token = uuid.v4();
      data.code = uuid.v4().replace(/-/).substring(0, 6).toUpperCase();
      data.form_name = body['f-name'];
      data.website_url = body['w-url'].toLowerCase();
      data.website_success_page = body['w-success-page'].toLowerCase();
      data.form_subject = body['f-subject'];
      data.form_intro = body['f-intro'];
      data.form_destination = body['email-dest'];
      data.form_destination_not_confirmed = body['email-dest'];
      data.creator_email = body['email-crt'].toLowerCase();
      data.colours = body.colours.trim();
      data.country_code = body['country-code'].trim().replace(/\+/g, '');
      data.phone = body.phone.trim().replace(/[\-]/g, '');
      data.replyto_field = body['replyto-field'].trim();      

      if (data.form_subject.isBlank() || data.form_intro.isBlank() || data.form_name.isBlank() || !regex.colours.test(data.colours)) {
        this.flash.param_error =  true;
        this.redirect('/signup');
        return;
      }

      if (!test_email(data.creator_email) || !test_email(data.form_destination)) {
        this.flash('email_error', true);
        this.redirect('/signup');
        return;
      }
      if (!regex.phone.test(data.phone) || !regex.country_code.test(data.country_code)) {
        this.flash.phone_error = true;
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

          //yield comm_utils.send_sms(data);
          logger.info('SMS sent');
        } catch (err) {
          logger.error('Error sending sms', err);
        }
      }
      
      this.redirect('/success/' + form_saved.id + '?token=' + form_saved.token);
    },
    get: function* () {

      var api_key = this.params.api_key;

      if (!api_key) {
        error_utils.params({api_key: api_key}, this);
        return;
      }

      let form_data =  yield form_utils.get_form(api_key);
      
      if (!form_data) {
        // todo: handle not found
        // error_utils.not_found(api_key, req, res);
        return;
      }

      if (!utils.check_origin(this.request, form_data)) {
        logger.error({
          error: true
        , form_id: api_key
        , description: 'origin error'
        });
        this.flash('origin_error', true);
        this.redirect('/error');
        return;
      }

      if (form_data.deleted) {
        this.status = 403;
        this.body = {
          error: true
        , description: 'not found.'
        };
        return;
      }
      if (!form_data.confirmed) {
        // deleted
        logger.error({
          error: true
        , form_id: api_key
        , description: 'not found'
        });
        this.status = 403;
        this.body = {
          error: true
        , description: 'not found'
        };
        return;
      }

      let spam = yield utils.spam_filter(req, res);
      
      // save connection
      let data = {
        user_ip: this.request.connection.remoteAddress
      , api_key: api_key
      , spam: spam
      };

      yield log_utils.save_log(data);
      
      if (spam) {
        logger.info('Redirect to 500 page');
        this.redirect('/500');
      }

      let user_form = {}
        , files = {}
        ;
      
      // parse form data
      Object.keys(this.request.body).forEach(function (key) {
        user_form[inflection.humanize(key)] = req.body[key];
      });

      if (this.request.files !== undefined) {
        Object.keys(this.request.files).forEach(function(key) {
          // check MIME type
          user_form = Object.reject(user_form, key);
          if (/(doc|docx|pdf|jpg|jpeg|png|gif)/.test(mime.extension(mime.lookup(req.files[key].path)))) {
            files[key] = this.request.files[key];
          }
        });
      }
      try {
        yield comm_utils.send_form(form_data, user_form, files, res);
        logger.info('Redirect to', form_data.website_success_page);
        let url = regex.url.test(form_data.website_success_page) ? form_data.website_success_page : form_data.website_url;
        res.redirect(url);
      } catch (err) {
        logger.error('Postmark error', err);
        logger.info('Redirect to 500 page');
        this.redirect('/500');
      }
    },
    del: function* () {
      var api_key = this.param.api_key
        , token = this.request.body.token
        ;
      
      if (!api_key || !token) {
        error_utils.params({api_key: api_key, token: token}, req, res);
        return;
      }

      let form_data = null;
      try {
        form_data = yield db.get(api_key, { include_docs: true });
      } catch (err) {
        error_utils.not_found(api_key, req, res);
        return;
      }

      if (form_data.token !== token) {
        error_utils.params({api_key: api_key, token: token}, req, res, 'token error');
        return;
      }

     yield form_utils.delete_form(form_data);
     this.flash.form_deleted =  true;
     this.redirect('/deleted');
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
        replyto_field: body['replyto-field']
      };

      if (!test_email(data.creator_email) || !test_email(data.form_destination)) {
        this.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      if (!regex.phone.test(data.phone.trim()) || !regex.country_code.test(data.country_code.trim())) {
        this.redirect('/edit/' + api_key + '?token=' + token);
        return;
      }

      try {
        let form_data = yield formDB.get(api_key);

        if (form_data.token !== token) {
          // do something
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

    if (!regex.email.test(email)) {
      error_utils.params({api_key: api_key, token: token, email: email}, this);
      return;
    }

    try {
      let form = yield formDB.get(api_key);

      if (form.token !== token) {
        // fix here
        this.redirect('/');
      }


      if (email === form.form_destination_not_confirmed && form.email_confirmed === false) {
        
        form.form_destination = form.form_destination_not_confirmed;
        form.form_destination_not_confirmed = null;
        form.email_confirmed = true;
        if (form.phone_confirmed) {
          form.confirmed = true;
        }
        logger.debug(form);
        yield formDB.save(form.id, form);

        if (form.confirmed) {
          yield sms.info(form);
        }
        this.redirect('/confirm/email/confirmed/' + form.id + '?token=' + token);
      }

      this.redirect('/confirm/email/confirmed/' + form.id + '?token=' + token);
    } catch (err) {
      logger.error(err);
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };

  var _confirm_sms = function* () {
    var api_key = this.params.api_key,
       token = this.request.body.token,
        code = this.request.body.code;

    if (!code) {
      error_utils.params({api_key: api_key, token: token, code: code}, this);
      return;
    }

    code = code.toUpperCase();

    try {
      let form = yield formDB.get(api_key);
      if (form.token !== token || form.phone_confirmed) {
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


  var _resend_email = function* () {
    var api_key = this.params.api_key,
        token = this.query.token;

    try {
      let form = yield formDB.get(api_key);
      yield ses.confirm(form);
      this.redirect('/dashboard/' + form.id + '?token=' + form.token);
    } catch (err) {
      error_utils.params({api_key: api_key, token: token}, this);
    }
  };


  var _send_confirm_sms = function* () {
    var api_key = this.params.api_key,
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


  return {
    form: _form,
    confirm_sms: _confirm_sms,
    send_confirm_sms: _send_confirm_sms,
    send_confirm_email: _resend_email,
    confirm_email: _confirm_email
  };
};