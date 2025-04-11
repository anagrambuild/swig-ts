import React, { useState } from "react";
import { IoChevronDown } from "react-icons/io5";

interface ProfileDropdownProps {
  currentProfile: string;
  profiles: string[];
  onProfileChange: (profile: string) => void;
  label?: string;
  showLabel?: boolean;
}

const ProfileDropdown: React.FC<ProfileDropdownProps> = ({
  currentProfile,
  profiles,
  onProfileChange,
  label = "Current profile",
  showLabel = true
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleProfileChange = (profile: string) => {
    onProfileChange(profile);
    setIsOpen(false);
  };

  return (
    <div className="w-full mt-2">
      {showLabel && <div className="text-sm text-gray-600 font-bold mt-2">{label}</div>}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-gray-200 p-2 rounded-lg mt-1"
        >
          <span className="font-medium">{currentProfile}</span>
          <IoChevronDown className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
            {profiles.map((profile) => (
              <div
                key={profile}
                className="p-2 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleProfileChange(profile)}
              >
                {profile}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ProfileComponentProps {
  label?: string;
  showLabel?: boolean;
  onProfileChange?: (profile: string) => void; // Allow parent to track selected profile
}

const ProfileComponent: React.FC<ProfileComponentProps> = ({ 
  label = "Current profile", 
  showLabel = true, 
  onProfileChange 
}) => {
  const [currentProfile, setCurrentProfile] = useState("Degen");
  const profiles = ["Degen", "Conservative", "DeFi Only", "Stablecoin"];

  const handleProfileChange = (profile: string) => {
    setCurrentProfile(profile);
    if (onProfileChange) {
      onProfileChange(profile); // Notify parent component
    }
  };

  return (
    <div className="px-4 py-3">
      <ProfileDropdown
        currentProfile={currentProfile}
        profiles={profiles}
        onProfileChange={handleProfileChange}
        label={label}
        showLabel={showLabel}
      />
    </div>
  );
};

export default ProfileComponent;