import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import { FaArrowLeft } from "react-icons/fa";
import Button from "@/components/Button";
import ProfileComponent from "@/components/ProfileDropdown";
import Modal from "@/components/Modal";

const ManageRoles = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("Degen");
  const [timeRemaining, setTimeRemaining] = useState("00:24:43");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBack = () => {
    setTimeRemaining("00:24:43");
    navigate("/home", { state: { openSettingsModal: true } });
  };

  const openRevokeModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleRevokePermissions = () => {
    // Add logic to handle revoking permissions
    console.log("Permissions revoked");
    // Navigate or perform additional actions after revoking
    navigate("/home");
  };

  const permissions = [
    "View transaction history",
    "View balance",
    "Set up automatic subscriptions",
    "Sign transactions",
    "Create a sub-account",
  ];

  return (
    <div className="mx-auto bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-gray-200">
        <FaArrowLeft onClick={handleBack} className="w-6 h-6 cursor-pointer" />
        <div className="flex-1 text-center">
          <Heading text="Manage roles" />
        </div>
      </div>

      {/* profile role info */}
      <div className="py-2">
        <ProfileComponent
          label="Admin role has all permissions by default"
          onProfileChange={setSelectedRole}
        />
      </div>

      {/* Permissions list */}
      <div className="px-4 py-2">
        <h3 className="font-bold text-gray-500 mb-2 text-xl">
          Permissions for {selectedRole}
        </h3>
        <div className="bg-gray-200 p-4 rounded-lg">
          {permissions.map((permission, index) => (
            <div
              key={index}
              className="mb-3 text-sm font-bold text-gray-600 flex justify-center items-center text-center"
            >
              {permission}
            </div>
          ))}
        </div>

        {/* Session info */}
        <div className="mt-4 text-sm text-gray-700">
          <div className="flex justify-between mb-1">
            <span>Time remaining in session:</span>
            <span>{timeRemaining}</span>
          </div>
          <div className="bg-gray-200 p-4 rounded-lg">
            <div className="flex justify-between mb-1 text-sm font-bold text-gray-600">
              <span>Linked to sub-account:</span>
              <span>Sub-account 2</span>
            </div>
            <div className="flex justify-between mb-2 text-sm font-bold text-gray-600">
              <span>Balances:</span>
              <span>1.9856943 SOL, 150.00 USDC</span>
            </div>
            {/* Container for side-by-side buttons */}
            <div className="flex space-x-2 w-full">
              {/* Button to manage sub accounts */}
              <Button
                text="Manage sub-accounts"
                className="bg-gray-200 text-gray-600 text-sm border-2 border-gray-600 w-1/2"
                padding="px-2 py-1"
              />
              {/* button to view pub key */}
              <Button
                text="View PubKey"
                className="bg-gray-200 text-gray-600 text-sm border-2 border-gray-600 w-1/2"
                padding="px-2 py-1"
              />
            </div>
          </div>
        </div>
        <Button
          text="Revoke permissions"
          className="bg-red-500 text-white w-full mt-4"
          onClick={openRevokeModal}
        />
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        message={`If you continue this sub-account will be closed and all funds will return to your main wallet. Do you wish to continue?`}
        onPrimaryAction={handleRevokePermissions}
        onSecondaryAction={closeModal}
        primaryButtonText="Yes"
        secondaryButtonText="No"
        size="md"
      />
    </div>
  );
};

export default ManageRoles;
