/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';



module.exports = function (db) {
  
  var uuid = require('node-uuid')
    , generate_api_key
    , save_form
    , get_form
    ;

  generate_api_key = function () {
    return uuid.v4();
  };

  save_form = function (form, callback) {
    db.atomic('youform', 'forms', undefined, form, function (err, body) {
      callback(err, body);
    });
  };

  get_form = function (form_id, callback) {
    console.log(db);
    db.view('youform', 'forms', {
      key: form_id
    , include_docs: true
    }, function (err, body) {
      callback(err, body);
    });
  };
 
  return {
    'generate_api_key': generate_api_key,
    'save_form': save_form,
    'get_form': get_form
  };
};