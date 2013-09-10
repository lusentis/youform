/*jshint couch:true, indent:2, white:true, laxcomma:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
/*global toJSON */

function(doc, req) {
  'use strict';
  
  var data = JSON.parse(req.body);
  
  if (doc == null) {
    doc = {
      _id: data._id
    , type: 'form'
    , token: data.token
    , code: data.code
    , confirmed: false
    , sms_sent: false
    , created_at: new Date()
    , form_name: data.form_name
    , website_url: data.website_url
    , website_success_page: data.website_success_page
    , website_error_page: data.website_error_page
    , form_subject: data.form_subject
    , form_intro: data.form_intro
    , form_destination: data.form_destination
    , creator_email: data.creator_email
    , sender_name: data.sender_name
    , sender_email: data.sender_email
    , colours: data.colours
    , phone: data.phone
    };
  } else {
    doc.form_name = data.form_name;
    doc.website_url = data.website_url;
    doc.website_success_page = data.website_success_page;
    doc.website_error_page = data.website_error_page;
    doc.form_subject = data.form_subject;
    doc.form_intro = data.form_intro;
    doc.form_destination = data.form_destination;
    doc.creator_email = data.creator_email;
    doc.sender_name = data.sender_name;
    doc.sender_email = data.sender_email;
    doc.colours = data.colours;
    doc.phone = data.phone;
  }

  // remove form
  if (data.action == 'delete') {
    doc.deleted = true;
  }
  // confirmed
  if (data.action == 'confirmed') {
    doc.confirmed = true;
  }
  // sms sent
  if (data.action == 'sms_sent') {
    doc.sms_sent = true;
  }

  return [doc, toJSON(doc)];
}