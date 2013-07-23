'use strict';

/**
 * Module dependencies.
 */

var Multiplex = require('./multiplex');

/**
 * Module exports.
 */

module.exports = {

  server: function server (primus) {
    var multiplex = new Multiplex(primus);
    primus.channel = function (name) {
      return multiplex.channel(name);
    };
  },

  client: function (primus) {

  }

};
