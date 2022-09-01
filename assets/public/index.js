var socket = io()
var roomID = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var results;
var cache = {}
/**@typedef {hi:string} */
var session
var sound
var queueUpdate = false
var joined = false
document.body.addEventListener('click', join)
function join() {
    if (roomID && !joined) {
        console.log(roomID)
        socket.emit('join', roomID);
        joined = true;
    }
}
socket.on('song', async function (id, song) {
    var audio = new Audio(URL.createObjectURL(new Blob([song.buffer], { type: song.mime })))
    cache[id] = audio
    console.log(id)
})


socket.on('update', async function (_session) {
    console.log(JSON.parse(_session))
    
    session = JSON.parse(_session)
    document.getElementById('queue').innerHTML = session.queue.map(val => val.name)
    if (session.currentlyPlaying && (!session.state.paused)) {
        console.log(cache)
        if(cache[session.currentlyPlaying.id]) {
            var today = new Date()
            console.log(today.getTime(), session.state.startTime * -1, session.currentlyPlaying.time * 1000, session.state.remainingTime * -1)
            var time = today.getTime() - session.state.startTime + session.currentlyPlaying.time * 1000 - session.state.remainingTime
            sound = cache[session.currentlyPlaying.id]
            console.log(time)
            sound.currentTime = time / 1000
            sound.play()
        } else {
            queueUpdate = true;
        }
    }
    if (session.currentlyPlaying && (session.state.paused)) {
        sound.pause()
    }
})

function getSongs(arr) {
    socket.emit('getSongs', arr);
    socket.on('songResults', songs => {
        results = JSON.parse(songs)
        console.log(results)
        socket.emit('updateQueue', results)
    })
}

function nextSong() {
    if (cache[session.queue[0].id]) {
        socket.emit('next')
    } else {
        console.log('please wait for songs to be cached...')
    }
}

function prevSong() {
    if (cache[session.songHistory[0].id]) {
        socket.emit('prev')
    } else {
        console.log('please wait for songs to be cached...')
    }
}

function playButton() {
    if (session.state.paused) {
        socket.emit('play')
    } else if (!session.state.paused) {
        socket.emit('pause')
    }
}

socket.on('songResults', songs => {
    results = JSON.parse(songs);
    console.log(results)
    socket.emit('updateQueue', session.queue.concat(results))
})
socket.on('search', response => {
    console.log(response)
    socket.emit('getSongs', ['yt:' + response])
})
function addSong() {
    let query = document.getElementById('search').value
    console.log(query)
    socket.emit('searchSong', query);
    
}
