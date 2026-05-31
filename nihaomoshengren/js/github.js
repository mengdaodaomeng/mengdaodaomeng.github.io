function token() {
    return localStorage.getItem("github_token");
}

function headers() {
    return {
        "Authorization": "token " + token(),
        "Accept": "application/vnd.github+json"
    };
}

function jsonFile(obj) {
    return { content: JSON.stringify(obj) };
}

async function updateGist(gistId, files) {

    const res = await fetch(
        `https://api.github.com/gists/${gistId}`,
        {
            method: "PATCH",
            headers: headers(),
            body: JSON.stringify({ files })
        }
    );

    return await res.json();
}

async function getGist(gistId) {

    const res = await fetch(
        `https://api.github.com/gists/${gistId}`,
        { headers: headers() }
    );

    return await res.json();
}