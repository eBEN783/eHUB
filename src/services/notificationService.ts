/**
 * Push Notification & Alert Service for eHUB
 * Handles:
 * 1. Web Notification API (Browser push notifications)
 * 2. Sound synthesis using Web Audio API (Zero external assets/CORS dependencies)
 * 3. Haptic vibration feedback
 * 4. In-App Notification Center persistence & low balance checks
 */

import { PushNotificationItem, NotificationSettings, NotificationType } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  transactionSuccessAlerts: true,
  lowBalanceAlerts: true,
  lowBalanceThreshold: 500, // ₦500.00
  soundEnabled: true,
  vibrateEnabled: true,
};

const LOGO_ICON_URL = '/assets/aistudio/Bee_concepts_logo_design_3d5073c9.png';

/**
 * Check if Browser Notifications are supported
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current Browser Notification Permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request Browser Notification Permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.warn('[NotificationService] Permission request error:', err);
    return Notification.permission;
  }
}

/**
 * Synthesize audio chime using Web Audio API (completely offline, robust)
 */
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a friendly, crisp chime for successful transactions
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Primary Tone: C6 (1046.5Hz) -> E6 (1318.5Hz) -> G6 (1567.98Hz)
    const notes = [
      { freq: 1046.5, start: 0, duration: 0.12 },
      { freq: 1318.5, start: 0.08, duration: 0.14 },
      { freq: 1567.98, start: 0.16, duration: 0.28 },
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.18, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.debug('Audio chime playback failed:', err);
  }
}

/**
 * Play an alert chime for Low Balance warning
 */
export function playWarningChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    
    // Two gentle pulse warning tones (A4: 440Hz -> F4: 349.23Hz)
    const notes = [
      { freq: 523.25, start: 0, duration: 0.16 }, // C5
      { freq: 440.0, start: 0.15, duration: 0.25 },  // A4
    ];

    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);

      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (err) {
    console.debug('Warning chime playback failed:', err);
  }
}

/**
 * Trigger device vibration if available
 */
export function triggerHaptic(pattern: number[] = [80, 40, 80]) {
  if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore vibration errors
    }
  }
}

/**
 * Retrieve saved notification preferences
 */
export function getSavedNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const stored = localStorage.getItem('ehub_notification_settings');
    if (!stored) return DEFAULT_NOTIFICATION_SETTINGS;
    return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

/**
 * Persist notification preferences
 */
export function saveNotificationSettings(settings: NotificationSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('ehub_notification_settings', JSON.stringify(settings));
  } catch (err) {
    console.warn('[NotificationService] Failed to save settings:', err);
  }
}

/**
 * Retrieve notifications for a specific user
 */
export function getSavedNotifications(userId?: string): PushNotificationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = userId ? `ehub_notifications_${userId}` : 'ehub_notifications';
    const stored = localStorage.getItem(key);
    if (!stored) return [];
    const list: PushNotificationItem[] = JSON.parse(stored);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Persist notifications for a specific user
 */
export function saveNotifications(notifications: PushNotificationItem[], userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `ehub_notifications_${userId}` : 'ehub_notifications';
    localStorage.setItem(key, JSON.stringify(notifications.slice(0, 50))); // Keep latest 50
  } catch (err) {
    console.warn('[NotificationService] Failed to save notifications:', err);
  }
}

/**
 * Dispatch a Browser Push Notification + sound + haptic feedback
 */
export function sendPushAlert({
  title,
  body,
  type,
  settings,
}: {
  title: string;
  body: string;
  type: NotificationType;
  settings?: NotificationSettings;
}): void {
  const currentSettings = settings || getSavedNotificationSettings();

  // 1. Play Sound
  if (currentSettings.soundEnabled) {
    if (type === 'low_balance') {
      playWarningChime();
    } else {
      playSuccessChime();
    }
  }

  // 2. Trigger Haptic Vibration
  if (currentSettings.vibrateEnabled) {
    if (type === 'low_balance') {
      triggerHaptic([120, 60, 120]);
    } else {
      triggerHaptic([70, 40, 90]);
    }
  }

  // 3. Web Notification API (Browser push)
  if (currentSettings.pushEnabled && isBrowserNotificationSupported()) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: LOGO_ICON_URL,
          badge: LOGO_ICON_URL,
          tag: `ehub_${type}_${Date.now()}`,
          requireInteraction: type === 'low_balance',
        });
      } catch (err) {
        console.debug('Native browser notification dispatch error:', err);
      }
    }
  }
}
