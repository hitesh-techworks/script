const { spawn, exec } = require('child_process');
const usb = require('usb').usb;
const drivelist = require('drivelist');
const fs = require('fs');
const { startServer, stopServer } = require('./serverOnOff');


const mountPath = '/media/myflashdrive';

const delay = (milliseconds) => {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    });
}

startServer();

usb.on('attach', async function (device) {
    console.log("Attach");
    stopServer();

    await delay(2000);

    spawn('mplayer', ['/home/pi/script/public/music/pen-drive-inserted.mp3']);

    await delay(2000);

    const drives = await drivelist.list();
    let pathOfUsb = `${drives[0].raw}1`;
    console.log(pathOfUsb);

    await delay(2000);

    const lsblkProcess = spawn('lsblk');

    lsblkProcess.stdout.on('data', async (data) => {
        const output = data.toString();
        console.log(output);

        const mountProcess = spawn('sudo', ['mount', pathOfUsb, mountPath]);

        mountProcess.stdout.on('data', (data) => {
            console.log('Mounted successfully', data.toString());
        });

        mountProcess.stderr.on('data', (data) => {
            const errorMessage = data.toString();
            console.error('Error:', errorMessage);
        });

        mountProcess.on('close', (code) => {
            if (code === 0) {
                process.chdir(mountPath);
            } else {
                console.error(`Mounting process exited with code ${code}`);
            }
        });
    })


    lsblkProcess.on('close', async (code) => {
        if (code === 0) {
            console.log('lsblkProcess completed successfully');

            await delay(2000);

            exec('ls /media/myflashdrive', async (error, stdout, stderr) => {
                let lsFolderFiles = stdout.toString();
                console.log(lsFolderFiles);

                if (error) {
                    console.error(`Error executing command: ${error}`);
                    return;
                }

                if (stderr) {
                    console.error(`Command stderr: ${stderr}`);
                    return;
                }

                if (lsFolderFiles) {
                    if (!lsFolderFiles.includes('audio.mp3')) {
                        console.log("Audio File Does Not Exist");
                        return
                    } else if (!lsFolderFiles.includes('setting.json')) {
                        console.log("Setting File Does Not Exist");
                        return
                    }
                }

                fs.readFile('/media/myflashdrive/setting.json', 'utf8', async (err, data) => {
                    if (err) {
                        console.error('Error reading file:', err);
                        return;
                    }

                    try {
                        const settings = JSON.parse(data);
                        const localTime = Date.now();
                        // const futureTimestamp = localTime + (10 * 24 * 60 * 60 * 1000); // Adding 10 days in milliseconds

                        if (Number(settings.activity) > Number(localTime)) {
                            console.log('Future timestamp is greater than the current timestamp.', localTime, settings.activity);

                            await delay(2000);

                            fs.copyFile('/media/myflashdrive/audio.mp3', '/home/pi/script/public/music/audio.mp3', (err) => {
                                if (err) {
                                    console.log(err);
                                }
                                spawn('mplayer', ['/home/pi/script/public/music/audio-file-copy.mp3']);
                                console.log('File has been copied');
                            })

                            await delay(4000);

                            fs.copyFile('/media/myflashdrive/setting.json', '/home/pi/script/setting.json', async (err) => {
                                if (err) console.log(err);
                                console.log('File has been copied');
                                spawn('mplayer', ['/home/pi/script/public/music/audio-file-saved-successfully.mp3']);

                            })

                            await delay(5000);
                            startServer();
                        } else {
                            console.log('Future timestamp is less than the current timestamp.', localTime, settings.activity);
                            return;
                        }

                    } catch (err) {
                        console.error('Error parsing JSON:', err);
                    }
                });
            });
        } else {
            console.error(`lsblkProcess exited with code ${code}`);
        }
    });

});

usb.on('detach', function (device) {
    console.log("DeAttach");
});


