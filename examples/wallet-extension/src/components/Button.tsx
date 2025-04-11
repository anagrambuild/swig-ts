import React from "react";

interface ButtonProps {
  text?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  provider?: string;
  color?: string;
  textColor?: string;
  padding?: string;
}

const Button: React.FC<ButtonProps> = ({
  text,
  onClick,
  icon,
  className,
  disabled,
  provider,
  color,
  textColor = "text-white",
  padding = "px-2 py-3" // Default padding that can be overridden
}) => {
  const buttonContent = provider ? (
    <>
      {icon && <span className="mr-3">{icon}</span>}
      <span className="font-medium">Continue with {provider}</span>
    </>
  ) : (
    <>
      <span>{text}</span>
      {icon && <span className="ml-2 text-xl">{icon}</span>}
    </>
  );

  const buttonClass = provider
    ? `flex items-center justify-center w-full ${padding} px-4 mb-3 rounded-lg ${color} ${textColor} transition-transform transform hover:scale-[1.02] active:scale-[0.98] ${className || ""}`
    : `${padding} font-bold rounded-lg flex items-center justify-center ${
        disabled ? "bg-gray-300 text-gray-500 cursor-not-allowed" : ""
      } ${className || ""}`;

  return (
    <button
      className={buttonClass}
      onClick={onClick}
      disabled={disabled}
    >
      {buttonContent}
    </button>
  );
};

export default Button;