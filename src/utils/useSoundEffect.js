import { useEffect, useRef } from 'react';

export default function useSoundEffect(src, volume = 0.3) {
    const audioRef = useRef(null);

    useEffect(() => {
        audioRef.current = new Audio(src);
        audioRef.current.volume = volume;
    }, [src, volume]);

    const play = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    };

    return play;
}
