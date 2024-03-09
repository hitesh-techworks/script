const { spawn } = require('child_process');

let startServerPid = null;

const startServer = () => {
    const startServer = spawn('sudo', ['node', '/home/pi/script/server.js']);
    startServerPid = startServer.pid;
    console.log("startServerPid :: ", startServerPid);

    startServer.stdout.on('data', (data) => {
        console.log(`Server : ${data}`);
    });

    startServer.stderr.on('data', (data) => {
        console.error(`Server Err : ${data}`);
    });

    startServer.on('close', (code) => {
        console.log(`Server File Stopped...`);
    });
}

const stopServer = () => {
    process.kill(startServerPid);
}

module.exports = { startServer, stopServer };
