'use strict';

/**
 * Module dependencies.
 */

var spark = require('./spark')
  , multiplex = require('./multiplex');

/**
 * Plugin client method.
 *
 * @param {Primus} primus The primus instance.
 * @api public
 */

exports.client = function client(primus) {

  // multiplex instance.
  var multiplex = new Primus.PrimusMultiplex(primus);
  
  /**
   * Return a `Channel` instance.
   *
   * @param {String} name The channel name.
   * @return {multiplex.Spark}
   * @api public
   */

  primus.channel = function channel(name) {
    return multiplex.channel(name);
  };
};

/**
 * Source code for plugin library.
 *
 * @type {String}
 * @api public
 */

exports.source = [
  ';(function (Primus, undefined) {',
    spark.toString(),
    multiplex.toString(),
  ' if (undefined !== Primus)',
  ' Primus.PrimusMultiplex = multiplex(spark());',
  '})(Primus);'
].join('\n');


exports.Multiplex = multiplex();
exports.Spark = spark();
