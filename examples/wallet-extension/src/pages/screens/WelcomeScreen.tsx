import { Link } from "react-router-dom";
import Heading from "@/components/heading";
import Button from "@/components/Button";
import { IoMdAdd } from "react-icons/io";
import { MdOutlineRestore } from "react-icons/md";
import { FaUser } from "react-icons/fa";

const WelcomeScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center max-h-full">
      <div className="rounded-lg w-full p-4 max-w-md flex flex-col items-center">
        <div className="flex items-center my-2">
          <img
            src="/icons/icon16.png"
            alt="Swig Wallet Icon"
            className="w-6 h-6 mr-2"
          />
          <Heading text="Welcome to Swig Wallet" />
        </div>

        <h2 className="text-[20px] text-[#6e6d6dde] text-center font-bold mb-6 mt-6">
          Securely manage your crypto with role-based permissions.
        </h2>

        <div className="bg-blue-300 rounded-full w-32 h-32 mb-6 mt-6">
          <img
            src="/icons/usericon.png"
            className="w-full h-full object-cover"
            alt="User Icon"
          />
        </div>

        {/* Ensure buttons have equal width */}
        <div className="w-full">
          <Link to="/setup-wallet" className="block w-full">
            <Button 
              text="Create new wallet"
              icon={<IoMdAdd />}
              className="bg-blue-500 text-[16px] text-white mb-3 w-full"
            />
          </Link>
        </div>

        <div className="w-full">
          <Link to="/recover-wallet" className="block w-full">
            <Button 
              text="Restore existing wallet"
              icon={<MdOutlineRestore />}
              className="bg-gray-500 text-[16px] text-white mb-3 w-full"
            />
          </Link>
        </div>

        <div className="w-full">
          <Link to="/social-signin" className="block w-full">
            <Button 
              text="Sign in with social"
              icon={<FaUser />}
              className="bg-gray-300 text-[16px] text-black mb-3 w-full"
            />
          </Link>
        </div>

      </div>

      <div className="text-gray-500 text-sm">Powered by Anagram XYZ</div>
    </div>
  );
};

export default WelcomeScreen;
