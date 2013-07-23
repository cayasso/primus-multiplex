/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter;
var isArray = require('util').isArray;
var Channel = require('./channel');

/**
 * message types.
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
  this.primus.channels = {};
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

  this.primus.transform('incoming', function (packet) {

    var data = packet.data
      , id
      , type
      , topic
      , channel;

    if (isArray(data)) {

      type = data.shift();
      id = data.shift();
      topic = data.shift();

      console.log(type, id, topic);

      if (!(multiplex.primus.channels[topic])) {
        return true;
      }

      switch (type) {

        case types.UNSUBSCRIBE:
          multiplex.unsubscribe(id);
          break;

        case types.MESSAGE:
          multiplex.message(id, data);
          break;

        case types.SUBSCRIBE:
          multiplex.subscribe(this, id, topic);
          break;
      }

      return false;
    }

    return true;
  });

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
    spark.on('close', function () {
      for (var id in multiplex.channels) {
        if (multiplex.channels.hasOwnProperty(id)) {
          multiplex.channels[id].emit('close');
        }
      }
      multiplex.channels = {};
    });
  });
  return this;
};

/**
 * Channel method to create new channels.
 */

/**
 * Bind `multiplex` events.
 *
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.channel = function (name) {
  return this.primus.channels[escape(name)] = new Emitter();
};

/**
 * Prepare and send a message from a `channel`.
 *
 * @param {String|Number} id Connection id.
 * @param {Mixin} data The payload to send.
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.message = function (id, data) {
  var channel = this.channels[id];
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

Multiplex.prototype.subscribe = function (conn, id, topic) {
  var channel = this.channels[id] = new Channel(conn, id, topic, this.channels);
  this.primus.channels[topic].emit('connection', channel);
  return this;
};

/**
 * Unsubscribe from a `channel`.
 *
 * @param {String|Number} id Connection id.
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.unsubscribe = function (id) {
  var channel = this.channels[id];
  if (channel) {
    delete this.channels[id];
    channel.emit('close');
  }
  return this;
};
