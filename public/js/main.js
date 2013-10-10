/*jshint browser:true, indent:2, laxcomma:true, loopfunc: true */
/*global smoothScroll */

(function () {

  NodeList.prototype.forEach = Array.prototype.forEach; 
  HTMLCollection.prototype.forEach = Array.prototype.forEach;

  'use strict';

  var showMask = function () {
    document.querySelector('#detail').classList.add('open');
    document.querySelector('#mask').removeEventListener('click', showMask, false);
  }
  document.querySelector('#mask').addEventListener('click', showMask, false);

})();
