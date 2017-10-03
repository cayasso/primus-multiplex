'use strict';

var Primus = require('primus')
  , multiplex = require('../')
  , EventEmitter = require('eventemitter3')
  , http = require('http').Server
  , expect = require('expect.js')
  , opts = { transformer: 'websockets', parser: 'JSON' }
  , primus
  , srv;

// creates the client
function client(srv, primus, options){
  var addr = srv.address() || {}
    , port = addr.port || 8080
    , url = 'http://localhost:' + port;
  return new primus.Socket(url, options);
}

// creates the server
function server(srv, opts) {
  return Primus(srv, opts).plugin('multiplex', multiplex);
}

describe('primus-multiplex', function (){

  beforeEach(function beforeEach() {
    srv = http();
    primus = server(srv, opts);
  });

  afterEach(function afterEach(done) {
    srv.close();
    setTimeout(done, 0);
  });

  it('should have required methods', function (done){

    //primus.save('test.js');
    srv.listen(function () {
      var cl = client(srv, primus);
      expect(primus.channel).to.be.a('function');
      expect(cl.channel).to.be.a('function');
      done();
    });
  });

  it('should return EventEmitter instances', function (){

    var a = primus.channel('a')
      , b = primus.channel('b')
      , c = primus.channel('c');

    expect(a).to.be.a(EventEmitter);
    expect(b).to.be.a(EventEmitter);
    expect(c).to.be.a(EventEmitter);

    srv.listen();
  });

  it('should get spark by id', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        var conn = a.spark(spark.id);
        expect(spark).to.equal(conn);
        done();
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a');
    });
  });

  it('should establish a connection', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        done();
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a');
    });
  });

  it('should only emit one connection when client is started before server', function (done) {
    setTimeout(function () {
      var a = primus.channel('a');
      a.on('connection', function (spark) {
        done();
      });
      srv.listen(8080);
    }, 0);

    var cl = client(srv, primus);
    var ca = cl.channel('a');
  });

  it('should create channel dynamically and fire subscribe', function (done) {
    primus.on('connection', function(spark) {
      spark.on('subscribe', function(channel, channelSpark) {
        expect(channel.name).to.be('a');
        expect(channelSpark).to.be.ok();
        done();
      });
    });
    srv.listen();

    var cl = client(srv, primus);
    cl.channel('a');
  });

  it('should fire unsubscribe upon client close', function (done) {
    primus.on('connection', function(spark) {
      spark.on('subscribe', function(channel, channelSpark) {
        spark.on('unsubscribe', function(channel, channelSpark) {
          expect(channelSpark.conn.channels[channelSpark.id]).to.be(undefined);
          expect(Object.keys(channelSpark.conn.channels).length).to.be(0);
          expect(channel.name).to.be('a');
          expect(channelSpark).to.be.ok();
          done();
        });
      });
    });
    srv.listen();

    var cl = client(srv, primus);

    cl.channel('a').end();
  });

  it('should fire unsubscribe upon spark close', function (done) {
    primus.on('connection', function(spark) {
      spark.on('subscribe', function(channel, channelSpark) {
        spark.on('unsubscribe', function(channel, channelSpark) {
          expect(channel.name).to.be('a');
          expect(channelSpark).to.be.ok();
          done();
        });
        spark.end();
      });
    });
    srv.listen();

    var cl = client(srv, primus);

    cl.channel('a');
  });

  it('should allow sending message from client to server', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          done();
        });
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a');
      ca.write('hi');
    });
  });

  it('should allow sending message from server to client', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.write('hi');
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a');
      ca.on('data', function (data) {
        expect(data).to.be('hi');
        done();
      });
    });
  });

  it('should not intercept regular socket connections on data', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
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
      var cl = client(srv, primus)
        , ca = cl.channel('a');
      ca.write('hi');
    });

  });

  it('should only receive data from corresponding client', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data) {
          expect(data).to.be('hi');
          done();
        });
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a')
        , cb = cl.channel('b')
        , cc = cl.channel('c');

      ca.write('hi');
      cb.write('hi');
      cc.write('hi');
    });
  });

  it('should only receive data from corresponding channel', function (done) {
    var a = primus.channel('a')
      , b = primus.channel('b')
      , c = primus.channel('c')
      , count = 3;

    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.write('hi a');
      });
      b.on('connection', function (spark) {
        spark.write('hi b');
      });
      c.on('connection', function (spark) {
        spark.write('hi c');
      });
      var cl = client(srv, primus)
        , ca = cl.channel('a')
        , cb = cl.channel('b')
        , cc = cl.channel('c');

      ca.on('data', function (data) {
        expect(data).to.be('hi a');
        finish();
      });
      cb.on('data', function (data) {
        expect(data).to.be('hi b');
        finish();
      });
      cc.on('data', function (data) {
        expect(data).to.be('hi c');
        finish();
      });

      function finish() {
        if (!--count) done();
      }
    });
  });

  it('should allow multiple client connections', function (done) {

    var count = 3
      , a = primus.channel('a')
      , b = primus.channel('b')
      , c = primus.channel('c');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          finish();
        });
      });
      b.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          finish();
        });
      });
      c.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          finish();
        });
      });

      function finish() {
        if (!--count) done();
      }

      var cl = client(srv, primus)
        , cla = cl.channel('a')
        , clb = cl.channel('b')
        , clc = cl.channel('c');

      cla.write('hi');
      clb.write('hi');
      clc.write('hi');
    });
  });

  it('should allow multiple client connections to the same channel', function (done) {
    var count = 3
      , a = primus.channel('a')
      , b = primus.channel('b')
      , c = primus.channel('c');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data){
          expect(data).to.be('hi');
          if (!--count) done();
        });
      });
      var cl = client(srv, primus)
        , cl1 = cl.channel('a')
        , cl2 = cl.channel('a')
        , cl3 = cl.channel('a');
      cl1.write('hi');
      cl2.write('hi');
      cl3.write('hi');
    });
  });

  it('should be able to disconnect from a channel', function (done) {

    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data){
          done();
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.write('hi');
      cla.end();
      cla.write('hi again');
    });
  });

  describe('cleaning up client events', function () {
    Object.keys(Primus.createSocket().prototype.reserved.events).forEach(function (ev) {
      if ('data' === ev || 'end' === ev) return;

      it('should remove the ' + ev + ' listener when client disconnects', function (done) {
        srv.listen(function () {
          var a = primus.channel('a');

          a.on('disconnection', function () {
            expect(cl.listeners(ev)).to.have.length(eventCount);

            done();
          });

          var cl = client(srv, primus)
            , eventCount = cl.listeners(ev).length
            , ca = cl.channel('a');

          ca.end();
        });
      });
    });
  });

  it('should emit `close` event when destroying a channel', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        a.destroy();
      });
      a.on('close', function (spark) {
        done();
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });
  });

  it('should emit `close` event on client when destroying a channel', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        a.destroy();
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.on('close', done)
    });
  });

  it('should emit `readyStateChange` event when readyState changes', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      var cl = client(srv, primus)
        , cla = cl.channel('a');

      // Expected transitions: CLOSED:2 -> OPENING:1 -> OPEN:3
      expect(cla.readyState).to.be(2);
      var expectedReadyState = 1;
      cla.on('readyStateChange', function () {
        expect(cla.readyState).to.be(expectedReadyState);
        if (cla.readyState === 3) return done();
        expectedReadyState = 3;
      });
    });
  });

  it('should not allow sending data after channel is destroyed', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.write('hi');
        a.destroy();
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
        spark.write('hi');
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.on('data', function (data) {
        expect(data).to.be('hi');
        done();
      });
    });
  });

  it('should emit `end` event on server when channel is destroyed', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('end', function () {
          done();
        });
        spark.end();
      });
    });
    var cl = client(srv, primus)
      , cla = cl.channel('a');
  });

  it('should emit `disconnection` event when ending a `connection` from client', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('disconnection', function (spark) {
        done();
      });
    });
    var cl = client(srv, primus)
      , cla = cl.channel('a');
    cla.end();
  });

  it('should emit `end` event when `channel` is destroyed', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        a.destroy();
      });
    });
    var cl = client(srv, primus)
      , cla = cl.channel('a');
    cla.on('end', function () {
      done();
    });
  });

  it('should decode a compound payload', function (done) {
    var a = primus.channel('a');
    srv.listen(function () {
      a.on('connection', function (spark) {
        spark.on('data', function (data) {
          expect(data).to.have.property('hello', 'world');
          done();
        });
      });
    });
    var cl = client(srv, primus)
      , cla = cl.channel('a');
    cla.write({ hello: 'world' });
  });

  it('should emit `close` event on server when main connection is destroyed', function (done) {
    srv.listen();

    var sv = http()
      , primus = Primus(sv, opts).plugin('multiplex', multiplex)
      , a = primus.channel('a');

    sv.listen(function () {
      a.on('connection', function (spark) {
        primus.destroy();
      });
      a.on('close', function () {
        done();
      });
    });
    var cl = client(sv, primus)
      , cla = cl.channel('a');
  });

  it('should emit `disconnection` event on all connected sparks when main ' +
     'connection closes on client', function (done) {

    var a = primus.channel('a')
      , b = primus.channel('b')
      , count = 0
      , ids = []
      , reconnected = false;

    srv.listen(function () {
      primus.on('connection', function (conn) {
        a.on('connection', function (spark) {
          if (!reconnected) {
            ++count;
            ids.push(spark.id);
          }
        });
        b.on('connection', function (spark) {
          if (!reconnected) {
            ++count;
            ids.push(spark.id);
            if (count >= 4) {
              spark.conn.end(undefined, { reconnect: true });
              reconnected = true;
            }
          }
        });
        a.on('disconnection', function (spark) {
          expect(ids).to.contain(spark.id);
          if (!--count) done();
        });
        b.on('disconnection', function (spark) {
          expect(ids).to.contain(spark.id);
          if (!--count) done();
        });
      });
    });

    var cl = client(srv, primus, { strategy: false })
      , cla1 = cl.channel('a')
      , cla2 = cl.channel('a')
      , clb1 = cl.channel('b')
      , clb2 = cl.channel('b');
  });

  // See https://github.com/cayasso/primus-multiplex/issues/21
  it('should automatically close child sparks even if channel name ' +
    'is complex,', function(done) {
      var a = primus.channel('a:complex:name')
        , count = 0
        , ids = []

      srv.listen(function () {
        primus.on('connection', function (conn) {
          a.on('connection', function (spark) {
            ++count;
            ids.push(spark.id);
            if (count >= 2) {
              spark.conn.end(undefined, { reconnect: false });
            }
          });
          a.on('disconnection', function (spark) {
            expect(ids).to.contain(spark.id);
            if (!--count) done();
          });
        });
      });

      var cl = client(srv, primus, { strategy: false })
        , cla1 = cl.channel('a:complex:name')
        , cla2 = cl.channel('a:complex:name');
  });

  it('should emit `reconnect` and `reconnecting` event when the main ' +
   'connection closes unexcpectingly', function (done) {

    var a = primus.channel('a')
      , reconnected = false
      , reconnecting = false;

    srv.listen(function () {
      a.on('connection', function (spark) {
        if (!reconnected) {
          reconnected = true;
          spark.conn.end(undefined, { reconnect: true });
        }
      });
    });

    var cl = client(srv, primus)
      , cla = cl.channel('a');

    cla.on('reconnect', function () {
      expect(reconnecting).to.be(true);
      cl.end();
      cla.end();
      done();
    });

    cla.on('reconnect scheduled', function () {
      reconnecting = true;
    });
  });

  describe('primus-emitter', function () {

    it('should play nice with emitter', function (done) {
      primus.plugin('emitter', 'primus-emitter');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          done();
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });

    it('should allow sending message from server to client', function (done) {
      primus.plugin('emitter', 'primus-emitter');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.send('msg', { hi: 'hello' });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.on('msg', function (msg) {
        expect(msg).to.be.eql({ hi: 'hello' });
        done();
      });
    });

    it('should allow sending message from client to server', function (done) {
      primus.plugin('emitter', 'primus-emitter');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('msg', function (msg) {
            expect(msg).to.be.eql({ hi: 'hello' });
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.send('msg', { hi: 'hello' });
    });

    it('should support ack on the client', function (done) {
      primus.plugin('emitter', 'primus-emitter');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('msg', function (msg, fn) {
            expect(msg).to.be.eql({ hi: 'hello' });
            fn('thanks');
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.send('msg', { hi: 'hello' }, function (msg) {
        expect(msg).to.be('thanks');
        done();
      });
    });

    it('should support ack on the server', function (done) {
      primus.plugin('emitter', 'primus-emitter');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.send('msg', { hi: 'hello' }, function (msg) {
            expect(msg).to.be('thanks');
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
      cla.on('msg', function (msg, fn) {
        expect(msg).to.be.eql({ hi: 'hello' });
        fn('thanks');
      });
    });
  });

  describe('primus-rooms', function () {

    it('should allow joining a room', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.join('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });

    it('should allow leaving a room', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.join('a');
          spark.leave('a', function () {
            done();
          });
        });
      });
      var cl = client(srv, primus)
        , cla = cl.channel('a');
    });

    it('should allow broadcasting a message to a client', function (done) {
      primus.plugin('rooms', 'primus-rooms');
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
      var cl = client(srv, primus)
        , c1a = cl.channel('a');
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

    it('should allow broadcasting a message to multiple clients', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , total = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            spark.join(room);
            if ('send' === room) {
              spark.room('r1 r2 r3').write('hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.write('r1');
      c2a.write('r2');
      c3a.write('r3');

      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.write('send');
      }, 100);

    });

    it('should allow broadcasting a message to multiple clients with channel `write` method', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , total = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            spark.join(room);
            if ('send' === room) {
              a.room('r1 r2 r3').write('hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.write('r1');
      c2a.write('r2');
      c3a.write('r3');

      c1a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('data', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('data', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.write('send');
      }, 100);

    });

    it('should allow defining exception ids when broadcasting', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , total = 0
        , sender
        , except = [];

      srv.listen(function () {

        a.on('connection', function (spark) {
          spark.on('data', function (data) {
            if (/room1|room2/.test(data)) {
              except.push(spark.id);
            }
            if ('send' === data) {
              sender = spark;
            }
            spark.join(data, function () {
              if (4 === ++total) {
                sender.room('room1 room2 room3').except(except).write('hi');
              }
            });
          });
        });

        var cl = client(srv, primus)
          , c1a = cl.channel('a')
          , c2a = cl.channel('a')
          , c3a = cl.channel('a')
          , c4a = cl.channel('a');

        c1a.on('data', function (msg) {
          done(new Error('not'));
        });

        c2a.on('data', function (msg) {
          done(new Error('not'));
        });

        c3a.on('data', function (msg) {
          expect(msg).to.be('hi');
          done();
        });

        c4a.on('data', function (msg) {
          done(new Error('not'));
        });

        c1a.write('room1');
        c2a.write('room2');
        c3a.write('room3');
        c4a.write('send');
      });
    });

    it('should allow broadcasting a message to multiple clients with channel `send` method', function (done) {

      primus.plugin('emitter', 'primus-emitter');
      primus.plugin('rooms', 'primus-rooms');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
            if ('send' === room) {
              a.room('r1 r2 r3').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('join', 'send');
      }, 100);

    });

    it('should allow broadcasting a message to a client with emitter', function (done) {

      primus.plugin('emitter', 'primus-emitter');
      primus.plugin('rooms', 'primus-rooms');

      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('broadcast' === msg) {
              spark.room('r1').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a');
      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        done();
      });
      c1a.send('join', 'r1');
      setTimeout(function () {
        var me = cl.channel('a');
        me.send('msg', 'broadcast');
      }, 0);

    });

    it('should allow broadcasting a message to multiple clients with emitter', function (done) {

      primus.plugin('rooms', 'primus-rooms');
      primus.plugin('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
            if ('send' === room) {
              spark.room('r1 r2 r3').send('msg', 'hi');
              return;
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');
      c3a.send('join', 'r4');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('join', 'send');
      }, 100);

    });

    it('should get all clients synchronously if no callback is provided using channel method', function (done) {
      var ids = [];
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , count = 0;

      srv.listen(function(){
        a.on('connection', function(spark){
          ids.push(spark.id);
          a.join(spark, 'room1');
          if (3 === ++count) {
            var clients = a.in('room1').clients();
            expect(clients).to.be.eql(ids);
            done();
          }
        });

        var cl = client(srv, primus);
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
      });
    });

    it('should join spark to a room using channel method', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(true);
              done();
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should remove spark from room using channel method', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1', function () {
              spark.room('room1').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.eql(false);
                done();
              });
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should check if a room is empty from spark', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , clients = []
        , total = 0;
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('room1', function () {
            clients.push(spark);
            if (3 === total++) {
              clients.forEach(function (s) {
                expect(spark.isRoomEmpty('room1')).to.be.eql(false);
                s.leaveAll();
              });
              expect(spark.room('room1').isRoomEmpty()).to.be.eql(true);
              done();
            }
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
      });
    });

    it('should check if a room is empty from channel', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a')
        , clients = []
        , total = 0;
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('room1', function () {
            clients.push(spark);
            if (3 === total++) {
              clients.forEach(function (s) {
                expect(a.isRoomEmpty('room1')).to.be.eql(false);
                s.leaveAll();
              });
              expect(a.in('room1').isRoomEmpty()).to.be.eql(true);
              done();
            }
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
      });
    });

    it('should return all rooms on channel', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('a', function () {
            spark.join('b', function () {
              spark.leave('c', function () {
                expect(a.rooms()).to.eql(['a', 'b']);
                done();
              });
            });
          });
        });
        client(srv, primus).channel('a');
      });
    });

    it('should return all rooms of specific client from channel', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function () {
        var first = true;
        a.on('connection', function (spark) {
          if (first) {
            spark.join('a', function () {
              spark.join('b', function () {
                spark.leave('c', function () {
                  expect(a.rooms(spark)).to.eql(['a', 'b']);
                  client(srv, primus).channel('a');
                });
              });
            });
            first = false;
          } else {
            spark.join('d', function () {
              spark.join('e', function () {
                spark.leave('f', function () {
                  expect(a.rooms(spark)).to.eql(['d', 'e']);
                  done();
                });
              });
            });
          }
        });
        client(srv, primus).channel('a');
      });
    });

    it('should trigger `joinroom` event when joining room', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('room1');
          spark.on('joinroom', function (room) {
            expect(room).to.be.eql('room1');
            done();
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('room1', function () {
            spark.leave('room1');
            spark.on('leaveroom', function (room) {
              expect(room).to.be.eql('room1');
              a.empty(done);
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveallrooms` events on client disconnect', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.join('a');
          a.on('leaveallrooms', function (rooms, spark) {
            done();
          });
          spark.write('end');
        });

        var cl = client(srv, primus, { strategy: false })
          , cla = cl.channel('a');
        cla.on('data', function (data) {
          if ('end' === data) cla.end();
        });
      });
    });

    it('should trigger `joinroom` event when joining room using channel join method', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1');
          a.on('joinroom', function (room, socket) {
            expect(room).to.be.eql('room1');
            expect(spark).to.be.eql(socket);
            done();
          });
        });

        var cl = client(srv, primus)
          , cla = cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room using channel leave method', function (done) {
      primus.plugin('rooms', 'primus-rooms');
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1');
            a.on('leaveroom', function (room, socket) {
              expect(room).to.be.eql('room1');
              expect(spark).to.be.eql(socket);
              done();
            });
          });
        });

        var cl = client(srv, primus)
          , cla = cl.channel('a');
      });
    });

  });

  describe('primus-emitter + primus-rooms', function () {

    it('should allow broadcasting a message to multiple rooms with emitter from channel', function (done) {

      primus.plugin('rooms', 'primus-rooms');
      primus.plugin('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('broadcast' === msg) {
              a.room('r1 r2 r3').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('msg', 'broadcast');
      }, 100);

    });

  it('should allow broadcasting a message to multiple rooms with emitter from client', function (done) {

      primus.plugin('rooms', 'primus-rooms');
      primus.plugin('emitter', 'primus-emitter');

      var a = primus.channel('a')
        , total = 3;

      srv.listen(function () {
        a.on('connection', function (spark) {
          spark.on('join', function (room) {
            spark.join(room);
          });

          spark.on('msg', function (msg) {
            if ('send' === msg) {
              spark.room('r1 r2 r3').send('msg', 'hi');
            }
          });
        });
      });

      var cl = client(srv, primus)
        , c1a = cl.channel('a')
        , c2a = cl.channel('a')
        , c3a = cl.channel('a')
        , c4a = cl.channel('a');

      c1a.send('join', 'r1');
      c2a.send('join', 'r2');
      c3a.send('join', 'r3');

      c1a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c2a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c3a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        finish();
      });

      c4a.on('msg', function (msg) {
        expect(msg).to.be('hi');
        done(new Error('not'));
      });

      function finish() {
        if (1 > --total) done();
      }

      setTimeout(function () {
        c4a.send('msg', 'send');
      }, 100);

    });
  });

});
