var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var url  = require('url');
var command = require('./command_cell');
var relay = require('./relay_cell');
var globals = require('./main');
var spawn = require('child_process').spawn;
var TAG = "routes.js: ";
var PORT = 1337;
var TIMEOUT_TIME = 3000;

function commandCreate(obj, socket) {
    util.log(TAG + "Create Cell recv'd for circuitID: " + obj.CircuitID);
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var outgoingEdge = [socket._handle.fd, obj.CircuitID];

    if (routingTable.outgoingEdge == null) {
        //util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        util.log(TAG + "Updating routing table to route to null w/ CircuitID: " + outgoingEdge[1]);
        routingTable[outgoingEdge] = null;
        printRoutingTable(routingTable);
    }

    console.log();
    util.log("<----" + TAG + "Sending created cell");
    util.log("Sending to socket:" + socket._handle.fd);
    socket.write(command.createCreatedCell(obj.CircuitID), function() {
        util.log(TAG + " sending created cell successful");
    });
}

function commandCreated(obj, socket) {
    util.log(TAG + "created Cell recv'd");
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    console.log("Recvd circuitID: " + obj.CircuitID);
    util.log(TAG + "Setting created event");
    socket.emit('created');

}

function commandCreateFailed(obj) {
    socket.emit('createfailed');
}

function commandDestroy(obj, socket) {
    //TODO implement this
    var key = [socket._handle.fd, obj.CircuitID];
    var startCircuitID = globals.startCircuitID();
    if (startCircuitID === obj.CircuitID) {
        util.log(TAG + " at source, a router failed, trying to rebuild");
        globals.createCircuit();
    } else {
        util.log(TAG + " not at source, a router failed, passing it along");
        torutil.lookupAndDestroyByCircuitID(obj.CircuitID);
    }
}

function commandOpen(obj, socket) {
    util.log(TAG + "Open Cell recv'd");
    socketTable = globals.socketTable();
    agentID = globals.agentID();
    if (!socketTable.hasOwnProperty([obj.AgentIDBegin, 0])) {
        util.log(TAG + "Adding socket to table w/ agentID: " + obj.AgentIDBegin);
        socketTable[[obj.AgentIDBegin, 0]] = socket;
    } else {
        util.log(TAG + "Open Cell recv'd, with existing socket already open: ERROR");
    }

    console.log();
    util.log("<----" + TAG + "Open was a success, sending opened back to agent id: " + obj.AgentIDBegin);

    socketTable[[obj.AgentIDBegin, 0]].on('error', function(err) {
        util.log(TAG + " something went wrong " + err);
    });

    socketTable[[obj.AgentIDBegin, 0]].write(command.createOpenedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + "Sending opened successful");
    });
}

function commandOpened(obj, socket) {
    socketTable = globals.socketTable();
    //socketTable[[obj.AgentIDBegin, 0]] = socket;
    util.log(TAG + "Opened received, setting opened event");

    socket.emit('opened');
}
    
function commandOpenFailed(obj, socket) {
    //TODO implement this
    socket.emit('openfailed');
}

function relayBegin(obj, socket, host, port) {
    var routingTable = globals.routingTable();
    var key = [socket._handle.fd, obj.CircuitID];
    if (routingTable[key] == null) {
        // Arrived at server
        util.log(TAG + " begin arrived at end, adding a connection to " + host + ":" + port + ", with stream id of " + obj.StreamID);
        var streamTable = globals.streamTable();
        var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];
        util.log(TAG + "Mapping " + streamKey + " to server socket");
        streamTable[streamKey] = new net.Socket({allowHalfOpen: true});
        streamTable[streamKey].connect(parseInt(port), host,  function() {

            streamTable[streamKey].on('error', function(err) {
                util.log(TAG + " something happned " + err);
            });
            
            util.log(TAG + "successful setup of begin socket to server");
            streamTable[streamKey].on('data', function(data) {
                console.log();
                util.log(TAG + " RECEIVED data from server");
                var sock = socket;
                relay.packAndSendData(data, streamKey[2], obj.CircuitID, socket);
            });

            streamTable[streamKey].on('end', function(data) {
                socket.write(relay.createEndCell(obj.CircuitID, obj.StreamID), function() {
                    //streamTable[streamKey].end();
                    socket.write(relay.createEndCell(obj.CircuitID, obj.StreamID));
                    delete streamTable[streamKey];

                });
            });

            console.log();
            util.log("<---- " + TAG + "Sending relay connected...");
            socket.write(relay.createConnectedCell(obj.CircuitID, obj.StreamID), function() {
                util.log(TAG + "Sent relay connected back with circuitID=" + obj.CircuitID + ", and streamID=" + obj.StreamID);
            });

        });
    } else {
        var nextRoute = routingTable[key];
        // we are in the middle, just route it along
        console.log();
        util.log(TAG + " routing begin through middle routers, forwarding");
        var sock = nextRoute[0];
        var circuitID = nextRoute[1];
        sock.write(relay.createBeginCell(circuitID, obj.StreamID, host, port));
    }
}

function relayData(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var map_a_key = [socket._handle.fd, obj.CircuitID]; 
    var streamTable = globals.streamTable();
    var map_b_value = routingTable[map_a_key];
    var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];
    var data = obj.Relay.Data;
    var agentID = globals.agentID();
    util.log(TAG + "Recvd relay data cell");

    if (map_b_value == null) {
        // We have reached the end of the circuit
        util.log(TAG + "End of the circuit has been reached");
        util.log(TAG + "Stream table key: " + streamKey);
        //printStreamTable(streamTable);
        var endSocket = streamTable[streamKey];
        if (endSocket != null) {
            try {
                console.log();
                util.log(TAG + "Writing data to... :" + endSocket._handle.fd);
                endSocket.write(data, function() {
                    util.log(TAG + "Data written: ");
                });
            } catch(err){}
        }
    } else {
        // Send the data through the circuit
        util.log(TAG + "Sending data through router" + agentID);
        var outCircuitNum = map_b_value[1];
        var dataCell = relay.createDataCell(outCircuitNum, obj.StreamID, data);
        console.log();
        util.log("---->" + TAG + "Sending relay data cell through router" + agentID);
        map_b_value[0].write(dataCell, function() {
            util.log(TAG + "Relay data cell sent successfully");
        });
    }
}

function relayEnd(obj, socket) {
    //TODO implement this
    var routingTable = globals.routingTable();
    var streamTable = globals.streamTable();
    var routingKey = [socket._handle.fd, obj.CircuitID];
    var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];

    var routeVal = routingTable[routingKey];
    if (routeVal == null) {
        if (streamTable[streamKey] != null) {
            streamTable[streamKey].end();
            delete streamTable[streamKey];
        }
    } else {
        util.log(TAG + "routing table has entry for " + routingKey);
        routeVal[0].write(relay.createEndCell(routeVal[1], obj.StreamID));
    }
}

function relayConnected(obj, socket) {
    var routingTable = globals.routingTable();
    var key = [socket._handle.fd, obj.CircuitID];
    if (routingTable[key] == null) {
        util.log(TAG + " connected arrived at source");
        socket.emit('connected');
    } else {
        // we are in the middle, just route it along
        console.log();
        util.log("<----" + TAG + " routing connected through middle routers, forwarding...");
        var sock = routingTable[key][0];
        var circuitID = routingTable[key][1];
        sock.write(relay.createConnectedCell(circuitID, obj.StreamID));
    }

}

function relayExtend(obj, socket) {
    // From main
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();
    // From body
    var body = obj.Relay.Body;
    var bodyLength = obj.BodyLength;
    // Other information from cell
    var extendAgentID = parseInt(obj.Relay.AgentID);
    var parsedBody = relay.parseRelayExtendBody(body);
    var extendIP = parsedBody.ip;
    var extendPort = parseInt(parsedBody.portNum);
    var extendSocket = getSocketFromTable(socketTable, extendAgentID, socket);
    // Routing table mapping info
    var map_a_value = [socket, obj.CircuitID];
    var map_a_key = [socket._handle.fd, obj.CircuitID];
    
    util.log(TAG + "Recvd relay extend cell from circuitID: " + obj.CircuitID);

    if (routingTable[map_a_key] == null) {
        // Reached end of circuit
        
        // Need new circuit Number to extend circuit
        var extendCircuitNum;
        util.log(TAG + "At relay extend, reached end of circuit");
        if (extendSocket == null) {
            // CASE 1: No socket connection, send open & then create
            
            util.log(TAG + "At relay extend, no socket connection");
            util.log(TAG + "Creating socket...");

            // Get odd circuit number because we are opening a socket
            extendCircuitNum = getRandomCircuitNumberOdd;
            extendSocket = net.connect(extendPort, extendIP, function() {
                extendSocket.on('error', function(err) {
                    util.log(TAG + 'something went wrong ' + err);
                });

                util.log(TAG + "Extend socket created successfully, adding to socket table");
                // Add socket to socket table
                socketTable[[extendAgentID, 1]] = extendSocket;

                console.log();
                util.log("---->" + TAG + "At relay extend, Sending open cell")
                extendSocket.write(command.createOpenCell(agentID, extendAgentID), function() {
                    util.log(TAG + "At relay extend, sent open");

                    // Set an open timer
                    var openTimer = setTimeout(function() {
                        socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                            util.log(TAG + "open failed in a middle router, sending extend failed back");
                        });
                    }, TIMEOUT_TIME);

                    var openedListener = function() {
                        util.log(TAG + "At relay extend, opened was received");
                        extendSocket.Opened = true;

                        // clear timeout
                        clearTimeout(openTimer);

                        // Write the create cell
                        util.log("---->" + TAG + "At relay extend, sending create cell...");
                        extendSocket.write(command.createCreateCell(extendCircuitNum), function() {
                            util.log(TAG + "At relay extend, sent create");
                    
                            // Set a create timer
                            var createTimer = setTimeout(function() {
                                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                                    util.log(TAG + "Create failed in a middle router, sending extend failed back");
                                });
                            }, TIMEOUT_TIME);

                            // Once opened & sent create circuit with the final router, we need to return the relay extended
                            var createdListener = function() {

                                // Clear create timer
                                clearTimeout(createTimer);

                                util.log(TAG + "At relay extend, created was received");
                                extendSocket.Created = true;
                    
                                // Update routing table
                                util.log(TAG + "Updating routing table both ways");

                                // Create key/value mapping for both way mapping
                                var map_b_value = [extendSocket, extendCircuitNum];
                                var map_b_key = [extendSocket._handle.fd, extendCircuitNum];
                                routingTable[map_b_key] = map_a_value;
                                routingTable[map_a_key] = map_b_value;

                                printRoutingTable(routingTable);

                                util.log("extend circuitNum: " + extendCircuitNum);
                                util.log("incoming circuitNum: " + map_a_value[1]);
                                
                                // Send relay extended back the opposite way on the circuit
                                console.log();
                                util.log("<----" + TAG + "At relay extend, sending extended cell back...");
                                var extendedCell = relay.createExtendedCell(obj.CircuitID);
                                socket.write(extendedCell, function() {
                                    util.log(TAG + "Relay extended sent back along circuit");
                                });

                                extendSocket.removeListener('created', createdListener);
                            };

                            extendSocket.on('createfailed', function() {
                                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                                    util.log(TAG + "create failed in a middle router, sending extend failed back");
                                });
                            });

                            extendSocket.on('created', createdListener);
                        });

                        extendSocket.removeListener('opened', openedListener);
                    };

                    extendSocket.on('opened', openedListener);
                });
            });
        } else {
            // CASE 2: We have a socket connection, send create
            
            util.log(TAG + "At relay extend, socket connection exists");
            console.log();
            util.log("---->" + TAG + "Sending create cell to extend circuit");
            
            // Find if we need an even or odd circuit number based on the socket connection
            extendCircuitNum = getOddOrEvenCircuit(socketTable, extendAgentID, socket);
            console.log();
            console.log("Chose CircuitID: " + extendCircuitNum);
            console.log();

            var createCell = command.createCreateCell(extendCircuitNum);
            extendSocket.write(createCell, function() {
                util.log(TAG + "At relay extend, sent create");

                // Set a create timer
                var createTimer = setTimeout(function() {
                    socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                        util.log(TAG + "Create failed in a middle router, sending extend failed back");
                    });
                }, TIMEOUT_TIME);

                util.log("extend circuitNum: " + extendCircuitNum);
                util.log("incoming circuitNum: " + map_a_value[1]);

                // Once opened & sent create circuit with the final router, we need to return the relay extended
                var createdListener = function() {
                    util.log(TAG + "At relay extend, created was received");
                    extendSocket.Created = true;
        
                    clearTimeout(createTimer);

                    // Update routing table
                    util.log(TAG + "Updating routing table both ways");

                    // Create key/value mapping for both way mapping
                    var map_b_value = [extendSocket, extendCircuitNum];
                    var map_b_key = [extendSocket._handle.fd, extendCircuitNum];
                    routingTable[map_b_key] = map_a_value;
                    routingTable[map_a_key] = map_b_value;

                    util.log("extend circuitNum: " + extendCircuitNum);
                    util.log("incoming circuitNum: " + map_a_value[1]);
                    
                    printRoutingTable(routingTable);

                    // Send relay extended back the opposite way on the circuit
                    console.log();
                    util.log("<----" + TAG + "At relay extend, sending extended cell back...");
                    var extendedCell = relay.createExtendedCell(obj.CircuitID);
                    socket.write(extendedCell, function() {
                        util.log(TAG + "Relay extended sent back along circuit");
                    });

                    extendSocket.removeListener('created', createdListener);
                };

                extendSocket.on('createfailed', function() {
                    socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                        util.log(TAG + "create failed in a middle router, sending extend failed back");
                    });
                });

                extendSocket.on('created', createdListener);
            });
        }
     }  else {
        // MIDDLE ROUTER CASE: Still in circuit, forward the relay extend
        var map_b_value = routingTable[map_a_key];
        var extendCell = relay.createExtendCell(map_b_value[1], extendIP, extendPort, extendAgentID);
        console.log();
        util.log("---->" + TAG + "Middle router, forwarding relay extend cell...");
        map_b_value[0].write(extendCell, function() {
            util.log(TAG + "At relay extend, forwarded relay Extend cell");
            map_b_value[0].on('extendfailed', function() {
                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                    util.log(TAG + "extendfailed recv'd by middle router, sending relay extendfailed back");
                });
            });

        });
    }
}

function relayExtended(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();
    var map_a_key = [socket._handle.fd, obj.CircuitID]; 

    var map_b_value = routingTable[map_a_key];
    util.log(TAG + "Recvd relay extended cell");
    
    printRoutingTable(routingTable);

    if (map_b_value === null) {
        // CASE 1: Reached beginning of circuit again :)
        util.log(TAG + "relay extended has reached beginning of circuit");
        socket.emit('extended');
    } else {
        // CASE 2: Middle of circuit, keep sending extended back
        util.log("incoming circuitID: " + map_a_key[1]);
        util.log("outgoing circuitID: " + map_b_value[1]);
        var outCircuitNum = map_b_value[1];
        var extendedCell = relay.createExtendedCell(outCircuitNum);
        util.log("<----" + TAG + "Sending relay extended cell back...");
        map_b_value[0].write(extendedCell, function() {
            util.log(TAG + "RelayExtended sent successfully");
        });
    }
}

function relayBeginFailed() {
    //TODO implement this
}

function relayExtendFailed() {
    //TODO implement this
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();

    var entry = routingTable[[socket, obj.CircuitID]];

    entry[0].write(relay.createExtendFailedCell(entry[1]), function() {
        util.log(TAG + "RelayExtended sent successfully");
    });
}

function getSocketFromTable(socketTable, agentID, currSocket) {
    // Returns the socket identified in the socketTable with the given agentID
    // If routing to self, we don't want to use the same socket.  This checks for that

    var outSocket = socketTable[[agentID, 1]];
    var inSocket = socketTable[[agentID, 0]];
    
    if(outSocket !== null && outSocket !== currSocket) {
        // Contains socket that was created outgoing
        return outSocket;
    } else if (inSocket !== null && inSocket !== currSocket) {
        // Contains socket that was created incoming
        return inSocket;
    } else {
        // No current socket with this router
        console.log("No socket");
        return null;
    }
}

function printRoutingTable(routingTable) {
    console.log();
    console.log("printing table...");
    //console.log(routingTable);
    for (var key in routingTable) {
        var map_b_key;
        var map_b_value = routingTable[key];
        if (map_b_value !== null) {
            var map_b_socket_fd = map_b_value[0]._handle.fd;
            map_b_key = [map_b_socket_fd, map_b_value[1]];
        } else {
            map_b_key = null;
        }
        // Prints them both as they are as keys for easier debugging
        console.log(key + " : " + map_b_key);
    }
    console.log();
}

function printStreamTable(streamTable) {
    console.log();
    console.log("printing stream table...");
    for (var key in streamTable) {

        var value = streamTable[key];
        var fd;
        if (value == null) {
            fd = null;
        } else {
            fd = value._handle.fd;
        }
        console.log(key + " : " + fd);
    }
    console.log();
}

function getRandomCircuitNumberEven() {
    var val = Math.floor((Math.random() * 65535));
    if (val % 2 !== 0) {
        val += 1;
    }
    return val;
}
function getRandomCircuitNumberOdd() {
    var val = Math.floor((Math.random() * 65535));
    if (val % 2 === 0) {
        val += 1;
    }
    return val;
}

function getOddOrEvenCircuit(socketTable, extendAgentID, currSocket) {
    var outSocket = socketTable[[agentID, 1]];
    var inSocket = socketTable[[agentID, 0]];

    if(outSocket !== null && outSocket._handle.fd !== currSocket._handle.fd) {
        // Contains socket that was created outgoing --> Create odd
        return getRandomCircuitNumberOdd();
    } else if (inSocket !== null && inSocket._handle.fd !== currSocket._handle.fd) {
        // Contains socket that was created incoming
        return getRandomCircuitNumberEven();
    } else {
        // No current socket with this router
        console.log("ERROR GRABBING CORRECT CircuitID");
        return getRandomCircuitNumberEven();
    }
}

function writeRelayExtendFailed() {

}

module.exports = {
    commandCreate: commandCreate,
    commandCreated: commandCreated,
    commandCreateFailed: commandCreateFailed,
    commandDestroy: commandDestroy,
    commandOpen: commandOpen,
    commandOpened: commandOpened,
    commandOpenFailed: commandOpenFailed,
    relayBegin: relayBegin,
    relayData: relayData,
    relayEnd: relayEnd,
    relayConnected: relayConnected,
    relayExtended: relayExtended,
    relayBeginFailed: relayBeginFailed,
    relayExtendFailed: relayExtendFailed,
    relayExtend: relayExtend,
};