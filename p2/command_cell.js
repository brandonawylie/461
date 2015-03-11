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

function createOpenCell(opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(0x0000, 0);
    buf.writeUInt8(OPEN, 2);
    buf.writeUInt32BE(opener_id, 3);
    buf.writeUInt32BE(opened_id, 7);
    // Fill buffer with 0's
    return fillZeros(buf, 11);
}

function createOpenedCell(opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    // TODO write zeros instead
    buf.writeUInt16BE(0x0000, 0);
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
    util.log("circ_id: " + circ_id);
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
    for (var i = start; i < SIZE; i++) {
        buffer.writeUInt8(0x00, i);
    }
    return buffer;
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