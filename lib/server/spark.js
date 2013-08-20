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
  this.PrimusRooms = channel.PrimusRooms;
  this.PrimusEmitter = channel.PrimusEmitter;

  this.id = id;
  this.conn = conn;
  this.headers = conn.headers;
  this.address = conn.address;
  this.query = conn.query;

  this._rooms = null;
  this.writable = true;         // Silly stream compatibility.
  this.readable = true;         // Silly stream compatibility.
  this.initialise();
}

/**
 * Inherits from `EventEmitter`.
 */

Spark.prototype.__proto__ = Stream.prototype;

/**
 * We need this initialise event just to keep
 * constant with a real primus.Spark instance.
 *
 * @api private
 */

Spark.prototype.initialise = function() {

  var spark = this;
  var channel = this.channel;
  var PrimusRooms = this.PrimusRooms;
  var PrimusEmitter = this.PrimusEmitter;


  // If PrimusRooms plugin exist then lets get an
  // instance of PrimusRooms.Rooms, this will initialize
  // rooms with an adapter provided in the plugin declaration.
  // If no adapter was provided it will use the default by PrimusRooms
  if (PrimusRooms) {
    this._rooms = new PrimusRooms.Rooms(this, this.channel.adapter());
  }

  if (PrimusEmitter) {
    this.__emit__ = emit;
    this._emitter = new PrimusEmitter.Emitter(this);
  }

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
 * `Primus#emit` reference.
 */

var emit = Spark.prototype.emit;


/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */

Spark.prototype.write = function (data) {
  var payload = packet.call(this, 'MESSAGE', data);
  if (this._rooms) {
    var sparks = this.channel.connections;
    return this._rooms.broadcast(data, sparks) ?
    true : this.conn.write(payload);
  } else {
    this.conn.write(payload);
  }
  return this;
};

/**
 * Emits to this Spark.
 *
 * @return {Socket} self
 * @api public
 */

Spark.prototype.emit = function (ev) {
  if (this.PrimusEmitter) {
    // ignore newListener event to avoid this error in node 0.8
    // https://github.com/cayasso/primus-emitter/issues/3
    if ('newListener' === ev) return this;
    this._emitter.emit.apply(this._emitter, arguments);
  } else {
    emit.apply(this, arguments);
  }
  return this;
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
 * Copy room methods to Spark prototype.
 */

['to', 'in', 'room', 'rooms', 'join', 'leave', 'leaveAll','clients']
.forEach(function (fn) {
  Spark.prototype[fn] = function () {
    return this._rooms[fn].apply(this._rooms, arguments);
  };
});

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
