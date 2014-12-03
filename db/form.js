'use strict';

module.exports = function (db) {

  const TableName = 'YouformForms';

  let Types = require('./models/Form'); 

  let _save = function* (id, form) {

    let data = {};

    Object.keys(form).forEach(function (key) {
      if (key === 'id') return;
      
      data[key] = {};

      if (form[key] === null || form[key].length === 0) {
        data[key].Action = 'DELETE';
      } else {
        data[key].Action = 'PUT';
        data[key].Value = {};
        data[key].Value[Types[key]] = form[key];
      }
    });

    console.log(data);

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


  let _get = function* (id) {
    let form = yield db.getItem({
      Key: { id: { S: id } },
      TableName: TableName,
      ReturnConsumedCapacity: 'NONE'
    });

    if (!form || Object.size(form) === 0) {
      throw new Error('Form not found');
    }

    let data = {};
    Object.keys(form.Item).forEach(function (key) {
      data[key] = form.Item[key][Types[key]];
    });

    return data;
  };


  return {
    save: _save,
    get: _get
  };
};