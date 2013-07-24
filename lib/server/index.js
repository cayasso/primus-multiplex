/**
 * Module dependencies.
 */

var isArray = require('util').isArray;
var Emitter = require('events').EventEmitter;
var Channel = require('./channel');

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

module.exports = Multiplex;

/**
 * `Multiplex` constructor.
 *
 * @constructor
 * @param {primus} primus Primus instance.
 * @param {Object} options.
 * @api public
 */

function Multiplex (primus, options) {
  options = options || {};
  this.primus = primus;
  this.channels = {};
  this.transform();
  this.bind();
}

/**
 * Transform the incoming messages.
 *
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.transform = function () {

  var multiplex = this;

  multiplex.primus.transform('incoming', function (packet) {

    if (!this.channels) this.channels = {};

    var data = packet.data
      , id
      , type
      , topic
      , channel;

    if (isArray(data)) {

      type = data.shift();
      id = data.shift();
      topic = data.shift();

      if (!(multiplex.channels[topic])) return true;

      switch (type) {
        case types.UNSUBSCRIBE:
          multiplex.onunsubscribe(this, id);
          break;

        case types.MESSAGE:
          multiplex.onmessage(this, id, data);
          break;

        case types.SUBSCRIBE:
          multiplex.onsubscribe(this, id, topic);
          break;
      }
      return false;
    }

    return true;
  });

  // adding channel method to primus instance
  multiplex.primus.channel = function (name) {
    return multiplex.channel(name);
  };

  return this;
};

/**
 * Bind `multiplex` events.
 *
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.bind = function () {
  var multiplex = this;
  multiplex.primus.on('connection', function (spark) {
    spark.channels = {};
    spark.on('close', function () {
      multiplex.onclose(spark);
    });
  });

  return this;
};

/**
 * Called upon close connection.
 *
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.onclose = function (spark) {
  for (var id in spark.channels) {
    if (spark.channels.hasOwnProperty(id)) {
      spark.channels[id].emit('close');
    }
  }
  spark.channels = {};
  return this;
};

/**
 * Channel method to create new channels.
 *
 * @param {String} name Channel name.
 * @return {Multiplex} self.
 * @api public
 */

Multiplex.prototype.channel = function (name) {
  return this.channels[escape(name)] = new Emitter();
};

/**
 * Prepare and send a message from a `channel`.
 *
 * @param {String|Number} id Connection id.
 * @param {Mixin} data The payload to send.
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.onmessage = function (spark, id, data) {
  var channel = spark.channels[id];
  if (channel) channel.emit('data', data);
  return this;
};

/**
 * Create and subscribe to a new `channel`.
 *
 * @param {primus.Spark} conn Primus `Spark` instance.
 * @param {String|Number} id Connection id.
 * @param {String} topic The topic to subscribe to.
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.onsubscribe = function (spark, id, topic) {
  var channel = spark.channels[id] = new Channel(spark, id, topic);
  this.channels[topic].emit('connection', channel);
  return this;
};

/**
 * Unsubscribe from a `channel`.
 *
 * @param {String|Number} id Connection id.
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.onunsubscribe = function (spark, id) {
  var channel = spark.channels[id];
  if (channel) {
    delete spark.channels[id];
    channel.emit('close');
  }
  return this;
};