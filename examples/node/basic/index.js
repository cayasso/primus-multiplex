'use strict';

const Primus = require('primus');
const http = require('http');

const multiplex = require('../../../');

const server = http.createServer();
const primus = new Primus(server);

// Add multiplex plugin
primus.plugin('multiplex', multiplex);

const ann = primus.channel('ann');
const bob = primus.channel('bob');
const tom = primus.channel('tom');

ann.on('connection', (spark) => {
  console.log('connected to ann');
  spark.write('hi Ann');
});

bob.on('connection', (spark) => {
  console.log('connected to bob');
  spark.write('hi Bob');
});

tom.on('connection', (spark) => {
  console.log('connected to tom');
  spark.on('data', (msg) => console.log('[TOM] <- %s', msg));
  setInterval(() => spark.write('hola Tom'), 3000);
});

server.listen(() => {
  const port = server.address().port;
  console.log('listening on *:%d', port);

  const socket = new primus.Socket(`http://localhost:${port}`);

  const ann = socket.channel('ann');
  const bob = socket.channel('bob');
  const tom = socket.channel('tom');

  ann.on('data', (msg) => console.log('[ANN] -> %s', msg));
  bob.on('data', (msg) => console.log('[BOB] -> %s', msg));
  tom.on('data', (msg) => console.log('[TOM] -> %s', msg));

  setInterval(() => tom.write('hi'), 1000);
});
