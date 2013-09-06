/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

module.exports = function (app, db, redis, prefix) {

  var form_utils = require('../utils/form_utils.js')(db)
    , utils = require('../utils/utils.js')(redis)
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
        logger.ok('saved form', form);
        // @TODO: send confirm email 
        res.redirect('/success');
      }
    });
  };

  var form = function (req, res) {
    var form_id = req.param('id', null);
    logger.info(form_id);
    form_utils.get_form(form_id, function (err, data) {
      if (err) {
        throw err;
      } else {
        if (!data) {
          logger.error({
            error: true
          , form_id: form_id
          , description: 'Form not found'
          });
          res.json({
            error: true
          , description: 'Form not found. Check your API key'
          });
        } else {
          logger.debug('results', data);
          res.redirect(data.website_success_page);
        }
      }
    });
  };

  // routes
  app.post(prefix + '/new-form', new_form);
  app.get(prefix + '/form/:id', utils.rateLimit(), form);
};
