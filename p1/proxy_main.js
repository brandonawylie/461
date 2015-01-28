var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1234';

net.createServer(function(sock) {
	sock.on('data', function(data) {
		var req_array = data.toString().split('\r\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
		console.log("RAW DATA: " + data.toString());
		console.log("parsed request: ");
		console.log(req_args);

		// open a TCP socket to them
		if (false) {//req_line[0] === "CONNECT") {
			var client = new net.Socket();
			console.log("trying to connect to HOST: " + host + ':' + port);
			client.connect(port, host, function() {
				console.log("CONNECTED TO: " + host + ':' + port);
				client.write(data.toString());
			});

			client.on('data', function(data) {
	    		console.log("GOT DATA FROM: " + host + ':' + port);
		    	console.log('DATA: ' + data);
			});

			client.on('close', function() {
		    	console.log("CONNECTED FROM: " + host + ':' + port + " was CLOSED");
			});
		// just relay the request
		} else {
			console.log("directing packet:");
			req_args['Connection'] = 'close';

			var client = new net.Socket();
			console.log("trying to connect to HOST: " + host + ':' + port);
			client.connect(port, host, function() {
				client.write(req_args.toString());
			});

			client.on('data', function(data) {
	    		console.log("GOT DATA FROM: " + host + ':' + port);
		    	console.log('DATA: ' + data);
			});

			client.on('close', function() {
		    	console.log("CONNECTED FROM: " + host + ':' + port + " was CLOSED");
			});
		}




	});
}).listen(PORT, HOST);

console.log("TCP server listening on port " + PORT);

function parseArgs(arg_arr) {
	var retVal = {};
	for (var i = 0; i < arg_arr.length; i++) {
		var line = arg_arr[i].split(':');
		if (line.length === 1) 
			continue;
		retVal[line[0].strip()] = line[1].strip();
	}
	return retVal;
}

function getRequestString(top, args) {
	var retVal = top[0] + top[1] + "HTTP/1.0\r\n";
	for (var key in args) {
		if (args.hasOwnProperty(key)) {
			retVal += key + ": " + args[key] + "\r\n";
		}
	}
	return retVal;
}
