/*
====================================
GGSP v2.2 Signal Layer
File-based WebRTC Signaling
====================================
*/

const SIGNAL = {};

/*
====================================
基础配置
====================================
*/

const SIGNAL_CONFIG = {
    HEARTBEAT_TIMEOUT: 90_000,
    SUSPECT_TIMEOUT: 180_000,
    PURGE_TIMEOUT: 300_000,
    CLAIM_TIMEOUT: 120_000
};

/*
====================================
运行状态
====================================
*/

let ROOM = null;
let STATE = null;

function setContext(room, state) {
    ROOM = room;
    STATE = state;
}

/*
====================================
工具：时间
====================================
*/

function now() {
    return Date.now();
}

/*
====================================
工具：文件名生成
====================================
*/

function offerFile(from, to, state, offerId) {
    return `offer_${from}_${to}_${state}_${offerId}.json`;
}

function claimFile(offerId, peerId) {
    return `claim_${offerId}_${peerId}.json`;
}

function answerFile(from, to, offerId) {
    return `answer_${from}_${to}_${offerId}.json`;
}

function iceFile(from, to, offerId, seq) {
    return `ice_${from}_${to}_${offerId}_${String(seq).padStart(6, "0")}.json`;
}

function iceDoneFile(from, to, offerId) {
    return `ice_${from}_${to}_${offerId}_done.json`;
}

function sessionFile(a, b, offerId) {
    const [x, y] = [a, b].sort();
    return `session_${x}_${y}_${offerId}.json`;
}

/*
====================================
Gist API封装（依赖外部 github.js）
====================================
*/

async function createFile(gistId, filename, content) {
    return updateGist(gistId, {
        [filename]: jsonFile(content)
    });
}

async function deleteFile(gistId, filename) {
    return updateGist(gistId, {
        [filename]: null
    });
}

/*
====================================
Offer 创建
====================================
*/

SIGNAL.createOffer = async function (to = "anyone") {
    const offerId = `o_${Math.random().toString(36).slice(2)}`;

    const file = offerFile(
        STATE.clientId,
        to,
        "waiting",
        offerId
    );

    const offer = {
        offerId,
        from: STATE.clientId,
        to,
        state: "waiting",
        room: ROOM.roomId,
        generation: ROOM.generation,
        createdAt: now(),
        expireAt: now() + 60_000,
        offer: null
    };

    await createFile(ROOM.gistId, file, offer);

    return offerId;
};

/*
====================================
Claim 抢占
====================================
*/

SIGNAL.createClaim = async function (offerId) {
    const file = claimFile(offerId, STATE.clientId);

    const claim = {
        offerId,
        peerId: STATE.clientId,
        time: now()
    };

    await createFile(ROOM.gistId, file, claim);
};

/*
====================================
锁定 Offer
====================================
*/

SIGNAL.lockOffer = async function (offerFileName, targetPeer) {
    const locked = offerFileName.replace(
        "_waiting_",
        `_locked_${targetPeer}_`
    );

    const offer = {
        state: "locked",
        lockedBy: targetPeer,
        lockedAt: now()
    };

    await createFile(ROOM.gistId, locked, offer);
    await deleteFile(ROOM.gistId, offerFileName);
};

/*
====================================
Answer
====================================
*/

SIGNAL.createAnswer = async function (to, offerId, answer) {
    const file = answerFile(
        STATE.clientId,
        to,
        offerId
    );

    const data = {
        offerId,
        from: STATE.clientId,
        to,
        answer,
        createdAt: now()
    };

    await createFile(ROOM.gistId, file, data);
};

/*
====================================
ICE发送
====================================
*/

let iceSeq = 0;

SIGNAL.createIce = async function (to, offerId, candidate) {
    const file = iceFile(
        STATE.clientId,
        to,
        offerId,
        ++iceSeq
    );

    const data = {
        from: STATE.clientId,
        to,
        offerId,
        candidate,
        createdAt: now()
    };

    await createFile(ROOM.gistId, file, data);
};

/*
====================================
ICE完成
====================================
*/

SIGNAL.createIceDone = async function (to, offerId) {
    const file = iceDoneFile(
        STATE.clientId,
        to,
        offerId
    );

    await createFile(ROOM.gistId, file, {
        done: true,
        at: now()
    });
};

/*
====================================
Session创建
====================================
*/

SIGNAL.createSession = async function (a, b, offerId) {
    const file = sessionFile(a, b, offerId);

    const data = {
        peerA: a,
        peerB: b,
        offerId,
        roomGeneration: ROOM.generation,
        connectedAt: now(),
        state: "active"
    };

    await createFile(ROOM.gistId, file, data);
};

/*
====================================
Heartbeat更新
====================================
*/

SIGNAL.updateHeartbeat = async function () {
    const file = `heartbeat_${STATE.clientId}.json`;

    const data = {
        peerId: STATE.clientId,
        lastSeen: now(),
        room: ROOM.roomId,
        generation: ROOM.generation
    };

    await createFile(ROOM.gistId, file, data);
};

/*
====================================
SUSPECT / DEAD 标记
====================================
*/

SIGNAL.markSuspect = async function (peerId) {
    await createFile(ROOM.gistId,
        `suspect_${peerId}.json`,
        {
            peerId,
            suspectAt: now()
        }
    );
};

SIGNAL.markDead = async function (peerId) {
    await createFile(ROOM.gistId,
        `dead_${peerId}.json`,
        {
            peerId,
            deadAt: now()
        }
    );
};

/*
====================================
GC 清理（核心）
====================================
*/

SIGNAL.gc = async function (files) {

    const t = now();

    for (let f of files) {

        const name = f.name;

        const content = f.content;

        /*
        OFFER过期
        */
        if (name.startsWith("offer_")) {
            if (content?.expireAt < t) {
                await deleteFile(ROOM.gistId, name);
            }
        }

        /*
        CLAIM过期
        */
        if (name.startsWith("claim_")) {
            if (t - content.time > SIGNAL_CONFIG.CLAIM_TIMEOUT) {
                await deleteFile(ROOM.gistId, name);
            }
        }

        /*
        SESSION依赖检查
        */
        if (name.startsWith("session_")) {
            const aAlive = await isPeerAlive(content.peerA);
            const bAlive = await isPeerAlive(content.peerB);

            if (!aAlive || !bAlive) {
                await deleteFile(ROOM.gistId, name);
            }
        }

        /*
        DEAD节点清理
        */
        if (name.startsWith("dead_")) {
            if (t - content.deadAt > SIGNAL_CONFIG.PURGE_TIMEOUT) {
                await purgePeer(content.peerId);
            }
        }
    }
};

/*
====================================
节点是否存活
====================================
*/

async function isPeerAlive(peerId) {
    const hb = await getFile(
        ROOM.gistId,
        `heartbeat_${peerId}.json`
    );

    if (!hb) return false;

    return (now() - hb.lastSeen) < SIGNAL_CONFIG.HEARTBEAT_TIMEOUT;
}

/*
====================================
PURGE
====================================
*/

async function purgePeer(peerId) {
    await deleteFile(ROOM.gistId, `peer_${peerId}.json`);
    await deleteFile(ROOM.gistId, `heartbeat_${peerId}.json`);
    await deleteFile(ROOM.gistId, `capability_${peerId}.json`);
}

/*
====================================
导出
====================================
*/

window.SIGNAL = SIGNAL;