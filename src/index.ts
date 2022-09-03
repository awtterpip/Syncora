import compression from 'compression';
import express from "express";
import { createServer } from "http";
import LastFM from 'last-fm';
import { youtube } from 'scrape-youtube';
import { Server } from 'socket.io';
import util from 'util';
import ytdl from 'ytdl-core';
import { apiKeys, generateID, getSongFromLink } from "./utils";

const app = express();
const server = createServer(app);
const io = new Server(server);
const lastfm = new LastFM(apiKeys.LastFM)
const trackInfo = util.promisify(lastfm.trackInfo)
const exec = util.promisify(require('child_process').exec)
let sessions: Sessions = {}
let cache = {}


io.of('/').adapter.on('leave-room', (room, id) => {
    if (room != id) {
        if (sessions[room]?.state?.timer) {
            clearTimeout(sessions[room].state.timer)
        }
        sessions[room] = undefined;
    }
})

io.on('connection', async (socket) => {
    var roomID: string;
    /**
     * Join room
     * @param id ID of the room to join
     */

    async function ok(link) {
        let info = await ytdl.getInfo(link)
        io.to(roomID).emit('update', JSON.stringify(info))
    }

    async function searchSong(search) {
        let results = await youtube.search(search, { type: 'video' });
        io.to(socket.id).emit('searchResults', results.videos)
    }

    async function cacheSongs() {
        return new Promise((resolve, reject) => {
            if (cache[roomID]) {
                var i = 0;
                const session = sessions[roomID]
                for (const song in cache[roomID]) {
                    if (!(session.queue[0]?.id == song || session.currentlyPlaying?.id == song || session.songHistory[0]?.id == song || session.songHistory[1]?.id == song)) {
                        cache[roomID][song] = undefined
                    }
                }
                if (session?.currentlyPlaying?.id) {
                    createCache(session.currentlyPlaying)
                } else {
                    i++
                }
                if (session?.queue[0]?.id) {
                    createCache(session.queue[0])
                } else {
                    i++
                }
                if (session?.songHistory[0]?.id) {
                    createCache(session.songHistory[0])
                } else {
                    i++
                    if(i==3) {
                        resolve('yay')
                    }
                }
                async function createCache(song: Song) {
                    if (!cache[roomID][song.id]) {
                        let info = await ytdl.getInfo(song.url);
                        let format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
                        let vid = await ytdl(song.url, { format: format });
                        let curid = song.id;
                        cache[roomID][curid] = { buffer: Buffer.from([]), mime: format.mimeType }
                        vid.on("data", chunk => {
                            cache[roomID][curid].buffer = Buffer.concat([cache[roomID][curid].buffer, chunk])
                        });
                        vid.on('end', () => {
                            io.to(roomID).emit('song', curid)
                            i++
                            if(i==3) {
                                resolve('yay')
                            }
                            
                        });
                    } else {
                        io.to(roomID).emit('song', song.id)
                        i++
                        if(i==3) {
                            resolve('yay')
                        }
                    }
                }
            }
        })

    }


    async function join(id: string) {
        if (/^[a-zA-Z0-9]+$/.test(id)) {
            if (socket.rooms.size > 1) {
                socket.leave([...socket.rooms][1])
            }
            roomID = id;
            socket.join(id);
            if (!sessions[roomID]) {
                sessions[roomID] = {
                    queue: [],
                    currentlyPlaying: null,
                    songHistory: [],
                    state: {
                        paused: true,
                        timer: undefined,
                        remainingTime: undefined,
                        startTime: undefined,
                    }
                }
            }
            if (!cache[roomID]) {
                cache[roomID] = {}
            }
            io.to(socket.id).emit('join')
            await cacheSongs()
            io.to(socket.id).emit('update', JSON.stringify(sessions[id]));
        } else {
            io.to(socket.id).emit('error', "roomID can only contain alphanumeric characters");
        }
    }

    async function seek(timeRemain) {
        if (roomID && typeof timeRemain == 'number') {
            let paused = sessions[roomID].state.paused;
            pause()
            sessions[roomID].state.remainingTime = timeRemain;
            if (!paused) play()
        }
    }

    async function getSongs(links: string[]) {
        if (Array.isArray(links) && roomID) {
            var songs: Song[] = []
            for (let i = 0; i < links.length; i++) {
                songs[i] = await getSongFromLink(links[i])
            }
            io.to(socket.id).emit('songResults', JSON.stringify(songs))
        }
    }


    function updateQueue(queue: Song[]) {
        if (roomID && Array.isArray(queue)) {
            sessions[roomID].queue = queue
            cacheSongs()
            io.to(roomID).emit('update', JSON.stringify(sessions[roomID]))
        }
    }
    function pause() {
        console.log(`recived pause from ${roomID} state of room is ${sessions[roomID].state.paused ? "paused": "playing"}`)
        if ((!sessions[roomID]?.state?.paused) && roomID) {
            if (sessions[roomID].currentlyPlaying) {
                clearTimeout(sessions[roomID].state.timer);
                sessions[roomID].state.remainingTime -= (new Date()).getTime() - sessions[roomID].state.startTime
                sessions[roomID].state.timer = undefined;
                sessions[roomID].state.paused = true;
                io.to(roomID).emit('update', JSON.stringify(sessions[roomID]))
            }
        }
    }
    async function nextSong() {
        console.log(roomID)
        if (sessions[roomID]) {
            pause()
            if (sessions[roomID].currentlyPlaying) {
                sessions[roomID].songHistory.unshift(sessions[roomID].currentlyPlaying)
            }
            if (sessions[roomID].queue.length > 0) {
                sessions[roomID].currentlyPlaying = sessions[roomID].queue.shift()
                if (sessions[roomID].state.timer) {
                    clearTimeout(sessions[roomID].state.timer);
                }
                sessions[roomID].state = {
                    timer: undefined,
                    paused: sessions[roomID].state.paused,
                    startTime: undefined,
                    remainingTime: sessions[roomID].currentlyPlaying.time * 1000
                }
            } else {
                sessions[roomID].currentlyPlaying = undefined
            }
            cacheSongs()
            play()
        }
    }

    function prevSong() {
        if (sessions[roomID]) {
            if (sessions[roomID].currentlyPlaying) {
                sessions[roomID].queue.unshift(sessions[roomID].currentlyPlaying)
            }
            if (sessions[roomID].songHistory.length > 0) {
                sessions[roomID].currentlyPlaying = sessions[roomID].songHistory.shift()
                if (sessions[roomID].state.timer) {
                    clearTimeout(sessions[roomID].state.timer);
                }
                sessions[roomID].state = {
                    timer: undefined,
                    paused: true,
                    startTime: undefined,
                    remainingTime: sessions[roomID].currentlyPlaying.time * 1000
                }
            }
            play()
            cacheSongs()
        }
    }

    function play() {
        console.log(`recived play from ${roomID} state of room is ${sessions[roomID].state.paused ? "paused": "playing"}`)
        if (sessions[roomID]?.state?.paused && roomID) {
            console.log(`${roomID} is paused`)
            if (sessions[roomID].currentlyPlaying) {
                console.log(`${roomID} has something playing`)

                sessions[roomID].state.timer = Number(setTimeout(nextSong, sessions[roomID].state.remainingTime));
                sessions[roomID].state.startTime = (new Date()).getTime()
                sessions[roomID].state.paused = false;
                io.to(roomID).emit('update', JSON.stringify(sessions[roomID]))
            }
        }
    }

    socket.on('rejoin', () => io.to(socket.id).emit('join'))
    socket.on('getUpdate', () => io.to(socket.id).emit('update', JSON.stringify(sessions[roomID])))
    socket.on('searchSong', searchSong)
    socket.on('ready', () => console.log('ready'))
    socket.on('pause', pause)
    socket.on('play', play)
    socket.on('updateQueue', updateQueue)
    socket.on('next', nextSong)
    socket.on('prev', prevSong)
    socket.on('join', join)
    socket.on('getSongs', getSongs)
    socket.on('ok', ok)
});

app.use(compression())

server.listen(3000, () => {
    (console.log('listening on port 3000'));
});

app.get('/', (req, res) => {
    res.redirect(`room/${generateID(6, sessions)}`)
})

app.get('/room/:id', (req, res) => {
    res.sendFile(process.cwd() + '/assets/index.html')
})

app.get('/room/:id/song/:songid', function (req, res) {
    if (cache[req.params.id]) {
        res.send(cache[req.params.id][req.params.songid].buffer)
    }
})

app.use(express.static('assets/public'))
