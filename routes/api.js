/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, prefix) {

  var index = function (req, res) {
    res.render('index', {
      title: 'youform'
    });
  };

  app.get(prefix + '/', index);
};
