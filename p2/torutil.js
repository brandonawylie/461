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
    util.log(TAG + "received packet on circ #: " + pobj.CircuitID + ", of command: " + pobj.CommandType);
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
            routes.commandDestroy(pobj);
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
            routes.commandCreateFailed(pobj);
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
    var endBody = Math.max(0, obj.BodyLength - 4);
    obj.Relay.Body = pkt.toString('utf8', 14, 14 + endBody);
    util.log(TAG + "recv'd relay with cmd: " + obj.Relay.Command);
    switch(obj.Relay.Command) {
        case 1:
            routes.relayBegin();
            break;
        case 2:
            routes.relayData();
            break;
        case 3:
            routes.relayEnd(obj, socket);
            break;
        case 4:
            routes.relayConnected();
            break;
        case 6:
            obj.Relay.AgentID = pkt.readUInt32BE(10 + obj.BodyLength)
            routes.relayExtend(obj, socket);
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