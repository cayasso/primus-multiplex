/**
 * Module dependencies.
 */

var fs = require('fs');
var file = __dirname + '/../primus-multiplex.js';
var library = fs.readFileSync(file, 'utf-8');
var PrimusMultiplex = require('./server')

/**
 * Exporting modules.
 */

exports.library = library;
exports.client = function(){};
exports.server = PrimusMultiplex;
exports.PrimusMultiplex = PrimusMultiplex;
