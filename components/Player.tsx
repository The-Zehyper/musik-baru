'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePlayerStore } from '@/lib/store';
import { db } from '@/lib/db';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, SkipForward, SkipBack, Heart, ChevronDown, ListMusic, Mic2, Shuffle, Repeat, Repeat1, Cast, ListPlus, User, MoreVertical } from 'lucide-react';
import { cn, getHighResImage } from '@/lib/utils';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { MarqueeText } from './MarqueeText';

export function Player() {
  const router = useRouter();
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isExpanded = usePlayerStore((state) => state.isExpanded);
  const progress = usePlayerStore((state) => state.progress);
  const duration = usePlayerStore((state) => state.duration);
  const togglePlay = usePlayerStore((state) => state.togglePlay);
  const setPlaying = usePlayerStore((state) => state.setPlaying);
  const setExpanded = usePlayerStore((state) => state.setExpanded);
  const setProgress = usePlayerStore((state) => state.setProgress);
  const setDuration = usePlayerStore((state) => state.setDuration);
  const playNext = usePlayerStore((state) => state.playNext);
  const playPrev = usePlayerStore((state) => state.playPrev);
  const setTrackToAdd = usePlayerStore((state) => state.setTrackToAdd);
  const dominantColor = usePlayerStore((state) => state.dominantColor);
  const isShuffle = usePlayerStore((state) => state.isShuffle);
  const repeatMode = usePlayerStore((state) => state.repeatMode);
  const toggleShuffle = usePlayerStore((state) => state.toggleShuffle);
  const toggleRepeat = usePlayerStore((state) => state.toggleRepeat);

  const [isLiked, setIsLiked] = useState(false);
  const [lyrics, setLyrics] = useState<{ text: string; time?: number }[] | null>(null);
  const [lyricsType, setLyricsType] = useState<'synced' | 'plain' | null>(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isAlternativeTrying, setIsAlternativeTrying] = useState(false);
  const [isLoadingStream, setIsLoadingStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveVideoId(currentTrack?.videoId || null);
    setIsAlternativeTrying(false);
  }, [currentTrack?.videoId]);

  const handleStreamError = useCallback(async () => {
    if (currentTrack && !isAlternativeTrying) {
      setIsAlternativeTrying(true);
      try {
        const artistName = Array.isArray(currentTrack.artist)
          ? currentTrack.artist.map((a) => a.name).join(' ')
          : currentTrack.artist?.name || '';
        const query = `${currentTrack.name} ${artistName} audio`;
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=video`);
        if (res.ok) {
          const videos = await res.json();
          const alternativeVideo = videos.find((v: any) => v.videoId && v.videoId !== currentTrack.videoId);
          if (alternativeVideo) {
            setActiveVideoId(alternativeVideo.videoId);
            return;
          }
        }
      } catch (err) {
        console.error('Failed to find alternative stream:', err);
      }
    }
    // If alternative also fails, jump to next track
    playNext();
  }, [currentTrack, isAlternativeTrying, playNext]);

  // Fetch direct audio stream URL when track or videoId changes
  useEffect(() => {
    let isCancelled = false;
    if (!activeVideoId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreamUrl(null);
      return;
    }

    setIsLoadingStream(true);
    fetch(`/api/stream?id=${encodeURIComponent(activeVideoId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (isCancelled) return;
        if (data?.status && data?.result?.download?.audio) {
          setStreamUrl(data.result.download.audio);
        } else {
          console.warn('Stream extraction failed for video:', activeVideoId, data);
          // Attempt alternative video search if extraction fails
          handleStreamError();
        }
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Error fetching stream:', err);
        handleStreamError();
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingStream(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [activeVideoId, handleStreamError]);

  // Sync audio playback state with isPlaying store
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch((err) => {
        console.warn('Audio play error:', err);
      });
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    } else {
      audio.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }, [isPlaying, streamUrl]);

  // Smooth scroll lyrics
  useEffect(() => {
    if (showLyrics && lyricsContainerRef.current && duration > 0 && lyrics && lyrics.length > 0 && lyricsType === 'synced') {
      const container = lyricsContainerRef.current;
      const LYRICS_OFFSET = 0.25;
      const index = lyrics.findIndex(line => line.time !== undefined && line.time > (progress + LYRICS_OFFSET));
      const activeIndex = index === -1 ? lyrics.length - 1 : Math.max(0, index - 1);
      
      const lineElements = container.querySelectorAll('.lyric-line');
      if (lineElements[activeIndex]) {
        const targetLine = lineElements[activeIndex] as HTMLElement;
        const targetScroll = targetLine.offsetTop - container.clientHeight / 2 + targetLine.clientHeight / 2;
        container.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }
    }
  }, [progress, duration, showLyrics, lyrics, lyricsType]);

  // Reset lyrics when track changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLyrics(null);
    setLyricsType(null);
  }, [currentTrack?.videoId]);

  useEffect(() => {
    if (currentTrack) {
      db.isLiked(currentTrack.videoId).then(setIsLiked);
    }
  }, [currentTrack]);

  useEffect(() => {
    if (currentTrack && showLyrics && !lyrics) {
      const artistName = Array.isArray(currentTrack.artist)
        ? currentTrack.artist.map(a => a.name).join(', ')
        : currentTrack.artist?.name || '';
      
      const queryParams = new URLSearchParams({
        id: currentTrack.videoId,
        title: currentTrack.name,
        artist: artistName
      });

      fetch(`/api/lyrics?${queryParams.toString()}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lyrics && data.lyrics.lines) {
            setLyricsType(data.lyrics.type);
            setLyrics(data.lyrics.lines);
          } else {
            setLyrics([{ text: "Lyrics not available for this song. 😔" }]);
            setLyricsType('plain');
          }
        })
        .catch(() => {
          setLyrics([{ text: "Lyrics not available for this song. 😔" }]);
          setLyricsType('plain');
        });
    }
  }, [currentTrack, showLyrics, lyrics]);

  const handleLike = useCallback(async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentTrack) return;
    if (isLiked) {
      await db.removeLikedSong(currentTrack.videoId);
      setIsLiked(false);
    } else {
      await db.addLikedSong(currentTrack);
      setIsLiked(true);
    }
  }, [currentTrack, isLiked]);

  useEffect(() => {
    if (currentTrack && 'mediaSession' in navigator) {
      const thumbnail = getHighResImage(currentTrack.thumbnails?.[currentTrack.thumbnails.length - 1]?.url, 800);
      const artistName = Array.isArray(currentTrack.artist) ? currentTrack.artist.map(a => a.name).join(', ') : currentTrack.artist?.name || 'Unknown Artist';
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.name,
        artist: artistName,
        album: 'Music App',
        artwork: [
          { src: thumbnail, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        setPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        setPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrev();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });
      if ('seekto' in navigator.mediaSession) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime !== undefined && audioRef.current) {
            audioRef.current.currentTime = details.seekTime;
            setProgress(details.seekTime);
          }
        });
      }
    }
  }, [currentTrack, setPlaying, setProgress, playNext, playPrev]);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setProgress(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  if (!currentTrack) return null;

  const thumbnail = getHighResImage(currentTrack.thumbnails?.[currentTrack.thumbnails.length - 1]?.url, 800);
  const artistName = Array.isArray(currentTrack.artist) ? currentTrack.artist.map(a => a.name).join(', ') : currentTrack.artist?.name || 'Unknown Artist';

  return (
    <>
      {/* HTML5 Audio Player */}
      <audio
        ref={audioRef}
        src={streamUrl || undefined}
        preload="auto"
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setProgress(audioRef.current.currentTime || 0);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (repeatMode === 'one' && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          } else {
            playNext();
          }
        }}
        onError={() => {
          handleStreamError();
        }}
      />

      {/* Mini Player */}
      <AnimatePresence>
        {!isExpanded && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[80px] left-4 right-4 z-50 bg-[#1C1C1E]/95 backdrop-blur-md rounded-full flex items-center p-2 pr-4 cursor-pointer shadow-2xl border border-white/10"
            onClick={() => setExpanded(true)}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTrack.videoId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex items-center flex-1 min-w-0"
              >
                {/* Circular Album Art with Progress */}
                <div className="relative w-12 h-12 shrink-0 mr-3">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                    <circle 
                      cx="50" cy="50" r="46" fill="none" stroke="#A78BFA" strokeWidth="4" 
                      strokeDasharray={`${2 * Math.PI * 46}`}
                      strokeDashoffset={`${2 * Math.PI * 46 * (1 - (duration > 0 ? progress / duration : 0))}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-1 rounded-full overflow-hidden">
                    <Image src={thumbnail} alt={currentTrack.name} fill sizes="(max-width: 640px) 100vw, 500px" className="object-cover" />
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <MarqueeText text={currentTrack.name} className="text-white text-sm font-semibold" />
                  <MarqueeText 
                    text={
                      <>
                        {currentTrack.isExplicit && <span className="bg-white/20 text-[8px] px-1 rounded-sm text-white">E</span>}
                        {artistName}
                      </>
                    } 
                    className="text-white/60 text-xs" 
                  />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                {isLoadingStream ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
              <button
                onClick={handleLike}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors"
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-[#FA243C] text-[#FA243C]' : ''}`} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded Player */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[100] flex flex-col p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:pb-8"
            style={{
              background: dominantColor 
                ? `linear-gradient(to bottom, color-mix(in srgb, ${dominantColor} 40%, #121212) 0%, #121212 100%)`
                : '#121212'
            }}
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-8 shrink-0 relative z-10">
              <button onClick={() => setExpanded(false)} className="p-2 -ml-2 text-white">
                <ChevronDown className="w-8 h-8" />
              </button>
              <div className="flex gap-4">
                <button className="p-2 text-white">
                  <Cast className="w-6 h-6" />
                </button>
                <button className="p-2 -mr-2 text-white">
                  <MoreVertical className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col justify-center min-h-0 relative z-10">
              <AnimatePresence mode="wait">
                {showLyrics ? (
                  <motion.div
                    key="lyrics-scroll"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="absolute inset-0 flex flex-col"
                  >
                    {/* Lyrics scrolling container */}
                    <div 
                      className="flex-1 overflow-y-auto no-scrollbar pb-[10vh] px-2"
                      ref={lyricsContainerRef}
                      style={{ 
                        maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)", 
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)" 
                      }}
                    >
                      {lyrics ? (
                        <div className="flex flex-col gap-6 md:gap-8 items-center text-center max-w-2xl mx-auto w-full pt-[30vh] pb-[30vh]">
                          {lyrics.map((line, i) => {
                            let isActive = false;
                            if (lyricsType === 'synced') {
                              const LYRICS_OFFSET = 0.25;
                              const index = lyrics.findIndex(l => l.time !== undefined && l.time > (progress + LYRICS_OFFSET));
                              const activeIndex = index === -1 ? lyrics.length - 1 : Math.max(0, index - 1);
                              isActive = i === activeIndex;
                            }
                            
                            return (
                              <p 
                                key={i} 
                                className={cn(
                                  "lyric-line text-2xl md:text-3xl font-bold transition-all duration-300 ease-out origin-center", 
                                  lyricsType === 'synced' 
                                    ? (isActive ? "text-white scale-[1.05]" : "text-white/30 scale-100 cursor-pointer hover:text-white/60")
                                    : "text-white/90 scale-100"
                                )}
                                onClick={() => {
                                  if (lyricsType === 'synced' && duration > 0 && line.time !== undefined) {
                                    setProgress(line.time);
                                    if (audioRef.current) audioRef.current.currentTime = line.time;
                                  }
                                }}
                              >
                                {line.text}
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-4 h-full">
                          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                          <span className="text-white/50 text-xl font-medium tracking-wide">Memuat lirik...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="cover-image"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: isPlaying ? 1 : 0.95 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                    className="w-full aspect-square rounded-xl overflow-hidden shadow-2xl mx-auto max-w-[360px]"
                  >
                    <Image src={thumbnail} alt={currentTrack.name} width={500} height={500} className="w-full h-full object-cover" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Controls Area */}
            <div className="mt-8">
              <div className="flex justify-between items-center mb-6">
                <AnimatePresence mode="wait">
                  <motion.div 
                    key={currentTrack.videoId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="min-w-0 flex-1 pr-4"
                  >
                    <MarqueeText text={currentTrack.name} className="text-2xl font-bold text-white mb-1" />
                    <MarqueeText text={artistName} className="text-lg text-white/60" />
                  </motion.div>
                </AnimatePresence>
                <div className="flex items-center gap-4">
                  <button onClick={() => setTrackToAdd(currentTrack)} className="p-2 text-white/80 hover:text-white transition">
                    <ListPlus className="w-7 h-7" />
                  </button>
                  <button onClick={handleLike} className="p-2 text-white transition">
                    <Heart className={cn("w-7 h-7", isLiked && "fill-white")} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={progress || 0}
                  onChange={handleSeek}
                  className="w-full h-1 bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                />
                <div className="flex justify-between text-xs text-white/50 mt-2 font-mono">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Playback Controls */}
              <div className="flex justify-between items-center mb-8 px-2">
                <button 
                  onClick={toggleShuffle}
                  className={cn("transition", isShuffle ? "text-[#A78BFA]" : "text-white/80 hover:text-white")}
                >
                  <Shuffle className="w-6 h-6" />
                </button>
                <button onClick={playPrev} className="text-white hover:text-white transition">
                  <SkipBack className="w-10 h-10 fill-current" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-20 h-20 flex items-center justify-center bg-white text-black rounded-full hover:scale-105 transition-transform"
                >
                  {isLoadingStream ? (
                    <div className="w-8 h-8 border-4 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="w-10 h-10 fill-current" />
                  ) : (
                    <Play className="w-10 h-10 fill-current ml-1" />
                  )}
                </button>
                <button onClick={playNext} className="text-white hover:text-white transition">
                  <SkipForward className="w-10 h-10 fill-current" />
                </button>
                <button 
                  onClick={toggleRepeat}
                  className={cn("transition relative", repeatMode !== 'off' ? "text-[#A78BFA]" : "text-white/80 hover:text-white")}
                >
                  {repeatMode === 'one' ? <Repeat1 className="w-6 h-6" /> : <Repeat className="w-6 h-6" />}
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="flex justify-between items-center px-6 py-4 bg-white/5 rounded-2xl">
                <button className="text-white/80 hover:text-white transition flex flex-col items-center gap-1">
                  <ListMusic className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider">Up Next</span>
                </button>
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={cn("transition flex flex-col items-center gap-1", showLyrics ? "text-white" : "text-white/80 hover:text-white")}
                >
                  <Mic2 className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider">Lyrics</span>
                </button>
                <button 
                  onClick={() => {
                    const artistId = Array.isArray(currentTrack.artist) 
                      ? currentTrack.artist[0]?.artistId 
                      : currentTrack.artist?.artistId;
                    if (artistId) {
                      setExpanded(false);
                      router.push(`/artist/${artistId}`);
                    }
                  }}
                  className="text-white/80 hover:text-white transition flex flex-col items-center gap-1"
                >
                  <User className="w-5 h-5" />
                  <span className="text-[10px] uppercase tracking-wider">Lihat Artis</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

