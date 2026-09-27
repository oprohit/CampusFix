import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mpqivpxswksjqkohhjje.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QHCcnFUxdqD5AQ6nbc8jIQ_Chnp6ssW';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

export const STORAGE_BUCKET = 'CampusFixer';

/**
 * Upload image to Supabase Storage bucket CampusFixer
 * @param {File} file 
 * @returns {Promise<string>} Public URL of uploaded image
 */
export async function uploadIssueImage(file) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `issues/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.warn('Supabase storage upload error, using local object preview:', error);
    return URL.createObjectURL(file);
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData?.publicUrl || URL.createObjectURL(file);
}
