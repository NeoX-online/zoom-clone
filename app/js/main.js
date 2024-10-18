const socket = io({
    path: '/conference/socket.io'
});

const toggleMicBtn = document.querySelector('#toggleMicBtn');
const toggleCamBtn = document.querySelector('#toggleCamBtn');
const cameraSelect = document.querySelector('#cameraSelect');
const micSelect = document.querySelector('#micSelect');
const localVideo = document.querySelector('#localVideo-container video');
const videoGrid = document.querySelector('#videoGrid');
const notification = document.querySelector('#notification');
const notify = (message) => {
    notification.innerHTML = message;
};

const pcConfig = {
    iceServers: [
        {
            urls: [
                'stun:stun.l.google.com:19302',
                'stun:stun1.l.google.com:19302',
                'stun:stun2.l.google.com:19302',
                'stun:stun3.l.google.com:19302',
                'stun:stun4.l.google.com:19302',
            ],
        },
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com',
        },
        {
            urls: 'turn:192.158.29.39:3478?transport=udp',
            credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=',
            username: '28224511:1379330808',
        },
    ],
};

/**
 * Initialize WebRTC
 */
const webrtc = new Webrtc(socket, pcConfig, {
    log: true,
    warn: true,
    error: true,
});

/**
 * Device selection and media handling
 */
const getDevices = async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        const microphones = devices.filter(device => device.kind === 'audioinput');

        // Clear and populate the camera select
        cameraSelect.innerHTML = '';
        cameras.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Camera ${cameraSelect.length + 1}`;
            cameraSelect.appendChild(option);
        });

        // Clear and populate the microphone select
        micSelect.innerHTML = '';
        microphones.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${micSelect.length + 1}`;
            micSelect.appendChild(option);
        });

        console.log("Available cameras:", cameras);
        console.log("Available microphones:", microphones);
    } catch (err) {
        console.error("Error getting devices:", err);
    }
};

// Call getDevices when the page loads
getDevices();

// Function to get selected media stream with the chosen devices
webrtc.getLocalStream = async function () {
    const audioDeviceId = micSelect.value;
    const videoDeviceId = cameraSelect.value;

    console.log("Selected audio device:", audioDeviceId);
    console.log("Selected video device:", videoDeviceId);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
            video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        });

        console.log("Got local stream:", stream);

        // Attach the stream to the video element
        this._localStream = stream;
        localVideo.srcObject = stream;

        return stream;
    } catch (err) {
        console.error("Error getting local media stream:", err);
        notify(`Error getting media: ${err.message}`);
    }
};

/**
 * Toggle microphone for the local user
 */
toggleMicBtn.addEventListener('click', () => {
    const audioTrack = webrtc._localStream?.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        console.log("Microphone is now", audioTrack.enabled ? "enabled" : "disabled");
        toggleMicBtn.textContent = audioTrack.enabled ? 'Mute Microphone' : 'Unmute Microphone';
    } else {
        notify('No audio track available');
    }
});

/**
 * Toggle camera for the local user
 */
toggleCamBtn.addEventListener('click', () => {
    const videoTrack = webrtc._localStream?.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        console.log("Camera is now", videoTrack.enabled ? "enabled" : "disabled");
        toggleCamBtn.textContent = videoTrack.enabled ? 'Turn Off Camera' : 'Turn On Camera';
    } else {
        notify('No video track available');
    }
});

/**
 * Update media stream when devices are changed
 */
cameraSelect.addEventListener('change', async () => {
    await webrtc.getLocalStream();
    notify('Camera changed successfully');
});

micSelect.addEventListener('change', async () => {
    await webrtc.getLocalStream();
    notify('Microphone changed successfully');
});

/**
 * Create or join a room
 */
const roomInput = document.querySelector('#roomId');
const joinBtn = document.querySelector('#joinBtn');
joinBtn.addEventListener('click', async () => {
    const room = roomInput.value;
    if (!room) {
        notify('Room ID not provided');
        return;
    }

    // Get the stream before joining the room
    await webrtc.getLocalStream();
    webrtc.joinRoom(room);
});

/**
 * Set the room title and update notification
 */
const setTitle = (status, e) => {
    const room = e.detail.roomId;
    console.log(`Room ${room} was ${status}`);
    notify(`Room ${room} was ${status}`);
    document.querySelector('h1').textContent = `Room: ${room}`;
    webrtc.gotStream();
};

webrtc.addEventListener('createdRoom', setTitle.bind(this, 'created'));
webrtc.addEventListener('joinedRoom', setTitle.bind(this, 'joined'));

/**
 * Leave the room
 */
const leaveBtn = document.querySelector('#leaveBtn');
leaveBtn.addEventListener('click', () => {
    webrtc.leaveRoom();
});
webrtc.addEventListener('leftRoom', (e) => {
    const room = e.detail.roomId;
    document.querySelector('h1').textContent = '';
    notify(`Left the room ${room}`);
});

/**
 * Handle kicked event
 */
webrtc.addEventListener('kicked', () => {
    document.querySelector('h1').textContent = 'You were kicked out';
    videoGrid.innerHTML = '';
});

/**
 * Handle new user joining the room
 */
webrtc.addEventListener('newUser', (e) => {
    const socketId = e.detail.socketId;
    const stream = e.detail.stream;

    const videoContainer = document.createElement('div');
    videoContainer.setAttribute('class', 'grid-item');
    videoContainer.setAttribute('id', socketId);

    const video = document.createElement('video');
    video.setAttribute('autoplay', true);
    video.setAttribute('muted', true); 
    video.setAttribute('playsinline', true);
    video.srcObject = stream;

    const p = document.createElement('p');
    p.textContent = socketId;

    videoContainer.append(p);
    videoContainer.append(video);
    videoGrid.append(videoContainer);
});

/**
 * Handle user leaving
 */
webrtc.addEventListener('userLeave', (e) => {
    const socketId = e.detail.socketId;
    console.log(`User ${socketId} left the room`);
    document.getElementById(socketId)?.remove();
});

/**
 * Handle errors
 */
webrtc.addEventListener('error', (e) => {
    const error = e.detail.error;
    console.error(error);
    notify(error);
});

/**
 * Handle notifications
 */
webrtc.addEventListener('notification', (e) => {
    const notif = e.detail.notification;
    console.log(notif);
    notify(notif);
});

// Initial call to get local stream to set up local video
webrtc.getLocalStream();
