/*
====================================
WebRTC Mesh V2
配置文件
config.js
====================================
*/

/*
====================================
版本
====================================
*/

const APP_CONFIG = {

    VERSION:
        "2.0.0",

    APP_NAME:
        "WebRTC Mesh V2"
};

/*
====================================
GitHub
====================================
*/

const GITHUB = {

    API:
        "https://api.github.com",

    GIST_API:
        "https://api.github.com/gists",

    TOKEN_KEY:
        "github_token"
};

/*
====================================
WebRTC
====================================
*/

const RTC_CONFIG = {

    iceServers:[

        {
            urls:
            "stun:stun.l.google.com:19302"
        },

        {
            urls:
            "stun:stun1.l.google.com:19302"
        },

        {
            urls:
            "stun:stun2.l.google.com:19302"
        }

    ]
};

/*
====================================
轮询
====================================
*/

const POLL_CONFIG = {

    SIGNAL_INTERVAL:
        3000,

    ROOM_INTERVAL:
        5000,

    DISCOVERY_INTERVAL:
        15000
};

/*
====================================
心跳
====================================
*/

const HEARTBEAT = {

    INTERVAL:
        30000,

    TIMEOUT:
        90000
};

/*
====================================
Mesh
====================================
*/

const MESH = {

    MAX_PEERS:
        16,

    AUTO_CONNECT:
        true,

    AUTO_RECONNECT:
        true
};

/*
====================================
房间
====================================
*/

const ROOM = {

    PREFIX:
        "mesh-room",

    SIGNAL_PREFIX:
        "mesh-signal",

    EXPIRE_TIME:
        24 * 60 * 60 * 1000
};

/*
====================================
二维码
====================================
*/

const QR_CONFIG = {

    WIDTH:
        256,

    MARGIN:
        2
};

/*
====================================
消息
====================================
*/

const MESSAGE_TYPE = {

    CHAT:
        "chat",

    SYSTEM:
        "system",

    HEARTBEAT:
        "heartbeat",

    FILE:
        "file"
};

/*
====================================
信令
====================================
*/

const SIGNAL_TYPE = {

    OFFER:
        "offer",

    ANSWER:
        "answer",

    ICE:
        "ice",

    JOIN:
        "join",

    LEAVE:
        "leave",

    HEARTBEAT:
        "heartbeat"
};

/*
====================================
Peer状态
====================================
*/

const PEER_STATE = {

    NEW:
        "new",

    CONNECTING:
        "connecting",

    CONNECTED:
        "connected",

    DISCONNECTED:
        "disconnected",

    FAILED:
        "failed"
};

/*
====================================
Perfect Negotiation
====================================
*/

const NEGOTIATION = {

    POLITE_DEFAULT:
        true
};

/*
====================================
运行时状态
====================================
*/

const STATE = {

    /*
    当前客户端
    */

    clientId:
        null,

    /*
    当前房间
    */

    roomId:
        null,

    /*
    当前Room Gist
    */

    roomGistId:
        null,

    /*
    Discovery Gist
    */

    discoveryGistId:
        null,

    /*
    房主
    */

    ownerId:
        null,

    /*
    是否房主
    */

    isOwner:
        false,

    /*
    是否已加入
    */

    joined:
        false
};

/*
====================================
Peer容器
====================================
*/

const PEERS =
    new Map();

/*
====================================
DataChannel容器
====================================
*/

const CHANNELS =
    new Map();

/*
====================================
Peer信息
====================================
*/

const PEER_INFO =
    new Map();

/*
====================================
已处理信令
====================================
*/

const PROCESSED_SIGNALS =
    new Set();

/*
====================================
缓存ICE
====================================
*/

const PENDING_ICE =
    new Map();

/*
====================================
Perfect Negotiation
====================================
*/

const NEGOTIATION_STATE =
    new Map();

/*
====================================
定时器
====================================
*/

const TIMERS = {

    signalPoll:
        null,

    roomPoll:
        null,

    heartbeat:
        null,

    discovery:
        null
};

/*
====================================
生成随机ID
====================================
*/

function randomId(){

    return (

        Math.random()
        .toString(36)
        .substring(2)

        +

        Date.now()
        .toString(36)

    );
}

/*
====================================
生成客户端ID
====================================
*/

function generateClientId(){

    return (

        "peer_"

        +

        randomId()

    );
}

/*
====================================
启动时生成ID
====================================
*/

STATE.clientId =
    generateClientId();

/*
====================================
控制台输出
====================================
*/

console.log(

    APP_CONFIG.APP_NAME,

    APP_CONFIG.VERSION,

    STATE.clientId

);