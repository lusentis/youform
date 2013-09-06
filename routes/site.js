/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, prefix) {

  var coolog = require('coolog')
    , logger = coolog.logger('site.js');

  var index = function (req, res) {
    res.render('index', {
      title: 'youform'
    });
  };

  var new_form = function (req, res) {
    res.render('signup', {
      title: 'New form'
    });
  };

  var signup_success = function (req, res) {
    res.render('signup_success', {
      title: 'Sign success'
    });
  }

  app.get(prefix + '/', index);
  app.get(prefix + '/signup', new_form);
};
