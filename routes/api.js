/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, prefix) {

  var form_utils = require('../utils/form_utils.js')(db)
    , coolog = require('coolog')
    , logger = coolog.logger('api.js')
    ;

  var new_form = function (req, res) {

    var data = {
      website_name: req.body['w-name']
    , website_url: req.body['w-url']
    , website_success_page: req.body['w-success-page']
    , website_error_page: req.body['w-error-page']
    , form_subject: req.body['f-subject']
    , form_intro: req.body['f-intro']
    , form_destination: req.body['email-dest']
    , creator_email: req.body['email-crt']
    , sender_name: req.body['snd-name']
    , sender_email: req.body['snd-email']
    };

    form_utils.save_form(data, function (err, form) {
      if (err) {
        throw err;
      } else {
        logger.info('saved form', form);
        // @TODO: send confirm email 
        res.redirect('/success');
      }
    });
  };

  var form = function (req, res) {
    var form_id = req.param('id', null);
    logger.info(form_id);
    form_utils.get_form(form_id, function (err, form) {
      if (err) {
        throw err;
      } else {
        logger.debug('results', form);
        // @TODO: redirect to website success page
      }
    });
  };


  app.get(prefix + '/new-form', new_form);
  app.get(prefix + '/form/:id', form);
};
