import React, { useState, useMemo } from 'react';
import { NIGERIAN_BANKS, BankItem } from '../data/banks';
import { Search, CheckCircle2, Building2 } from 'lucide-react';

interface BankListSelectorProps {
  selectedBank: BankItem | null;
  onSelectBank: (bank: BankItem) => void;
  className?: string;
}

export const BankListSelector: React.FC<BankListSelectorProps> = ({
  selectedBank,
  onSelectBank,
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const filteredBanks = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return NIGERIAN_BANKS;
    return NIGERIAN_BANKS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.code.includes(q) ||
        b.ussd.toLowerCase().includes(q)
    );
  }, [searchTerm]);

  const handleImageError = (bankId: string) => {
    setImgErrors((prev) => ({ ...prev, [bankId]: true }));
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Search Input matching user's spec */}
      <div className="relative">
        <input
          type="text"
          id="bankSearch"
          placeholder="Search bank - e.g OPay, Kuda, First Bank..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 pl-10 rounded-xl border border-gray-300 dark:border-green-900/60 bg-white dark:bg-[#0c1811] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0a5c36] dark:focus:ring-green-600 text-sm shadow-xs transition"
        />
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-1 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Bank List container matching user's class="bank-list" id="bankList" */}
      <div className="bank-list" id="bankList">
        {filteredBanks.length > 0 ? (
          filteredBanks.map((bank) => {
            const isSelected = selectedBank?.id === bank.id;
            const hasError = imgErrors[bank.id];

            return (
              <div
                key={bank.id}
                className={`bank-item ${isSelected ? 'selected bg-green-50 dark:bg-green-950/60 font-bold border-l-4 border-l-[#0a5c36] dark:border-l-[#d6ff00]' : ''}`}
                onClick={() => onSelectBank(bank)}
                role="button"
                tabIndex={0}
              >
                {!hasError ? (
                  <img
                    src={bank.logo}
                    alt={bank.name}
                    loading="lazy"
                    onError={() => handleImageError(bank.id)}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/80 text-[#0a5c36] dark:text-[#d6ff00] flex items-center justify-center font-bold text-xs shrink-0 border border-green-200 dark:border-green-800">
                    {bank.name.charAt(0)}
                  </div>
                )}

                <div className="flex-1 flex items-center justify-between min-w-0 pr-1">
                  <span className="text-sm text-gray-800 dark:text-gray-100 truncate">
                    {bank.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 hidden sm:inline-block">
                      {bank.ussd}
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#0a5c36] dark:text-[#d6ff00]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-1.5">
            <Building2 className="w-6 h-6 text-gray-400 opacity-60" />
            <p>No bank found matching "{searchTerm}"</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="text-[#0a5c36] dark:text-[#d6ff00] underline font-bold mt-1 cursor-pointer"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
