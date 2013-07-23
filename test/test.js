var Primus = require('primus');
var multiplex = require('../');
var http = require('http').Server;
var expect = require('expect.js');
var opts = { transformer: 'sockjs', parser: 'JSON' };

