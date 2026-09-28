import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const MAX_DIMENSION = 1600
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export interface PickImageResult {
  file: File
  previewUrl: string
}

/**
 * Validates and downscales an image to maximum 1600px on longest side
 */
export async function processImageFile(file: File): Promise<PickImageResult> {
  // Validate type
  const mimeType = file.type.toLowerCase()
  if (!ALLOWED_TYPES.includes(mimeType) && !mimeType.includes('jpeg') && !mimeType.includes('png') && !mimeType.includes('webp')) {
    throw new Error('Unsupported image format. Please use JPG, PNG, or WebP.')
  }

  // Downscale if needed via Canvas
  const processedBlob = await new Promise<Blob>((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width)
          width = MAX_DIMENSION
        } else {
          width = Math.round((width * MAX_DIMENSION) / height)
          height = MAX_DIMENSION
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, width, height)
      const targetType = mimeType.includes('png') ? 'image/png' : 'image/jpeg'
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            resolve(file)
          }
        },
        targetType,
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to read and process image.'))
    }

    img.src = objectUrl
  })

  // Validate size after downscaling
  if (processedBlob.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image size exceeds the 5 MB limit. Please select a smaller photo.')
  }

  const finalFile = new File([processedBlob], file.name || `photo_${Date.now()}.jpg`, {
    type: processedBlob.type,
    lastModified: Date.now()
  })

  return {
    file: finalFile,
    previewUrl: URL.createObjectURL(finalFile)
  }
}

/**
 * Native camera picker with "Take Photo" or "Choose from Gallery" prompt
 */
export async function pickNativeImage(): Promise<PickImageResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native camera picker called outside native environment.')
  }

  try {
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      promptLabelHeader: 'Attach Photo',
      promptLabelPhoto: 'Choose from Gallery',
      promptLabelPicture: 'Take Photo'
    })

    if (!photo.webPath) {
      throw new Error('No image was captured or selected.')
    }

    const response = await fetch(photo.webPath)
    const blob = await response.blob()
    const fileName = `item_${Date.now()}.${photo.format || 'jpg'}`
    const rawFile = new File([blob], fileName, { type: blob.type || 'image/jpeg' })

    return await processImageFile(rawFile)
  } catch (err: any) {
    const message = (err?.message || '').toLowerCase()
    if (message.includes('user cancelled') || message.includes('cancel')) {
      throw new Error('cancelled')
    }
    if (message.includes('permission') || message.includes('denied')) {
      throw new Error('Camera or photo permission was denied. Please grant permission in device Settings.')
    }
    throw new Error(err.message || 'Unable to open camera or photo gallery.')
  }
}
