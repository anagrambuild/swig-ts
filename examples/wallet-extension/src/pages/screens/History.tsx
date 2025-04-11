import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import { FaArrowLeft } from "react-icons/fa";
import ProfileComponent from "@/components/ProfileDropdown";
import { LuCircleDollarSign } from "react-icons/lu";
import { SiSolana } from "react-icons/si";

interface Transaction {
  type: "sent" | "received";
  amount: string;
  symbol: string;
  address: string;
  date: string;
  timeGroup: "Today" | "Yesterday" | "Older";
  icon: React.ReactNode;
  bgColor: string;
}

const History = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  const handleBack = () => {
    navigate("/home", { state: { openSettingsModal: true } });
  };

  // Define transactions
  const transactions: Transaction[] = [
    {
      type: "sent",
      amount: "-100",
      symbol: "USDC",
      address: "To Ha3...6kP",
      date: "Today",
      timeGroup: "Today",
      icon: <LuCircleDollarSign className="w-5 h-5" />,
      bgColor: "bg-blue-500",
    },
    {
      type: "received",
      amount: "+0.83097828",
      symbol: "SOL",
      address: "From Ha3...6kP",
      date: "Today",
      timeGroup: "Today",
      icon: <SiSolana className="w-5 h-5" />,
      bgColor: "bg-purple-900",
    },
    //add yesterday transaction
    {
      type: "sent",
      amount: "-100",
      symbol: "USDC",
      address: "To Ha3...6kP",
      date: "Yesterday",
      timeGroup: "Yesterday",
      icon: <LuCircleDollarSign className="w-5 h-5" />,
      bgColor: "bg-blue-500",
    },
    {
      type: "received",
      amount: "+0.83097828",
      symbol: "SOL",
      address: "From Ha3...6kP",
      date: "Yesterday",
      timeGroup: "Yesterday",
      icon: <SiSolana className="w-5 h-5" />,
      bgColor: "bg-purple-900",
    },
    //add older transaction
    {
      type: "sent",
      amount: "-100",
      symbol: "USDC",
      address: "To Ha3...6kP",
      date: "2021-09-01",   //change date to older date
      timeGroup: "Older",
      icon: <LuCircleDollarSign className="w-5 h-5" />,
      bgColor: "bg-blue-500",
    },
  ];

  // Group transactions by timeGroup
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    if (!groups[transaction.timeGroup]) {
      groups[transaction.timeGroup] = [];
    }
    groups[transaction.timeGroup].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {/* Left Icon */}
        <FaArrowLeft onClick={handleBack} className="w-6 h-6 cursor-pointer" />
        {/* Centered Heading */}
        <div className="flex-1 text-center">
          <Heading text="History" />
        </div>
      </div>

      <div className="px-4 py-2 flex justify-center space-x-12">
        <p
          className={`text-xl font-bold cursor-pointer ${
            activeTab === "all"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("all")}
        >
          All
        </p>
        <p
          className={`text-xl font-bold cursor-pointer ${
            activeTab === "by dapp"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("by dapp")}
        >
          By Dapp
        </p>
        <p
          className={`text-xl font-bold cursor-pointer ${
            activeTab === "by profile"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("by profile")}
        >
          By Profile
        </p>
      </div>

      <ProfileComponent showLabel={false} />
      
      {/* Transaction History Section */}
      <div className="px-4 py-3">
        {Object.keys(groupedTransactions).map((timeGroup) => (
          <div key={timeGroup} className="mb-4">
            <h3 className="text-[16px] font-bold text-gray-700 mb-2">{timeGroup}</h3>
            
            {groupedTransactions[timeGroup].map((transaction, index) => (
              <div 
                key={index}
                className="bg-gray-200 rounded-lg p-3 mb-3 flex items-center justify-between"
              >
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 ${transaction.bgColor} rounded-full flex items-center justify-center text-white`}
                  >
                    {transaction.icon}
                  </div>
                  <div className="ml-2">
                    <div className="text-gray-600 font-medium">
                      {transaction.type === "sent" ? "Sent" : "Received"}
                    </div>
                    <div className="text-gray-500 text-sm">
                      {transaction.address}
                    </div>
                  </div>
                </div>
                <span className={`font-bold text-lg ${transaction.type === "sent" ? "text-red-500" : "text-green-500"}`}>
                  {transaction.amount} {transaction.symbol}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default History;