var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;
var routes = require('./routes');
var relay = require('./relay_cell');

var TAG = "command_relay.js: ";
var PORT = 1337;

var OPEN = 5;
var OPENED = 6;
var OPEN_FAILED = 7;
var CREATE = 1;
var CREATED = 2;
var CREATE_FAILED = 8;
var DESTROY = 4;
var RELAY = 3;
var SIZE = 512;

var fakeBuf = createOpenCell(12, 551414, 3245235);
console.log(fakeBuf);

function createOpenCell(circ_id, opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(OPEN, 2);
    buf.writeUInt32BE(opener_id, 3);
    buf.writeUInt32BE(opened_id, 7);
    // Fill buffer with 0's
    return fillZeros(buf, 11);
}

function createOpenedCell(circ_id, opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(OPENED, 2);
    buf.writeUInt32BE(opener_id, 3);
    buf.writeUInt32BE(opened_id, 7);
    var position = 11;
    // Fill buffer with 0's
    return fillZeros(buf, 11);

}

function createOpenFailedCell(circ_id, opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(OPEN_FAILED, 2);
    buf.writeUInt32BE(opener_id, 3);
    buf.writeUInt32BE(opened_id, 7);
    var position = 11;
    // Fill buffer with 0's
    return fillZeros(buf, 11);
}

function createCreateCell(circ_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(CREATE, 2);
    // Fill buffer with 0's
    return fillZeros(buf, 3);
}

function createCreatedCell(circ_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(CREATED, 2);
    // Fill buffer with 0's
    return fillZeros(buf, 3);
}

function createCreateFailedCell(circ_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(CREATE_FAILED, 2);
    // Fill buffer with 0's
    return fillZeros(buf, 3);
}

function createDestroyCell(circ_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(DESTROY, 2);
    // Fill buffer with 0's
    return fillZeros(buf, 3);
}

function fillZeros(buffer, start) {
    var buf = new Buffer(SIZE);
    for (i = start; i < SIZE; i++) {
        buf.writeUInt8(0, i);
    }
    return buf;
}

function unpack(pkt, socket) {
    var pobj = {
        "CircuitID":    null,
        "CommandType":  null,
        "AgentIDBegin": null,
        "AgentIDEnd":   null,
        "StreamID":     null,
        "Digest":       null,
        "BodyLength":   null,
        "Relay": {
            "Command":  null,
            "Body":     null
        }    
    };

    pobj.CircuitID =   pkt.readUInt16BE(0);
    pobj.CommandType = pkt.readUInt8(2);
    
    switch(pobj.CommandType) {
        case 1:
            routes.commandCreate(pobj);
            break;
        case 2:
            routes.commandCreated(pobj);
            break;
        case 3:
            relay.unpackRelay(pobj);
            break;
        case 4:
            routes.commandDestroy(pobj);
            break;
        case 5:
            routes.commandOpen(pobj, socket);
            break;
        case 6:
            routes.commandOpened(pobj);
            break;
        case 7:
            routes.commandOpenFailed(pobj);
            break;
        case 8:
            routes.commandCreateFailed(pobj);
            break;
    }

}

module.exports = {
    createOpenCell: createOpenCell,
    createOpenedCell: createOpenedCell,
    createOpenFailedCell: createOpenFailedCell,
    createCreateCell: createCreateCell,
    createCreatedCell: createCreatedCell,
    createCreateFailedCell: createCreateFailedCell,
    createDestroyCell: createDestroyCell
};