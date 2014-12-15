'use strict';

module.exports = function () {

  let akismet = require('akismet-api');

  let utils = require('./utils')();

  let AkismetClient = akismet.client({
    key  : process.env.AKISMET_API_KEY,
    blog : 'http:/www.youform.me'
  });

  let coAkismet = utils.wrap(AkismetClient);



  let _spam = function* () {
    //let ip = this.ip.split('.').reverse().join('.');
    let result = yield coAkismet.checkSpam({
      user_ip : this.ip,
      user_agent : this.request.headers['user-agent'],
      referer : this.request.headers.referer
    });
    console.log('akismet result', result);

    return result;
  };


  let _origin = function* (request, url) {
    let origin =  request.headers.referer || request.headers.origin;
    console.log('origin', {
      referer: request.headers.referer
    , origin: request.headers.origin
    , website_url: url
    });
    return (origin && (origin.has(url) || url.has(origin)));
  };


  return {
    'akismet': _spam,
    'origin': _origin
  };
};