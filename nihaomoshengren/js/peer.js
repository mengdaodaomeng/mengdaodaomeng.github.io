/*
====================================
GGSP v2.2 Peer Layer (FULL VERSION)
WebRTC Mesh Core
====================================
*/

const PEER = {};

/*
====================================
连接池
====================================
*/

const pcs = new Map();      // peerId -> RTCPeerConnection
const dcs = new Map();      // peerId -> DataChannel

/*
====================================
状态
====================================
*/

let ROOM = null;
let STATE = null;

/*
====================================
初始化
====================================
*/

PEER.init = function (room, state) {
    ROOM = room;
    STATE = state;
};

/*
====================================
工具
====================================
*/

function getPC(peerId) {
    return pcs.get(peerId);
}

function setPC(peerId, pc) {
    pcs.set(peerId, pc);
}

/*
====================================
创建 PeerConnection
====================================
*/

function createPC(peerId, isInitiator = false) {

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    /*
    ================================
    ICE
    ================================
    */
    pc.onicecandidate = async (e) => {

        if (e.candidate) {

            await SIGNAL.createIce(
                peerId,
                currentOfferId(peerId),
                e.candidate
            );
        }
    };

    /*
    ================================
    DataChannel（只在发起方创建）
    ================================
    */
    if (isInitiator) {

        const dc = pc.createDataChannel("chat");

        setupDC(peerId, dc);
    } else {

        pc.ondatachannel = (e) => {
            setupDC(peerId, e.channel);
        };
    }

    /*
    ================================
    状态监听
    ================================
    */
    pc.onconnectionstatechange = () => {

        log(`peer ${peerId}: ${pc.connectionState}`);

        if (pc.connectionState === "failed") {
            reconnect(peerId);
        }
    };

    setPC(peerId, pc);

    return pc;
}

/*
====================================
DataChannel
====================================
*/

function setupDC(peerId, dc) {

    dcs.set(peerId, dc);

    dc.onopen = () => {
        log(`✅ DC open: ${peerId}`);
    };

    dc.onmessage = (e) => {
        handleMessage(peerId, e.data);
    };

    dc.onclose = () => {
        log(`❌ DC closed: ${peerId}`);
    };
}

/*
====================================
消息处理
====================================
*/

function handleMessage(peerId, msg) {

    try {
        const data = JSON.parse(msg);

        if (data.type === "mesh_broadcast") {
            forwardBroadcast(peerId, data);
            return;
        }

        log(`📩 ${peerId}: ${msg}`);

    } catch (e) {

        log(`📩 ${peerId}: ${msg}`);
    }
}

/*
====================================
广播（Mesh）
====================================
*/

PEER.broadcast = function (msg) {

    const payload = JSON.stringify({
        type: "mesh_broadcast",
        from: STATE.clientId,
        data: msg,
        hop: 0,
        time: Date.now()
    });

    for (let dc of dcs.values()) {

        if (dc.readyState === "open") {
            dc.send(payload);
        }
    }
};

/*
====================================
广播转发（防环）
====================================
*/

function forwardBroadcast(fromPeer, data) {

    data.hop = (data.hop || 0) + 1;

    if (data.hop > 5) return;

    for (let dc of dcs.values()) {

        if (dc.readyState === "open") {
            dc.send(JSON.stringify(data));
        }
    }
}

/*
====================================
连接 Peer（主动发起）
====================================
*/

let offerMap = new Map(); // peerId -> offerId

PEER.connect = async function (peerId) {

    const pc = createPC(peerId, true);

    const dc = pc.createDataChannel("chat");
    setupDC(peerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const offerId = await SIGNAL.createOffer(peerId);

    offerMap.set(peerId, offerId);

    await SIGNAL.createAnswer(peerId, offerId, offer);
};

/*
====================================
处理 Offer（被动接收）
====================================
*/

PEER.onOffer = async function (offer, from, offerId) {

    const pc = createPC(from, false);

    offerMap.set(from, offerId);

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await SIGNAL.createAnswer(from, offerId, answer);
};

/*
====================================
处理 Answer
====================================
*/

PEER.onAnswer = async function (answer, from) {

    const pc = getPC(from);

    if (!pc) return;

    await pc.setRemoteDescription(answer);
};

/*
====================================
ICE处理
====================================
*/

PEER.onIce = async function (candidate, from) {

    const pc = getPC(from);

    if (!pc) return;

    try {
        await pc.addIceCandidate(candidate);
    } catch (e) {
        log("ICE error: " + e);
    }
};

/*
====================================
重连机制
====================================
*/

async function reconnect(peerId) {

    log(`♻️ reconnect ${peerId}`);

    pcs.delete(peerId);
    dcs.delete(peerId);

    setTimeout(() => {
        PEER.connect(peerId);
    }, 2000);
}

/*
====================================
offerId工具
====================================
*/

function currentOfferId(peerId) {
    return offerMap.get(peerId) || "unknown";
}

/*
====================================
对外导出
====================================
*/

window.PEER = PEER;