document.getElementById("btnCreate").onclick = () => {
    SIGNAL.createRoom(document.getElementById("gistId").value);
};

document.getElementById("btnJoin").onclick = () => {
    SIGNAL.joinRoom(document.getElementById("gistId").value);
};

document.getElementById("btnSend").onclick = () => {
    SIGNAL.send(document.getElementById("msg").value);
};

document.getElementById("btnClear").onclick = () => {
    document.getElementById("log").innerHTML = "";
};