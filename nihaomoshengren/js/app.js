/*
====================================
GGSP v2.2 App Layer
Entry Point (UI + Bootstrap)
====================================
*/

let ROOM = null;
let STATE = null;

/*
====================================
初始化
====================================
*/

async function initApp() {

    log("🚀 GGSP v2.2 启动中...");

    loadSavedState();

    bindUI();

    log("✅ App初始化完成");
}

/*
====================================
加载本地状态
====================================
*/

function loadSavedState() {

    const saved = localStorage.getItem("state");

    if (saved) {
        STATE = JSON.parse(saved);
    } else {
        STATE = {
            clientId: "peer_" + Math.random().toString(36).slice(2)
        };

        localStorage.setItem("state", JSON.stringify(STATE));
    }

    log("👤 clientId: " + STATE.clientId);
}

/*
====================================
绑定UI
====================================
*/

function bindUI() {

    document.getElementById("btnCreate").onclick = createRoom;
    document.getElementById("btnJoin").onclick = joinRoom;
    document.getElementById("btnSend").onclick = sendMessage;

    document.getElementById("btnClear").onclick = () => {
        document.getElementById("log").innerHTML = "";
    };
}

/*
====================================
创建房间
====================================
*/

async function createRoom() {

    log("🏠 创建房间...");

    ROOM = {
        roomId: "room_" + Date.now(),
        gistId: document.getElementById("gistId").value,
        owner: STATE.clientId,
        generation: 1
    };

    await SIGNAL.updateHeartbeat();

    await ROOM_CTRL.init(ROOM, STATE);
    await ROOM_CTRL.joinRoom();

    await PEER.init(ROOM, STATE);

    log("✅ 房间创建完成");
}

/*
====================================
加入房间
====================================
*/

async function joinRoom() {

    log("🚪 加入房间...");

    ROOM = {
        roomId: "room_join",
        gistId: document.getElementById("gistId").value,
        owner: null,
        generation: 1
    };

    await SIGNAL.updateHeartbeat();

    await ROOM_CTRL.init(ROOM, STATE);
    await ROOM_CTRL.joinRoom();

    await PEER.init(ROOM, STATE);

    log("✅ 加入房间完成");
}

/*
====================================
发送消息
====================================
*/

function sendMessage() {

    const input = document.getElementById("msg");

    const text = input.value;

    if (!text) return;

    PEER.broadcast(text);

    log("📤 me: " + text);

    input.value = "";
}

/*
====================================
日志系统
====================================
*/

function log(msg) {

    const el = document.getElementById("log");

    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;

    console.log(line);

    el.innerHTML += line + "\n";

    el.scrollTop = el.scrollHeight;
}

/*
====================================
启动心跳
====================================
*/

setInterval(() => {

    if (ROOM && STATE) {
        SIGNAL.updateHeartbeat();
    }

}, 30000);

/*
====================================
启动GC（轻量）
====================================
*/

setInterval(async () => {

    if (!ROOM) return;

    const files = await listGistFiles(ROOM.gistId);

    if (SIGNAL.gc) {
        SIGNAL.gc(files);
    }

}, 10000);

/*
====================================
自动发现入口
====================================
*/

setInterval(async () => {

    if (!ROOM) return;

    const files = await listGistFiles(ROOM.gistId);

    // room layer驱动发现
    if (ROOM_CTRL?.detectMesh) {
        await ROOM_CTRL.detectMesh(files);
    }

}, 5000);

/*
====================================
启动应用
====================================
*/

window.onload = initApp;