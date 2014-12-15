'use strict';

module.exports = {
  email: function(s) {
    var r = /^(?:[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?\^_`{|}~\-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-z0-9\-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9\-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
    if (s) {
      s = s.trim();
    }
    return r.test(s);
  },
  colours: function(s) {
    var r = /^([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (s) {
      s = s.trim();
    }
    return r.test(s);
  },
  country_code: function(s) {
    var r = /^\+{0,1}[0-9]{1,4}$/;
    if (s) {
      s = s.trim();
    }
    return r.test(s);
  },
  phone: function(s) {
    var r = /^[0-9\-().\s]{10,15}$/;
    if (s) {
      s = s.trim();
    }
    return r.test(s);
  },
  url: function(s) {
    var r = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[.\!\/\\w]*))?)/;
    if (s) {
      s = s.trim();
    }
    return r.test(s); 
  }
};