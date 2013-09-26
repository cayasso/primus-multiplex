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
  
  if (this.PrimusRooms) {
    this._rooms = new this.PrimusRooms.Rooms();
  }
  this.PrimusEmitter = mp.primus.$.PrimusEmitter;

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
  if (this.connections[id]) return this;
  var Spark = this.Spark;
  var spark = new Spark(conn, id);
  this.connections[spark.id] = spark;
  conn.channels[this.name] = conn.channels[this.name] || [];
  conn.channels[this.name].push(spark.id);
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
  for (var id in this.connections) {
    fn(this.connections[id], id, this.connections);
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
  var result, sparks;
  if (this._rooms) {
    result = this._rooms.broadcast(this, data, this.connections);
  }
  return result ? result : this.forEach(function(spark) {
    spark.write(data);
  });
};

/**
 * Join a client to a room, for PrimusRooms only.
 *
 * @param {Spark} spark
 * @param {String|Array} room
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.join = function (spark, room, fn) {
  this._rooms.join(spark, room, fn);
  return this;
};

/**
 * Remove client from a room, for PrimusRooms only.
 *
 * @param {Spark} spark
 * @param {String|Array} room
 * @param {Function} fn callback
 * @return {Channel} self
 * @api public
 */

Channel.prototype.leave = function (spark, room, fn) {
  this._rooms.leave(spark, room, fn);
  return this;
};

/**
 * Targets a room when broadcasting, for PrimusRooms only.
 *
 * @param {String} name
 * @return {Channel}
 * @api public
 */

Channel.prototype.in =
Channel.prototype.room = function (name) {
  if (!this._rooms) return this;
  return this._rooms.room(this, name);
};

/**
 * Get connected clients, for PrimusRooms only.
 *
 * @param {Function} fn callback
 * @return {Channel|Array} self or array of client ids
 * @api public
 */

Channel.prototype.clients = function (fn) {
  return this._rooms.clients(this, fn);
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
 * Set an adapter for PrimusRooms only.
 *
 * @param {Adapter} adapter
 * @return {Channel|Adapter} self when setting or value when getting
 * @api private
 */

Channel.prototype.adapter = function () {
  var rooms = this._rooms;
  var result = rooms.adapter.apply(rooms, arguments);
  return arguments.length ? this : result;
};

/**
 * Encode data to return a multiplex packet.
 *
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
