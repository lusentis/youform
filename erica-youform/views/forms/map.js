/*jshint couch:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

function map(doc) {
  'use strict';
  if (doc.type && doc.type === 'form') {
    emit([doc._id, doc.website_url], null);
  }
}