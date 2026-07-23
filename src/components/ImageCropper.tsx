import { useCallback, useState } from 'react';
import { Crop as CropIcon, Loader2, X } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../lib/cropImage';

const ASPECT = 3 / 4;
const MAX_ZOOM = 12;

interface ImageCropperPanelProps {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (file: File) => Promise<void> | void;
}

export function ImageCropperPanel({ imageSrc, onCancel, onConfirm }: ImageCropperPanelProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [processing, setProcessing] = useState(false);

  const onCropComplete = useCallback((_croppedArea: unknown, areaPixels: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const confirm = async () => {
    if (!croppedAreaPixels || processing) return;
    setProcessing(true);
    try {
      const file = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (!file) throw new Error('图片裁剪失败');
      await onConfirm(file);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 flex flex-col h-[55vh] min-h-[320px] sm:min-h-[420px]">
      <div className="text-center mb-4 shrink-0">
        <p className="text-sm text-graphite font-medium">拖动调整位置；桌面端滚轮、手机端双指调整缩放</p>
        <p className="text-[11px] text-graphite/55 mt-1">固定 3:4 竖版，横图也会保留更多可调整空间</p>
      </div>
      <div className="relative flex-1 min-h-0 bg-ink overflow-hidden border border-graphite/20 touch-none">
        {/* Keep source framing intact; only the 3:4 crop frame is fixed. */}
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          minZoom={1}
          maxZoom={MAX_ZOOM}
          zoomSpeed={1}
          zoomWithScroll
          objectFit="contain"
          aspect={ASPECT}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          onWheelRequest={() => true}
        />
      </div>
      <div className="mt-5 flex items-center gap-4">
        <span className="font-tag text-[9px] uppercase tracking-[0.2em] font-medium text-graphite whitespace-nowrap">缩放</span>
        <div className="flex-1 relative h-6 flex items-center">
          <input
            type="range"
            value={zoom}
            min={1}
            max={MAX_ZOOM}
            step={0.1}
            aria-label="缩放图片"
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full cursor-pointer"
            style={{
              appearance: 'none',
              height: '2px',
              background: `linear-gradient(to right, #1C1C1A ${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%, rgba(107,106,101,0.25) ${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%)`,
              outline: 'none',
              borderRadius: '0',
            }}
          />
        </div>
        <span className="font-tag text-[9px] text-graphite/50 w-10 text-right">{zoom.toFixed(1)}×</span>
      </div>
      <div className="pt-5 mt-5 flex justify-end gap-3 border-t border-graphite/20 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={processing}
          className="px-6 py-2 font-tag text-[9px] uppercase tracking-[0.2em] font-bold text-graphite hover:text-ink transition-colors disabled:opacity-40"
        >
          <X className="w-3.5 h-3.5 inline mr-1" />取消
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={processing || !croppedAreaPixels}
          className="px-6 py-2 bg-ink text-white text-xs uppercase tracking-widest font-bold hover:bg-ink/90 transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CropIcon className="w-4 h-4" />}
          {processing ? '处理中…' : '确认裁剪'}
        </button>
      </div>
    </div>
  );
}

interface ImageCropperModalProps extends ImageCropperPanelProps {
  title?: string;
}

export function ImageCropperModal({ title = '裁剪图片', ...props }: ImageCropperModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink/80 backdrop-blur-sm">
      <div className="bg-kraft rounded-none w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col border border-dashed border-graphite/25">
        <div className="sticky top-0 bg-kraft border-b border-graphite/20 px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <h2 className="text-lg font-tag font-bold text-ink uppercase tracking-wider">{title}</h2>
          <button type="button" onClick={props.onCancel} className="p-2 hover:bg-white transition-colors border border-transparent hover:border-graphite/20" aria-label="关闭裁剪">
            <X className="w-5 h-5 text-graphite" />
          </button>
        </div>
        <ImageCropperPanel {...props} />
      </div>
    </div>
  );
}
