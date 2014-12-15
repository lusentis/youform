'use strict';

module.exports = function () {

  // npm dependencies
  let coolog = require('coolog'),
      path = require('path'),
      request = require('co-request');

  let logger = coolog.logger(path.basename(__filename));


  let _spam = function* (ip, requestData) {
    let isSpam = false;
    let data = {
      blog: 'http:/www.youform.me',
      user_ip: ip, // this.ip.split('.').reverse().join('.')
      user_agent: requestData.headers['user-agent'],
      referrer: requestData.headers.referer
    };
    logger.info('akismet request body', data);
    try {
      let res = yield request({
        uri: 'https://' + process.env.AKISMET_API_KEY + '.rest.akismet.com/1.1/comment-check',
        method: 'POST',
        form: data
      });

      isSpam = (res.body === true);
    }
    catch (err) {
      logger.error('akismet error', err);
    }

    return isSpam;
  };


  let _origin = function (request, url) {
    let origin =  request.headers.referer || request.headers.origin;
    return (origin && (origin.has(url) || url.has(origin)));
  };


  return {
    'akismet': _spam,
    'origin': _origin
  };
};