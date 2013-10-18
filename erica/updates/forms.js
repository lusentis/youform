/*jshint couch:true, indent:2, white:true, laxcomma:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
/*global toJSON */

function(doc, req) {
  'use strict';
  
  var data = JSON.parse(req.body);
  
  if (data.action === 'update') {
    if (doc === null) {
      // create
      doc = {
        _id: data._id
      , type: 'form'
      , token: data.token
      , code: data.code
      , confirmed: false
      , email_confirmed: false
      , phone_confirmed: false
      , created_at: new Date()
      , form_name: data.form_name.trim()
      , website_url: data.website_url.trim()
      , website_success_page: data.website_success_page.trim()
      , form_subject: data.form_subject.trim()
      , form_intro: data.form_intro.trim()
      , form_destination: data.form_destination.trim()
      , form_destination_not_confirmed: data.form_destination.trim()
      , creator_email: data.creator_email.trim()
      , colours: data.colours.trim()
      , phone: data.phone.trim()
      , country_code: data.country_code.trim()
      , replyto_field: data.replyto_field.trim()
      };
    } else {
      // update
      doc.form_name = data.form_name.trim();
      doc.website_url = data.website_url.trim();
      doc.website_success_page = data.website_success_page.trim();
      doc.form_subject = data.form_subject.trim();
      doc.form_intro = data.form_intro.trim();
      doc.creator_email = data.creator_email.trim();
      doc.colours = data.colours.trim();
      doc.phone = data.phone.trim();
      doc.country_code = data.country_code.trim();
      doc.replyto_field = data.replyto_field.trim();
    }
  } else if (data.action === 'delete') {
    doc.deleted = true;
  } else if (data.action === 'phone') {
    doc.phone_confirmed = true;
    if (doc.email_confirmed === true) {
      doc.confirmed = true;
    }
  } else if (data.action === 'change_email') {
    doc.form_destination_not_confirmed = data.email.trim();
    doc.email_confirmed = false;
  } else if (data.action === 'confirm_email') {
    doc.form_destination = doc.form_destination_not_confirmed;
    delete doc.form_destination_not_confirmed;
    doc.email_confirmed = true;
    if (doc.phone_confirmed === true) {
      doc.confirmed = true;
    }
  }

  return [doc, toJSON(doc)];
}