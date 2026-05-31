
let GIST = null;
let pc = null;
let dc = null;
let CLIENT = "peer_" + Math.random().toString(36).slice(2);

/* =======================
日志
======================= */
function log(msg){
    const el = document.getElementById("log");
    el.innerHTML += msg + "\n";
    el.scrollTop = el.scrollHeight;
}

/* =======================
Headers
======================= */
function headers(){
    return {
        "Authorization":"token " + document.getElementById("token").value,
        "Accept":"application/vnd.github+json"
    };
}

/* =======================
创建 Gist（关键）
======================= */
async function createGist(){

    const res = await fetch("https://api.github.com/gists", {
        method:"POST",
        headers:headers(),
        body:JSON.stringify({
            public:true,
            files:{
                "signal.json":{
                    content:"{}"
                }
            }
        })
    });

    const data = await res.json();

    GIST = data.id;

    localStorage.setItem("gist", GIST);

    log("Gist创建成功: " + GIST);

    return GIST;
}

/* =======================
更新Gist
======================= */
async function updateGist(files){

    await fetch(
        `https://api.github.com/gists/${GIST}`,
        {
            method:"PATCH",
            headers:headers(),
            body:JSON.stringify({ files })
        }
    );
}

/* =======================
Peer
======================= */
function createPC(isOfferer){

    pc = new RTCPeerConnection({
        iceServers:[{urls:"stun:stun.l.google.com:19302"}]
    });

    pc.onicecandidate = e=>{
        if(e.candidate){
            sendSignal({
                type:"ice",
                from:CLIENT,
                candidate:e.candidate
            });
        }
    };

    pc.ondatachannel = e=>{
        dc = e.channel;
        setupDC();
    };

    if(isOfferer){
        dc = pc.createDataChannel("chat");
        setupDC();
    }
}

/* =======================
DataChannel
======================= */
function setupDC(){

    dc.onopen=()=>log("DC open");

    dc.onmessage=e=>{
        log("对方: "+e.data);
    };
}

/* =======================
信令发送
======================= */
async function sendSignal(obj){

    obj.time = Date.now();

    await updateGist({
        ["signal_"+Date.now()]:{
            content:JSON.stringify(obj)
        }
    });
}

/* =======================
轮询
======================= */
function poll(){

    setInterval(async()=>{

        const res = await fetch(
            `https://api.github.com/gists/${GIST}`,
            {headers:headers()}
        );

        const gist = await res.json();

        const files = gist.files;

        for(let k in files){

            if(!k.startsWith("signal_")) continue;

            const msg = JSON.parse(files[k].content);

            if(msg.from === CLIENT) continue;

            if(msg.type==="offer"){
                log("收到offer");

                createPC(false);

                await pc.setRemoteDescription(msg.offer);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                sendSignal({
                    type:"answer",
                    from:CLIENT,
                    answer
                });
            }

            if(msg.type==="answer"){
                log("收到answer");
                await pc.setRemoteDescription(msg.answer);
            }

            if(msg.type==="ice"){
                try{
                    await pc.addIceCandidate(msg.candidate);
                }catch(e){}
            }
        }

    },3000);
}

/* =======================
创建房间
======================= */
async function createRoom(){

    await createGist();

    createPC(true);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendSignal({
        type:"offer",
        from:CLIENT,
        offer
    });

    poll();

    log("创建房间完成");
}

/* =======================
加入房间
======================= */
function joinRoom(){

    GIST = document.getElementById("gistId").value;

    localStorage.setItem("gist", GIST);

    createPC(false);

    poll();

    log("加入房间: " + GIST);
}

/* =======================
发送消息
======================= */
function sendMsg(){

    const msg = document.getElementById("msg").value;

    if(dc && dc.readyState==="open"){
        dc.send(msg);
        log("我: "+msg);
    }
}

/* =======================
清空
======================= */
function clearLog(){
    document.getElementById("log").innerHTML="";
}