module.exports = function multiplex(primus) {

  var Stream
    , Emitter
    , asyncMethod;
    , types = {
        MESSAGE: 0,
        SUBSCRIBE: 2,
        UNSUBSCRIBE: 3
      };

  try {
    Stream = require('stream');
  } catch (e) {
    Stream = EventEmitter;
  }

  try {
    asyncMethod = proccess.nextTick;
  } catch (e) {
    asyncMethod = function (fn) {
      setTimeout(fn, 0);
    };
  }

  try {
    Emitter = require('stream');
  } catch (e) {
    Emitter = EventEmitter;
  }

  /**
   * `Channel` constructor.
   *
   * @constructor
   * @param {primus.Spark} spark Primus spark instance instance.
   * @param {String} topic The topic to subscribe to
   * @param {Object} channels Channels
   * @api public
   */

  function Channel (spark, id, topic) {
    this.spark = spark;
    this.id = id;
    this.topic = topic;
    this.channels = spark.channels;
    this.bind();
  }

  /**
   * Bind `channel` events.
   *
   * @return {Channel} self.
   * @api private
   */

  Channel.prototype.bind = function () {
    var channel = this;
    this.spark.on('open', function(){
      channel.onopen();
    });
    return this;
  };

  /**
   * Called upon open connection.
   *
   * @return {Channel} self.
   * @api private
   */

  Channel.prototype.onopen = function () {
    var packet = [types.SUBSCRIBE, this.id, this.topic];
    this.spark.write(packet);
    return this;
  };

  /**
   * Inherits from `Stream`.
   */

  Channel.prototype.__proto__ = Stream.prototype;

  /**
   * Send a new message to a given spark.
   *
   * @param {Mixed} data The data that needs to be written.
   * @returns {Boolean} Always returns true.
   * @api public
   */

  Channel.prototype.write = function (data) {
    var packet = [types.MESSAGE, this.id, this.topic, data];
    return this.spark.write(packet);
  };

  /**
   * End the connection.
   *
   * @param {Mixed} data Optional closing data.
   * @return {Channel} self
   * @api public
   */

  Channel.prototype.end = function (data) {
    var channel = this, packet;
    if (data) this.write(data);
    if (this.id in this.channels) {
      packet = [types.UNSUBSCRIBE, this.id, this.topic];
      this.spark.write(packet);
      delete this.channels[this.id];
      asyncMethod(function () {
        channel.emit('close');
      });
    }
    return this;
  };

  /**
   * Destroy the channel.
   *
   * @return {Channel} self
   * @api public
   */

  Channel.prototype.destroy = function () {
    this.removeAllListeners();
    this.end();
    return this;
  };

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
    this.channels = {};
    this.transform();
  }

  /**
   * Transform the incoming messages.
   *
   * @return {Multiplex} self.
   * @api private
   */

  Multiplex.prototype.transform = function () {

    var multiplex = this;

    multiplex.primus.transform('incoming', function (packet) {
      var data = packet.data, id, type, topic, channel, payload;
      if (isArray(data)) {
        type = data.shift();
        id = data.shift();
        topic = data.shift();
        payload = data.join('');

        if (!(multiplex.channels[id])) return false;

        switch (type) {
          case types.UNSUBSCRIBE:
            multiplex.onunsubscribe(id);
            break;
          case types.MESSAGE:
            multiplex.onmessage(id, payload);
            break;
        }
        return false;
      }
      return true;
    });

    // adding channel method to primus instance
    multiplex.primus.channel = function (name) {
      return multiplex.channel(name);
    };

    return this;
  };

  /**
   * Channel method to create new channels.
   *
   * @param {String} name Channel name.
   * @return {Multiplex} self.
   * @api public
   */

  Multiplex.prototype.channel = function (name) {
    var id = uuid();
    return this.channels[id] = new Channel(primus, id, escape(name), this.channels);
  };

  /**
   * Called upon message received.
   *
   * @param {String|Number} id Connection id.
   * @param {Mixin} data The payload to send.
   * @return {Multiplex} self
   * @api private
   */

  Multiplex.prototype.onmessage = function (id, data) {
    var channel = this.channels[id];
    if (channel) channel.emit('data', data);
    return this;
  };

  /**
   * Called upon unsubscribe request.
   *
   * @param {String|Number} id Connection id.
   * @return {Multiplex} self.
   * @api private
   */

  Multiplex.prototype.onunsubscribe = function (id) {
    var channel = this.channels[id];
    if (channel) {
      delete this.channels[id];
      channel.emit('close');
    }
    return this;
  };

  /**
   * uuid counter.
   */

  uuid.ids = 0;

  /**
   * Generate a unique id.
   */

  function uuid() {
    return Date.now() +'$'+ uuid.ids++;
  }

  /**
   * Check if object is an array.
   */

  function isArray (obj) {
    return '[object Array]' === Object.prototype.toString.call(obj);
  }

  return new Multiplex(primus);
};