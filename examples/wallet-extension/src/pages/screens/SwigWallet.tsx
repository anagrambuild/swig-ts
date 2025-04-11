import { useState } from "react";
import Heading from "@/components/heading";
import Button from "@/components/Button";
import { FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { Authority, createSwig, findSwigPda } from '@swig/classic';

const SwigWallet = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const testCreateSwig = async () => {
    try {
      setStatus("Creating Swig...");
      
      // Create a connection to localhost
      const connection = new Connection('http://localhost:8899', 'confirmed');
      
      // Generate a random ID for the Swig
      const id = new Uint8Array(13);
      crypto.getRandomValues(id);
      
      // Generate a keypair for the root authority
      const rootKeypair = Keypair.generate();
      
      // Request airdrop for the root authority
      await connection.requestAirdrop(rootKeypair.publicKey, LAMPORTS_PER_SOL);
      
      // Create the root authority
      const rootAuthority = Authority.ed25519(rootKeypair.publicKey);
      
      // Find the Swig PDA
      const [swigAddress] = findSwigPda(id);
      
      // Create the Swig
      await createSwig(
        connection,
        id,
        rootAuthority,
        0n, // startSlot
        0n, // endSlot
        rootKeypair.publicKey,
        [rootKeypair]
      );
      
      setStatus(`Success! Swig created at: ${swigAddress.toBase58()}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`Error: ${errorMessage}`);
      console.error(error); 
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen h-full w-full">
      <div className="flex items-center my-4">
        <Heading text="Swig Wallet" />
      </div>
      <img
        src="/icons/icon128.png"
        alt="Swig Wallet Icon"
        className="mr-2"
      />
      <div className="rounded-lg w-full p-4 max-w-md flex flex-col items-center">
        <div className="w-full">
          <Button
            text="Sign in with social"
            icon={<FaUser />}
            className="bg-gray-300 text-[16px] text-black mb-3 w-full"
            onClick={() => navigate("/social-signin")}
          />
        </div>
        <div className="w-full my-4">
            <p className="text-gray-500 font-bold text-xl text-center mb-6 mt-6">
                Or
            </p>
        </div>
        <div className="w-full">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            className="bg-gray-300 text-black w-full p-4 rounded-md mb-2"
          />
          <div className="text-center my-4">
            <button
              onClick={() => navigate("/forgot-password")}
              className="text-gray-500 hover:underline text-xl font-bold"
            >
              Forgot password
            </button>
          </div>
          <Button
            text="Unlock"
            className="mt-4 bg-blue-500 text-white text-[16px] w-full p-4"
            onClick={() => navigate("/home")}
          />
        </div>
        
        {/* Test Button */}
        <div className="w-full mt-8">
          <Button
            text="Test Create Swig"
            className="mt-4 bg-green-500 text-white text-[16px] w-full p-4"
            onClick={testCreateSwig}
          />
          {status && (
            <div className="mt-4 p-4 bg-gray-100 rounded-md">
              <p className="text-sm break-all">{status}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SwigWallet;