/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  var coolog = require('coolog')
    , logger = coolog.logger('error_utils.js')
    ;

  var params_error = function (params, handler, message) {
    var err = {
      error: true
    , message: message || 'params error'
    , api_key: params.api_key
    };
    if (params.token) {
      err.token = params.token;
    }
    if (params.code) {
      err.code = params.code;
    }
    if (params.email) {
      err.email = params.email;
    }
    
    logger.error(err);

    if (handler) {
      handler.redirect('/404');
    }
  };

  var form_not_found = function (api_key, handler) {
    logger.error({
      error: true
    , form_id: api_key
    , description: 'Form not found'
    });
    if (handler) {
      handler.redirect('/404');
    }
  };
 
  return {
    'params_error': params_error
  , 'form_not_found': form_not_found
  };
};

  