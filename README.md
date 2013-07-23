# Primus Emitter

[![Build Status](https://travis-ci.org/cayasso/primus-multiplex.png?branch=master)](https://travis-ci.org/cayasso/primus-multiplex)
[![NPM version](https://badge.fury.io/js/primus-multiplex.png)](http://badge.fury.io/js/primus-multiplex)

Node.JS module that adds mutiplexing to [Primus](https://github.com/3rd-Eden/primus).


## This is still in development, not released yet. soon!!!

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

server.listen(8080);
```

### On the Client

```

```

## API

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
