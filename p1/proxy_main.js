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
        var req_url = url.parse(req_line[1]);

        if (req_url.port === null) {
            req_url.port = 80;
        }

		// open a TCP socket to them
		if (false) {//req_line[0] === "CONNECT") {


		// just relay the request
		} else {
			console.log("directing packet:");
			req_args['Connection'] = 'close';
            console.log(req_url.hostname);
            console.log(req_url.port);

            var sendStuff = getRequestString(req_line, req_args);
            console.log(sendStuff);

			var client = new net.Socket();
            var host = req_url.hostname;
            var port = req_url.port;
            console.log("CONNECTING TO HOST: " + host + ":" + port);
			client.connect(req_url.port, req_url.hostname, function() {
                var retVal = "";
				client.end(sendStuff + '\r\n');

			    client.on('data', function(data) {
		        	retVal += data;
			    });

			    client.on('close', function() {
                    sock.end(retVal);
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
		if (line.length === 1) continue;
		retVal[line[0]] = line[1];
	}
	return retVal;
}

function getRequestString(top, args) {
	var retVal = top[0] + " " + top[1] + " " + "HTTP/1.0\r\n";
	for (var key in args) {
		if (args.hasOwnProperty(key)) {
			retVal += key + ": " + args[key] + "\r\n";
		}
	}
	return retVal;
}
