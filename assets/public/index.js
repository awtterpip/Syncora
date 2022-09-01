var socket = io()
var roomID = window.location.href.substr(window.location.href.lastIndexOf('/') + 1);
var results;
var cache = {}
var session
var sound
var timePercent;
var isSearching = false;
var source
var context = new AudioContext()
const removeSearchResults = () => document.querySelectorAll('.search-result').forEach(el => el.remove());

document.getElementById('search').addEventListener('keydown', ev => {
    if(!isSearching) {
        search(document.getElementById('search').value)
    }
})

if (roomID) {
    socket.emit('join', roomID);
}

socket.on('song', async function (id, song) {
    let arr = new Uint8Array([])
    let buf = await fetch(`/room/${roomID}/song/${id}`).then(res => {
        const reader = res.body.getReader()
        return new ReadableStream({
            start(controller) {
                // The following function handles each data chunk
                function push() {
                    // "done" is a Boolean and value a "Uint8Array"
                    reader.read().then(async ({ done, value }) => {
                        // If there is no more data to read
                        if (done) {
                            console.log('done', done);

                            cache[id] = await context.decodeAudioData(arr.buffer);
                            console.log(cache[id])
                            return arr;
                        }
                        // Get the data and send it to the browser via the controller
                        controller.enqueue(value);
                        // Check chunks by logging to the console

                        let newArr = new Uint8Array(arr.length + value.length)
                        newArr.set(arr)
                        newArr.set(value, arr.length);
                        arr = newArr
                        console.log(arr)
                        push();
                    });
                }
                push();
            },
        })

    })
    var link = URL.createObjectURL(new Blob([buf]))
    cache[id] = new Audio(`/room/${roomID}/song/${id}`)
})

socket.on('update', async function (_session) {
    console.log(JSON.parse(_session))

    session = JSON.parse(_session)
    document.getElementById('queue').innerHTML = session.queue.map(val => val.name)
    if (session.currentlyPlaying && (!session.state.paused)) {
        var today = new Date()
        console.log(today.getTime(), session.state.startTime * -1, session.currentlyPlaying.time * 1000, session.state.remainingTime * -1)
        let time = today.getTime() - session.state.startTime + session.currentlyPlaying.time * 1000 - session.state.remainingTime
        source = context.createBufferSource()
        source.buffer = cache[session.currentlyPlaying.id]
        source.connect(context.destination)
        console.log(time/1000)
        source.start(0, time / 1000)
    }
    if (session.currentlyPlaying && (session.state.paused)) {
        source.stop()
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


function search(query) {
    isSearching=true
    socket.emit('searchSong', query);
    socket.on('searchResults', results => {
        document.querySelectorAll('.search-result').forEach(el => el.remove());
        for (let i = 0; i < 6; i++) {
            let dom = document.createElement('div');
            let title = dom.appendChild(document.createElement('span'))
            let artist = dom.appendChild(document.createElement('span'))

            
            title.className = 'search-result-text'
            artist.className = 'search-result-text'

            title.innerText = results[i].title
            artist.innerText = results[i].channel.name

            dom.className = 'search-result panel';
            document.querySelector('.search-container').appendChild(dom)
            dom.addEventListener('click', e => {
                addSong(results[i].link)
                removeSearchResults()
            })
            isSearching=false
        }
    })
}

function addSong(link) {
    socket.emit('getSongs', ['yt:' + link])
    socket.on('songResults', songs => {
        results = JSON.parse(songs);
        console.log(results)
        socket.emit('updateQueue', session.queue.concat(results))
    })
}

setInterval(() => {
    if (session.currentlyPlaying) {
        if(!session.state.paused) {
            timePercent = Math.round(((new Date()).getTime() - session.state.startTime + session.currentlyPlaying.time * 1000 - session.state.remainingTime) / session.currentlyPlaying.time)
        }
        document.getElementById('time-slider').value = timePercent
    } else {
        document.getElementById('time-slider').value = 0;
    }
}, 100)