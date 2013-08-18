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