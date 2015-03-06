var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "relay_cell.js: ";
var PORT = 1337;

var SIZE = 512;
var RELAY = 3;
var BEGIN = 1;
var DATA = 2;
var END = 3;
var CONNECTED = 4;
var EXTEND = 6;
var EXTENDED = 7;
var BEGIN_FAILED = 0x0b;
var EXTEND_FAILED = 0x0c;
var RELAY = 3;

// For creating Relay cells, with the format:
// circ id | 0x03  |  stream id |  0x0000 | digest (crypto) | body length | relay cmd  |  body
// 2       |   1   |        2   |    2    |    4            |        2    |      1     | <body length>

function createBeginCell(circ_id, stream_id, ip, port) {
    // Used for creating a stream on the circuit in header
    var buf = createBasicRelay(circ_id, stream_id);
    // length of ip + port + '\0' = 6 bytes
    var body_length = 7;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(BEGIN, 13);
    buf.writeUInt32BE(ip, 14);
    buf.writeUInt16BE(port, 18);
    buf.write('\0', 20);
    return fillZeros(buf, 21);
}

// Pre-condition: Data size is less than 499 bytes
function createDataCell(circ_id, stream_id, data) {
    // Used for sending data through a stream on the circuit
    var buf = createBasicRelay(circ_id, stream_id);
    var data_string = data.toString();
    var body_length = data_string.length;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(DATA, 13);
    buf.write(data_string, 14);
    buf_location = 14 + body_length;
    return fillZeros(buf, buf_location);
}

function createEndCell(circ_id, stream_id) {
    // Request to close a stream
    var buf = createBasicRelay(circ_id, stream_id);
    var body_length = 0;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(END, 13);
    return fillZeros(buf, 14);
}

function createConnectedCell(circ_id, stream_id) {
    // A success response to a created stream
    var buf = createBasicRelay(circ_id, stream_id);
    var body_length = 0;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(CONNECTED, 13);
    return fillZeros(buf, 14);
}

function createExtendCell(circ_id, stream_id, ip, port, agent_id) {
    // Used for extending a circuit
    var buf = createBasicRelay(circ_id, stream_id);
    // ip + port + '\0' + agentid = 11
    var body_length = 11;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(EXTEND, 13);
    buf.writeUInt32BE(ip, 14);
    buf.writeUInt16BE(port, 18);
    buf.write('\0', 20);
    buf.writeUInt16BE(agent_id, 21);
    return fillZeros(buf, 25);
}

function createExtendedCell(circ_id, stream_id) {
    // Used for communicating that the circuit was extended
    var buf = createBasicRelay(circ_id, stream_id);
    var body_length = 0;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(EXTENDED, 13);
    return fillZeros(buf, 14);
}

function createBeginFailed(circ_id, stream_id) {
    // Failure response to creating a stream
    var buf = createBasicRelay(circ_id, stream_id);
    var body_length = 0;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(BEGIN_FAILED, 13);
    return fillZeros(buf, 14);
}

function createExtendFailed(circ_id, stream_id) {
    // Failure response to extending a circuit
    var buf = createBasicRelay(circ_id, stream_id);
    var body_length = 0;
    buf.writeUInt16BE(body_length, 11);
    buf.writeUInt8(EXTEND_FAILED, 13);
    return fillZeros(buf, 14);
}

function createBasicRelay(circ_id, stream_id) {
    // A success response to a created stream
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8(RELAY, 2);
    buf.writeUInt16BE(stream_id, 3);
    buf.writeUInt32BE(0x0000, 5);
    // skip writing to digest (4 bytes)
    return buf;
}

function fillZeros(buffer, start) {
    for (i = start; i < SIZE; i++) {
        buffer.writeUInt8(0, i);
    }
    return buffer;
}

module.exports = {
    createBeginCell: createBeginCell,
    createDataCell: createDataCell,
    createEndCell: createEndCell,
    createConnectedCell: createConnectedCell,
    createExtendCell: createExtendCell,
    createExtendedCell: createExtendedCell,
    createBeginFailed: createBeginFailed,
    createExtendFailed: createExtendFailed
};