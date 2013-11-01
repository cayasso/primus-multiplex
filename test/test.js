var Primus = require('primus');
var PrimusMultiplex = require('../');
var PrimusEmitter = require('primus-emitter');
var PrimusRooms = require('primus-rooms');
var Emitter = require('events').EventEmitter;
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'websockets', parser: 'JSON' };

// creates the client
function client(srv, primus, port, address){
  var addr = srv.address() || {};

  address = address || addr.address;
  port = port || addr.port;

  var url = 'http://' + address + ':' + port;
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

  it('should return EventEmitter instances', function (){
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    var b = primus.channel('b');
    var c = primus.channel('c');
    expect(a).to.be.a(Emitter);
    expect(b).to.be.a(Emitter);
    expect(c).to.be.a(Emitter);
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

  /*it('should only emit one connection when client is started before server', function(done){
    this.timeout(0);
    var srv = http();
    var primus = server(srv, opts);
    

    setTimeout(function () {
      var a = primus.channel('a');
      a.on('connection', function (spark) {
        //done();
      });
      srv.listen(8080);
    }, 100);
    

    var cl = client(srv, primus, 8080, 'localhost');
    var ca = cl.channel('a');
  });*/

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

  it('should emit `close` event on server when main connection is destroyed', function(done){
    
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

  it('should emit `disconnection` event on all connected sparks when main connection closes on client', function (done) {
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    var b = primus.channel('b');
    var count = 0;
    var ids = [];
    reconnected = false;

    srv.listen(function(){
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

              // Forcefully kill a connection to trigger a reconnect
              switch (opts.transformer.toLowerCase()) {
                case 'socket.io':
                  primus.transformer.service.transports[conn.id].close();
                break;

                default:
                  conn.emit('outgoing::end');
              }

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

    var cl = client(srv, primus);
    var cla1 = cl.channel('a');
    var cla2 = cl.channel('a');
    var clb1 = cl.channel('b');
    var clb2 = cl.channel('b');
  });

  it('should emit `reconnect` and `reconnecting` event when the main connection closes unexcpectingly', function (done) {
    var srv = http();
    var primus = server(srv, opts);
    var a = primus.channel('a');
    var reconnected = false;
    var reconnecting = false;

    srv.listen(function(){
      a.on('connection', function (spark) {
        if (!reconnected) {
          reconnected = true;

          // Forcefully kill a connection to trigger a reconnect
          switch (opts.transformer.toLowerCase()) {
            case 'socket.io':
              primus.transformer.service.transports[spark.conn.id].close();
            break;

            default:
              spark.conn.emit('outgoing::end');
          }
        }
      });
    });

    var cl = client(srv, primus);
    var cla = cl.channel('a');

    cla.on('reconnect', function () {
      expect(reconnecting).to.be(true);
      done();
    });

    cla.on('reconnecting', function () {
      reconnecting = true;
    });
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

    it('should allow broadcasting a message to multiple clients with channel `room` method', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      var count = 3;

      srv.listen(function(){
        a.on('connection', function (spark) {
          spark.on('data', function (room) {
            if ('me' === room) {
              a.room('r1 r2 r3').write('hi');
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

    it('should get all clients synchronously if no callback is provided using channel method', function(done){
      var ids = [];
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      var count = 0;

      srv.listen(function(){
        a.on('connection', function(spark){
          ids.push(spark.id);
          a.join(spark, 'room1');

          if (3 === ++count) {
            var clients = a.in('room1').clients();
            expect(clients).to.be.eql(ids);
            srv.close();
            done();
          }
        });

        var cl = client(srv, primus);
        cl.channel('a');
        cl.channel('a');
        cl.channel('a');
      });
    });

    it('should join spark to a room using channel method', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            spark.room('room1').clients(function (err, clients) {
              expect(!!~clients.indexOf(spark.id)).to.eql(true);
              srv.close();
              done();
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should remove spark form room using channel method', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1', function () {
              spark.room('room1').clients(function (err, clients) {
                expect(!!~clients.indexOf(spark.id)).to.eql(false);
                srv.close();
                done();
              });
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `joinroom` event when joining room', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('room1');
          spark.on('joinroom', function (room) {
            expect(room).to.be.eql('room1');
            srv.close();
            done();
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('room1', function () {
            spark.leave('room1');
            spark.on('leaveroom', function (room) {
              expect(room).to.be.eql('room1');
              srv.close();
              done();
            });
          });
        });
        var cl = client(srv, primus);
        cl.channel('a');
      });
    });

    it('should trigger `leaveallrooms` events on client disconnect', function(done){
      this.timeout(0);
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          spark.join('a');
          spark.on('leaveallrooms', function (rooms) {
            expect(rooms).to.be.eql(['a']);
            srv.close();
            done();
          });
          spark.write('end');
        });

        var cl = client(srv, primus);
        var cla = cl.channel('a');

        cla.on('data', function (data) {
          if ('end' === data) cla.end();
        });
      });
    });

    it('should trigger `joinroom` event when joining room using channel join method', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');

      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1');
          a.on('joinroom', function (room, socket) {
            expect(room).to.be.eql('room1');
            expect(spark).to.be.eql(socket);
            srv.close();
            done();
          });
        });
        var cl = client(srv, primus);
        var cla = cl.channel('a');
      });
    });

    it('should trigger `leaveroom` event when leaving room using channel leave method', function(done){
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'room1', function () {
            a.leave(spark, 'room1');
            a.on('leaveroom', function (room, socket) {
              expect(room).to.be.eql('room1');
              expect(spark).to.be.eql(socket);
              srv.close();
              done();
            });
          });
        });
        var cl = client(srv, primus);
        var cla = cl.channel('a');
      });
    });

    it('should trigger `leaveallrooms` events on client disconnect when listening on channel', function(done){
      this.timeout(0);
      var srv = http();
      var primus = server(srv, opts);
      var a = primus.channel('a');
      srv.listen(function(){
        a.on('connection', function(spark){
          a.join(spark, 'a');
          a.on('leaveallrooms', function (rooms, socket) {
            expect(rooms).to.be.eql(['a']);
            expect(spark).to.be.eql(socket);
            srv.close();
            done();
          });
          spark.write('end');
        });

        var cl = client(srv, primus);
        var cla = cl.channel('a');

        cla.on('data', function (data) {
          if ('end' === data) cla.end();
        });
      });
    });
  });

});