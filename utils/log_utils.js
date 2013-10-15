/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var async = require('async')
    , moment = require('moment')
    ;

  var save_log = function (log, callback) {
    db.atomic('youform', 'logs', undefined, log, function (err, body) {
      callback(err, body);
    });
  };

  var get_logs = function (api_key, callback) {
    var year = moment().year();
    var month = moment().month();

    async.parallel([
        function (cb) {
          db.view('youform', 'graph', {
            key: [year]
          , include_docs: true
          }, function (err, body) {
            cb(err, body.rows);
          });
        },
        function (cb) {
          if (month !== 12) {
            db.view('youform', 'graph', {
              key: [(year - 1)]
            , include_docs: true
            }, function (err, body) {
              cb(err, body.rows);
            });
          } else {
            cb(null, []);
          }
        }
      ], function (err, results) {
        if (err) {
          callback(err);
        } else {
          callback(null, [results[1], results[0]]);
        }
      });
  };

  var get_dashboard = function (api_key, callback) {
    var graph = {}
      , year = moment().year()
      , month = moment().month() + 1
      , i
      ;

    get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        
        for (i = 12; i >= month; --i) {
          graph[(year - 1) + '-' + i] = [(year - 1), i, 0, 0];
        }
        for (i = month; i >= 1; --i) {
          graph[year + '-' + i] = [year, i, 0, 0];
        }

        result[1].forEach(function (row) {
          if (Object.has(graph, (row.key + '-' + row.value))) {
            if (!row.doc.spam) {
              graph[row.key[1] + '-' + row.value][2] += 1;
            } else {
              graph[row.key[1] + '-' + row.value][3] += 1;
            }
          }
        });

        result[0].forEach(function (row) {
          if (Object.has(graph, (row.key[1] + '-' + row.value))) {
            if (!row.doc.spam) {
              graph[row.key[1] + '-' + row.value][2] += 1;
            } else {
              graph[row.key[1] + '-' + row.value][3] += 1;
            }
          }
        });

        console.log(graph);

        callback(null, Object.values(graph));
      }
    });
  };
 
  return {
    'save_log': save_log
  , 'get_logs': get_logs
  , 'get_dashboard': get_dashboard
  };
};