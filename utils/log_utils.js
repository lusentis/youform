/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var save_log
    , get_logs
    ;

  save_log = function (log, callback) {
    db.atomic('youform', 'logs', undefined, log, function (err, body) {
      callback(err, body);
    });
  };

  get_logs = function (api_key, callback) {
    db.view('youform', 'logs', {
      key: api_key
    , include_docs: true
    }, function (err, body) {
      callback(err, body);
    });
  };
 
  return {
    'save_log': save_log,
    'get_logs': get_logs
  };
};