interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
  icon?: React.ReactNode;
}

export function EmptyState({ message, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      {icon && <div className="mb-4 text-muted-foreground/40">{icon}</div>}
      <p className="mb-4 text-sm text-muted-foreground">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-primary hover:underline"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
