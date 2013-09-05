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
    res.render('new_form', {
      title: 'New form'
    });
  };

  var save_form = function (req, res) {
    var form = {
      url: req.body['website-url']
    , name: req.body['website-name']
    , success: req.body['success-page']
    , error: req.body['error-page']
    , email: {
        destination: req.body['email-destination']
      , creator: req.body['email-creator']
      , subject: req.body['email-subject']
      , intro: req.body['email-intro']
      }
    , sender: {
        email: req.body['email-sender-email']
      , name: req.body['email-sender-name']
      }
    };
    
    logger.info(form);
    res.redirect(prefix + '/');
  };

  app.get(prefix + '/', index);
  app.get(prefix + '/new-form', new_form);
  app.post(prefix + '/new-form', save_form);
};
