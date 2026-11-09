export interface ReferredUserItem {
  email: string;
  displayName: string;
  date: string;
  bonus: number;
}

export interface EhubUser {
  userId: string;
  email: string;
  displayName: string;
  password?: string; // only in local auth
  balance: number;
  referralCode?: string;
  referredBy?: string;
  referralEarnings?: number;
  referralCount?: number;
  referredUsers?: ReferredUserItem[];
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  createdAt: string;
  updatedAt?: string;
}

export type TransactionType = 'data' | 'airtime' | 'electricity' | 'cable' | 'funding';

export interface Transaction {
  transactionId: string;
  userId: string;
  type: TransactionType;
  title: string;
  amount: number;
  status: 'successful' | 'pending' | 'failed';
  reference: string;
  details?: string;
  createdAt: string;
  token?: string; // For electricity tokens
}

export type ServicePage = 'dashboard' | 'data' | 'airtime' | 'electricity' | 'cable' | 'history' | 'settings';

export interface DataPlan {
  id: string;
  network: 'MTN' | 'GLO' | 'AIRTEL' | '9MOBILE';
  name: string;
  size: string;
  price: number;
  validity: string;
  code: string;
}

export interface CablePackage {
  id: string;
  provider: 'GOTV' | 'DSTV' | 'STARTIMES';
  name: string;
  price: number;
  code: string;
}

export type NotificationType = 'transaction_success' | 'low_balance' | 'wallet_funded' | 'system';

export interface PushNotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    transactionId?: string;
    amount?: number;
    currentBalance?: number;
    threshold?: number;
    token?: string;
  };
}

export interface NotificationSettings {
  pushEnabled: boolean;
  transactionSuccessAlerts: boolean;
  lowBalanceAlerts: boolean;
  lowBalanceThreshold: number; // e.g., 500 = ₦500.00
  soundEnabled: boolean;
  vibrateEnabled: boolean;
}
