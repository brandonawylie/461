var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1337';

var server = net.createServer( {allowHalfOpen: true}, function(sock) {
	sock.on('end', function() {
		server.close();
	});
	sock.on('data', function(data) {
		var req_array = data.toString().split('\r\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
        var req_url = url.parse(req_line[1]);


        console.log(req_array[0]);
        if (req_url.port === null) {
            req_url.port = 80;
        }
        var sendStuff = null;
        var host = null;
        var port = null;
        var client = null;
		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {
			sendStuff = getRequestString(req_line, req_args);
			sendStuff.Connection = "keep-alive";
			client = new net.Socket({allowHalfOpen: true});
            host = req_url.hostname;
            port = req_url.port;
			client.connect(req_url.port, req_url.hostname, function() {
				sock.write("HTTP/1.1 200 OK");
			    client.on('data', function(data) {
			    	sock.write(data);
			    });

			    client.on('end', function() {
			    	sock.end();
			    });

			    client.on('close', function() {
			    	sock.end();
			    });
                
			});

		// just relay the request
		} else {
            sendStuff = getRequestString(req_line, req_args);
			client = new net.Socket({allowHalfOpen: true});
            host = req_url.hostname;
            port = req_url.port;
			client.connect(req_url.port, req_url.hostname, function() {
				client.end(sendStuff + '\r\n');

			    client.on('data', function(data) {
			    	sock.write(data);
			    });

			    client.on('end', function() {
			    	client.close();
			    	sock.close();
			    });
                
			});

            sock.on('end', function() {
                client.end();
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
