import { useState } from "react";
import Heading from "@/components/heading";
import Button from "@/components/Button";
import { FaGoogle, FaApple, FaEnvelope } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

const SocialSignin = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (provider: string) => {
    setLoading(provider);
    setError(null);
    
    try {
      // Here you would implement the actual sign-in logic
      // For a browser extension, you would typically use OAuth flows
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (typeof chrome !== 'undefined' && chrome.identity) {
        // Example for Google sign-in:
        if (provider === 'Google') {
          console.log("Initiating Google sign-in flow");
        } 
        // Similar flow for other providers
      } else {
        // For development or non-extension environments
        console.log(`Sign in with ${provider} initiated`);
      }
      
      // For demo purposes, we'll just log the provider
      console.log(`Successfully signed in with ${provider}`);
      
    } catch (err) {
      console.error(`Error signing in with ${provider}:`, err);
      setError(`Failed to sign in with ${provider}. Please try again.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen h-full w-full">
      <div className="flex items-center my-4">
          <Heading text="Sign in to Swig with a social account" />
        </div>
        <img
            src="/icons/icon16.png"
            alt="Swig Wallet Icon"
            className="w-8 h-8 mr-2"
          />
      <div className="rounded-lg w-full p-4 max-w-md flex flex-col items-center">
        
        <div className="w-full px-4 py-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <Button
            icon={<FaGoogle size={20} />}
            provider="Google"
            onClick={() => handleSignIn('Google')}
            color="bg-red-500"
            textColor="text-white"
          />
          
          <Button
            icon={<FaApple size={20} />}
            provider="Apple"
            onClick={() => handleSignIn('Apple')}
            color="bg-black"
            textColor="text-white"
          />
          
          <Button
            icon={<FaXTwitter size={20} />}
            provider="X"
            onClick={() => handleSignIn('X')}
            color="bg-blue-500"
            textColor="text-white"
          />
          
          <Button
            icon={<FaEnvelope size={20} />}
            provider="Email"
            onClick={() => handleSignIn('Email')}
            color="bg-gray-500"
            textColor="text-white"
          />
          
          <div className="text-center mt-4 text-gray-500 text-sm">
            By continuing, you agree to our <br/>
            <a href="#" className="text-blue-500">Terms of Service</a> and <a href="#" className="text-blue-500">Privacy Policy</a>
          </div>
        </div>
        
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-5 rounded-lg flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-3"></div>
              <p>Signing in with {loading}...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SocialSignin;