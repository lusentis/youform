/*jshint couch:true, indent:2, white:true, laxcomma:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
/*global toJSON */

function(doc, req) {
  'use strict';
  
  var data = JSON.parse(req.body);
  
  if (doc == null) {
    doc = {
      _id: req.uuid
    , type: 'log'
    , date: new Date()
    , form_api_key: data.api_key
    , user_ip: data.user_ip
    , spam: data.spam
    };
  }

  return [doc, toJSON(doc)];
}