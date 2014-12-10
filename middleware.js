'use strict';

module.exports = function () {

  // npm dependencies
  let coolog = require('coolog'),
      path = require('path');
  
  // logger
  let logger = coolog.logger(path.basename(__filename));

  let _api_key_middleware = function* (next) {
    if (this.params.api_key && this.query.token) {
      yield next;
    } else {
      logger.error({
        error: true,
        message: 'params error',
        api_key: this.params.api_key,
        token: this.query.token
      });
      this.redirect('/404');
    }
  };

  return {
    'api_key': _api_key_middleware
  };
};