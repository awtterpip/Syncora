"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fetch_1 = __importDefault(require("node-fetch"));
const node_html_parser_1 = require("node-html-parser");
async function curl() {
    const res = await (0, node_fetch_1.default)("https://www.last.fm/music/carpetgarden/_/Can+Ghosts+e+Gay%3F");
    const body = await res.text();
    const root = (0, node_html_parser_1.parse)(body);
    console.log(root.querySelector('a.header-new-playlink').getAttribute('href'));
}
curl();
