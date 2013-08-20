var Primus = require('primus');
var PrimusMultiplex = require('../');
var PrimusEmitter = require('primus-emitter');
var PrimusRooms = require('primus-rooms');
var Emitter = require('events').EventEmitter;
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'websockets', parser: 'JSON' };

// creates the client
function client(srv, primus, port){
  var addr = srv.address();
  var url = 'http://' + addr.address + ':' + (port || addr.port);
  return new primus.Socket(url);
}

// creates the server
function server(srv, opts) {
  return Primus(srv, opts)  
  .use('multiplex', PrimusMultiplex)
  .use('emitter', PrimusEmitter)
  .use('rooms', PrimusRooms);
}

describe('primus-multiplex', function (){

  it('should have required methods', function (done){
    var srv = http();
    var primus = server(srv, opts);
    //primus.save('test.js');
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
      primus.on('connection', function (spark1) {
        spark1.on('data', function (data) {
          if ('hi' === data)
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

  it('should `emit` close event when destroying a channel', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        a.destroy();
      });
      a.on('close', function (spark) {
        done();
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
    });
  });

  it('should not allow sending data after channel is destroyed', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.write('hi');
        a.destroy();
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.on('data', function (data){
        done();
      });
    });
  });

  it('should emit `end` event on server when channel is destroyed', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.on('end', function () {
          done();
        });
        spark.end();
      });
    });
    var cl = client(srv, primus);
    var cla = cl.channel('a');
  });

  it('should emit `disconnection` event when ending a `connection` from client', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('disconnection', function (spark) {
        done();
      });
    });
    var cl = client(srv, primus);
    var cla = cl.channel('a');
    cla.end();
  });

  it('should emit `end` event when `channel` is destroyed', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        a.destroy();
      });
    });
    var cl = client(srv, primus);
    var cla = cl.channel('a');
    cla.on('end', function () {
      done();
    });
  });

  it('should decode a compound payload', function (done) {
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        spark.on('data', function (data) {
          expect(data).to.have.property('hello', 'world');
          done();
        });
      });
    });
    var cl = client(srv, primus);
    var cla = cl.channel('a');
    cla.write({ hello: 'world' });
  });

  it('should emit `end` event on server when main connection is destroyed', function(done){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    srv.listen(function(){
      a.on('connection', function (spark) {
        primus.destroy();
      });
      a.on('close', function () {
        done();
      });
    });
    var cl = client(srv, primus);
    var cla = cl.channel('a');
  });
 
  describe('primus-emitter', function () {

    it('should play nice with emitter', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          done();
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
    });

    it('should allow sending message from server to client', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.emit('msg', { hi: 'hello' });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.on('msg', function (msg) {
        expect(msg).to.be.eql({ hi: 'hello' });
        done();
      });
    });

    it('should allow sending message from client to server', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('msg', function (msg) {
            expect(msg).to.be.eql({ hi: 'hello' });
            done();
          });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.emit('msg', { hi: 'hello' });
    });

    it('should support ack on the client', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('msg', function (msg, fn) {
            expect(msg).to.be.eql({ hi: 'hello' });
            fn('thanks');
          });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.emit('msg', { hi: 'hello' }, function (msg) {
        expect(msg).to.be('thanks');
        done();
      });
    });

    it('should support ack on the server', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.emit('msg', { hi: 'hello' }, function (msg) {
            expect(msg).to.be('thanks');
            done();
          });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
      cla.on('msg', function (msg, fn) {
        expect(msg).to.be.eql({ hi: 'hello' });
        fn('thanks');
      });
    });

  });

  describe('primus-rooms', function () {

    it('should allow joining a room', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.join('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
    });

    it('should allow leaving a room', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.join('a');
          spark.leave('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus);
      var cla = cl.channel('a');
    });

    it('should allow broadcasting a message to a client', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            if ('me' === room) {
              spark.room('r1').write('hi');
            } else {
              spark.join(room);
            }
          });
        });
      });
      var cl = client(srv, primus);
      var c1a = cl.channel('a');
      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        done();
      });
      c1a.write('r1');
      setTimeout(function () {
        var me = cl.channel('a');
        me.write('me');
      }, 0);

    });

    it('should allow broadcasting a message to multiple clients', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      var count = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            if ('me' === room) {
              spark.room('r1 r2 r3').write('hi');
            } else {
              spark.join(room);
            }
          });
        });
      });


      var cl = client(srv, primus);
      var c1a = cl.channel('a');
      var c2a = cl.channel('a');
      var c3a = cl.channel('a');

      c1a.write('r1');
      c2a.write('r2');
      c3a.write('r3');

      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      c2a.on('data', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      c3a.on('data', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      setTimeout(function () {
        var me = cl.channel('a');
        me.write('me');
      }, 0);

    });

    it('should allow broadcasting a message to a client with emitter', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('broadcast' === msg) {
              spark.room('r1').emit('msg', 'hi');
            }
          });
        });
      });
      var cl = client(srv, primus);
      var c1a = cl.channel('a');
      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        done();
      });
      c1a.emit('join', 'r1');
      setTimeout(function () {
        var me = cl.channel('a');
        me.emit('msg', 'broadcast');
      }, 0);

    });

    it('should allow broadcasting a message to multiple clients with emitter', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      var count = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('broadcast' === msg) {
              spark.room('r1 r2 r3').emit('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus);
      var c1a = cl.channel('a');
      var c2a = cl.channel('a');
      var c3a = cl.channel('a');

      c1a.emit('join', 'r1');
      c2a.emit('join', 'r2');
      c3a.emit('join', 'r3');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        if (!--count) done();
      });

      setTimeout(function () {
        var me = cl.channel('a');
        me.emit('msg', 'broadcast');
      }, 0);

    });

  });

});