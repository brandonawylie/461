var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var command = require('./command_cell');
var relay = require('./relay_cell');
var globals = require('./main');
var spawn = require('child_process').spawn;
var TAG = "routes.js: ";
var PORT = 1337;

function commandCreate(obj, socket) {
    util.log(TAG + "Create Cell recv'd for circuitID: " + obj.CircuitID);
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var fakeRoutingTable = globals.fakeRoutingTable();
    var map_a = {
        "Socket": socket,
        "circuitNum": obj.CircuitID
    };
    var fake_map_a = {
        "Socket": "in",
        "circuitNum": obj.CircuitID
    }
    if (routingTable.map_a == null) {
        //util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        util.log(TAG + "Updating routing table to route to null w/ CircuitID: " + map_a.circuitNum);
        routingTable[map_a] = null;
        routingTable[null] = map_a;
        fakeRoutingTable[fake_map_a] = null;
        fakeRoutingTable[null] = fake_map_a;
        printRoutingTable(fakeRoutingTable);
    }

    console.log();
    util.log("<----" + TAG + "Sending created cell");
    socket.write(command.createCreatedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + " sending created cell successful");
    });
}

function commandCreated(obj, socket) {
    util.log(TAG + "created Cell recv'd");
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    
    // var map_a = {
    //     // TODO: Update routing table for incoming
    // };
    // var map_b = {
    //     "Socket": socket,
    //     "circuitNum": obj.CircuitID
    // };

    // if (!routingTable.hasOwnProperty(map_a) || !routingTable.hasOwnProperty(map_b)) {
    //     //util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
    //     util.log("Updating two way mapping of routing table");
    //     routingTable[map_a] = map_b;
    //     routingTable[map_b] = map_a;
    // }

    util.log(TAG + "Setting created event")
    socket.emit('created');

}

function commandCreateFailed(obj) {
    //TODO implement this
}

function commandDestroy(obj) {
    //TODO implement this
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
    
function commandOpenFailed(obj) {
    //TODO implement this
}

function relayBegin() {
    //TODO implement this
}

function relayData() {
    //TODO implement this
}

function relayEnd() {
    //TODO implement this
}

function relayConnected() {
    //TODO implement this
}

function relayExtend(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var agentID = globals.agentID();
    var fakeRoutingTable = globals.fakeRoutingTable();
    var map_a = {
        "Socket": socket,
        "circuitNum": obj.CircuitID
    };
    var fake_map_a = {
        "Socket": "in",
        "circuitNum": obj.CircuitID
    }
    var body = obj.Relay.Body;
    var bodyLength = obj.BodyLength;
    var extendAgentID = parseInt(obj.Relay.AgentID);
    var parsedBody = relay.parseRelayExtendBody(body);
    var extendIP = parsedBody.ip;
    var extendPort = parseInt(parsedBody.portNum);
    var extendSocket = getSocketFromTable(socketTable, extendAgentID, socket);
    util.log(TAG + "Recvd relay extend cell");

    if (routingTable[map_a] == null) {
        // Reached end of circuit
        
        // TODO: Create circuit ID here based on 0 or 1
        // Need new circuit Number to extend circuit
        var extendCircuitNum = Math.floor(Math.random() * 65535);
        util.log(TAG + "At relay extend, reached end of circuit");
        if (extendSocket === null) {
            // CASE 1: No socket connection, send open & then create
            
            util.log(TAG + "At relay extend, no socket connection");
            util.log(TAG + "Creating socket...");
            extendSocket = net.connect(extendPort, extendIP, function() {
                util.log(TAG + "Extend socket created successfully, adding to socket table");
                // Add socket to socket table
                socketTable[[extendAgentID, 1]] = extendSocket;

                console.log();
                util.log("---->" + TAG + "At relay extend, Sending open cell")
                extendSocket.write(command.createOpenCell(agentID, extendAgentID), function() {
                    util.log(TAG + "At relay extend, sent open");

                    // Opened received for this new socket connection
                    extendSocket.on('opened', function() {
                        util.log(TAG + "At relay extend, opened was received");
                        extendSocket.Opened = true;

                        // Write the create cell
                        util.log("---->" + TAG + "At relay extend, sending create cell...");
                        extendSocket.write(command.createCreateCell(extendCircuitNum), function() {
                            util.log(TAG + "At relay extend, sent create");

                            // Once opened & sent create circuit with the final router, we need to return the relay extended
                            extendSocket.on('created', function() {
                                util.log(TAG + "At relay extend, created was received");
                                extendSocket.Created = true;
                                var extendedCell = relay.createExtendedCell(obj.CircuitID);
                    
                                // Update routing table
                                util.log(TAG + "Updating routing table both ways");

                                var map_b = {
                                    "Socket": extendSocket,
                                    "circuitNum": extendCircuitNum
                                }
                                
                                routingTable[map_b] = map_a;
                                routingTable[map_a] = outgoingEdge;
                                util.log("incoming edge: " + map_b.circuitNum);
                                util.log("outoing edge: " + map_a.circuitNum);
                                // Send relay extended back the opposite way on the circuit
                                util.log("<----" + TAG + "At relay extend, sending extended cell back...");
                                socket.write(extendedCell, function() {
                                    util.log(TAG + "Relay extended send back along circuit");
                                });
                            });
                        });
                    });
                });
            });
        } else {
            // CASE 2: We have a socket connection, send create
            
            util.log(TAG + "At relay extend, socket connection exists");
            console.log();
            util.log("---->" + TAG + "Sending create cell to extend circuit");
            var createCell = command.createCreateCell(extendCircuitNum);
            extendSocket.write(createCell, function() {
                util.log(TAG + "At relay extend, sent create");

                // Once opened & sent create circuit with the final router, we need to return the relay extended
                extendSocket.on('created', function() {
                    util.log(TAG + "At relay extend, created was recv'd");
                    extendSocket.Created = true;
                    
                    // Update routing table
                    util.log(TAG + "Updating routing table both ways");
                    util.log("incoming edge: " + extendCircuitNum);
                    util.log("outoing edge: " + map_a.circuitNum);
                    var map_b = {
                        "Socket": extendSocket,
                        "circuitNum": extendCircuitNum
                    }
                    
                    routingTable[map_b] = map_a;
                    routingTable[map_a] = outgoingEdge;
                    var fake_map_b = {
                        "Socket": "out",
                        "circuitNum": extendCircuitNum
                    }
                    fakeRoutingTable[fake_map_b] = fake_map_a;
                    fakeRoutingTable[fake_map_a] = fake_map_b;
                    console.log("fake map_a:");
                    console.log(fake_map_a);
                    console.log("fake_map_b");
                    console.log(fake_map_b);
                    printRoutingTable(fakeRoutingTable);
                    // Send relay extended back the opposite way on the circuit
                    var extendedCell = relay.createExtendedCell(obj.CircuitID);
                    console.log();
                    util.log("<----" + TAG + "At relay extend, sending extended cell back...");
                    socket.write(extendedCell, function() {
                        util.log(TAG + "Relay extended send back along circuit");
                    });
                });
            });
        }
     }  else {
        // MIDDLE ROUTER CASE: Still in circuit, forward the relay extend
        map_b = routingTable[map_a];
        extendCell = createExtendCell(map_b.circuitNum, extendIP, extendPort, extendAgentID);
        map_b.Socket.write(extendCell, function() {
            util.log(TAG + "At relay extend, forwarded relatyExtend cell");
        });
    }
}

function relayExtended(obj, socket) {
    var routingTable = globals.routingTable();
    var socketTable = globals.socketTable();
    var fakeRoutingTable = globals.fakeRoutingTable();
    var agentID = globals.agentID();
    var map_a = {
        "Socket": socket,
        "circuitNum": obj.CircuitID
    };
    var map_b = routingTable[map_a];
    util.log(TAG + "Recvd relay extended cell");
    printRoutingTable(fakeRoutingTable);
    
    if (map_b == null) {
        // CASE 1: Reached beginning of circuit again :)
        
        socket.emit('extended');
    } else {
        // CASE 2: Middle of circuit, keep sending extended back
        util.log("incoming circuitID: " + map_a.circuitNum);
        util.log("outgoing circuitID: " + map_b.circuitNum);
        process.exit();
        var extendedCell = relay.createExtendedCell(map_b.circuitNum);
        util.log("<----" + TAG + "Sending relay extended cell back...");
        map_b.Socket.write(extendedCell, function() {
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
    console.log("printing table...");
    //console.log(routingTable);
    for (var key in routingTable) {
        console.log(key)
        console.log(":")
        console.log(routingTable[key]);
        console.log()
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
    relayExtend: relayExtend
};