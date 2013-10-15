/*jshint couch:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

function map(doc) {
  'use strict';
  if (doc.type && doc.type === 'log') {
    emit([new Date(doc.date).getFullYear()], new Date(doc.date).getMonth());
  }
}