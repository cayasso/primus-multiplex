/**
 * Module dependencies.
 */

var Primus = require('primus');
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

module.exports = Channel;

/**
 * `Channel` constructor.
 *
 * @constructor
 * @param {primus.Spark} spark Primus spark instance instance.
 * @param {String} name The name to subscribe to
 * @param {Object} channels Channels
 * @api public
 */

function Channel (spark, id, name) {
  this.spark = spark;
  this.id = id;
  this.name = name;
  this.channels = spark.channels;
}

/**
 * Inherits from `Stream`.
 */

Channel.prototype.__proto__ = Stream.prototype;

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */

Channel.prototype.write = function (data) {
  var packet = [packets.MESSAGE, this.id, this.name, data];
  return this.spark.write(packet);
};

/**
 * End the connection.
 *
 * @param {Mixed} data Optional closing data.
 * @param {Function} fn Optional callback function.
 * @return {Channel} self
 * @api public
 */

Channel.prototype.end = function (data, fn) {
  var channel = this, packet;

  if ('function' === typeof data) {
    fn = data;
    data = null;
  }

  if (data) this.write(data);
  if (this.id in this.channels) {
    packet = [packets.UNSUBSCRIBE, this.id, this.name];
    this.spark.write(packet);
    delete this.channels[this.id];
    process.nextTick(function () {
      channel.emit('close');
      if ('function' === typeof fn) fn();
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

Channel.prototype.destroy = function () {
  var channel = this;
  return channel.end(function () {
    channel.removeAllListeners();
  });
};
