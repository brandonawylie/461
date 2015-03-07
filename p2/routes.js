var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "routes.js: ";
var PORT = 1337;

function commandCreate(obj) {

}

function commandCreated(obj) {

}

function commandCreateFailed(obj) {

}

function commandDestroy(obj) {

}

function commandOpen(obj, socket) {
    var cID = torutil.getCircuitNumberEven();
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
    if (!socketTable.hasOwnProperty(obj.AgentIDBegin)) {
        socketTable[obj.AgentIDBegin] = socket;
    }

    util.log(TAG + " open was a success, sending opened back");
    socketTable[agentID].write(command.createOpenedCell(obj.AgentIDBegin, obj.AgentIDEnd), function() {
        util.log(TAG + " sending opened successful");
    });
}

function commandOpened(obj) {
    callbackTable[[obj.CircuitID, obj.AgentIDBegin]]();
}

function commandOpenFailed(obj) {

}

function relayBegin() {

}

function relayData() {

}

function relayEnd() {

}

function relayConnected() {

}

function relayExtend() {

}

function relayExtended() {

}

function relayBeginFailed() {

}

function relayExtendFailed() {

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