/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var coolog = require('coolog')
    , logger = coolog.logger('form_utils.js')
    , save_form
    , get_form
    , delete_form
    ;

  save_form = function (form, api_key, callback) {
    if (api_key === null) {
      api_key = undefined;
    }
    form.action = 'update';
    db.atomic('youform', 'forms', api_key, form, function (err, body) {
      if (err) {
        callback(err);
      } else {
        logger.ok({
          api_key: api_key
        , message: 'form saved'
        });
        callback(null, body);
      }
    });
  };

  get_form = function (api_key, callback) {
    db.get(api_key, {include_docs: true}, function (err, body) {
      if (err && err.status_code === 404) {
        logger.info({
          api_key: api_key
        , message: 'form not found'
        });
        body = null;
        err = null;
      }
      callback(err, body);
    });
  };

  delete_form = function (form, callback) {
    var data = {
      action: 'delete'
    };
    db.atomic('youform', 'forms', form._id, data, function (err) {
      if (err) {
        throw err;
      } else {
        logger.ok({
          api_key: form._id
        , message: 'form deleted'
        });
        callback(null, true);
      }
    });
  };
 
  return {
    'save_form': save_form
  , 'get_form': get_form
  , 'delete_form': delete_form
  };
};