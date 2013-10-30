/* jshint node:true, indent:2, white:true, laxcomma:true, undef:true, strict:true, unused:true, eqnull:true, camelcase: false, trailing: true */
'use strict';

var connect = require('connect')
  , coolog = require('coolog')
  , flash = require('connect-flash')
  , http = require('http')
  , jsonify = require('redis-jsonify')
  , nano = require('nano')(process.env.DATABASE_URL || 'http://localhost:5984/youform')
  , path = require('path')
  , parted = require('parted')
  , urlrouter = require('urlrouter')
  , redis = require('redis')
  , RedisStore = require('connect-redis')(connect)
  , logger = coolog.logger('app.js')
  , response_middleware = require('./connect-rich-response.js')
  ;

require('sugar');

var app = connect()
  , redis_client
  , cookieParser = connect.cookieParser(process.env.SITE_SECRET)
  , sessionStore
  , rtg
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
var port = process.env.PORT || 3000;
app.use(connect.favicon());
app.use(response_middleware({ root: __dirname + '/views', debug: true }));
app.use(connect.logger('dev'));
app.use(cookieParser);
// limit request size
//app.use(connect.limit('2mb'));

// multipart
app.use(function (req, res, next) {
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
});
app.use(connect.json());
app.use(connect.urlencoded());
app.use(connect.query());
app.use(connect.session());
app.use(flash());
app.use(connect.methodOverride());
app.use(require('stylus').middleware(__dirname + '/public'));
app.use(connect.static(path.join(__dirname, 'public')));

// development only
if (process.env.DEV === true) {
  app.use(connect.errorHandler());
}

app.use(urlrouter(function (app) {
  require('./routes/site')(app, nano, '');
  require('./routes/api')(app, nano, redis_client, '/api');
}));

http.createServer(app).listen(port, function () {
  logger.ok('Express server listening on port ' + port);
});
