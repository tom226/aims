import { InboxIcon } from '@heroicons/react/24/outline';

export default function EmptyState({ icon: Icon = InboxIcon, title = 'Nothing here yet', description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}
