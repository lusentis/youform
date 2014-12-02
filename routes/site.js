
'use strict';

module.exports = function (db) {

  // npm dependencies
  let coolog = require('coolog'),
      moment = require('moment'),
      path = require('path');
  // locals dependencies
  let Form = require('./Form.js'),
      error_utils = require('../utils/error_utils.js')(),
      form_utils = require('../utils/form_utils.js')(db),
      log_utils = require('../utils/log_utils.js')(db);

  let logger = coolog.logger(path.basename(__filename));

  let _index = function* () {
    this.body = yield this.render('index');
  };


  let _form = {
    signup: function* () {
      this.body = yield this.render('signup', { action: 'create', form: new Form() });
    },
    success: function* () {
      let api_key = this.params.api_key,
          token = this.query.token,
          form_data = null;

      try {
        form_data = yield form_utils.get_form(api_key);
        
        if (form_data.token !== token) {
          error_utils.params_error({api_key: api_key, token: token}, this);
          return;
        }

        if (!form_data.confirmed) {
          this.body = yield this.render('success', {form: form_data});
          return;
        }

        this.redirect('/dashboard/' + form_data._id + '?token=' + form_data.token);
      } catch (err) {
        error_utils.params_error({api_key: api_key, token: token}, this);
      }
    },
    del: function*() {
      var api_key = this.params.api_key,
          token = this.query.token;

      try {
        let form_data = yield form_utils.get_form(api_key);

        if (form_data.token !== token) {
          error_utils.params_error({api_key: api_key, token: token}, this);
          return;
        }

        this.body = yield this.render('delete', { form: form_data });
      } catch (err) {
        error_utils.params_error({api_key: api_key, token: token}, this);
      }
    },
    deleted: function*() {
      this.body = yield this.render('deleted');
    },
    edit: function*() {
      var api_key = this.params.api_key,
          token = this.query.token;

      try {
        let form_data = yield form_utils.get_form(api_key);

        if (form_data.token !== token) {
          error_utils.params_error({api_key: api_key, token: token}, this);
          return;
        }

        this.body = yield this.render('signup', { form: form_data, action: 'edit' });
      } catch (err) {
        error_utils.params_error({api_key: api_key, token: token}, this);
        return;
      }
    }
  };


  let dashboard = function* () {
    let api_key = this.params.api_key,
        token = this.query.token;

    try {
      let form_data = yield form_utils.get_form(api_key);

      if (form_data.token !== token) {
        error_utils.params_error({api_key: api_key, token: token}, this);
        return;
      }

      let graph = yield log_utils.get_graph(api_key);
      
      // let form_saved = this.flash.form_saved.length > 0;
      // let form_save_error = this.flash.form_save_error.length > 0;
      form_data.created_at = moment(form_data.created_at).format('YYYY-MM-DD');

      this.body = yield this.render('dashboard', {
        form: form_data,
        graph: JSON.stringify(graph),
        form_saved: true,//form_saved
        form_save_error: false// form_save_error
      });

      if (!form_data.confirmed) {
        this.redirect('/success/' + form_data._id + '?token=' + form_data.token);
        return;
      }

    } catch (err) {
      error_utils.params_error({api_key: api_key, token: token}, this);
      return;
    }
  };

  var confirmed_email = function* () {
    var api_key = this.params.api_key, 
        token = this.query.token;

    try {
      let form_data = yield form_utils.get_form(api_key);
      if (form_data.token !== token) {
        error_utils.params_error({api_key: api_key, token: token}, this, 'token error');
        return;
      }
      if (!form_data.email_confirmed) {
        this.redirect('/');
        return;
      }
      this.body = yield this.render('confirmed_email', {form: form_data});

    } catch (err) {
      error_utils.params_error({api_key: api_key, token: token}, this);
      return;
    }
  };


  return {
    'index': _index,
    'form': _form,
    'dashboard': dashboard,
    'confirmed_email': confirmed_email
  };
};