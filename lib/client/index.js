module.exports = function multiplex(primus) {

  var Stream
    , Emitter
    , asyncMethod
    , packets = {
        MESSAGE: 0,
        SUBSCRIBE: 1,
        UNSUBSCRIBE: 2
      };

  try {
    Stream = require('stream');
  } catch (e) {
    Stream = EventEmitter;
  }

  try {
    asyncMethod = process.nextTick;
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
   * @param {String} name The name to subscribe to
   * @param {Object} channels Channels
   * @api public
   */

  function Spark (conn, id, name) {
    this.conn = conn;
    this.id = id;
    this.name = name;
    this.channels = conn.channels;
    this.bind();
  }

  /**
   * Bind `channel` events.
   *
   * @return {Channel} self.
   * @api private
   */

  Spark.prototype.bind = function () {
    var spark = this;
    this.conn.on('open', function(){
      spark.onopen();
    });
    return this;
  };

  /**
   * Called upon open connection.
   *
   * @return {Channel} self.
   * @api private
   */

  Spark.prototype.onopen = function () {
    var packet = this.packet(packets.SUBSCRIBE);
    this.conn.write(packet);
    return this;
  };

  /**
   * Inherits from `Stream`.
   */

  Spark.prototype.__proto__ = Stream.prototype;

  /**
   * Send a new message to a given spark.
   *
   * @param {Mixed} data The data that needs to be written.
   * @returns {Boolean} Always returns true.
   * @api public
   */

  Spark.prototype.write = function (data) {
    var packet = this.packet(packets.MESSAGE, data);
    return this.conn.write(packet);
  };

  /**
   * Encode data to return a multiplex packet.
   * @param {Number} type
   * @param {Object} data
   * @return {Object} packet
   * @api private
   */

  Spark.prototype.packet = function (type, data) {
    var packet = [type, this.id, this.name];
    if (data) packet.push(data);
    return packet;
  };

  /**
   * End the connection to this `channel`.
   *
   * @param {Mixed} data Optional closing data.
   * @return {Channel} self
   * @api public
   */

  Spark.prototype.end = function () {
    var spark = this, packet;
    if (this.id in this.channels) {
      packet = this.packet(packets.UNSUBSCRIBE);

      this.conn.write(packet);
      delete this.channels[this.id];
      asyncMethod(function () {
        spark.emit('end');
      });
    }
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
      var data = packet.data;
      if (isArray(data)) {
        var type = data.shift()
          , id = data.shift()
          , name = data.shift()
          , payload = data.shift();

        if (!(multiplex.channels[id])) return false;

        switch (type) {
          case packets.UNSUBSCRIBE:
            multiplex.onunsubscribe(id);
            break;
          case packets.MESSAGE:
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
   * Create new `channels`.
   *
   * @param {String} name Channel name.
   * @return {Multiplex} self.
   * @api public
   */

  Multiplex.prototype.channel = function (name) {
    var id = uuid();
    primus.channels = this.channels;
    return this.channels[id] = new Spark(primus, id, escape(name));
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
      channel.emit('end');
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