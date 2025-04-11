import React, { useState, useEffect } from 'react';
import Button from './Button';
// Props interface for the Modal component
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryAction?: (inputValue?: string) => void;
  onSecondaryAction?: () => void;
  showCloseButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showInput?: boolean;
  inputPlaceholder?: string;
  inputLabel?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  primaryButtonText,
  secondaryButtonText,
  onPrimaryAction,
  onSecondaryAction,
  showCloseButton = false,
  size = 'md',
  showInput = false,
  inputPlaceholder = 'Enter text here...',
  inputLabel
}) => {
  const [isVisible, setIsVisible] = useState(isOpen);
  const [inputValue, setInputValue] = useState('');

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto'; // Restore scrolling when modal is closed
    };
  }, [isOpen, onClose]);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setInputValue(''); // Reset input value when modal opens
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible) return null;

  // Determine modal size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg'
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle button actions
  const handlePrimaryAction = () => {
    if (onPrimaryAction) {
      onPrimaryAction(showInput ? inputValue : undefined);
    }
    onClose();
  };

  const handleSecondaryAction = () => {
    if (onSecondaryAction) {
      onSecondaryAction();
    }
    onClose();
  };

  // Determine if buttons should be shown
  const showPrimaryButton = !!primaryButtonText;
  const showSecondaryButton = !!secondaryButtonText;
  const showButtons = showPrimaryButton || showSecondaryButton;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-opacity-50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleBackdropClick}
    >
      <div 
        className={`bg-gray-200 border-2 border-gray-600 rounded-lg shadow-xl transform transition-all ${sizeClasses[size]} w-full ${isOpen ? 'scale-100' : 'scale-95'}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Modal content */}
        <div className="p-6">
          {/* Close button */}
          {showCloseButton && (
            <button 
              className="absolute top-3 right-3 text-gray-300 hover:text-gray-100"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          {/* Title */}
          {title && (
            <h3 className="text-lg font-bold text-gray-600 mb-2">
              {title}
            </h3>
          )}
          
          {/* Message */}
          <div className="mt-2 mb-6">
            <p className="text-gray-600 text-center font-bold">
              {message}
            </p>
          </div>
          
          {/* Optional Input Field */}
          {showInput && (
            <div className="mb-4">
              {inputLabel && (
                <label className="block text-gray-600 text-sm font-medium mb-1">
                  {inputLabel}
                </label>
              )}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={inputPlaceholder}
                className="w-full px-3 py-2 border-2 border-gray-600 rounded-md bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-700"
              />
            </div>
          )}
          
          {showButtons && (
            <div className="flex justify-center gap-4 mt-4">
              {showSecondaryButton && (
                <Button
                  text={secondaryButtonText}
                  onClick={handleSecondaryAction}
                  className="bg-gray-200 text-gray-600 text-sm w-1/4 border-2 border-gray-600"
                  padding="px-1 py-0"
                />
              )}
              {showPrimaryButton && (
                <Button
                  text={primaryButtonText}
                  onClick={handlePrimaryAction}
                  className="bg-gray-200 text-gray-600 text-sm w-1/4 border-2 border-gray-600"
                  padding="px-1 py-0"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;