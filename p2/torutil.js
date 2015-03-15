var routes = require('./routes');
var util = require('util');
var globals = require('./main');
var TAG = "torutil.js ";

function parseRegistrations(reg) {
    var retVal = [];
    var lines = reg.split("\n");
    //lines.splice(lines.length , 1);
    for (var i = 0; i < lines.length - 1; i++) {
        var router = lines[i].split("\t");
        retVal.push(router);
    }
    return retVal;
}

function isCommandCell(pkt) {
    return false;
}

function isRelayCell(pkt) {
    return false;
}

function getRandomCircuitNumberEven() {
    var val = Math.floor((Math.random() * 65535));
    if (val % 2 !== 0) {
        val += 1;
    }
    return val;
}
function getRandomCircuitNumberOdd() {
    var val = Math.floor((Math.random() * 65535));
    if (val % 2 === 0) {
        val += 1;
    }
    return val;
}

function removeSocketFromTable(sock) {
    socketTable = globals.socketTable();
    for (var key in socketTable) {
        if (socketTable.hasOwnProperty(key)) {
            if (socketTable[key] === sock) {
                socketTable[key].end();
                delete socketTable[key];
            }
        }
    }
}

function parseAgentIds(pkt, obj) {
    obj.AgentIDBegin = pkt.readUInt32BE(3);
    obj.AgentIDEnd = pkt.readUInt32BE(7);
}

function unpackCommand(pkt, socket) {
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
            routes.commandCreate(pobj, socket);
            break;
        case 2:
            routes.commandCreated(pobj, socket);
            break;
        case 3:
            unpackRelay(pkt, pobj, socket);
            break;
        case 4:
            routes.commandDestroy(pobj, socket);
            break;
        case 5:
            parseAgentIds(pkt, pobj);
            routes.commandOpen(pobj, socket);
            break;
        case 6:
            parseAgentIds(pkt, pobj);
            routes.commandOpened(pobj, socket);
            break;
        case 7:
            parseAgentIds(pkt, pobj);
            routes.commandOpenFailed(pobj, socket);
            break;
        case 8:
            routes.commandCreateFailed(pobj, socket);
            break;
    }

}

function unpackRelay(pkt, obj, socket) {
    // This is the layout
    // var pobj = {
    //     "CircuitID":    null,
    //     "CommandType":  null,
    //     "AgentIDBegin": null,
    //     "AgentIDEnd":   null,
    //     "StreamID":     null,
    //     "Digest":       null,
    //     "BodyLength":   null,
    //     "Relay": {
    //         "Command":  null,
    //         "Body":     null
    //     } 
    // };
    obj.StreamID = pkt.readUInt16BE(3);
    obj.BodyLength = pkt.readUInt16BE(11);
    obj.Relay.Command = pkt.readUInt8(13);
    obj.Relay.Body = pkt.toString('utf8', 14, 14 + obj.BodyLength);
    switch(obj.Relay.Command) {
        case 1:
            console.log(obj.Relay.Body);
            var host = obj.Relay.Body.substring(0, obj.Relay.Body.lastIndexOf(':'));
            var port = obj.Relay.Body.substring(obj.Relay.Body.lastIndexOf(':') + 1, obj.Relay.Body.length);
            //var port = obj.Relay.Body.split(':')[1];
            //var host = obj.Relay.Body.split(':')[0];
            routes.relayBegin(obj, socket, host, port);
            break;
        case 2:
            obj.Relay.Data = pkt.slice(14, 14 + obj.BodyLength);
            routes.relayData(obj, socket);
            break;
        case 3:
            routes.relayEnd(obj, socket);
            break;
        case 4:
            routes.relayConnected(obj, socket);
            break;
        case 6:
            obj.Relay.AgentID = pkt.readUInt32BE(10 + obj.BodyLength);
            routes.relayExtend(obj, socket);
            break;
        case 7:
            routes.relayExtended(obj, socket);
            break;
        case 0x0b:
            routes.relayBeginFailed(obj, socket);
            break;
        case 0x0c:
            routes.relayExtendFailed(obj, socket);
            break;

    }
}

function getUniqueStreamNumber(streamTable, socketFD, circuitNum) {
    var num;
    var flag = true;

    while (flag) {
        num = Math.floor((Math.random() * 9999) + 1);
        var streamKey = [socketFD, circuitNum, num];
        if (streamTable[streamKey] == null) {
            break;
        }
    }

    return num;
}

function parseArgs(arg_arr) {
    var retVal = {};
    for (var i = 0; i < arg_arr.length; i++) {
        var line = arg_arr[i].split(':');
        if (line.length === 1) continue;
        retVal[line[0]] = line[1];
    }
    return retVal;
}

function getRequestString(top, args) {
    var retVal = top[0] + " " + top[1] + " " + "HTTP/1.0\r\n";
    for (var key in args) {
        if (args.hasOwnProperty(key)) {
            retVal += key + ": " + args[key] + "\r\n";
        }
    }
    return retVal;
}


/*
    We recieved an end on a socket. Lookup all circuits associated with that socket, 
    and send out a destroy/end message, and remove it form the table.
*/
function lookupAndDestroyBySocket(socket) {
    var routingTable = globals.routingTable();

    var destroyCB = function(key) {
        util.log("--> Sent Destroy on circuit: " + key[1]);
    };
    if (!socket) return;

    for (var key in routingTable) {
        if (routingTable.hasOwnProperty(key)) {
            var key_socket_fd = key[0];
            if(socket._handle.fd === key_socket_fd) {
                var out = routingTable[key];
                var outSock = out[0];
                outSock.end(relay.createDestroyCell(routingTable[key][1]), destroyCB(key));
                var key_a = key;
                var key_b = [outSock._handle.fd, out[1]];

                delete routingTable[key_a];
                if (routingTable[key_b]) {
                    delete routingTable[key_b];
                }
            }
        }
    }
}

module.exports = {
    parseRegistrations: parseRegistrations,
    isCommandCell: isCommandCell,
    isRelayCell: isRelayCell,
    removeSocketFromTable: removeSocketFromTable,
    getRandomCircuitNumberEven: getRandomCircuitNumberEven,
    getRandomCircuitNumberOdd: getRandomCircuitNumberOdd,
    unpackCommand: unpackCommand,
    unpackRelay: unpackRelay,
    getUniqueStreamNumber: getUniqueStreamNumber,
    parseArgs: parseArgs,
    getRequestString: getRequestString,
    lookupAndDestroyBySocket: lookupAndDestroyBySocket
};