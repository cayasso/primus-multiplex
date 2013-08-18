/**
 * Module dependencies.
 */

var Stream = require('stream');

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

function Spark(channel, conn, id) {
  if (!(this instanceof Spark)) return new Spark(channel, conn, id);
  this.channel = channel;
  this.id = id;
  this.conn = conn;

  this.writable = true;         // Silly stream compatibility.
  this.readable = true;         // Silly stream compatibility.

  this.initialise();
}

/**
 * We need this initialise event just to keep
 * constant with a real primus.Spark instance.
 *
 * @api private
 */

Spark.prototype.initialise = function() {

  var spark = this;
  var channel = this.channel;

  // Handle end connection
  this.on('end', function () {
    spark.removeAllListeners();
    channel.emit('disconnection', spark);
  });

  // Announce a new connection.
  process.nextTick(function () {
    channel.emit('connection', spark);
  });

};

/**
 * Inherits from `EventEmitter`.
 */

Spark.prototype.__proto__ = Stream.prototype;

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */

Spark.prototype.write = function (data) {
  var payload = packet.call(this, 'MESSAGE', data);
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
  process.nextTick(function () {
    spark.emit('end');
  });
  this.conn.write(packet.call(this, 'UNSUBSCRIBE'));
  this.channel.unsubscribe(this.id, true);
  return this;
};

/**
 * Encode data to return a multiplex packet.
 * @param {Number} type
 * @param {Object} data
 * @return {Object} packet
 * @api private
 */

function packet(ev, data) {
  var type = this.channel.mp.packets[ev];
  var name = this.channel.name;
  var packet = [type, this.id, name];
  if (data) packet.push(data);
  return packet;
}
