'use strict';

module.exports = function () {

  let querystring = require('querystring'),
      request = require('co-request');


  let _send = function* (form) {
    let hq_response = null;
    let obj = {
      'username': process.env.HQ_USERNAME,
      'password': process.env.HQ_PASSWORD,
      'to': form.country_code + '' + form.phone,
      'from': process.env.HQ_SENDER,
      'message': 'Hi, your confirmation code is: ' + form.code + '. Thank you!'
    };

    let data = querystring.stringify(obj);

    try {
      hq_response = yield request({
        uri: 'https://ssl.hqsms.com/sms.do',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': data.length
        },
        body: data
      });
    } catch (err) {
      throw err;
    }

    if (hq_response.body.has('ERROR')) {
      throw new Error(hq_response.body.has('ERROR'));
    }

    return hq_response;
  };


  return {
    send: _send
  };
};