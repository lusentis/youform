'use strict';

module.exports = function () {
    
  let _origin_error =  function* () {
    this.status = 520;
    this.body = yield this.render('errors/index', {error: 'origin'});
  };

  let _not_found =  function* () {
    this.status = 404;
    this.body = yield this.render('errors/404');
  };

  let _server_error =  function* () {
    this.status = 500;
    this.body = yield this.render('errors/500');
  };
  

  return {
    origin_error:_origin_error,
    not_found:_not_found,
    server_error:_server_error
  };
};