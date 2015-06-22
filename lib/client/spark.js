/**
 * Exports `spark`.
 */

module.exports = function spark() {

  'use strict';

  var slice = Array.prototype.slice
    , nextTick
    , Stream;

  /**
   * Module dependencies.
   */

  try {
    Stream = require('stream');
    nextTick = process.nextTick;
  } catch (e) {
    Stream = Primus.EventEmitter;
    nextTick = function tick(fn) {
      setTimeout(fn, 0);
    };
  }

  function inherit(a, b) {
    function F() {}
    F.prototype = b.prototype;
    a.prototype = new F();
    a.prototype.constructor = a;
  }

  /**
   * `Spark` constructor.
   *
   * @constructor
   * @param {Multiplex} Multiplex instance.
   * @param {String|Number} id.
   * @param {primus.Spark} conn.
   * @api public
   */

  function Spark(mp, channel, id) {
    if (!(this instanceof Spark)) return new Spark(mp, channel, id);
    Stream.call(this);
    this.channel = channel;
    this.id = id || this.uid(13);
    this.packets = mp.packets;
    this.conn = mp.conn;
    this.readyState = mp.conn.readyState;
    this.channels = mp.channels;
    this.writable = true;
    this.readable = true;
    this.reconnect = false;
    this.initialise();
  }

  /**
   * Inherits from `EventEmitter`.
   */

  inherit(Spark, Stream);

  /**
   * Initialise the Primus and setup all
   * parsers and internal listeners.
   *
   * @api private
   */

  Spark.prototype.initialise = function initialise() {
    var listeners = []
      , spark = this
      , events = []
      , i;

    for (var ev in this.conn.reserved.events) {
      if ('data' === ev || 'end' === ev) continue;
      events.push(ev);
    }

    // This listener must be registered before other ones
    // to make sure readyState is set when the others are called
    this.conn.on('readyStateChange', onreadystatechange);

    this.conn.on('reconnect', onreconnect);
    this.conn.on('open', onopen);

    // Connect to the actual channel
    this.connect();

    // Re-emit events from main connection
    for (i = 0; i < events.length; i++) {
      listeners.push(proxy(events[i]));
      this.conn.on(events[i], listeners[i]);
    }

    this.on('end', function () {
      spark.emit('close');
      spark.conn.removeListener('readyStateChange', onreadystatechange);
      spark.conn.removeListener('reconnect', onreconnect);
      spark.conn.removeListener('open', onopen);
      for (i = 0; i < events.length; i++) {
        spark.conn.removeListener(events[i], listeners[i]);
      }
    });

    function onreadystatechange() {
      spark.readyState = spark.conn.readyState;
    }

    function onreconnect() {
      spark.reconnect = true;
    }

    function onopen() {
      if (spark.reconnect) spark.connect();
      spark.reconnect = false;
    }

    function proxy(ev) {
      return function emit() {
        spark.emit.apply(spark, [ev].concat(slice.call(arguments)));
      };
    }

    return this;
  };

  /**
   * Connect to the `channel`.
   *
   * @return {Socket} self
   * @api public
   */

  Spark.prototype.connect = function connect() {
    // Subscribe to channel
    this.conn.write(this.packet.call(this, 'SUBSCRIBE'));
    return this;
  };

  /**
   * Send a new message to a given spark.
   *
   * @param {Mixed} data The data that needs to be written.
   * @returns {Boolean} Always returns true.
   * @api public
   */

  Spark.prototype.write = function write(data) {
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

  Spark.prototype.end = function end(data) {
    var spark = this;
    if (data) this.write(data);
    this.conn.write(this.packet('UNSUBSCRIBE'));
    nextTick(function tick() {
      spark.emit('end');
      spark.writable = false;
    });
    delete this.channels[this.channel][this.id];
    return this;
  };

  /**
   * Generate a unique id.
   *
   * @param {String} len
   * @return {String} uid.
   * @api private
   */

  Spark.prototype.uid = function uid(len) {
    return Math.random().toString(35).substr(2, len || 7);
  };

  /**
   * Encode data to return a multiplex packet.
   * @param {String} ev
   * @param {Object} data
   * @return {Object} pack
   * @api private
   */

  Spark.prototype.packet = function packet(ev, data) {
    var type = this.packets[ev];
    var pack = [type, this.id, this.channel];
    if (data) pack.push(data);
    return pack;
  };

  /**
   * Checks if the given event is an emitted event by Primus.
   *
   * @param {String} evt The event name.
   * @returns {Boolean}
   * @api public
   */

  Spark.prototype.reserved = function reserved(evt) {
    return (/^(incoming|outgoing)::/).test(evt)
      || evt in this.conn.reserved.events
      || evt in this.reserved.events;
  };

  /**
   * The reserved custom events list.
   *
   * @type {Object}
   * @api public
   */

  Spark.prototype.reserved.events = {};

  return Spark;
};
