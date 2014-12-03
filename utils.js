'use strict';

module.exports = function () {

  let thunkify = require('thunkify');

  let _wrap = function (obj) {
    let proto = Object.getPrototypeOf(obj);
    Object.keys(proto).forEach(function (key) {
      let val = proto[key];
      if ('constructor' == val) { return; } 
      if ('function' != typeof val) { return; } 
      obj[key] = thunkify(obj[key]);
    });
    return obj;
  };

  return {
    wrap: _wrap
  };
};