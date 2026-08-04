// Container Component
const Container = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-[20px] flex-grow flex-col items-start gap-4" dir="auto">
    {children}
  </div>
);

export default Container;
