'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, SubscribedArtist, SavedAlbum } from '@/lib/db';
import { Track } from '@/lib/store';
import { TrackItem } from '@/components/TrackItem';
import { Heart, Plus, ListMusic, Trash2, Play, MoreVertical, Download, TrendingUp, Clock, UploadCloud } from 'lucide-react';
import Image from 'next/image';
import { usePlayerStore } from '@/lib/store';
import { motion } from 'motion/react';
import { MarqueeText } from '@/components/MarqueeText';
import { ConfirmModal, AlertModal } from '@/components/FeedbackModals';

export default function Library() {
  const router = useRouter();
  const [likedSongs, setLikedSongs] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [savedAlbums, setSavedAlbums] = useState<SavedAlbum[]>([]);
  const [subscribedArtists, setSubscribedArtists] = useState<SubscribedArtist[]>([]);
  const [activeTab, setActiveTab] = useState('Daftar putar');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistImg, setNewPlaylistImg] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ title?: string, message: string } | null>(null);
  const playTrack = usePlayerStore((state) => state.playTrack);

  const tabs = ['Daftar putar', 'Lagu', 'Album', 'Artis', 'Podcasts'];

  const loadLibrary = async () => {
    const liked = await db.getLikedSongs();
    const pl = await db.getPlaylists();
    const sa = await db.getSubscribedArtists();
    const albums = await db.getSavedAlbums();
    setLikedSongs(liked);
    setPlaylists(pl);
    setSubscribedArtists(sa);
    setSavedAlbums(albums);
  };

  useEffect(() => {
    loadLibrary();

    const handlePlaylistsUpdated = () => {
      loadLibrary();
    };

    window.addEventListener('playlistsUpdated', handlePlaylistsUpdated);
    
    return () => {
      window.removeEventListener('playlistsUpdated', handlePlaylistsUpdated);
    };
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    const newPlaylist = {
      id: Date.now().toString(),
      name: newPlaylistName,
      img: newPlaylistImg || 'https://picsum.photos/seed/playlist/200/200',
      tracks: [],
    };
    await db.addPlaylist(newPlaylist);
    setShowCreate(false);
    setNewPlaylistName('');
    setNewPlaylistImg('');
    loadLibrary();
  };

  const handleDeletePlaylist = async (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await db.deletePlaylist(deleteTarget);
      loadLibrary();
      setDeleteTarget(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewPlaylistImg(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const extractPlaylistId = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.searchParams.get('list');
    } catch {
      return url; // fallback to treating the input itself as ID
    }
  };

  const handleImportPlaylistUrl = async () => {
    if (!importUrl.trim()) return;
    setIsImporting(true);
    
    try {
      const listId = extractPlaylistId(importUrl);
      if (!listId) {
        setAlertMessage({ title: 'Gagal', message: 'Invalid playlist URL atau ID tidak ditemukan.' });
        setIsImporting(false);
        return;
      }

      const res = await fetch(`/api/ytplaylist?id=${encodeURIComponent(listId)}`);
      if (!res.ok) throw new Error('Failed to fetch playlist');
      
      const data = await res.json();
      
      const newPlaylist = {
        id: Date.now().toString(),
        name: data.name || data.title || 'Imported Playlist',
        img: data.thumbnails?.[data.thumbnails.length - 1]?.url || 'https://picsum.photos/seed/playlist/200/200',
        tracks: data.videos || data.tracks || [],
      };
      
      await db.addPlaylist(newPlaylist);
      setShowImport(false);
      setImportUrl('');
      loadLibrary();
      setAlertMessage({ title: 'Sukses', message: 'Playlist berhasil diimpor!' });
    } catch (error) {
      console.error(error);
      setAlertMessage({ title: 'Gagal', message: 'Gagal mengimpor playlist. Pastikan link valid dan dapat diakses publik.' });
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImporting(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const data = JSON.parse(reader.result as string);
          
          let tracks = [];
          let name = 'Imported JSON Playlist';
          let img = 'https://picsum.photos/seed/playlist/200/200';
          
          if (Array.isArray(data)) {
             tracks = data;
          } else if (data.tracks || data.videos) {
             tracks = data.tracks || data.videos;
             name = data.name || data.title || name;
             if (data.thumbnails && data.thumbnails.length > 0) {
                 img = data.thumbnails[data.thumbnails.length - 1].url;
             } else if (data.img) {
                 img = data.img;
             }
          }
          
          const newPlaylist = {
            id: Date.now().toString(),
            name,
            img,
            tracks: tracks,
          };
          
          await db.addPlaylist(newPlaylist);
          setShowImport(false);
          loadLibrary();
          setAlertMessage({ title: 'Sukses', message: 'Playlist berhasil diimpor dari file JSON!' });
        } catch (err) {
          setAlertMessage({ title: 'Gagal', message: 'Format JSON tidak valid atau gagal dibaca.' });
        } finally {
          setIsImporting(false);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <main className="min-h-screen pt-6 px-4 pb-24">
      <div className="flex overflow-x-auto no-scrollbar gap-3 mb-6 snap-x snap-mandatory scroll-smooth">
        {tabs.map((tab) => (
          <motion.button
            key={tab}
            initial={{ opacity: 0.5, scale: 0.9, x: 20 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-colors border snap-center ${
              activeTab === tab 
                ? 'bg-white/20 text-white border-white/20' 
                : 'bg-transparent text-white/70 border-white/10 hover:bg-white/5'
            }`}
          >
            {tab}
          </motion.button>
        ))}
      </div>

      <div className="flex justify-between items-center mb-6 text-white/80 text-sm">
        <button className="flex items-center gap-2">
          Tanggal ditambahkan <span className="text-xs">↓</span>
        </button>
        <button>
          <ListMusic className="w-5 h-5" />
        </button>
      </div>

      {activeTab === 'Daftar putar' && (
        <div className="space-y-2">
          <div className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors" onClick={() => setActiveTab('Lagu')}>
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Disukai</h3>
              <p className="text-white/50 text-sm">{likedSongs.length} lagu</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Diunduh</h3>
            </div>
          </div>

          <div 
            onClick={() => router.push('/top50')}
            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
          >
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Teratas Saya 50</h3>
            </div>
          </div>

          <div 
            onClick={() => router.push('/history')}
            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
          >
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Riwayat / Tersimpan di Cache</h3>
            </div>
          </div>

          <div className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Diunggah</h3>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors w-full text-left mt-4"
          >
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Buat playlist baru</h3>
            </div>
          </button>

          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors w-full text-left"
          >
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
              <UploadCloud className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Impor Playlist</h3>
            </div>
          </button>

          {playlists.map((pl) => (
            <div 
              key={pl.id} 
              className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-colors group"
              onClick={() => router.push(`/playlist/${pl.id}`)}
            >
              <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0">
                <Image src={pl.img} alt={pl.name} fill sizes="144px" className="object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pl.tracks.length > 0) playTrack(pl.tracks[0], pl.tracks, 'playlist');
                    }}
                    className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Play className="w-4 h-4 text-white ml-0.5 fill-current" />
                  </button>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <MarqueeText text={pl.name} className="text-white font-medium" />
                <p className="text-white/50 text-sm">{pl.tracks.length} lagu</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const cleanPl = {
                    id: pl.id,
                    name: pl.name,
                    img: pl.img,
                    tracks: pl.tracks?.map((t: any) => ({
                      videoId: t.videoId,
                      name: t.name,
                      artist: t.artist,
                      duration: t.duration,
                      thumbnails: t.thumbnails
                    })) || []
                  };
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanPl));
                  const downloadAnchorNode = document.createElement('a');
                  downloadAnchorNode.setAttribute("href", dataStr);
                  downloadAnchorNode.setAttribute("download", `${pl.name}.json`);
                  document.body.appendChild(downloadAnchorNode);
                  downloadAnchorNode.click();
                  downloadAnchorNode.remove();
                }}
                className="p-2 text-white/50 hover:text-white transition-all"
                title="Ekspor Playlist"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePlaylist(pl.id);
                }}
                className="p-2 text-white/50 hover:text-red-500 transition-all"
                title="Hapus Playlist"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'Lagu' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Lagu Disukai</h2>
            {likedSongs.length > 0 && (
              <button
                onClick={() => playTrack(likedSongs[0], likedSongs, 'playlist')}
                className="w-10 h-10 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform"
              >
                <Play className="w-5 h-5 fill-current ml-0.5" />
              </button>
            )}
          </div>
          <div className="space-y-1">
            {likedSongs.map((track) => (
              <TrackItem key={track.videoId} track={track} queue={likedSongs} />
            ))}
            {likedSongs.length === 0 && (
              <div className="text-center text-white/50 py-12">Belum ada lagu yang disukai.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Album' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Album Disimpan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {savedAlbums.map((album) => (
              <div 
                key={album.albumId} 
                className="flex flex-col items-center p-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                onClick={() => router.push(`/album/${album.albumId}`)}
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg">
                  <Image 
                    src={album.thumbnails?.[album.thumbnails.length - 1]?.url || '/placeholder.png'} 
                    alt={album.name} 
                    fill 
                    sizes="(max-width: 640px) 50vw, 200px" 
                    className="object-cover" 
                  />
                </div>
                <MarqueeText text={album.name} className="text-white font-medium text-center w-full" />
                <p className="text-white/50 text-xs mt-1 text-center w-full truncate">{album.artist}</p>
              </div>
            ))}
            {savedAlbums.length === 0 && (
              <div className="col-span-full text-center text-white/50 py-12">Belum ada album yang disimpan.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'Artis' && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white mb-4">Artis yang Disubscribe</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {subscribedArtists.map((artist) => (
              <div 
                key={artist.artistId} 
                className="flex flex-col items-center p-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                onClick={() => router.push(`/artist/${artist.artistId}`)}
              >
                <div className="relative w-24 h-24 rounded-full overflow-hidden mb-3 shadow-lg">
                  <Image 
                    src={artist.thumbnails?.[artist.thumbnails.length - 1]?.url || '/placeholder.png'} 
                    alt={artist.name} 
                    fill 
                    sizes="96px" 
                    className="object-cover" 
                  />
                </div>
                <MarqueeText text={artist.name} className="text-white font-medium text-center" />
                <p className="text-white/50 text-xs mt-1">Artis</p>
              </div>
            ))}
            {subscribedArtists.length === 0 && (
              <div className="col-span-full text-center text-white/50 py-12">Belum ada artis yang disubscribe.</div>
            )}
          </div>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">Create Playlist</h2>
            
            <div className="flex justify-center mb-6">
              <label className="relative w-32 h-32 rounded-xl overflow-hidden cursor-pointer group bg-white/5 flex items-center justify-center border border-dashed border-white/20 hover:border-white/50 transition-colors">
                {newPlaylistImg ? (
                  <Image src={newPlaylistImg} alt="Preview" fill sizes="144px" className="object-cover" />
                ) : (
                  <ListMusic className="w-8 h-8 text-white/50" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-xs font-semibold text-white">Upload Image</span>
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>

            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist Name"
              className="w-full bg-black text-white rounded-xl py-3 px-4 mb-6 focus:outline-none focus:ring-1 focus:ring-white/30 border border-white/10"
            />

            <div className="flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="flex-1 py-3 rounded-xl font-semibold text-black bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Import Playlist Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C1C1E] rounded-2xl p-6 w-full max-w-sm border border-white/10">
            <h2 className="text-xl font-bold text-white mb-6">Impor Playlist</h2>
            
            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-2">Impor dari YouTube (Link / ID)</label>
              <input
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://youtube.com/playlist?list=..."
                className="w-full bg-black text-white rounded-xl py-3 px-4 mb-3 focus:outline-none focus:ring-1 focus:ring-white/30 border border-white/10"
                disabled={isImporting}
              />
              <button
                onClick={handleImportPlaylistUrl}
                disabled={!importUrl.trim() || isImporting}
                className="w-full py-3 rounded-xl font-semibold text-black bg-white hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isImporting ? 'Mengimpor...' : 'Impor dari URL'}
              </button>
            </div>

            <div className="relative flex items-center py-2 mb-6 text-white/30 text-sm">
              <div className="flex-grow border-t border-white/10"></div>
              <span className="flex-shrink-0 mx-4">ATAU</span>
              <div className="flex-grow border-t border-white/10"></div>
            </div>

            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-2">Impor dari File JSON</label>
              <label className="w-full flex items-center justify-center py-3 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/20 cursor-pointer transition-colors border border-dashed border-white/20">
                <UploadCloud className="w-5 h-5 mr-2" />
                {isImporting ? 'Mengimpor...' : 'Pilih File JSON'}
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" disabled={isImporting} />
              </label>
            </div>

            <button
              onClick={() => {
                setShowImport(false);
                setImportUrl('');
              }}
              disabled={isImporting}
              className="w-full py-3 rounded-xl font-semibold text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Hapus Playlist"
        message="Apakah Anda yakin ingin menghapus playlist ini?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <AlertModal
        isOpen={!!alertMessage}
        title={alertMessage?.title}
        message={alertMessage?.message || ''}
        onClose={() => setAlertMessage(null)}
      />
    </main>
  );
}
