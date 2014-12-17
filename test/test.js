/* global describe: true, it: true */
'use strict';

require('co-mocha');

var assert = require('assert');
var app = require('../worker')(process.env.PORT || 3000);
var request = require('supertest').agent(app);


describe('regex', function() {
  var regex = require('../libs/regex');
  describe('#email()', function() {
    it('should return false when the email is not valid', function* (){
      assert.equal(false, regex.email('testtest.it'));
      assert.equal(false, regex.email(null));
      assert.equal(false, regex.email(undefined));
    });
  });
});


describe('website', function() {
  describe('index', function() {
    it('should return 200 status code', function (done) {
      request
        .get('/')
        .expect(200, done);
    });
  });
});


describe('new form', function () {
  it('should create new form', function(done) {
    request
      .post('/api/new-form')
      .type('form')
      .send({
        "email-crt": "luca@plasticpanda.com",
        "country-code": 39, 
        "phone": 3387798613,
        "w-url": "http://localhost:8080",
        "w-success-page": "http://localhost:8080/done",
        "f-name": "test",
        "email-dest": "luca@plasticpanda.com",
        "replyto-field": "",
        "f-subject": "TEST subject",
        "f-intro": "test test test",
        "colours": "A948AD"
      })
      .expect(302, done);
  });
});


describe('api/form/json', function() {
  describe('missing form', function() {
    it('should return json with 404 status code', function (done) {
      request
        .post('/api/form/json/wrong-id')
        .expect(404)
        .expect({ "api_key": "wrong-id", "description": "form not found", "status": "error"}, done);
    });
  });


  describe('invalid type', function() {
    it('should redirect to 404', function (done) {
      request
        .post('/api/form/wrong/wrong-id')
        .expect(302)
        .expect('Location', '/404', done);
    });
  });
});
