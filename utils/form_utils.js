/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var async = require('async')
    , coolog = require('coolog')
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
      callback(err, body);
    });
  };

  get_form = function (form_id, callback) {
    db.get(form_id, {include_docs: true}, function (err, body) {
      if (err && err.status_code === 404) {
        body = null;
        err = null;
      }
      callback(err, body);
    });
  };

  delete_form = function (api_key, token, callback) {
    async.waterfall([
        function (next) {
          db.get(api_key, { include_docs: true }, function (err, form) {
            if (err) {
              // form not found
              if (err.status_code === 404) {
                logger.info('Form not found');
                callback(null, false);
              } else {
                callback(err);
              }
            } else {
              // check token
              if (form.token !== token) {
                logger.info('Token error');
                callback(null, false);
              } else {
                next(null, form);
              }
            }
          });
        },
        function (form, next) {
          var data = {
            'action': 'delete'
          };
          data.action = 'update';
          db.atomic('youform', 'forms', api_key, data, function (err) {
            if (err) {
              next(err);
            } else {
              callback(null, true);
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
    'save_form': save_form
  , 'get_form': get_form
  , 'delete_form': delete_form
  };
};