/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';


module.exports = function () {

  var cluster = require('cluster')
    , connect = require('connect')
    , coolog = require('coolog')
    , domain = require('domain')
    , flash = require('connect-flash')
    , http = require('http')
    , jsonify = require('redis-jsonify')
    , nano = require('nano')(process.env.DATABASE_URL || 'http://localhost:5984/youform')
    , path = require('path')
    , parted = require('parted')
    , redis = require('redis')
    , urlrouter = require('urlrouter')
    ;

  var RedisStore = require('connect-redis')(connect);

  if (!cluster.isWorker) {
    throw new Error('Please run me as a worker process.');
  }

  var logger = coolog.logger('worker.js');

  var redis_client
    , cookieParser = connect.cookieParser(process.env.SITE_SECRET)
    , sessionStore
    , rtg
    , server
    ;

  if (process.env.REDISTOGO_URL) {
    // @TODO: test this
    rtg = require('url').parse(process.env.REDISTOGO_URL);
    redis_client = redis.createClient(rtg.port, rtg.hostname);
    redis_client.auth(rtg.auth.split(':')[1]);

    // redis as session store
    sessionStore = new RedisStore({
      host: process.env.REDISTOGO_URL.split(':')[0],
      port: 6379,
      pass: process.env.REDISTOGO_URL
    });

  } else {
    throw new Error('Missing Redis URL: REDISTOGO_URL');
  }

  redis_client = jsonify(redis_client);
  redis_client.on('error', function (err) {
    logger.error('redis error', err);
  });

  // all environments
  var port = process.env.PORT || 3000
    , app = connect()
    .use(connect.favicon())
    .use(require('./connect-rich-response.js')({ root: __dirname + '/views', debug: true }))
    .use(connect.logger('dev'))
    .use(cookieParser)
    .use(function (req, res, next) {
      var type = '';
      if (req.headers['content-type'] !== undefined) {
        type = req.headers['content-type'].split(';')[0].trim().toLowerCase();
      }

      if (/^\/api\/form\/*/.test(req.url) && type === 'multipart/form-data') {
        parted({
          // custom file path
          path: __dirname + '/uploads',
          // memory usage limit per request
          limit: 30 * 1024,
          // disk usage limit per request
          diskLimit: 30 * 1024 * 1024,
          // enable streaming for json/qs
          stream: true
        })(req, res, next);
      } else {
        process.nextTick(next);
      }
    })
    .use(connect.json())
    .use(connect.urlencoded())
    .use(connect.query())
    .use(connect.session())
    .use(flash())
    .use(connect.methodOverride())
    .use(require('stylus').middleware(__dirname + '/public'))
    .use(connect.static(path.join(__dirname, 'public')))
    ;


  app.use(function (req, res, next) {
    var d = domain.create();
    d.id = 'ip' + req.ip + '#worker' + cluster.worker.id;
    
    d.add(req);
    d.add(res);
      
    d.on('error', function (e) {
      logger.error('An error occurred in domain #' + d.id, e.message, e.message_, e.stack);
      
      try {
        var killtimer = setTimeout(function () {
          process.exit(1);
        }, 30000);
        
        killtimer.unref();
        logger.warn('Current worker does not accept new connection and will exit within 30s.');

        server.close();
        cluster.worker.disconnect();
      } catch (er2) {
        logger.error('Error while handling an error:', er2, er2.stack);
        process.exit(1);
      }
    });
    
    d.run(function () {
      urlrouter(function (app) {
        require('./routes/site')(app, nano, '');
        require('./routes/api')(app, nano, redis_client, '/api');
      })(req, res, next);
    });
  });

  // development only
  if (process.NODE_ENV !== 'production') {
    app.use(connect.errorHandler());
  }

  server = http.createServer(app).listen(port, function () {
    logger.ok('Express server listening on port ' + port);
  });

};