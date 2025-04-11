import React from "react";
import Heading from "@/components/heading";
import ProfileComponent from "@/components/ProfileDropdown";
import { LuCircleDollarSign } from "react-icons/lu";
import { SiSolana } from "react-icons/si";
import Button from "@/components/Button";

interface Transaction {
  type: "add" | "deduct";
  amount: string;
  symbol: string;
  icon: React.ReactNode;
  bgColor: string;
}

interface SourceApp {
  name: string;
  logo: string;
  url: string;
}

const transactions: Transaction[] = [
    {
      type: "deduct",
      amount: "-100",
      symbol: "USDC",
      icon: <LuCircleDollarSign className="w-5 h-5" />,
      bgColor: "bg-blue-500",
    },
    {
      type: "add",
      amount: "+0.83097828",
      symbol: "SOL",
      icon: <SiSolana className="w-5 h-5" />,
      bgColor: "bg-purple-900",
    },
];

// App source information
const sourceApp: SourceApp = {
  name: "Jupiter",
  logo: "https://s2.coinmarketcap.com/static/img/coins/200x200/29210.png", // Replace with actual path to Jupiter logo
  url: "https://jup.ag"
};

const TransactionRequest = () => {
  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {/* Left Icon */}
        <img
          src="/icons/icon16.png"
          alt="Swig Wallet Icon"
          className="w-6 h-6"
        />

        {/* Centered Heading */}
        <div className="flex-1 text-center">
          <Heading text="Confirm transaction with Swig" size="text-xl" />
        </div>
      </div>

      {/* Source App Section */}
      <div className="p-4 border-gray-200">
        <div className="flex items-center">
          <div className="mr-3">
            <img 
              src={sourceApp.logo} 
              alt={`${sourceApp.name} logo`} 
              className="w-6 h-6 rounded-full"
            />
          </div>
          <div>
            <h2 className="font-bold text-lg">{sourceApp.name}</h2>
            <a 
              href={sourceApp.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-gray-500 text-sm"
            >
              {sourceApp.url}
            </a>
          </div>
        </div>
      </div>

      <ProfileComponent label="Current Profile" />

      {/* Transaction Details */}
      <div className="p-4 space-y-2">
        {/* Transaction Items */}
        {transactions.map((transaction, index) => (
          <div 
            key={index} 
            className="flex items-center justify-between p-3 rounded-md bg-gray-200"
          >
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-full text-white ${transaction.bgColor}`}>
                {transaction.icon}
              </div>
              <span className="font-medium">{transaction.symbol}</span>
            </div>
            <span className={`font-bold ${
              transaction.type === "add" ? "text-green-500" : "text-red-500"
            }`}>
              {transaction.amount}
            </span>
          </div>
        ))}

        {/* Network Information */}
        <div className="flex items-center justify-between p-3 rounded-md bg-gray-200">
          <span className="text-gray-600">Network</span>
          <span className="font-medium">Solana</span>
        </div>

        {/* Network Fee */}
        <div className="flex items-center justify-between p-3 rounded-md bg-gray-200">
          <span className="text-gray-600">Network Fee</span>
          <span className="font-medium">0.00016 SOL</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between gap-3 p-4 border-gray-200">
        <Button 
          text="Reject"
          className="flex-1 py-2 bg-gray-500 text-white"
        />
        <Button 
          text="Confirm"
          className="flex-1 py-2 bg-blue-600 text-white"
        />
      </div>
    </div>
  );
};

export default TransactionRequest;