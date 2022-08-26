"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream2buffer = exports.generateID = exports.getSongFromLink = exports.apiKeys = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const node_html_parser_1 = require("node-html-parser");
const ytdl_core_1 = __importDefault(require("ytdl-core"));
exports.apiKeys = {
    YouTube: "AIzaSyCcOHQxktvZ27u7xV30eTM92Dhy0FRtalc",
    LastFM: "65d8aef09c0e03d06b477054a190913c"
};
/**
 * Function to retrive song from a YT or LastFM url
 * @param link Either a YouTube or a LastFM Song url
 * @returns Song
 */
async function getSongFromLink(link) {
    try {
        if (typeof link == 'string') {
            if (link.startsWith('yt:')) {
                const info = await ytdl_core_1.default.getInfo(link.replace("yt:", ""));
                return {
                    name: info.videoDetails.title,
                    artist: info.videoDetails.author.name,
                    time: Number(info.videoDetails.lengthSeconds),
                    url: info.videoDetails.video_url,
                    id: info.videoDetails.videoId
                };
            }
            else if (link.startsWith('fm:')) {
                const root = await (0, node_fetch_1.default)(link.replace('fm:', "")).then(res => res.text()).then(res => (0, node_html_parser_1.parse)(res));
                const time = root.querySelector('dd.catalogue-metadata-description').innerText.split(':');
                const url = root.querySelector('a.header-new-playlink')?.getAttribute('href');
                const info = await ytdl_core_1.default.getInfo(url);
                return {
                    name: root.querySelector('h1.header-new-title')?.innerText,
                    artist: root.querySelector('.header-new-crumb')?.innerText,
                    time: Number(info.videoDetails.lengthSeconds),
                    url: url,
                    id: info.videoDetails.videoId
                };
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }
    catch (error) {
        return null;
    }
}
exports.getSongFromLink = getSongFromLink;
/**
 * Generates a new random property ID for an object
 * @param length the length of the ID
 * @param object the object to check for existing properties
 * @param characters the characters that are allowed to be used. Defaults to alphanumeric characters.
 * @returns Unique ID
 */
function generateID(length, object, characters) {
    var chars = characters;
    if (!chars) {
        chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    }
    let ID = "";
    for (let i = 0; i < length; i++) {
        ID = ID + chars[Math.floor(Math.random() * chars.length)];
    }
    if (object[ID]) {
        return generateID(length, object);
    }
    return ID;
}
exports.generateID = generateID;
async function stream2buffer(stream) {
    return new Promise((resolve, reject) => {
        const _buf = Array();
        stream.on("data", chunk => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", err => reject(`error converting stream - ${err}`));
    });
}
exports.stream2buffer = stream2buffer;
