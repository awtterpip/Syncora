var socket = io()
var roomID = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var results;
var cache = {}
var session
if (roomID) {
    socket.emit('join', roomID);
}

socket.on('song', async function(id, song) {
    var audio = new Audio(URL.createObjectURL(new Blob([song.buffer], {type:song.mime})))
    cache[id] = audio
    console.log(cache)
})

socket.on('update', async function (_session) {
    console.log(JSON.parse(_session))
    session = JSON.parse(_session)
})

socket.on('songResults', song => {
    results = JSON.parse(song);
    console.log(results)
})  

