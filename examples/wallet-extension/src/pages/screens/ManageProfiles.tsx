import React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import { FaArrowLeft, FaPlus, FaEthereum, FaPen } from "react-icons/fa";
import { IoIosSend } from "react-icons/io";
import ProfileComponent from "@/components/ProfileDropdown";
import { LuCircleDollarSign } from "react-icons/lu";
import { RiBtcFill } from "react-icons/ri";
import { SiSolana } from "react-icons/si";
import { IoTrashBin } from "react-icons/io5";
import Modal from "@/components/Modal";

// Define types for our component
interface CryptoAsset {
  symbol: string;
  name: string;
  amount: string;
  value: string;
  bgColor: string;
  icon: React.ReactNode;
}

const ManageProfiles = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("Degen");
  const [activeTab, setActiveTab] = useState("balance");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalOpenNew, setIsModalOpenNew] = useState(false);

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const closeModalNew = () => {
    setIsModalOpenNew(false);
  };

  const handleDeleteProfile = () => {
    // Add logic to handle deleting profile
    console.log("Profile deleted");
    // Navigate or perform additional actions after deleting
    navigate("/home");
  };

  const handleNewProfile = () => {
    // Add logic to handle creating new profile
    console.log("Profile created");
    // Navigate or perform additional actions after creating
    navigate("/home");
  };

  const handleBack = () => {
    navigate("/home", { state: { openSettingsModal: true } });
  };


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
        <FaArrowLeft onClick={handleBack} className="w-6 h-6 cursor-pointer" />
        {/* Centered Heading */}
        <div className="flex-1 text-center">
          <Heading text="Manage Profiles" />
        </div>
      </div>

      <ProfileComponent
        label="Current Profile"
        onProfileChange={setSelectedRole}
      />

      <div className="px-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">Profile name</div>
          <div className="flex items-center">
            <p className="text-gray-500 text-sm font-bold mr-2">
              {selectedRole}
            </p>
            <FaPen className="text-gray-500 text-sm cursor-pointer" />
          </div>
        </div>
      </div>
      <div className="px-4 py-2 flex justify-center space-x-12">
        <p
          className={`text-xl font-bold cursor-pointer ${
            activeTab === "balance"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("balance")}
        >
          Balance
        </p>
        <p
          className={`text-xl font-bold cursor-pointer ${
            activeTab === "history"
              ? "text-blue-500 border-b-2 border-blue-500"
              : "text-gray-500"
          }`}
          onClick={() => setActiveTab("history")}
        >
          History
        </p>
      </div>
      {/* Balance Section */}
      <div className="px-4 py-2 text-center">
        <h2 className="text-3xl font-bold mt-1">$5,350.36</h2>
      </div>

      {/* Crypto List */}
      <div className="px-4">
        {assets.map((asset, index) => (
          <div
            key={index}
            className="bg-gray-200 rounded-lg p-3 mb-3 flex items-center justify-between"
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
      <div className="flex justify-around bg-white p-3 mt-auto">
        <button className="flex flex-col items-center justify-center text-red-500">
          <IoTrashBin
            onClick={() => setIsModalOpen(true)}
            className="w-6 h-6 cursor-pointer"
          />
        </button>
        <button className="flex flex-col items-center justify-center text-gray-600">
          <IoIosSend className="w-6 h-6" />
        </button>
        <button className="flex flex-col items-center justify-center text-blue-500">
          <FaPlus
            onClick={() => setIsModalOpenNew(true)}
            className="w-6 h-6 cursor-pointer"
          />
        </button>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        message={`You cannot delete this profile while it still contains tokens. Transfer all tokens first`}
        onPrimaryAction={handleDeleteProfile}
        primaryButtonText="Ok"
        size="md"
      />
      <Modal
        isOpen={isModalOpenNew}
        onClose={closeModalNew}
        showInput
        inputLabel="Profile Name"
        inputPlaceholder="Enter your new profile name"
        onPrimaryAction={handleNewProfile}
        primaryButtonText="Save"
        onSecondaryAction={closeModalNew}
        secondaryButtonText="Cancel"
        size="md"
      />
    </div>
  );
};

export default ManageProfiles;
