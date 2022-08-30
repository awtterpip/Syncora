import express from "express";
import { createServer } from "https"
import { Server } from 'socket.io'
import ytdl from 'ytdl-core'
import LastFM = require('last-fm')
import util = require('util')
import * as fs from 'fs'
import fetch from "node-fetch";
import { apiKeys, getSongFromLink, generateID, stream2buffer } from './utils'

const options = {
    key: fs.readFileSync('/home/zach/localhost-key.pem'),
    cert: fs.readFileSync('/home/zach/localhost.pem')
};
const app = express();
const server = createServer(options, app);
const io = new Server(server);
const lastfm = new LastFM(apiKeys.LastFM)
const trackInfo = util.promisify(lastfm.trackInfo)
const exec = util.promisify(require('child_process').exec)
var sessions: Sessions = {

}
var cache = {

}

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
        let response = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(search)}&key=${apiKeys.YouTube}`).then(res => res.json()).then(res => res?.items[0]?.id.videoId)
        console.log(response)
        io.to(socket.id).emit('search', 'https://www.youtube.com/watch?v=' + response)
    }

    async function cacheSongs() {
        if (cache[roomID]) {
            const session = sessions[roomID]
            for (const song in cache[roomID]) {
                if (!(session.queue[0]?.id == song || session.currentlyPlaying?.id == song || session.songHistory[0]?.id == song || session.songHistory[1]?.id == song)) {
                    cache[roomID][song] = undefined
                }
            }
            if (session?.currentlyPlaying) {
                if (!cache[roomID][session?.currentlyPlaying?.id]) {
                    let info = await ytdl.getInfo(session.currentlyPlaying.url);
                    let format = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" })
                    let vid = await stream2buffer(ytdl(session.currentlyPlaying.url, { format: format }))
                    cache[roomID][session.currentlyPlaying.id] = {buffer: vid, mime: format.mimeType}
                    io.to(roomID).emit('song', session.currentlyPlaying.id, {buffer: vid, mime: format.mimeType})
                }
            }
            if(session?.queue[0]?.id) {
                if (!cache[roomID][session?.queue[0]?.id]) {
                    let info = await ytdl.getInfo(session.queue[0].url);
                    let format = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" })
                    let vid = await stream2buffer(ytdl(session.queue[0].url, { format: format }))
                    cache[roomID][session.queue[0].id] = {buffer: vid, mime: format.mimeType}
                    io.to(roomID).emit('song', session.queue[0].id, {buffer: vid, mime: format.mimeType})
                }
            }
            for(let i = 0; i > 2; i++) {
                if(session?.songHistory[i]) {
                    if (!cache[roomID][session?.songHistory[i]?.id]) {
                        let info = await ytdl.getInfo(session.songHistory[i].url);
                        let format = ytdl.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" })
                        let vid = await stream2buffer(ytdl(session.songHistory[i].url, { format: format }))
                        cache[roomID][session.songHistory[i].id] = {buffer: vid, mime: format.mimeType}
                        io.to(roomID).emit('song', session.songHistory[i].id, {buffer: vid, mime: format.mimeType})
                    }
                }
            }
        }
    }


    function join(id: string) {
        if (/^[a-zA-Z0-9]+$/.test(id)) {
            if (socket.rooms.size > 1) {
                socket.leave([...socket.rooms][1])
            }
            roomID = id;
            socket.join(id);
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
            cache[roomID] = {}
            io.to(id).emit('join', socket.id);
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
        if (roomID) {
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
        if (roomID) {
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
        if (sessions[roomID]?.state?.paused && roomID) {
            if (sessions[roomID].currentlyPlaying) {

                sessions[roomID].state.timer = Number(setTimeout(nextSong, sessions[roomID].state.remainingTime));
                sessions[roomID].state.startTime = (new Date()).getTime()
                sessions[roomID].state.paused = false;
                io.to(roomID).emit('update', JSON.stringify(sessions[roomID]))
            }
        }
    }

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
        res.send(cache[req.params.id][req.params.songid])
    }
})

app.use(express.static('assets/public'))
