# Primus Emitter

[![Build Status](https://travis-ci.org/cayasso/primus-multiplex.png?branch=master)](https://travis-ci.org/cayasso/primus-multiplex)
[![NPM version](https://badge.fury.io/js/primus-multiplex.png)](http://badge.fury.io/js/primus-multiplex)

Node.JS module that adds mutiplexing to [Primus](https://github.com/3rd-Eden/primus).

## Instalation

```
$ npm install primus-multiplex
```

## Usage

### On the Server

```
var Primus = require('primus');
var multiplex = require('primus-multiplex');
var server = require('http').createServer();

// primus instance
var primus = new Primus(server, { transformer: 'sockjs', parser: 'JSON' });

// add multiplex to Primus
primus.use('multiplex', multiplex);

var news = primus.channel('news');
news.on('connection', function (spark) {
  
  spark.write('hi from the news channel');

  spark.on('data', function (data) {
    spark.write(data);
  });

});

var sport = primus.channel('sport');
sport.on('connection', function (spark) {
  
  spark.write('hi from the sport channel');

  spark.on('data', function (data) {
    spark.write(data);
  });

});

server.listen(8080);
```

### On the Client

```
var primus = Primus.connect('ws://localhost:8080');

// Connect to channels
var news = primus.channel('news');
var sport = primus.channel('sport');

// Send message
news.write('hi news channel');
sport.write('hi sport channel');

```

## API

### Server

#### primus#channel(name)

Create a new channel.

```
var news = primus.channel('news');
news.on('connection', fn);
```

#### spark#end([fn])

End the connection.

```
news.on('connection', function (spark) {
  spark.end(fn);
});
```

#### spark#destroy()

Destroy the connection and remove all listeners.

```
news.on('connection', function (spark) {
  spark.destroy();
});
```

#### spark.on('close', fn)
Triggers when the destroy method is called.

### Client

#### spark#end()

Disconnect from a channel.

```
var news = primus.channel('news');
news.end();
```

## Protocol

## Run tests

```
$ make test
```

## License

(The MIT License)

Copyright (c) 2013 Jonathan Brumley &lt;cayasso@gmail.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
