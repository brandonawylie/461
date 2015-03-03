var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "relay_cell.js: ";
var PORT = 1337;