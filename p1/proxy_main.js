var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1337';

net.createServer({allowHalfOpen: true}, function(sock) {
    var isTunnel = false;
    var tunnel  = null;
    var ref = 0;

	sock.on('data', function(data) {
        //console.log("sockets: " + ref);
        if (isTunnel) {
            console.log();
            console.log("------------------------SENDING THRU TUNNEL ----------------");
            console.log();
            tunnel.write(data);
            return;
        }

        // parse the request 
        var everything = data.toString().split('\r\n\r\n');
		var req_array = null;
        var req_data = null;
        if (everything.length == 2) {
            req_array = everything[0].replace(/\r/gm, '');
            req_data = everything[1];
        } else {
            req_array = data.toString();
        }
        //console.log(everything);
        //console.log("is tunnel? " + isTunnel);
        req_array = req_array.split('\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
        var req_url = url.parse(req_line[1]);
        // if we have no port, it's probably http
        if (req_url.port === null) {
            req_url.port = 80;
        }
        //console.log(req_line);
        console.log(req_array[0]);
        // set up vars for scope
        var sendStuff = getRequestString(req_line, req_args);
        var host = null;
        var port = null;

		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {

            // set the connection/proxyconnection to kee-alive        
            //console.log("CONNECT: sending\n" + data);
            isTunnel = true;
            // determine the host & port, then create a connection
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];
            tunnel = net.createConnection(port, host);
            //console.log("CONNECT: host=" + host + ":" + port);
			tunnel.on('connect', function() {
                //console.log("CONNECT: success when connecting to host=" + host + ":" + port);
				sock.write("HTTP/1.1 200 OK\r\n\r\n");
                tunnel.write(req_data);

                // server => browser
			    tunnel.on('data', function(data) {
                    //console.log("CONNECT: recieving data from host=" + host + ":" + port);
			    	sock.write(data);
			    });

			    tunnel.on('end', function() {
			    	sock.end();
                    isTunnel = false;
			    });

			    tunnel.on('close', function() {
			    	sock.end();
                    isTunnel = false;
			    });
			});

            tunnel.on('error', function(err) {
                //console.log("CONNECT: error when connecting to host=" + host + ":" + port);
                //console.log(err);
                sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            });

            tunnel.setKeepAlive(enabled=true, 1000);

		// just relay the request
		} else {
            req_args.Connection = "close";
            req_args['Proxy-connection'] = "close";
			var client = new net.Socket({allowHalfOpen: true});
            port = req_url.port;
            host = req_url.hostname;
            //console.log("PACKET: host=" + host + ":" + port);

			client.connect(port, host, function() {

                client.on('data', function(data) {
                    sock.write(data);
                });

                client.on('end', function() {
                    //sock.end();
                });

                client.on('close', function() {
                    sock.end();
                });
                
                // Browser has signalled end, relay this to the server
                sock.on('end', function() {
                    //console.log("browser ended, bytes read: " + sock.bytesRead);
                    client.end();
                });

				client.write(sendStuff + '\r\n');

			});

            client.on('error', function(err) {
                //console.log("PACKET: error");
                //console.log(err);
            });
		}
	
        sock.on('error', function(err) {
            //console.log("SOCK: error");
            console.log(err);
        });
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
