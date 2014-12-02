'use strict';

module.exports = function (port) {

  // inject sugarJS
  require('sugar');
  
  // npm dependencies
  let bodyParser = require('koa-body')({multipart: true}),
      koa = require('koa'),
      gzip = require('koa-gzip'),
      logger = require('koa-logger'),
      _nano = require('nano')(process.env.DATABASE_URL),
      router = require('koa-router'),
      session = require('koa-generic-session'),
      RedisStore = require('koa-redis'),
      limit = require('koa-ratelimit'),
      redis = require('redis'),
      statics = require('koa-static'),
      path = require('path'),
      views = require('koa-render');
  
  let nano = require('co-nano-db')(_nano);

  // config coolog
  require('coolog').addChannel({ 
    name: 'root',
    level: 'debug', 
    appenders: ['console']
  });

  
  let app = koa();
  // logger
  app.use(logger());

  // session
  app.keys = [process.env.SECRET_KEY];
  
  app.use(session({
    store: new RedisStore({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT
    })
  }));

  app.use(limit({
    db: redis.createClient(),
    duration: 1000 * 60 * 60,
    max: 1000
  }));


  app.use(views('./views', 'jade'));

  // serve static files
  app.use(statics(__dirname + '/public'));

  // router

  app.use(router(app));
  app.use(require('koa-router-newrelic')(app));
 
  // ## Website routes

  let website_routes = require('./routes/site')(nano);
  let api_routes = require('./routes/api')(nano);
  let error_routes = require('./routes/error')();
  let middleware = require('./middleware')();


  // website
  let website_prefix = '';
  app.get(path.join(website_prefix, '/'), website_routes.index);
  app.get(path.join(website_prefix, '/success/:api_key'), middleware.api_key, website_routes.form.success);
  app.get(path.join(website_prefix, '/deleted'), website_routes.form.deleted);
  app.get(path.join(website_prefix, '/signup'), website_routes.form.signup);
  app.get(path.join(website_prefix, '/delete/:api_key'), middleware.api_key, website_routes.form.del);
  app.get(path.join(website_prefix, '/edit/:api_key'), middleware.api_key, website_routes.form.edit);
  app.get(path.join(website_prefix, '/dashboard/:api_key'), middleware.api_key, website_routes.dashboard);
  app.get(path.join(website_prefix, '/confirm/email/confirmed/:api_key'), middleware.api_key, website_routes.confirmed_email);
  // website errors
  app.get(path.join(website_prefix, '/520'), error_routes.origin_error);
  app.get(path.join(website_prefix, '/404'), error_routes.not_found);
  app.get(path.join(website_prefix, '/500'), error_routes.server_error);

  let api_prefix = '/api';
  app.post(path.join(api_prefix, '/confirm/sms/:api_key'), bodyParser, api_routes.confirm_sms);
  app.get(path.join(api_prefix, '/confirm/send-sms/:api_key'), api_routes.send_confirm_sms);
  app.get(path.join(api_prefix, '/confirm/send-email/:api_key'), api_routes.send_confirm_email);
  app.post(path.join(api_prefix, '/new-form'), bodyParser, api_routes.form.create);
  app.post(path.join(api_prefix, '/form/:api_key'), bodyParser, api_routes.form.get); //utils.rateLimit()
  app.post(path.join(api_prefix, '/edit/:api_key'), bodyParser, api_routes.form.edit);
  app.post(path.join(api_prefix, '/delete/:api_key'), bodyParser, api_routes.form.del);
  app.get(path.join('/confirm/email/:api_key'), api_routes.confirm_email);


  // compress responses
  app.use(gzip());

  // start server
  app.listen(port);
};