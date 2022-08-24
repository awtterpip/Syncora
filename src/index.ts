import express from "express";
import { createServer } from "http"
import { Server } from 'socket.io'
import got from 'got-cjs'
import { JSDOM } from 'jsdom'

const app = express();
const server = createServer(app);
const io = new Server(server);
const apiKeys = {
    LastFM: "65d8aef09c0e03d06b477054a190913c",
    YouTube: "AIzaSyCcOHQxktvZ27u7xV30eTM92Dhy0FRtalc"
}

var sessions:Sessions = {

}

io.on('connection', async (socket) => {

});

server.listen(3000, () => {
    (console.log('listening on port 3000'));
});

app.get('/', (req, res) => {
    res.redirect(`/${generateID(6, sessions)}`)
})



/**
 * 
 * @param length length of generated ID
 * @param object object to generate unique id for
 * @param characters list of characters to use. Defaults to all alphanumeric characters
 * @returns ID
 */
function generateID(length: number, object: Sessions, characters?: string ): string {
    var chars = characters
    if(!chars) {
        chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'
    }
    let ID = ""
    for(let i = 0; i < length; i++) {
        ID = ID + chars[Math.floor(Math.random()*chars.length)]
    }
    if (object[ID]) {
        return generateID(length, object)
    }
    return ID
  }