/**
 * Module dependencies.
 */

var Emitter = require('events').EventEmitter
  , Client = require('./client')
  , Spark = require('./spark');

/**
 * Module export.
 */

module.exports = Multiplex;

/**
 * `Optimus` constructor.
 *
 * @constructor
 * @param {Primus|Optimus} Primus or optimus instance.
 * @param {String} channel.
 * @api public
 */

function Multiplex (primus, channel) {
  if (!(this instanceof Multiplex)) return new Multiplex(primus, channel);
  this.primus = primus;
  this.channels = {};
  this.bind();
  if (channel) return this.channel(channel);
}

/**
 * Inherits from `EventEmitter`.
 */

Multiplex.prototype.__proto__ = Emitter.prototype;

/**
 * Bind `Optimus` events.
 *
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.bind = function () {
  var mp = this;
  this.onconnection = this.onconnection.bind(this);
  this.primus.on('connection', this.onconnection);
  this.primus.channel = function (name) {
    return mp.channel(name);
  };
  return this;
};

/**
 * Unbind `Multiplex` events.
 *
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.unbind = function () {
  this.primus.removeListener('connection', this.onconnection);
  return this;
};

/**
 * Called upon new connection.
 *
 * @param {primus.Spark} conn
 * @returns {Multiplex} self
 * @api private
 */

Multiplex.prototype.onconnection = function (conn) {
  var client = new Client(this, conn);
  this.emit('connection', client.spark);
  return this;
};

/**
 * Channel method to create new channels.
 *
 * @param {String} name Channel name.
 * @return {EventEmitter}
 * @api public
 */

Multiplex.prototype.channel = function (name) {
  return this.channels[escape(name)] = new Emitter();
};

/**
 * Expose client, spark and emitter.
 */

Multiplex.Client = Client;
Multiplex.Spark = Spark;
Multiplex.Emitter = Emitter;

