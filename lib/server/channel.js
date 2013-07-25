/**
 * Module dependencies.
 */

var Stream = require('stream');

/**
 * Message types.
 */

var types = {
  MESSAGE: 0,
  SUBSCRIBE: 2,
  UNSUBSCRIBE: 3
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
 * @param {String} topic The topic to subscribe to
 * @param {Object} channels Channels
 * @api public
 */

function Channel (spark, id, topic) {
  this.spark = spark;
  this.id = id;
  this.topic = topic;
  this.channels = spark.channels;
  this.bind();
}

/**
 * Bind `channel` events.
 *
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.bind = function () {
  var channel = this;
  this.spark.on('open', function(){
    channel.onopen();
  });
  return this;
};

/**
 * Called upon open connection.
 *
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.onopen = function () {
  var packet = [types.SUBSCRIBE, this.id, this.topic];
  this.spark.write(packet);
  return this;
};

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
  var packet = [types.MESSAGE, this.id, this.topic, data];
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
    packet = [types.UNSUBSCRIBE, this.id, this.topic];
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
