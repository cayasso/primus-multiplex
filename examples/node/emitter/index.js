'use strict';

const emitter = require('primus-emitter');
const Primus = require('primus');
const http = require('http');

const multiplex = require('../../../');

const server = http.createServer();
const primus = new Primus(server);

// Add plugins
primus.plugin('emitter', emitter).plugin('multiplex', multiplex);

const ann = primus.channel('ann');
const bob = primus.channel('bob');
const tom = primus.channel('tom');

ann.on('connection', (spark) => {
  console.log('connected to ann');
  spark.send('hi', 'hi Ann');
});

bob.on('connection', (spark) => {
  console.log('connected to bob');
  spark.send('hi', 'hi Bob');
});

tom.on('connection', (spark) => {
  console.log('connected to tom');
  spark.on('hi', (msg) => console.log('[TOM] <- %s', msg));
  setInterval(() => spark.send('hi', 'hola Tom'), 3000);
});

server.listen(() => {
  const port = server.address().port;
  console.log('listening on *:%d', port);

  const socket = new primus.Socket(`http://localhost:${port}`);

  const ann = socket.channel('ann');
  const bob = socket.channel('bob');
  const tom = socket.channel('tom');

  ann.on('hi', (msg) => console.log('[ANN] -> %s', msg));
  tom.on('hi', (msg) => console.log('[TOM] -> %s', msg));
  bob.on('hi', (msg) => console.log('[BOB] -> %s', msg));

  setInterval(() => tom.send('hi', 'hi'), 1000);
});
