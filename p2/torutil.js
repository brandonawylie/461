var routes = require('./routes');
var util = require('util');
var TAG = "torutil.js ";

function parseRegistrations(reg) {
    var retVal = [];
    var lines = reg.split("\n");
    //lines.splice(lines.length , 1);
    for (var i = 0; i < lines.length - 1; i++) {
        var  router = lines[i].split("\t");
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
    var val = Math.floor((Math.random() * 99999) + 1);
    if (val % 2 !== 0) {
        val += 1;
    }
    return val;
}
function getRandomCircuitNumberOdd() {
    var val = Math.floor((Math.random() * 99999) + 1);
    if (val % 2 === 0) {
        val += 1;
    }
    return val;
}

function removeSocketFromTable(sock) {
    for (var key in socketTable) {
        if (p.hasOwnProperty(key)) {
            if (socketTable[key] === sock) {
                socketTable[key].end();
                delete socketTable[key];
            }
        }
    }
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
    util.log(TAG + "received packet on circ #: " + pobj.CircuitID + ", of command: " + pobj.CommandType);
    switch(pobj.CommandType) {
        case 1:
            routes.commandCreate(pobj);
            break;
        case 2:
            routes.commandCreated(pobj);
            break;
        case 3:
            relay.unpack(pkt, pobj);
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

function unpackRelay(pkt, obj) {
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
    obj.Relay.Body = pkt.read('utf8', 14, 14 + obj.BodyLength);
    util.log(TAG + "recv'd relay with cmd: " + obj.Relay.Command);
    switch(obj.Relay.Command) {
        case 1:
            routes.relayBegin();
            break;
        case 2:
            routes.relayData();
            break;
        case 3:
            routes.relayEnd();
            break;
        case 4:
            routes.relayConnected();
            break;
        case 6:
            routes.relayExtend();
            break;
        case 7:
            routes.relayExtended();
            break;
        case 0x0b:
            routes.relayBeginFailed();
            break;
        case 0x0c:
            routes.relayExtendFailed();
            break;

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
    unpackRelay: unpackRelay
};