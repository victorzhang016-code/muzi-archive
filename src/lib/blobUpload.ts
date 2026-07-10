import { auth } from '../lib/authCompat';

/**
 * 鎶婁竴寮犲帇缂╁悗鐨勫浘锛坆ase64 dataURL锛変紶鍒?Vercel Blob锛岃繑鍥炲叕寮€ https URL銆? * 鏈嶅姟绔?`/api/blob-upload` 楠岃瘉 Firebase 韬唤鍚庡瓨 Blob 鈥斺€?鍓嶇鎷?URL 瀛樿繘 Firestore锛? * 涓嶅啀鎶?base64 濉炶繘鏂囨。銆? */
export async function uploadImageToBlob(dataUrl: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('鏈櫥褰曪紝鏃犳硶涓婁紶鍥剧墖');

  const res = await fetch('/api/blob-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ image: dataUrl }),
  });

  if (!res.ok) {
    let msg = `鍥剧墖涓婁紶澶辫触 (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg += `锛?{j.error}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data?.blobPath || typeof data.blobPath !== 'string') throw new Error('鍥剧墖涓婁紶鏈繑鍥炲湴鍧€');
  return data.blobPath;
}

