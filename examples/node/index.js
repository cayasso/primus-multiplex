var multiplex = require('../../');
var Primus = require('primus');
var http = require('http');
var server = http.createServer();

// THE SERVER
var primus = new Primus(server, { transformer: 'sockjs', parser: 'JSON' });

// Add room functionality to primus
primus.use('multiplex', multiplex);

setTimeout(function () {
  
  var ann = primus.channel('ann');

  // Server stuff
  ann.on('connection', function(spark){

    console.log('connected', spark);
    // testing regular

    spark.write('hooola senores');

  });

}, 0);




// THE CLIENT
function setClient () {

  var Socket = primus.Socket;
  var socket = new Socket('ws://localhost:8080');

  socket.write([2, 'ann']);

  socket.on('data', function (data) {
    console.log('receiving data', data);
  });

}

// Set first client
setTimeout(function () {
  setClient();
}, 0);

server.listen(process.env.PORT || 8080, function(){
  console.log('\033[96mlistening on localhost:9000 \033[39m');
});
