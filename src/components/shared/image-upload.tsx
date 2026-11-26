'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle2, RefreshCcw, AlertTriangle, Library } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadImageToR2 } from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ImageLibraryDialog } from '@/components/admin/image-library-dialog';

interface ImageUploadProps {
  onUploadComplete: (url: string) => void;
  defaultValue?: string | null;
  label?: string;
  category?: string;
  className?: string;
  hideIcons?: boolean;
}

export function ImageUpload({ onUploadComplete, defaultValue, label, category, className, hideIcons }: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(defaultValue || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultValue) setPreview(defaultValue);
  }, [defaultValue]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File Too Large", description: "Max limit is 10MB." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setIsUploading(true);
    setIsSuccess(false);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category || 'other');
      
      const result = await uploadImageToR2(formData);
      
      if (result.success && result.url) {
        onUploadComplete(result.url);
        setIsSuccess(true);
        toast({ title: "Asset Synchronized", description: "Image deployed to Cloudflare R2." });
      } else {
        setError(result.message || 'Infrastructure Failure');
      }
    } catch (err: any) {
      setError('Connection timeout during asset handshake.');
      setPreview(defaultValue || null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLibrarySelect = (url: string) => {
    setPreview(url);
    onUploadComplete(url);
    setIsSuccess(true);
    setError(null);
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onUploadComplete('');
    setIsSuccess(false);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between px-1">
        {label && <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{label}</label>}
        <button 
          type="button"
          onClick={() => setIsLibraryOpen(true)}
          className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 hover:underline"
        >
          <Library className="w-3.5 h-3.5" /> Select from Library
        </button>
      </div>
      
      <div 
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={cn(
          "relative group border-2 border-dashed rounded-3xl transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden min-h-[180px]",
          preview ? "border-zinc-100 bg-white shadow-sm" : "border-zinc-200 bg-zinc-50 hover:border-primary/40 hover:bg-primary/5",
          isUploading && "opacity-50 cursor-not-allowed",
          error && "border-red-200 bg-red-50/30"
        )}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
          accept="image/*" 
        />

        {preview ? (
          <>
            <img src={preview} alt="Preview" className="w-full h-full object-cover absolute inset-0" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
               {!hideIcons && <ImageIcon className="w-10 h-10 text-white" />}
            </div>
            <button 
              onClick={removeImage}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white shadow-2xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all z-20 active:scale-90"
            >
              {!hideIcons ? <X className="w-5 h-5" /> : <span className="text-[8px] font-black uppercase">Remove</span>}
            </button>
            
            <div className="absolute bottom-3 left-3 flex gap-2 z-20">
               {isSuccess && !isUploading && (
                  <div className="bg-green-500 text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in zoom-in shadow-lg">
                    {!hideIcons && <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span className="text-[8px] font-black uppercase tracking-widest">Ready</span>
                  </div>
               )}
               {isUploading && (
                  <div className="bg-primary text-white px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in zoom-in shadow-lg">
                    {!hideIcons && <RefreshCcw className="w-3.5 h-3.5 animate-spin" />}
                    <span className="text-[8px] font-black uppercase tracking-widest">Processing...</span>
                  </div>
               )}
            </div>
          </>
        ) : (
          <div className="text-center p-8 space-y-4">
            {!hideIcons && (
              <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mx-auto text-zinc-300 group-hover:text-primary transition-all group-hover:scale-110 border border-zinc-100">
                <Upload className="w-7 h-7" />
              </div>
            )}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {hideIcons ? 'SELECT ASSET' : 'Drop File Here'}
              </p>
              <p className="text-[8px] font-bold text-zinc-300 uppercase tracking-widest mt-1">
                {hideIcons ? 'CAMERA READY' : 'PNG, JPG or WebP (Max 10MB)'}
              </p>
            </div>
          </div>
        )}

        {error && !isUploading && (
          <div className="absolute inset-0 bg-red-50/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center gap-2 z-30">
            {!hideIcons && <AlertTriangle className="w-8 h-8 text-red-500" />}
            <p className="text-[10px] font-black uppercase text-red-600 tracking-widest">Failed</p>
            <p className="text-[9px] text-red-500 font-bold max-w-[200px]">{error}</p>
          </div>
        )}
      </div>

      <ImageLibraryDialog 
        isOpen={isLibraryOpen} 
        onClose={() => setIsLibraryOpen(false)} 
        onSelect={handleLibrarySelect}
        category={category}
      />
    </div>
  );
}
