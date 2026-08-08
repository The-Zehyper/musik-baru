import { NextResponse } from 'next/server';
import { getYTMusic } from '@/lib/ytmusic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('id');
  
  if (!rawId || rawId === 'undefined' || rawId === 'null') {
    return NextResponse.json({ error: 'Missing or invalid id' }, { status: 400 });
  }

  // Prepend VL to RD lists to prevent 400 bad request errors
  const id = rawId.startsWith('RD') ? `VL${rawId}` : rawId;

  try {
    const ytmusic = await getYTMusic();
    try {
      console.log('Fetching playlist:', id);
      const playlist = await ytmusic.getPlaylist(id) as any;
      console.log('Playlist fetched:', playlist.name);
      let videos = playlist.videos || [];
      console.log('Initial videos length:', videos.length);
      if (videos.length === 0) {
        try {
          videos = await ytmusic.getPlaylistVideos(id);
          console.log('Fetched videos length:', videos.length);
        } catch (e) {
          console.error('Failed to get playlist videos:', e);
        }
      }
      return NextResponse.json({
        ...playlist,
        videos: videos
      });
    } catch (e: any) {
      if (e?.name === 'ZodError') {
        // Suppress ZodError logs
      } else if (e?.message?.includes('split')) {
        // Suppress known split error for invalid playlist IDs
      } else {
        console.error('getPlaylist error:', e);
        console.log(`getPlaylist failed for id ${id}, trying getAlbum`);
      }
      
      try {
        const album = await ytmusic.getAlbum(id);
        if (album && album.songs) {
          return NextResponse.json({
            playlistId: album.albumId || id,
            name: album.name || 'Album',
            artist: album.artist,
            thumbnails: album.thumbnails || [],
            videos: (album.songs || []).map((song: any) => ({
              videoId: song.videoId,
              name: song.name,
              artist: song.artist || [album.artist],
              duration: song.duration,
              thumbnails: song.thumbnails || album.thumbnails || [],
            }))
          });
        }
      } catch {
        // Album fetch also failed
      }

      return NextResponse.json({ error: 'Invalid playlist or album ID', playlistId: id, videos: [] }, { status: 400 });
    }
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return NextResponse.json({ error: 'ZodError', details: error.issues, videos: [] }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch playlist', videos: [] }, { status: 400 });
  }
}
