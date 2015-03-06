var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "relay_cell.js: ";
var PORT = 1337;
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
// circ id | 0x03  |  stream id |  0x0000 | digest | body length | relay cmd  |  body
// 2       |   1   |        2   |    2    |    4   |        2    |      1     | <body length>

function createBeginCell() {

}