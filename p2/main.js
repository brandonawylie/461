// imports
var net     = require('net');
var http    = require('http');
var url     = require('url');
var util    = require('util');
var spawn   = require('child_process').spawn;
var torutil = require('./torutil');
var command = require('./command_cell');
var relay   = require('./relay_cell');
var TIMEOUT_TIME = 4000;
// registations

// registations to query, and store
var torRegistrations = '';
var routerAddress = "";
var searchTorName = 'Tor61Router';

// ./run <group number> <instance number> <HTTP Proxy port>
if (process.argv.length !== 5) {
    util.log("Usage: node main.js <group number> <instance number> <HTTP Proxy port>");
    util.log("Our usage: node main.js 5316 <instance> 1337");
    process.exit(1);
}

// register ourself
var TOR_PORT = 1338;
var groupNum = parseInt(process.argv[2]);
var instanceNum = process.argv[3];
var BROSWER_PORT = parseInt(process.argv[4]);
var agentID = groupNum << 16 | instanceNum;
var torName = "Tor61Router";
var router_name = torName + "-" + groupNum + "-" + instanceNum;
// TAG ourselves to log
var TAG = agentID + ": main.js: ";

// lookup our own address
require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  routerAddress = add;
});

// Initial circuit socket
var startSocket = null;
var startCircuitNum = null;

// (circuit no, agent no) => (circuit no b, agent no b)
routingTable  = {};
socketTable   = {};
timers = {};
streamTable   = {};

// export our variables we want to use everywhere.
module.exports = {};

exports.routingTable = function() {
        return routingTable;
    };
exports.socketTable = function() {
        return socketTable;
    };
exports.streamTable = function() {
        return streamTable;
    };
exports.agentID = function() {
    return agentID;
};
exports.startCircuitID = function() {
    return startCircuitNum;
};



var tor_server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    util.log(TAG + "Received Incoming Socket from tor router " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);

    incomingSocket.on('error', function(err) {
        util.log(TAG + "something went wrong " + err);
    });

    // Assigned arbitrary size
    var socketBuffer = new Buffer(0);
    incomingSocket.on('data', function(data) {
        util.log(TAG + "Received cell from tor router "+ incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
        incomingSocket.id = 927;
        socketBuffer = Buffer.concat([socketBuffer, data]);
        var buf;

        while (socketBuffer.length >= 512) {
            // More data than one cell
            buf = socketBuffer.slice(0, 512);
            //var pkt = buf.toString();
            // util.log(TAG + "Recieved data from host with complete data recv: " + pkt);
            torutil.unpackCommand(buf, incomingSocket);
            socketBuffer = socketBuffer.slice(512);
        }
    });

    // This shouldn't happen
    incomingSocket.on('end', function(data) {
        util.log(TAG + "Recieved end from host");
        torutil.removeSocketFromTable(incomingSocket);
    });
});

// Proxy
var browser_server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    incomingSocket.on('error', function(err) {
        util.log(TAG + "something went wrong " + err);
    });

    util.log(TAG + "Received Incoming Socket from browser " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    var isTunnel = false;

    //var browserBuffer = new Buffer(0);
    var streamNumber = torutil.getUniqueStreamNumber(streamTable, startSocket._handle.fd, startCircuitNum);;
    incomingSocket.on('data', function(data) {

        console.log();
        util.log(TAG + " RECEIVED data from browser");
        console.log("Browser socket: " + incomingSocket._handle.fd);
        console.log("Start socket: " + startSocket._handle.fd);
        console.log();

        // From last proxy project, & modifed
        // Tunnel data through tor, simply as data buffer
        if (isTunnel) {
            relay.packAndSendData(data, streamNumber, startCircuitNum, startSocket);
            return;
        }

        // parse the browser's request (header ends on empty line)
        var header_and_data = data.toString().split('\r\n\r\n');
        if (header_and_data.length == 2) {
            req_array = header_and_data[0];
            req_data = header_and_data[1];
        } else {
            // Data is just header
            req_array = data.toString();
        }
        req_array = req_array.replace(/\r/gm, '').split('\n');
        var req_line = req_array[0].split(' ');
        var req_args = torutil.parseArgs(req_array.slice(1, req_array.length));
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

        var req_array = null;
        var req_data = null;

        // Map the stream correctly to the browser
        var streamKey = [startSocket._handle.fd, startCircuitNum, streamNumber];
        util.log(TAG + "Mapping " + streamKey + " to browser socket");
        streamTable[streamKey] = incomingSocket;

        // open a TCP socket to them
        if (req_line[0] === "CONNECT") {
            // CASE 1: Browser is tunneling
            console.log("--------------------------------------------");
            console.log("Tunneling Attempting....");
            console.log("--------------------------------------------");
            // set the connection/proxyconnection to kee-alive        
            isTunnel = true;
            // determine the host & port, then create a connection
            host = req_line[1].split(':')[0];
            port = req_line[1].split(':')[1];

            // -------------------------------------------------------
            // --------------------------------------------------------
            var beginCell = relay.createBeginCell(startCircuitNum, streamNumber, host, port);
            
            startSocket.write(beginCell, function() {
                var connectedListener = function() {
                    util.log(TAG + "Connected complete for tunnel stream");
                    console.log();
                    
                    // Write a 200 OK to the browser, so that it will start
                    // sending the data
                    util.log("----> " + TAG + "Sending 200 OK to browser...");
                    incomingSocket.write("HTTP/1.1 200 OK\r\n\r\n", function() {
                        util.log("Sent a 200 OK to browser socket, ready to take data");
                    });

                    startSocket.removeListener('connected', connectedListener);
                };
                startSocket.on('connected', connectedListener);
            });

        } else {
            // CASE 2: Browser is NOT tunneling
            // Setup connection to close, and create request to send
            req_args.Connection = "close";
            req_args['Proxy-connection'] = "close";
            sendStuff = torutil.getRequestString(req_line, req_args);
            port = req_url.port;
            host = req_url.hostname;
            console.log();
            util.log(TAG + "Host requested: " + host + ":" + port + ", assigned streamNumber=" + streamNumber);
            console.log();
                
            var dataString = sendStuff + '\r\n\r\n';
            var cleanedData = new Buffer(dataString.length);
            cleanedData.write(dataString);
            util.log("----> " + TAG + "Sending begin cell...");
            var beginCell = relay.createBeginCell(startCircuitNum, streamNumber, host, port);
            startSocket.write(beginCell, function() {
                var connectedListener = function() {
                    util.log(TAG + "Connected complete for stream");
                    console.log();
                    util.log("----> " + TAG + "Sending data...");
                    relay.packAndSendData(cleanedData, streamNumber, startCircuitNum, startSocket);
                    startSocket.removeListener('connected', connectedListener);
                };

                startSocket.on('connected', connectedListener);
            });
        }
    });

    incomingSocket.on('end', function() {
        util.log(TAG + "recv'd end from browser");
        startSocket.write(relay.createEndCell(startCircuitNum, streamNumber));
    });
}).listen(BROSWER_PORT);


/*========================
TOR SERVER STARTS UP HERE
========================*/
getTorRegistrations(searchTorName, function(data) {
    if (data.length === 0) {
        // Exit, we found nothing
        util.log("No tor nodes found on the registration, exiting...");
        process.exit(0);
    }

    torRegistrations = torutil.parseRegistrations(data);

    util.log(TAG + "Registrations recieved: \n" + data);

    tor_server.listen(TOR_PORT, function() {
        util.log(TAG + "TCP Server Bound to port " + TOR_PORT);
        registerRouter(TOR_PORT);
        createCircuit(data);
    });
});
/*========================
TOR SERVER STARTS UP HERE
========================*/

function createCircuit(data) {
    util.log(TAG + "Creating circuit...");
    var currentIndex = Math.floor(Math.random() * torRegistrations.length);
    var currentNode = torRegistrations[currentIndex];

    util.log(TAG + "Chose 4 random routers with ip addresses");

    // Add ourselves to tor registrations
    torRegistrations.push(['127.0.0.1', TOR_PORT, agentID]);

    var circuitNum = torutil.getRandomCircuitNumberOdd();
    startCircuitNum = circuitNum;
    // send to cell 1
    
    util.log(TAG + "Connecting to first router...");

    timers["connectTimeout"] = setTimeout(function() {
        // Remove bad node from the index
        connectFailed(currentIndex, socket);
    }, TIMEOUT_TIME);

    socket = new net.Socket({allowHalfOpen: true});

    socket.on('error', function(err) {
        util.log("Something went wrong, error: " + err);
    });

    socket.connect(currentNode[1], currentNode[0], function() {
        clearTimeout(timers["connectTimeout"]);

        util.log(TAG + "Successfully created connection from " + 
                 agentID + " to " + currentNode[0] + ":" + currentNode[1] + ", " + currentNode[2]);
        // Update socket table
        socketTable[[currentNode[2], 1]] = socket;

        // Set initial socket
        startSocket = socket;

        // if we recv end & we are src router then recreate circuit
        socket.on('end', function() {
            console.log('=======================================');
            console.log('Source Router Circuit Has Gone Down!!');
            console.log('=======================================');
            torutil.lookupAndDestroyBySocket(socket);
            createCircuit();
        });

        // Assigned arbitrary size
        var socketBuffer = new Buffer(0);
        socket.on('data', function(data) {
            
            socketBuffer = Buffer.concat([socketBuffer, data]);
            var buf;

            while (socketBuffer.length >= 512) {
                // More data than one cell
                buf = socketBuffer.slice(0, 512);
                //var pkt = buf.toString();
                // util.log(TAG + "Recieved data from host with complete data recv: " + pkt);
                torutil.unpackCommand(buf, socket);
                socketBuffer = socketBuffer.slice(512);
            }
        });

        // send open cell
        console.log();
        util.log("---->" + TAG + "Sending open cell with router: " + currentNode);

        // Write the create cell, wait for the created event
        socket.write(command.createOpenCell(agentID, currentNode[2]), function() {

            // Opened event, send the create cell
            var openedCallback =  function() {
                //clear timeout
                clearTimeout(timers["openTimeout"]);

                console.log();
                util.log("---->" + TAG + "socket on opened was called, sending create cell");
                socket.Opened = true;

                // Write the create cell, and wait for the created event
                socket.write(command.createCreateCell(circuitNum), function() {

                    var createdCallback = function() {
                        // clear timeout
                        clearTimeout(timers["createTimeout"]);

                        // Get next node to connect to 
                        currentIndex = Math.floor(Math.random() * torRegistrations.length);
                        currentNode = torRegistrations[currentIndex];
                        util.log(TAG + "socket on created was called, updating routingTable"); 
                        outgoingEdge = [socket._handle.fd, circuitNum];
                        routingTable[outgoingEdge] = null;
                        console.log(outgoingEdge + ":" + routingTable[outgoingEdge]);
                        
                        console.log();
                        util.log("---->" + TAG + "Sending extend relay cell");
                        socket.Created = true;
                        socket.write(relay.createExtendCell(circuitNum, currentNode[0], currentNode[1], currentNode[2]), function() {
                            /*
                                Once created, the source router will want to relay more extends to the existing connection
                                so we keep state within the socket objects (and hope it works!!)
                            */
                            var extendedCallback = function() {
                                // clear timeout
                                clearTimeout(timers["extendTimeout"]);

                                if (socket.hasOwnProperty("ExtendedCount")) {
                                    socket.ExtendedCount += 1;
                                } else {
                                    socket.ExtendedCount = 1;
                                }
                                util.log(TAG + "Extended count is now: " + socket.ExtendedCount);
                                
                                if (socket.ExtendedCount < 2) {
                                    // Get next node to connect to 
                                    currentIndex = Math.floor(Math.random() * torRegistrations.length);
                                    currentNode = torRegistrations[currentIndex];
                                    console.log();
                                    util.log("---->" + TAG + "Sending relay extend cell to next hop...");
                                    var extendCell = relay.createExtendCell(circuitNum, currentNode[0], currentNode[1], currentNode[2]);
                                    socket.write(extendCell, function() {
                                        util.log(TAG + "Relay extend cell sent successfully");
                                    });
                                } else {
                                    console.log();
                                    util.log("Circuit has been completed for router: " + agentID);
                                    console.log();
                                    socket.removeListener('extended', extendedCallback);
                                }
                            };

                            // set extend timeout
                            timers["extendTimeout"] = setTimeout(function() {
                                extendFailed(currentIndex, socket, openedCallback, createdCallback, extendedCallback);
                            }, TIMEOUT_TIME);

                            socket.on('extendfailed', function() {
                                clearTimeout(timers["extendTimeout"]);
                                extendFailed(currentIndex, socket, openedCallback, createdCallback, extendedCallback);
                            }); 

                            socket.on('extended', extendedCallback);
                        });

                        socket.removeListener('created', createdCallback);
                    };

                    // set create timeout
                    timers["createTimeout"] = setTimeout(function() {
                        createFailed(currentIndex, socket, openedCallback, createdCallback);
                    }, TIMEOUT_TIME);
                    
                    socket.on('createfailed', function() {
                        clearTimeout(timers["createTimeout"]);
                        createFailed(currentIndex, socket, openedCallback, createdCallback);
                    });

                    socket.on('created', createdCallback);
                    
                });

                socket.removeListener('opened', openedCallback);
            };

            timers["openTimeout"] = setTimeout(function() {
                openFailed(currentIndex, socket, openedCallback);
            }, TIMEOUT_TIME);

            socket.on('openfailed', function() {
                clearTimeout(timers["openTimeout"]);
                openFailed(currentIndex, socket, openedCallback);
            });

            socket.on('opened', openedCallback);
            
        });

    });
    
}

function registerRouter(port) {

    // Currently has dummy registration info
    console.log();
    util.log("Registering as " + router_name);
    console.log();
    var regClient = spawn('python', ['./registration_client.py', port, router_name, agentID]);

    util.log(TAG + "registering: in progress");
    function endChild() {
        regClient.kill('SIGINT');
        process.exit(0);
    }

    regClient.stdout.on('data', function(data) {
        util.log(TAG + "registering got stdin with data: " + data);
        util.log(TAG + "got stdin with data: " + data);
        console.log(data.toString());
    });
    
    regClient.stderr.on('data', function(data) {
        util.log(TAG + "got stderr with data: " + data);
        console.log(data.toString());
    });

}


function getTorRegistrations(queryName, callback) {
    util.log(TAG + "fetching TOR registrations that match \"" + queryName + "\"");
    var fetchClient = spawn('python', ['./fetch.py',
                                  queryName,
                 ]
    );
    var allData = '';
    
    fetchClient.stdout.on('data', function(data) {
        allData += data;
    });
    
    fetchClient.stdout.on('end', function() {
        util.log(TAG + "fetching TOR registrations: completed");
        callback(allData);
    });
    
    fetchClient.stderr.on('data', function(data) {
        util.log(TAG + "fetching TOR registrations had error: " + data);
        // Something bad happened
        callback(null);
    });
 
 }
exports.createCircuit = createCircuit;

function connectFailed(currentIndex, socket) {
    console.log();
    util.log(TAG + "Connect timed out, trying to establish another circuit");
    torRegistrations.splice(currentIndex, 1);
    createCircuit();
}

 function openFailed(currentIndex, socket, openedCallback) {
    console.log();
    util.log(TAG + "openfailed recieved, trying to establish another circuit");
    torRegistrations.splice(currentIndex, 1);
    socket.removeListener('opened', openedCallback);
    createCircuit();
 }

function createFailed(currentIndex, socket, openedCallback, createdCallback) {
    console.log();
    util.log(TAG + "createfailed recieved, trying to establish another circuit");
    torRegistrations.splice(currentIndex, 1);
    socket.removeListener('opened', openedCallback);
    socket.removeListener('created', createdCallback);
    createCircuit();
}

function extendFailed(currentIndex, socket, openedCallback, createdCallback, extendedCallback) {
    console.log();
    util.log(TAG + "extendfailed recieved, trying to establish another circuit");
    torRegistrations.splice(currentIndex, 1);
    socket.removeListener('opened', openedCallback);
    socket.removeListener('created', createdCallback);
    socket.removeListener('extended', extendedCallback);
    createCircuit();
}
