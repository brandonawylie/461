var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "routes.js: ";
var PORT = 1337;

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
    routes.commandOpen(pobj);
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

function commandCreate(obj) {

}

function commandCreated(obj) {

}

function commandCreateFailed(obj) {

}

function commandDestroy(obj) {

}

function commandOpen(obj) {

}

function commandOpened(obj) {

}

function commandOpenFailed(obj) {

}

function commandCreateFailed(obj) {

}

module.exports = {
    commandCreate: commandCreate,
    commandCreated: commandCreated,
    commandCreateFailed: commandCreateFailed,
    commandDestroy: commandDestroy,
    commandOpen: commandOpen,
    commandOpened: commandOpened,
    commandOpenFailed: commandOpenFailed
}