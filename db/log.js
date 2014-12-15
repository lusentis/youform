'use strict';

module.exports = function (db) {

  const TableName = 'YouformLogs';

  let Types = require('./models/Log').Types;

  let _save = function* (id, log) {
    let data = {};

    Object.keys(log).forEach(function (key) {
      if (key === 'id') return;
      
      data[key] = {};

      if (log[key] === null || log[key].length === 0) {
        data[key].Action = 'DELETE';
      } else {
        data[key].Action = 'PUT';
        data[key].Value = {};
        data[key].Value[Types[key]] = log[key];
      }
    });

    let result  = yield db.updateItem({
      Key: { id: { S: id } },
      AttributeUpdates: data,
      TableName: TableName,
      ReturnConsumedCapacity: 'NONE',
      ReturnItemCollectionMetrics: 'NONE',
      ReturnValues: 'NONE'
    });
    return result;
  };


  let _unpackRow = function (data) {
    let row = {};
    Object.keys(data).forEach(function (key) {
      row[key] = data[key][Types[key]];
    });
    return row;
  };


  let _get = function* (id) {
    let graph = {};
    let data = yield db.query({
      KeyConditions: {
        userId: {
          ComparisonOperator: 'EQ',
          AttributeValueList: [{ S: id }]
        }
      },
      IndexName: 'userId-index',
      TableName: TableName,
      ReturnConsumedCapacity: 'NONE'
    });
    
    if (data.Count > 0) {
      let now = new Date();
      let logs = data.Items;
      
      // init graph obj
      for (let i = now.getMonth() + 1; i <= 12; ++i) {
        graph[(now.getFullYear() - 1) + '-' + i] = [(now.getFullYear() - 1), i, 0, 0];
      }
      for (let i = 1; i <= now.getMonth(); ++i) {
        graph[now.getFullYear() + '-' + i] = [now.getFullYear(), i, 0, 0];
      }

      // parse logs
      logs.forEach(function (row) {
        row = _unpackRow(row);
        row.created_at = new Date(row.created_at);
        
        if (Object.has(graph, (row.created_at.getFullYear() + '-' + row.created_at.getMonth()))) {
          if (!row.spam) {
            graph[row.created_at.getFullYear() + '-' + row.created_at.getMonth()][2] += 1;
          } else {
            graph[row.created_at.getFullYear() + '-' + row.created_at.getMonth()][3] += 1;
          }
        }
      });
    }

    return graph;
  };


  return {
    save: _save,
    get: _get
  };
};