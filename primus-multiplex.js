(function(){var global = this;function debug(){return debug};function require(p, parent){ var path = require.resolve(p) , mod = require.modules[path]; if (!mod) throw new Error('failed to require "' + p + '" from ' + parent); if (!mod.exports) { mod.exports = {}; mod.call(mod.exports, mod, mod.exports, require.relative(path), global); } return mod.exports;}require.modules = {};require.resolve = function(path){ var orig = path , reg = path + '.js' , index = path + '/index.js'; return require.modules[reg] && reg || require.modules[index] && index || orig;};require.register = function(path, fn){ require.modules[path] = fn;};require.relative = function(parent) { return function(p){ if ('debug' == p) return debug; if ('.' != p.charAt(0)) return require(p); var path = parent.split('/') , segs = p.split('/'); path.pop(); for (var i = 0; i < segs.length; i++) { var seg = segs[i]; if ('..' == seg) path.pop(); else if ('.' != seg) path.push(seg); } return require(path.join('/'), parent); };};require.register("index.js", function(module, exports, require, global){
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
});require.register("spark.js", function(module, exports, require, global){

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

// shortcut to slice
var slice = [].slice;

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
  var spark = this;

  // Adding support for primus-emitter
  // if its pressent.
  if (this.PrimusEmitter) {
    this.__emit__ = emit;
    this.emitter = this.PrimusEmitter(this);
  }
  // Subscribe to channel
  this.conn.write(this.packet.call(this, 'SUBSCRIBE'));

  // We need to pass on these events from main connection.
  var events = ['error', 'reconnect', 'reconnecting'];

  // Re-emit events from main connection.
  for (var i = 0; i < events.length; i++) {
    reemit(events[i]);
  }

  function reemit(ev) {
    spark.conn.on(ev, function onevs() {
      spark.emit.apply(spark, [ev].concat(slice.call(arguments)));
    });
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

});require.register("lib/index.js", function(module, exports, require, global){
/**
 * Module dependencies.
 */

var fs = require('fs');
var file = __dirname + '/../primus-multiplex.js';
var library = fs.readFileSync(file, 'utf-8');
var PrimusMultiplex = require('./server');

/**
 * Exporting modules.
 */

exports.library = library;
exports.client = function(){};
exports.server = PrimusMultiplex;
exports.PrimusMultiplex = PrimusMultiplex;

});require.register("lib/server/channel.js", function(module, exports, require, global){
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

});require.register("lib/server/index.js", function(module, exports, require, global){
/**
 * Module dependencies.
 */

var Channel = require('./channel')
  , Spark = require('./spark')
  , isArray = require('util').isArray;

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

  options = options || {};
  this.primus = primus;
  this.channels = {};

  // Set adapter for rooms. 
  this.adapter = options.adapter;

  // Define the global $ namespace if its
  // not yet defined.
  primus.$ = primus.$ || {};

  // Lets register Multiplex under $
  // as a plugin for other plugins to
  // be aware of it.
  primus.$.Multiplex = Multiplex;

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
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.bind = function (name) {
  var mp = this;
  this.onconnection = this.onconnection.bind(this);
  this.ondisconnection = this.ondisconnection.bind(this);
  this.primus.on('connection', this.onconnection);
  this.primus.on('disconnection', this.ondisconnection);
  this.primus.once('close', this.onclose.bind(this));
  this.primus.channel = function (name) {
    return mp.channel(name);
  };
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
  var mp = this;
  conn.channels = {};

  conn.on('data', function (data) {

    if (!isArray(data)) return false;

    // Parse data to get required fields.
    var type = data.shift()
      , id = data.shift()
      , name = data.shift()
      , payload = data.shift()
      , channel = mp.channels[escape(name)];

    if (!channel) return false;

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
 * @param {primus.Spark} conn
 * @returns {Multiplex} self
 * @api private
 */

Multiplex.prototype.ondisconnection = function (conn) {
  var chnl, spark;
  for (var name in conn.channels) {
    ids = conn.channels[name];
    if (name in this.channels) {
      chnl = this.channels[name];
      for (var i = 0; i < ids.length; ++i) {
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
 * @return {Multiplex} self
 * @api public
 */

Multiplex.prototype.forEach = function (fn) {
  for (var channel in this.channels) {
    fn(this.channels[channel], channel, this.channels);
  }
  this.channels = {};
  return this;
};

/**
 * Called up on main `connection` closed.
 *
 * @return {Multiplex} self
 * @api private
 */

Multiplex.prototype.onclose = function () {
  this.forEach(function (channel) {
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

Multiplex.prototype.channel = function (name) {
  return this.channels[escape(name)] = new Channel(this, name);
};

// Expose `Channel` and `Spark`
Multiplex.Channel = Channel;
Multiplex.Spark = Spark;

});require.register("lib/server/spark.js", function(module, exports, require, global){
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

});var exp = require('index.js');if ("undefined" != typeof module) module.exports = exp;else var PrimusMultiplex = exp;
})();
