import fetch from 'node-fetch'
import { parse } from 'node-html-parser'
import ytdl from "ytdl-core"
import { debug } from "debug"
import { Readable } from "stream"


export const apiKeys = {
    YouTube: "AIzaSyCcOHQxktvZ27u7xV30eTM92Dhy0FRtalc",
    LastFM: "65d8aef09c0e03d06b477054a190913c"
}


/**
 * Function to retrive song from a YT or LastFM url
 * @param link Either a YouTube or a LastFM Song url
 * @returns Song
 */
 export const getSongFromLink = async (link: string): Promise<Song> => {
    try {
        if (link.startsWith('yt:')) {
            const { videoDetails } = await ytdl.getInfo(link.replaceAll('yt:', ""))
            debug("UTILS")(videoDetails);
            return {
                name: videoDetails.title,
                artist: videoDetails.author.name,
                time: Number(videoDetails.lengthSeconds),
                url: videoDetails.video_url,
                id: videoDetails.videoId
            }
        } else if (link.startsWith('fm:')) {
            console.log('test', `${link.replaceAll("fm:", "")}`)
            const root = await fetch(link.replaceAll("fm:", "")).then(res => res.text()).then(html => parse(html))
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
    } catch (err) {
        return err
    }
}

/**
 * Generates a new random property ID for an object
 * @param length the length of the ID
 * @param object the object to check for existing properties
 * @param characters the characters that are allowed to be used. Defaults to alphanumeric characters.
 * @returns Unique ID
 */
 export const generateID = (length: number, object: Sessions, characters?: string): string => {
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

export async function stream2buffer(stream: Readable): Promise<Buffer> {

    return new Promise < Buffer > ((resolve, reject) => {
        
        const _buf = Array < any > ();

        stream.on("data", chunk => _buf.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(_buf)));
        stream.on("error", err => reject(`error converting stream - ${err}`));

    });
} 