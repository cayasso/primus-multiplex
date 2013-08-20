/**
 * Module dependenceies.
 */

var Spark = require('./spark')
  , Emitter = require('events').EventEmitter;

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
  this.PrimusRooms = mp.primus.$.PrimusRooms;
  this.PrimusEmitter = mp.primus.$.PrimusEmitter;
  this._adapter = null;
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
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.initialise = function () {

  var chnl = this;
  var adapter = this.mp.adapter;
  var PrimusRooms = this.PrimusRooms;

  // If PrimusRooms plugin exist then lets set the adapter
  // if provided in the plugin declaration.
  // If not provided it will use the default by PrimusRooms.
  if (PrimusRooms) {
    this.adapter(adapter || new PrimusRooms.Adapter());
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

  return this;
};

/**
 * Emit incoming message on specific `spark`.
 *
 * @param {String|Number} id The connection id.
 * @param {Mixed} data The message that needs to be written.
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.message = function (id, data) {
  var spark = this.connections[id];
  if (spark) process.nextTick(function () {
    spark.emit('data', data);
  });
  return this;
};

/**
 * Subscribe a connection to this `channel`.
 *
 * @param {primus.Spark} conn The incoming connection object.
 * @param {String|Number} id, The connection id.
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.subscribe = function (conn, id) {
  var Spark = this.Spark;
  var spark = new Spark(conn, id);
  this.connections[spark.id] = spark;
  return this;
};

/**
 * Unsubscribe a connection from this `channel`.
 *
 * @param {String|Number} id The connection id.
 * @return {Channel} self.
 * @api private
 */

Channel.prototype.unsubscribe = function (id, ignore) {
  var spark = this.connections[id];
  if (spark) {
    if (!ignore) spark.end();
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

Channel.prototype.forEach = function (fn) {
  for (var spark in this.connections) {
    fn(this.connections[spark], spark, this.connections);
  }
  return this;
};

/**
 * Broadcast the message to all connections.
 *
 * @param {Mixed} data The data you want to send.
 * @api public
 */

Channel.prototype.write = function (data) {
  this.forEach(function forEach(spark) {
    spark.write(data);
  });
  return this;
};

/**
 * Destroy this `Channel` instance.
 *
 * @param {Function} fn Callback.
 * @api public
 */

Channel.prototype.destroy = function (fn) {
  this.forEach(function(spark){
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
 * Encode data to return a multiplex packet.
 * @param {Number} type
 * @param {Object} data
 * @return {Object} packet
 * @api private
 */

Channel.prototype.packet = function (type, id, data) {
  var packet = [type, id, this.name];
  if (data) packet.push(data);
  return packet;
};

/**
 * Set an adapter for PrimusRooms only.
 * @param {Adapter} adapter
 * @return {Channel|Adapter} self when setting or value when getting
 * @api private
 */

Channel.prototype.adapter = function (adapter) {
  if (!arguments.length) return this._adapter;
  if ('object' !== typeof adapter) throw new Error('Adapter should be an object');
  this._adapter = adapter;
  return this;
};
