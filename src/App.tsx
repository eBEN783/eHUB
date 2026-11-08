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
  SlidersHorizontal
} from 'lucide-react';
import { CONFIG } from './config';
import { DATA_PLANS, CABLE_PACKAGES, DISCO_PROVIDERS } from './data/plans';
import { EhubUser, Transaction, ServicePage } from './types';
import { buyDataFromClubKonnect, isPlaceholderKey } from './services/clubkonnect';
import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  fbSignOut,
  testConnection,
} from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<EhubUser | null>(null);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Sign up form
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');

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
  const [selectedNetwork, setSelectedNetwork] = useState<'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('MTN');
  const [selectedDataPlanId, setSelectedDataPlanId] = useState<string>('mtn-1gb');
  const [dataPhone, setDataPhone] = useState<string>('');

  // Form states - AIRTIME
  const [airtimeNetwork, setAirtimeNetwork] = useState<'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE'>('MTN');
  const [airtimePhone, setAirtimePhone] = useState<string>('');
  const [airtimeAmount, setAirtimeAmount] = useState<number>(500);

  // Form states - ELECTRICITY
  const [selectedDisco, setSelectedDisco] = useState<string>('aedc');
  const [meterType, setMeterType] = useState<'prepaid' | 'postpaid'>('prepaid');
  const [meterNumber, setMeterNumber] = useState<string>('44001928371');
  const [electricityAmount, setElectricityAmount] = useState<number>(2000);
  const [verifiedCustomerName, setVerifiedCustomerName] = useState<string>('');

  // Form states - CABLE
  const [cableProvider, setCableProvider] = useState<'GOTV' | 'DSTV' | 'STARTIMES'>('GOTV');
  const [selectedCablePackageId, setSelectedCablePackageId] = useState<string>('gotv-smallie');
  const [iucNumber, setIucNumber] = useState<string>('2039485710');
  const [cablePhone, setCablePhone] = useState<string>('');

  // 1. Initial Load: Check localStorage & Firebase Auth
  useEffect(() => {
    // Test Firebase connection
    testConnection().catch((err) => console.log('Firebase init note:', err));

    // Check localStorage 'ehub_current'
    try {
      const storedCurrent = localStorage.getItem('ehub_current');
      if (storedCurrent) {
        const parsed = JSON.parse(storedCurrent);
        setCurrentUser(parsed);
      }
    } catch (e) {
      console.warn('Error reading stored user:', e);
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
              createdAt: data.createdAt || new Date().toISOString(),
            };
            setCurrentUser(syncedUser);
            localStorage.setItem('ehub_current', JSON.stringify(syncedUser));
          } else {
            // First time Google user: initial balance ₦1,250
            const newUser: EhubUser = {
              userId: fbUser.uid,
              email: fbUser.email || '',
              displayName: fbUser.displayName || 'Google User',
              balance: 1250,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, {
              userId: newUser.userId,
              email: newUser.email,
              displayName: newUser.displayName,
              balance: newUser.balance,
              createdAt: newUser.createdAt,
            });
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
  const handleSignUp = (e: React.FormEvent) => {
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

      const newUser: EhubUser = {
        userId: 'usr_' + Date.now(),
        email: signUpEmail.trim().toLowerCase(),
        displayName: signUpName.trim(),
        password: signUpPassword,
        balance: 1250,
        createdAt: new Date().toISOString(),
      };

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
          createdAt: data.createdAt || new Date().toISOString(),
        };
      } else {
        syncedUser = {
          userId: fbUser.uid,
          email: fbUser.email || '',
          displayName: fbUser.displayName || 'eHUB User',
          balance: 1250,
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, {
          userId: syncedUser.userId,
          email: syncedUser.email,
          displayName: syncedUser.displayName,
          balance: syncedUser.balance,
          createdAt: syncedUser.createdAt,
        });

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
    setCurrentUser(null);
    fbSignOut(auth).catch(() => {});
    setActivePage('dashboard');
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

  const handleFundingSuccess = (amount: number, ref: string, providerNote: string) => {
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
      title: 'Wallet Funded via Paystack',
      amount: amount,
      status: 'successful',
      reference: ref,
      details: `${providerNote} | Credited ₦${amount.toLocaleString()} to ${currentUser.email}`,
      createdAt: new Date().toISOString(),
    };
    recordTransaction(tx);
    setSuccessReceipt(tx);
  };

  // 4. BUY DATA Function
  const buyData = async () => {
    setActionError('');
    if (!currentUser) return;

    if (!dataPhone || dataPhone.length < 10) {
      setActionError('Please enter a valid 11-digit phone number (e.g. 08012345678).');
      return;
    }

    const planList = DATA_PLANS[selectedNetwork] || [];
    const plan = planList.find((p) => p.id === selectedDataPlanId) || planList[0];
    if (!plan) {
      setActionError('Please select a valid data plan.');
      return;
    }

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
      network: selectedNetwork,
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
    setActionLoading(false);
    setSuccessReceipt(tx);
  };

  // 6. BUY ELECTRICITY Function (AEDC & All Discos)
  const payElectricity = async () => {
    setActionError('');
    if (!currentUser) return;

    if (!meterNumber || meterNumber.length < 8) {
      setActionError('Please enter a valid meter number.');
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

    const discoObj = DISCO_PROVIDERS.find((d) => d.id === selectedDisco) || DISCO_PROVIDERS[0];
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
      details: `Disco: ${discoObj.name} | Meter: ${meterNumber} (${meterType.toUpperCase()}) | Units: ${unitsPurchased}`,
      token: generatedToken,
      createdAt: new Date().toISOString(),
    };

    await recordTransaction(tx);
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
      <div className="min-h-screen bg-[#eef5ef] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-[440px] bg-white rounded-[24px] shadow-xl p-6 sm:p-8 border border-green-100/80">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-xl bg-[#d6ff00] flex items-center justify-center shadow-md transform -rotate-8 border border-lime-400">
                <span className="font-extrabold text-2xl text-[#0a5c36] select-none">e</span>
              </div>
              <div className="flex items-baseline font-black tracking-tight text-3xl">
                <span className="text-[#0a5c36]">e</span>
                <span className="text-[#0a5c36]">HUB</span>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0a5c36]/10 text-[#0a5c36] text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0a5c36] animate-pulse"></span>
              {CONFIG.SLOGAN} • Instant 24/7 Delivery
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-[#eef5ef] p-1 rounded-2xl mb-6">
            <button
              onClick={() => {
                setAuthMode('signin');
                setAuthError('');
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                authMode === 'signin'
                  ? 'bg-white text-[#0a5c36] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setAuthMode('signup');
                setAuthError('');
              }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                authMode === 'signup'
                  ? 'bg-white text-[#0a5c36] shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={authLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold rounded-2xl text-sm shadow-xs hover:bg-gray-50 transition active:scale-[0.99] mb-4 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs text-gray-400 uppercase">
              <span className="bg-white px-2">or with email</span>
            </div>
          </div>

          {/* Form */}
          {authMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ibrahim Musa"
                  value={signUpName}
                  onChange={(e) => setSignUpName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] text-sm"
                />
              </div>

              <div className="p-3 rounded-xl bg-lime-50 border border-lime-200 text-[#0a5c36] text-xs font-medium">
                🎁 New accounts get a starting demo balance of <strong>₦1,250.00</strong> immediately!
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] text-white font-bold rounded-2xl shadow-md shadow-green-900/10 active:scale-[0.99] transition text-sm cursor-pointer"
              >
                Create Account
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] text-white font-bold rounded-2xl shadow-md shadow-green-900/10 active:scale-[0.99] transition text-sm cursor-pointer"
              >
                Sign In to eHUB
              </button>
            </form>
          )}

          {/* Footer note */}
          <div className="mt-8 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500 font-medium">
              Powered by ClubKonnect API &amp; Paystack
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN APP INTERFACE (Mobile-First, max-width 480px)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#eef5ef] flex flex-col items-center justify-start py-0 sm:py-6 px-0 sm:px-4">
      <div className="w-full max-w-[480px] bg-white sm:rounded-[28px] shadow-2xl flex flex-col min-h-screen sm:min-h-[840px] overflow-hidden border sm:border-gray-200/80">
        {/* TOP BAR / HEADER */}
        <header className="bg-[#0a5c36] text-white px-5 py-4 flex items-center justify-between shadow-sm">
          {/* Logo */}
          <div
            onClick={() => setActivePage('dashboard')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#d6ff00] flex items-center justify-center shadow-md transform -rotate-8 border border-lime-300">
              <span className="font-extrabold text-2xl text-[#0a5c36]">e</span>
            </div>
            <div>
              <div className="flex items-baseline font-black tracking-tight text-2xl leading-none">
                <span className="text-[#d6ff00]">e</span>
                <span className="text-white">HUB</span>
              </div>
              <span className="text-[10px] text-green-200 font-semibold tracking-wider uppercase block mt-0.5">
                {CONFIG.SLOGAN}
              </span>
            </div>
          </div>

          {/* Right Action: User Info & Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfigInfoOpen(true)}
              title="API Configuration"
              className="p-2 rounded-xl bg-green-800/60 hover:bg-green-700 text-lime-300 transition"
            >
              <Info className="w-4 h-4" />
            </button>
            <div className="text-right hidden sm:block">
              <span className="text-xs font-semibold block text-white truncate max-w-[110px]">
                {currentUser.displayName}
              </span>
              <span className="text-[10px] text-green-200 block truncate max-w-[110px]">
                {currentUser.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-xl bg-green-800/60 hover:bg-red-700/80 text-white transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* SUBHEADER NOTICE BANNER */}
        <div className="bg-[#d6ff00] text-[#0a5c36] px-4 py-1.5 text-xs font-bold flex items-center justify-between border-b border-lime-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-[#0a5c36] animate-ping"></span>
            <span>⚡ AEDC Light Tokens &amp; SME Data Instant Dispense</span>
          </div>
          <button
            onClick={() => setActivePage('history')}
            className="text-[11px] underline underline-offset-2 shrink-0 font-extrabold"
          >
            History ({transactions.length})
          </button>
        </div>

        {/* MAIN BODY AREA */}
        <main className="flex-1 p-4 sm:p-5 overflow-y-auto">
          {/* ==================================================== */}
          {/* 1. DASHBOARD HOME PAGE                               */}
          {/* ==================================================== */}
          {activePage === 'dashboard' && (
            <div className="space-y-5">
              {/* WALLET CARD */}
              <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0a5c36] via-[#0d6e41] to-[#073d24] text-white p-5 shadow-lg shadow-green-900/20 border border-green-700/50">
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-[#d6ff00]/10 rounded-full blur-xl pointer-events-none"></div>
                <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-black/20 rounded-full blur-lg pointer-events-none"></div>

                <div className="relative z-10 flex items-start justify-between mb-4">
                  <div>
                    <span className="text-[11px] font-bold tracking-wider text-green-200 uppercase flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-[#d6ff00]" />
                      Available Balance
                    </span>
                    <h2 className="text-3xl font-black tracking-tight text-white mt-1">
                      ₦
                      {currentUser.balance.toLocaleString('en-NG', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsFundModalOpen(true)}
                    className="flex items-center gap-1.5 bg-[#d6ff00] hover:bg-lime-400 text-[#0a5c36] px-4 py-2 rounded-2xl font-black text-xs shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 text-[#0a5c36]" />
                    <span>FUND</span>
                  </button>
                </div>

                <div className="relative z-10 pt-3 border-t border-green-700/60 flex items-center justify-between text-[11px] text-green-200">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#d6ff00]" />
                    Verified eHUB Wallet
                  </span>
                  <span className="font-mono text-green-300">
                    ID: {currentUser.userId.slice(0, 10)}
                  </span>
                </div>
              </div>

              {/* ABUJA HERO TAG */}
              <div className="bg-[#eef5ef] rounded-2xl p-3 flex items-center justify-between border border-green-200/60 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0a5c36] text-[#d6ff00] flex items-center justify-center font-bold">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block">Abuja Telecom Center</span>
                    <span className="text-gray-500 text-[10px]">Wuse 2, FCT Abuja</span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-green-100 text-[#0a5c36] font-bold text-[10px]">
                  Lowest Rates in FCT
                </span>
              </div>

              {/* 4 SERVICE BOXES IN 2x2 GRID */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Select a Service
                </h3>

                <div className="grid grid-cols-2 gap-3.5">
                  {/* a) Data Box */}
                  <button
                    onClick={() => setActivePage('data')}
                    className="group relative flex flex-col items-start p-4 rounded-[22px] bg-gradient-to-br from-[#0a5c36] to-[#0f7a48] text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-left overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-[#d6ff00] group-hover:text-[#0a5c36] transition">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-[#d6ff00] text-[#0a5c36] flex items-center justify-center shadow-sm mb-3">
                      <i className="fa-solid fa-signal text-xl"></i>
                    </div>
                    <span className="font-black text-lg text-white">Data</span>
                    <span className="text-xs text-green-200 mt-0.5">
                      MTN, GLO, Airtel, 9mobile
                    </span>
                    <span className="mt-2.5 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-[#d6ff00]">
                      From ₦220/GB
                    </span>
                  </button>

                  {/* b) Airtime Box */}
                  <button
                    onClick={() => setActivePage('airtime')}
                    className="group relative flex flex-col items-start p-4 rounded-[22px] bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-left overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-blue-700 transition">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-sm mb-3">
                      <i className="fa-solid fa-phone text-xl"></i>
                    </div>
                    <span className="font-black text-lg text-white">Airtime</span>
                    <span className="text-xs text-blue-100 mt-0.5">
                      Instant VTU Recharge
                    </span>
                    <span className="mt-2.5 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#d6ff00] text-[#0a5c36]">
                      2% OFF
                    </span>
                  </button>

                  {/* c) Electricity Box */}
                  <button
                    onClick={() => setActivePage('electricity')}
                    className="group relative flex flex-col items-start p-4 rounded-[22px] bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-left overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-orange-600 transition">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm mb-3">
                      <i className="fa-solid fa-lightbulb text-xl"></i>
                    </div>
                    <span className="font-black text-lg text-white">Electricity</span>
                    <span className="text-xs text-orange-100 mt-0.5">
                      AEDC &amp; All Discos
                    </span>
                    <span className="mt-2.5 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-white">
                      Instant Token
                    </span>
                  </button>

                  {/* d) GOTV/DSTV Box */}
                  <button
                    onClick={() => setActivePage('cable')}
                    className="group relative flex flex-col items-start p-4 rounded-[22px] bg-gradient-to-br from-purple-600 to-violet-800 text-white shadow-md hover:shadow-lg transition-all active:scale-[0.98] text-left overflow-hidden cursor-pointer"
                  >
                    <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white group-hover:text-purple-700 transition">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-sm mb-3">
                      <i className="fa-solid fa-tv text-xl"></i>
                    </div>
                    <span className="font-black text-lg text-white">GOTV/DSTV</span>
                    <span className="text-xs text-purple-100 mt-0.5">
                      TV Subscription
                    </span>
                    <span className="mt-2.5 inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/20 text-[#d6ff00]">
                      Zero Fee
                    </span>
                  </button>
                </div>
              </div>

              {/* RECENT TRANSACTIONS PREVIEW */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Recent Activity
                  </h3>
                  {transactions.length > 0 && (
                    <button
                      onClick={() => setActivePage('history')}
                      className="text-xs font-bold text-[#0a5c36] hover:underline"
                    >
                      View All &amp; Filter
                    </button>
                  )}
                </div>

                {transactions.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-gray-500 text-xs">
                    <Clock className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                    <span>No transactions yet. Buy data, airtime or pay bills above!</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transactions.slice(0, 3).map((tx) => (
                      <div
                        key={tx.transactionId}
                        onClick={() => setSuccessReceipt(tx)}
                        className="p-3 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 flex items-center justify-between transition cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                              tx.type === 'data'
                                ? 'bg-green-100 text-green-700'
                                : tx.type === 'airtime'
                                ? 'bg-blue-100 text-blue-700'
                                : tx.type === 'electricity'
                                ? 'bg-orange-100 text-orange-700'
                                : tx.type === 'cable'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-lime-200 text-[#0a5c36]'
                            }`}
                          >
                            {tx.type === 'data' && <i className="fa-solid fa-signal"></i>}
                            {tx.type === 'airtime' && <i className="fa-solid fa-phone"></i>}
                            {tx.type === 'electricity' && <i className="fa-solid fa-lightbulb"></i>}
                            {tx.type === 'cable' && <i className="fa-solid fa-tv"></i>}
                            {tx.type === 'funding' && <Wallet className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-800 block truncate max-w-[180px]">
                              {tx.title}
                            </span>
                            <span className="text-[10px] text-gray-400 block font-mono">
                              {formatTxDisplayDate(tx.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-xs font-black block ${
                              tx.type === 'funding' ? 'text-green-600' : 'text-gray-900'
                            }`}
                          >
                            {tx.type === 'funding' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-green-600 font-semibold uppercase">
                            Successful
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-[#0a5c36]">Buy Mobile Data</h2>
                  <span className="text-[11px] text-gray-500">Abuja's Cheapest SME &amp; Direct Data</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Network Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
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
                            ? 'border-[#0a5c36] bg-[#0a5c36] text-white shadow-md'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                        }`}
                      >
                        <span className="font-extrabold text-xs">{net}</span>
                        <span
                          className={`text-[9px] mt-0.5 font-semibold ${
                            isSelected ? 'text-[#d6ff00]' : 'text-gray-400'
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Choose Data Plan
                </label>
                <select
                  value={selectedDataPlanId}
                  onChange={(e) => setSelectedDataPlanId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#0a5c36]"
                >
                  {(DATA_PLANS[selectedNetwork] || []).map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} - ₦{plan.price.toLocaleString()} ({plan.validity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. Recipient Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="e.g. 08031234567"
                    value={dataPhone}
                    onChange={(e) => setDataPhone(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-gray-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-[#0a5c36]"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setDataPhone('08030001234')}
                    className="text-[10px] text-[#0a5c36] bg-green-50 px-2 py-0.5 rounded-md font-bold cursor-pointer"
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
                  <div className="p-4 rounded-2xl bg-green-50/80 border border-green-200 text-xs space-y-1.5">
                    <div className="flex justify-between text-gray-600">
                      <span>Network &amp; Bundle:</span>
                      <strong className="text-gray-900">{plan.name}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Validity:</span>
                      <strong className="text-gray-900">{plan.validity}</strong>
                    </div>
                    <div className="flex justify-between text-gray-600 pt-1 border-t border-green-200 font-bold">
                      <span className="text-[#0a5c36]">Total Price:</span>
                      <span className="text-[#0a5c36] text-base font-black">
                        ₦{plan.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={buyData}
                disabled={actionLoading}
                className="w-full py-4 bg-[#0a5c36] hover:bg-[#084b2c] text-white font-black rounded-2xl shadow-lg shadow-green-900/10 active:scale-[0.99] transition text-sm flex items-center justify-center gap-2 cursor-pointer"
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
                <span className="text-[10px] text-gray-400">
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
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-blue-700">Buy Airtime (2% OFF)</h2>
                  <span className="text-[11px] text-gray-500">Instant Automated VTU Recharge</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Network */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
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
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Phone Number
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="e.g. 08023456789"
                    value={airtimePhone}
                    onChange={(e) => setAirtimePhone(e.target.value)}
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-gray-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. Amount (₦)
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  value={airtimeAmount}
                  onChange={(e) => setAirtimeAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[100, 200, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAirtimeAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        airtimeAmount === amt
                          ? 'bg-blue-100 border-blue-400 text-blue-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      ₦{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount Box */}
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Recharge Value:</span>
                  <span className="font-bold line-through text-gray-400">₦{airtimeAmount}</span>
                </div>
                <div className="flex justify-between text-blue-700 font-semibold">
                  <span>eHUB 2% Discount:</span>
                  <span>- ₦{Math.round(airtimeAmount * 0.02)}</span>
                </div>
                <div className="flex justify-between text-gray-900 pt-1 border-t border-blue-200 font-bold">
                  <span>Amount to Pay:</span>
                  <span className="text-blue-700 text-base font-black">
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
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-amber-700">Electricity Bill Payment</h2>
                  <span className="text-[11px] text-gray-500">AEDC Abuja &amp; All Nigerian Discos</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Disco */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  1. Distribution Company (Disco)
                </label>
                <select
                  value={selectedDisco}
                  onChange={(e) => setSelectedDisco(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {DISCO_PROVIDERS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.featured ? '⭐ (Abuja)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Meter Type */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Meter Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMeterType('prepaid')}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      meterType === 'prepaid'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    PREPAID (Generates Token)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMeterType('postpaid')}
                    className={`py-2.5 rounded-xl font-bold text-xs border transition cursor-pointer ${
                      meterType === 'postpaid'
                        ? 'bg-amber-600 border-amber-600 text-white shadow-sm'
                        : 'bg-gray-50 border-gray-200 text-gray-700'
                    }`}
                  >
                    POSTPAID (Bill Credit)
                  </button>
                </div>
              </div>

              {/* Meter Number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. Meter Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 44001928371"
                  value={meterNumber}
                  onChange={(e) => {
                    setMeterNumber(e.target.value);
                    if (e.target.value.length >= 8) {
                      setVerifiedCustomerName('MUSA BELLO - Gwarinpa Phase 2, Abuja');
                    } else {
                      setVerifiedCustomerName('');
                    }
                  }}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {verifiedCustomerName ? (
                  <div className="mt-1.5 p-2 rounded-xl bg-green-50 border border-green-200 text-green-800 text-[11px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                    <span>
                      <strong>Customer:</strong> {verifiedCustomerName}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-400 block mt-1">
                    AEDC Meter verification is active.
                  </span>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  4. Amount to Pay (₦)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={electricityAmount}
                  onChange={(e) => setElectricityAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-bold text-base focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {[1000, 2000, 3000, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setElectricityAmount(amt)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        electricityAmount === amt
                          ? 'bg-amber-100 border-amber-400 text-amber-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
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
                  className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-lg font-black text-purple-700">Cable TV Subscription</h2>
                  <span className="text-[11px] text-gray-500">GOTV, DSTV &amp; Startimes Instant Activation</span>
                </div>
              </div>

              {actionError && (
                <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{actionError}</span>
                </div>
              )}

              {/* Provider */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
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
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
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
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  2. Select Bouquet / Package
                </label>
                <select
                  value={selectedCablePackageId}
                  onChange={(e) => setSelectedCablePackageId(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 bg-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {(CABLE_PACKAGES[cableProvider] || []).map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - ₦{pkg.price.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* IUC */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  3. IUC / Smartcard Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2039485710"
                  value={iucNumber}
                  onChange={(e) => setIucNumber(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
              </div>

              {/* Phone number */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  4. Registered Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 08031234567"
                  value={cablePhone}
                  onChange={(e) => setCablePhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
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
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-gray-800">Transaction History</h2>
                    <span className="text-[11px] text-gray-500">
                      Showing {filteredTransactions.length} of {transactions.length} records
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    hasActiveFilters || isFilterExpanded
                      ? 'bg-[#0a5c36] text-white border-[#0a5c36]'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Filters</span>
                </button>
              </div>

              {/* FINANCIAL SUMMARY CARDS */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                    Total Funded
                  </span>
                  <span className="text-base font-black text-emerald-700 block mt-0.5">
                    +₦{totalFilteredFunded.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                    Total Spent
                  </span>
                  <span className="text-base font-black text-rose-700 block mt-0.5">
                    -₦{totalFilteredSpent.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* FILTER CONTROLS DRAWER / PANEL */}
              {isFilterExpanded && (
                <div className="p-4 rounded-[22px] bg-gray-50 border border-gray-200 space-y-3.5 animate-in fade-in">
                  {/* Search Query */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Search Transactions
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search reference, phone, plan, Disco..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3.5 py-2.5 pl-9 pr-8 rounded-xl border border-gray-200 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#0a5c36]"
                      />
                      <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 flex items-center justify-center absolute right-2.5 top-2.5 text-[10px] cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. FILTER BY TYPE */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Filter by Type
                      </label>
                      {filterType !== 'all' && (
                        <button
                          onClick={() => setFilterType('all')}
                          className="text-[10px] text-[#0a5c36] font-bold hover:underline"
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
                                ? 'bg-[#0a5c36] text-white border-[#0a5c36] shadow-xs'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <i className={`fa-solid ${item.icon} text-[10px]`}></i>
                            <span>{item.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                isSelected ? 'bg-white/20 text-[#d6ff00]' : 'bg-gray-100 text-gray-500'
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
                      <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Filter by Date Range
                      </label>
                      {dateRangePreset !== 'all' && (
                        <button
                          onClick={() => {
                            setDateRangePreset('all');
                            setCustomStartDate('');
                            setCustomEndDate('');
                          }}
                          className="text-[10px] text-[#0a5c36] font-bold hover:underline"
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
                                ? 'bg-[#0a5c36] text-white border-[#0a5c36] shadow-xs'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom Date Picker Fields */}
                    {dateRangePreset === 'custom' && (
                      <div className="mt-2.5 p-3 rounded-xl bg-white border border-gray-200 space-y-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                          Select Specific Start &amp; End Dates:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] text-gray-500 block mb-1">From:</span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0a5c36]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-500 block mb-1">To:</span>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0a5c36]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ACTIVE FILTER TAGS & RESET ALL */}
                  {hasActiveFilters && (
                    <div className="pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
                      <div className="flex flex-wrap gap-1 items-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase">Active:</span>
                        {filterType !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[#0a5c36] text-[10px] font-bold">
                            Type: {filterType}
                            <button onClick={() => setFilterType('all')} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                        {dateRangePreset !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                            Date: {dateRangePreset === 'custom' ? 'Custom' : dateRangePreset}
                            <button onClick={() => { setDateRangePreset('all'); setCustomStartDate(''); setCustomEndDate(''); }} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                        {searchQuery && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            "{searchQuery.slice(0, 10)}"
                            <button onClick={() => setSearchQuery('')} className="hover:text-red-700">✕</button>
                          </span>
                        )}
                      </div>

                      <button
                        onClick={resetAllFilters}
                        className="text-[11px] font-black text-red-600 hover:underline shrink-0 ml-2 cursor-pointer"
                      >
                        Reset All
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* FILTERED TRANSACTIONS LIST */}
              {filteredTransactions.length === 0 ? (
                <div className="py-12 px-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 text-center text-gray-500 text-xs space-y-2">
                  <Filter className="w-8 h-8 mx-auto text-gray-400" />
                  <p className="font-bold text-gray-700">No transactions match your criteria.</p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    Try picking a broader date range or changing your type filter.
                  </p>
                  {hasActiveFilters && (
                    <button
                      onClick={resetAllFilters}
                      className="mt-2 px-4 py-2 bg-[#0a5c36] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#074729] cursor-pointer"
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
                      className="p-3.5 rounded-2xl bg-white border border-gray-200 hover:border-[#0a5c36] shadow-xs flex items-center justify-between transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-base font-bold shrink-0 ${
                            tx.type === 'data'
                              ? 'bg-green-100 text-green-700'
                              : tx.type === 'airtime'
                              ? 'bg-blue-100 text-blue-700'
                              : tx.type === 'electricity'
                              ? 'bg-orange-100 text-orange-700'
                              : tx.type === 'cable'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-lime-200 text-[#0a5c36]'
                          }`}
                        >
                          {tx.type === 'data' && <i className="fa-solid fa-signal"></i>}
                          {tx.type === 'airtime' && <i className="fa-solid fa-phone"></i>}
                          {tx.type === 'electricity' && <i className="fa-solid fa-lightbulb"></i>}
                          {tx.type === 'cable' && <i className="fa-solid fa-tv"></i>}
                          {tx.type === 'funding' && <Wallet className="w-5 h-5" />}
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-xs font-bold text-gray-900 block truncate max-w-[190px]">
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
                            tx.type === 'funding' ? 'text-green-600' : 'text-gray-900'
                          }`}
                        >
                          {tx.type === 'funding' ? '+' : '-'}₦{tx.amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-md">
                          SUCCESS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        {/* BOTTOM NAVIGATION / FOOTER */}
        <footer className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-center">
          <div className="flex items-center justify-around mb-2">
            <button
              onClick={() => setActivePage('dashboard')}
              className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
                activePage === 'dashboard' ? 'text-[#0a5c36]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <i className="fa-solid fa-house text-base mb-1"></i>
              <span>Home</span>
            </button>
            <button
              onClick={() => setActivePage('data')}
              className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
                activePage === 'data' ? 'text-[#0a5c36]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <i className="fa-solid fa-signal text-base mb-1"></i>
              <span>Data</span>
            </button>
            <button
              onClick={() => setIsFundModalOpen(true)}
              className="flex flex-col items-center text-[10px] font-bold text-[#0a5c36] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#0a5c36] text-[#d6ff00] flex items-center justify-center -mt-3 shadow-md border-2 border-white">
                <PlusCircle className="w-5 h-5" />
              </div>
              <span className="mt-0.5">Fund</span>
            </button>
            <button
              onClick={() => setActivePage('electricity')}
              className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
                activePage === 'electricity' ? 'text-[#0a5c36]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <i className="fa-solid fa-lightbulb text-base mb-1"></i>
              <span>Bills</span>
            </button>
            <button
              onClick={() => setActivePage('history')}
              className={`flex flex-col items-center text-[10px] font-bold cursor-pointer ${
                activePage === 'history' ? 'text-[#0a5c36]' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <i className="fa-solid fa-receipt text-base mb-1"></i>
              <span>History</span>
            </button>
          </div>
          <p className="text-[10px] text-gray-400 font-medium pt-1 border-t border-gray-100">
            Powered by ClubKonnect API &amp; Paystack
          </p>
        </footer>
      </div>

      {/* ==================================================== */}
      {/* MODAL: FUND WALLET (PAYSTACK INTEGRATION)            */}
      {/* ==================================================== */}
      {isFundModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[26px] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-lime-100 text-[#0a5c36] flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-gray-900">Fund Your Wallet</h3>
              </div>
              <button
                onClick={() => setIsFundModalOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Pay via Paystack online checkout (Card, Bank Transfer, USSD). Your eHUB balance will be credited automatically.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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
                className="w-full px-4 py-3 rounded-2xl border border-gray-300 font-black text-lg focus:outline-none focus:ring-2 focus:ring-[#0a5c36]"
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
                        ? 'bg-[#0a5c36] text-white border-[#0a5c36]'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
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
              className="w-full py-3.5 bg-[#0a5c36] hover:bg-[#074729] text-white font-black rounded-2xl shadow-md text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Zap className="w-4 h-4 text-[#d6ff00]" />
              <span>Proceed to Paystack (₦{fundAmount.toLocaleString()})</span>
            </button>

            <div className="p-2.5 rounded-xl bg-gray-50 text-[10px] text-gray-500 text-center font-mono">
              Paystack Key: {CONFIG.PAYSTACK_PUBLIC_KEY.slice(0, 16)}...
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SUCCESS RECEIPT                               */}
      {/* ==================================================== */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-[26px] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 text-[#0a5c36] flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-gray-900">Transaction Successful!</h3>
              <p className="text-xs text-gray-500 mt-0.5">{successReceipt.title}</p>
            </div>

            {successReceipt.token && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-dashed border-amber-300 text-center space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
                  ⚡ 20-Digit Prepaid Token
                </span>
                <span className="text-base font-black font-mono tracking-wider text-amber-900 block select-all">
                  {successReceipt.token}
                </span>
                <button
                  onClick={() => copyToClipboard(successReceipt.token || '')}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-amber-600 text-white rounded-lg text-xs font-bold shadow-xs hover:bg-amber-700 transition cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedText === successReceipt.token ? 'Copied!' : 'Copy Token'}</span>
                </button>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#eef5ef] space-y-2 text-xs border border-green-200/60">
              <div className="flex justify-between text-gray-600">
                <span>Amount:</span>
                <strong className="text-gray-900 font-bold">₦{successReceipt.amount.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Reference:</span>
                <span className="font-mono text-gray-800 text-[11px] truncate max-w-[170px]">
                  {successReceipt.reference}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Date &amp; Time:</span>
                <span className="text-gray-800">{formatTxDisplayDate(successReceipt.createdAt)}</span>
              </div>
              {successReceipt.details && (
                <div className="pt-2 border-t border-green-200 text-gray-600 text-[11px] leading-relaxed">
                  {successReceipt.details}
                </div>
              )}
            </div>

            <button
              onClick={() => setSuccessReceipt(null)}
              className="w-full py-3 bg-[#0a5c36] hover:bg-[#074729] text-white font-bold rounded-2xl transition text-sm cursor-pointer"
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
          <div className="w-full max-w-sm bg-white rounded-[26px] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-green-100 text-[#0a5c36] flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-gray-900">CONFIG &amp; API Integration</h3>
              </div>
              <button
                onClick={() => setIsConfigInfoOpen(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-mono text-[11px]">
                <strong className="text-gray-800 block mb-1">ClubKonnect Credentials:</strong>
                User ID: {CONFIG.CLUBKONNECT_USER_ID}<br />
                API Key: {CONFIG.CLUBKONNECT_API_KEY.slice(0, 14)}...<br />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Source: https://www.nellobytesystems.com/ or https://clubkonnect.com
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-mono text-[11px]">
                <strong className="text-gray-800 block mb-1">Paystack Credentials:</strong>
                Public Key: {CONFIG.PAYSTACK_PUBLIC_KEY.slice(0, 16)}...<br />
                <span className="text-[10px] text-gray-400 block mt-1">
                  Source: https://dashboard.paystack.com/#/settings/developer
                </span>
              </div>

              <div className="p-3 rounded-xl bg-green-50 text-[#0a5c36] text-[11px] leading-relaxed">
                <strong>📍 Abuja Telecom Office:</strong><br />
                {CONFIG.SUPPORT_LOCATION}
              </div>
            </div>

            <button
              onClick={() => setIsConfigInfoOpen(false)}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-2xl transition text-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
