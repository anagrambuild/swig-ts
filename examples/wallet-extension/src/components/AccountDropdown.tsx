import React, { useState } from "react";
import { IoChevronDown } from "react-icons/io5";

interface AccountDropdownProps {
  currentAccount: string;
  accounts: string[];
  onAccountChange: (account: string) => void;
  label?: string;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({
  currentAccount,
  accounts,
  onAccountChange,
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleAccountChange = (account: string) => {
    onAccountChange(account);
    setIsOpen(false);
  };

  return (
    <div className="w-full mt-2">
      <div className="text-sm text-gray-600 font-bold mt-2">{label}</div>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-gray-200 p-2 rounded-lg mt-1"
        >
          <span className="font-medium">{currentAccount}</span>
          <IoChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {accounts.map((account) => (
              <div
                key={account}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleAccountChange(account)}
              >
                {account}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface AccountComponentProps {
  label?: string;
  onAccountChange?: (account: string) => void; // Allow parent to track selected account
}

const AccountComponent: React.FC<AccountComponentProps> = ({ label, onAccountChange }) => {
  const [currentAccount, setCurrentAccount] = useState("sub-account 1");
  const accounts = ["sub-account 1", "sub-account 2", "sub-account 3", "sub-account 4"];

  const handleAccountChange = (account: string) => {
    setCurrentAccount(account);
    if (onAccountChange) {
      onAccountChange(account); // Notify parent component
    }
  };

  return (
    <div className="px-4 py-3">
      <AccountDropdown
        currentAccount={currentAccount}
        accounts={accounts}
        onAccountChange={handleAccountChange}
        label={label}
      />
    </div>
  );
};

export default AccountComponent;
