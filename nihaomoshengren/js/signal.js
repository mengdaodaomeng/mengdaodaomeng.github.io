const SIGNAL = {};

let GIST = null;
let CLIENT_ID = "peer_" + Math.random().toString(36).slice(2);

let pc = null;
let dc = null;

/* =======================
工具
======================= */

function log(msg) {
    const el = document.getElementById("log");
    el.innerHTML += msg + "\n";
    el.scrollTop = el.scrollHeight;
}

/* =======================
Peer
======================= */

function createPC(isOfferer) {

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    pc.onicecandidate = async (e) => {
        if (!e.candidate) return;

        await sendSignal({
            type: "ice",
            from: CLIENT_ID,
            candidate: e.candidate
        });
    };

    pc.ondatachannel = (e) => {
        dc = e.channel;
        setupDC();
    };

    if (isOfferer) {
        dc = pc.createDataChannel("chat");
        setupDC();
    }
}

/* =======================
DataChannel
======================= */

function setupDC() {

    dc.onopen = () => log("DC open");

    dc.onmessage = (e) => {
        log("对方: " + e.data);
    };
}

/* =======================
信令发送
======================= */

async function sendSignal(data) {

    data.time = Date.now();

    await updateGist(GIST, {
        ["signal_" + Date.now() + ".json"]: jsonFile(data)
    });
}

/* =======================
处理信令
======================= */

async function poll() {

    setInterval(async () => {

        const gist = await getGist(GIST);

        const files = gist.files;

        for (let name in files) {

            if (!name.startsWith("signal_")) continue;

            const msg = JSON.parse(files[name].content);

            if (msg.from === CLIENT_ID) continue;

            if (msg.type === "offer") {

                log("收到 offer");

                createPC(false);

                await pc.setRemoteDescription(msg.offer);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                await sendSignal({
                    type: "answer",
                    from: CLIENT_ID,
                    answer
                });
            }

            if (msg.type === "answer") {

                log("收到 answer");

                await pc.setRemoteDescription(msg.answer);
            }

            if (msg.type === "ice") {

                try {
                    await pc.addIceCandidate(msg.candidate);
                } catch (e) {}
            }
        }

    }, 3000);
}

/* =======================
创建房间
======================= */

SIGNAL.createRoom = async function (gistId) {

    GIST = gistId;

    createPC(true);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await sendSignal({
        type: "offer",
        from: CLIENT_ID,
        offer
    });

    poll();

    log("创建房间 OK");
};

/* =======================
加入房间
======================= */

SIGNAL.joinRoom = function (gistId) {

    GIST = gistId;

    createPC(false);

    poll();

    log("加入房间 OK");
};

/* =======================
发送消息
======================= */

SIGNAL.send = function (msg) {

    if (dc && dc.readyState === "open") {
        dc.send(msg);
        log("我: " + msg);
    }
};