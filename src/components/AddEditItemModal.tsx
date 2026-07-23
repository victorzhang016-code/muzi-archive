import React, { useState, useEffect, useCallback } from 'react';
import { X, Upload, Loader2, Crop as CropIcon } from 'lucide-react';
import { WardrobeItem, NewWardrobeItem, Category, Season, PantsLength, TopType, TOP_TYPES, BOTTOM_TYPES, AccessoryType, ACCESSORY_TYPES } from '../types';
import { auth } from '../lib/authCompat';
import { createWardrobeItem, updateWardrobeItem } from '../lib/supabaseData';
import { cn } from '../lib/utils';
import Cropper from 'react-easy-crop';
import getCroppedImg, { compressToBase64, normalizeImageFile } from '../lib/cropImage';
import { uploadImageToBlob } from '../lib/blobUpload';
import { resolveMediaUrl } from '../lib/media';
import { MargielaRating } from './MargielaRating';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  itemToEdit?: WardrobeItem | null;
  defaultCategory?: Category;
}

const CATEGORIES: Category[] = ['上装', '下装', '鞋子', '配饰'];
const SEASONS: Season[] = ['春秋', '春季', '秋季', '秋冬', '夏季', '冬季', '四季', '无'];

export function AddEditItemModal({ isOpen, onClose, itemToEdit, defaultCategory }: Props) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<Category>('上装');
  const [season, setSeason] = useState<Season>('春秋');
  const [length, setLength] = useState<PantsLength | ''>('');
  const [topType, setTopType] = useState<TopType | ''>('');
  const [accessoryType, setAccessoryType] = useState<AccessoryType | ''>('');
  const [rating, setRating] = useState<number>(5);
  const [story, setStory] = useState('');
  const [purchaseYear, setPurchaseYear] = useState<number | ''>(new Date().getFullYear());
  const [imageBase64, setImageBase64] = useState<string | null>(null); // compressed base64 stored in Firestore
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false); // HEIC→JPEG 转换中
  const [error, setError] = useState<string | null>(null);

  // Cropper state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setBrand(itemToEdit.brand ?? '');
      setCategory(itemToEdit.category);
      setSeason(itemToEdit.season);
      setLength(itemToEdit.length ?? '');
      setTopType(itemToEdit.topType ?? '');
      setAccessoryType(itemToEdit.accessoryType ?? '');
      setRating(itemToEdit.rating);
      setStory(itemToEdit.story);
      setPurchaseYear(itemToEdit.purchaseYear ?? '');
      setImagePreview(resolveMediaUrl(itemToEdit.imageUrl) || null);
      setImageBase64(null); // no new image selected yet
    } else {
      resetForm();
    }
  }, [itemToEdit, isOpen, defaultCategory]);

  const resetForm = () => {
    setName('');
    setBrand('');
    setCategory(defaultCategory ?? '上装');
    setSeason('春秋');
    setLength('');
    setTopType('');
    setRating(5);
    setStory('');
    setPurchaseYear(new Date().getFullYear());
    setImageBase64(null);
    setImagePreview(null);
    setError(null);
    setCropImageSrc(null);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so the same file can be selected again
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError('原图不能超过 20MB，建议先用手机相册压缩后再试');
      return;
    }
    setError(null);
    try {
      // HEIC/HEIF 先转 JPEG，裁剪器才能显示（非 HEIC 直通，零成本）
      setConverting(true);
      const normalized = await normalizeImageFile(file);
      setConverting(false);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCropImageSrc(reader.result as string);
      };
      reader.readAsDataURL(normalized);
    } catch (err) {
      console.error('image normalize failed', err);
      setConverting(false);
      setError('这张图片无法读取（可能是不支持的格式），请换一张试试');
    }
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    setConverting(true);
    try {
      const croppedFile = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      if (croppedFile) {
        // 压缩成小图 → 上传到 Vercel Blob，存它返回的公开 URL（不再把 base64 塞进 Firestore）
        const base64 = await compressToBase64(croppedFile);
        const url = await uploadImageToBlob(base64);
        setImageBase64(url);
        setImagePreview(url);
        setCropImageSrc(null);
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '图片处理失败，请重试');
    } finally {
      setConverting(false);
    }
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      setError('身份验证中...');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use newly selected blob path, or keep the existing image reference.
      const imageUrl = imageBase64 ?? (itemToEdit?.imageUrl || '');

      if (itemToEdit) {
        // Update
        await updateWardrobeItem(itemToEdit.id, {
          name,
          brand: brand || undefined,
          category,
          season,
          ...(category === '下装' && length ? { length } : { length: undefined }),
          ...(category === '上装' && topType ? { topType } : { topType: undefined }),
          ...(category === '配饰' && accessoryType ? { accessoryType } : { accessoryType: undefined }),
          rating,
          story,
          imageUrl,
          ...(purchaseYear !== '' ? { purchaseYear: Number(purchaseYear) } : { purchaseYear: undefined }),
        });
      } else {
        // Create
        const newItem: NewWardrobeItem = {
          userId: auth.currentUser.uid,
          name,
          ...(brand ? { brand } : {}),
          category,
          season,
          ...(category === '下装' && length ? { length } : {}),
          ...(category === '上装' && topType ? { topType } : {}),
          ...(category === '配饰' && accessoryType ? { accessoryType } : {}),
          rating,
          story,
          imageUrl,
          ...(purchaseYear !== '' ? { purchaseYear: Number(purchaseYear) } : {}),
          orderIndex: Date.now(),
        };
        
        await createWardrobeItem(auth.currentUser.uid, newItem);
      }
      
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("Submit error:", err);
      const errorCode = err.code ? ` (错误代码: ${err.code})` : '';
      const errorMessage = err.message || '未知错误';
      const fullError = `保存失败: ${errorMessage}${errorCode}`;
      setError(fullError);
      alert(fullError);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="bg-kraft rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border border-dashed border-graphite/25">
        <div className="sticky top-0 bg-kraft border-b border-graphite/20 px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-lg font-tag font-bold text-ink uppercase tracking-wider">
            {cropImageSrc ? '裁剪图片' : (itemToEdit ? '编辑衣物' : '添加新衣物')}
          </h2>
          <button onClick={cropImageSrc ? handleCropCancel : onClose} className="p-2 hover:bg-white transition-colors border border-transparent hover:border-graphite/20">
            <X className="w-5 h-5 text-graphite" />
          </button>
        </div>

        {cropImageSrc ? (
          <div className="p-4 sm:p-6 flex flex-col h-[55vh] min-h-[300px] sm:min-h-[400px]">
            <div className="text-center mb-4 shrink-0">
              <p className="text-sm text-graphite font-medium">拖动图片调整位置，滑动底部控制缩放</p>
            </div>
            <div className="relative flex-1 bg-ink overflow-hidden border border-graphite/20">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={12}
                zoomSpeed={1}
                zoomWithScroll
                objectFit="cover"
                aspect={3 / 4}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                onWheelRequest={() => true}
              />
            </div>
            <div className="mt-6 flex items-center gap-4">
              <span className="font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite whitespace-nowrap">缩放</span>
              <div className="flex-1 relative h-6 flex items-center">
                {/* Custom styled range track */}
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={12}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full cursor-pointer"
                  style={{
                    appearance: 'none',
                    height: '2px',
                    background: `linear-gradient(to right, #1C1C1A ${((zoom - 1) / 11) * 100}%, rgba(107,106,101,0.25) ${((zoom - 1) / 11) * 100}%)`,
                    outline: 'none',
                    borderRadius: '0',
                  }}
                />
              </div>
              <span className="font-tag text-[9px] text-graphite/50 w-8 text-right">{zoom.toFixed(1)}×</span>
            </div>
            <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-graphite/20 shrink-0">
              <button
                type="button"
                onClick={handleCropCancel}
                className="px-6 py-2 font-tag text-[9px] uppercase tracking-[0.2em] font-bold text-graphite hover:text-ink transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCropConfirm}
                disabled={converting}
                className="px-6 py-2 bg-ink text-white text-xs uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CropIcon className="w-4 h-4" />}
                {converting ? '上传中…' : '确认裁剪'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-stamp border border-red-100 text-sm font-medium">
              {error}
            </div>
          )}

          {/* Image Upload */}
          <div>
            <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">图片</label>
            <div className="flex justify-center bg-rule/10 border border-graphite/20 p-6">
              <div className="relative group cursor-pointer w-full max-w-[240px] aspect-[3/4]">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleImageChange}
                  disabled={converting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20 disabled:cursor-wait"
                />
                <div className={cn(
                  "w-full h-full border border-dashed flex flex-col items-center justify-center overflow-hidden transition-colors bg-white",
                  imagePreview ? "border-transparent" : "border-graphite/20 group-hover:border-graphite"
                )}>
                  {converting ? (
                    <div className="text-graphite flex flex-col items-center gap-2 p-4 text-center">
                      <Loader2 className="w-6 h-6 mb-2 animate-spin opacity-60" />
                      <span className="text-sm font-medium">转换图片中…</span>
                      <span className="text-[10px] uppercase tracking-widest opacity-70">HEIC 转 JPEG</span>
                    </div>
                  ) : imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-ink/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                        <span className="text-white font-medium flex items-center gap-2 text-sm uppercase tracking-widest">
                          <Upload className="w-4 h-4" /> 更换图片
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-graphite flex flex-col items-center gap-2 p-4 text-center">
                      <Upload className="w-6 h-6 mb-2 opacity-50" />
                      <span className="text-sm font-medium">点击或拖拽上传</span>
                      <span className="text-[10px] uppercase tracking-widest opacity-70">支持 JPG / PNG / HEIC 等</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">名称</label>
              <input
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors font-serif text-lg"
                placeholder="例如：水绿色夹克"
              />
            </div>

            <div>
              <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">品牌</label>
              <input
                type="text"
                maxLength={60}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors font-tag text-sm"
                placeholder="例如：C2H4"
              />
            </div>
          </div>

          {/* 评分 —— 整宽强调块，红框红标，避免被忽略 */}
          <div className="bg-stamp/5 border border-stamp/30 px-4 py-3.5">
            <label className="block font-tag text-[10px] uppercase tracking-[0.2em] font-bold text-stamp mb-1">
              评分 / Rating
            </label>
            <p className="font-story text-xs text-graphite/60 mb-3">这件在你心里值几分？（0–10）</p>
            <MargielaRating
              rating={rating}
              size="lg"
              interactive
              onChange={setRating}
              accentColor="#C24127"
              dimColor="rgba(107,106,101,0.35)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">季节</label>
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value as Season)}
                className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
              >
                {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {category === '下装' && (
              <div>
                <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">类型</label>
                <select
                  value={length}
                  onChange={(e) => setLength(e.target.value as PantsLength | '')}
                  className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
                >
                  <option value="">未指定</option>
                  {BOTTOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {category === '上装' && (
              <div>
                <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">类型</label>
                <select
                  value={topType}
                  onChange={(e) => setTopType(e.target.value as TopType | '')}
                  className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
                >
                  <option value="">未指定</option>
                  {TOP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            {category === '配饰' && (
              <div>
                <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">类型</label>
                <select
                  value={accessoryType}
                  onChange={(e) => setAccessoryType(e.target.value as AccessoryType | '')}
                  className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
                >
                  <option value="">未指定</option>
                  {ACCESSORY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">购买年份</label>
              <select
                value={purchaseYear}
                onChange={(e) => setPurchaseYear(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors text-sm"
              >
                <option value="">未知</option>
                {Array.from({ length: new Date().getFullYear() - 1999 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite mb-2">故事 / 描述</label>
            <textarea
              required
              maxLength={5000}
              rows={4}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-graphite/20 focus:border-ink outline-none transition-colors resize-none font-serif leading-relaxed"
              placeholder="这件衣服背后的故事..."
            />
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t border-graphite/20">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 font-tag text-[9px] uppercase tracking-[0.2em] font-bold text-graphite hover:text-ink transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-ink text-white font-tag text-[9px] uppercase tracking-[0.2em] font-bold hover:bg-ink/90 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              保存
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
