/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var coolog = require('coolog')
    , logger = coolog.logger('form_utils.js')
    , save_form
    , delete_form
    ;

  save_form = function* (form, key) {
    if (key === null) {
      key = undefined;
    }
    form.action = 'update';
    form = yield db.atomic('youform', 'forms', key, form);
    return form;
  };

  delete_form = function* (form) {
    yield db.atomic('youform', 'forms', form._id, { action: 'delete' });
  };
 
  return {
    'save_form': save_form
  , 'delete_form': delete_form
  };
};