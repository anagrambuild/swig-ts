import { useState, useEffect, useRef } from "react";
import Heading from "@/components/heading";
import Button from "@/components/Button";
import { useNavigate } from "react-router-dom";
import { FaClipboard, FaArrowRight } from "react-icons/fa";

const Recovery = () => {
  const [pasteSuccess, setPasteSuccess] = useState(false);
  const [pasteError, setPasteError] = useState(false);
  const [recoveryWords, setRecoveryWords] = useState<string[]>(Array(12).fill(""));
  const [currentInput, setCurrentInput] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Create a hidden textarea for clipboard operations
    const hiddenTextArea = document.createElement('textarea');
    hiddenTextArea.style.position = 'absolute';
    hiddenTextArea.style.left = '-9999px';
    hiddenTextArea.style.top = '0';
    document.body.appendChild(hiddenTextArea);
    textAreaRef.current = hiddenTextArea;

    // Add event listener for paste events
    document.addEventListener('click', () => {
      if (textAreaRef.current) {
        // Focus and select the hidden textarea on any click
        textAreaRef.current.focus();
        textAreaRef.current.select();
      }
    });
    
    // Add paste event listener to the hidden textarea
    if (textAreaRef.current) {
      textAreaRef.current.addEventListener('paste', handleHiddenTextareaPaste);
    }
    
    return () => {
      // Clean up
      if (textAreaRef.current) {
        textAreaRef.current.removeEventListener('paste', handleHiddenTextareaPaste);
        document.body.removeChild(textAreaRef.current);
      }
    };
  }, []);

  const handleHiddenTextareaPaste = () => {
    setTimeout(() => {
      if (textAreaRef.current) {
        const text = textAreaRef.current.value;
        if (text) {
          processClipboardText(text);
          // Clear the textarea
          textAreaRef.current.value = '';
        }
      }
    }, 100); // Small delay to ensure the paste completes
  };

  const processClipboardText = (text: string) => {
    try {
      const words = text.trim().split(/\s+/).slice(0, 12);
      const newRecoveryWords = [...Array(12).fill("")];
      
      words.forEach((word, index) => {
        if (index < 12) {
          newRecoveryWords[index] = word;
        }
      });
      
      setRecoveryWords(newRecoveryWords);
      setPasteSuccess(true);
      setPasteError(false);
      
      setTimeout(() => {
        setPasteSuccess(false);
      }, 2000);
    } catch (error) {
      console.error("Clipboard processing error:", error);
      setPasteError(true);
      setTimeout(() => {
        setPasteError(false);
      }, 2000);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Move to next box on space or enter
    if ((e.key === " " || e.key === "Enter") && currentInput.trim()) {
      e.preventDefault();
      addWord();
    }
  };

  const addWord = () => {
    if (currentInput.trim() && activeIndex < 12) {
      const newWords = [...recoveryWords];
      newWords[activeIndex] = currentInput.trim();
      setRecoveryWords(newWords);
      setCurrentInput("");
      setActiveIndex(Math.min(activeIndex + 1, 11));
    }
  };

  const focusWordBox = (index: number) => {
    setActiveIndex(index);
    setCurrentInput(recoveryWords[index]);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        processClipboardText(text);
      } else {
        setPasteError(true);
        setPasteSuccess(false);
        setTimeout(() => setPasteError(false), 2000);
      }
    } catch (err) {
      console.error("Clipboard API error:", err);
      setPasteError(true);
      setPasteSuccess(false);
      setTimeout(() => setPasteError(false), 2000);
    }
  };  

  return (
    <div className="flex flex-col items-center justify-center min-h-screen h-full w-full">
      <div className="rounded-lg w-full p-4 max-w-md flex flex-col items-center">
        <div className="flex flex-col items-center my-2">
          <Heading text="Recover your Swig Wallet" />
        </div>
        <div className="flex items-center my-2">
          <img
            src="/icons/icon16.png"
            alt="Swig Wallet Icon"
            className="w-6 h-6 cursor-pointer"
          />
        </div>
        <div className="w-full mb-4">
          <h3 className="text-gray-600 mb-2 text-center justify-center">
            Enter Your Secret Recovery Phrase
          </h3>
          
          {/* Clipboard paste button */}
          <Button
            text={pasteSuccess ? "Pasted!" : pasteError ? "Permission denied" : "Paste From Clipboard"}
            icon={<FaClipboard />}
            onClick={pasteFromClipboard}
            className={`text-[16px] text-white mb-2 w-full rounded-md p-3 ${
              pasteSuccess ? "bg-green-500" : pasteError ? "bg-red-500" : "bg-gray-500"
            }`}
          />
          
          {/* Manual input field */}
          <div className="flex items-center w-full mb-2 mt-4">
            <input
              ref={inputRef}
              type="text"
              value={currentInput}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`Enter word #${activeIndex + 1}`}
              className="flex-grow p-2 rounded-md border"
              autoFocus
            />
            <button 
              onClick={addWord}
              className="bg-gray-500 text-white p-2 rounded-md ml-2"
            >
              <FaArrowRight />
            </button>
          </div>
          
          <div className="text-xs text-gray-500 mb-2 text-center">
            {pasteError ? "Please make sure to grant clipboard permission in your browser" : "Press Space or Enter to move to the next word"}
          </div>
        </div>
        
        {/* Recovery words grid */}
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          {recoveryWords.map((word, index) => (
            <div 
              key={index} 
              className={`p-2 rounded-md text-center text-sm h-10 flex items-center justify-center cursor-pointer ${
                index === activeIndex 
                  ? "bg-blue-100 border-2 border-blue-500" 
                  : word 
                    ? "bg-gray-200" 
                    : "bg-gray-100 border border-dashed border-gray-300"
              }`}
              onClick={() => focusWordBox(index)}
            >
              {word || `#${index + 1}`}
            </div>
          ))}
        </div>
        
        {/* Restore button */}
        <Button
          text="Restore wallet"
          className={`bg-blue-500 text-[16px] text-white mb-3 w-full ${
            recoveryWords.filter(word => word).length < 12 ? "opacity-50" : ""
          }`}
          onClick={() => navigate("/home")}
          disabled={recoveryWords.filter(word => word).length < 12}
        />
      </div>
    </div>
  );
};

export default Recovery;