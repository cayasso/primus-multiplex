var Primus = require('primus');
var multiplex = require('../');
var Emitter = require('events').EventEmitter;
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'sockjs', parser: 'JSON' };

// creates the client
function client(srv, primus, port){
  var addr = srv.address();
  var url = 'http://' + addr.address + ':' + (port || addr.port);
  return new primus.Socket(url);
}

// creates the server
function server(srv, opts) {
  // use multiplex plugin
  return Primus(srv, opts).use('multiplex', multiplex);
}

describe('primus-multiplex', function (){

  it('should have required methods', function (done){
    var srv = http();
    var primus = server(srv, opts);
    srv.listen(function(){
      var cl = client(srv, primus);
      expect(primus.channel).to.be.a('function');
      expect(cl.channel).to.be.a('function');
      done();
    });
  });

  it('should return EventEmitter instances', function (done){

    var srv = http();
    var primus = server(srv, opts);

    var a = primus.channel('a');
    var b = primus.channel('b');
    var c = primus.channel('c');

    expect(a).to.be.a(Emitter);
    expect(b).to.be.a(Emitter);
    expect(c).to.be.a(Emitter);
    done();
  });

  it('should stablish a connection', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        done();
      });
      var cl = client(srv, primus);
      var ca = cl.channel('a');
    });
  });

  it('should allow sending message from client to server', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          done();
        });
      });
      var cl = client(srv, primus);
      var ca = cl.channel('a');
      ca.write('hi');
    });
  });

  it('should allow sending message from server to client', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.write('hi');
      });
      var cl = client(srv, primus);
      var ca = cl.channel('a');
      ca.on('data', function (data) {
        expect(data).to.be('hi');
        done();
      });
    });
  });

  it('should not intercept regular socket connections on data', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      primus.on('connection', function (spark) {
        spark.on('data', function (data) {
          done('Should ignore data');
        });
        a.on('connection', function (spark) {
          spark.on('data', function (data) {
            expect(data).to.be('hi');
            done();
          });          
        });
      });
      var cl = client(srv, primus);
      var ca = cl.channel('a');
      ca.write('hi');
    });
  });

  it('should only receive data from corresponding client', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');

    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.on('data', function (data) {
          expect(data).to.be('hi');
          done();
        });
      });

      var cl = client(srv, primus);
      var ca = cl.channel('a');
      var cb = cl.channel('b');
      var cc = cl.channel('c');

      ca.write('hi');
      cb.write('hi');
      cc.write('hi');
    });
  });

  it('should only receive data from corresponding channel', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    var b = primus.channel('b');
    var c = primus.channel('c');

    var count = 3;

    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.write('hi a');
      });

      b.on('connection', function (spark) {
        spark.write('hi b');
      });

      c.on('connection', function (spark) {
        spark.write('hi c');
      });

      var cl = client(srv, primus);
      var ca = cl.channel('a');
      var cb = cl.channel('b');
      var cc = cl.channel('c');

      ca.on('data', function (data) {
        expect(data).to.be('hi a');
        if (!--count) done();
      });

      cb.on('data', function (data) {
        expect(data).to.be('hi b');
        if (!--count) done();
      });

      cc.on('data', function (data) {
        expect(data).to.be('hi c');
        if (!--count) done();
      });
    });
  });

  it('should allow multiple client connections', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var count = 3;

    var a = primus.channel('a');
    var b = primus.channel('b');
    var c = primus.channel('c');

    srv.listen(function(){

      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          if (!--count) done();
        });
      });

      b.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          if (!--count) done();
        });
      });

      c.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          if (!--count) done();
        });
      });

      var cl = client(srv, primus);

      var cla = cl.channel('a');
      var clb = cl.channel('b');
      var clc = cl.channel('c');

      cla.write('hi');
      clb.write('hi');
      clc.write('hi');
    });
  });

  it('should allow multiple client connections to the same channel', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var count = 3;
    var a = primus.channel('a');
    var b = primus.channel('b');
    var c = primus.channel('c');

    srv.listen(function(){

      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          if (!--count) done();
        });
      });

      var cl = client(srv, primus);
      var cl1 = cl.channel('a');
      var cl2 = cl.channel('a');
      var cl3 = cl.channel('a');

      cl1.write('hi');
      cl2.write('hi');
      cl3.write('hi');

    });
  });

  it('should be able to disconnect from a channel', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');

    srv.listen(function(){

      a.on('connection', function (spark) {
        spark.on('data', function (data){
          done();
        });
      });

      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.write('hi');
      cla.end();
      cla.write('hi again');
    });
  });

  it('should be able to destroy a channel', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');

    srv.listen(function(){

      a.on('connection', function (spark) {
        spark.write('hi');
        spark.destroy();
        spark.write('hi');
      });

      var cl = client(srv, primus);
      var cla = cl.channel('a');

      cla.on('data', function (data){
        done();
      });
    });
  });

  it('should emit close event on connection destroy', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');

    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.on('close', function () {
          done();
        });
        spark.destroy();
      });
    });

    var cl = client(srv, primus);
    var cla = cl.channel('a');
  });

  it('should explicitly cancel connection', function(done){

    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');

    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.end(null, function () {
          done();
        });
      });
    });

    var cl = client(srv, primus);
    var cla = cl.channel('a');
  });

});