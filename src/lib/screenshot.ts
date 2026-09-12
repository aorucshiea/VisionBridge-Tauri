import type { ScreenshotRegion } from '../types'

export interface CaptureResult {
  dataUrl: string
  width: number
  height: number
}

export const MIN_IMAGE_SIZE = 100

/**
 * Capture the selected screen region as a cropped JPEG base64 string.
 * Handles HiDPI (devicePixelRatio) scaling and upscales very small
 * selections so OCR/vision models can still read them.
 */
export async function captureRegion(region: ScreenshotRegion): Promise<string> {
  const dataUrl = await window.ipcRenderer.captureScreen()
  const img = new Image()
  img.src = dataUrl
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load captured screen'))
  })

  const canvas = document.createElement('canvas')
  canvas.width = region.width
  canvas.height = region.height
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1

  ctx?.drawImage(
    img,
    Math.round(region.x * dpr),
    Math.round(region.y * dpr),
    Math.round(region.width * dpr),
    Math.round(region.height * dpr),
    0,
    0,
    region.width,
    region.height,
  )

  let finalCanvas = canvas
  if (region.width < MIN_IMAGE_SIZE || region.height < MIN_IMAGE_SIZE) {
    const scale = Math.max(MIN_IMAGE_SIZE / region.width, MIN_IMAGE_SIZE / region.height)
    const resizedCanvas = document.createElement('canvas')
    resizedCanvas.width = Math.round(region.width * scale)
    resizedCanvas.height = Math.round(region.height * scale)
    resizedCanvas.getContext('2d')?.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height)
    finalCanvas = resizedCanvas
  }

  return finalCanvas.toDataURL('image/jpeg', 0.9).split(',')[1]
}
