var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');

var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(3000);
console.log('Listening at 3000');
var io = socketIO.listen(app);

var person = [];
var numOfConn = 0;

io.sockets.on('connection', function(socket) {
  var newperson = {};
  function setUsername(name) {
    var isExists = false;
    for(var i = 0; i<person.length; i++){
      if (person[i].hasOwnProperty(name)) {
        isExists = true;
      }
    }
    if (!isExists && name !== null && name !== '') {
      newperson[name] = socket.id;
      person.push(newperson);
      console.log('person : ',person);
    } else {
      console.log('person : ',person);
      socket.emit('err', 'User Exists');
    }
  }
  socket.on('username', function (username) {
    setUsername(username);
  });
  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('message', function(message,to) {
    log('Client said: ', message);
    io.to(to).emit('message', message);
  });

  socket.on('connectToNext', function() {
    var current = socket.id;
    var previous;
    if (numOfConn === 0) {
      socket.emit('init', true);
      numOfConn++;
    } else if (numOfConn >= 1) {
    	console.log('Person',person);
      for (var i = 0; i < person.length; i++) {
        if(person[i][Object.keys(person[i])[0]] === current){
          previous = person[i-1][Object.keys(person[i-1])[0]];
          break;
        }
      }
      io.to(current).emit('init', false,previous);
      io.to(previous).emit('init', true,current);
      io.to(previous).emit('ready');
      io.to(current).emit('ready');
      //io.to(previous).emit('message', 'got user media');
    }
  });

});