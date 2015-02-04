var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1337';

net.createServer({allowHalfOpen: true}, function(sock) {
	sock.on('data', function(data) {
		var req_array = data.toString().split('\r\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
        var req_url = url.parse(req_line[1]);

        console.log(req_array[0] + "\nsock bytes read: " + sock.bytesRead);
        if (req_url.port === null) {
            req_url.port = 80;
        }

        var client = null;
        var sendStuff = null;
        var host = null;
        var port = null;
		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {
			sendStuff = getRequestString(req_line, req_args);
			sendStuff.Connection = "keep-alive";
			client = new net.Socket({allowHalfOpen: true});
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];
            console.log("CONNECT: host=" + host + ":" + port);
			client.connect(port, host, function() {
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
            port = req_url.port;
            host = req_url.hostname;
            console.log("PACKET: host=" + host + ":" + port);
			client.connect(port, host, function() {
				client.write(sendStuff + '\r\n');
			    client.on('data', function(data) {
			    	sock.write(data);
			    });

			    client.on('end', function() {
			    	sock.end();
			    });

			    client.on('close', function() {
			    	sock.end();
			    });
                
                // Browser has signalled end, relay this to the server
                sock.on('end', function() {
                    console.log("browser ended, bytes read: " + sock.bytesRead);
                    client.end();
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
