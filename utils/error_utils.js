/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function () {
  
  let coolog = require('coolog'),
      path = require('path');

  let logger = coolog.logger(path.basename(__filename));

  let _params = function (params, handler, message) {
    let err = {
      error: true,
      message: message || 'params error',
      form: params.api_key
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


  let _token_mismatch = function (api_key, token, handler) {
    logger.error({
      error: true,
      form: api_key,
      token: token,
      description: 'token mismatch'
    });
    if (handler) {
      handler.redirect('/404');
    }
  };


  let _not_found = function (api_key, handler) {
    logger.error({
      error: true,
      form: api_key,
      description: 'form not found'
    });
    if (handler) {
      handler.redirect('/404');
    }
  };
 
  return {
    'params': _params,
    'not_found': _not_found,
    'token': _token_mismatch
  };
};

  