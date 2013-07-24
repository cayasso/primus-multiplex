'use strict';

/**
 * Module dependencies.
 */

var MultiplexServer = require('./server');
var MultiplexClient = require('./client');

/**
 * Module exports.
 */

module.exports = {

  server: function (primus, options) {
    new MultiplexServer(primus, options);
  },

  client: MultiplexClient
};
