import { X } from "lucide-react";

interface EmbedOverlayProps {
  src: string;
  title: string;
  onClose: () => void;
}

export default function EmbedOverlay({ src, title, onClose }: EmbedOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-6xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-white/80">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" /> Close
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-2xl">
          <iframe
            src={src}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
