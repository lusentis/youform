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
      , form_name: data.form_name
      , website_url: data.website_url.trim()
      , website_success_page: data.website_success_page.trim()
      , website_error_page: data.website_error_page.trim()
      , form_subject: data.form_subject
      , form_intro: data.form_intro
      , form_destination: ''
      , form_destination_not_confirmed: data.form_destination.trim()
      , creator_email: data.creator_email.trim()
      , sender_name: data.sender_name
      , sender_email: data.sender_email.trim()
      , colours: data.colours.trim()
      , phone: data.phone.trim()
      , country_code: data.country_code.trim()
      };
    } else {
      // update
      doc.form_name = data.form_name;
      doc.website_url = data.website_url.trim();
      doc.website_success_page = data.website_success_page.trim();
      doc.website_error_page = data.website_error_page.trim();
      doc.form_subject = data.form_subject;
      doc.form_intro = data.form_intro;
      doc.creator_email = data.creator_email.trim();
      doc.sender_name = data.sender_name;
      doc.sender_email = data.sender_email.trim();
      doc.colours = data.colours.trim();
    }
  } else if (data.action === 'delete') {
    doc.deleted = true;
  } else if (data.action === 'phone') {
    doc.phone_confirmed = true;
    delete doc.phone;
    delete doc.country_code;
    if (doc.email_confirmed === true) {
      doc.confirmed = true;
    }
  } else if (data.action === 'change_email') {
    doc.form_destination_not_confirmed = doc.email.trim();
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