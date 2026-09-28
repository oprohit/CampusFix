import { App as CapApp } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import { SplashScreen } from '@capacitor/splash-screen'
import { Capacitor } from '@capacitor/core'

type ModalCloseHandler = () => boolean // returns true if modal was closed

const modalHandlers: ModalCloseHandler[] = []

export function registerModal(handler: ModalCloseHandler): () => void {
  modalHandlers.push(handler)
  return () => {
    const idx = modalHandlers.indexOf(handler)
    if (idx !== -1) {
      modalHandlers.splice(idx, 1)
    }
  }
}

/**
 * Initializes native Capacitor features: StatusBar, SplashScreen, and Android hardware back button
 */
export function initNativeFeatures(navigateBack: () => void, getCurrentPath: () => string) {
  if (!Capacitor.isNativePlatform()) return

  // 1. Status Bar Setup
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: '#0B0B1E' }).catch(() => {})
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})

  // 2. Hide Splash Screen smoothly once app mounts
  SplashScreen.hide().catch(() => {})

  // 3. Android Hardware Back Button
  CapApp.addListener('backButton', () => {
    // Check if any modal is open and handle it first
    for (let i = modalHandlers.length - 1; i >= 0; i--) {
      const closed = modalHandlers[i]()
      if (closed) {
        return
      }
    }

    const currentPath = getCurrentPath()
    // If on native initial/home screen, exit app
    if (currentPath === '/' || currentPath === '/chat') {
      CapApp.exitApp()
    } else {
      navigateBack()
    }
  })
}
