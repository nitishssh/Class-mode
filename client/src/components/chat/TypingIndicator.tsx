const TypingIndicator = ({ name }: { name?: string }) => (
  <div className="flex items-center gap-2 px-4 py-1">
    <div className="bg-bubble-other flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3">
      {name && <span className="text-[11px] text-muted-foreground">{name}</span>}
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bg-typing animate-typing-dot h-1.5 w-1.5 rounded-full"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  </div>
);

export default TypingIndicator;
