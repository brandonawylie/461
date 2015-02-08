var net  = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');

if (process.argv.length !== 3) {
    util.log("Usage: node proxy_main.js <portnum>");
    process.exit(1);
}

var HOST = '127.0.0.1';
var PORT = process.argv[2];

net.createServer({allowHalfOpen: true}, function(sock) {
    var isTunnel = false;
    var tunnel  = null;

    sock.on('data', function(data) {
        // Relay data to server if tunneling 
        // assumes if a socket is opened for a connection it is only used for tunneling
        if (isTunnel) {
            tunnel.write(data);
            return;
        }

        // parse the browser's request (header ends on empty line)
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
        var req_line = req_array[0].split(' ');
        var req_args = parseArgs(req_array.slice(1, req_array.length));
        var req_url = url.parse(req_line[1]);
        
        // Specify port if null
        var is_https = (req_array[0].indexOf("https") > -1);
        if (req_url.port === null) {
            if (is_https) {
                req_url.port = 443;
            } else {
                req_url.port = 80;
            }
        }

        // Print first line of request
        util.log(">>> " + req_array[0]);

        // set up vars for scope
        var sendStuff = null;
        var host = null;
        var port = null;

        // open a TCP socket to them
        if (req_line[0] === "CONNECT") {
            // set the connection/proxyconnection to kee-alive        
            isTunnel = true;
            // determine the host & port, then create a connection
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];

            tunnel = new net.Socket({allowHalfOpen: true});

            // Attempting to connect the server
            tunnel.connect(port, host, function() {
                sock.write("HTTP/1.1 200 OK\r\n\r\n");

                // server => browser
                tunnel.on('data', function(data) {
                    sock.write(data);
                });

                tunnel.on('end', function() {
                    sock.end();
                });
            });

            sock.on('end', function() {
                tunnel.end();
            });

            tunnel.on('error', function(err) {
                console.log("Error Establishing tunnel");
                sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
            });

            tunnel.setKeepAlive(enabled=true, 1000);

        //  Relay the request
        } else {
            // Setup connection to close, and create request to send
            req_args.Connection = "close";
            req_args['Proxy-connection'] = "close";
            sendStuff = getRequestString(req_line, req_args);
            port = req_url.port;
            host = req_url.hostname;

            // Connect to server
            var client = new net.Socket({allowHalfOpen: true});
            client.connect(port, host, function() {
                
                client.end(sendStuff + '\r\n\r\n');
                
                client.on('data', function(data) {
                    sock.write(data);
                });

                client.on('end', function() {
                    sock.end();
                });

                // Browser has signalled end, relay this to the server
                sock.on('end', function() {
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

util.log("Proxy listening on " + HOST + ":" + PORT);

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
