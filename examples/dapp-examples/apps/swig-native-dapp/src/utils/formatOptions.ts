export const displayLabels = (
  allOptions: { value: string; label: string }[],
  selectedOptions: string[]
) => {
  return allOptions
    .filter((option) => selectedOptions.includes(option.value))
    .map((option) => option.label);
};

export const formatOptions = (
  allOptions: { value: string; label: string }[],
  selectedOptions: string[]
) => {
  return allOptions.filter((option) => selectedOptions.includes(option.value));
};
