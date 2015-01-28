var net = require('net');
var http = require('http');

var HOST = '127.0.0.1';
var PORT = '1234';

net.createServer(function(sock) {
	sock.on('data', function(data) {
		var req_array = data.toString().split('\r\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
		//console.log(req_line);
		console.log(req_args);
		
		// Port parsing TBD
		var host = req_line[1];
		var port = 80;

		/*
			1. parse the args
			2. check stuff
		*/
		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {
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
			req_args["method"] = req_line[0];
			req_args["hostname"] = req_line[1];
			var req = http.request(req_args, function(res) {
				res.on('data', function(data) {
					console.log("GOT DATA FROM: " + host + ':' + port);
		    		console.log('DATA: ' + data);
				});

				res.on('end', function() {
		    	console.log("CONNECTED FROM: " + host + ':' + port + " was ended");
			});
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
		retVal[line[0]] = line[1];
	}
	return retVal;
}