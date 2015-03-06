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

function getCircuitNumberEven() {
    var val = Math.floor((Math.random() * 99999) + 1);
    if (val % 2 !== 0) {
        val += 1;
    }
    return val;
}
function getCircuitNumberOdd() {
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



module.exports = {
    parseRegistrations: parseRegistrations,
    isCommandCell: isCommandCell,
    isRelayCell: isRelayCell,
    removeSocketFromTable: removeSocketFromTable
};