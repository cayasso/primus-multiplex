var Primus = require('primus');
var Multiplex = require('../../../');

var Socket = Primus.createSocket({ transformer: 'websockets', plugin: { multiplex: Multiplex } });
var socket = new Socket('http://localhost:8080');

socket.on('open', function() {
  console.log('WS: open');
});

socket.on('reconnect', function(opts) {
  console.log('WS: reconnect');
});

socket.on('reconnecting', function(opts) {
  console.log('WS: reconnecting');
});

socket.channel('api');