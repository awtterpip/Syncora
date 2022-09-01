import fetch from 'node-fetch'
import { parse } from 'node-html-parser'
import ytdl from 'ytdl-core'
import {Readable} from 'stream'

export const apiKeys = {
    YouTube: "AIzaSyCcOHQxktvZ27u7xV30eTM92Dhy0FRtalc",
    LastFM: "65d8aef09c0e03d06b477054a190913c"
}

/**
 * Function to retrive song from a YT or LastFM url
 * @param link Either a YouTube or a LastFM Song url
 * @returns Song
 */
export async function getSongFromLink(link: string): Promise<Song | null> {
    try {
        if (typeof link == 'string') {
            if (link.startsWith('yt:')) {
                const info = await ytdl.getInfo(link.replaceAll("yt:", ""));
                return {
                    name: info.videoDetails.title,
                    artist: info.videoDetails.author.name,
                    time: Number(info.videoDetails.lengthSeconds),
                    url: info.videoDetails.video_url,
                    id: info.videoDetails.videoId
                };
            } else if (link.startsWith('fm:')) {
                const root = await fetch(link.replace('fm:', "")).then(res => res.text()).then(res => parse(res));
                const time = root.querySelector('dd.catalogue-metadata-description').innerText.split(':');
                const url = root.querySelector('a.header-new-playlink')?.getAttribute('href')
                const info = await ytdl.getInfo(url)
                return {
                    name: root.querySelector('h1.header-new-title')?.innerText,
                    artist: root.querySelector('.header-new-crumb')?.innerText,
                    time: Number(info.videoDetails.lengthSeconds),
                    url: url,
                    id: info.videoDetails.videoId
                };
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (error) {
        return error.message;
    }
}
/**
 * Generates a new random property ID for an object
 * @param length the length of the ID
 * @param object the object to check for existing properties
 * @param characters the characters that are allowed to be used. Defaults to alphanumeric characters.
 * @returns Unique ID
 */
export function generateID(length: number, object: Sessions, characters?: string): string {
    var chars = characters
    if (!chars) {
        chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    }
    let ID = ""
    for (let i = 0; i < length; i++) {
        ID = ID + chars[Math.floor(Math.random() * chars.length)]
    }
    if (object[ID]) {
        return generateID(length, object)
    }
    return ID
}

export async function stream2buffer(stream:Readable): Promise<Buffer> {

    return new Promise < Buffer > ((resolve, reject) => {
        
        const _buf = Array < any > ();

        stream.on("data", chunk => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", err => reject(`error converting stream - ${err}`));

    });
} 
