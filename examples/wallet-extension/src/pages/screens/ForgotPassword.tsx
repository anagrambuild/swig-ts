import { useNavigate } from "react-router-dom";
import Heading from "@/components/heading";
import Button from "@/components/Button";

const ForgotPassword = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-white max-w-md flex flex-col min-h-full justify-center">
      <div className="p-4 border-b border-gray-200">
        <Heading text="Forgot password" />
      </div>
      
      <div className="flex flex-col items-center p-6 mt-10">
        {/* Avatar image with purple selection border */}
        <div className="relative mb-4">
          <div className="w-32 h-32 rounded-full flex items-center justify-center">
            <img 
              src="/icons/25.png" 
              alt="User avatar" 
              className="w-24 h-24"
            />
          </div>
        </div>
        
        {/* Message text */}
        <p className="text-center text-gray-500 px-8 text-xl font-bold">
          You can reset your password by entering your 12-word secret recovery phrase. Swig can't reset it for you.
        </p>
      </div>
      
      {/* Reset button at the bottom */}
      <div className="my-4 p-6">
        <Button
          text="Reset password"
          className="bg-blue-500 text-white text-[16px] w-full py-3 rounded-md"
          onClick={() => navigate("/recover-wallet")}
        />
      </div>
    </div>
  );
};

export default ForgotPassword;