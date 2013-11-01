var Spark = require('./spark')
  , Channel = require('./channel')
  , Multiplex = require('./multiplex');

exports.server = Multiplex;
exports.Multiplex = Multiplex;
exports.Channel = Channel;
exports.Spark = Spark;