import { useState } from "react";
import Heading from "@/components/heading";
import { useNavigate } from "react-router-dom";
import Button from "@/components/Button";
import { FaClipboard } from "react-icons/fa";

const SetupScreen = () => {
  const navigate = useNavigate();
  const [isChecked, setIsChecked] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  
  const recoveryWords = [
    "banana", "dog", "apple",
    "tree", "human", "sister",
    "wallet", "green", "solana",
    "will", "win", "forever"
  ];
  
  const handleCheckboxChange = () => {
    setIsChecked(!isChecked);
  };
  
  const copyToClipboard = () => {
    const formattedWords = recoveryWords.join(" ");
    navigator.clipboard.writeText(formattedWords)
      .then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
      });
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      <div className="rounded-lg border border-gray-200 w-full p-6 max-w-md flex flex-col items-center">
        <div className="w-full text-center mb-6">
          <Heading text="Set up your Swig Wallet" className="text-2xl font-bold" />
        </div>
       
        <div className="flex items-center my-2">
            <img
              src="/icons/icon16.png"
              alt="Swig Wallet Icon"
              className="w-6 h-6 cursor-pointer"
            />
        </div>
       
        <div className="w-full mb-4">
          <h3 className="font-bold text-gray-500 mb-2">Your Secret Recovery Phrase</h3>
          <ul className="list-disc pl-6 text-sm">
            <li className="text-red-500 mb-1">
              Write down these 12 words in order and store them in a secure place.
            </li>
            <li className="text-red-500 mb-1">
              Do not share them with anyone. Anyone with this phrase can access your funds.
            </li>
            <li className="text-red-500">
              If you lose this phrase, you will not be able to recover your wallet.
            </li>
          </ul>
        </div>
          <Button
            text={copySuccess ? "Copied!" : "Copy to clipboard"}
            icon={<FaClipboard />}
            onClick={copyToClipboard}
            className={`${copySuccess ? "bg-green-500" : "bg-gray-500"} text-[16px] text-white mb-2 w-full`}
          />
       
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          {recoveryWords.map((word, index) => (
            <div key={index} className="bg-gray-200 p-2 rounded-md text-center text-sm">
              {word}
            </div>
          ))}
        </div>
       
        <div className="w-full flex items-center mb-4">
          <input
            type="checkbox"
            id="termsCheckbox"
            checked={isChecked}
            onChange={handleCheckboxChange}
            className="mr-2 w-4 h-4 accent-blue-600"
          />
          <label htmlFor="termsCheckbox" className="text-sm">
            I confirm that I have read and agree to the{" "}
            <a href="#" className="text-blue-600 underline">Terms and Conditions</a>.
          </label>
        </div>
       
        <Button
          text="Create Wallet"
          onClick={() => navigate("/home")}
          className="bg-blue-500 text-[16px] text-white mb-3 w-full"
          disabled={!isChecked}
        />
      </div>
    </div>
  );
};

export default SetupScreen;