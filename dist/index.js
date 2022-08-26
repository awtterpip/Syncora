"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const https_1 = require("https");
const socket_io_1 = require("socket.io");
const ytdl_core_1 = __importDefault(require("ytdl-core"));
const LastFM = require("last-fm");
const util = require("util");
const fs = __importStar(require("fs"));
const utils_1 = require("./utils");
const options = {
    key: fs.readFileSync('/home/zach/localhost-key.pem'),
    cert: fs.readFileSync('/home/zach/localhost.pem')
};
const app = (0, express_1.default)();
const server = (0, https_1.createServer)(options, app);
const io = new socket_io_1.Server(server);
const lastfm = new LastFM(utils_1.apiKeys.LastFM);
const trackInfo = util.promisify(lastfm.trackInfo);
const exec = util.promisify(require('child_process').exec);
var sessions = {};
var cache = {};
io.of('/').adapter.on('leave-room', (room, id) => {
    if (room != id) {
        if (sessions[room]?.state?.timer) {
            clearTimeout(sessions[room].state.timer);
        }
        sessions[room] = undefined;
    }
});
io.on('connection', async (socket) => {
    var roomID;
    /**
     * Join room
     * @param id ID of the room to join
     */
    async function ok(link) {
        let info = await ytdl_core_1.default.getInfo(link);
        io.to(roomID).emit('update', JSON.stringify(info));
    }
    async function cacheSongs() {
        if (cache[roomID]) {
            const session = sessions[roomID];
            for (const song in cache[roomID]) {
                if (!(session.queue[0]?.id == song || session.currentlyPlaying?.id == song || session.songHistory[0]?.id == song || session.songHistory[1].id == song)) {
                    cache[roomID][song] = undefined;
                }
            }
            if (session?.currentlyPlaying) {
                if (!cache[roomID][session?.currentlyPlaying?.id]) {
                    let info = await ytdl_core_1.default.getInfo(session.currentlyPlaying.url);
                    let format = ytdl_core_1.default.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
                    let vid = await (0, utils_1.stream2buffer)((0, ytdl_core_1.default)(session.currentlyPlaying.url, { format: format }));
                    cache[roomID][session.currentlyPlaying.id] = { buffer: vid, mime: format.mimeType };
                    io.to(roomID).emit('song', session.currentlyPlaying.id, { buffer: vid, mime: format.mimeType });
                }
            }
            if (session?.queue[0]) {
                if (!cache[roomID][session?.queue[0]?.id]) {
                    let info = await ytdl_core_1.default.getInfo(session.queue[0].url);
                    let format = ytdl_core_1.default.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
                    let vid = await (0, utils_1.stream2buffer)((0, ytdl_core_1.default)(session.queue[0].url, { format: format }));
                    cache[roomID][session.queue[0].id] = { buffer: vid, mime: format.mimeType };
                    io.to(roomID).emit('song', session.queue[0].id, { buffer: vid, mime: format.mimeType });
                }
            }
            for (let i = 0; i > 2; i++) {
                if (session?.songHistory[i]) {
                    if (!cache[roomID][session?.songHistory[i]?.id]) {
                        let info = await ytdl_core_1.default.getInfo(session.songHistory[i].url);
                        let format = ytdl_core_1.default.chooseFormat(info.formats, { quality: "highestaudio", filter: "audioonly" });
                        let vid = await (0, utils_1.stream2buffer)((0, ytdl_core_1.default)(session.songHistory[i].url, { format: format }));
                        cache[roomID][session.songHistory[i].id] = { buffer: vid, mime: format.mimeType };
                        io.to(roomID).emit('song', session.songHistory[i].id, { buffer: vid, mime: format.mimeType });
                    }
                }
            }
        }
    }
    function join(id) {
        if (/^[a-zA-Z0-9]+$/.test(id)) {
            if (socket.rooms.size > 1) {
                socket.leave([...socket.rooms][1]);
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
            };
            cache[roomID] = {};
            io.to(id).emit('join', socket.id);
            io.to(socket.id).emit('update', JSON.stringify(sessions[id]));
        }
        else {
            io.to(socket.id).emit('error', "roomID can only contain alphanumeric characters");
        }
    }
    async function seek(timeRemain) {
        if (roomID && typeof timeRemain == 'number') {
            let paused = sessions[roomID].state.paused;
            pause();
            sessions[roomID].state.remainingTime = timeRemain;
            if (!paused)
                play();
        }
    }
    async function getSongs(links) {
        if (Array.isArray(links) && roomID) {
            var songs = [];
            for (let i = 0; i < links.length; i++) {
                songs[i] = await (0, utils_1.getSongFromLink)(links[i]);
            }
            io.to(roomID).emit('songResults', JSON.stringify(songs));
        }
    }
    /*async function getSong(urls: string[]) {
        if (urls && roomID) {
            var songs: Song[] = []
            var yt: { i: number[], id: string[] } = { i: [], id: [] }
            for (let i = 0; i < urls.length; i++) {
                const url = urls[i]
                var ytid = url.match(/(?<=yt\:)[a-zA-Z0-9_\-]{11}$/)
                if (ytid) {
                    yt.i.push(i);
                    yt.id.push(ytid[0])
                } else {
                    var lastfminfo = url.match(/^https:\/\/www\.last\.fm\/music\/([A-Za-z0-9-_.%!~*'()+]+)\/_\/([A-Za-z0-9-_.%!~*'()+]+)/)
                    var search
                    if (lastfminfo?.length > 2) {
                        search = decodeURIComponent(lastfminfo[1]).replaceAll("+", " ") + " - " + decodeURIComponent(lastfminfo[2]).replaceAll("+", " ")
                        songs[i] = {
                            name: decodeURIComponent(lastfminfo[2]).replaceAll("+", " "),
                            artist: decodeURIComponent(lastfminfo[1]).replaceAll('+', " "),
                            url: undefined,
                            time: undefined
                        }
                    } else {
                        search = url
                    }
                    let response = await fetch(`https://youtube.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(search)}&type=video&key=${apiKeys.YouTube}`)
                        .then(res => res.json()).catch(err => null)
                    if (response?.items[0]?.id.videoId) {

                        yt.i.push(i);
                        yt.id.push(response.items[0].id.videoId as string)
                    } else {
                        songs[i] = null
                    }
                }
            }
            console.log(yt)
            if (yt.id.length > 0) {
                let response: { kind: string, etag: string, items: any[] } = await fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${yt.id.toString()}&key=${apiKeys.YouTube}`)
                    .then(res => res.json()).catch(err => null);
                console.log(response)
                if (response?.items?.length) {
                    for (let i = 0; i < yt.id.length; i++) {
                        let index = response.items.findIndex(val => val.id == yt.id[i]);
                        if (index > -1) {
                            let length = response.items[i].contentDetails.duration.match(/^PT([0-9]*(?=H))?H?([0-9]*(?=M))?M?([0-9]*(?=S))?S?$/)
                            for (let index = 0; index < length.length; index++) {
                                if (!length[index]) {
                                    length[index] = 0;
                                } else if (typeof length[index] != "number") {
                                    length[index] = Number(length[index])
                                }
                            }
                            songs[yt.i[i]] = {
                                name: songs[yt.i[i]]?.name || response.items[i].snippet.title,
                                artist: songs[yt.i[i]]?.artist || response.items[i].snippet.channelTitle,
                                time: length[1] * 360 + length[2] * 60 + length[3],
                                url: 'https://youtube.com/watch?v=' + yt.id[i]
                            }
                        }
                    }
                    io.to(socket.id).emit('songResults', JSON.stringify(songs))
                }
            }
        }
    }*/
    function updateQueue(queue) {
        if (roomID && Array.isArray(queue)) {
            sessions[roomID].queue = queue;
            cacheSongs();
            io.to(roomID).emit('update', JSON.stringify(sessions[roomID]));
        }
    }
    function pause() {
        if ((!sessions[roomID]?.state?.paused) && roomID) {
            if (sessions[roomID].currentlyPlaying) {
                clearTimeout(sessions[roomID].state.timer);
                sessions[roomID].state.remainingTime = (new Date()).getTime() - sessions[roomID].state.startTime;
                sessions[roomID].state.timer = undefined;
                sessions[roomID].state.paused = true;
                io.to(roomID).emit('update', JSON.stringify(sessions[roomID]));
            }
        }
    }
    async function nextSong() {
        if (roomID) {
            if (sessions[roomID].currentlyPlaying) {
                sessions[roomID].songHistory.unshift(sessions[roomID].currentlyPlaying);
            }
            if (sessions[roomID].queue.length > 0) {
                sessions[roomID].currentlyPlaying = sessions[roomID].queue.shift();
                if (sessions[roomID].state.timer) {
                    clearTimeout(sessions[roomID].state.timer);
                }
                sessions[roomID].state = {
                    timer: undefined,
                    paused: sessions[roomID].state.paused,
                    startTime: undefined,
                    remainingTime: sessions[roomID].currentlyPlaying.time * 1000
                };
            }
            cacheSongs();
            play();
        }
    }
    function prevSong() {
        if (roomID) {
            if (sessions[roomID].currentlyPlaying) {
                sessions[roomID].queue.unshift(sessions[roomID].currentlyPlaying);
            }
            if (sessions[roomID].songHistory.length > 0) {
                sessions[roomID].currentlyPlaying = sessions[roomID].songHistory.shift();
                if (sessions[roomID].state.timer) {
                    clearTimeout(sessions[roomID].state.timer);
                }
                sessions[roomID].state = {
                    timer: undefined,
                    paused: true,
                    startTime: undefined,
                    remainingTime: sessions[roomID].currentlyPlaying.time * 1000
                };
            }
            play();
            cacheSongs();
        }
    }
    function play() {
        if (sessions[roomID]?.state?.paused && roomID) {
            if (sessions[roomID].currentlyPlaying) {
                sessions[roomID].state.timer = Number(setTimeout(nextSong, sessions[roomID].state.remainingTime));
                sessions[roomID].state.startTime = (new Date()).getTime();
                sessions[roomID].state.paused = false;
                io.to(roomID).emit('update', JSON.stringify(sessions[roomID]));
            }
        }
    }
    socket.on('pause', pause);
    socket.on('play', play);
    socket.on('updateQueue', updateQueue);
    socket.on('next', nextSong);
    socket.on('prev', prevSong);
    socket.on('join', join);
    socket.on('getSongs', getSongs);
    socket.on('ok', ok);
});
server.listen(3000, () => {
    (console.log('listening on port 3000'));
});
app.get('/', (req, res) => {
    res.redirect(`room/${(0, utils_1.generateID)(6, sessions)}`);
});
app.get('/room/:id', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});
app.get('/room/:id/song/:songid', function (req, res) {
    if (cache[req.params.id]) {
        res.send(cache[req.params.id][req.params.songid]);
    }
});
app.use(express_1.default.static('dist/public'));
