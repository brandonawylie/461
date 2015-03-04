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



module.exports = {
    parseRegistrations: parseRegistrations
};