'use strict';

const rooms = require('primus-rooms');
const Primus = require('primus');
const http = require('http');

const multiplex = require('../../../');

const server = http.createServer();
const primus = new Primus(server);

// Add plugins
primus.plugin('multiplex', multiplex).plugin('rooms', rooms);

const a = primus.channel('a');

a.on('connection', (spark) => {
  spark.on('data', (room) => {
    if (room !== 'me') {
      return spark.join(room, () => console.log('joined room %s', room));
    }

    spark.room('room1 room2 room3').write('Welcome');
  });
});

const client = (room) => {
  const socket = new primus.Socket(`http://localhost:${server.address().port}`);

  const a = socket.channel('a');

  if (room === 'me') {
    setInterval(() => a.write(room), 3000);
  } else {
    a.write(room);
  }

  a.on('data', (data) => console.log(data));
};

server.listen(() => {
  console.log('listening on *:%d', server.address().port);

  client('room1');
  client('room2');
  client('room3');

  setTimeout(() => client('me'), 10);
});
