/*jshint browser:true, indent:2, laxcomma:true, loopfunc: true */
/*global NodeList, HTMLCollection */

(function () {

  'use strict';

  NodeList.prototype.forEach = Array.prototype.forEach;
  HTMLCollection.prototype.forEach = Array.prototype.forEach;


  window.showModal = function (which) {
    document.querySelector('#mask').style.display = 'block';
    document.querySelector('#' + which).style.display = 'block';

    return false;
  };

  window.closeModal = function (which) {
    document.querySelector('#mask').style.display = 'none';
    if (which) {
      document.querySelector('#' + which).style.display = 'none';
    } else {
      document.querySelector('#pitch').style.display = 'none';
      document.querySelector('#indie').style.display = 'none';
    }

    return false;
  };

  document.querySelector('#mask').addEventListener('click', function (e) {
    window.closeModal();
    e.stopPropagation();
  });

})();
