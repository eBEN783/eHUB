/**
 * Referral Program Service for eHUB
 * Handles:
 * - Generation and persistence of unique user referral codes
 * - URL referral query capture (?ref=CODE)
 * - Referral bonus awarding (₦100 credited to referrer on signup)
 * - Syncing with Firestore & localStorage
 */

import { EhubUser, Transaction, ReferredUserItem } from '../types';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export const REFERRAL_BONUS_AMOUNT = 100; // ₦100.00 reward per valid referral

/**
 * Generates a clean, professional unique referral code for a user
 */
export function generateReferralCode(seed?: string): string {
  const cleanSeed = (seed || 'EHUB')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${cleanSeed || 'EHUB'}${randomChars}`;
}

/**
 * Returns full referral share link
 */
export function getReferralShareLink(code: string): string {
  if (typeof window === 'undefined') return `https://ehub.ng/?ref=${code}`;
  const origin = window.location.origin;
  return `${origin}/?ref=${encodeURIComponent(code)}`;
}

/**
 * Extract referral code from URL if present
 */
export function detectUrlReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('referral');
    if (ref && ref.trim()) {
      const sanitized = ref.trim().toUpperCase();
      localStorage.setItem('ehub_pending_referral', sanitized);
      return sanitized;
    }
  } catch {
    // Ignore URL parsing errors
  }
  return null;
}

/**
 * Get any stored referral code from an invitation link
 */
export function getStoredReferralCode(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem('ehub_pending_referral') || '';
  } catch {
    return '';
  }
}

/**
 * Process referral reward when a new user registers
 */
export async function awardReferralBonus({
  referralCode,
  newUserId,
  newUserDisplayName,
  newUserEmail,
}: {
  referralCode: string;
  newUserId: string;
  newUserDisplayName: string;
  newUserEmail: string;
}): Promise<{ awarded: boolean; referrerName?: string }> {
  const code = referralCode.trim().toUpperCase();
  if (!code) return { awarded: false };

  try {
    // 1. Check local users database
    const usersStr = localStorage.getItem('ehub_users') || '[]';
    const usersList: EhubUser[] = JSON.parse(usersStr);

    let referrerIndex = usersList.findIndex(
      (u) => u.referralCode && u.referralCode.toUpperCase() === code
    );

    // If not found by exact code, also allow match by userId slice for convenience
    if (referrerIndex === -1) {
      referrerIndex = usersList.findIndex((u) => u.userId.toUpperCase().includes(code));
    }

    if (referrerIndex !== -1) {
      const referrer = usersList[referrerIndex];
      // Do not allow self-referral
      if (referrer.userId === newUserId || referrer.email.toLowerCase() === newUserEmail.toLowerCase()) {
        return { awarded: false };
      }

      const updatedBalance = (referrer.balance || 0) + REFERRAL_BONUS_AMOUNT;
      const updatedEarnings = (referrer.referralEarnings || 0) + REFERRAL_BONUS_AMOUNT;
      const updatedCount = (referrer.referralCount || 0) + 1;

      const newReferredItem: ReferredUserItem = {
        email: newUserEmail,
        displayName: newUserDisplayName || 'eHUB Member',
        date: new Date().toISOString(),
        bonus: REFERRAL_BONUS_AMOUNT,
      };

      const updatedReferredUsers = [newReferredItem, ...(referrer.referredUsers || [])];

      const updatedReferrer: EhubUser = {
        ...referrer,
        balance: updatedBalance,
        referralEarnings: updatedEarnings,
        referralCount: updatedCount,
        referredUsers: updatedReferredUsers,
        updatedAt: new Date().toISOString(),
      };

      usersList[referrerIndex] = updatedReferrer;
      localStorage.setItem('ehub_users', JSON.stringify(usersList));

      // If referrer is the currently active local session, update active user
      const currentRaw = localStorage.getItem('ehub_current');
      if (currentRaw) {
        try {
          const currentParsed: EhubUser = JSON.parse(currentRaw);
          if (currentParsed.userId === referrer.userId) {
            localStorage.setItem('ehub_current', JSON.stringify(updatedReferrer));
          }
        } catch {}
      }

      // Record transaction for referrer
      const referralTx: Transaction = {
        transactionId: 'TX_REF_' + Date.now(),
        userId: referrer.userId,
        type: 'funding',
        title: 'Referral Bonus Credited (+₦100)',
        amount: REFERRAL_BONUS_AMOUNT,
        status: 'successful',
        reference: 'REF_REW_' + Math.floor(Math.random() * 899999 + 100000),
        details: `Referral reward for inviting ${newUserDisplayName} (${newUserEmail}). Thank you for sharing eHUB!`,
        createdAt: new Date().toISOString(),
      };

      try {
        const storedTxStr = localStorage.getItem('ehub_transactions') || '[]';
        const txList: Transaction[] = JSON.parse(storedTxStr);
        txList.unshift(referralTx);
        localStorage.setItem('ehub_transactions', JSON.stringify(txList));
      } catch (e) {
        console.warn('Failed to record referral transaction locally:', e);
      }

      // 2. Sync to Firestore if user document exists
      try {
        const userRef = doc(db, 'users', referrer.userId);
        await setDoc(
          userRef,
          {
            balance: updatedBalance,
            referralEarnings: updatedEarnings,
            referralCount: updatedCount,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Also add transaction in Firestore subcollection
        const txDoc = doc(db, 'users', referrer.userId, 'transactions', referralTx.transactionId);
        await setDoc(txDoc, {
          transactionId: referralTx.transactionId,
          userId: referrer.userId,
          type: referralTx.type,
          title: referralTx.title,
          amount: referralTx.amount,
          status: referralTx.status,
          reference: referralTx.reference,
          details: referralTx.details,
          createdAt: referralTx.createdAt,
        });
      } catch (firestoreErr) {
        console.warn('Firestore referral sync note:', firestoreErr);
      }

      // Clear pending referral after successful application
      localStorage.removeItem('ehub_pending_referral');

      return {
        awarded: true,
        referrerName: referrer.displayName,
      };
    }
  } catch (err) {
    console.warn('Award referral bonus error:', err);
  }

  return { awarded: false };
}
