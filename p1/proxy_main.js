var net  = require('net');
var http = require('http');
var url  = require('url');

var HOST = '127.0.0.1';
var PORT = '1337';

net.createServer({allowHalfOpen: true}, function(sock) {
    var isTunnel = false;
    var tunnel  = null;
    var ref = 0;
    var browserDone = false;

	sock.on('data', function(data) {
        //console.log("sockets: " + ref);
        // Relay data to server if tunneling 
        // assumes if a socket is opened for a connection it is only used for tunneling
        if (isTunnel) {
            //console.log("Tunnel data to server");
            tunnel.write(data);
            return;
        }

        // parse the request (header ends on empty line)
        var header_and_data = data.toString().split('\r\n\r\n');
		var req_array = null;
        var req_data = null;
        if (header_and_data.length == 2) {
            req_array = header_and_data[0];
            req_data = header_and_data[1];
        } else {
            // Data is just header
            req_array = data.toString();
        }
        req_array = req_array.replace(/\r/gm, '').split('\n');
        //console.log('REQUEST: \n' + req_array);
		var req_line = req_array[0].split(' ');
		var req_args = parseArgs(req_array.slice(1, req_array.length));
        console.log(req_line[1]);
        var req_url = url.parse(req_line[1]);
        
        // if we have no port, it's probably http
        var is_https = (req_array.indexOf("https") > -1);
        if (req_url.port === null) {
            if (is_https) {
                req_url.port = 443;
            } else {
                req_url.port = 80;
            }
        }
        
        // set up vars for scope
        var sendStuff = null;
        var host = null;
        var port = null;

		// open a TCP socket to them
		if (req_line[0] === "CONNECT") {
            //console.log();
            //console.log("Establishing CONNECT");
            //console.log();
            // set the connection/proxyconnection to kee-alive        
            isTunnel = true;
            // determine the host & port, then create a connection
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];

            tunnel = new net.Socket({allowHalfOpen: true});
            //console.log("CONNECT: host=" + host + ":" + port);
			
            // Attempting to connect the server
            tunnel.connect(port, host, function() {
                //console.log("CONNECT: success when connecting to host=" + host + ":" + port);
				sock.write("HTTP/1.1 200 OK\r\n\r\n");

                // server => browser
			    tunnel.on('data', function(data) {
                    //console.log("CONNECT: recieving data from host=" + host + ":" + port);
			    	//console.log("Tunnel data to browser");
                    sock.write(data);
			    });

			    tunnel.on('end', function() {
                    console.log("(end)Server closed its tunnel");
			    	sock.end();
                });
            });

            sock.on('end', function() {
                //console.log("browser ended, bytes read: " + sock.bytesRead);
                console.log("browser closed connection");
                tunnel.end();
            });

            tunnel.on('error', function(err) {
                //console.log("CONNECT: error when connecting to host=" + host + ":" + port);
                //console.log(err);
                console.log("Error Establishing tunnel");
                sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            });

            tunnel.setKeepAlive(enabled=true, 1000);

        // just relay the request
        } else {
            ref++;
            if (ref > 1) {
                console.log("------------sock has " + ref + " requests-----------");
            }
            console.log(req_array[0]);
            req_args.Connection = "close";
            req_args['Proxy-connection'] = "close";
            sendStuff = getRequestString(req_line, req_args);
			var client = new net.Socket({allowHalfOpen: true});
            port = 80;
            host = req_url.hostname;
            console.log("host: " + host);
            console.log("port: " + port);
            //console.log("Client: host=" + host + ":" + port);

            client.connect(port, host, function() {
                
                client.end(sendStuff + '\r\n\r\n');
                
                client.on('data', function(data) {
                    sock.write(data);
                    // if (data.toString().indexOf("Connection: keep-alive") > -1) {
                    //     // Connection is keep alive, need to switch header format
                    //     var server_data = data.toString();
                    //     var header_endex = server_data.indexOf("\r\n\r\n");
                    //     var server_header = server_data.slice(0, header_endex);
                        
                    //     // Send payload as stream
                    //     sock.write(server_data.slice(header_endex));

                    //     // Parse & change header then send
                    //     res_array = server_header.replace(/\r/gm, '').split('\n');
                    //     var res_line = req_array[0].split(' ');
                    //     var res_args = parseArgs(res_array.slice(1, res_array.length));
                    //     var response_header = getRequestString(res_line, res_args);
                    //     console.log("\nRESPONSE HEADER:\n" + response_header);
                    // }
                });

                client.on('end', function() {
                    ref--;
                    if (ref === 0) {
                        console.log("server closed its connection(end)");
                        sock.end();
                    }
                });

                // Browser has signalled end, relay this to the server
                sock.on('end', function() {
                    //console.log("browser ended, bytes read: " + sock.bytesRead);
                    browserDone = true;
                    client.end();
                });
            });

            client.on('error', function(err) {
                console.log("Server socket: error");
                console.log(err);
            });
        }

        sock.on('error', function(err) {
            console.log("Browser socket: error");
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
