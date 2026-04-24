import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface AnswerInputProps {
  type: "mcq" | "short" | "numerical" | "long";
  options?: any[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function AnswerInput({ type, options, value, onChange, disabled }: AnswerInputProps) {
  if (type === "mcq" && options) {
    return (
      <RadioGroup value={value} onValueChange={onChange} disabled={disabled} className="space-y-3">
        {options.map((option, index) => {
          const isSelected = value === option.id;
          return (
            <div
              key={index}
              className={cn(
                "flex cursor-pointer items-center space-x-4 rounded-2xl border p-5 transition-all duration-300",
                isSelected
                  ? "border-accent bg-accent/[0.03] shadow-soft ring-1 ring-accent/10"
                  : "border-border bg-card hover:border-accent/40 hover:bg-muted/50"
              )}
              onClick={() => !disabled && onChange(option.id)}
            >
              <RadioGroupItem
                value={option.id}
                id={`option-${index}`}
                className="border-border text-accent"
              />
              <Label
                htmlFor={`option-${index}`}
                className={cn(
                  "flex-1 cursor-pointer font-body text-base leading-tight",
                  isSelected ? "font-bold text-foreground" : "text-muted-foreground"
                )}
              >
                {option.text}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
    );
  }

  if (type === "numerical") {
    return (
      <div className="space-y-3">
        <Label
          htmlFor="numerical-answer"
          className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground"
        >
          Your Numerical Answer
        </Label>
        <Input
          id="numerical-answer"
          type="number"
          placeholder="0.00"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-16 rounded-2xl border-border bg-muted/50 px-6 font-mono text-2xl font-bold transition-all focus-visible:border-accent focus-visible:ring-accent/10"
        />
      </div>
    );
  }

  // Fallback for short/long
  return (
    <div className="space-y-3">
      <Label
        htmlFor="text-answer"
        className="px-1 text-xs font-bold uppercase tracking-widest text-muted-foreground"
      >
        Your Detailed Explanation
      </Label>
      <Textarea
        id="text-answer"
        placeholder="Start typing your response here..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-h-[220px] resize-none rounded-2xl border-border bg-muted/50 p-6 font-body text-lg leading-relaxed focus-visible:border-accent focus-visible:ring-accent/10"
      />
    </div>
  );
}
