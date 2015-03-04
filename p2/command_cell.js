var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "command_relay.js: ";
var PORT = 1337;

// 512 bytes long (padded w/ 0's, or sent in sequence)
// 
        var buf = new Buffer(message);
        var magic      = buf.readUInt16BE(0);
        var version    = buf.readUInt8(2);
        var command    = buf.readUInt8(3);
        var sequence   = buf.readUInt32BE(4);
        var session_id = buf.readUInt32BE(8);

var OPEN = 5;
var OPENED = 6;
var OPEN_FAILED = 7;
var CREATE = 1;
var CREATED = 2;
var CREATE_FAILED = 8;
var DESTROY = 4;
var RELAY = 3;
var SIZE = 512;

function createOpenCell(circ_id, opener_id, opened_id) {
    var buf = new Buffer(SIZE);
    buf.writeUInt16BE(circ_id, 0);
    buf.writeUInt8BE(OPEN, 2);
    buf.writeUInt32BE(opener_id, 3);
    buf.writeUInt32BE(opened_id, 5);
    // Fill buffer with 0's
}

function createOpenedCell(circ_id, opener_id, opened_id) {

}











