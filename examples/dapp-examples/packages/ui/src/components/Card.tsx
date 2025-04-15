export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className='bg-gray-100 p-4 rounded-md w-full flex flex-col gap-2 justify-between'>
      {children}
    </div>
  );
};
