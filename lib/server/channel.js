'use strict';

/**
 * Module dependenceies.
 */

var Spark = require('./spark')
  , Emitter = require('eventemitter3');

/**
 * Expoport `Channel` module.
 */

module.exports = Channel;

/**
 * `Channel` constructor.
 *
 * @constructor
 * @param {Multiplex} mp Multiplex object.
 * @param {String} name Channel name.
 * @api public
 */

function Channel(mp, name) {
  if (!(this instanceof Channel)) return new Channel(mp, name);
  this.mp = mp;
  this.name = name;
  this.connections = {};
  this.initialise();
}

/**
 * Inherits from `EventEmitter`.
 */

Channel.prototype.__proto__ = Emitter.prototype;

/**
 * Initialise the `Channel`.
 *
 * @return {Channel} this.
 * @api private
 */

Channel.prototype.initialise = function initialise() {

  var chnl = this
    , primus = this.mp.primus;

  if ('emitter' in primus.$) {
    primus.$.emitter.spark(Spark, primus.$.emitter.emitter());
  }

  // Create a pre-bound Spark constructor.
  this.Spark = function Sparky(conn, id) {
    return Spark.call(this, chnl, conn, id);
  };

  this.Spark.prototype = Object.create(Spark.prototype, {
    constructor: {
      value: this.Spark,
      writable: true,
      enumerable: false,
      configurable: true
    }
  });

  // Copy over the original Spark static properties and methods so readable and
  // writable can also be used.
  for (var key in Spark) this.Spark[key] = Spark[key];

  return this;
};

/**
 * Emit incoming message on specific `spark`.
 *
 * @param {String|Number} id The connection id.
 * @param {Mixed} data The message that needs to be written.
 * @return {Channel} this.
 * @api private
 */

Channel.prototype.message = function message(id, data) {
  var spark = this.connections[id];
  if (spark) process.nextTick(function tick() {
    spark.emit('data', data);
  });
  return this;
};

/**
 * Subscribe a connection to this `channel`.
 *
 * @param {primus.Spark} conn The incoming connection object.
 * @param {String|Number} id, The connection id.
 * @return {Channel} this.
 * @api private
 */

Channel.prototype.subscribe = function subscribe(conn, id) {
  if (this.connections[id]) return this;
  var spark = new this.Spark(conn, id);
  this.connections[spark.id] = spark;
  conn.channels[this.name] = conn.channels[this.name] || [];
  conn.channels[this.name].push(spark.id);
  conn.emit('subscribe', this, spark);
  return this;
};

/**
 * Unsubscribe a connection from this `channel`.
 *
 * @param {String|Number} id The connection id.
 * @param {Boolean} ignore
 * @return {Channel} this
 * @api private
 */

Channel.prototype.unsubscribe = function unsubscribe(id) {
  var spark = this.connections[id];
  if (spark && !spark.unsubscribed) {
    spark.conn.emit('unsubscribe', this, spark);
    spark.unsubscribed = true;
    spark.end();
    delete this.connections[id];
  }
  return this;
};

/**
 * Iterate over the connections.
 *
 * @param {Function} fn The function that is called every iteration.
 * @api public
 */

Channel.prototype.forEach = function forEach(fn) {
  for (var id in this.connections) {
    fn(this.connections[id], id, this.connections);
  }
  return this;
};

/**
 * Broadcast the message to all connections.
 *
 * @param {Mixed} data The data you want to send.
 * @api public
 */

Channel.prototype.write = function write(data) {
  this.forEach(function each(spark) {
    spark.write(data);
  });
  return true;
};

/**
 * Broadcast the message to all connections.
 *
 * @param {String} ev The event.
 * @param {Mixed} [data] The data to broadcast.
 * @param {Function} [fn] The callback function.
 * @api public
 */

Channel.prototype.send = function send(ev, data, fn) {
  if (!this.mp.primus.$.emitter) return this.write(ev);
  var args = arguments;
  this.forEach(function each(spark) {
    spark.send.apply(spark, args);
  });
};

/**
 * Destroy this `Channel` instance.
 *
 * @param {Function} fn Callback.
 * @return {Channel} this
 * @api public
 */

Channel.prototype.destroy = function destroy(fn) {
  this.forEach(function each(spark) {
    spark.end();
  });

  this.sparks = 0;
  this.connections = {};
  this.emit('close');
  this.removeAllListeners();

  if ('function' === typeof fn) fn();
  return this;
};

/**
 * Checks if the given event is an emitted event by Primus.
 *
 * @param {String} ev The event name.
 * @returns {Boolean}
 * @api public
 */

Channel.prototype.reserved = function reserved(ev) {
  return (/^(incoming|outgoing)::/).test(ev)
  || ev in this.mp.primus.reserved.events
  || ev in this.reserved.events;
};

/**
 * The custom events used by `Channel`.
 *
 * @type {Object}
 * @api public
 */

Channel.prototype.reserved.events = {};

/**
 * Encode data to return a multiplex packet.
 *
 * @param {Number} type
 * @param {String} id
 * @param {Object} data
 * @return {Object} pack
 * @api private
 */

Channel.prototype.packet = function packet(type, id, data) {
  var pack = [type, id, this.name];
  if (data) pack.push(data);
  return pack;
};

/**
 * Return a spark via its id.
 *
 * @param {String} id
 * @return {Spark}
 * @api public
 */

Channel.prototype.spark = function spark(id) {
  return this.connections[id];
};
