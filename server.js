// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const multer = require('multer');
const socketIO = require('socket.io');
const { execSync } = require('child_process');

const releasePort = () => {
    try {
        execSync('sudo fuser -k 8888/tcp');
        console.log('Port 8888 released.');
    } catch (error) {
        console.error('Error releasing port 8888:', error);
    }
};

releasePort();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'public', 'music');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, 'audio.mp3');
    }
});

const upload = multer({ storage: storage }).single('audioFile');

const { spawn, exec } = require('child_process');
const { Gpio } = require('pigpio');


const trigger = new Gpio(21, { mode: Gpio.OUTPUT });
const echo = new Gpio(20, { mode: Gpio.INPUT, alert: true });
trigger.digitalWrite(0); // Make sure trigger is low


const MICROSECONDS_PER_CM = 1e6 / 34321;
const audioFile = path.join(__dirname, '/public/music', 'audio.mp3');
let DISTANCE_THRESHOLD = undefined;
let audioProcess = undefined;
let audioPlaying = false;

fs.readFile('/home/pi/script/setting.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading setting.json:', err);
        return;
    }

    try {
        const settings = JSON.parse(data);
        let value = settings.threshold;
        DISTANCE_THRESHOLD = value;
    } catch (parseError) {
        console.error('Error parsing JSON:', parseError);
    }
});

// Create an instance of Express
const app = express();
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = socketIO(server);

// Use bodyParser middleware to parse incoming requests
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Enable CORS
app.use(cors());

// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for uploading audio
app.post('/upload-audio', (req, res) => {
    upload(req, res, (err) => {
        if (err) {
            console.error(err);
            res.status(500).json({ error: 'Error uploading file' });
        } else {
            console.log("File uploaded successfully");
            res.status(200).json({ message: 'File uploaded successfully' });
        }
    });
});


// Update route for updating DISTANCE_THRESHOLD
app.post('/update-distance-threshold', (req, res) => {
    const newData = req.body;
    DISTANCE_THRESHOLD = Number(newData.DISTANCE_THRESHOLD);
    res.send("Distance threshold updated successfully");
});

// Route to get the current DISTANCE_THRESHOLD
app.get('/distance-threshold', (req, res) => {
    res.json({ DISTANCE_THRESHOLD: DISTANCE_THRESHOLD });
});


///////--------------------------------- socket code --------------------------------/////////
// Socket connection logic
io.on('connection', (socket) => {
    console.log('user connected');

    socket.emit('server message', 'Welcome to the server !!!');

    socket.on('disconnect', function () {
        console.log('user disconnected');
    });

    // Example: Listen for a chat message from the server
    socket.on('client message', (msg) => {
        console.log('Message from index.html:', msg);
    });
});

const startAudio = () => {
    audioPlaying = true;
    audioProcess = spawn('mplayer', [audioFile]);
}


const watchHCSR04 = () => {
    let startTick;


    echo.on('alert', (level, tick) => {
        if (level == 1) {
            startTick = tick;
        } else {
            const endTick = tick;
            const diff = endTick - startTick;
            const distanceVal = Number(diff / 2 / MICROSECONDS_PER_CM).toPrecision(4);
            // console.log("Distance: ", Number(distanceVal), "cm");
            // console.log("DISTANCE_THRESHOLD ::", DISTANCE_THRESHOLD);


            if (distanceVal < DISTANCE_THRESHOLD) {
                if (audioProcess) {
                    audioProcess.stdout.on('data', (data) => {
                        // console.log(`mplayer output: ${data}`);
                        if (data.includes('A:')) {
                            audioPlaying = true;
                            // console.log('Audio is playing');
                        }

                        if (data.includes('Exiting... (End of file)')) {
                            audioPlaying = false;
                            audioProcess = undefined;
                            // console.log('Audio is stopped');
                        }
                    });
                } else {
                    startAudio();
                }
            }

            console.log(`Distance : ${Number(distanceVal)} cm | Audio : ${audioPlaying}`);
            // Emit ultrasonic distance event here
            io.emit('ultrasonic dist', { "distance": `${Number(distanceVal)} cm`, "soundStatus": audioPlaying });
        }
    });
};

function stopAudio() {
    if (audioProcess && !audioProcess.killed) {
        console.log("Audio Stopped");
        audioProcess.kill();
    }
}

watchHCSR04();

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// process.on('SIGINT', function () {
//     stopAudio();
//     process.exit();
// });

// Trigger a distance measurement once per second
setInterval(() => {
    trigger.trigger(10, 1);
}, 1000);
