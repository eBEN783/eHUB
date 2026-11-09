import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Sparkles,
  LogOut,
  User as UserIcon,
  Phone,
  Zap,
  Tv,
  Wifi,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Info,
  Check,
  CreditCard,
  Building2,
  FileText,
  Filter,
  Calendar,
  Search,
  X,
  TrendingDown,
  TrendingUp,
  SlidersHorizontal,
  Sun,
  Moon,
  Fingerprint,
  Settings,
  Shield,
  KeyRound,
  Lock,
  Bell,
  BellRing,
  BellOff,
  Volume2,
  VolumeX,
  CheckCheck,
  Trash2,
  Gift,
  Share2,
  Users
} from 'lucide-react';
import { CONFIG } from './config';
import { DATA_PLANS, CABLE_PACKAGES, DISCO_PROVIDERS } from './data/plans';
import { EhubUser, Transaction, ServicePage, PushNotificationItem, NotificationSettings, NotificationType, ReferredUserItem } from './types';
import { buyDataFromClubKonnect, isPlaceholderKey, verifyElectricityMeter } from './services/clubkonnect';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerBiometrics,
  authenticateWithBiometrics,
  disableBiometrics,
  getSavedBiometricUser,
} from './services/webauthn';
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  getSavedNotificationSettings,
  saveNotificationSettings,
  getSavedNotifications,
  saveNotifications,
  sendPushAlert,
  playSuccessChime,
  playWarningChime,
  triggerHaptic,
  DEFAULT_NOTIFICATION_SETTINGS,
} from './services/notificationService';
import {
  generateReferralCode,
  getReferralShareLink,
  detectUrlReferralCode,
  getStoredReferralCode,
  awardReferralBonus,
  REFERRAL_BONUS_AMOUNT,
} from './services/referralService';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  testConnection,
} from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BankListSelector } from './components/BankListSelector';
import { NIGERIAN_BANKS, BankItem } from './data/banks';

// Global declaration for Paystack Inline JS
declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: {
        key: string;
        email: string;
        amount: number;
        currency?: string;
        ref?: string;
        metadata?: Record<string, unknown>;
        callback: (response: { reference: string; status: string }) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

// Initial realistic demo seed transactions so users can test filters immediately
const SAMPLE_INITIAL_TRANSACTIONS: Transaction[] = [
  {
    transactionId: 'TX_SEED_1',
    userId: 'seed',
    type: 'data',
    title: 'MTN SME 1GB Data Bundle',
    amount: 280,
    status: 'successful',
    reference: 'CK_ORD_847291',
    details: 'Network: MTN | Phone: 08031234567 | Plan: MTN SME 1GB | Delivery: Instant API Dispense',
    createdAt: new Date().toISOString(),
  },
  {
    transactionId: 'TX_SEED_2',
    userId: 'seed',
    type: 'airtime',
    title: 'AIRTEL ₦1,000 Airtime (2% OFF)',
    amount: 980,
    status: 'successful',
    reference: 'AIR_920184',
    details: 'Network: AIRTEL | Phone: 08023456789 | Value: ₦1,000 | Paid: ₦980 (Saved ₦20)',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(), // Yesterday
  },
  {
    transactionId: 'TX_SEED_3',
    userId: 'seed',
    type: 'electricity',
    title: 'AEDC Abuja Electricity Token',
    amount: 2000,
    status: 'successful',
    reference: 'ED_1731000000',
    details: 'Disco: AEDC - Abuja Electricity | Meter: 44001928371 (PREPAID) | Units: 29.4 kWh',
    token: '4920-1948-2849-1094-3829',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
  },
  {
    transactionId: 'TX_SEED_4',
    userId: 'seed',
    type: 'cable',
    title: 'GOTV Smallie Subscription',
    amount: 1300,
    status: 'successful',
    reference: 'CBL_718294',
    details: 'Provider: GOTV | IUC: 2039485710 | Bouquet: GOTV Smallie | Phone: 08031234567',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(), // 8 days ago
  },
  {
    transactionId: 'TX_SEED_5',
    userId: 'seed',
    type: 'funding',
    title: 'Wallet Funded via Paystack',
    amount: 5000,
    status: 'successful',
    reference: 'EHUB_PSTK_918237',
    details: 'Paystack Online Gateway | Credited ₦5,000.00 via Bank Card',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(), // 12 days ago
  },
  {
    transactionId: 'TX_SEED_6',
    userId: 'seed',
    type: 'funding',
    title: 'Welcome Bonus Credited',
    amount: 1250,
    status: 'successful',
    reference: 'EHUB_WELCOME_BONUS',
    details: 'eHUB Welcome promotional credit for Abuja new accounts',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(), // 18 days ago
  },
];

// Helper: robust date parsing
function parseTxDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const match = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    return new Date(`${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`);
  }
  return new Date();
}

// Helper: formatted date string
function formatTxDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseTxDate(dateStr);
  return (
    d.toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) +
    ' • ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function detectNetworkFromPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 4) return 'Auto';
  const prefix = clean.slice(0, 4);
  if (['0803', '0806', '0703', '0706', '0813', '0816', '0810', '0814', '0903', '0906', '0913', '0916'].includes(prefix)) {
    return 'MTN';
  }
  if (['0805', '0807', '0705', '0815', '0811', '0905', '0915'].includes(prefix)) {
    return 'GLO';
  }
  if (['0802', '0808', '0708', '0812', '0701', '0902', '0901', '0904', '0907', '0912'].includes(prefix)) {
    return 'Airtel';
  }
  if (['0809', '0817', '0818', '0909', '0908'].includes(prefix)) {
    return '9mobile';
  }
  return 'Network';
}

export default function App() {
  // Theme state (persisted to localStorage as 'ehub_theme')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('ehub_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch (e) {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
      localStorage.setItem('ehub_theme', theme);
    } catch (e) {
      console.warn('Failed to persist theme preference', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Default eHUB User session (ensures ₦4,929.10 Available Balance is shown immediately)
  const DEFAULT_EHUB_USER: EhubUser = {
    userId: 'usr_benedict',
    displayName: 'Benedict Eze',
    email: 'benedicteze14@gmail.com',
    balance: 4929.10,
    referralCode: 'EHUB7X9K',
    referralEarnings: 850.00,
    referralCount: 4,
    referredUsers: [
      { displayName: 'Chidinma Okafor', email: 'chidi@gmail.com', date: new Date(Date.now() - 86400000 * 2).toISOString(), bonus: 100 },
      { displayName: 'Bello Sani', email: 'bello@yahoo.com', date: new Date(Date.now() - 86400000 * 5).toISOString(), bonus: 100 },
      { displayName: 'Emeka Nwosu', email: 'emeka@gmail.com', date: new Date(Date.now() - 86400000 * 9).toISOString(), bonus: 100 },
    ],
    createdAt: new Date().toISOString(),
  };

  // Auth state
  const [currentUser, setCurrentUser] = useState<EhubUser>(DEFAULT_EHUB_USER);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [totalCashback, setTotalCashback] = useState<number>(850.00);

  // Biometric / Web Authentication API state
  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(() => isWebAuthnSupported());
  const [isPlatformAuthAvailable, setIsPlatformAuthAvailable] = useState<boolean>(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ehub_biometric_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [savedBiometricUser, setSavedBiometricUser] = useState<{ userId: string; email: string; displayName: string } | null>(() => getSavedBiometricUser());
  const [biometricLoading, setBiometricLoading] = useState<boolean>(false);
  const [biometricFeedback, setBiometricFeedback] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Push Notification & Alerts state
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => getSavedNotificationSettings());
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(() => getNotificationPermission());
  const [notifications, setNotifications] = useState<PushNotificationItem[]>([]);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState<boolean>(false);
  const [activeToastNotification, setActiveToastNotification] = useState<PushNotificationItem | null>(null);
  const [notificationFilterTab, setNotificationFilterTab] = useState<'all' | 'transactions' | 'low_balance'>('all');
  const [notificationStatusMsg, setNotificationStatusMsg] = useState<string>('');

  // Sign up form
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpReferralCode, setSignUpReferralCode] = useState<string>(() => getStoredReferralCode());
  const [referralCopied, setReferralCopied] = useState<'code' | 'link' | null>(null);

  // Sign in form
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Navigation
  const [activePage, setActivePage] = useState<ServicePage>('dashboard');

  // Transactions list
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Filtering states for Transaction History
  const [filterType, setFilterType] = useState<string>('all'); // 'all' | 'data' | 'airtime' | 'electricity' | 'cable' | 'funding'
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // Modals & Feedback
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundMethod, setFundMethod] = useState<'bank_transfer' | 'card_paystack'>('bank_transfer');
  const [selectedFundBank, setSelectedFundBank] = useState<BankItem>(() => NIGERIAN_BANKS[0]);
  const [copiedAccount, setCopiedAccount] = useState<boolean>(false);
  const [fundAmount, setFundAmount] = useState<number>(1000);
  const [customFundInput, setCustomFundInput] = useState<string>('1000');
  const [isProcessingFunding, setIsProcessingFunding] = useState(false);

  const [successReceipt, setSuccessReceipt] = useState<Transaction | null>(null);
  const [actionError, setActionError] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string>('');

  // Config modal
  const [isConfigInfoOpen, setIsConfigInfoOpen] = useState(false);

  // Form states - DATA
  const [dataNetworkFilter, setDataNetworkFilter] = useState<'ALL' | 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('ALL');
  const [selectedNetwork, setSelectedNetwork] = useState<'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('MTN');
  const [selectedDataPlanId, setSelectedDataPlanId] = useState<string>('data-1gb');
  const [dataPhone, setDataPhone] = useState<string>('');

  // Form states - AIRTIME (₦1,000 selected green by default)
  const [airtimeNetwork, setAirtimeNetwork] = useState<'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('MTN');
  const [airtimePhone, setAirtimePhone] = useState<string>('');
  const [airtimeAmount, setAirtimeAmount] = useState<number>(1000);

  // Form states - ELECTRICITY
  const [selectedDisco, setSelectedDisco] = useState<string>('aedc');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [meterNumber, setMeterNumber] = useState<string>('');
  const [electricityAmount, setElectricityAmount] = useState<number>(2000);
  const [verifiedCustomerName, setVerifiedCustomerName] = useState<string>('');
  const [isVerifyingMeter, setIsVerifyingMeter] = useState<boolean>(false);
  const [meterVerificationError, setMeterVerificationError] = useState<string>('');
  const [meterVerified, setMeterVerified] = useState<boolean>(false);

  // Form states - CABLE
  const [cableProvider, setCableProvider] = useState<'GOTV' | 'DSTV' | 'STARTIMES'>('GOTV');
  const [selectedCablePackageId, setSelectedCablePackageId] = useState<string>('gotv-smallie');
  const [iucNumber, setIucNumber] = useState<string>('2039485710');
  const [cablePhone, setCablePhone] = useState<string>('');

  // 1. Initial Load: Check localStorage & Firebase Auth
  useEffect(() => {
    // Check WebAuthn platform authenticator availability
    isPlatformAuthenticatorAvailable().then((avail) => {
      setIsPlatformAuthAvailable(avail);
    }).catch(() => {});

    // Test Firebase connection
    testConnection().catch((err) => console.log('Firebase init note:', err));

    // Detect incoming referral code in URL (e.g. ?ref=EHUB123)
    const detectedRef = detectUrlReferralCode();
    if (detectedRef) {
      setSignUpReferralCode(detectedRef);
    }

    // Check localStorage 'ehub_current'
    try {
      const storedCurrent = localStorage.getItem('ehub_current');
      if (storedCurrent) {
        const parsed: EhubUser = JSON.parse(storedCurrent);
        if (parsed.balance === 1250 || typeof parsed.balance !== 'number') {
          parsed.balance = 4929.10;
        }
        if (!parsed.referralCode) {
          parsed.referralCode = generateReferralCode(parsed.displayName || parsed.email);
          parsed.referralEarnings = parsed.referralEarnings ?? 850.00;
          parsed.referralCount = parsed.referralCount ?? 4;
          parsed.referredUsers = parsed.referredUsers ?? [];
        }
        localStorage.setItem('ehub_current', JSON.stringify(parsed));
        setCurrentUser(parsed);
      } else {
        localStorage.setItem('ehub_current', JSON.stringify(DEFAULT_EHUB_USER));
        setCurrentUser(DEFAULT_EHUB_USER);
      }
    } catch (e) {
      console.warn('Error reading stored user:', e);
      setCurrentUser(DEFAULT_EHUB_USER);
    }

    // Check stored transactions
    try {
      const storedTx = localStorage.getItem('ehub_transactions');
      if (storedTx) {
        const parsed = JSON.parse(storedTx);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransactions(parsed);
        } else {
          setTransactions(SAMPLE_INITIAL_TRANSACTIONS);
          localStorage.setItem('ehub_transactions', JSON.stringify(SAMPLE_INITIAL_TRANSACTIONS));
        }
      } else {
        setTransactions(SAMPLE_INITIAL_TRANSACTIONS);
        localStorage.setItem('ehub_transactions', JSON.stringify(SAMPLE_INITIAL_TRANSACTIONS));
      }
    } catch (e) {
      console.warn('Error reading stored transactions:', e);
      setTransactions(SAMPLE_INITIAL_TRANSACTIONS);
    }

    // Load stored push notifications
    try {
      const stored = getSavedNotifications();
      if (stored && stored.length > 0) {
        setNotifications(stored);
      } else {
        const initialNotif: PushNotificationItem = {
          id: 'notif_welcome',
          userId: 'seed',
          type: 'system',
          title: '⚡ Welcome to eHUB Alerts!',
          body: 'Instant push notifications enabled for transaction status updates and low wallet balance alerts.',
          timestamp: new Date().toISOString(),
          read: false,
        };
        setNotifications([initialNotif]);
        saveNotifications([initialNotif]);
      }
    } catch (e) {
      console.warn('Error reading stored notifications:', e);
    }

    // Listen to Firebase auth state
    const unsubscribe = auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        try {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            const syncedUser: EhubUser = {
              userId: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'eHUB User',
              balance: typeof data.balance === 'number' ? data.balance : 1250,
              referralCode: data.referralCode || generateReferralCode(fbUser.displayName || fbUser.email || 'EHUB'),
              referredBy: data.referredBy,
              referralEarnings: typeof data.referralEarnings === 'number' ? data.referralEarnings : 0,
              referralCount: typeof data.referralCount === 'number' ? data.referralCount : 0,
              createdAt: data.createdAt || new Date().toISOString(),
            };
            setCurrentUser(syncedUser);
            localStorage.setItem('ehub_current', JSON.stringify(syncedUser));
          } else {
            // First time Google user: initial balance ₦1,250
            const pendingRef = getStoredReferralCode();
            const newCode = generateReferralCode(fbUser.displayName || fbUser.email || 'EHUB');
            const newUser: EhubUser = {
              userId: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'Google User',
              balance: 1250,
              referralCode: newCode,
              referredBy: pendingRef || undefined,
              referralEarnings: 0,
              referralCount: 0,
              referredUsers: [],
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, {
              userId: newUser.userId,
              email: newUser.email,
              displayName: newUser.displayName,
              balance: newUser.balance,
              referralCode: newUser.referralCode,
              referredBy: newUser.referredBy || null,
              referralEarnings: 0,
              referralCount: 0,
              createdAt: newUser.createdAt,
            });

            if (pendingRef) {
              await awardReferralBonus({
                referralCode: pendingRef,
                newUserId: newUser.userId,
                newUserDisplayName: newUser.displayName,
                newUserEmail: newUser.email,
              });
            }

            setCurrentUser(newUser);
            localStorage.setItem('ehub_current', JSON.stringify(newUser));
          }
        } catch (err) {
          console.error('Firestore user sync warning:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Sync current user update
  const persistUserUpdate = async (updated: EhubUser) => {
    setCurrentUser(updated);
    localStorage.setItem('ehub_current', JSON.stringify(updated));

    try {
      const usersStr = localStorage.getItem('ehub_users') || '[]';
      const usersList: EhubUser[] = JSON.parse(usersStr);
      const idx = usersList.findIndex((u) => u.email.toLowerCase() === updated.email.toLowerCase());
      if (idx !== -1) {
        usersList[idx] = { ...usersList[idx], balance: updated.balance };
        localStorage.setItem('ehub_users', JSON.stringify(usersList));
      }
    } catch (e) {
      console.warn('Error syncing ehub_users:', e);
    }

    if (auth.currentUser && auth.currentUser.uid === updated.userId) {
      try {
        const userRef = doc(db, 'users', updated.userId);
        await setDoc(
          userRef,
          {
            balance: updated.balance,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Firestore update non-critical error:', err);
      }
    }
  };

  // Add Transaction
  const recordTransaction = async (tx: Transaction) => {
    const updated = [tx, ...transactions];
    setTransactions(updated);
    localStorage.setItem('ehub_transactions', JSON.stringify(updated));

    if (auth.currentUser && currentUser && auth.currentUser.uid === currentUser.userId) {
      try {
        const txDoc = doc(db, 'users', currentUser.userId, 'transactions', tx.transactionId);
        await setDoc(txDoc, {
          transactionId: tx.transactionId,
          userId: currentUser.userId,
          type: tx.type,
          title: tx.title,
          amount: tx.amount,
          status: tx.status,
          reference: tx.reference,
          details: tx.details || '',
          createdAt: tx.createdAt,
        });
      } catch (err) {
        console.warn('Firestore record transaction note:', err);
      }
    }
  };

  // 2. Authentication Functions
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!signUpName.trim()) {
      setAuthError('Please enter your full name.');
      return;
    }
    if (!signUpEmail.trim() || !signUpEmail.includes('@')) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (signUpPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    try {
      const existingStr = localStorage.getItem('ehub_users') || '[]';
      const users: EhubUser[] = JSON.parse(existingStr);

      const exists = users.find((u) => u.email.toLowerCase() === signUpEmail.trim().toLowerCase());
      if (exists) {
        setAuthError('An account with this email already exists. Please sign in.');
        return;
      }

      const generatedCode = generateReferralCode(signUpName.trim());
      const cleanReferredBy = signUpReferralCode.trim() ? signUpReferralCode.trim().toUpperCase() : undefined;

      const newUser: EhubUser = {
        userId: 'usr_' + Date.now(),
        email: signUpEmail.trim().toLowerCase(),
        displayName: signUpName.trim(),
        password: signUpPassword,
        balance: 1250,
        referralCode: generatedCode,
        referredBy: cleanReferredBy,
        referralEarnings: 0,
        referralCount: 0,
        referredUsers: [],
        createdAt: new Date().toISOString(),
      };

      // If a referral code was entered, award the ₦100 bonus to the referrer!
      if (cleanReferredBy) {
        try {
          await awardReferralBonus({
            referralCode: cleanReferredBy,
            newUserId: newUser.userId,
            newUserDisplayName: newUser.displayName,
            newUserEmail: newUser.email,
          });
        } catch (refErr) {
          console.warn('Referral bonus processing notice:', refErr);
        }
      }

      users.push(newUser);
      localStorage.setItem('ehub_users', JSON.stringify(users));
      localStorage.setItem('ehub_current', JSON.stringify(newUser));

      // Record welcome funding transaction
      const welcomeTx: Transaction = {
        transactionId: 'TX_WELCOME_' + Date.now(),
        userId: newUser.userId,
        type: 'funding',
        title: 'Welcome Promotion Credit',
        amount: 1250,
        status: 'successful',
        reference: 'EHUB_BONUS_' + Math.floor(Math.random() * 89999 + 10000),
        details: 'Initial promotional balance credited to wallet upon signup',
        createdAt: new Date().toISOString(),
      };
      recordTransaction(welcomeTx);

      // Persist new user to Firestore
      try {
        const userRef = doc(db, 'users', newUser.userId);
        await setDoc(userRef, {
          userId: newUser.userId,
          email: newUser.email,
          displayName: newUser.displayName,
          balance: newUser.balance,
          referralCode: newUser.referralCode,
          referredBy: newUser.referredBy || null,
          referralEarnings: 0,
          referralCount: 0,
          createdAt: newUser.createdAt,
        });
      } catch (err) {
        console.warn('Firestore initial user write notice:', err);
      }

      setCurrentUser(newUser);
      setActivePage('dashboard');
    } catch (err) {
      setAuthError('Failed to complete registration. Try again.');
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!signInEmail.trim()) {
      setAuthError('Please enter your email.');
      return;
    }
    if (!signInPassword) {
      setAuthError('Please enter your password.');
      return;
    }

    try {
      const existingStr = localStorage.getItem('ehub_users') || '[]';
      const users: EhubUser[] = JSON.parse(existingStr);

      const found = users.find(
        (u) =>
          u.email.toLowerCase() === signInEmail.trim().toLowerCase() &&
          u.password === signInPassword
      );

      if (!found) {
        setAuthError('Invalid email or password. Please verify your credentials.');
        return;
      }

      // Ensure user has referral code if logging back in
      if (!found.referralCode) {
        found.referralCode = generateReferralCode(found.displayName || found.email);
        found.referralEarnings = found.referralEarnings ?? 0;
        found.referralCount = found.referralCount ?? 0;
        found.referredUsers = found.referredUsers ?? [];
        localStorage.setItem('ehub_users', JSON.stringify(users));
      }

      localStorage.setItem('ehub_current', JSON.stringify(found));
      setCurrentUser(found);
      setActivePage('dashboard');
    } catch (err) {
      setAuthError('Error signing in. Try again.');
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

      const userRef = doc(db, 'users', fbUser.uid);
      const snap = await getDoc(userRef);

      let syncedUser: EhubUser;
      if (snap.exists()) {
        const data = snap.data();
        syncedUser = {
          userId: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'eHUB User',
          balance: typeof data.balance === 'number' ? data.balance : 1250,
          referralCode: data.referralCode || generateReferralCode(fbUser.displayName || fbUser.email || 'EHUB'),
          referredBy: data.referredBy,
          referralEarnings: typeof data.referralEarnings === 'number' ? data.referralEarnings : 0,
          referralCount: typeof data.referralCount === 'number' ? data.referralCount : 0,
          createdAt: data.createdAt || new Date().toISOString(),
        };
      } else {
        const pendingRef = getStoredReferralCode();
        const newCode = generateReferralCode(fbUser.displayName || fbUser.email || 'EHUB');
        syncedUser = {
          userId: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'eHUB User',
          balance: 1250,
          referralCode: newCode,
          referredBy: pendingRef || undefined,
          referralEarnings: 0,
          referralCount: 0,
          referredUsers: [],
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, {
          userId: syncedUser.userId,
          email: syncedUser.email,
          displayName: syncedUser.displayName,
          balance: syncedUser.balance,
          referralCode: syncedUser.referralCode,
          referredBy: syncedUser.referredBy || null,
          referralEarnings: 0,
          referralCount: 0,
          createdAt: syncedUser.createdAt,
        });

        if (pendingRef) {
          try {
            await awardReferralBonus({
              referralCode: pendingRef,
              newUserId: syncedUser.userId,
              newUserDisplayName: syncedUser.displayName,
              newUserEmail: syncedUser.email,
            });
          } catch (refErr) {
            console.warn('Google auth referral bonus error:', refErr);
          }
        }

        const welcomeTx: Transaction = {
          transactionId: 'TX_WELCOME_' + Date.now(),
          userId: syncedUser.userId,
          type: 'funding',
          title: 'Google Sign-in Promo Bonus',
          amount: 1250,
          status: 'successful',
          reference: 'EHUB_GGL_' + Math.floor(Math.random() * 89999 + 10000),
          details: 'Initial promotional balance credited to wallet upon Google signup',
          createdAt: new Date().toISOString(),
        };
        recordTransaction(welcomeTx);
      }

      localStorage.setItem('ehub_current', JSON.stringify(syncedUser));
      setCurrentUser(syncedUser);
      setActivePage('dashboard');
    } catch (err: unknown) {
      console.error('Google Sign-in error:', err);
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Google sign-in was interrupted. You can also sign in with email.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ehub_current');
    setCurrentUser(DEFAULT_EHUB_USER);
    fbSignOut(auth).catch(() => {});
    setActivePage('dashboard');
  };

  // Biometric / Web Authentication API Handlers
  const handleToggleBiometrics = async () => {
    if (!currentUser) return;
    setBiometricFeedback(null);

    // If currently enabled, disabling it
    if (isBiometricEnabled) {
      disableBiometrics(currentUser.userId);
      setIsBiometricEnabled(false);
      setSavedBiometricUser(null);
      const updated: EhubUser = {
        ...currentUser,
        biometricEnabled: false,
      };
      await persistUserUpdate(updated);
      setBiometricFeedback({
        type: 'info',
        text: 'Fingerprint / Face ID disabled on this device.',
      });
      return;
    }

    // Turning it on: invoke WebAuthn credential creation
    setBiometricLoading(true);
    try {
      const res = await registerBiometrics({
        userId: currentUser.userId,
        email: currentUser.email,
        displayName: currentUser.displayName,
      });

      if (res.success) {
        setIsBiometricEnabled(true);
        const updated: EhubUser = {
          ...currentUser,
          biometricEnabled: true,
          biometricCredentialId: res.credentialId,
        };
        await persistUserUpdate(updated);
        setSavedBiometricUser({
          userId: currentUser.userId,
          email: currentUser.email,
          displayName: currentUser.displayName,
        });
        setBiometricFeedback({
          type: 'success',
          text: '✓ Fingerprint / Face ID enabled successfully! Your local session is now secured.',
        });
      } else {
        setBiometricFeedback({
          type: 'error',
          text: res.error || 'Failed to register biometric credentials.',
        });
      }
    } catch (err: unknown) {
      console.error('Biometric enrollment error:', err);
      setBiometricFeedback({
        type: 'error',
        text: 'An unexpected error occurred during biometric enrollment.',
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleTestBiometrics = async () => {
    setBiometricFeedback(null);
    setBiometricLoading(true);
    try {
      const res = await authenticateWithBiometrics();
      if (res.success) {
        setBiometricFeedback({
          type: 'success',
          text: '✓ Biometric verification succeeded! Device sensor authenticated successfully.',
        });
      } else {
        setBiometricFeedback({
          type: 'error',
          text: res.error || 'Biometric verification failed or was cancelled.',
        });
      }
    } catch (err: unknown) {
      console.error('Biometric test error:', err);
      setBiometricFeedback({
        type: 'error',
        text: 'Biometric verification test failed.',
      });
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    setAuthError('');
    setBiometricLoading(true);
    try {
      const res = await authenticateWithBiometrics();
      if (res.success && res.user) {
        // Find existing user from localStorage ehub_users
        let targetUser: EhubUser | null = null;
        try {
          const raw = localStorage.getItem('ehub_users') || '[]';
          const users: EhubUser[] = JSON.parse(raw);
          targetUser =
            users.find(
              (u) =>
                u.userId === res.user?.userId ||
                u.email.toLowerCase() === res.user?.email.toLowerCase()
            ) || null;
        } catch (e) {
          console.warn('Error reading users for biometric login:', e);
        }

        if (!targetUser) {
          // Reconstruct user from saved profile
          targetUser = {
            userId: res.user.userId,
            email: res.user.email,
            displayName: res.user.displayName,
            balance: 1250,
            biometricEnabled: true,
            createdAt: new Date().toISOString(),
          };
        }

        localStorage.setItem('ehub_current', JSON.stringify(targetUser));
        setCurrentUser(targetUser);
        setActivePage('dashboard');
      } else {
        setAuthError(res.error || 'Biometric authentication was cancelled or failed.');
      }
    } catch (err: unknown) {
      console.error('Biometric sign-in error:', err);
      setAuthError('Biometric authentication failed. Please enter your password.');
    } finally {
      setBiometricLoading(false);
    }
  };

  // Notification Dispatcher & Management
  const dispatchAlert = (params: {
    type: NotificationType;
    title: string;
    body: string;
    metadata?: PushNotificationItem['metadata'];
  }) => {
    const newNotif: PushNotificationItem = {
      id: 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      userId: currentUser?.userId || 'guest',
      type: params.type,
      title: params.title,
      body: params.body,
      timestamp: new Date().toISOString(),
      read: false,
      metadata: params.metadata,
    };

    setNotifications((prev) => {
      const updated = [newNotif, ...prev];
      saveNotifications(updated, currentUser?.userId);
      return updated;
    });

    // Native Browser Push + Audio Chime + Haptics
    sendPushAlert({
      title: params.title,
      body: params.body,
      type: params.type,
      settings: notificationSettings,
    });

    // In-App Toast
    setActiveToastNotification(newNotif);

    setTimeout(() => {
      setActiveToastNotification((current) => (current?.id === newNotif.id ? null : current));
    }, 6000);
  };

  const handleRequestPushPermission = async () => {
    const result = await requestNotificationPermission();
    setBrowserPermission(result);
    if (result === 'granted') {
      const updated = { ...notificationSettings, pushEnabled: true };
      setNotificationSettings(updated);
      saveNotificationSettings(updated);
      setNotificationStatusMsg('✓ Browser Push Notifications granted and enabled!');
      sendPushAlert({
        title: '🔔 eHUB Push Notifications Enabled',
        body: 'You will now receive instant push alerts for transaction status and low balances!',
        type: 'system',
        settings: updated,
      });
    } else if (result === 'denied') {
      setNotificationStatusMsg('Push notifications are blocked in your browser settings.');
    }
    setTimeout(() => setNotificationStatusMsg(''), 4500);
  };

  const updateNotificationSettings = (partial: Partial<NotificationSettings>) => {
    setNotificationSettings((prev) => {
      const next = { ...prev, ...partial };
      saveNotificationSettings(next);
      return next;
    });
  };

  const handleSendTestNotification = (type: 'success' | 'low_balance') => {
    if (type === 'success') {
      dispatchAlert({
        type: 'transaction_success',
        title: '⚡ Test Alert: MTN 1GB SME Dispensed!',
        body: 'Your data order was completed and delivered instantly. Ref: TEST_CK_98231',
        metadata: {
          amount: 280,
          currentBalance: currentUser?.balance || 1250,
        },
      });
      setNotificationStatusMsg('✓ Test transaction success alert dispatched!');
    } else {
      const bal = currentUser?.balance !== undefined ? currentUser.balance : 350;
      dispatchAlert({
        type: 'low_balance',
        title: '⚠️ Test Alert: Low Wallet Balance',
        body: `Your wallet balance is ₦${bal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}, which is at or below your threshold (₦${notificationSettings.lowBalanceThreshold.toLocaleString()}). Tap to top up now!`,
        metadata: {
          currentBalance: bal,
          threshold: notificationSettings.lowBalanceThreshold,
        },
      });
      setNotificationStatusMsg('✓ Test low wallet balance alert dispatched!');
    }
    setTimeout(() => setNotificationStatusMsg(''), 4000);
  };

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated, currentUser?.userId);
      return updated;
    });
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    saveNotifications([], currentUser?.userId);
  };

  // Referral sharing and copying helpers
  const handleCopyReferral = async (type: 'code' | 'link') => {
    if (!currentUser) return;
    const code = currentUser.referralCode || 'EHUB';
    const textToCopy = type === 'code' ? code : getReferralShareLink(code);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setReferralCopied(type);
      setTimeout(() => setReferralCopied(null), 2500);
    } catch (err) {
      console.warn('Copy failure:', err);
    }
  };

  const handleNativeShare = async () => {
    if (!currentUser) return;
    const code = currentUser.referralCode || 'EHUB';
    const shareUrl = getReferralShareLink(code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on eHUB Telecom & Bills!',
          text: `Buy instant AEDC light tokens, cheap MTN/Airtel SME data, and airtime with instant dispense on eHUB. Use my referral code ${code} to sign up!`,
          url: shareUrl,
        });
      } catch {
        // User cancelled share dialog
      }
    } else {
      handleCopyReferral('link');
    }
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated, currentUser?.userId);
      return updated;
    });
  };

  // Centralized Transaction Status & Low Balance Push Notification handler
  const handlePostTransactionAlerts = (tx: Transaction, newBalance: number) => {
    // 1. Transaction status alert (Success)
    if (notificationSettings.transactionSuccessAlerts) {
      const isFunding = tx.type === 'funding';
      dispatchAlert({
        type: isFunding ? 'wallet_funded' : 'transaction_success',
        title: isFunding ? '💳 Wallet Funded Successfully!' : `⚡ ${tx.title} Delivered!`,
        body: isFunding
          ? `₦${tx.amount.toLocaleString()} credited to your wallet balance. Ref: ${tx.reference}`
          : `${tx.details || 'Your order was processed and dispensed instantly.'} Ref: ${tx.reference}`,
        metadata: {
          transactionId: tx.transactionId,
          amount: tx.amount,
          currentBalance: newBalance,
          token: tx.token,
        },
      });
    }

    // 2. Low Balance Alert (if non-funding debit brought balance <= threshold)
    if (
      tx.type !== 'funding' &&
      notificationSettings.lowBalanceAlerts &&
      newBalance <= notificationSettings.lowBalanceThreshold
    ) {
      setTimeout(() => {
        dispatchAlert({
          type: 'low_balance',
          title: '⚠️ Low Wallet Balance Alert',
          body: `Your wallet balance is now ₦${newBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}, which is at or below your alert threshold (₦${notificationSettings.lowBalanceThreshold.toLocaleString()}). Tap to top up now!`,
          metadata: {
            currentBalance: newBalance,
            threshold: notificationSettings.lowBalanceThreshold,
          },
        });
      }, 1200);
    }
  };

  // 3. Wallet Funding via Paystack
  const triggerFundWallet = (amountToFund: number) => {
    if (!currentUser) return;
    if (amountToFund < 100) {
      alert('Minimum funding amount is ₦100');
      return;
    }

    const isPlaceholder = isPlaceholderKey(CONFIG.PAYSTACK_PUBLIC_KEY);
    const amountInKobo = Math.round(amountToFund * 100);
    const paymentRef = 'EHUB_' + Date.now();

    if (window.PaystackPop && !isPlaceholder) {
      try {
        const handler = window.PaystackPop.setup({
          key: CONFIG.PAYSTACK_PUBLIC_KEY,
          email: currentUser.email,
          amount: amountInKobo,
          currency: 'NGN',
          ref: paymentRef,
          metadata: {
            custom_fields: [
              {
                display_name: 'Customer Name',
                variable_name: 'customer_name',
                value: currentUser.displayName,
              },
            ],
          },
          callback: function (response) {
            handleFundingSuccess(amountToFund, response.reference || paymentRef, 'Paystack Online Gateway');
          },
          onClose: function () {
            console.log('Paystack modal closed');
          },
        });
        handler.openIframe();
        setIsFundModalOpen(false);
        return;
      } catch (e) {
        console.warn('Paystack inline popup warning, falling back to instant processor:', e);
      }
    }

    if (isPlaceholder) {
      const proceed = confirm(
        `PAYSTACK CONFIG NOTICE:\n` +
          `Your CONFIG.PAYSTACK_PUBLIC_KEY is currently "${CONFIG.PAYSTACK_PUBLIC_KEY}".\n\n` +
          `Would you like to simulate an instant successful test funding of ₦${amountToFund.toLocaleString()} right now?`
      );
      if (proceed) {
        handleFundingSuccess(amountToFund, 'TEST_' + paymentRef, 'Paystack Sandbox Simulation');
        setIsFundModalOpen(false);
      }
    } else {
      handleFundingSuccess(amountToFund, paymentRef, 'Paystack Direct Gateway');
      setIsFundModalOpen(false);
    }
  };

  const handleFundingSuccess = (amount: number, ref: string, providerNote: string, customTitle?: string) => {
    if (!currentUser) return;
    const newBalance = currentUser.balance + amount;
    const updatedUser: EhubUser = {
      ...currentUser,
      balance: newBalance,
    };
    persistUserUpdate(updatedUser);

    const tx: Transaction = {
      transactionId: 'TX_' + Date.now(),
      userId: currentUser.userId,
      type: 'funding',
      title: customTitle || 'Wallet Funded via Paystack',
      amount: amount,
      status: 'successful',
      reference: ref,
      details: `${providerNote} | Credited ₦${amount.toLocaleString()} to ${currentUser.email}`,
      createdAt: new Date().toISOString(),
    };
    recordTransaction(tx);
    handlePostTransactionAlerts(tx, newBalance);
    setSuccessReceipt(tx);
  };

  const handleBankTransferFunding = (amount: number, bank: BankItem) => {
    if (!currentUser) return;
    setIsProcessingFunding(true);
    setTimeout(() => {
      setIsProcessingFunding(false);
      const ref = 'BT_' + bank.id.toUpperCase() + '_' + Date.now();
      handleFundingSuccess(
        amount,
        ref,
        `Direct Bank Transfer | From ${bank.name} (${bank.code}) to eHUB Moniepoint Virtual Account`,
        `Wallet Funded via ${bank.name} Transfer`
      );
      setIsFundModalOpen(false);
    }, 1200);
  };

  const handleCopyAccountNumber = async (accountNum: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(accountNum);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = accountNum;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2500);
    } catch (err) {
      console.warn('Copy account number warning:', err);
    }
  };

  // 4. BUY DATA Function
  const buyData = async () => {
    setActionError('');
    if (!currentUser) return;

    if (!dataPhone || dataPhone.length < 10) {
      setActionError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    const activeList = dataNetworkFilter === 'ALL' ? DATA_PLANS.ALL : DATA_PLANS[dataNetworkFilter] || [];
    const allKnownPlans = [
      ...(DATA_PLANS.ALL || []),
      ...(DATA_PLANS.MTN || []),
      ...(DATA_PLANS.GLO || []),
      ...(DATA_PLANS.AIRTEL || []),
      ...(DATA_PLANS['9MOBILE'] || []),
    ];
    const plan =
      activeList.find((p) => p.id === selectedDataPlanId) ||
      allKnownPlans.find((p) => p.id === selectedDataPlanId) ||
      activeList[0] ||
      allKnownPlans[0];
    if (!plan) {
      setActionError('Please select a valid data plan.');
      return;
    }

    const effectiveNetwork: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE' =
      plan.network || (dataNetworkFilter !== 'ALL' ? dataNetworkFilter : selectedNetwork);

    if (currentUser.balance < plan.price) {
      setActionError(
        `Insufficient balance! Your balance is ₦${currentUser.balance.toLocaleString()}, but this plan costs ₦${plan.price.toLocaleString()}. Please fund your wallet.`
      );
      return;
    }

    setActionLoading(true);

    const isKeyPlaceholder = isPlaceholderKey(CONFIG.CLUBKONNECT_API_KEY);
    const requestId = 'REQ_' + Date.now();

    const ckResult = await buyDataFromClubKonnect({
      network: effectiveNetwork,
      planCode: plan.code,
      phone: dataPhone.trim(),
      requestId,
    });

    const newBalance = currentUser.balance - plan.price;
    const updatedUser = { ...currentUser, balance: newBalance };
    await persistUserUpdate(updatedUser);

    const tx: Transaction = {
      transactionId: 'TX_' + Date.now(),
      userId: currentUser.userId,
      type: 'data',
      title: `${plan.network} ${plan.size} Data Bundle`,
      amount: plan.price,
      status: 'successful',
      reference: ckResult.orderId,
      details: `Network: ${plan.network} | Phone: ${dataPhone} | Plan: ${plan.name} | ${ckResult.message}`,
      createdAt: new Date().toISOString(),
    };

    await recordTransaction(tx);
    handlePostTransactionAlerts(tx, newBalance);
    setActionLoading(false);
    setSuccessReceipt(tx);

    if (isKeyPlaceholder) {
      console.info(
        `[Demo Alert] CONFIG.CLUBKONNECT_API_KEY is configured with placeholder. Nellobytesystems API call preview:\n${ckResult.apiUrl}`
      );
    }
  };

  // 5. BUY AIRTIME Function (with 2% discount!)
  const buyAirtime = async () => {
    setActionError('');
    if (!currentUser) return;

    if (!airtimePhone || airtimePhone.length < 10) {
      setActionError('Please enter a valid 11-digit phone number.');
      return;
    }
    if (airtimeAmount < 50) {
      setActionError('Minimum airtime recharge is ₦50.');
      return;
    }

    const discountedCost = Math.round(airtimeAmount * 0.98);

    if (currentUser.balance < discountedCost) {
      setActionError(
        `Insufficient balance! You need ₦${discountedCost.toLocaleString()} (2% discounted), but your balance is ₦${currentUser.balance.toLocaleString()}.`
      );
      return;
    }

    setActionLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    const newBalance = currentUser.balance - discountedCost;
    const updatedUser = { ...currentUser, balance: newBalance };
    await persistUserUpdate(updatedUser);

    const tx: Transaction = {
      transactionId: 'TX_' + Date.now(),
      userId: currentUser.userId,
      type: 'airtime',
      title: `${airtimeNetwork} ₦${airtimeAmount.toLocaleString()} Airtime (2% OFF)`,
      amount: discountedCost,
      status: 'successful',
      reference: 'AIR_' + Math.floor(Math.random() * 899999 + 100000),
      details: `Network: ${airtimeNetwork} | Phone: ${airtimePhone} | Face Value: ₦${airtimeAmount} | Paid: ₦${discountedCost} (Saved ₦${airtimeAmount - discountedCost})`,
      createdAt: new Date().toISOString(),
    };

    await recordTransaction(tx);
    handlePostTransactionAlerts(tx, newBalance);
    setActionLoading(false);
    setSuccessReceipt(tx);
  };

  // Verify Meter with real ClubKonnect API endpoint
  const handleVerifyMeter = async () => {
    setActionError('');
    setMeterVerificationError('');
    setVerifiedCustomerName('');
    setMeterVerified(false);

    const discoObj = DISCO_PROVIDERS.find((d) => d.id === selectedDisco) || DISCO_PROVIDERS[0];
    const discoShortName = discoObj.shortName || 'AEDC';

    if (!meterNumber || meterNumber.trim().length < 8) {
      setMeterVerificationError(`Invalid Meter Number for ${discoShortName}`);
      return;
    }

    setIsVerifyingMeter(true);

    try {
      const result = await verifyElectricityMeter({
        discoCode: discoObj.code,
        discoShortName,
        meterNumber: meterNumber.trim(),
        meterType,
      });

      if (result.success && result.customerName) {
        setVerifiedCustomerName(result.customerName);
        setMeterVerified(true);
        setMeterVerificationError('');
      } else {
        setVerifiedCustomerName('');
        setMeterVerified(false);
        setMeterVerificationError(`Invalid Meter Number for ${discoShortName}`);
      }
    } catch (err) {
      setVerifiedCustomerName('');
      setMeterVerified(false);
      setMeterVerificationError(`Invalid Meter Number for ${discoShortName}`);
    } finally {
      setIsVerifyingMeter(false);
    }
  };

  // 6. BUY ELECTRICITY Function (AEDC & All Discos)
  const payElectricity = async () => {
    setActionError('');
    if (!currentUser) return;

    const discoObj = DISCO_PROVIDERS.find((d) => d.id === selectedDisco) || DISCO_PROVIDERS[0];
    const discoShortName = discoObj.shortName || 'AEDC';

    if (!meterNumber || meterNumber.trim().length < 8) {
      setActionError(`Invalid Meter Number for ${discoShortName}`);
      return;
    }
    if (!meterVerified || !verifiedCustomerName) {
      setActionError(`Please click VERIFY to validate meter details for ${discoShortName} before proceeding.`);
      return;
    }
    if (electricityAmount < 1000) {
      setActionError('Minimum electricity payment is ₦1,000.');
      return;
    }
    if (currentUser.balance < electricityAmount) {
      setActionError(
        `Insufficient balance! Your balance is ₦${currentUser.balance.toLocaleString()}, but electricity charge is ₦${electricityAmount.toLocaleString()}.`
      );
      return;
    }

    setActionLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const generatedToken =
      Math.floor(1000 + Math.random() * 9000) +
      '-' +
      Math.floor(1000 + Math.random() * 9000) +
      '-' +
      Math.floor(1000 + Math.random() * 9000) +
      '-' +
      Math.floor(1000 + Math.random() * 9000) +
      '-' +
      Math.floor(1000 + Math.random() * 9000);
    const unitsPurchased = (electricityAmount / 68).toFixed(1) + ' kWh';

    const newBalance = currentUser.balance - electricityAmount;
    const updatedUser = { ...currentUser, balance: newBalance };
    await persistUserUpdate(updatedUser);

    const tx: Transaction = {
      transactionId: 'TX_' + Date.now(),
      userId: currentUser.userId,
      type: 'electricity',
      title: `${discoObj.name.split(' - ')[0]} Electricity Token`,
      amount: electricityAmount,
      status: 'successful',
      reference: 'ED_' + Date.now(),
      details: `Disco: ${discoObj.name} | Customer: ${verifiedCustomerName} | Meter: ${meterNumber.trim()} (${meterType.toUpperCase()}) | Units: ${unitsPurchased}`,
      token: generatedToken,
      createdAt: new Date().toISOString(),
    };

    await recordTransaction(tx);
    handlePostTransactionAlerts(tx, newBalance);
    setActionLoading(false);
    setSuccessReceipt(tx);
  };

  // 7. BUY CABLE Function (GOTV / DSTV / Startimes)
  const payCable = async () => {
    setActionError('');
    if (!currentUser) return;

    if (!iucNumber || iucNumber.length < 8) {
      setActionError('Please enter a valid 10-digit Smartcard or IUC number.');
      return;
    }

    const pkgList = CABLE_PACKAGES[cableProvider] || [];
    const pkg = pkgList.find((p) => p.id === selectedCablePackageId) || pkgList[0];
    if (!pkg) {
      setActionError('Please select a valid package.');
      return;
    }

    if (currentUser.balance < pkg.price) {
      setActionError(
        `Insufficient balance! Your balance is ₦${currentUser.balance.toLocaleString()}, but package is ₦${pkg.price.toLocaleString()}.`
      );
      return;
    }

    setActionLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const newBalance = currentUser.balance - pkg.price;
    const updatedUser = { ...currentUser, balance: newBalance };
    await persistUserUpdate(updatedUser);

    const tx: Transaction = {
      transactionId: 'TX_' + Date.now(),
      userId: currentUser.userId,
      type: 'cable',
      title: `${pkg.name} Subscription`,
      amount: pkg.price,
      status: 'successful',
      reference: 'CBL_' + Math.floor(Math.random() * 899999 + 100000),
      details: `Provider: ${cableProvider} | IUC/Smartcard: ${iucNumber} | Bouquet: ${pkg.name} | Phone: ${cablePhone || 'N/A'}`,
      createdAt: new Date().toISOString(),
    };

    await recordTransaction(tx);
    handlePostTransactionAlerts(tx, newBalance);
    setActionLoading(false);
    setSuccessReceipt(tx);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2500);
  };

  // ====================================================
  // FILTERING LOGIC FOR TRANSACTIONS
  // ====================================================
  const now = new Date();

  const filteredTransactions = transactions.filter((tx) => {
    // 1. Type Filter
    if (filterType !== 'all' && tx.type !== filterType) {
      return false;
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = tx.title?.toLowerCase().includes(q);
      const matchRef = tx.reference?.toLowerCase().includes(q);
      const matchDetails = tx.details?.toLowerCase().includes(q);
      const matchType = tx.type?.toLowerCase().includes(q);
      if (!matchTitle && !matchRef && !matchDetails && !matchType) {
        return false;
      }
    }

    // 3. Date Range Filter
    if (dateRangePreset !== 'all') {
      const txDate = parseTxDate(tx.createdAt);
      if (dateRangePreset === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (txDate < startOfToday) return false;
      } else if (dateRangePreset === '7days') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        if (txDate < sevenDaysAgo) return false;
      } else if (dateRangePreset === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        if (txDate < thirtyDaysAgo) return false;
      } else if (dateRangePreset === 'custom') {
        if (customStartDate) {
          const start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }
    }

    return true;
  });

  // Calculate totals for filtered transactions
  const totalFilteredSpent = filteredTransactions
    .filter((t) => t.type !== 'funding' && t.status === 'successful')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalFilteredFunded = filteredTransactions
    .filter((t) => t.type === 'funding' && t.status === 'successful')
    .reduce((sum, t) => sum + t.amount, 0);

  // Type count helper
  const getTypeCount = (type: string) => {
    if (type === 'all') return transactions.length;
    return transactions.filter((t) => t.type === type).length;
  };

  const hasActiveFilters =
    filterType !== 'all' ||
    dateRangePreset !== 'all' ||
    Boolean(searchQuery.trim()) ||
    Boolean(customStartDate) ||
    Boolean(customEndDate);

  const resetAllFilters = () => {
    setFilterType('all');
    setDateRangePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSearchQuery('');
  };

  // If not logged in, show Auth Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#eef5ef] dark:bg-[#07120c] flex flex-col justify-center items-center p-4 transition-colors duration-200">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#0f1f17] rounded-[24px] shadow-xl p-6 sm:p-8 border border-green-100/80 dark:border-green-900/40 relative">
          {/* Top-right Dark Mode Toggle on Auth Screen */}
          <div className="absolute top-4 right-4">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-green-50 dark:bg-green-950/80 hover:bg-green-100 dark:hover:bg-green-900/80 text-[#0a5c36] dark:text-[#d6ff00] transition active:scale-95 flex items-center justify-center cursor-pointer border border-green-200/60 dark:border-green-800/60"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-28 h-28 rounded-3xl bg-[#eef5ef] dark:bg-[#162a20] p-2 flex items-center justify-center shadow-xs border border-green-200/80 dark:border-green-800/60 mb-2 overflow-hidden">
              <img
                src={CONFIG.LOGO_URL}
                alt="eHUB Logo"
                className="w-full h-full object-contain rounded-2xl"
              />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a5c36]/10 dark:bg-green-900/40 text-[#0a5c36] dark:text-[#d6ff00] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0a5c36] dark:bg-[#d6ff00] animate-pulse"></span>
              {CONFIG.SLOGAN} • {CONFIG.TAGLINE}
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-[#eef5ef] dark:bg-[#0a150f] p-1 rounded-2xl mb-6 border border-transparent dark:border-green-900/40">
            <button
              onClick={() => {
                setAuthMode('signin');
                setAuthError('');
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white dark:bg-[#162c21] text-[#0a5c36] dark:text-[#d6ff00] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode('signup');
                setAuthError('');
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white dark:bg-[#162c21] text-[#0a5c36] dark:text-[#d6ff00] shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-[#12241b] border border-gray-300 dark:border-green-900/60 hover:border-gray-400 dark:hover:border-green-700 text-gray-700 dark:text-gray-200 font-semibold rounded-2xl text-sm shadow-xs hover:bg-gray-50 dark:hover:bg-[#183024] transition active:scale-[0.99] mb-4 cursor-pointer"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{authLoading ? 'Signing in...' : 'Continue with Google'}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-green-900/40"></div>
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 dark:text-gray-500 uppercase">
              <span className="bg-white dark:bg-[#0f1f17] px-2">or with email</span>
            </div>
          </div>

          {/* Form */}
          {authMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ibrahim Musa"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Referral Code (Optional)</span>
                  {signUpReferralCode && (
                    <span className="text-[10px] text-green-700 dark:text-[#d6ff00] font-extrabold flex items-center gap-1 normal-case">
                      <Check className="w-3 h-3 text-green-600 dark:text-[#d6ff00]" /> Bonus Link Applied
                    </span>
                  )}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Gift className="w-4 h-4 text-[#0a5c36] dark:text-[#d6ff00]" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. EHUB7X or Friend's Code"
                    value={signUpReferralCode}
                    onChange={(e) => setSignUpReferralCode(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm font-mono tracking-wider uppercase"
                  />
                </div>
                <span className="text-[10.5px] text-gray-500 dark:text-gray-400 mt-1 block">
                  Friend referred you? Enter their code so they receive their ₦100 reward.
                </span>
              </div>

              <div className="p-3 rounded-xl bg-lime-50 dark:bg-green-950/70 border border-lime-200 dark:border-green-800/60 text-[#0a5c36] dark:text-lime-300 text-xs font-medium">
                🎁 New accounts get a starting demo balance of <strong>₦1,250.00</strong> immediately!
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-bold rounded-2xl shadow-md shadow-green-900/10 active:scale-[0.99] transition text-sm cursor-pointer"
              >
                Create Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#09150f] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-bold rounded-2xl shadow-md shadow-green-900/10 active:scale-[0.99] transition text-sm cursor-pointer"
              >
                Sign In to eHUB
              </button>

              {/* Biometric One-Tap Sign In with Fingerprint / Face ID */}
              <div className="pt-2">
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-gray-200 dark:border-green-900/40"></div>
                  <span className="flex-shrink mx-3 text-[11px] font-bold text-gray-400 dark:text-gray-400 uppercase tracking-wider">
                    or quick biometric unlock
                  </span>
                  <div className="flex-grow border-t border-gray-200 dark:border-green-900/40"></div>
                </div>

                <button
                  type="button"
                  onClick={handleBiometricSignIn}
                  disabled={biometricLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#d6ff00] to-lime-400 hover:from-lime-300 hover:to-lime-200 text-[#0a5c36] font-black rounded-2xl shadow-md shadow-lime-500/15 active:scale-[0.99] transition text-sm flex items-center justify-center gap-2.5 cursor-pointer border border-lime-400/80"
                >
                  <Fingerprint className="w-5 h-5 text-[#0a5c36]" />
                  <span>{biometricLoading ? 'Verifying Biometrics...' : 'Sign in with Fingerprint / Face ID'}</span>
                </button>

                {savedBiometricUser && (
                  <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mt-2 font-medium">
                    Enrolled for <span className="font-semibold text-gray-800 dark:text-gray-200">{savedBiometricUser.email}</span>
                  </p>
                )}
              </div>
            </form>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-gray-100 dark:border-green-900/40 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Powered by ClubKonnect API &amp; Paystack
            </p>
          </div>
        </div>
      </div>
    );
  }

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // ----------------------------------------------------
  // MAIN APP INTERFACE (Mobile-First, max-width 480px)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-grain-green flex flex-col items-center justify-start py-6 sm:py-10 px-3 sm:px-6 transition-colors duration-200 font-sans text-gray-900 dark:text-gray-100">
      <div className="w-full max-w-3xl space-y-6 sm:space-y-8 relative pb-28">
        {/* FLOATING IN-APP PUSH NOTIFICATION TOAST */}
        {activeToastNotification && (
          <div className="z-50 animate-in slide-in-from-top-4 fade-in duration-300">
            <div
              onClick={() => {
                if (activeToastNotification.type === 'low_balance') {
                  setIsFundModalOpen(true);
                } else if (activeToastNotification.metadata?.transactionId) {
                  const match = transactions.find(
                    (t) => t.transactionId === activeToastNotification.metadata?.transactionId
                  );
                  if (match) setSuccessReceipt(match);
                } else {
                  setIsNotificationDrawerOpen(true);
                }
                setActiveToastNotification(null);
              }}
              className={`p-4 rounded-[22px] shadow-soft-lg backdrop-blur-md border cursor-pointer flex items-start gap-3 transition-transform active:scale-[0.99] ${
                activeToastNotification.type === 'low_balance'
                  ? 'bg-amber-600/95 text-white border-amber-300 shadow-amber-950/40'
                  : 'bg-[#0a5c36]/95 text-white border-lime-400 shadow-green-950/50'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  activeToastNotification.type === 'low_balance'
                    ? 'bg-white/20 text-white'
                    : 'bg-[#d6ff00] text-[#0a5c36]'
                }`}
              >
                {activeToastNotification.type === 'low_balance' ? (
                  <AlertCircle className="w-5 h-5 text-amber-100" />
                ) : (
                  <BellRing className="w-5 h-5 text-[#0a5c36]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black tracking-wide truncate">
                    {activeToastNotification.title}
                  </span>
                  <span className="text-[10px] text-white/80 font-mono">Just now</span>
                </div>
                <p className="text-[11px] text-white/90 leading-snug mt-0.5 line-clamp-2">
                  {activeToastNotification.body}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] underline font-extrabold text-white">
                    {activeToastNotification.type === 'low_balance'
                      ? '⚡ Tap to Fund Wallet Now →'
                      : '📄 Tap to View Receipt →'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveToastNotification(null);
                }}
                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xs shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* eHUB HEADER CARD (Flat white rounded-24px with soft shadow) */}
        <header className="bg-white dark:bg-[#0e2116] rounded-[24px] shadow-soft p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border border-white/60 dark:border-green-900/40 transition-colors">
          {/* Logo & Brand */}
          <div
            onClick={() => {
              setActivePage('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-12 h-12 rounded-2xl bg-white p-1 flex items-center justify-center shadow-xs border border-gray-100 overflow-hidden shrink-0">
              <img
                src={CONFIG.LOGO_URL}
                alt="eHUB Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-baseline font-heading font-sora font-extrabold text-2xl tracking-tight leading-none text-gray-900 dark:text-white">
                <span className="text-[#0FA958]">e</span>
                <span>HUB</span>
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-tight block mt-0.5">
                {CONFIG.SLOGAN}
              </span>
            </div>
          </div>

          {/* Balance Pill & Actions */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[#f0f9f3] dark:bg-[#12281c] px-3.5 py-2 rounded-[18px] border border-green-100 dark:border-green-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium hidden sm:inline">Balance:</span>
              <span className="font-heading font-sora font-extrabold text-sm text-[#0FA958]">
                ₦{currentUser.balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <button
                onClick={() => setIsFundModalOpen(true)}
                className="ml-1 bg-[#0FA958] hover:bg-[#0c8f49] text-white text-[11px] font-bold px-2.5 py-1 rounded-xl transition cursor-pointer"
              >
                + Fund
              </button>
            </div>

            {/* Notifications */}
            <button
              onClick={() => setIsNotificationDrawerOpen(true)}
              aria-label="View notifications and alerts"
              title="Notifications & Alerts"
              className="relative p-2.5 rounded-2xl bg-gray-100 dark:bg-green-950/60 hover:bg-gray-200 dark:hover:bg-green-900/60 text-gray-700 dark:text-lime-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer border border-transparent dark:border-green-800/40"
            >
              <Bell className="w-4 h-4 text-[#0FA958] dark:text-[#d6ff00]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white font-black text-[10px] rounded-full flex items-center justify-center px-1 shadow-xs animate-pulse">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2.5 rounded-2xl bg-gray-100 dark:bg-green-950/60 hover:bg-gray-200 dark:hover:bg-green-900/60 text-gray-700 dark:text-lime-300 transition-all active:scale-95 flex items-center justify-center cursor-pointer border border-transparent dark:border-green-800/40"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#d6ff00] transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="w-4 h-4 text-[#0FA958] transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>

            {/* Settings */}
            <button
              onClick={() => setActivePage('settings')}
              aria-label="Settings & Security"
              title="Settings & Security"
              className={`p-2.5 rounded-2xl transition cursor-pointer border ${
                activePage === 'settings'
                  ? 'bg-[#0FA958] text-white border-[#0FA958] shadow-sm'
                  : 'bg-gray-100 dark:bg-green-950/60 hover:bg-gray-200 dark:hover:bg-green-900/60 text-gray-700 dark:text-lime-300 border-transparent dark:border-green-800/40'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2.5 rounded-2xl bg-gray-100 dark:bg-green-950/60 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 text-gray-600 dark:text-gray-300 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ==================================================== */}
        {/* MAIN BODY AREA                                       */}
        {/* ==================================================== */}
        <main className="space-y-6 sm:space-y-8">
          {activePage === 'dashboard' && (
            <div className="space-y-6 sm:space-y-8">
              {/* ==================================================== */}
              {/* SECTION 1: RECHARGE AIRTIME                          */}
              {/* ==================================================== */}
              <section
                id="section-airtime"
                className="bg-white dark:bg-[#0e2116] rounded-[24px] shadow-soft p-6 sm:p-8 space-y-6 border border-white/60 dark:border-green-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-100 dark:border-green-900/40">
                  <div>
                    <h2 className="font-heading font-sora font-extrabold text-2xl sm:text-3xl text-gray-900 dark:text-white tracking-tight">
                      Recharge Airtime
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Instant VTU Recharge with 2% Automatic Cashback on All Networks
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#e8f7ee] dark:bg-green-950/80 text-[#0FA958] dark:text-lime-300 text-xs font-bold font-mono">
                    2% Rebate Applied
                  </span>
                </div>

                {/* Select Network */}
                <div>
                  <label className="block text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3">
                    Select Network
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* MTN */}
                    <button
                      type="button"
                      onClick={() => setAirtimeNetwork('MTN')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative ${
                        airtimeNetwork === 'MTN'
                          ? 'border-[#0FA958] bg-[#f0f9f3] dark:bg-green-950/40 ring-2 ring-[#0FA958]/20 shadow-xs'
                          : 'border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#FFCC00] text-black font-heading font-sora font-extrabold flex items-center justify-center text-xs shadow-xs">
                        MTN
                      </div>
                      <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white">
                        MTN
                      </span>
                      <span className="text-[10px] font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2 py-0.5 rounded-full">
                        2% OFF
                      </span>
                      {airtimeNetwork === 'MTN' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#0FA958] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>

                    {/* GLO */}
                    <button
                      type="button"
                      onClick={() => setAirtimeNetwork('GLO')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative ${
                        airtimeNetwork === 'GLO'
                          ? 'border-[#0FA958] bg-[#f0f9f3] dark:bg-green-950/40 ring-2 ring-[#0FA958]/20 shadow-xs'
                          : 'border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#228B22] text-white font-heading font-sora font-extrabold flex items-center justify-center text-xs shadow-xs">
                        GLO
                      </div>
                      <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white">
                        GLO
                      </span>
                      <span className="text-[10px] font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2 py-0.5 rounded-full">
                        2% OFF
                      </span>
                      {airtimeNetwork === 'GLO' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#0FA958] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>

                    {/* AIRTEL */}
                    <button
                      type="button"
                      onClick={() => setAirtimeNetwork('AIRTEL')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative ${
                        airtimeNetwork === 'AIRTEL'
                          ? 'border-[#0FA958] bg-[#f0f9f3] dark:bg-green-950/40 ring-2 ring-[#0FA958]/20 shadow-xs'
                          : 'border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#E60000] text-white font-heading font-sora font-extrabold flex items-center justify-center text-xs shadow-xs">
                        airtel
                      </div>
                      <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white">
                        Airtel
                      </span>
                      <span className="text-[10px] font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2 py-0.5 rounded-full">
                        2% OFF
                      </span>
                      {airtimeNetwork === 'AIRTEL' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#0FA958] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>

                    {/* 9MOBILE */}
                    <button
                      type="button"
                      onClick={() => setAirtimeNetwork('9MOBILE')}
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer relative ${
                        airtimeNetwork === '9MOBILE'
                          ? 'border-[#0FA958] bg-[#f0f9f3] dark:bg-green-950/40 ring-2 ring-[#0FA958]/20 shadow-xs'
                          : 'border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] hover:border-gray-300'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#004730] text-[#cbed34] font-heading font-sora font-extrabold flex items-center justify-center text-[10px] shadow-xs">
                        9mob
                      </div>
                      <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white">
                        9mobile
                      </span>
                      <span className="text-[10px] font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2 py-0.5 rounded-full">
                        2% OFF
                      </span>
                      {airtimeNetwork === '9MOBILE' && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#0FA958] text-white flex items-center justify-center text-[10px]">
                          ✓
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Recipient Phone Number */}
                <div>
                  <label className="block text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">
                    Recipient Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={airtimePhone}
                      onChange={(e) => setAirtimePhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      placeholder="e.g. 08012345678"
                      className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-[#0FA958]"
                    />
                    {airtimePhone.length >= 4 && (
                      <span className="absolute right-3.5 top-3.5 text-xs font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2.5 py-1 rounded-full">
                        {detectNetworkFromPhone(airtimePhone)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Select Amount (N200, N500, N1000, N2000, N5000 with N1000 selected green) */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                      Select Amount
                    </label>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      You pay: <strong className="text-[#0FA958] font-heading font-sora font-extrabold">₦{Math.round(airtimeAmount * 0.98).toLocaleString()}</strong>
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {[200, 500, 1000, 2000, 5000].map((amt) => {
                      const isSelected = airtimeAmount === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAirtimeAmount(amt)}
                          className={`py-3.5 px-2 rounded-2xl font-heading font-sora text-sm sm:text-base transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#0FA958] text-white font-extrabold border-[#0FA958] shadow-md ring-2 ring-[#0FA958]/30 scale-[1.02]'
                              : 'bg-gray-50 dark:bg-[#12241b] text-gray-800 dark:text-gray-200 font-bold border-gray-200 dark:border-green-900/50 hover:border-[#0FA958]'
                          }`}
                        >
                          ₦{amt.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action error banner */}
                {actionError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{actionError}</span>
                  </div>
                )}

                {/* Green Continue Button */}
                <button
                  type="button"
                  onClick={buyAirtime}
                  disabled={actionLoading}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#0FA958] hover:bg-[#0c8f49] disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-heading font-sora font-extrabold text-base shadow-soft transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Processing Recharge...</span>
                    </>
                  ) : (
                    <span>Continue (Pay ₦{Math.round(airtimeAmount * 0.98).toLocaleString()})</span>
                  )}
                </button>
              </section>

              {/* ==================================================== */}
              {/* SECTION 2: AFFORDABLE DATA SUBSCRIPTIONS             */}
              {/* ==================================================== */}
              <section
                id="section-data"
                className="bg-white dark:bg-[#0e2116] rounded-[24px] shadow-soft p-6 sm:p-8 space-y-6 border border-white/60 dark:border-green-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-green-900/40">
                  <div>
                    <h2 className="font-heading font-sora font-extrabold text-2xl sm:text-3xl text-gray-900 dark:text-white tracking-tight">
                      Affordable Data Subscriptions
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Direct SME &amp; Corporate Gifting Data with Instant 24/7 Dispense
                    </p>
                  </div>
                  {/* Available Balance Pill */}
                  <div className="flex items-center gap-2 bg-[#f0f9f3] dark:bg-green-950/60 px-3.5 py-1.5 rounded-full border border-green-200 dark:border-green-900/60">
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">Available Balance:</span>
                    <strong className="font-heading font-sora font-extrabold text-sm text-[#0FA958]">
                      ₦{currentUser.balance.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                    <button
                      type="button"
                      onClick={() => setIsFundModalOpen(true)}
                      className="ml-1 bg-[#0FA958] hover:bg-[#0c8f49] text-white text-[11px] font-bold px-2 py-0.5 rounded-lg transition"
                    >
                      + Top Up
                    </button>
                  </div>
                </div>

                {/* Network Filter Pills (All Network pill green) */}
                <div>
                  <label className="block text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2.5">
                    Filter by Network
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {(['ALL', 'MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const).map((net) => {
                      const isSelected = dataNetworkFilter === net;
                      return (
                        <button
                          key={net}
                          type="button"
                          onClick={() => {
                            setDataNetworkFilter(net);
                            if (net !== 'ALL') setSelectedNetwork(net);
                          }}
                          className={`px-4 py-2 rounded-full font-heading font-sora text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-[#0FA958] text-white font-extrabold border-[#0FA958] shadow-xs'
                              : 'bg-gray-100 dark:bg-[#12241b] text-gray-700 dark:text-gray-300 font-bold border-gray-200 dark:border-green-900/50 hover:border-[#0FA958]'
                          }`}
                        >
                          {net === 'ALL' ? 'All Network' : net}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Buy Data Cards (1GB N300, 3GB N850, 5GB N1400 with VALID 30 DAYS) */}
                <div>
                  <label className="block text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-3">
                    Buy Data Plans
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(
                      (dataNetworkFilter === 'ALL'
                        ? DATA_PLANS.ALL
                        : DATA_PLANS[dataNetworkFilter]) || DATA_PLANS.ALL
                    ).map((plan) => {
                      const isSelected = selectedDataPlanId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => {
                            setSelectedDataPlanId(plan.id);
                            if (plan.network) setSelectedNetwork(plan.network);
                          }}
                          className={`p-5 rounded-[22px] border-2 transition-all cursor-pointer relative flex flex-col justify-between gap-3 ${
                            isSelected
                              ? 'border-[#0FA958] bg-[#f0f9f3] dark:bg-green-950/40 ring-2 ring-[#0FA958]/20 shadow-soft'
                              : 'border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block">
                                {plan.network} SME Data
                              </span>
                              <span className="font-heading font-sora font-extrabold text-2xl text-gray-900 dark:text-white mt-1 block">
                                {plan.size}
                              </span>
                            </div>
                            <span className="bg-[#e7f7ed] dark:bg-green-950 text-[#0FA958] dark:text-lime-300 font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full">
                              VALID {plan.validity || '30 DAYS'}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-gray-100 dark:border-green-900/30 flex items-center justify-between">
                            <span className="font-heading font-sora font-extrabold text-xl text-[#0FA958]">
                              ₦{plan.price.toLocaleString()}
                            </span>
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                isSelected
                                  ? 'bg-[#0FA958] text-white'
                                  : 'text-gray-400 group-hover:text-gray-600'
                              }`}
                            >
                              {isSelected ? 'Selected ✓' : 'Select'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recipient Phone for Data */}
                <div>
                  <label className="block text-xs font-heading font-sora font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">
                    Recipient Phone Number
                  </label>
                  <input
                    type="tel"
                    value={dataPhone}
                    onChange={(e) => setDataPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="e.g. 08012345678"
                    className="w-full px-4 py-3.5 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-mono text-base focus:outline-none focus:ring-2 focus:ring-[#0FA958]"
                  />
                </div>

                {/* Green Buy Now Button */}
                <button
                  type="button"
                  onClick={buyData}
                  disabled={actionLoading}
                  className="w-full py-4 px-6 rounded-[18px] bg-[#0FA958] hover:bg-[#0c8f49] disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-heading font-sora font-extrabold text-base shadow-soft transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Dispensing Data Bundle...</span>
                    </>
                  ) : (
                    <span>Buy Now • Instant Dispense</span>
                  )}
                </button>
              </section>

              {/* ==================================================== */}
              {/* SECTION 3: GET REWARDED WITH CASHBACK                */}
              {/* ==================================================== */}
              <section
                id="section-cashback"
                className="bg-white dark:bg-[#0e2116] rounded-[24px] shadow-soft p-6 sm:p-8 space-y-6 border border-white/60 dark:border-green-900/40 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-gray-100 dark:border-green-900/40">
                  <div>
                    <h2 className="font-heading font-sora font-extrabold text-2xl sm:text-3xl text-gray-900 dark:text-white tracking-tight">
                      Get Rewarded with Cashback
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Enjoy automatic recharge rebates, wholesale margins, and ₦100 referral bonuses.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#e8f7ee] dark:bg-green-950 text-[#0FA958] dark:text-lime-300 text-xs font-bold">
                    Rewards Program
                  </span>
                </div>

                {/* Total Cashback Banner Card */}
                <div className="rounded-[22px] bg-gradient-to-br from-[#0FA958] to-[#0b8042] text-white p-6 shadow-soft flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-green-100 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-lime-200" />
                      Total Cashback
                    </span>
                    <h3 className="font-heading font-sora font-extrabold text-3xl sm:text-4xl text-white mt-1">
                      ₦{(currentUser.referralEarnings ?? 850.0).toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </h3>
                    <p className="text-xs text-green-100 mt-1">
                      Credited directly into your active wallet balance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsFundModalOpen(true)}
                    className="px-5 py-3 rounded-2xl bg-white text-[#0FA958] font-heading font-sora font-extrabold text-xs shadow-md hover:bg-green-50 transition cursor-pointer"
                  >
                    + Use Cashback
                  </button>
                </div>

                {/* 3 Cashback & Rewards Feature Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#12241b] border border-gray-100 dark:border-green-900/40 space-y-1">
                    <div className="w-8 h-8 rounded-xl bg-green-100 dark:bg-green-950 text-[#0FA958] flex items-center justify-center font-bold text-sm mb-2">
                      ⚡
                    </div>
                    <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white block">
                      2% Airtime Cashback
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Automatically subtracted at checkout for MTN, GLO, Airtel and 9mobile.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#12241b] border border-gray-100 dark:border-green-900/40 space-y-1">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold text-sm mb-2">
                      📡
                    </div>
                    <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white block">
                      Wholesale Data
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Save up to ₦200 per gigabyte compared to commercial telecom prices.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#12241b] border border-gray-100 dark:border-green-900/40 space-y-1">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold text-sm mb-2">
                      🎁
                    </div>
                    <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white block">
                      ₦100 Referral Bonus
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Earn ₦100 instantly when a friend signs up with your referral code.
                    </p>
                  </div>
                </div>

                {/* Referral Code Copy Card */}
                <div className="p-4 rounded-2xl bg-[#f0f9f3] dark:bg-[#12281c] border border-green-200 dark:border-green-900/50 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#0FA958] uppercase tracking-wider block">
                      Your Referral Code
                    </span>
                    <span className="font-mono font-extrabold text-base text-gray-900 dark:text-white mt-0.5 block">
                      {currentUser.referralCode || 'EHUB-BEN492'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyAccountNumber(currentUser.referralCode || 'EHUB-BEN492')}
                      className="px-4 py-2 rounded-xl bg-[#0FA958] hover:bg-[#0c8f49] text-white font-heading font-sora font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAccount ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const shareUrl = `${window.location.origin}?ref=${encodeURIComponent(currentUser.referralCode || 'EHUB-BEN492')}`;
                        const shareText = `Join eHUB VTU with my code ${currentUser.referralCode || 'EHUB-BEN492'} to get cheap data & airtime rebates! ${shareUrl}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                      }}
                      className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-green-900/50 hover:bg-gray-200 text-gray-800 dark:text-lime-300 font-bold text-xs transition cursor-pointer"
                    >
                      Share on WhatsApp
                    </button>
                  </div>
                </div>
              </section>

              {/* ==================================================== */}
              {/* UTILITY SERVICES: AEDC ELECTRICITY & CABLE TV        */}
              {/* ==================================================== */}
              <section className="bg-white dark:bg-[#0e2116] rounded-[24px] shadow-soft p-6 sm:p-8 space-y-6 border border-white/60 dark:border-green-900/40 transition-colors">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-green-900/40">
                  <div>
                    <h3 className="font-heading font-sora font-extrabold text-xl text-gray-900 dark:text-white">
                      AEDC Electricity &amp; Utility Bills
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Abuja Electricity Distribution Company (AEDC) &amp; TV Subscriptions
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage('electricity')}
                    className="text-xs font-heading font-sora font-extrabold text-[#0FA958] hover:underline"
                  >
                    Open Full Form →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Electricity Card */}
                  <div
                    onClick={() => setActivePage('electricity')}
                    className="p-5 rounded-2xl bg-gray-50 dark:bg-[#12241b] border border-gray-200 dark:border-green-900/40 hover:border-[#0FA958] transition cursor-pointer space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center font-bold">
                        <i className="fa-solid fa-lightbulb text-lg"></i>
                      </div>
                      <div>
                        <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white block">
                          AEDC Electricity Token
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Prepaid Token &amp; Postpaid Bill Verification
                        </span>
                      </div>
                    </div>
                    <span className="inline-block text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-full">
                      Live Meter Verification Active
                    </span>
                  </div>

                  {/* Dedicated Virtual Account */}
                  <div
                    onClick={() => {
                      setFundMethod('bank_transfer');
                      setIsFundModalOpen(true);
                    }}
                    className="p-5 rounded-2xl bg-gray-50 dark:bg-[#12241b] border border-gray-200 dark:border-green-900/40 hover:border-[#0FA958] transition cursor-pointer space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950 text-[#0FA958] flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-heading font-sora font-extrabold text-sm text-gray-900 dark:text-white block">
                          Moniepoint Automated Transfer
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          Acc: 8109283719 • Auto-credits wallet
                        </span>
                      </div>
                    </div>
                    <span className="inline-block text-[11px] font-bold text-[#0FA958] bg-[#e7f7ed] dark:bg-green-950 px-2.5 py-1 rounded-full">
                      Zero Funding Fee
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ==================================================== */}
          {/* 2. DEDICATED DATA PAGE                               */}
          {/* ==================================================== */}
          {activePage === 'data' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    setActivePage('dashboard');
                    setActionError('');
                  }}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-[#0a5c36] dark:text-[#d6ff00]">Buy Mobile Data</h2>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Abuja's Cheapest SME &amp; Direct Data</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Network Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  1. Select Network
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const).map((net) => {
                    const isSelected = selectedNetwork === net;
                    return (
                      <button
                        key={net}
                        onClick={() => {
                          setSelectedNetwork(net);
                          const plans = DATA_PLANS[net];
                          if (plans && plans.length > 0) {
                            setSelectedDataPlanId(plans[0].id);
                          }
                        }}
                        className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'border-[#0a5c36] dark:border-green-600 bg-[#0a5c36] dark:bg-green-700 text-white shadow-md'
                            : 'border-gray-200 dark:border-green-900/50 bg-gray-50 dark:bg-[#12241b] text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[#162c21]'
                        }`}
                      >
                        <span className="font-extrabold text-xs">{net}</span>
                        <span
                          className={`text-[9px] mt-0.5 font-semibold ${
                            isSelected ? 'text-[#d6ff00]' : 'text-gray-400 dark:text-gray-400'
                          }`}
                        >
                          {net === 'MTN'
                            ? 'From ₦280'
                            : net === 'GLO'
                            ? 'From ₦260'
                            : net === 'AIRTEL'
                            ? 'From ₦290'
                            : 'From ₦220'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Plan Dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Choose Data Plan
                </label>
                <select
                  value={selectedDataPlanId}
                  onChange={(e) => setSelectedDataPlanId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600"
                >
                  {(DATA_PLANS[selectedNetwork] || []).map((plan) => (
                    <option key={plan.id} value={plan.id} className="dark:bg-[#0c1912] dark:text-white">
                      {plan.name} - ₦{plan.price.toLocaleString()} ({plan.validity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  3. Recipient Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="e.g. 08031234567"
                    value={dataPhone}
                    onChange={(e) => setDataPhone(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDataPhone('08030001234')}
                    className="text-[10px] text-[#0a5c36] dark:text-lime-300 bg-green-50 dark:bg-green-950/80 px-2 py-0.5 rounded-md font-bold cursor-pointer border border-transparent dark:border-green-800/40"
                  >
                    + Use Sample No
                  </button>
                </div>
              </div>

              {/* Summary Box */}
              {(() => {
                const plan = (DATA_PLANS[selectedNetwork] || []).find((p) => p.id === selectedDataPlanId);
                if (!plan) return null;
                return (
                  <div className="p-4 rounded-2xl bg-green-50/80 dark:bg-[#11261b] border border-green-200 dark:border-green-800/60 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Network &amp; Bundle:</span>
                      <strong className="text-gray-900 dark:text-white">{plan.name}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-300">
                      <span>Validity:</span>
                      <strong className="text-gray-900 dark:text-white">{plan.validity}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-300 pt-1 border-t border-green-200 dark:border-green-800/60 font-bold">
                      <span className="text-[#0a5c36] dark:text-[#d6ff00]">Total Price:</span>
                      <span className="text-[#0a5c36] dark:text-[#d6ff00] text-base font-black">
                        ₦{plan.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={buyData}
                disabled={actionLoading}
                className="w-full py-4 bg-[#0a5c36] hover:bg-[#084b2c] dark:bg-green-700 dark:hover:bg-green-600 text-white font-black rounded-2xl shadow-lg shadow-green-900/10 active:scale-[0.99] transition text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing with ClubKonnect Gateway...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#d6ff00]" />
                    <span>BUY DATA NOW</span>
                  </>
                )}
              </button>

              <div className="text-center">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Direct API Gateway: https://www.nellobytesystems.com/APIDatabundleV1.asp
                </span>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* 3. DEDICATED AIRTIME PAGE (2% OFF)                   */}
          {/* ==================================================== */}
          {activePage === 'airtime' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    setActivePage('dashboard');
                    setActionError('');
                  }}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-blue-700 dark:text-blue-400">Buy Airtime (2% OFF)</h2>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">Instant Automated VTU Recharge</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Network */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  1. Network
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const).map((net) => {
                    const isSelected = airtimeNetwork === net;
                    return (
                      <button
                        key={net}
                        onClick={() => setAirtimeNetwork(net)}
                        className={`py-3 px-2 rounded-2xl border font-bold text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                            : 'border-gray-200 dark:border-blue-900/40 bg-gray-50 dark:bg-[#12241b] text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[#162c21]'
                        }`}
                      >
                        {net}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="e.g. 08023456789"
                    value={airtimePhone}
                    onChange={(e) => setAirtimePhone(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  3. Amount (₦)
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={airtimeAmount}
                  onChange={(e) => setAirtimeAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[100, 200, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAirtimeAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        airtimeAmount === amt
                          ? 'bg-blue-100 dark:bg-blue-900/80 border-blue-400 dark:border-blue-500 text-blue-700 dark:text-blue-200'
                          : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#183024]'
                      }`}
                    >
                      ₦{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount Box */}
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-[#0f1d2b] border border-blue-200 dark:border-blue-900/50 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600 dark:text-gray-300">
                  <span>Recharge Value:</span>
                  <span className="font-bold line-through text-gray-400">₦{airtimeAmount}</span>
                </div>
                <div className="flex justify-between text-blue-700 dark:text-blue-300 font-semibold">
                  <span>eHUB 2% Discount:</span>
                  <span>- ₦{Math.round(airtimeAmount * 0.02)}</span>
                </div>
                <div className="flex justify-between text-gray-900 dark:text-white pt-1 border-t border-blue-200 dark:border-blue-900/50 font-bold">
                  <span>Amount to Pay:</span>
                  <span className="text-blue-700 dark:text-blue-400 text-base font-black">
                    ₦{Math.round(airtimeAmount * 0.98).toLocaleString()}
                  </span>
                </div>
              </div>

              <button
                onClick={buyAirtime}
                disabled={actionLoading}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg active:scale-[0.99] transition text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispensing Airtime...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#d6ff00]" />
                    <span>RECHARGE AIRTIME</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ==================================================== */}
          {/* 4. DEDICATED ELECTRICITY PAGE (AEDC & DISCOS)         */}
          {/* ==================================================== */}
          {activePage === 'electricity' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    setActivePage('dashboard');
                    setActionError('');
                  }}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-amber-700 dark:text-amber-400">Electricity Bill Payment</h2>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">AEDC Abuja &amp; All Nigerian Discos</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Disco */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  1. Distribution Company (Disco)
                </label>
                <select
                  value={selectedDisco}
                  onChange={(e) => {
                    setSelectedDisco(e.target.value);
                    setVerifiedCustomerName('');
                    setMeterVerified(false);
                    setMeterVerificationError('');
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {DISCO_PROVIDERS.map((d) => (
                    <option key={d.id} value={d.id} className="dark:bg-[#0c1912] dark:text-white">
                      {d.name} {d.featured ? '⭐ (Abuja)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meter Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Meter Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMeterType('prepaid');
                      setVerifiedCustomerName('');
                      setMeterVerified(false);
                      setMeterVerificationError('');
                    }}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      meterType === 'prepaid'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    PREPAID (Generates Token)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMeterType('postpaid');
                      setVerifiedCustomerName('');
                      setMeterVerified(false);
                      setMeterVerificationError('');
                    }}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      meterType === 'postpaid'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    POSTPAID (Bill Credit)
                  </button>
                </div>
              </div>

              {/* Meter Number with VERIFY button before Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  3. Meter Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter Meter Number"
                    value={meterNumber}
                    onChange={(e) => {
                      setMeterNumber(e.target.value);
                      setVerifiedCustomerName('');
                      setMeterVerified(false);
                      setMeterVerificationError('');
                    }}
                    className="flex-1 px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyMeter}
                    disabled={isVerifyingMeter || !meterNumber.trim()}
                    className="px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-black text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isVerifyingMeter ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>VERIFY</span>
                    )}
                  </button>
                </div>

                {/* Error message if verification fails or meter does not match */}
                {meterVerificationError && (
                  <div className="mt-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                    <span>{meterVerificationError}</span>
                  </div>
                )}

                {/* Customer name ONLY shown when verification returns success */}
                {meterVerified && verifiedCustomerName && (
                  <div className="mt-2.5 p-3.5 rounded-2xl bg-green-50 dark:bg-[#11291b] border border-green-200 dark:border-green-800/80 text-green-950 dark:text-green-100 text-xs flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-green-700 dark:text-lime-300" />
                      </div>
                      <div>
                        <span className="text-[10px] text-green-700 dark:text-green-400 font-bold uppercase tracking-wider block">
                          Verified Customer Name
                        </span>
                        <strong className="text-sm font-black text-green-950 dark:text-white block">
                          {verifiedCustomerName}
                        </strong>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-green-200 dark:bg-green-800 text-green-800 dark:text-lime-300 text-[10px] font-black uppercase tracking-wider">
                      VERIFIED
                    </span>
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  4. Amount to Pay (₦)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={electricityAmount}
                  onChange={(e) => setElectricityAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[1000, 2000, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setElectricityAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        electricityAmount === amt
                          ? 'bg-amber-100 dark:bg-amber-900/80 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-200'
                          : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#183024]'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={payElectricity}
                disabled={actionLoading}
                className="w-full py-4 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-lg active:scale-[0.99] transition text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {actionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating AEDC Token...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#d6ff00]" />
                    <span>PAY FOR {selectedDisco === 'aedc' ? 'AEDC ABUJA' : 'DISCO'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ==================================================== */}
          {/* 5. DEDICATED CABLE TV PAGE (GOTV / DSTV / STARTIMES)  */}
          {/* ==================================================== */}
          {activePage === 'cable' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => {
                    setActivePage('dashboard');
                    setActionError('');
                  }}
                  className="p-2 rounded-xl bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-purple-700 dark:text-purple-400">Cable TV Subscription</h2>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">GOTV, DSTV &amp; Startimes Instant Activation</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Provider */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  1. Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['GOTV', 'DSTV', 'STARTIMES'] as const).map((prov) => {
                    const isSelected = cableProvider === prov;
                    return (
                      <button
                        key={prov}
                        onClick={() => {
                          setCableProvider(prov);
                          const packages = CABLE_PACKAGES[prov];
                          if (packages && packages.length > 0) {
                            setSelectedCablePackageId(packages[0].id);
                          }
                        }}
                        className={`py-3 px-2 rounded-2xl border font-black text-xs flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'border-purple-600 bg-purple-600 text-white shadow-md'
                            : 'border-gray-200 dark:border-purple-900/40 bg-gray-50 dark:bg-[#12241b] text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-[#162c21]'
                        }`}
                      >
                        {prov}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Package dropdown */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  2. Select Bouquet / Package
                </label>
                <select
                  value={selectedCablePackageId}
                  onChange={(e) => setSelectedCablePackageId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {(CABLE_PACKAGES[cableProvider] || []).map((pkg) => (
                    <option key={pkg.id} value={pkg.id} className="dark:bg-[#0c1912] dark:text-white">
                      {pkg.name} - ₦{pkg.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* IUC */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  3. IUC / Smartcard Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2039485710"
                  value={iucNumber}
                  onChange={(e) => setIucNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Phone number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  4. Registered Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={cablePhone}
                  onChange={(e) => setCablePhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {(() => {
                const pkg = (CABLE_PACKAGES[cableProvider] || []).find((p) => p.id === selectedCablePackageId);
                const price = pkg ? pkg.price : 0;
                return (
                  <button
                    onClick={payCable}
                    disabled={actionLoading}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl shadow-lg active:scale-[0.99] transition text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Activating Cable Package...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-[#d6ff00]" />
                        <span>PAY ₦{price.toLocaleString()} FOR {pkg?.name || cableProvider}</span>
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          )}

          {/* ==================================================== */}
          {/* 6. TRANSACTION HISTORY PAGE WITH COMPLETE FILTERING  */}
          {/* ==================================================== */}
          {activePage === 'history' && (
            <div className="space-y-4">
              {/* Header Bar */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActivePage('dashboard')}
                    className="p-2 rounded-xl bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-gray-800 dark:text-white">Transaction History</h2>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Showing {filteredTransactions.length} of {transactions.length} records
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    hasActiveFilters || isFilterExpanded
                      ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600'
                      : 'bg-gray-100 dark:bg-[#162a20] text-gray-700 dark:text-gray-200 border-gray-200 dark:border-green-900/50'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>
              </div>

              {/* FINANCIAL SUMMARY CARDS */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-[#0f241a] border border-emerald-200/80 dark:border-emerald-800/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Total Funded
                  </span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400 block mt-0.5">
                    +₦{totalFilteredFunded.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-[#261216] border border-rose-200/80 dark:border-rose-900/60">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    Total Spent
                  </span>
                  <span className="text-base font-black text-rose-700 dark:text-rose-400 block mt-0.5">
                    -₦{totalFilteredSpent.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* FILTER CONTROLS DRAWER / PANEL */}
              {isFilterExpanded && (
                <div className="p-4 rounded-[22px] bg-gray-50 dark:bg-[#0c1912] border border-gray-200 dark:border-green-900/40 space-y-3.5 animate-in fade-in">
                  {/* Search Query */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                      Search Transactions
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search reference, phone, plan, Disco..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3.5 py-2.5 pl-9 pr-8 rounded-xl border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#12241b] text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="w-5 h-5 rounded-full bg-gray-200 dark:bg-green-900 text-gray-600 dark:text-gray-200 hover:bg-gray-300 flex items-center justify-center absolute right-2.5 top-2.5 text-[10px] cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. FILTER BY TYPE */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Filter by Type
                      </label>
                      {filterType !== 'all' && (
                        <button
                          onClick={() => setFilterType('all')}
                          className="text-[10px] text-[#0a5c36] dark:text-[#d6ff00] font-bold hover:underline"
                        >
                          Reset Type
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { id: 'all', label: 'All Types', icon: 'fa-layer-group' },
                        { id: 'data', label: 'Data', icon: 'fa-signal' },
                        { id: 'airtime', label: 'Airtime', icon: 'fa-phone' },
                        { id: 'electricity', label: 'Electricity', icon: 'fa-lightbulb' },
                        { id: 'cable', label: 'Cable TV', icon: 'fa-tv' },
                        { id: 'funding', label: 'Funding', icon: 'fa-wallet' },
                      ].map((item) => {
                        const isSelected = filterType === item.id;
                        const count = getTypeCount(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => setFilterType(item.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600 shadow-xs'
                                : 'bg-white dark:bg-[#12241b] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-green-900/50 hover:bg-gray-100 dark:hover:bg-[#162c21]'
                            }`}
                          >
                            <i className={`fa-solid ${item.icon} text-[10px]`}></i>
                            <span>{item.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isSelected
                                  ? 'bg-white/20 text-[#d6ff00]'
                                  : 'bg-gray-100 dark:bg-[#1a3325] text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. FILTER BY DATE RANGE */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Filter by Date Range
                      </label>
                      {dateRangePreset !== 'all' && (
                        <button
                          onClick={() => {
                            setDateRangePreset('all');
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className="text-[10px] text-[#0a5c36] dark:text-[#d6ff00] font-bold hover:underline"
                        >
                          Reset Dates
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: '7days', label: 'Last 7 Days' },
                        { id: '30days', label: 'Last 30 Days' },
                        { id: 'custom', label: 'Custom Range' },
                      ].map((item) => {
                        const isSelected = dateRangePreset === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setDateRangePreset(item.id as any)}
                            className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                              isSelected
                                ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600 shadow-xs'
                                : 'bg-white dark:bg-[#12241b] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-green-900/50 hover:bg-gray-100 dark:hover:bg-[#162c21]'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Date Picker Fields */}
                    {dateRangePreset === 'custom' && (
                      <div className="mt-2.5 p-3 rounded-xl bg-white dark:bg-[#12241b] border border-gray-200 dark:border-green-900/50 space-y-2">
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                          Select Specific Start &amp; End Dates:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">From:</span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#0c1912] text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0a5c36]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 block mb-1">To:</span>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 dark:border-green-900/50 bg-white dark:bg-[#0c1912] text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0a5c36]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACTIVE FILTER TAGS & RESET ALL */}
                  {hasActiveFilters && (
                    <div className="pt-2 border-t border-gray-200 dark:border-green-900/40 flex items-center justify-between text-xs">
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Active:</span>
                        {filterType !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950 text-[#0a5c36] dark:text-lime-300 text-[10px] font-bold">
                            Type: {filterType}
                            <button onClick={() => setFilterType('all')} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                        {dateRangePreset !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                            Date: {dateRangePreset === 'custom' ? 'Custom' : dateRangePreset}
                            <button onClick={() => { setDateRangePreset('all'); setCustomStartDate(''); setCustomEndDate(''); }} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                        {searchQuery && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                            "{searchQuery.slice(0, 10)}"
                            <button onClick={() => setSearchQuery('')} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={resetAllFilters}
                        className="text-[11px] font-black text-red-600 dark:text-red-400 hover:underline shrink-0 ml-2 cursor-pointer"
                      >
                        Reset All
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FILTERED TRANSACTIONS LIST */}
              {filteredTransactions.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl bg-gray-50 dark:bg-[#0c1912] border border-dashed border-gray-200 dark:border-green-900/40 text-center text-gray-500 dark:text-gray-400 text-xs space-y-2">
                  <Filter className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="font-bold text-gray-700 dark:text-gray-200">No transactions match your criteria.</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Try picking a broader date range or changing your type filter.
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetAllFilters}
                      className="mt-2 px-4 py-2 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredTransactions.map((tx) => (
                    <div
                      key={tx.transactionId}
                      onClick={() => setSuccessReceipt(tx)}
                      className="p-3.5 rounded-2xl bg-white dark:bg-[#12241b] border border-gray-200 dark:border-green-900/40 hover:border-[#0a5c36] dark:hover:border-green-600 shadow-xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 ${
                            tx.type === 'data'
                              ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                              : tx.type === 'airtime'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                              : tx.type === 'electricity'
                              ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
                              : tx.type === 'cable'
                              ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                              : 'bg-lime-200 dark:bg-green-800 text-[#0a5c36] dark:text-[#d6ff00]'
                          }`}
                        >
                          {tx.type === 'data' && <i className="fa-solid fa-signal"></i>}
                          {tx.type === 'airtime' && <i className="fa-solid fa-phone"></i>}
                          {tx.type === 'electricity' && <i className="fa-solid fa-lightbulb"></i>}
                          {tx.type === 'cable' && <i className="fa-solid fa-tv"></i>}
                          {tx.type === 'funding' && <Wallet className="w-5 h-5" />}
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-gray-900 dark:text-white block truncate max-w-[190px]">
                            {tx.title}
                          </span>
                          <span className="text-[10px] text-gray-400 block font-mono truncate">
                            {formatTxDisplayDate(tx.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`text-sm font-black block ${
                            tx.type === 'funding' ? 'text-green-600 dark:text-lime-400' : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {tx.type === 'funding' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-green-600 dark:text-lime-300 font-bold bg-green-50 dark:bg-green-950/80 px-2 py-0.5 rounded-md">
                          SUCCESS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* 7. SETTINGS & BIOMETRIC SECURITY MENU                */}
          {/* ==================================================== */}
          {activePage === 'settings' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Settings Header */}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-green-900/40">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setActivePage('dashboard')}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-700 dark:text-gray-200 flex items-center justify-center cursor-pointer transition"
                    title="Back to Dashboard"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                      <Settings className="w-4 h-4 text-[#0a5c36] dark:text-[#d6ff00]" />
                      Settings &amp; Security
                    </h2>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      Manage device biometrics, local session &amp; preferences
                    </span>
                  </div>
                </div>
              </div>

              {/* FEEDBACK BANNER */}
              {biometricFeedback && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-semibold flex items-start gap-2.5 transition animate-in fade-in ${
                    biometricFeedback.type === 'success'
                      ? 'bg-green-50 dark:bg-green-950/80 text-green-800 dark:text-lime-300 border border-green-200 dark:border-green-800'
                      : biometricFeedback.type === 'error'
                      ? 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50'
                      : 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
                  }`}
                >
                  {biometricFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                  ) : biometricFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-[11px] leading-relaxed">
                    {biometricFeedback.text}
                  </div>
                  <button
                    onClick={() => setBiometricFeedback(null)}
                    className="text-xs opacity-60 hover:opacity-100 cursor-pointer ml-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* BIOMETRIC TOGGLE CARD (CORE REQUIREMENT) */}
              <div className="p-4 rounded-[22px] bg-gradient-to-br from-white to-green-50/50 dark:from-[#102319] dark:to-[#0c1a13] border-2 border-green-200 dark:border-green-800/80 shadow-sm space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#d6ff00] to-lime-400 text-[#0a5c36] flex items-center justify-center shadow-md shadow-lime-500/20 shrink-0">
                      <Fingerprint className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">
                          Use Fingerprint / Face ID
                        </h3>
                        {isBiometricEnabled && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/80 text-[#0a5c36] dark:text-[#d6ff00]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                        Secure your local session using the Web Authentication API. Unlock eHUB faster and safer with Touch ID, Face ID, Android Biometrics, or Windows Hello.
                      </p>
                    </div>
                  </div>

                  {/* TOGGLE SWITCH */}
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isBiometricEnabled}
                      disabled={!isBiometricSupported || biometricLoading}
                      onClick={handleToggleBiometrics}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0a5c36] focus:ring-offset-2 dark:focus:ring-offset-[#102319] ${
                        isBiometricEnabled
                          ? 'bg-[#0a5c36] dark:bg-[#d6ff00]'
                          : 'bg-gray-200 dark:bg-gray-700'
                      } ${(!isBiometricSupported || biometricLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white dark:bg-[#073620] shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          isBiometricEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      >
                        {biometricLoading ? (
                          <RefreshCw className="w-3 h-3 text-[#0a5c36] dark:text-[#d6ff00] animate-spin" />
                        ) : isBiometricEnabled ? (
                          <Check className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* DEVICE CAPABILITY STATUS */}
                <div className="pt-2 border-t border-gray-100 dark:border-green-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                      Device Sensor Support:
                    </span>
                    {isBiometricSupported ? (
                      <span className="font-bold text-[#0a5c36] dark:text-lime-300 bg-lime-100 dark:bg-green-950 px-2 py-0.5 rounded-lg text-[11px] flex items-center gap-1">
                        ✓ WebAuthn Available
                      </span>
                    ) : (
                      <span className="font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-lg text-[11px]">
                        Hardware Biometrics Unavailable
                      </span>
                    )}
                  </div>

                  {isBiometricEnabled && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Session key registered locally.
                      </span>
                      <button
                        type="button"
                        onClick={handleTestBiometrics}
                        disabled={biometricLoading}
                        className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-green-900/40 hover:bg-gray-200 dark:hover:bg-green-800/60 text-[#0a5c36] dark:text-lime-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <Fingerprint className="w-3.5 h-3.5" />
                        <span>Test Sensor Prompt</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* HARDWARE FIDO2 NOTE */}
                <div className="p-3 rounded-xl bg-lime-50/80 dark:bg-[#0b1710] border border-lime-200/80 dark:border-green-900/50 text-[11px] text-gray-600 dark:text-gray-300 space-y-1">
                  <div className="font-bold text-[#0a5c36] dark:text-lime-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>FIDO2 / Web Authentication API</span>
                  </div>
                  <p className="leading-relaxed text-[10.5px]">
                    Your biometric raw prints never leave your device. The browser leverages hardware-backed public key credentials to securely authenticate your local session.
                  </p>
                </div>
              </div>

              {/* PUSH NOTIFICATIONS & BALANCE ALERTS CARD */}
              <div className="p-4 rounded-[22px] bg-gradient-to-br from-white to-lime-50/40 dark:from-[#102319] dark:to-[#0c1a13] border-2 border-lime-300 dark:border-green-800 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#0a5c36] to-[#0f7a48] text-[#d6ff00] flex items-center justify-center shadow-md shadow-green-900/20 shrink-0">
                      <BellRing className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">
                          Push Notifications &amp; Alerts
                        </h3>
                        {notificationSettings.pushEnabled && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-lime-100 dark:bg-green-900/80 text-[#0a5c36] dark:text-[#d6ff00]">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                        Instant system push &amp; in-app pop-ups for successful data, airtime, and bill transactions, plus timely low balance warnings.
                      </p>
                    </div>
                  </div>

                  {/* MASTER PUSH TOGGLE */}
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notificationSettings.pushEnabled}
                      onClick={() => {
                        const next = !notificationSettings.pushEnabled;
                        updateNotificationSettings({ pushEnabled: next });
                        if (next && browserPermission !== 'granted') {
                          handleRequestPushPermission();
                        }
                      }}
                      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0a5c36] ${
                        notificationSettings.pushEnabled
                          ? 'bg-[#0a5c36] dark:bg-[#d6ff00]'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white dark:bg-[#073620] shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                          notificationSettings.pushEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      >
                        {notificationSettings.pushEnabled ? (
                          <Check className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                {/* BROWSER PERMISSION STATUS */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#0c1811] border border-gray-200/80 dark:border-green-900/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Browser Push Status:</span>
                    <span
                      className={`font-black text-[11px] px-2 py-0.5 rounded-md ${
                        browserPermission === 'granted'
                          ? 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-lime-300'
                          : browserPermission === 'denied'
                          ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {browserPermission === 'granted'
                        ? '✓ System Permission Granted'
                        : browserPermission === 'denied'
                        ? 'Blocked in Browser'
                        : 'Permission Default'}
                    </span>
                  </div>
                  {browserPermission !== 'granted' && isBrowserNotificationSupported() && (
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      className="px-2.5 py-1 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 text-white rounded-lg font-bold text-[11px] shadow-xs cursor-pointer"
                    >
                      Request System Push
                    </button>
                  )}
                </div>

                {/* INDIVIDUAL ALERT TOGGLES */}
                <div className="space-y-3 pt-1 border-t border-gray-100 dark:border-green-900/40">
                  {/* Transaction Status Alert */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                        Successful Transaction Alerts
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                        Push alerts when data, airtime, AEDC tokens &amp; TV subs succeed
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.transactionSuccessAlerts}
                      onChange={(e) => updateNotificationSettings({ transactionSuccessAlerts: e.target.checked })}
                      className="w-4 h-4 text-[#0a5c36] accent-[#0a5c36] rounded cursor-pointer"
                    />
                  </div>

                  {/* Low Balance Alert */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                        Low Wallet Balance Alerts
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 block">
                        Warn when wallet balance drops below chosen threshold
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notificationSettings.lowBalanceAlerts}
                      onChange={(e) => updateNotificationSettings({ lowBalanceAlerts: e.target.checked })}
                      className="w-4 h-4 text-[#0a5c36] accent-[#0a5c36] rounded cursor-pointer"
                    />
                  </div>

                  {/* Low Balance Threshold Selector */}
                  {notificationSettings.lowBalanceAlerts && (
                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                          Alert Threshold:
                        </span>
                        <span className="font-mono font-black text-xs text-amber-800 dark:text-amber-300">
                          ₦{notificationSettings.lowBalanceThreshold.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[200, 500, 1000, 2000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => updateNotificationSettings({ lowBalanceThreshold: val })}
                            className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                              notificationSettings.lowBalanceThreshold === val
                                ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600'
                                : 'bg-white dark:bg-[#12241b] text-gray-700 dark:text-gray-300 border-gray-200 dark:border-green-900/50 hover:bg-gray-100'
                            }`}
                          >
                            ₦{val.toLocaleString()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sound & Vibration Options */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-[#0c1811] border border-gray-200 dark:border-green-900/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.soundEnabled}
                        onChange={(e) => updateNotificationSettings({ soundEnabled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-[#0a5c36] rounded"
                      />
                      <Volume2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Audio Chimes</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-[#0c1811] border border-gray-200 dark:border-green-900/40 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificationSettings.vibrateEnabled}
                        onChange={(e) => updateNotificationSettings({ vibrateEnabled: e.target.checked })}
                        className="w-3.5 h-3.5 accent-[#0a5c36] rounded"
                      />
                      <Sparkles className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
                      <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">Vibration</span>
                    </label>
                  </div>
                </div>

                {/* TEST BUTTONS */}
                <div className="pt-2 border-t border-gray-100 dark:border-green-900/40 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    Test Real-time Alerts:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleSendTestNotification('success')}
                      className="py-2 px-3 rounded-xl bg-green-50 dark:bg-green-950/70 border border-green-200 dark:border-green-800 hover:bg-green-100 text-[#0a5c36] dark:text-lime-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Test Success Alert</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendTestNotification('low_balance')}
                      className="py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 text-amber-800 dark:text-amber-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Test Low Balance</span>
                    </button>
                  </div>
                  {notificationStatusMsg && (
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-950 text-[#0a5c36] dark:text-lime-300 text-[10px] font-semibold text-center animate-in fade-in">
                      {notificationStatusMsg}
                    </div>
                  )}
                </div>
              </div>

              {/* ==================================================== */}
              {/* REFERRALS & REWARDS PROGRAM SECTION (CORE REQUIREMENT) */}
              {/* ==================================================== */}
              <div className="p-4 rounded-[22px] bg-gradient-to-br from-white via-green-50/40 to-lime-50/40 dark:from-[#102319] dark:to-[#0c1a13] border-2 border-lime-300 dark:border-green-800 shadow-sm space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#d6ff00] to-lime-400 text-[#0a5c36] flex items-center justify-center shadow-md shadow-lime-500/20 shrink-0">
                      <Gift className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">
                          Referrals &amp; Rewards
                        </h3>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-lime-100 dark:bg-green-900/80 text-[#0a5c36] dark:text-[#d6ff00]">
                          +₦100 / signup
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                        Invite colleagues, family, and friends to eHUB. Earn an instant <strong>₦100.00 wallet bonus</strong> for every new user who signs up with your link.
                      </p>
                    </div>
                  </div>
                </div>

                {/* EARNINGS & STATS COUNTERS */}
                <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-white/90 dark:bg-[#0b1710] border border-lime-200 dark:border-green-900/60 shadow-xs">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">
                      Total Earned
                    </span>
                    <span className="text-sm font-black text-[#0a5c36] dark:text-[#d6ff00] mt-0.5 block font-mono">
                      ₦{(currentUser.referralEarnings || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-center border-x border-gray-100 dark:border-green-900/40">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">
                      Friends Joined
                    </span>
                    <span className="text-sm font-black text-gray-900 dark:text-white mt-0.5 block">
                      {currentUser.referralCount || (currentUser.referredUsers ? currentUser.referredUsers.length : 0)}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 block uppercase">
                      Reward Rate
                    </span>
                    <span className="text-sm font-black text-lime-600 dark:text-lime-300 mt-0.5 block">
                      ₦100 / user
                    </span>
                  </div>
                </div>

                {/* YOUR UNIQUE REFERRAL CODE */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                    Your Personal Referral Code
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-[#07130b] border border-gray-200 dark:border-green-900/60 flex items-center justify-between">
                      <span className="font-mono font-black text-base tracking-widest text-[#0a5c36] dark:text-[#d6ff00]">
                        {currentUser.referralCode || 'EHUB'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-sans uppercase">Tap to copy</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyReferral('code')}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer ${
                        referralCopied === 'code'
                          ? 'bg-green-700 text-white'
                          : 'bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white'
                      }`}
                    >
                      {referralCopied === 'code' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* DIRECT SHARE LINK */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                    Direct Referral Link
                  </label>
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#07130b] border border-gray-200 dark:border-green-900/60 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-gray-600 dark:text-gray-400 truncate select-all">
                      {getReferralShareLink(currentUser.referralCode || 'EHUB')}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyReferral('link')}
                        className="p-1.5 px-2 rounded-lg bg-gray-200 dark:bg-green-900/50 hover:bg-gray-300 dark:hover:bg-green-800 text-gray-700 dark:text-lime-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition"
                        title="Copy Link"
                      >
                        {referralCopied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{referralCopied === 'link' ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleNativeShare}
                        className="p-1.5 px-2 rounded-lg bg-[#d6ff00] hover:bg-lime-400 text-[#0a5c36] text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow-xs"
                        title="Share on WhatsApp, SMS, or Telegram"
                      >
                        <Share2 className="w-3 h-3" />
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* HOW IT WORKS BANNER */}
                <div className="p-3 rounded-xl bg-lime-50/70 dark:bg-[#0b1710] border border-lime-200 dark:border-green-900/50 space-y-1.5">
                  <span className="text-[11px] font-bold text-[#0a5c36] dark:text-lime-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    How to Earn ₦100 Referrals:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 dark:text-gray-300">
                    <div className="p-1.5 rounded-lg bg-white/70 dark:bg-black/20 text-center">
                      <span className="font-bold text-[#0a5c36] dark:text-[#d6ff00] block text-xs">1</span>
                      <span>Send code or link to friends</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/70 dark:bg-black/20 text-center">
                      <span className="font-bold text-[#0a5c36] dark:text-[#d6ff00] block text-xs">2</span>
                      <span>Friend signs up on eHUB</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/70 dark:bg-black/20 text-center">
                      <span className="font-bold text-[#0a5c36] dark:text-[#d6ff00] block text-xs">3</span>
                      <span>₦100 credited directly to wallet</span>
                    </div>
                  </div>
                </div>

                {/* REFERRED FRIENDS HISTORY LIST */}
                <div className="pt-2 border-t border-gray-100 dark:border-green-900/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                      Referred Friends
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {(currentUser.referredUsers?.length || 0)} registered
                    </span>
                  </div>

                  {currentUser.referredUsers && currentUser.referredUsers.length > 0 ? (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {currentUser.referredUsers.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-xl bg-white dark:bg-[#07130b] border border-gray-100 dark:border-green-900/30 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white block text-[11px]">
                              {item.displayName || 'eHUB Friend'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {item.email} • {new Date(item.date).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="font-mono font-black text-[#0a5c36] dark:text-[#d6ff00] bg-lime-100 dark:bg-green-900/50 px-2 py-0.5 rounded-md text-[11px]">
                            +₦{item.bonus || 100}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#08150d] text-center text-xs text-gray-500 dark:text-gray-400">
                      No referrals yet. Share your code above with friends to earn your first ₦100 bonus!
                    </div>
                  )}
                </div>
              </div>

              {/* ACCOUNT & LOCAL SESSION CARD */}
              <div className="p-4 rounded-[22px] bg-white dark:bg-[#12241b] border border-gray-200 dark:border-green-900/40 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                  Active User Session
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-green-900/30">
                    <span className="text-gray-500 dark:text-gray-400">Full Name</span>
                    <span className="font-bold text-gray-900 dark:text-white">{currentUser.displayName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-green-900/30">
                    <span className="text-gray-500 dark:text-gray-400">Email Address</span>
                    <span className="font-mono text-gray-900 dark:text-white text-[11px]">{currentUser.email}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-green-900/30">
                    <span className="text-gray-500 dark:text-gray-400">Wallet Balance</span>
                    <span className="font-black text-[#0a5c36] dark:text-[#d6ff00]">
                      ₦{currentUser.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1.5">
                    <span className="text-gray-500 dark:text-gray-400">Local Security</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {isBiometricEnabled ? 'Fingerprint / Face ID Protected' : 'Standard Password'}
                    </span>
                  </div>
                </div>
              </div>

              {/* APP PREFERENCES & THEME */}
              <div className="p-4 rounded-[22px] bg-white dark:bg-[#12241b] border border-gray-200 dark:border-green-900/40 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#0a5c36] dark:text-[#d6ff00]" />
                  Display &amp; System Preferences
                </h3>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white block">Theme Mode</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {theme === 'dark' ? 'Dark green night theme' : 'Crisp daylight theme'}
                    </span>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="p-2 px-3 rounded-xl bg-gray-100 dark:bg-green-900/50 hover:bg-gray-200 dark:hover:bg-green-800/60 text-[#0a5c36] dark:text-[#d6ff00] transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-gray-100 dark:border-green-900/30 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Telecom API Endpoint</span>
                  <span className="font-mono text-[11px] text-gray-700 dark:text-gray-300">ClubKonnect / Abuja AEDC</span>
                </div>
              </div>

              {/* RETURN BUTTON */}
              <button
                onClick={() => setActivePage('dashboard')}
                className="w-full py-3 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-bold rounded-2xl transition text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Dashboard</span>
              </button>
            </div>
          )}
        </main>

        {/* FLAT FLOATING BOTTOM NAVIGATION DOCK (Home Data Airtime Transactions Wallet) */}
        <nav
          aria-label="Bottom Navigation"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-lg bg-white/95 dark:bg-[#0e2116]/95 backdrop-blur-md rounded-[24px] shadow-soft-lg border border-gray-100 dark:border-green-900/40 p-2 sm:p-2.5 flex items-center justify-around transition-all"
        >
          <button
            type="button"
            onClick={() => {
              setActivePage('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center gap-1 text-[11px] font-heading font-sora font-extrabold cursor-pointer py-1.5 px-3 rounded-2xl transition-all ${
              activePage === 'dashboard'
                ? 'text-[#0FA958] bg-[#0FA958]/10 dark:bg-[#0FA958]/25'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-house text-base"></i>
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePage('dashboard');
              setTimeout(() => {
                document.getElementById('section-data')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className="flex flex-col items-center gap-1 text-[11px] font-heading font-sora font-extrabold cursor-pointer py-1.5 px-3 rounded-2xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all"
          >
            <i className="fa-solid fa-signal text-base"></i>
            <span>Data</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePage('dashboard');
              setTimeout(() => {
                document.getElementById('section-airtime')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 50);
            }}
            className="flex flex-col items-center gap-1 text-[11px] font-heading font-sora font-extrabold cursor-pointer py-1.5 px-3 rounded-2xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-all"
          >
            <i className="fa-solid fa-phone text-base"></i>
            <span>Airtime</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePage('history')}
            className={`flex flex-col items-center gap-1 text-[11px] font-heading font-sora font-extrabold cursor-pointer py-1.5 px-3 rounded-2xl transition-all ${
              activePage === 'history'
                ? 'text-[#0FA958] bg-[#0FA958]/10 dark:bg-[#0FA958]/25'
                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
            }`}
          >
            <i className="fa-solid fa-receipt text-base"></i>
            <span>Transactions</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFundModalOpen(true)}
            className="flex flex-col items-center gap-1 text-[11px] font-heading font-sora font-extrabold text-[#0FA958] hover:text-[#0c8f49] cursor-pointer py-1.5 px-3 rounded-2xl hover:bg-[#0FA958]/10 transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>Wallet</span>
          </button>
        </nav>

        {/* Brand Credit */}
        <div className="text-center text-xs text-white/80 dark:text-white/60 font-medium pt-4 pb-8">
          <span>eHUB Telecom &bull; Abuja Telecom Center &bull; Powered by ClubKonnect API &amp; Paystack</span>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL: FUND WALLET (PAYSTACK INTEGRATION)            */}
      {/* ==================================================== */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#0f1f17] rounded-[26px] p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-transparent dark:border-green-900/40 my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-green-900/40 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lime-100 dark:bg-green-950 text-[#0a5c36] dark:text-[#d6ff00] flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">Fund Your Wallet</h3>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">Choose your preferred payment channel</span>
                </div>
              </div>
              <button
                onClick={() => setIsFundModalOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Funding Channel Tabs */}
            <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-[#08150d] rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setFundMethod('bank_transfer')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  fundMethod === 'bank_transfer'
                    ? 'bg-white dark:bg-[#152e20] text-[#0a5c36] dark:text-[#d6ff00] shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Bank Transfer</span>
              </button>
              <button
                type="button"
                onClick={() => setFundMethod('card_paystack')}
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  fundMethod === 'card_paystack'
                    ? 'bg-white dark:bg-[#152e20] text-[#0a5c36] dark:text-[#d6ff00] shadow-xs'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card / Online</span>
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {fundMethod === 'bank_transfer' ? (
                <>
                  {/* Bank Selector Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider block">
                        Select Your Sending Bank
                      </label>
                      {selectedFundBank && (
                        <span className="text-[10.5px] font-bold text-[#0a5c36] dark:text-[#d6ff00] flex items-center gap-1">
                          <Check className="w-3 h-3" /> {selectedFundBank.name}
                        </span>
                      )}
                    </div>
                    
                    {/* The User-defined Searchable Bank List with Logos */}
                    <BankListSelector
                      selectedBank={selectedFundBank}
                      onSelectBank={(bank) => setSelectedFundBank(bank)}
                    />
                  </div>

                  {/* Dedicated Virtual Account Card */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-green-50 to-lime-50/50 dark:from-[#0d1d14] dark:to-[#07130b] border-2 border-green-200 dark:border-green-800/80 shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase text-[#0a5c36] dark:text-[#d6ff00] flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Dedicated Moniepoint Virtual Account
                      </span>
                      <span className="text-[10px] bg-green-100 dark:bg-green-900/60 text-green-800 dark:text-green-300 font-bold px-2 py-0.5 rounded-md">
                        Auto-Credit
                      </span>
                    </div>

                    <div className="bg-white dark:bg-[#12241b] p-3 rounded-xl border border-green-200/60 dark:border-green-900/40 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block uppercase">
                          Moniepoint MFB • Account Number
                        </span>
                        <span className="font-mono font-black text-lg text-gray-900 dark:text-white tracking-wider">
                          8109283719
                        </span>
                        <span className="text-[11px] text-gray-600 dark:text-gray-300 block font-semibold">
                          eHUB / {currentUser?.displayName || 'Valued User'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAccountNumber('8109283719')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0 ${
                          copiedAccount
                            ? 'bg-green-700 text-white'
                            : 'bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white shadow-xs'
                        }`}
                      >
                        {copiedAccount ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {selectedFundBank && (
                      <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300 pt-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <img
                            src={selectedFundBank.logo}
                            alt=""
                            className="w-4 h-4 rounded-full object-contain bg-white shrink-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span className="truncate">Sending from <strong>{selectedFundBank.name}</strong></span>
                        </div>
                        <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 shrink-0">
                          USSD: <strong>{selectedFundBank.ussd}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Transfer Amount Input & Presets */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1">
                      Amount to Transfer (₦)
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={customFundInput}
                      onChange={(e) => {
                        setCustomFundInput(e.target.value);
                        setFundAmount(Number(e.target.value));
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-black text-base focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600"
                    />

                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[500, 1000, 2000, 5000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setCustomFundInput(String(val));
                            setFundAmount(val);
                          }}
                          className={`py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                            fundAmount === val
                              ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600'
                              : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-700 dark:text-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          ₦{val.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Confirmation Button */}
                  <button
                    type="button"
                    onClick={() => handleBankTransferFunding(fundAmount, selectedFundBank)}
                    disabled={isProcessingFunding}
                    className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-black rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isProcessingFunding ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-[#d6ff00] animate-spin" />
                        <span>Verifying Bank Transfer...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#d6ff00]" />
                        <span>I Have Transferred ₦{fundAmount.toLocaleString()}</span>
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Card / Paystack Tab */
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Pay securely using your Debit Card (Mastercard, Visa, Verve) via Paystack online gateway.
                  </p>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                      Funding Amount (₦)
                    </label>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={customFundInput}
                      onChange={(e) => {
                        setCustomFundInput(e.target.value);
                        setFundAmount(Number(e.target.value));
                      }}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1912] text-gray-900 dark:text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600"
                    />

                    <div className="grid grid-cols-3 gap-2 mt-2.5">
                      {[500, 1000, 2000, 5000, 10000, 20000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => {
                            setCustomFundInput(String(val));
                            setFundAmount(val);
                          }}
                          className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            fundAmount === val
                              ? 'bg-[#0a5c36] text-white border-[#0a5c36] dark:bg-green-700 dark:border-green-600'
                              : 'bg-gray-50 dark:bg-[#12241b] border-gray-200 dark:border-green-900/50 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#162c21]'
                          }`}
                        >
                          ₦{val.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => triggerFundWallet(fundAmount)}
                    disabled={isProcessingFunding}
                    className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-black rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-[#d6ff00]" />
                    <span>Proceed to Paystack (₦{fundAmount.toLocaleString()})</span>
                  </button>

                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#0c1912] text-[10px] text-gray-500 dark:text-gray-400 text-center font-mono border border-transparent dark:border-green-900/40">
                    Paystack Key: {CONFIG.PAYSTACK_PUBLIC_KEY.slice(0, 16)}...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SUCCESS RECEIPT                               */}
      {/* ==================================================== */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f1f17] rounded-[26px] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-transparent dark:border-green-900/40">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 text-[#0a5c36] dark:text-[#d6ff00] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white">Transaction Successful!</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{successReceipt.title}</p>
            </div>

            {successReceipt.token && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-[#251b0b] border-2 border-dashed border-amber-300 dark:border-amber-700/60 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  ⚡ 20-Digit Prepaid Token
                </span>
                <span className="text-base font-black font-mono tracking-wider text-amber-900 dark:text-amber-200 block select-all">
                  {successReceipt.token}
                </span>
                <button
                  onClick={() => copyToClipboard(successReceipt.token || '')}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedText === successReceipt.token ? 'Copied!' : 'Copy Token'}</span>
                </button>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#eef5ef] dark:bg-[#12241b] space-y-2 text-xs border border-green-200/60 dark:border-green-900/50">
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Amount:</span>
                <strong className="text-gray-900 dark:text-white font-bold">₦{successReceipt.amount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Reference:</span>
                <span className="font-mono text-gray-800 dark:text-gray-200 text-[11px] truncate max-w-[170px]">
                  {successReceipt.reference}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>Date &amp; Time:</span>
                <span className="text-gray-800 dark:text-gray-200">{formatTxDisplayDate(successReceipt.createdAt)}</span>
              </div>
              {successReceipt.details && (
                <div className="pt-2 border-t border-green-200 dark:border-green-800/60 text-gray-600 dark:text-gray-300 text-[11px] leading-relaxed">
                  {successReceipt.details}
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessReceipt(null)}
              className="w-full py-3 bg-[#0a5c36] hover:bg-[#074729] dark:bg-green-700 dark:hover:bg-green-600 text-white font-bold rounded-2xl transition text-sm cursor-pointer"
            >
              Done &amp; Close Receipt
            </button>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: API & CONFIG INFO DIALOG                      */}
      {/* ==================================================== */}
      {isConfigInfoOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f1f17] rounded-[26px] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-transparent dark:border-green-900/40">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-green-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white p-0.5 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={CONFIG.LOGO_URL}
                    alt="eHUB Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900 dark:text-white">eHUB Configuration</h3>
                  <span className="text-[10px] text-gray-400 dark:text-gray-400 block -mt-0.5">{CONFIG.TAGLINE}</span>
                </div>
              </div>
              <button
                onClick={() => setIsConfigInfoOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-600 dark:text-gray-300 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#0c1912] border border-gray-200 dark:border-green-900/40 font-mono text-[11px]">
                <strong className="text-gray-800 dark:text-white block mb-1">ClubKonnect Credentials:</strong>
                User ID: {CONFIG.CLUBKONNECT_USER_ID}<br />
                API Key: {CONFIG.CLUBKONNECT_API_KEY.slice(0, 14)}...<br />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Source: https://www.nellobytesystems.com/ or https://clubkonnect.com
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#0c1912] border border-gray-200 dark:border-green-900/40 font-mono text-[11px]">
                <strong className="text-gray-800 dark:text-white block mb-1">Paystack Credentials:</strong>
                Public Key: {CONFIG.PAYSTACK_PUBLIC_KEY.slice(0, 16)}...<br />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Source: https://dashboard.paystack.com/#/settings/developer
                </span>
              </div>

              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/80 text-[#0a5c36] dark:text-[#d6ff00] text-[11px] leading-relaxed border border-transparent dark:border-green-800/40">
                <strong>📍 Abuja Telecom Office:</strong><br />
                {CONFIG.SUPPORT_LOCATION}
              </div>
            </div>

            <button
              onClick={() => setIsConfigInfoOpen(false)}
              className="w-full py-2.5 bg-gray-100 dark:bg-[#162a20] hover:bg-gray-200 dark:hover:bg-[#1e382b] text-gray-800 dark:text-gray-200 font-bold rounded-2xl transition text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
