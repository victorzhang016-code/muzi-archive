import { auth } from '../firebase';

/**
 * 把一张压缩后的图（base64 dataURL）传到 Vercel Blob，返回公开 https URL。
 * 服务端 `/api/blob-upload` 验证 Firebase 身份后存 Blob —— 前端拿 URL 存进 Firestore，
 * 不再把 base64 塞进文档。
 */
export async function uploadImageToBlob(dataUrl: string): Promise<string> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('未登录，无法上传图片');

  const res = await fetch('/api/blob-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ image: dataUrl }),
  });

  if (!res.ok) {
    let msg = `图片上传失败 (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg += `：${j.error}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const { url } = await res.json();
  if (!url || typeof url !== 'string') throw new Error('图片上传未返回地址');
  return url;
}
