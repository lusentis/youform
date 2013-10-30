/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */

/*!
*  connect-rich-response
*  Copyright(c) 2013 Luca Casartelli - Plastic Panda <luca@plasticpanda.com>
*  MIT Licensed
*/


module.exports = function (options) {
  'use strict';

  /**
  * Module dependencies.
  */
  var fs = require('fs');
  var jade = require('jade');

  //
  // utils
  //
  function _isFunction(fn) {
    return fn !== null && fn !== undefined && {}.toString.call(fn) === '[object Function]';
  }

  function _parseOpt(opt) {
    var obj = {};
    opt = opt || {};
    for (var k in opt) {
      obj[k] = opt[k];
    }
    return obj;
  }


  // load settings
  var settings = _parseOpt(options);


  var redirect = function (url) {
    var response = this;
    response.setHeader('Location', url);
    response.statusCode = 302;
    response.end();
    return response;
  };


  var json = function (data) {
    var response = this;
    var jsonString = JSON.stringify(data);
    response.writeHead(response.statusCode, {'Content-Type': 'application/json'});
    return response.end(jsonString);
  };


  var status = function (code) {
    var response = this;
    if ((parseFloat(code, 10) != parseInt(code, 10)) || isNaN(code)) {
      if (settings.debug) {
        throw new Error('invalid status code');
      } else {
        response.statusCode = 200;
      }
    }
    response.statusCode = parseInt(code, 10);
    return response;
  };


  var render = function (path, options, cb) {
    var response = this;
    path = settings.root + '/' + path + '.jade';

    if (_isFunction(options)) {
      cb = options;
    } else {
      cb = (_isFunction(cb)) ? cb : null;
    }

    if (options === undefined || options === null) {
      options = {};
    }

    // set path
    options.filename = path;

    fs.readFile(path, function (err, content) {
      if (err) {
        if (settings.debug) {
          throw err;
        }
        response.status(500).json({error: true, description: 'internal server error'});
      } else {
        jade.render(content, options, function (err, html) {
          if (err) {
            if (settings.debug) {
              throw err;
            }
            response.status(500).json({error: true, description: 'internal server error'});
          } else {
            if (cb) {
              cb(null, html);
              return;
            }
            response.writeHead(response.statusCode, {'Content-Type': 'text/html'});
            response.write(html);
            response.end();
            return response;
          }
        });
      }
    });
  };


  var html = function (path, cb) {
    var response = this;
    path = settings.root + '/' + path + '.html';
    cb = (cb !== null && cb !== undefined && {}.toString.call(cb) === '[object Function]') ? cb : null;

    fs.readFile(path, function (err, html) {
      if (err) {
        if (settings.debug) {
          throw err;
        }
        response.status(500).json({error: true, description: 'internal server error'});
      } else {
        if (cb) {
          cb(null, html);
          return;
        }
        response.writeHead(response.statusCode, {'Content-Type': 'text/html'});
        response.write(html);
        response.end();
        return response;
      }
    });
  };


  return function (req, res, next) {
    req.next = next;
    if (!res.req) {
      res.req = req;
    }

    res.status = status;
    res.redirect = redirect;
    res.json = json;
    res.render = render;
    res.html = html;
    
    return next();
  };
};