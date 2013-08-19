(function (Primus) {

'use strict';

var define = define || null;
var require = require || null;
// Super simple require system 
(function () {

// Store our repository in private variables in this closure.
var defs = {},
    modules = {};

// When the user defines a module's setup function, store it here.
define = function define(name, fn) {
  defs[name] = fn;
}

var realRequire = typeof require !== "undefined" && require;
// The first time a module is used, it's description is executed and cached.
require = function require(name) {
  if (modules.hasOwnProperty(name)) return modules[name];
  if (defs.hasOwnProperty(name)) {
    var exports = modules[name] = {};
    var module = {exports:exports};
    var fn = defs[name];
    fn(module, exports);
    return modules[name] = module.exports;
  }
  if (realRequire) {
    return realRequire(name);
  }
  throw new Error("Can't find module " + name);
}

}());


define('primus-multiplex', function (module, exports) {

/**
 * Module dependencies.
 */

var Spark = require('./spark');

/**
 * `Primus#initialise` reference.
 */

var init = Primus.prototype.initialise;

/**
 * Adding `Multiplex` reference.
 */

Primus.prototype.Multiplex = Multiplex;

/**
 * Extending primus to add channels.
 */

Primus.prototype.initialise = function () {
  this.multiplex = new this.Multiplex(this);
  init.apply(this, arguments);
};

/**
 * Return a `Channel` instance.
 *
 * @param {String} name The channel name.
 * @return {multiplex.Spark}
 * @api public
 */

Primus.prototype.channel = function (name) {
  return this.multiplex.channel(name);
};

/**
 * Exports `Multiplex` module.
 */

module.exports = Multiplex;

/**
 * `Multiplex` constructor.
 *
 * @constructor
 * @param {Primus} primus Primus instance.
 * @param {Object} options The options.
 * @api public
 */

function Multiplex(primus, options) {
  if (!(this instanceof Multiplex)) return new Multiplex(primus, options);
  options = options || {};
  this.conn = primus;
  this.channels = {};
  if (this.conn) this.bind();
}

/**
 * Message packets.
 */

Multiplex.prototype.packets = {
  MESSAGE: 0,
  SUBSCRIBE: 1,
  UNSUBSCRIBE: 2
};

/**
 * Bind `Multiplex` events.
 *
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.bind = function () {
  var mp = this;
  this.conn.on('data', function (data) {
    if (isArray(data)) {
      var type = data.shift()
        , id = data.shift()
        , name = data.shift()
        , payload = data.shift()
        , channel = mp.channels[id];

      if (!channel) return false;

      switch (type) {
        case mp.packets.MESSAGE:
          channel.emit('data', payload);
          break;
        case mp.packets.UNSUBSCRIBE:
            channel.emit('end');
            channel.removeAllListeners();
            delete mp.channels[id];
          break;
      }
      return false;
    }
  });

  return this;
};

/**
 * Return a `Channel` instance.
 *
 * @param {String} name The channel name.
 * @return {Spark}
 * @api public
 */

Multiplex.prototype.channel = function (name) {
  if (!name) return this.conn;
  var spark = new Spark(this, name);
  return this.channels[spark.id] = spark;
};

/**
 * Check if object is an array.
 */

function isArray (obj) {
  return '[object Array]' === Object.prototype.toString.call(obj);
}

// Expose Spark
Multiplex.Spark = Spark;
});


define('./spark', function (module, exports) {


var Stream
  , nextTick;

/**
 * Module dependencies.
 */

try {
  Stream = require('stream');
  nextTick = process.nextTick;
} catch (e) {
  Stream = Primus.EventEmitter;
  nextTick = function (fn) {
    setTimeout(fn, 0);
  };
}

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

function Spark(mp, channel, id) {
  if (!(this instanceof Spark)) return new Spark(mp, channel, id);
  Stream.call(this);
  this.channel = channel;
  this.PrimusEmitter = mp.conn.__Emitter__;
  this.id = id || this.uid(13);
  this.packets = mp.packets;
  this.conn = mp.conn;
  this.channels = mp.channels;
  this.writable = true;         // Silly stream compatibility.
  this.readable = true;         // Silly stream compatibility.
  this.initialise();
}

/**
 * Inherits from `EventEmitter`.
 */

Spark.prototype.__proto__ = Stream.prototype;

/**
 * `Spark#emit` reference.
 */

var emit = Spark.prototype.emit;

/**
 * Initialise the Primus and setup all
 * parsers and internal listeners.
 *
 * @api private
 */

Spark.prototype.initialise = function () {
  // adding support for primus-emitter
  // if its pressent.
  if (this.PrimusEmitter) {
    this.__emit__ = emit;
    this.emitter = this.PrimusEmitter(this);
  }
  // subscribe to channel
  this.conn.write(this.packet.call(this, 'SUBSCRIBE'));
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
    this.emitter.emit.apply(this.emitter, arguments);
  } else {
    emit.apply(this, arguments);
  }
  return this;
};

/**
 * Send a new message to a given spark.
 *
 * @param {Mixed} data The data that needs to be written.
 * @returns {Boolean} Always returns true.
 * @api public
 */

Spark.prototype.write = function (data) {
  var payload = this.packet('MESSAGE', data);
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
  this.conn.write(this.packet('UNSUBSCRIBE'));
  nextTick(function () {
    spark.emit('end');
    spark.writable = false;
  });
  delete this.channels[this.id];
  return this;
};

/**
 * Generate a unique id.
 *
 * @param {String} len
 * @return {String} uid.
 */

Spark.prototype.uid = function (len) {
  return Math.random().toString(35).substr(2, len || 7);
};

/**
 * Encode data to return a multiplex packet.
 * @param {Number} type
 * @param {Object} data
 * @return {Object} packet
 * @api private
 */

Spark.prototype.packet = function (ev, data) {
  var type = this.packets[ev];
  var packet = [type, this.id, this.channel];
  if (data) packet.push(data);
  return packet;
};

});

require('primus-multiplex');

})(Primus);
