export interface BankItem {
  id: string;
  name: string;
  logo: string;
  code: string;
  ussd: string;
}

export const NIGERIAN_BANKS: BankItem[] = [
  {
    id: 'opay',
    name: 'OPay',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/opay.png',
    code: '999992',
    ussd: '*955#',
  },
  {
    id: 'palmpay',
    name: 'PalmPay',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/palmpay.png',
    code: '999991',
    ussd: '*861#',
  },
  {
    id: 'moniepoint',
    name: 'Moniepoint MFB',
    logo: 'https://nigerianbanks.xyz/logo/default-image.png',
    code: '50515',
    ussd: '*5573#',
  },
  {
    id: 'kuda',
    name: 'Kuda Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/kuda.png',
    code: '50211',
    ussd: '*894#',
  },
  {
    id: 'firstbank',
    name: 'First Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/first-bank.png',
    code: '011',
    ussd: '*894#',
  },
  {
    id: 'gtbank',
    name: 'GTBank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/gtbank.png',
    code: '058',
    ussd: '*737#',
  },
  {
    id: 'access',
    name: 'Access Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/access-bank.png',
    code: '044',
    ussd: '*901#',
  },
  {
    id: 'zenith',
    name: 'Zenith Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/zenith-bank.png',
    code: '057',
    ussd: '*966#',
  },
  {
    id: 'uba',
    name: 'UBA',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/uba.png',
    code: '033',
    ussd: '*919#',
  },
  {
    id: 'wema',
    name: 'Wema Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/wema-bank.png',
    code: '035',
    ussd: '*945#',
  },
  {
    id: 'fidelity',
    name: 'Fidelity Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/fidelity-bank.png',
    code: '070',
    ussd: '*770#',
  },
  {
    id: 'union',
    name: 'Union Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/union-bank.png',
    code: '032',
    ussd: '*826#',
  },
  {
    id: 'fcmb',
    name: 'FCMB',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/fcmb.png',
    code: '214',
    ussd: '*329#',
  },
  {
    id: 'stanbic',
    name: 'Stanbic IBTC',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/stanbic-ibtc.png',
    code: '221',
    ussd: '*909#',
  },
  {
    id: 'polaris',
    name: 'Polaris Bank',
    logo: 'https://raw.githubusercontent.com/chrisenytc/bank-logos/main/logos/polaris-bank.png',
    code: '076',
    ussd: '*833#',
  },
];
