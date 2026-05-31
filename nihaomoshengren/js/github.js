/*
====================================
github.js
GitHub API封装
====================================
*/

/*
====================================
日志
====================================
*/

function log(
    message,
    type = "info"
){

    console.log(message);

    const box =
        document.getElementById(
            "logBox"
        );

    if(!box)
        return;

    const div =
        document.createElement(
            "div"
        );

    div.className =
        "log-" + type;

    div.textContent =
        "[" +

        new Date()
        .toLocaleTimeString()

        +

        "] "

        +

        message;

    box.appendChild(div);

    box.scrollTop =
        box.scrollHeight;
}

/*
====================================
Token
====================================
*/

function saveToken(){

    const token =
        document.getElementById(
            "token"
        ).value.trim();

    localStorage.setItem(

        GITHUB.TOKEN_KEY,

        token
    );

    log(
        "Token已保存",
        "success"
    );
}

function loadToken(){

    const token =
        localStorage.getItem(
            GITHUB.TOKEN_KEY
        );

    if(token){

        document.getElementById(
            "token"
        ).value = token;

        log(
            "Token已加载",
            "success"
        );
    }
}

function clearToken(){

    localStorage.removeItem(
        GITHUB.TOKEN_KEY
    );

    document.getElementById(
        "token"
    ).value = "";

    log(
        "Token已清除",
        "warning"
    );
}

function getToken(){

    return document
        .getElementById(
            "token"
        )
        .value
        .trim();
}

/*
====================================
Headers
====================================
*/

function githubHeaders(){

    const token =
        getToken();

    return {

        "Authorization":
            "token " + token,

        "Accept":
            "application/vnd.github+json",

        "Content-Type":
            "application/json"
    };
}

/*
====================================
GitHub请求
====================================
*/

async function githubRequest(

    url,

    method = "GET",

    body = null

){

    try{

        const options = {

            method,

            headers:
                githubHeaders()
        };

        if(body){

            options.body =
                JSON.stringify(
                    body
                );
        }

        const response =
            await fetch(
                url,
                options
            );

        /*
        限流信息
        */

        const remain =

            response.headers.get(

                "X-RateLimit-Remaining"

            );

        if(remain !== null){

            log(

                "GitHub剩余请求: "

                +

                remain

            );
        }

        /*
        错误
        */

        if(!response.ok){

            let txt = "";

            try{

                txt =
                    await response.text();

            }catch(e){}

            throw new Error(

                response.status

                +

                " "

                +

                txt
            );
        }

        /*
        DELETE无返回
        */

        if(
            method === "DELETE"
        ){

            return true;
        }

        /*
        空响应
        */

        const text =
            await response.text();

        if(!text){

            return {};
        }

        return JSON.parse(
            text
        );

    }catch(err){

        log(

            "GitHub错误: "

            +

            err.message,

            "error"

        );

        throw err;
    }
}

/*
====================================
创建Gist
====================================
*/

async function createGist(

    description,

    files,

    isPublic = false

){

    const body = {

        description,

        public:isPublic,

        files
    };

    const result =

        await githubRequest(

            GITHUB.GIST_API,

            "POST",

            body

        );

    log(

        "创建Gist成功: "

        +

        result.id,

        "success"

    );

    return result;
}

/*
====================================
读取Gist
====================================
*/

async function getGist(

    gistId

){

    return await githubRequest(

        GITHUB.GIST_API

        +

        "/"

        +

        gistId

    );
}

/*
====================================
更新Gist
====================================
*/

async function updateGist(

    gistId,

    files

){

    return await githubRequest(

        GITHUB.GIST_API

        +

        "/"

        +

        gistId,

        "PATCH",

        {
            files
        }

    );
}

/*
====================================
删除Gist
====================================
*/

async function deleteGist(

    gistId

){

    await githubRequest(

        GITHUB.GIST_API

        +

        "/"

        +

        gistId,

        "DELETE"

    );

    log(

        "删除Gist成功",

        "success"

    );
}

/*
====================================
读取文件内容
====================================
*/

function gistFileContent(

    gist,

    filename

){

    if(
        !gist.files
    ){
        return null;
    }

    if(
        !gist.files[
            filename
        ]
    ){
        return null;
    }

    return gist.files[
        filename
    ].content;
}

/*
====================================
读取JSON文件
====================================
*/

function gistJson(

    gist,

    filename

){

    const content =

        gistFileContent(

            gist,

            filename

        );

    if(!content){

        return null;
    }

    try{

        return JSON.parse(
            content
        );

    }catch(err){

        log(

            "JSON解析失败",

            "error"

        );

        return null;
    }
}

/*
====================================
写JSON文件
====================================
*/

function jsonFile(

    obj

){

    return {

        content:

        JSON.stringify(

            obj,

            null,

            2

        )
    };
}

/*
====================================
生成房间文件
====================================
*/

function createRoomFile(

    roomData

){

    return {

        "room.json":

            jsonFile(
                roomData
            )
    };
}

/*
====================================
生成信令文件
====================================
*/

function createSignalFile(){

    return {

        "signals.json":

            jsonFile([])
    };
}

/*
====================================
检查Token
====================================
*/

async function verifyToken(){

    try{

        const result =

            await githubRequest(

                GITHUB.API

                +

                "/user"

            );

        log(

            "登录成功: "

            +

            result.login,

            "success"

        );

        return true;

    }catch(err){

        log(

            "Token无效",

            "error"

        );

        return false;
    }
}