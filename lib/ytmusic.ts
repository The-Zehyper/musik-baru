import YTMusic from 'ytmusic-api';

const ytmusic = new YTMusic();
let initPromise: Promise<any> | null = null;

export async function getYTMusic() {
  if (!initPromise) {
    initPromise = ytmusic.initialize().catch(err => {
      initPromise = null;
      throw err;
    });
  }
  await initPromise;
  return ytmusic;
}
