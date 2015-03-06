// Logging
// util.log(TAG + "TCP Server Bound to port " + PORT);

var net     = require('net');
var http    = require('http');
var url     = require('url');
var util    = require('util');
var spawn   = require('child_process').spawn;
var torutil = require('./torutil');
var command = require('./command_cell');
var relay   = require('./relay_cell');
var PORT = 1337;

// registations
var torRegistrations = '';

// register ourself
var torName = "Tor61Router";
var groupNum = 5316;
var instanceNum = Math.floor((Math.random() * 9999) + 1);
var router_name = torName + "-" + groupNum + "-" + instanceNum;
agentID = Math.floor((Math.random() * 9999) + 1);

// TAG ourselves to log
var TAG = router_name + ": main.js: ";

var routerAddress = "";

require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  routerAddress = add;
});

// (circuit no, agent no) => (circuit no b, agent no b)
routingTable = {};
socketTable  = {};
streamTable  = {};

var server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    util.log(TAG + "Received Incoming Socket from host " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    // determine if form tor or browser
    var circuitNum = getRandomCircuitNumberOdd();


    pkt = '';
    incomingSocket.on('data', function(data) {
        pkt += data;
    });

    incomingSocket.on('end', function(data) {
        util.log(TAG + "Recieved end from host with complete data recv: " + pkt);


        var buf = new Buffer(message);
        var type = buf.readUInt8(2);

        if (data.toString().toLowerCase().indexOf("http") >= 0) {
            relay.packAndSendData(pkt);
        } else {
            command.unpack(pkt, incomingSocket);
        }
    });
});

getTorRegistrations(function(data) {
    if (data === null) {
        // error
        util.log(TAG + "errored getting registrations");
    }
    
    torRegistrations = torutil.parseRegistrations(data);
    
    util.log(TAG + "Registrations recieved: \n" + data);

    server.listen(PORT, function() {
        util.log(TAG + "TCP Server Bound to port " + PORT);
        registerRouter(PORT);
        createCircuit(data);
    });
});


function createCircuit(data) {
    util.log(TAG + "Creating circuit...");
    var currentCircuit = [];
    for (var i = 0; i < 3; i++) {
        currentCircuit.push(torRegistrations[Math.floor((Math.random() * torRegistrations.length))]);
    }
    util.log(TAG + "Chose 4 random routers with ip addresses: " + 
             currentCircuit[0][0] + ", " + currentCircuit[1][0] + ", " + currentCircuit[2][0]);

    var circuitNum = Math.floor((Math.random() * 9999) + 1);

    // send to cell 1
    socketTable[currentCircuit[0][2]] = net.createConnection(currentCircuit[0][1], currentCircuit[0][0], function() {
        util.log(TAG + "Successfully created connection from " + 
                 agentID + " to " + currentCircuit[0][0] + ":" + currentCircuit[0][1]);
        // send open cell
        socketTable[currentCircuit[0][2]].write(command.createOpenCell(circuitNum, agentID, currentCircuit[0][2]), function() {
            socketTable[currentCircuit[0][2]].write(command.createCreateCell(circuitNum));
        });

    });
    

    // send to cell 2
    socketTable[currentCircuit[1][2]].write(relay.createExtendCell(circuitNum, 0, currentCircuit[1][0], currentCircuit[1][1]));

    // send to cell 3
    ocketTable[currentCircuit[2][2]].write(relay.createExtendCell(circuitNum, 0, currentCircuit[2][0], currentCircuit[2][1]));
}

function registerRouter(port) {

    // Currently has dummy registration info
    var regClient = spawn('python', ['./registration_client.py', port, router_name, routerNumber]);

    util.log(TAG + "registering: in progress");
    function endChild() {
        regClient.kill('SIGINT');
        process.exit(0);
    }

    regClient.stdout.on('data', function(data) {
        util.log(TAG + "registering got stdin with data: " + data);
        util.log(TAG + "got stdin with data: " + data);
        console.log(data.toString());
    });
    
    regClient.stderr.on('data', function(data) {
        util.log(TAG + "got stderr with data: " + data);
        console.log(data.toString());
    });

}


function getTorRegistrations(callback) {
    util.log(TAG + "fetching TOR registrations: in progress");
    var fetchClient = spawn('python', ['./fetch.py',
                                  'Tor61',
                 ]
    );
    var allData = '';
    
    fetchClient.stdout.on('data', function(data) {
        allData += data;
    });
    
    fetchClient.stdout.on('end', function() {
        util.log(TAG + "fetching TOR registrations: completed");
        callback(allData);
    });
    
    fetchClient.stderr.on('data', function(data) {
        util.log(TAG + "fetching TOR registrations had error: " + data);
        // Something bad happened
        callback(null);
    });
 
 }