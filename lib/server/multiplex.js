'use strict';

/**
 * Module dependencies.
 */

var Channel = require('./channel')
  , Spark = require('./spark')
  , isArray = Array.isArray;

/**
 * Expoport `Multiplex` module.
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

  this.options = options || {};
  this.primus = primus;
  this.channels = {};

  Object.keys(Spark.prototype.reserved.events).forEach(function each(key) {
    primus.Spark.prototype.reserved.events[key] = 1;
  });

  // Define the global $ namespace if its
  // not yet defined.
  primus.$ = primus.$ || {};

  // Lets register Multiplex under $
  // as a plugin for other plugins to
  // be aware of it.
  primus.$.multiplex = {};
  primus.$.multiplex.Spark = Spark;
  primus.$.multiplex.Channel = Channel;
  primus.$.multiplex.Multiplex = Multiplex;

  if (this.primus) this.bind();
}

/**
 * Message packets.
 */

Multiplex.prototype.packets = {
  MESSAGE: 0,       // incoming message
  SUBSCRIBE: 1,     // incoming subscriptions
  UNSUBSCRIBE: 2    // incoming unsubscriptions
};

/**
 * Bind `Multiplex` events.
 *
 * @return {Multiplex} this
 * @api private
 */

Multiplex.prototype.bind = function bind() {
  var mp = this;
  this.onconnection = this.onconnection.bind(this);
  this.ondisconnection = this.ondisconnection.bind(this);
  this.primus.on('connection', this.onconnection);
  this.primus.on('disconnection', this.ondisconnection);
  this.primus.once('close', this.onclose.bind(this));
  this.primus.channel = function channel(name) {
    return mp.channel(name);
  };
  return this;
};

/**
 * Called upon new connection.
 *
 * @param {Spark} conn
 * @returns {Multiplex} this
 * @api private
 */

Multiplex.prototype.onconnection = function onconnection(conn) {
  var mp = this;
  conn.channels = {};
  var idPrefix = conn.id + ':';

  conn.on('data', function ondata(data) {

    if (!isArray(data)) return false;

    // Parse data to get required fields.
    var type = data[0]
      , id = idPrefix + data[1] + ':' + data[2]
      , name = data[2]
      , payload = data.length === 4 ? data[3] : undefined
      , channel = mp.channels[name];

    if (!channel) {
      channel = mp.channel(name);
    }

    switch (type) {

      case mp.packets.MESSAGE:
        channel.message(id, payload);
        break;

      case mp.packets.SUBSCRIBE:
        channel.subscribe(conn, id);
        break;

      case mp.packets.UNSUBSCRIBE:
        channel.unsubscribe(id);
        break;
    }

    return false;

  });
};

/**
 * Called upon new disconnection.
 *
 * @param {Spark} conn
 * @returns {Multiplex} this
 * @api private
 */

Multiplex.prototype.ondisconnection = function ondisconnection(conn) {
  var i, l, ids, chnl, spark;
  for (var name in conn.channels) {
    ids = conn.channels[name];
    i = 0; l = ids.length;
    if (name in this.channels) {
      chnl = this.channels[name];
      for (; i < l; ++i) {
        spark = chnl.connections[ids[i]];
        if (spark) spark.end();
      }
    }
    delete conn.channels[name];
  }
  return this;
};

/**
 * Iterate over the channels.
 *
 * @param {Function} fn The function that is called every iteration.
 * @return {Multiplex} this
 * @api public
 */

Multiplex.prototype.forEach = function forEach(fn) {
  for (var channel in this.channels) {
    fn(this.channels[channel], channel, this.channels);
  }
  this.channels = {};
  return this;
};

/**
 * Called up on main `connection` closed.
 *
 * @return {Multiplex} this
 * @api private
 */

Multiplex.prototype.onclose = function onclose() {
  this.forEach(function each(channel) {
    channel.destroy();
  });
  return this;
};

/**
 * Return a `Channel` instance.
 *
 * @param {String} name The channel name.
 * @return {Channel}
 * @api public
 */

Multiplex.prototype.channel = function channel(name) {
  var chan = new Channel(this, name);
  if (this.primus.$.rooms) {
    this.primus.$.rooms.rooms(chan, this.options);
  }
  return this.channels[name] = chan;
};
