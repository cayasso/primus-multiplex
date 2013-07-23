var multiplex = require('../../');
var Primus = require('primus');
var http = require('http');
var server = http.createServer();

// THE SERVER
var primus = new Primus(server, { transformer: 'sockjs', parser: 'JSON' });

// Add room functionality to primus
primus.use('multiplex', multiplex);

var ann = primus.channel('ann');
var bob = primus.channel('bob');
var tom = primus.channel('tom');


// Server stuff
ann.on('connection', function(spark){

  console.log('connected to ann');
  // testing regular

  spark.write('hooola senores');

});

// Server stuff
bob.on('connection', function(spark){

  console.log('connected to bob');
  // testing regular

  spark.write('hooola senores');

});

// Server stuff
tom.on('connection', function(spark){

  console.log('connected to tom');
  // testing regular

  spark.write('hooola senores');

});


// THE CLIENT
function setClient () {

  var Socket = primus.Socket;
  var socket = new Socket('ws://localhost:8080');

  socket.write([2, 1, 'ann']);

  socket.write([2, 2, 'bob']);

  socket.write([2, 3, 'tom']);

  socket.write([2, 4, 'tom']);

  socket.write([2, 5, 'tom']);

  socket.on('data', function (data) {
    console.log('receiving data', data);
  });

  setTimeout(function () {
    socket.write([3, 8, 'ann']);
  }, 5000);

}

// Set first client
setTimeout(function () {
  setClient();
}, 0);

server.listen(process.env.PORT || 8080, function(){
  console.log('\033[96mlistening on localhost:9000 \033[39m');
});
