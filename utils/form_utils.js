/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var save_form
    , get_form
    ;

  save_form = function (form, callback) {
    db.atomic('youform', 'forms', undefined, form, function (err, body) {
      callback(err, body);
    });
  };

  get_form = function (form_id, callback) {
    db.get(form_id, { include_docs: true }, function (err, body) {
      if (err && err.status_code === 404) {
        body = null;
        err = null;
      }
      callback(err, body);
    });
  };
 
  return {
    'save_form': save_form,
    'get_form': get_form
  };
};