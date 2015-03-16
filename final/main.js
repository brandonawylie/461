var net = require('net');
var fs  = require('fs');

if (process.argv.length !== 5) {
    console.log("Usage: run <file> <port> <time>");
    process.exit(1);
}

process.setMaxListeners(0);

var FILE = process.argv[2];
var PORT = process.argv[3];
var TIME = process.argv[4];

var TIMEOUT = 2000;
var CLOSE_TIMEOUT = 10000;
var NUM_HOSTS;

var prefStore = {};
var closeTimer;
var closed = false;

var UUID = Math.floor(Math.random() * 99999);

var server = net.createServer(function(sock) {
    
    sock.on('error', function(){});
    sock.on('data', function (data) {
        var incPkt = unpack(data);
        if (incPkt.Type == 1) {
            console.log("Recv'd Ack packet in incoming sock, RAWR");
        }

        var key = incPkt.ID;//sock.remoteAddress + ":" + sock.remotePort;
        console.log("recv'd a " + incPkt.Body + " from " + key);
        prefStore[key] = incPkt.Body;
        console.log(prefStore);

        var resPkt = pack(1);
        sock.end(resPkt);

        if (Object.keys(prefStore).length === NUM_HOSTS) {
            closeOutServer();
        }
    }); 
});

server.on('error', function(){});

function closeOutServer() {

    if (closed) return;
    if (Object.keys(prefStore).length === NUM_HOSTS) {
        console.log(decideOnTime());     
    } else {
        console.log("no soln");
    }
    clearTimeout(closeTimer);
    server.close();
    closed = true;
}

function decideOnTime() {
    var times = {};
    var keys = [];
    // transfer 
    for (var key in prefStore) {
        if (prefStore.hasOwnProperty(key)) {
            var newKey = prefStore[key];
            keys.push(prefStore[key]);
            if (times.hasOwnProperty(newKey)) {
                times[newKey] += 1;
            } else {
                times[newKey] = 1;

            }
        }
    }
    keys.sort();

    var max = -1;
    var maxKey;
    for (var i = 0; i < keys.length; i++) {
        key = keys[i];
        if (times[key] > max) {
            max = times[key];
            maxKey = key;
        }
    }
    return maxKey;

}

// pack an outgoing packet
// type: either 0, or 1
//          0 - Message
//          1 - Ack
// time: time in 24hr clock for the propsed time [optinal if Ack]
function pack(type) {
    // TODO this
    // 4 byte flag + 4 byte UUID + 4 byte body length + body length
    var size = 4 + 4 + 4 + TIME.length;
    var buf = new Buffer(size);
    buf.writeUInt32BE(type, 0);
    if (type === 0) {
        buf.writeUInt32BE(UUID, 4);
        buf.writeUInt32BE(TIME.length, 8);
        buf.write(TIME, 12, TIME.length, 'utf8');
    }
    return buf;
}

// unpack an incoming packet, and store it in an object
function unpack(data) {
    var obj = {
        "Type": null,
        "ID": null,
        "Body": null
    };

    // TODO this
    //console.log(buf.toString('utf8', 0, 1));
    var buf = new Buffer(data);
    obj.Type = buf.readUInt32BE(0);
    if (obj.Type === 0) {
        obj.ID = buf.readUInt32BE(4);
        var len = buf.readUInt32BE(8);
        obj.Body = buf.toString('utf8', 12, 12 + len);

    }


    // after we have populated the object, return it
    return obj;
}

function sendTimeToHosts(data) {
    var lineArr = data.split('\n');
    var packet = pack(0, TIME.length, TIME);

    var startConnections = function(i, arr) {
        if (arr[i] === '' || arr[i] === undefined) return;
        var curLineArr = arr[i].split(' ');
        var ip = curLineArr[0];
        var port = parseInt(curLineArr[1]);
        var key = ip + ":" + port;
        var sock = new net.Socket();

        sock.on('error', function(err){
            //console.log("There was an error: " + err);
        });

        var conTimer;

        var fn = function() {
            //console.log("trying to connect to " + key);
            sock.connect(port, ip, function() {
                var sendTimer;
                //console.log("connect succeeded to: " + key);
                clearInterval(conTimer);
                sock.write(packet);

                sendTimer = setInterval(function () {
                    //console.log("trying to write packet");
                    sock.write(packet);
                }, TIMEOUT);

                sock.on('data', function (data) {
                    data = data.toString();

                    var incPkt = unpack(data);


                    if (incPkt.Type === 1) {
                        //prefStore[key] = incPkt.Body;
                        // TODO it's Ack'd
                        clearInterval(sendTimer);
                        if (i < arr.length - 1);
                            startConnections(i + 1, arr);
                    } else {
                        //console.log("Recv'd a non-Ack packet on an outgoing line, RAWR");
                    }
                });

                sock.on('error', function(err) {
                    //console.log("There was an error: " + err);
                });
            });
        
        };
        conTimer = setInterval(fn, TIMEOUT);
        fn();
        
        

    
    };
    startConnections(0, lineArr);
}

fs.readFile(FILE, 'utf8', function(err, data) {
        if (err) {
            //TODO exit
            console.log("Could not read file, error: " + err);
        } else {
            NUM_HOSTS = data.split('\n').length;
            server.listen(PORT, function() {
                closeTimer = setTimeout(closeOutServer, CLOSE_TIMEOUT);
            });
            sendTimeToHosts(data);
        }
    });


