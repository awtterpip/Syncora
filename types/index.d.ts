interface Session {}
interface Sessions {[key:string]: Session | undefined}
interface Song {
    name: string;
    artist: string;
    albumCover?: string;
    length: number;
    url:string;
}