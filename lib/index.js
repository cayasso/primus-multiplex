'use strict';
/**
 * Module dependencies.
 */

var isArray = require('util').isArray
  , Channel = require('./channel')
  , Emitter = require('events').EventEmitter;

/**
 * Exports module.
 */

module.exports = {

  server: function server (primus) {

    var channels = {};
    var types = {
      MESSAGE: 0,
      SUBSCRIBE: 2,
      UNSUBSCRIBE: 3
    };

    primus.channels = {};

    primus.transform('incoming', function (packet) {

      var data = packet.data
        , type
        , topic
        , channel;

      if (isArray(data)) {

        type = data.shift();
        topic = data.shift();

        if (!(topic in primus.channels)) {
          return false;
        }

        if (topic in channels) {

          channel = channels[topic];

          switch (type) {

            case types.UNSUBSCRIBE:
              delete channels[topic];
              channel.emit('close');
              break;

            case types.MESSAGE:
              channel.emit('data', data);
              break;
            default: 
              return false;

          }

        } else {

          if (types.SUBSCRIBE === type) {
            channel = channels[topic] = new Channel(this, topic, channels);
            primus.channels[topic].emit('connection', channel);
          }
        }

        return false;
      }

    });

    primus.channel = function (name) {
      return primus.channels[escape(name)] = new Emitter();
    };

    primus.on('connection', function (spark) {
      spark.on('close', function () {
        for (topic in channels) {
          channels[topic].emit('close');
        }
        channels = {};
      });
    });
  },

  client: function (primus) {

  }

  //library: fs.readFileSync(__dirname + '/spark.js', 'utf-8')

};
