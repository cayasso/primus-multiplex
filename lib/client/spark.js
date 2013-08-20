
var Stream
  , nextTick;

/**
 * Module dependencies.
 */

try {
  Stream = require('stream');
  nextTick = process.nextTick;
} catch (e) {
  Stream = Primus.EventEmitter;
  nextTick = function (fn) {
    setTimeout(fn, 0);
  };
}

// shortcut to slice
var slice = [].slice;

/**
 * Module export.
 */

module.exports = Spark;

/**
 * `Spark` constructor.
 *
 * @constructor
 * @param {Client} Primus or optimus instance.
 * @param {String|Number} id
 * @param {primus.Spark} conn.
 * @api public
 */

function Spark(mp, channel, id) {
  if (!(this instanceof Spark)) return new Spark(mp, channel, id);
  Stream.call(this);
  this.channel = channel;
  this.PrimusEmitter = mp.conn.__Emitter__;
  this.id = id || this.uid(13);
  this.packets = mp.packets;
  this.conn = mp.conn;
  this.channels = mp.channels;
  this.writable = true;         // Silly stream compatibility.
  this.readable = true;         // Silly stream compatibility.
  this.initialise();
}

/**
 * Inherits from `EventEmitter`.
 */

Spark.prototype.__proto__ = Stream.prototype;

/**
 * `Spark#emit` reference.
 */

var emit = Spark.prototype.emit;

/**
 * Initialise the Primus and setup all
 * parsers and internal listeners.
 *
 * @api private
 */

Spark.prototype.initialise = function () {
  var spark = this;

  // Adding support for primus-emitter
  // if its pressent.
  if (this.PrimusEmitter) {
    this.__emit__ = emit;
    this.emitter = this.PrimusEmitter(this);
  }
  // Subscribe to channel
  this.conn.write(this.packet.call(this, 'SUBSCRIBE'));

  // We need to pass on these events from main connection.
  var events = ['error', 'reconnect', 'reconnecting'];

  // Re-emit events from main connection.
  for (var i = 0; i < events.length; i++) {
    reemit(events[i]);
  }

  function reemit(ev) {
    spark.conn.on(ev, function onevs() {
      spark.emit.apply(spark, [ev].concat(slice.call(arguments)));
    });
  }

  return this;
};

/**
 * Emits to this Spark.
 *
 * @return {Socket} self
 * @api public
 */

Spark.prototype.emit = function (ev) {
  if (this.PrimusEmitter) {
    this.emitter.emit.apply(this.emitter, arguments);
  } else {
    emit.apply(this, arguments);
  }
  return this;
};

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */

Spark.prototype.write = function (data) {
  var payload = this.packet('MESSAGE', data);
  return this.conn.write(payload);
};

/**
 * End the connection.
 *
 * @param {Mixed} data Optional closing data.
 * @param {Function} fn Optional callback function.
 * @return {Channel} self
 * @api public
 */

Spark.prototype.end = function (data) {
  var spark = this;
  if (data) this.write(data);
  this.conn.write(this.packet('UNSUBSCRIBE'));
  nextTick(function () {
    spark.emit('end');
    spark.writable = false;
  });
  delete this.channels[this.id];
  return this;
};

/**
 * Generate a unique id.
 *
 * @param {String} len
 * @return {String} uid.
 */

Spark.prototype.uid = function (len) {
  return Math.random().toString(35).substr(2, len || 7);
};

/**
 * Encode data to return a multiplex packet.
 * @param {Number} type
 * @param {Object} data
 * @return {Object} packet
 * @api private
 */

Spark.prototype.packet = function (ev, data) {
  var type = this.packets[ev];
  var packet = [type, this.id, this.channel];
  if (data) packet.push(data);
  return packet;
};
