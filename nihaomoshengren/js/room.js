/*
====================================
GGSP v2.2 Room Layer
Control Plane for Mesh Network
====================================
*/

const ROOM_CTRL = {};

/*
====================================
状态
====================================
*/

let ROOM = null;
let STATE = null;

let peers = new Map();   // peerId -> status
let sessions = new Map(); // sessionId -> session

/*
====================================
初始化
====================================
*/

ROOM_CTRL.init = function (room, state) {
    ROOM = room;
    STATE = state;
};

/*
====================================
加入房间
====================================
*/

ROOM_CTRL.joinRoom = async function () {

    await SIGNAL.updateHeartbeat();

    await registerSelf();

    startHeartbeatLoop();

    startDiscoveryLoop();

    startGCLoop();

    log("加入房间完成");
};

/*
====================================
注册自己
====================================
*/

async function registerSelf() {

    const file = `peer_${STATE.clientId}.json`;

    await createFile(ROOM.gistId, file, {
        peerId: STATE.clientId,
        joinedAt: Date.now(),
        generation: ROOM.generation,
        state: "online"
    });
}

/*
====================================
心跳循环
====================================
*/

function startHeartbeatLoop() {

    setInterval(async () => {

        await SIGNAL.updateHeartbeat();

        await checkSelfStatus();

    }, 30000);
}

/*
====================================
检测自身状态
====================================
*/

async function checkSelfStatus() {

    const hb = await getFile(
        ROOM.gistId,
        `heartbeat_${STATE.clientId}.json`
    );

    if (!hb) return;

    const diff = Date.now() - hb.lastSeen;

    if (diff > 90000) {
        log("⚠️ 进入SUSPECT状态");
        await SIGNAL.markSuspect(STATE.clientId);
    }

    if (diff > 180000) {
        log("💀 进入DEAD状态");
        await SIGNAL.markDead(STATE.clientId);
    }
}

/*
====================================
发现循环（核心）
====================================
*/

function startDiscoveryLoop() {

    setInterval(async () => {

        const files = await listGistFiles(ROOM.gistId);

        await parsePeers(files);

        await parseSessions(files);

        await detectHostMigration();

        await detectMesh();

    }, 5000);
}

/*
====================================
解析节点
====================================
*/

async function parsePeers(files) {

    for (let f of files) {

        if (f.name.startsWith("peer_")) {

            const peerId = f.name.split("_")[1].replace(".json", "");

            if (!peers.has(peerId)) {
                peers.set(peerId, {
                    state: "online"
                });
            }
        }

        if (f.name.startsWith("dead_")) {
            const peerId = f.name.split("_")[1].replace(".json", "");
            peers.set(peerId, { state: "dead" });
        }

        if (f.name.startsWith("suspect_")) {
            const peerId = f.name.split("_")[1].replace(".json", "");
            peers.set(peerId, { state: "suspect" });
        }
    }
}

/*
====================================
解析 Session
====================================
*/

async function parseSessions(files) {

    sessions.clear();

    for (let f of files) {

        if (f.name.startsWith("session_")) {

            const data = f.content;

            const id = f.name;

            sessions.set(id, data);
        }
    }
}

/*
====================================
Host迁移检测（核心）
====================================
*/

async function detectHostMigration() {

    const ownerDead = await isPeerDead(ROOM.owner);

    if (!ownerDead) return;

    log("👑 检测到房主死亡，开始选举");

    const candidates = [];

    for (let [peerId, p] of peers.entries()) {

        if (p.state === "online") {
            candidates.push(peerId);
        }
    }

    if (candidates.length === 0) return;

    const newOwner = selectNewOwner(candidates);

    await promoteToOwner(newOwner);
}

/*
====================================
选举规则
====================================
*/

function selectNewOwner(list) {

    return list.sort()[0]; // 字典序最小
}

/*
====================================
升级房主
====================================
*/

async function promoteToOwner(peerId) {

    ROOM.owner = peerId;

    ROOM.generation++;

    await updateGist(ROOM.gistId, {
        "room.json": jsonFile({
            roomId: ROOM.roomId,
            owner: peerId,
            generation: ROOM.generation,
            updatedAt: Date.now()
        })
    });

    log("👑 新房主：" + peerId);
}

/*
====================================
Mesh检测（自动补边）
====================================
*/

async function detectMesh() {

    const onlinePeers = [];

    for (let [id, p] of peers.entries()) {
        if (p.state === "online") {
            onlinePeers.push(id);
        }
    }

    const me = STATE.clientId;

    for (let peer of onlinePeers) {

        if (peer === me) continue;

        const sessionId = `session_${[me, peer].sort().join("_")}`;

        if (!sessions.has(sessionId)) {

            log("🔗 补充连接：" + peer);

            await createOffer(peer);
        }
    }
}

/*
====================================
检查节点是否死亡
====================================
*/

async function isPeerDead(peerId) {

    const dead = await getFile(
        ROOM.gistId,
        `dead_${peerId}.json`
    );

    return !!dead;
}

/*
====================================
GC循环
====================================
*/

function startGCLoop() {

    setInterval(async () => {

        const files = await listGistFiles(ROOM.gistId);

        await SIGNAL.gc(files);

        await cleanupLocalCache();

    }, 10000);
}

/*
====================================
本地缓存清理
====================================
*/

function cleanupLocalCache() {
    peers.forEach((v, k) => {
        if (v.state === "dead") {
            peers.delete(k);
        }
    });
}

/*
====================================
离开房间
====================================
*/

ROOM_CTRL.leaveRoom = async function () {

    await deleteFile(ROOM.gistId, `peer_${STATE.clientId}.json`);
    await deleteFile(ROOM.gistId, `heartbeat_${STATE.clientId}.json`);

    log("👋 已离开房间");
};

/*
====================================
导出
====================================
*/

window.ROOM_CTRL = ROOM_CTRL;