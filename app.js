// =========================
// 配置
// =========================

const OWNER = "mengdaodaomeng"
const REPO = "mengdaodaomeng.github.io"
const ISSUE_NUMBER = 50

const SIGNAL_API = `https://api.github.com/repos/${OWNER}/${REPO}/issues/${ISSUE_NUMBER}/comments`

const STUN = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
}

const TIMEOUT = 60000

// =========================
// 全局变量
// =========================

const myId = "user-" + Math.random().toString(36).substring(2, 8)

const peers = {}
const channels = {}
const lastActive = {}
const processed = new Set()

let polling = false

// =========================
// 初始化
// =========================

document.getElementById("myId").innerText = myId

const saved = localStorage.getItem("github_token")

if (saved) {
    document.getElementById("token").value = saved
}

// =========================
// 保存 Token
// =========================

function saveToken() {

    const token = document.getElementById("token").value

    localStorage.setItem("github_token", token)

    alert("Token 已保存")
}

// =========================
// 日志
// =========================

function log(text) {

    const chat = document.getElementById("chat")

    const div = document.createElement("div")

    div.className = "msg"

    div.innerText = text

    chat.appendChild(div)

    chat.scrollTop = chat.scrollHeight
}

// =========================
// 更新在线列表
// =========================

function updateUsers() {

    const users = document.getElementById("users")

    users.innerHTML = ""

    let count = 1

    const me = document.createElement("div")

    me.className = "user"

    me.innerText = myId + " (我)"

    users.appendChild(me)

    for (const id in channels) {

        const div = document.createElement("div")

        div.className = "user"

        div.innerText = id

        users.appendChild(div)

        count++
    }

    document.getElementById("onlineCount").innerText = count
}

// =========================
// GitHub API
// =========================

async function sendSignal(data) {

    const token = localStorage.getItem("github_token")

    const res = await fetch(SIGNAL_API, {
        method: "POST",
        headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({
            body: JSON.stringify(data)
        })
    })

    if (!res.ok) {
        console.error("发送失败")
    }
}

// =========================
// 删除评论
// =========================

async function deleteComment(id) {

    const token = localStorage.getItem("github_token")

    await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/issues/comments/${id}`,
        {
            method: "DELETE",
            headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github+json"
            }
        }
    )
}

// =========================
// 加入聊天室
// =========================

async function connectRoom() {

    if (polling) {
        return
    }

    polling = true

    log("正在加入聊天室...")

    await sendSignal({
        type: "join",
        from: myId
    })

    startPolling()

    startHeartbeat()

    startTimeoutCheck()

    updateUsers()
}

// =========================
// 创建 Peer
// =========================

async function createPeer(userId, initiator = false) {

    if (peers[userId]) {
        return peers[userId]
    }

    const pc = new RTCPeerConnection(STUN)

    peers[userId] = pc

    pc.onicecandidate = async (event) => {

        if (event.candidate) {

            await sendSignal({
                type: "candidate",
                from: myId,
                to: userId,
                candidate: event.candidate
            })
        }
    }

    pc.onconnectionstatechange = () => {

        if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected" ||
            pc.connectionState === "closed"
        ) {
            removePeer(userId)
        }
    }

    if (initiator) {

        const channel = pc.createDataChannel("chat")

        setupChannel(userId, channel)

        const offer = await pc.createOffer()

        await pc.setLocalDescription(offer)

        await sendSignal({
            type: "offer",
            from: myId,
            to: userId,
            sdp: offer
        })

    } else {

        pc.ondatachannel = (event) => {
            setupChannel(userId, event.channel)
        }
    }

    return pc
}

// =========================
// 设置 Channel
// =========================

function setupChannel(userId, channel) {

    channels[userId] = channel

    lastActive[userId] = Date.now()

    channel.onopen = () => {

        log(userId + " 已连接")

        updateUsers()
    }

    channel.onmessage = (event) => {

        lastActive[userId] = Date.now()

        const data = JSON.parse(event.data)

        if (data.type === "chat") {
            log(data.from + "：" + data.text)
        }

        if (data.type === "heartbeat") {
            lastActive[userId] = Date.now()
        }
    }

    channel.onclose = () => {
        removePeer(userId)
    }

    channel.onerror = () => {
        removePeer(userId)
    }
}

// =========================
// 发送聊天
// =========================

function sendChat() {

    const input = document.getElementById("msg")

    const text = input.value.trim()

    if (!text) {
        return
    }

    const data = JSON.stringify({
        type: "chat",
        from: myId,
        text: text
    })

    for (const id in channels) {

        const ch = channels[id]

        if (ch.readyState === "open") {
            ch.send(data)
        }
    }

    log("我：" + text)

    input.value = ""
}

// =========================
// 轮询 GitHub
// =========================

async function startPolling() {

    setInterval(async () => {

        try {

            const token = localStorage.getItem("github_token")

            const res = await fetch(SIGNAL_API, {
                headers: {
                    Authorization: `token ${token}`,
                    Accept: "application/vnd.github+json"
                }
            })

            const comments = await res.json()

            for (const c of comments) {

                if (processed.has(c.id)) {
                    continue
                }

                processed.add(c.id)

                let data

                try {
                    data = JSON.parse(c.body)
                } catch {
                    continue
                }

                if (data.from === myId) {
                    continue
                }

                if (data.to && data.to !== myId) {
                    continue
                }

                await handleSignal(data)

                deleteComment(c.id)
            }

        } catch (e) {
            console.error(e)
        }

    }, 3000)
}

// =========================
// 处理信令
// =========================

async function handleSignal(data) {

    const from = data.from

    switch (data.type) {

        case "join":

            log(from + " 加入聊天室")

            const pc1 = await createPeer(from, true)

            break

        case "offer":

            const pc2 = await createPeer(from, false)

            await pc2.setRemoteDescription(
                new RTCSessionDescription(data.sdp)
            )

            const answer = await pc2.createAnswer()

            await pc2.setLocalDescription(answer)

            await sendSignal({
                type: "answer",
                from: myId,
                to: from,
                sdp: answer
            })

            break

        case "answer":

            if (peers[from]) {

                await peers[from].setRemoteDescription(
                    new RTCSessionDescription(data.sdp)
                )
            }

            break

        case "candidate":

            if (peers[from]) {

                try {

                    await peers[from].addIceCandidate(
                        new RTCIceCandidate(data.candidate)
                    )

                } catch (e) {}
            }

            break

        case "leave":

            removePeer(from)

            break
    }
}

// =========================
// 移除 Peer
// =========================

function removePeer(userId) {

    try {

        if (channels[userId]) {
            channels[userId].close()
        }

    } catch {}

    try {

        if (peers[userId]) {
            peers[userId].close()
        }

    } catch {}

    delete peers[userId]
    delete channels[userId]
    delete lastActive[userId]

    updateUsers()

    log(userId + " 已断开")
}

// =========================
// 断开所有连接
// =========================

async function disconnectAll() {

    for (const id in peers) {
        removePeer(id)
    }

    await sendSignal({
        type: "leave",
        from: myId
    })

    log("已断开所有连接")
}

// =========================
// 心跳保活
// =========================

function startHeartbeat() {

    setInterval(() => {

        const data = JSON.stringify({
            type: "heartbeat",
            from: myId
        })

        for (const id in channels) {

            const ch = channels[id]

            if (ch.readyState === "open") {
                ch.send(data)
            }
        }

    }, 20000)
}

// =========================
// 超时检测
// =========================

function startTimeoutCheck() {

    setInterval(() => {

        const now = Date.now()

        for (const id in lastActive) {

            const diff = now - lastActive[id]

            if (diff > TIMEOUT) {

                log(id + " 超时断开")

                removePeer(id)
            }
        }

    }, 5000)
}

// =========================
// Enter发送
// =========================

document.getElementById("msg")
.addEventListener("keydown", (e) => {

    if (e.key === "Enter") {
        sendChat()
    }
})
