interface Session {
    queue?: Song[];
    currentlyPlaying?: Song;
    songHistory?: Song[];
    state?: State;
}
interface Sessions {[key:string]: Session | undefined}
interface Song {
    name: string;
    artist: string;
    albumCover?: string;
    time: number;
    url:string;
    id:string;
}
interface State {
    paused: boolean;
    timer: NodeJS.Timeout | number;
    startTime: number;
    remainingTime: number;
}