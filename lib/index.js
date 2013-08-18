/**
 * Module dependencies.
 */

var fs = require('fs');
var file = __dirname + '/../primus-multiplex.js';
var library = fs.readFileSync(file, 'utf-8');

/**
 * Exporting modules.
 */

exports.library = library;
exports.client = function(){};
exports.server = require('./server');
