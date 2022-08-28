var socket = io()
var roomID = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var results;
var cache = {}
/**@typedef {hi:string} */
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
    if(session.currentlyPlaying && (!session.state.paused)) {
        var today = new Date()
        console.log(today.getTime(), session.state.startTime*-1, session.currentlyPlaying.time*1000, session.state.remainingTime*-1)
        var time = today.getTime() - session.state.startTime + session.currentlyPlaying.time*1000 - session.state.remainingTime
        console.log(time);
    }
})

socket.on('songResults', song => {
    results = JSON.parse(song);
    console.log(results)
})  

