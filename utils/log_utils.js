/*jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (db) {
  
  var moment = require('moment')
    , coolog = require('coolog')
    , logger = coolog.logger('log_utils.js')
    ;

  var save_log = function (log, callback) {
    db.atomic('youform', 'logs', undefined, log, function (err, body) {
      callback(err, body);
    });
  };

  var get_logs = function (api_key, callback) {
    var year = moment().year();
    db.view('youform', 'graph', {
      key: [year]
    , include_docs: true
    }, function (err, body) {
      callback(err, body);
    });
  };

  var get_dashboard = function (api_key, callback) {
    var graph = {}
      , month
      , year = moment().year()
      ;
    get_logs(api_key, function (err, result) {
      if (err) {
        callback(err, null);
      } else {
        //var year = moment().year() - 1;
        for (month = 1; month <= 12; ++month) {
          graph[year + '-' + month] = [year, month, 0, 0];
        }
        //year ++;
        //for (month = 1; month <= 12; ++month) {
        //  graph[year + '-' + month] = [year, month, 0];
        //}

        result.rows.forEach(function (row) {
          if (!row.doc.spam) {
            graph[row.key + '-' + row.value][2] += 1;
          } else {
            graph[row.key + '-' + row.value][3] += 1;
          }
        });

        logger.debug(graph);

        callback(null, {
          counter: Object.values(graph)
        });
      }
    });
  };
 
  return {
    'save_log': save_log
  , 'get_logs': get_logs
  , 'get_dashboard': get_dashboard
  };
};