/**
 * Module dependencies.
 */

var Stream = require('stream');

/**
 * Message packets.
 */

var packets = {
  MESSAGE: 0,
  SUBSCRIBE: 1,
  UNSUBSCRIBE: 2
};

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

function Spark(client, conn, id, name) {
  if (!(this instanceof Spark)) return new Spark(client, id, conn);
  this.client = client;
  this.id = id;
  this.conn = conn;
  this.name = name;
}


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
  var payload = packet.call(this, packets.MESSAGE, data);
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

Spark.prototype.end = function (data, fn) {
  var spark = this;

  if ('function' === typeof data) {
    fn = data;
    data = null;
  }

  if (data) this.write(data);
  if (this.id in this.client.sparks) {
    this.conn.write(packet.call(this, packets.UNSUBSCRIBE));
    delete this.client.sparks[this.id];
    process.nextTick(function () {
      spark.emit('end');
      if ('function' === typeof fn) fn();
      spark.removeAllListeners();
    });
  }
  return this;
};

/**
 * Destroy the channel.
 *
 * @return {Channel} self
 * @api public
 */

Spark.prototype.destroy = function () {
  var spark = this;
  return spark.end(function () {
    spark.removeAllListeners();
  });
};

/**
 * Encode data to return a multiplex packet.
 * @param {Number} type
 * @param {Object} data
 * @return {Object} packet
 * @api private
 */

function packet(type, data) {
  var packet = [type, this.id, this.name];
  if (data) packet.push(data);
  return packet;
}
