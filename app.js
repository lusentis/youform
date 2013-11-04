/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

var cluster = require('cluster')
  , coolog = require('coolog')
  , worker = require('./worker.js')
  ;

require('sugar');

var numCPUs = (process.NODE_ENV === 'production') ? require('os').cpus().length : 1;
var logger = coolog.logger('app.js');

if (cluster.isMaster) {
  (numCPUs).times(function () {
    var worker = cluster.fork();
    logger.log('Booting worker #' + worker.id);
  });

  cluster.on('disconnect', function (worker) {
    logger.error('Worker #' + worker.id + ' disconnected. Exit mode =', (worker.suicide === true) ? 'suicide' : 'normal exit');
    cluster.fork();
  });

} else {
  worker();
}