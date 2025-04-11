import React from "react";

type HeadingProps = {
  text: string;
  className?: string;
  size?: string;
};

const Heading: React.FC<HeadingProps> = ({ 
  text, 
  className = "", 
  size = "text-2xl" 
}) => {
  return (
    <h1 className={`font-bold ${size} text-center ${className}`}>{text}</h1>
  );
};

export default Heading;