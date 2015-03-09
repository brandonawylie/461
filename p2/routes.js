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
function commandCreate(obj) {
    routingTable = globals.routingTable();
    var map_a = {
        "AgentID": obj.AgentIDBegin,
        "circuitNum": obj.CircuitID
    };
    var map_b = {
        "AgentID": obj.AgentIDEnd,
        "circuitNum": obj.CircuitID
    };

    if (!routingTable.hasOwnProperty(map_a) || !routingTable.hasOwnProperty(map_b)) {
        util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        routingTable[map_a] = map_b;
        routingTable[map_b] = map_a;
        
    }
}

function commandCreated(obj) {
    outingTable = globals.routingTable();
    var map_a = {
        "AgentID": obj.AgentIDBegin,
        "circuitNum": obj.CircuitID
    };
    var map_b = {
        "AgentID": obj.AgentIDEnd,
        "circuitNum": obj.CircuitID
    };

    if (!routingTable.hasOwnProperty(map_a) || !routingTable.hasOwnProperty(map_b)) {
        util.log(TAG + "Incoming Socket has no routing match, archiving under " + circuitNum);
        routingTable[map_a] = map_b;
        routingTable[map_b] = map_a;
        
    }
}

function commandCreateFailed(obj) {
    //TODO implement this
}

function commandDestroy(obj) {
    //TODO implement this
}

function commandOpen(obj, socket) {
    socketTable = globals.socketTable();
    agentID = globals.agentID();
    console.log("now socket table" + socketTable);
    if (!socketTable.hasOwnProperty(obj.AgentIDBegin)) {
        util.log(TAG + "Open Cell recv'd, adding socket to table");
        socketTable[obj.AgentIDBegin] = socket;
    } else {
        util.log(TAG + "Open Cell recv'd with existing socket already open: ERROR");
    }

    util.log(TAG + " open was a success, sending opened back with agent id: " + obj.AgentIDBegin);

    //console.log(socketTable);
    socketTable[obj.AgentIDEnd].write(command.createOpenedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + " sending opened successful");
    });
}

function commandOpened(obj) {
    socketTable = globals.socketTable();
    util.log(TAG + " Opened received, sending a create cell");
    var circuitNum = Math.floor((Math.random() * 9999) + 1);

    socketTable[obj.AgentIDBegin].write(command.createCreateCell(circuitNum), function() {
        util.log(TAG + " Create Cell sent successfully ");
    });
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

function relayExtend() {
    //TODO implement this
}

function relayExtended() {
    //TODO implement this
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
    relayExtendFailed: relayExtendFailed
};