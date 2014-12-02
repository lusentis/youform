'use strict';

// npm dependencies
let co = require('co'),
    cluster = require('cluster');

// init newrelic
require('newrelic');

let port = 3000;
let numCPUs = require('os').cpus().length;

// development
if (process.env.LOCAL) {
  numCPUs = 1;
}

if (cluster.isMaster) {
  co(function* () {

    // fork workers
    for (let i = 0; i < numCPUs; i++) {
      console.info('start worker '+ i);
      cluster.fork();
    }

    cluster.on('exit', function(worker) {
      console.info('worker ' + worker.process.pid + ' died');
    });
  });
} else {
  require('./worker')(process.env.PORT || port);
}