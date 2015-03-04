// Logging
// util.log(TAG + "TCP Server Bound to port " + PORT);

var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var PORT = 1337;

// registations
var torRegistrations = '';

// register ourself
var torName = "Tor61Router";
var groupNum = 5316;
var instanceNum = Math.floor((Math.random() * 9999) + 1);
var router_name = torName + "-" + groupNum + "-" + instanceNum;
var routerNumber = Math.floor((Math.random() * 9999) + 1);

// TAG ourselves to log
var TAG = router_name + ": main.js: ";

var server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    util.log(TAG + "Received Incoming Socket from host " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    // determine if form tor or browser
    
});

getTorRegistrations(function(data) {
    if (data === null) {
        // error
        util.log(TAG + "errored getting registrations");
    }
    torRegistrations = data;
    util.log(TAG + "Registrations recieved: \n" + data);
    server.listen(PORT, function() {
        util.log(TAG + "TCP Server Bound to port " + PORT);
        registerRouter(PORT);
        createCircuit(data);
    });
});


function createCircuit(data) {
    util.log(TAG + "Creating circuit...");
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