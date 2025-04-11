import React from 'react';
import { Link } from 'react-router-dom';
import { FaUserShield, FaClock, FaUserCog, FaTools, FaArrowRight, FaHistory } from 'react-icons/fa';
import { IoMdApps } from "react-icons/io";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute top-0 right-0 h-full w-64 bg-gray-100 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4">
          <button onClick={onClose} aria-label="Close Settings" className="hover:bg-gray-200 rounded-full p-1">
            <FaArrowRight className="w-6 h-6 text-black" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="flex flex-col p-4 space-y-4 text-gray-700">
          <Link 
            to="/manage-roles" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FaUserShield className="w-5 h-5 text-black mr-2" />
              <span className="text-lg font-bold">Manage roles</span>
            </div>
          </Link>
          <Link 
            to="/manage-profiles" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FaClock className="w-5 h-5 text-black mr-2" />
              <span className="text-lg font-bold">Manage profiles</span>
            </div>
          </Link>
          <Link 
            to="/manage-subaccounts" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FaUserCog className="w-5 h-5 text-black mr-2" />
              <span className="text-lg font-bold">Manage sub-accounts</span>
            </div>
          </Link>
          <Link 
            to="/developer-tools" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FaTools className="w-5 h-5 text-black mr-2" />
              <span className="text-lg font-bold">Developer tools</span>
            </div>
          </Link>
          <Link 
            to="/connected-dapps" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <IoMdApps className="w-6 h-6 text-black mr-2" />
              <span className="text-lg font-bold">Connected dApps</span>
            </div>
          </Link>
          <Link 
            to="/history" 
            onClick={onClose} 
            className="text-left hover:bg-gray-200 p-2 rounded flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <FaHistory className="w-5 h-5 text-black mr-2" />
              <span className="text-lg font-bold">Activity history</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
