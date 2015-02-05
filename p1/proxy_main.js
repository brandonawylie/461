var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1337';

var cache = {};
net.createServer({allowHalfOpen: true}, function(sock) {
	sock.on('data', function(data) {
        cache[data] = true;
        console.log(cache);

        // parse the request  
		var req_array = data.toString().split('\r\n');
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
        var req_url = url.parse(req_line[1]);

        // if we have no port, it's probably http
        if (req_url.port === null) {
            req_url.port = 80;
        }

        // set up vars for scope
        var sendStuff = getRequestString(req_line, req_args);
        var host = null;
        var port = null;

		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {
            // set the connection/proxyconnection to kee-alive        
            //console.log("CONNECT: sending\n" + data);
            
            // determine the host & port, then create a connection
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];
            var con_client = net.createConnection(port, host);
            //console.log("CONNECT: host=" + host + ":" + port);
			con_client.on('connect', function() {
                //console.log("CONNECT: success when connecting to host=" + host + ":" + port);
				sock.write("HTTP/1.1 200 OK");
                //con_client.write(sendStuff);

                // browser => server
                sock.on('data', function(data) {
                    //console.log("CONNECT: recieving data from browser");
                    con_client.write(data);
                });

                // server => browser
			    con_client.on('data', function(data) {
                    console.log("CONNECT: recieving data from host=" + host + ":" + port);
			    	sock.write(data);
			    });

			    con_client.on('end', function() {
			    	sock.end();
			    });

			    con_client.on('close', function() {
			    	sock.end();
			    });
			});

            con_client.on('error', function(err) {
                console.log("CONNECT: error when connecting to host=" + host + ":" + port);
                console.log(err);
                sock.end("HTTP/1.1 502 Bad Gateway");
            });

            con_client.setKeepAlive(enabled=true, 1000);

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
                    sock.end();
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
                console.log("PACKET: error");
                console.log(err);
            });
		}
	
        sock.on('error', function(err) {
            console.log("SOCK: error");
            console.log(err);
            if(client !== null) 
                client.end();
            sock.end();
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
