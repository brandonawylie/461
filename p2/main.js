// Logging
// util.log(TAG + "TCP Server Bound to port " + PORT);

var net     = require('net');
var http    = require('http');
var url     = require('url');
var util    = require('util');
var spawn   = require('child_process').spawn;
var torutil = require('./torutil');
var command = require('./command_cell');
var relay   = require('./relay_cell');
var BROSWER_PORT = 1337;
var TOR_PORT = 1338;
// registations
var torRegistrations = '';

// register ourself
var torName = "Tor61Router";
var groupNum = 5316;
var instanceNum = Math.floor((Math.random() * 9999) + 1);
var router_name = torName + "-" + groupNum + "-" + instanceNum;
var agentID = Math.floor((Math.random() * 9999) + 1);

// TAG ourselves to log
var TAG = agentID + ": main.js: ";

var routerAddress = "";

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  routerAddress = add;
});

// (circuit no, agent no) => (circuit no b, agent no b)
routingTable  = {};
socketTable   = {};
streamTable   = {};
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

var tor_server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    util.log(TAG + "Received Incoming Socket from tor router " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    var circuitNum = torutil.getRandomCircuitNumberEven();

    // Assigned arbitrary size
    var socketBuffer = new Buffer(0);
    incomingSocket.on('data', function(data) {
        util.log(TAG + "<---    Received cell from tor router "+ incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
        incomingSocket.id = 927
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
    util.log(TAG + "Received Incoming Socket from browser " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    pkt = '';
    incomingSocket.on('data', function(data) {
        // TODO: Create stream, pack data up in to cells and send it accross stream
        pkt += data;
    });

    incomingSocket.on('end', function(data) {
        util.log(TAG + "Recieved end from host with complete data recv: " + pkt);
        relay.packAndSendData(pkt);
    });
}).listen(BROSWER_PORT);

/*========================
TOR SERVER STARTS UP HERE
========================*/
getTorRegistrations(function(data) {
    if (data === null) {
        // error
        util.log(TAG + "errored getting registrations");
    }
    
    torRegistrations = torutil.parseRegistrations(data);
    
    util.log(TAG + "Registrations recieved: \n" + data);

    tor_server.listen(TOR_PORT, function() {
        util.log(TAG + "TCP Server Bound to port " + TOR_PORT);
        registerRouter(TOR_PORT);
        createCircuit(data);
    });
});


function createCircuit(data) {
    util.log(TAG + "Creating circuit...");
    var currentCircuit = [];
    for (var i = 0; i < 3; i++) {
        //currentCircuit.push(torRegistrations[Math.floor((Math.random() * torRegistrations.length))]);
        currentCircuit.push(['127.0.0.1', '1338', agentID]);
    }
    util.log(TAG + "Chose 4 random routers with ip addresses: " + 
             currentCircuit[0][0] + ", " + currentCircuit[1][0] + ", " + currentCircuit[2][0]);

    var circuitNum = Math.floor((Math.random() * 9999) + 1);

    // send to cell 1
    // TODO: Figure out how to store state and send these pieces sequentially
    
    socket = net.connect(currentCircuit[0][1], currentCircuit[0][0], function() {
        util.log(TAG + "Successfully created connection from " + 
                 agentID + " to " + currentCircuit[0][0] + ":" + currentCircuit[0][1] + ", " + currentCircuit[0][2]);
        // send open cell
        console.log();
        util.log(TAG + "--->    Sending open cell with router: " + currentCircuit[0]);

        socketTable[[currentCircuit[0][2], 1]] = socket;
        // Assigned arbitrary size
        var socketBuffer = new Buffer(0);
        socket.on('data', function(data) {
            util.log(TAG + "<---    Received cell from tor router "+ socketTable[[currentCircuit[0][2], 1]].remoteAddress + ":" + socketTable[[currentCircuit[0][2], 1]].remotePort);
            
            socketBuffer = Buffer.concat([socketBuffer, data]);
            var buf;

            while (socketBuffer.length >= 512) {
                // More data than one cell
                buf = socketBuffer.slice(0, 512);
                //var pkt = buf.toString();
                // util.log(TAG + "Recieved data from host with complete data recv: " + pkt);
                torutil.unpackCommand(buf, socketTable[[currentCircuit[0][2], 1]]);
                socketBuffer = socketBuffer.slice(512);
            }
        });
        

        // Write the create cell, wait for the created event
        socket.write(command.createOpenCell(agentID, currentCircuit[0][2]), function() {

            // Opened event, send the create cell
            var openedCallback =  function() {
                console.log();
                util.log(TAG + "socket on opened was called, sending created");
                socket.Opened = true;

                // Write the create cell, and wait for the created event
                socket.write(command.createCreateCell(circuitNum), function() {

                    var createdCallback = function() {
                        console.log();
                        util.log(TAG + "socket on created was called, updating routingTable"); 
                        outgoingEdge = {
                            "Socket": socket,
                            "circuitNum": circuitNum
                        }
                        util.log(TAG + "Sending extend relay cell");
                        socket.Created = true;
                        socket.write(relay.createExtendCell(circuitNum, currentCircuit[1][0], currentCircuit[1][1], currentCircuit[1][2]), function() {

                            /*
                                Once created, the source router will want to relay more extends to the existing connection
                                so we keep state within the socket objects (and hope it works!!)
                            */
                            var extendedCallback = function() {
                                if (socket.hasOwnProperty("ExtendedCount")) {
                                    socket.ExtendedCount += 1;
                                } else {
                                    socket.ExtendedCount = 1;
                                }
                                var currentIndex = socket.ExtendedCount + 1;
                                if (socket.ExtendedCount < 2) {
                                    socket.write(relay.createExtendCell(circuitNum, 0, currentCircuit[currentIndex][0], currentCircuit[currentIndex][1], currentCircuit[currentIndex][2]), function() {

                                    });
                                } else {
                                    socket.removeListener('extended', extendedCallback);
                                }
                            };
                            socket.on('extended', extendedCallback);
                        });

                        socket.removeListener('created', createdCallback);
                    };
                    socket.on('created', createdCallback);
                    
                });

                socket.removeListener('opened', openedCallback);
            };

            socket.on('opened', openedCallback);
            
        });

        // send to cell 2
        // util.log(TAG + "--->    Sending relay to router: " + currentCircuit[1]);
        // socketTable[currentCircuit[0][2]].write(relay.createExtendCell(circuitNum, 0, currentCircuit[1][0], currentCircuit[1][1], currentCircuit[1][2]));

        // // send to cell 3
        // util.log(TAG + "--->    Sending relay to router: " + currentCircuit[2]);
        // socketTable[currentCircuit[0][2]].write(relay.createExtendCell(circuitNum, 0, currentCircuit[2][0], currentCircuit[2][1], currentCircuit[1][2]));
    });
    
}

function registerRouter(port) {

    // Currently has dummy registration info
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


function getTorRegistrations(callback) {
    util.log(TAG + "fetching TOR registrations: in progress");
    var fetchClient = spawn('python', ['./fetch.py',
                                  'Tor61Router-5316',
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