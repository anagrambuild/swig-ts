import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import { FaArrowLeft } from "react-icons/fa";
import Button from "@/components/Button";
import AccountComponent from "@/components/AccountDropdown";
import { LuCircleDollarSign } from "react-icons/lu";
import { SiSolana } from "react-icons/si";
import RangeSlider from "react-range-slider-input";
import "react-range-slider-input/dist/style.css";
import { IoTrashBin } from "react-icons/io5";
import { FaPlus } from "react-icons/fa";

// Define types for our component
interface CryptoAsset {
  symbol: string;
  name: string;
  amount: string;
  value: string;
  bgColor: string;
  icon: React.ReactNode;
}

const ManagesubAccounts = () => {
  const navigate = useNavigate();
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
      <div className="flex items-center p-4 border-b border-gray-200">
        <FaArrowLeft onClick={handleBack} className="w-6 h-6 cursor-pointer" />
        <div className="flex-1 text-center">
          <Heading text="Manage sub-accounts" />
        </div>
      </div>
      <div className="py-2">
        <AccountComponent />
      </div>

      <div className="flex space-x-2 w-full px-4">
        {/* Button to manage sub accounts */}
        <Button
          text="Transfer"
          className="bg-white text-gray-600 text-sm border-2 border-gray-600 w-1/3"
          padding="py-1"
        />
        {/* button to view pub key */}
        <Button
          text="Revoke Access"
          className="bg-white text-gray-600 text-sm border-2 border-gray-600 w-1/3"
          padding="px-0.5 py-1"
        />
        <Button
          text="Details"
          className="bg-white text-gray-600 text-sm border-2 border-gray-600 w-1/3"
          padding="py-1"
        />
      </div>
      <div className="px-4 py-2">
        <h3 className="font-bold text-gray-500 mb-2 text-xl">Balance</h3>
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
      <div className="px-4 py-2">
        <div className="bg-gray-200 rounded-lg p-4">
          <div className="flex justify-between mb-1 text-sm text-gray-600">
            <span>Associated permissions:</span>
            <span className="font-bold">Jup</span>
          </div>
          <div className="flex justify-between mb-2 text-sm font-bold text-gray-600">
            <span>
              View transaction history, View balance, Set up automatic
              subscriptions, Sign transactions, create sub-account
            </span>
          </div>
          <div className="flex justify-between mb-1 text-sm  text-gray-600">
            <span>Limits:</span>
            <span className="font-bold">2.5 SOL, 600 USDC</span>
          </div>
          <div className="flex justify-center mt-2">
            <Button
              text="Manage Permissions"
              className="bg-gray-200 text-gray-500 text-sm border-2 border-gray-600 w-1/2"
              padding="py-1"
            />
          </div>
        </div>
        <h3 className="font-bold text-gray-500 my-2 text-xl">
          Spending Limits
        </h3>
        <div className="bg-gray-200 rounded-lg p-4">
          <button className="mr-2 text-gray-700">
            <FaPlus />
          </button>
          {/* SOL Slider */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <button className="mr-2 text-red-500">
                  <IoTrashBin />
                </button>
                <h3 className="text-gray-500 font-medium">Max SOL</h3>
              </div>
              <span className="text-gray-500">2.5</span>
            </div>
            <div className="mb-2">
              <RangeSlider
                className="single-thumb"
                defaultValue={[0, 2.5]}
                min={0}
                max={10}
                step={0.1}
                rangeSlideDisabled={true}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">0</span>
              <span className="bg-white px-3 py-1 rounded-md text-gray-500 font-medium">
                10
              </span>
            </div>
          </div>
          {/* USDC Slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                <button className="mr-2 text-red-500">
                  <IoTrashBin />
                </button>
                <h3 className="text-gray-500 font-medium">Max USDC</h3>
              </div>
              <span className="text-gray-500">600</span>
            </div>
            <div className="mb-2">
              <RangeSlider
                className="single-thumb"
                defaultValue={[0, 600]}
                thumbsDisabled={[true, false]}
                min={0}
                max={1000}
                rangeSlideDisabled={true}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">0</span>
              <span className="bg-white px-3 py-1 rounded-md text-gray-500 font-medium">
                1000
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-center mt-2">
        <Button
          text="Cancel"
          className="bg-gray-500 text-[16px] text-white mb-3 w-1/2 mr-2"
        />
        <Button
          text="Apply"
          className="bg-blue-500 text-[16px] text-white mb-3 w-1/2"
        />
      </div>
      </div>
    </div>
  );
};

export default ManagesubAccounts;
