import React from 'react';

export interface SelectProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  multiple?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  multiple = false,
}) => {
  const baseStyles = 'px-4 py-2 rounded font-medium transition-colors w-full';
  const selectStyles =
    'bg-white border border-gray-300 text-gray-800 hover:border-blue-500 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200';

  const style = `${baseStyles} ${selectStyles} ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  } ${className || ''}`;

  // For single-select, keep the original <select> behavior
  if (!multiple) {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value);
    };

    return (
      <select
        value={value as string}
        onChange={handleChange}
        disabled={disabled}
        className={style}
      >
        {placeholder && (
          <option value='' disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  // For multi-select, use a custom UI with checkboxes
  const handleToggleOption = (optionValue: string) => {
    const currentValues = Array.isArray(value) ? value : [];
    if (currentValues.includes(optionValue)) {
      onChange(currentValues.filter((val) => val !== optionValue));
    } else {
      onChange([...currentValues, optionValue]);
    }
  };

  const handleSelectAll = () => {
    const currentValues = Array.isArray(value) ? value : [];
    if (currentValues.length === options.length) {
      // If all options are selected, deselect all
      onChange([]);
    } else {
      // Otherwise, select all options
      onChange(options.map((option) => option.value));
    }
  };

  return (
    <div className={`${style} flex-1 overflow-y-auto flex flex-col gap-1 p-2`}>
      {multiple && (
        <>
          <label
            className='flex items-center gap-2 p-1 hover:bg-blue-100 rounded cursor-pointer border-b border-gray-200'
            style={{ gap: '4px' }}
          >
            <input
              type='checkbox'
              checked={Array.isArray(value) && value.length === options.length}
              onChange={handleSelectAll}
              disabled={disabled}
              className='h-4 w-4 text-blue-600 mr-[4px]'
            />
            <span className='font-medium'>Select All</span>
          </label>
        </>
      )}
      {options.map((option) => (
        <label
          key={option.value}
          className='flex items-center gap-2 p-1 hover:bg-blue-100 rounded cursor-pointer'
          style={{ gap: '4px' }}
        >
          <input
            type='checkbox'
            checked={Array.isArray(value) && value.includes(option.value)}
            onChange={() => handleToggleOption(option.value)}
            disabled={disabled}
            className='h-4 w-4 text-blue-600 mr-[4px]'
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
};
