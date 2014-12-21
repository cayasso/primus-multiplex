'use strict';

/**
 * Module dependencies.
 */

var Stream = require('stream')
  , predefine = require('predefine');

/**
 * Module export.
 */

module.exports = Spark;

/**
 * `Spark` constructor.
 *
 * @constructor
 * @param {Channel} Primus or optimus instance.
 * @param {Spark} conn.
 * @param {String|Number} id
 * @api public
 */

function Spark(channel, conn, id) {
  if (!(this instanceof Spark)) return new Spark(channel, conn, id);

  var writable = predefine(this, predefine.WRITABLE)
    , spark = this;

  writable('id', id);
  writable('conn', conn);
  writable('primus', channel);
  writable('channel', channel);
  writable('remote', conn.remote);
  writable('headers', conn.headers);
  writable('request', conn.request);
  writable('address', conn.address);
  writable('writable', true);
  writable('readable', true);
  writable('query', conn.query);

  this.__initialise.forEach(function execute(initialise) {
    initialise.call(spark);
  });
}

/**
 * Inherits from `Stream`.
 */

Spark.prototype.__proto__ = Stream.prototype;
Spark.readable = predefine(Spark.prototype, predefine.READABLE);
Spark.writable = predefine(Spark.prototype, predefine.WRITABLE);

/**
 * Checks if the given event is an emitted event by Primus.
 *
 * @param {String} ev The event name.
 * @return {Boolean}
 * @api public
 */

Spark.readable('reserved', function reserved(ev) {
  return (/^(incoming|outgoing)::/).test(ev)
  || ev in this.conn.reserved.events
  || ev in this.reserved.events;
});

/**
 * The actual custom events that are used by the Spark.
 *
 * @type {Object}
 * @api public
 */

Spark.prototype.reserved.events = {
  subscribe: 1,
  unsubscribe: 1
};

/**
 * Allows for adding initialise listeners without people overriding our default
 * initializer.
 *
 * @return {Function} The last added initialise hook.
 * @api public
 */

Spark.readable('initialise', {
  get: function get() {
    return this.__initialise[this.__initialise.length - 1];
  },
  set: function set(initialise) {
    if ('function' === typeof initialise) this.__initialise.push(initialise);
  }
}, true);

/**
 * We need this initialise event just to keep
 * constant with a real primus.Spark instance.
 *
 * @api private
 */

Spark.readable('__initialise', [function initialise() {

  var spark = this
    , channel = this.channel;

  // Handle end connection
  this.on('end', function end() {
    spark.removeAllListeners();
    delete channel.connections[spark.id];
    channel.emit('disconnection', spark);
  });

  // Announce a new connection.
  process.nextTick(function tick() {
    channel.emit('connection', spark);
  });

}]);

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @return {Boolean} Always returns true.
 * @api public
 */

Spark.readable('write', function write(data) {
  var payload = packet.call(this, 'MESSAGE', data);
  return this.conn.write(payload);
});

/**
 * End the connection.
 *
 * @param {Mixed} data Optional closing data.
 * @param {Function} fn Optional callback function.
 * @return {Channel} self
 * @api public
 */

Spark.readable('end', function end(data) {
  if (data) this.write(data);
  process.nextTick(this.emit.bind(this, 'end'));
  this.conn.write(packet.call(this, 'UNSUBSCRIBE'));
  this.channel.unsubscribe(this.id);
  return this;
});

/**
 * Encode data to return a multiplex packet.
 * @param {String} ev
 * @param {Object} data
 * @return {Object} pack
 * @api private
 */

function packet(ev, data) {
  var name = this.channel.name
    , type = this.channel.mp.packets[ev]
    , pack = [type, this.id, name];
  if (data) pack.push(data);
  return pack;
}
