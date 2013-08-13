/**
 * Module dependencies.
 */

var Spark = require('./spark')
  , isArray = require('util').isArray;

/**
 * Message packets.
 */

var packets = {
  MESSAGE: 0,
  SUBSCRIBE: 1,
  UNSUBSCRIBE: 2
};

/**
 * Module export.
 */

module.exports = Client;

/**
 * packets.
 */

Client.packets = packets;

/**
 * `Client` constructor.
 *
 * @constructor
 * @param {Primus|Optimus} Primus or optimus instance.
 * @param {primus.Spark} conn.
 * @api public
 */

function Client(mp, conn) {
  this.mp = mp;
  this.conn = conn;
  this.packets = packets;
  this.sparks = {};
  this.spark = new Spark(this, conn, conn.id, 'primus');
  if (this.conn) this.bind();
}

/**
 * Bind `Client` events.
 *
 * @return {Client} self
 * @api private
 */

Client.prototype.bind = function () {
  this.ondata = this.ondata.bind(this);
  this.onend = this.onend.bind(this);
  this.conn.on('data', this.ondata);
  this.conn.on('end', this.onend);
};

/**
 * Unbind `Client` events.
 *
 * @return {Client} self
 * @api private
 */

Client.prototype.unbind = function () {
  this.conn.removeListener('data', this.ondata);
  this.conn.removeListener('end', this.onend);
};

/**
 * Called upon message received.
 *
 * @param {Object} data options.
 * @return {Client} self.
 * @api private
 */

Client.prototype.ondata = function (data) {

  if (isArray(data)) {

    var type = data.shift()
      , id = data.shift()
      , name = data.shift()
      , payload = data.shift();

    if (!(this.mp.channels[name])) return false;

    switch (type) {

      case packets.MESSAGE:
        this.onmessage(id, payload);
        break;

      case packets.SUBSCRIBE:
        this.onsubscribe(id, name);
        break;

      case packets.UNSUBSCRIBE:
        this.onunsubscribe(id);
        break;
    }
    return false;
  }

  return this;
};

/**
 * Called upon close connection.
 *
 * @return {Client} self.
 * @api private
 */

Client.prototype.onend = function () {
  for (var id in this.sparks) {
    this.sparks[id].emit('end');
  }
  this.sparks = {};
  this.unbind();
};

/**
 * Called upon message received.
 *
 * @param {String|Number} id Connection id.
 * @param {Mixin} data The payload to send.
 * @return {Client} self
 * @api private
 */

Client.prototype.onmessage = function (id, data) {
  var spark = this.sparks[id];
  if (spark) spark.emit('data', data);
  return this;
};

/**
 * Called upon subscribe request.
 *
 * @param {String|Number} id Connection id.
 * @param {String} name The name to subscribe to.
 * @return {Client} self.
 * @api private
 */

Client.prototype.onsubscribe = function (id, name) {
  var spark = this.sparks[id] =
  new Spark(this, this.conn, id, name);
  this.mp.channels[name].emit('connection', spark);
  return this;
};

/**
 * Called upon unsubscribe request.
 *
 * @param {String|Number} id Connection id.
 * @return {Client} self.
 * @api private
 */

Client.prototype.onunsubscribe = function (id) {
  var spark;
  if (spark = this.sparks[id]) {
    spark.emit('end');
    spark.removeAllListeners();
    delete this.sparks[id];
  }
  return this;
};
