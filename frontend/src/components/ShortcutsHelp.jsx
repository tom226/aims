export default function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;
  const groups = [
    { title: 'Global', items: [
      ['Ctrl + K', 'Open command palette'],
      ['?', 'Show this help'],
      ['Shift + D', 'Toggle dark mode'],
      ['Esc', 'Close dialogs'],
    ]},
    { title: 'Navigation (press in sequence)', items: [
      ['g d', 'Dashboard'],
      ['g p', 'Products'],
      ['g s', 'Stock summary'],
      ['g o', 'Purchase orders'],
      ['g i', 'Invoices'],
      ['g c', 'Customers'],
      ['g r', 'Reports'],
    ]},
    { title: 'Create', items: [
      ['n p', 'New purchase order'],
      ['n s', 'New sales order'],
      ['n i', 'New invoice'],
    ]},
  ];
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Keyboard Shortcuts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{g.title}</p>
              <div className="space-y-1.5">
                {g.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{desc}</span>
                    <span className="flex gap-1">
                      {keys.split(' ').map((k, i) => <span key={i} className="kbd">{k}</span>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
