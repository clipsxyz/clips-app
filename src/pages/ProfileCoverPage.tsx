import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiChevronLeft, FiImage, FiTrash2 } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { useAuth } from '../context/Auth';
import { bottomSheet } from '../utils/swalBottomSheet';
import { uploadFile } from '../api/client';

export default function ProfileCoverPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const [isSaving, setIsSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const coverUrl = (user as any)?.profileBackgroundUrl || '';

  const fileToDataUrl = React.useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });
  }, []);

  const saveCoverUrl = React.useCallback((nextUrl: string) => {
    if (!user) return;
    login({ ...(user as any), profileBackgroundUrl: nextUrl || undefined });
  }, [login, user]);

  const handleFileSelected = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Swal.fire(bottomSheet({ title: 'Invalid file', message: 'Please choose an image file.', icon: 'alert' }));
      e.target.value = '';
      return;
    }

    setIsSaving(true);
    try {
      let nextCoverUrl = '';
      const useLaravelApi = typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_LARAVEL_API !== 'false';

      if (useLaravelApi) {
        try {
          const upload = await uploadFile(file);
          if (upload?.success && upload?.fileUrl) nextCoverUrl = upload.fileUrl;
        } catch (_) {
          // Fallback below.
        }
      }

      if (!nextCoverUrl) {
        nextCoverUrl = await fileToDataUrl(file);
      }

      saveCoverUrl(nextCoverUrl);
      Swal.fire(bottomSheet({ title: 'Cover updated', message: 'Your profile cover image has been updated.', icon: 'success' }));
    } catch (error: any) {
      Swal.fire(bottomSheet({ title: 'Upload failed', message: error?.message || 'Could not update cover image.', icon: 'alert' }));
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  }, [fileToDataUrl, saveCoverUrl]);

  const handleRemove = React.useCallback(() => {
    saveCoverUrl('');
    Swal.fire(bottomSheet({ title: 'Cover removed', message: 'Your profile is back to the default map background.', icon: 'success' }));
  }, [saveCoverUrl]);

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/75 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/profile')}
            className="h-10 w-10 rounded-full border border-white/20 bg-black/60 flex items-center justify-center hover:bg-white/10 transition-colors"
            aria-label="Back to profile"
          >
            <FiChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Profile Cover</h1>
            <p className="text-xs text-gray-400">Choose the background shown behind your profile picture</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="rounded-2xl overflow-hidden border border-white/15 bg-black">
          <img
            src={coverUrl || '/placeholders/world-map.jpg'}
            alt="Profile cover preview"
            className="w-full h-56 object-cover opacity-85"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/placeholders/world-map.jpg';
            }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
            className="py-3 rounded-xl bg-white text-black font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <FiImage className="w-4.5 h-4.5" />
            {isSaving ? 'Saving...' : 'Upload image'}
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isSaving || !coverUrl}
            className="py-3 rounded-xl border border-white/30 bg-black text-white font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FiTrash2 className="w-4.5 h-4.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
