/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var moment = require('moment');

  var save_log = function (log, callback) {
    db.atomic('youform', 'logs', undefined, log, function (err, body) {
      callback(err, body);
    });
  };

  var get_logs = function (api_key, callback) {
    db.view('youform', 'logs', {
      key: api_key
    , include_docs: true
    }, function (err, body) {
      callback(err, body);
    });
  };

  var get_stats = function (api_key, callback) {
    get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        var counter = {};
        var logs = [];
        result.rows.forEach(function (row) {
          var date = moment(row.doc.date);
          if (!Object.has(counter[date.year()], date.month() + 1)) {
            counter[date.year()] = {};
            counter[date.year()][date.month() + 1] = 0;
          }
          counter[date.year()][date.month() + 1] += 1;
          logs.push({
            date: row.doc.date
          , user_ip: row.doc.user_ip
          });
        });
        callback(null, {
          rows: logs
        , total_rows: logs.length
        , counter: counter
        });
      }
    });
  };
 
  return {
    'save_log': save_log
  , 'get_logs': get_logs
  , 'get_stats': get_stats
  };
};