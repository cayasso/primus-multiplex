/**
 * Module dependencies.
 */

var isArray = require('util').isArray;
var Emitter = require('events').EventEmitter;
var Channel = require('./channel');

/**
 * Message packets.
 */

var packets = {
  MESSAGE: 2,
  SUBSCRIBE: 3,
  UNSUBSCRIBE: 4
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
  if (! (this instanceof Multiplex)) return new Multiplex(primus, options);
  options = options || {};
  this.primus = primus;
  this.channels = {};
  this.connections = {};
  if (this.primus) this.initialise();
}

/**
 * Initialise.
 *
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.initialise = function () {

  var mp = this;
  var primus = this.primus;

  primus.transform('incoming', function (packet) {
    return mp.ondata(packet.data, this);
  });

  // binding connection
  primus.on('connection', function (spark) {
    spark.channels = {};

    // binding close event
    spark.on('close', function () {
      mp.onclose(spark);
    });

  });

  // adding channel method to primus instance
  primus.channel = function (name) {
    return mp.channel(name);
  };

  return this;
};

/**
 * Called upon message received.
 *
 * @param {Object} data options.
 * @param {primus.Spark} spark primus spark instance.
 * @api private
 */

Multiplex.prototype.ondata = function (data, spark) {

  if (isArray(data)) {

    var type = data.shift()
      , id = data.shift()
      , name = data.shift()
      , payload = data.join('');

    if (!(this.channels[name])) return false;

    switch (type) {

      case packets.MESSAGE:
        this.onmessage(spark, id, payload);
        break;

      case packets.SUBSCRIBE:
        this.onsubscribe(spark, id, name);
        break;

      case packets.UNSUBSCRIBE:
        this.onunsubscribe(spark, id);
        break;
    }
    return false;
  }

  return true;
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
 * Called upon message received.
 *
 * @param {primus.Spark} conn Primus `Spark` instance.
 * @param {String|Number} id Connection id.
 * @param {Mixin} data The payload to send.
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.onmessage = function (spark, id, data) {
  var chnl = spark.channels[id];
  if (chnl) chnl.emit('data', data);
  return this;
};

/**
 * Called upon subscribe request.
 *
 * @param {primus.Spark} conn Primus `Spark` instance.
 * @param {String|Number} id Connection id.
 * @param {String} name The name to subscribe to.
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.onsubscribe = function (spark, id, name) {
  var chnl = spark.channels[id] = new Channel(this, spark, id, name);
  this.channels[name].emit('connection', chnl);
  this.connections[name] = this.connections[name] || {};
  this.connections[name][chnl.id] = chnl;
  return this;
};

/**
 * Called upon unsubscribe request.
 *
 * @param {primus.Spark} conn Primus `Spark` instance.
 * @param {String|Number} id Connection id.
 * @return {Multiplex} self.
 * @api private
 */

Multiplex.prototype.onunsubscribe = function (spark, id) {
  var chnl = spark.channels[id];
  if (chnl) {
    delete spark.channels[id];
    chnl.emit('close');
    chnl.removeAllListeners();
  }
  return this;
};

// Expose Channel & packets.
Multiplex.Channel = Channel;
Multiplex.packets = packets;
