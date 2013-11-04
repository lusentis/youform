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
            key: [api_key, year]
          , include_docs: true
          }, function (err, body) {
            cb(err, body.rows);
          });
        },
        function (cb) {
          if (month !== 12) {
            db.view('youform', 'graph', {
              key: [api_key, (year - 1)]
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
          callback(null, results[1].concat(results[0]));
        }
      });
  };

  var get_plan = function (api_key, callback) {
    async.parallel([
        function (cb) {
          db.view('youform', 'payments', {
            key: api_key
          , include_docs: true
          }, function (err, body) {
            cb(err, body.rows);
          });
        },
        function (cb) {
          get_logs(api_key, function (err, result) {
            if (err) {
              cb(err, null);
              return;
            }
            cb(null, result);
          });
        }
      ], function (err, results) {
        if (err) {
          callback(err);
          return;
        }
        var max_emails = 0;
        var received = 0;
        results[0].forEach(function (item) {
          max_emails += item.total;
        });
        max_emails = max_emails < 100 ? 100 : max_emails;

        results[1].forEach(function (item) {
          received +=  item.spam === false ? 1 : 0;
        });

        callback(null, {
          'max': max_emails
        , 'received': received
        });
      });
  };

  var get_graph = function (api_key, callback) {
    var graph = {}
      , year = moment().year()
      , month = moment().month() + 1
      , i
      ;

    get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
        return;
      }
      // init graph obj
      for (i = month + 1; i <= 12; ++i) {
        graph[(year - 1) + '-' + i] = [(year - 1), i, 0, 0];
      }
      for (i = 1; i <= month; ++i) {
        graph[year + '-' + i] = [year, i, 0, 0];
      }
      // parse logs
      result.forEach(function (row) {
        if (Object.has(graph, (row.key[1] + '-' + row.value))) {
          if (!row.doc.spam) {
            graph[row.key[1] + '-' + row.value][2] += 1;
          } else {
            graph[row.key[1] + '-' + row.value][3] += 1;
          }
        }
      });

      callback(null, Object.values(graph));
    });
  };

 
  return {
    'save_log': save_log
  , 'get_logs': get_logs
  , 'get_graph': get_graph
  , 'get_plan': get_plan
  };
};