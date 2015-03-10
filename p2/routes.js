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

// TODO: Discuss router table format--> Spec says to do socket/circuit no. instead of id/circuit no.
function commandCreate(obj, socket) {
    util.log(TAG + "Create Cell recv'd");
    routingTable = globals.routingTable();
    socketTable = globals.socketTable();
    var map_a = {
        "Socket": socket,
        "circuitNum": obj.CircuitID
    };
    //var map_b = ;

    if (!routingTable.hasOwnProperty(map_a)) {
        //util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        routingTable[map_a] = null;
        
    }

    socket.write(command.createCreatedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + " sending created cell successful");
    });
}

function commandCreated(obj, socket) {
    util.log(TAG + "created Cell recv'd");
    routingTable = globals.routingTable();
    socketTable = globals.socketTable();
    var map_a = {
        // TODO: Update routing table for incoming
    };
    var map_b = {
        "AgentID": socket,
        "circuitNum": obj.CircuitID
    };

    if (!routingTable.hasOwnProperty(map_a) || !routingTable.hasOwnProperty(map_b)) {
        //util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        routingTable[map_a] = map_b;
        routingTable[map_b] = map_a;
        
    }

    //console.log(obj.AgentIDEnd);
    //console.log(socketTable);

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
    console.log("now socket table" + socketTable);
    if (!socketTable.hasOwnProperty([obj.AgentIDBegin, 0])) {
        util.log(TAG + "Open Cell recv'd, adding socket to table");
        socketTable[[obj.AgentIDBegin, 0]] = socket;
    } else {
        util.log(TAG + "Open Cell recv'd, with existing socket already open: ERROR");
    }

    util.log(TAG + " open was a success, sending opened back with agent id: " + obj.AgentIDBegin);

    //console.log(socketTable);
    socketTable[[obj.AgentIDBegin, 0]].write(command.createOpenedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + " sending opened successful");
    });
}

function commandOpened(obj) {
    socketTable = globals.socketTable();
    util.log(TAG + " Opened received, sending a create cell");
    var circuitNum = Math.floor((Math.random() * 9999) + 1);

    socketTable[[obj.AgentIDEnd, 1]].emit('opened');
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
    var incomingEdge = {
        "Socket": socket,
        "circuitNum": obj.CircuitID
    };
    util.log(TAG + "Recvd relay extend cell");
    var body = obj.Relay.Body;
    var parsedBody = relay.parseRelayExtendBody(body);

    if (!routingTable.hasOwnProperty(map_a)) {
        // End of circuit
        if (!socketTable.hasOwnProperty[parsedBody.agentID, 1]) {
            // CASE 1: No socket connection, send open & then create
            socket.write(command.createOpenCell(agentID, parsedBody.agentID), function() {
                util.log(TAG + "RelayExtend reached end of circuit & sent open");
            }
        } else {
            // CASE 2: We have a socket connection, send create
            socket.write(command.createCreateCell(obj.circuitNum), function() {
                util.log(TAG + "RelayExtend reached end of circuit & sent create");
            }
        }
    } else {
        // Still in circuit, forward the relay extend
        map_b = routingTable[map_a];
        extendCell = createExtendCell(map_b.circuitNum, parsedBody.ip, parsedBody.portNum, parsedBody.agentID));
        map_b["Socket"].write(extendCell, function() {
            util.log(TAG + "RelayExtend forwarded");
        }
    }
}

function relayExtended() {
    
}

function relayBeginFailed() {
    //TODO implement this
}

function relayExtendFailed() {
    //TODO implement this
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