export const getCol = (name: string): string => {
  if (typeof window !== 'undefined') {
    const isDemo = localStorage.getItem('demoMode') === 'true';
    return isDemo ? `demo_${name}` : name;
  }
  return name;
};

export const getInvoicePrefix = (): string => {
  if (typeof window !== 'undefined') {
    const isDemo = localStorage.getItem('demoMode') === 'true';
    return isDemo ? 'RE-DEMO-' : 'RE-2026-'; // Or dynamic year if needed
  }
  return 'RE-2026-';
};
