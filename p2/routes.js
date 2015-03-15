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
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var outgoingEdge = [socket._handle.fd, obj.CircuitID];

    if (routingTable.outgoingEdge == null) {
        routingTable[outgoingEdge] = null;
    }

    util.log("--| Create recieved on circuit: " + obj.CircuitID);

    socket.write(command.createCreatedCell(obj.CircuitID), function() {
            util.log("<--  Created sent on circuit: " + obj.CircuitID);
    });
}

function commandCreated(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();

    util.log("--| Created recieved on circuit: " + obj.CircuitID);
    socket.emit('created');

}

function commandCreateFailed(obj) {
    til.log("--x CreatedFailed recieved on circuit: " + obj.CircuitID);
    socket.emit('createfailed');
}

function commandDestroy(obj, socket) {
    //TODO implement this
    var key = [socket._handle.fd, obj.CircuitID];
    var startCircuitID = globals.startCircuitID();
    if (startCircuitID === obj.CircuitID) {
        globals.createCircuit();
    } else {
        lookupAndDestroyByCircuitID(obj.CircuitID);
    }
}

function commandOpen(obj, socket) {
    socketTable = globals.socketTable();
    agentID = globals.agentID();
    if (!socketTable.hasOwnProperty([obj.AgentIDBegin, 0])) {
        socketTable[[obj.AgentIDBegin, 0]] = socket;
    } else {
    }


    socketTable[[obj.AgentIDBegin, 0]].on('error', function(err) {
    });
    util.log("--| Open recieved from agent: " + obj.AgentIDBegin);
    socketTable[[obj.AgentIDBegin, 0]].write(command.createOpenedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log("<-- Opened sent to agent: " + obj.AgentIDBegin);
    });
}

function commandOpened(obj, socket) {
    socketTable = globals.socketTable();
    //socketTable[[obj.AgentIDBegin, 0]] = socket;
    util.log("--| Opened recieved on circuit: " + obj.CircuitID);
    socket.emit('opened');
}
    
function commandOpenFailed(obj, socket) {
    //TODO implement this
    util.log("--x OpenFailed recieved on circuit: " + obj.CircuitID);
    socket.emit('openfailed');
}

function relayBegin(obj, socket, host, port) {
    var routingTable = globals.routingTable();
    var key = [socket._handle.fd, obj.CircuitID];
    if (routingTable[key] == null) {
        // Arrived at server
        var streamTable = globals.streamTable();
        var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];
        streamTable[streamKey] = new net.Socket({allowHalfOpen: true});

        streamTable[streamKey].connect(parseInt(port), host,  function() {
            if (streamTable[streamKey] == null) return;
            streamTable[streamKey].on('error', function(err) {
            });
            streamTable[streamKey].on('data', function(data) {
                var sock = socket;
                relay.packAndSendData(data, streamKey[2], obj.CircuitID, socket);
            });

            streamTable[streamKey].on('end', function(data) {
                socket.write(relay.createEndCell(obj.CircuitID, obj.StreamID), function() {
                    //streamTable[streamKey].end();
                    socket.write(relay.createEndCell(obj.CircuitID, obj.StreamID));
                });
            });

            socket.write(relay.createConnectedCell(obj.CircuitID, obj.StreamID), function() {
            });

        });
    } else {
        var nextRoute = routingTable[key];
        // we are in the middle, just route it along
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

    if (map_b_value == null) {
        // We have reached the end of the circuit
        var endSocket = streamTable[streamKey];
        if (endSocket != null) {
            try {
                endSocket.write(data, function() {
                });
            } catch(err){}
        }
    } else {
        // Send the data through the circuit
        var outCircuitNum = map_b_value[1];
        var dataCell = relay.createDataCell(outCircuitNum, obj.StreamID, data);
        map_b_value[0].write(dataCell, function() {
        });
    }
}

function relayEnd(obj, socket) {
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
        routeVal[0].write(relay.createEndCell(routeVal[1], obj.StreamID));
    }
}

function relayConnected(obj, socket) {
    var routingTable = globals.routingTable();
    var streamTable = globals.streamTable();
    if (socket == null || socket._handle == null) return;
    var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];
    var key = [socket._handle.fd, obj.CircuitID];
    if (routingTable[key] == null) {
        var streamSocket = streamTable[streamKey];
        if (streamSocket != null) {
            streamSocket.emit('connected');
        }
    } else {
        // we are in the middle, just route it along
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
    

    if (routingTable[map_a_key] == null) {
        // Reached end of circuit
        
        // Need new circuit Number to extend circuit
        var extendCircuitNum;
        if (extendSocket == null) {
            // CASE 1: No socket connection, send open & then create
            

            // Get odd circuit number because we are opening a socket
            extendCircuitNum = getRandomCircuitNumberOdd;
            extendSocket = new net.Socket({allowHalfOpen: true});
            
            extendSocket.on('error', function(err) {
                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                });
            });

            extendSocket.connect(extendPort, extendIP, function() {

                // Add socket to socket table
                socketTable[[extendAgentID, 1]] = extendSocket;

                extendSocket.write(command.createOpenCell(agentID, extendAgentID), function() {

                    // Set an open timer
                    var openTimer = setTimeout(function() {
                        socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                        });
                    }, TIMEOUT_TIME);

                    var openedListener = function() {
                        extendSocket.Opened = true;

                        // clear timeout
                        clearTimeout(openTimer);

                        // Write the create cell
                        extendSocket.write(command.createCreateCell(extendCircuitNum), function() {
                    
                            // Set a create timer
                            var createTimer = setTimeout(function() {
                                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                                });
                            }, TIMEOUT_TIME);

                            // Once opened & sent create circuit with the final router, we need to return the relay extended
                            var createdListener = function() {

                                // Clear create timer
                                clearTimeout(createTimer);

                                extendSocket.Created = true;
                    
                                // Update routing table

                                // Create key/value mapping for both way mapping
                                var map_b_value = [extendSocket, extendCircuitNum];
                                var map_b_key = [extendSocket._handle.fd, extendCircuitNum];
                                routingTable[map_b_key] = map_a_value;
                                routingTable[map_a_key] = map_b_value;


                                
                                // Send relay extended back the opposite way on the circuit
                                var extendedCell = relay.createExtendedCell(obj.CircuitID);
                                socket.write(extendedCell, function() {
                                });

                                extendSocket.removeListener('created', createdListener);
                            };

                            extendSocket.on('createfailed', function() {
                                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
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
            
            // Find if we need an even or odd circuit number based on the socket connection
            extendCircuitNum = getOddOrEvenCircuit(socketTable, extendAgentID, socket);

            var createCell = command.createCreateCell(extendCircuitNum);
            extendSocket.write(createCell, function() {

                // Set a create timer
                var createTimer = setTimeout(function() {
                    socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                    });
                }, TIMEOUT_TIME);

                // Once opened & sent create circuit with the final router, we need to return the relay extended
                var createdListener = function() {
                    extendSocket.Created = true;
        
                    clearTimeout(createTimer);

                    // Create key/value mapping for both way mapping
                    var map_b_value = [extendSocket, extendCircuitNum];
                    var map_b_key = [extendSocket._handle.fd, extendCircuitNum];
                    routingTable[map_b_key] = map_a_value;
                    routingTable[map_a_key] = map_b_value;

                    

                    // Send relay extended back the opposite way on the circuit
                    var extendedCell = relay.createExtendedCell(obj.CircuitID);
                    socket.write(extendedCell, function() {
                    });

                    extendSocket.removeListener('created', createdListener);
                };

                extendSocket.on('createfailed', function() {
                    socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
                    });
                });

                extendSocket.on('created', createdListener);
            });
        }
     }  else {
        // MIDDLE ROUTER CASE: Still in circuit, forward the relay extend
        var map_b_value = routingTable[map_a_key];
        var extendCell = relay.createExtendCell(map_b_value[1], extendIP, extendPort, extendAgentID);
        map_b_value[0].write(extendCell, function() {
            map_b_value[0].on('extendfailed', function() {
                socket.write(relay.createExtendFailedCell(obj.CircuitID), function() {
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
    

    if (map_b_value === null) {
        // CASE 1: Reached beginning of circuit again :)
        socket.emit('extended');
    } else {
        // CASE 2: Middle of circuit, keep sending extended back
        var outCircuitNum = map_b_value[1];
        var extendedCell = relay.createExtendedCell(outCircuitNum);
        map_b_value[0].write(extendedCell, function() {
        });
    }
}

function relayBeginFailed(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();
    if (socket == null || socket._handle == null) return;
    var map_a_key = [socket._handle.fd, obj.CircuitID];
    var map_b_value = routingTable[map_a_key];
    
    if (map_b_value === null) {
        // CASE 1: Reached beginning of circuit
        var streamKey = [socket._handle.fd, obj.CircuitID, obj.StreamID];
        var streamSocket = streamTable[streamKey];
        if (streamSocket != null) {
            streamSocket.emit('beginfailed');
        }
    } else {
        // CASE 2: Middle of circuit, keep sending extended back
        var outCircuitNum = map_b_value[1];
        var beginFailedCell = relay.createBeginFailed(outCircuitNum, obj.StreamID);
        map_b_value[0].write(beginFailedCell);
    }
}

function relayExtendFailed(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();
    if (socket == null || socket._handle == null) return;
    var entry = routingTable[[socket._handle.fd, obj.CircuitID]];

    if (entry == null) return;
    entry[0].write(relay.createExtendFailedCell(entry[1]), function() {
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
        return null;
    }
}

function printRoutingTable(routingTable) {
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
    }
}

function printStreamTable(streamTable) {
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

    if(outSocket != null && outSocket._handle.fd != currSocket._handle.fd) {
        // Contains socket that was created outgoing --> Create odd
        return getRandomCircuitNumberOdd();
    } else if (inSocket != null && inSocket._handle.fd != currSocket._handle.fd) {
        // Contains socket that was created incoming
        return getRandomCircuitNumberEven();
    } else {
        // No current socket with this router
        return getRandomCircuitNumberEven();
    }
}

function lookupAndDestroyByCircuitID(id) {
    var routingTable = globals.routingTable();

    var destroyCB = function(key) {
        util.log("--> Sent Destroy on circuit: " + key[1]);
    };


    for (var key in routingTable) {
        if (routingTable.hasOwnProperty(key)) {
            var cid = key[1];
            if(cid === id) {
                var out = routingTable[key];
                var outSock = out[0];
                outSock.write(relay.createDestroyCell(routingTable[key][1]), destroyCB(key));
                var key_a = key;
                var key_b = [outSock._handle.fd, out[1]];

                delete routingTable[key_a];
                if (routingTable[key_b]) {
                    delete routingTable[key_b];
                }
            }
        }
    }
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