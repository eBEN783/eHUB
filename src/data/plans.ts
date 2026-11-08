import { DataPlan, CablePackage } from '../types';

export const DATA_PLANS: Record<string, DataPlan[]> = {
  MTN: [
    { id: 'mtn-500mb', network: 'MTN', name: 'MTN SME 500MB', size: '500MB', price: 150, validity: '30 Days', code: '500' },
    { id: 'mtn-1gb', network: 'MTN', name: 'MTN SME 1GB', size: '1GB', price: 280, validity: '30 Days', code: '1000' },
    { id: 'mtn-2gb', network: 'MTN', name: 'MTN SME 2GB', size: '2GB', price: 560, validity: '30 Days', code: '2000' },
    { id: 'mtn-3gb', network: 'MTN', name: 'MTN SME 3GB', size: '3GB', price: 840, validity: '30 Days', code: '3000' },
    { id: 'mtn-5gb', network: 'MTN', name: 'MTN SME 5GB', size: '5GB', price: 1400, validity: '30 Days', code: '5000' },
    { id: 'mtn-10gb', network: 'MTN', name: 'MTN SME 10GB', size: '10GB', price: 2800, validity: '30 Days', code: '10000' },
  ],
  GLO: [
    { id: 'glo-1gb', network: 'GLO', name: 'GLO CG 1GB', size: '1GB', price: 260, validity: '30 Days', code: 'G1000' },
    { id: 'glo-2gb', network: 'GLO', name: 'GLO CG 2GB', size: '2GB', price: 520, validity: '30 Days', code: 'G2000' },
    { id: 'glo-3gb', network: 'GLO', name: 'GLO CG 3GB', size: '3GB', price: 780, validity: '30 Days', code: 'G3000' },
    { id: 'glo-5gb', network: 'GLO', name: 'GLO CG 5GB', size: '5GB', price: 1300, validity: '30 Days', code: 'G5000' },
    { id: 'glo-10gb', network: 'GLO', name: 'GLO CG 10GB', size: '10GB', price: 2600, validity: '30 Days', code: 'G10000' },
  ],
  AIRTEL: [
    { id: 'airtel-1gb', network: 'AIRTEL', name: 'Airtel CG 1GB', size: '1GB', price: 290, validity: '30 Days', code: 'A1000' },
    { id: 'airtel-2gb', network: 'AIRTEL', name: 'Airtel CG 2GB', size: '2GB', price: 580, validity: '30 Days', code: 'A2000' },
    { id: 'airtel-3gb', network: 'AIRTEL', name: 'Airtel CG 3GB', size: '3GB', price: 870, validity: '30 Days', code: 'A3000' },
    { id: 'airtel-5gb', network: 'AIRTEL', name: 'Airtel CG 5GB', size: '5GB', price: 1450, validity: '30 Days', code: 'A5000' },
    { id: 'airtel-10gb', network: 'AIRTEL', name: 'Airtel CG 10GB', size: '10GB', price: 2900, validity: '30 Days', code: 'A10000' },
  ],
  '9MOBILE': [
    { id: '9mobile-1gb', network: '9MOBILE', name: '9mobile SME 1GB', size: '1GB', price: 220, validity: '30 Days', code: '9M1000' },
    { id: '9mobile-2gb', network: '9MOBILE', name: '9mobile SME 2GB', size: '2GB', price: 440, validity: '30 Days', code: '9M2000' },
    { id: '9mobile-3gb', network: '9MOBILE', name: '9mobile SME 3GB', size: '3GB', price: 660, validity: '30 Days', code: '9M3000' },
    { id: '9mobile-5gb', network: '9MOBILE', name: '9mobile SME 5GB', size: '5GB', price: 1100, validity: '30 Days', code: '9M5000' },
    { id: '9mobile-10gb', network: '9MOBILE', name: '9mobile SME 10GB', size: '10GB', price: 2200, validity: '30 Days', code: '9M10000' },
  ],
};

export const CABLE_PACKAGES: Record<string, CablePackage[]> = {
  GOTV: [
    { id: 'gotv-smallie', provider: 'GOTV', name: 'GOTV Smallie', price: 1300, code: 'gotv-smallie' },
    { id: 'gotv-jinja', provider: 'GOTV', name: 'GOTV Jinja', price: 3300, code: 'gotv-jinja' },
    { id: 'gotv-jolli', provider: 'GOTV', name: 'GOTV Jolli', price: 4850, code: 'gotv-jolli' },
    { id: 'gotv-max', provider: 'GOTV', name: 'GOTV Max', price: 8500, code: 'gotv-max' },
    { id: 'gotv-supa', provider: 'GOTV', name: 'GOTV Supa', price: 9600, code: 'gotv-supa' },
  ],
  DSTV: [
    { id: 'dstv-padi', provider: 'DSTV', name: 'DSTV Padi', price: 4400, code: 'dstv-padi' },
    { id: 'dstv-yanga', provider: 'DSTV', name: 'DSTV Yanga', price: 6000, code: 'dstv-yanga' },
    { id: 'dstv-confam', provider: 'DSTV', name: 'DSTV Confam', price: 11000, code: 'dstv-confam' },
    { id: 'dstv-compact', provider: 'DSTV', name: 'DSTV Compact', price: 15900, code: 'dstv-compact' },
    { id: 'dstv-compact-plus', provider: 'DSTV', name: 'DSTV Compact Plus', price: 25000, code: 'dstv-compact-plus' },
    { id: 'dstv-premium', provider: 'DSTV', name: 'DSTV Premium', price: 37000, code: 'dstv-premium' },
  ],
  STARTIMES: [
    { id: 'star-nova', provider: 'STARTIMES', name: 'Nova Monthly', price: 1500, code: 'star-nova' },
    { id: 'star-basic', provider: 'STARTIMES', name: 'Basic Monthly', price: 3000, code: 'star-basic' },
    { id: 'star-smart', provider: 'STARTIMES', name: 'Smart Monthly', price: 4200, code: 'star-smart' },
    { id: 'star-classic', provider: 'STARTIMES', name: 'Classic Monthly', price: 5000, code: 'star-classic' },
    { id: 'star-super', provider: 'STARTIMES', name: 'Super Monthly', price: 8000, code: 'star-super' },
  ],
};

export const DISCO_PROVIDERS = [
  { id: 'aedc', name: 'AEDC - Abuja Electricity Distribution', code: '01', state: 'Abuja, Niger, Kogi, Nasarawa', featured: true },
  { id: 'ikedc', name: 'IKEDC - Ikeja Electric', code: '02', state: 'Lagos Mainland', featured: false },
  { id: 'ekedc', name: 'EKEDC - Eko Electricity', code: '03', state: 'Lagos Island', featured: false },
  { id: 'ibedc', name: 'IBEDC - Ibadan Electricity', code: '04', state: 'Oyo, Ogun, Osun, Kwara', featured: false },
  { id: 'kedco', name: 'KEDCO - Kano Electricity', code: '05', state: 'Kano, Katsina, Jigawa', featured: false },
  { id: 'phed', name: 'PHED - Port Harcourt Electricity', code: '06', state: 'Rivers, Bayelsa, Cross River, Akwa Ibom', featured: false },
  { id: 'eedc', name: 'EEDC - Enugu Electricity', code: '07', state: 'Enugu, Abia, Imo, Anambra, Ebonyi', featured: false },
  { id: 'jed', name: 'JED - Jos Electricity', code: '08', state: 'Plateau, Bauchi, Benue, Gombe', featured: false },
];
