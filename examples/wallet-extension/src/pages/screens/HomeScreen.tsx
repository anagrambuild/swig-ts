import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { IoMdSettings } from "react-icons/io";
import { IoIosSend, IoIosHome } from "react-icons/io";
import { FaRegClock } from "react-icons/fa";
import { RiBtcFill } from "react-icons/ri";
import { FaEthereum } from "react-icons/fa6";
import { SiSolana } from "react-icons/si";
import { LuCircleDollarSign } from "react-icons/lu";
import Heading from "@/components/heading";
import SettingsModal from "../modals/SettingsModal";
import ProfileComponent from "@/components/ProfileDropdown";

// Define types for our component
interface CryptoAsset {
  symbol: string;
  name: string;
  amount: string;
  value: string;
  bgColor: string;
  icon: React.ReactNode;
}

const HomeScreen = () => {
  const location = useLocation();
  // settings modal state
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    if (location.state?.openSettingsModal) {
      setIsSettingsModalOpen(true);
    }
  }, [location.state]);

  // Define crypto assets with typed structure
  const assets: CryptoAsset[] = [
    {
      symbol: "USDC",
      name: "USDC",
      amount: "2,450.00",
      value: "$2,450.00",
      bgColor: "bg-blue-500",
      icon: <LuCircleDollarSign className="w-5 h-5" />,
    },
    {
      symbol: "BTC",
      name: "BTC",
      amount: "0.23094723",
      value: "$273.49",
      bgColor: "bg-orange-500",
      icon: <RiBtcFill className="w-5 h-5" />,
    },
    {
      symbol: "ETH",
      name: "ETH",
      amount: "2.7809323",
      value: "$1,874.71",
      bgColor: "bg-blue-600",
      icon: <FaEthereum className="w-5 h-5" />,
    },
    {
      symbol: "SOL",
      name: "SOL",
      amount: "4.708740",
      value: "$330.42",
      bgColor: "bg-purple-900",
      icon: <SiSolana className="w-5 h-5" />,
    },
  ];

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
          <Heading text="Swig Wallet" />
        </div>

        {/* Settings Icon */}
        <IoMdSettings
          className="w-6 h-6 text-black cursor-pointer"
          onClick={() => setIsSettingsModalOpen(true)}
        />

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      </div>

      <ProfileComponent label="Current Role" />
      {/* Balance Section */}
      <div className="px-4 py-5 text-center">
        <p className="text-gray-500 text-xl font-bold">Balance</p>
        <h2 className="text-3xl font-bold mt-1">$5,350.36</h2>
      </div>

      {/* Crypto List */}
      <div className="px-4">
        {assets.map((asset, index) => (
          <div
            key={index}
            className="bg-gray-200 rounded-lg p-3 mb-4 flex items-center justify-between"
          >
            <div className="flex items-center">
              <div
                className={`w-8 h-8 ${asset.bgColor} rounded-full flex items-center justify-center text-white`}
              >
                {asset.icon}
              </div>
              <span className="ml-2 text-gray-600">
                {asset.amount} {asset.symbol}
              </span>
            </div>
            <span className="font-bold">{asset.value}</span>
          </div>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div className="flex justify-around bg-blue-600 text-white p-3 mt-auto">
        <button className="flex flex-col items-center justify-center">
          <IoIosSend className="w-6 h-6" />
        </button>
        <button className="flex flex-col items-center justify-center">
          <IoIosHome className="w-6 h-6" />
        </button>
        <button className="flex flex-col items-center justify-center">
          <FaRegClock className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default HomeScreen;
