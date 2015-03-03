// Logging
// util.log(TAG + "TCP Server Bound to port " + PORT);

var net = require('net');
var http = require('http');
var url  = require('url');
var util = require('util');
var spawn = require('child_process').spawn;

var TAG = "main.js: ";
var PORT = 1337

var torRegistrations = '';

var server = net.createServer({allowHalfOpen: true}, function(incomingSocket) {
    util.log(TAG + "Received Incoming Socket from host " + incomingSocket.remoteAddress + ":" + incomingSocket.remotePort);
    // determine if form tor or browser
    
});

getTorRegistration(function(data) {
    if (data === null) {
        // error
    }
    torRegistrations = data;
    //make circuit
    createCircuit(data);
}).then(function() {
    server.listen(PORT, function() {
        util.log(TAG + "TCP Server Bound to port " + PORT);
        // Register router
        // TODO: get name & int data
        registerRouter(PORT, router_name, int_data);
    });
});

function createCircuit(data) {
    util.log(TAG + "Creating circuit...");
    

}

function registerRouter(port, router_name, int_data) {
    var spawn = require('child_process').spawn;
    // Currently has dummy registration info
    var regClient = spawn('python', ['./registration_client.py', port, router_name, int_data]);
    
    function endChild() {
        regClient.kill('SIGINT');
        process.exit(0);
    }

    regClient.stdout.on('data', function(data) {
        console.log(data.toString());
    });
    
    regClient.stderr.on('data', function(data) {
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