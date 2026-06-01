import { motion } from "framer-motion";

interface ChipSelectProps {
  options: { label: string; value: string }[];
  selected: string[];
  onChange: (value: string[]) => void;
  multi?: boolean;
}

export function ChipSelect({ options, selected, onChange, multi = false }: ChipSelectProps) {
  const toggle = (val: string) => {
    if (multi) {
      if (selected.includes(val)) {
        onChange(selected.filter((v) => v !== val));
      } else {
        onChange([...selected, val]);
      }
    } else {
      onChange([val]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt, i) => {
        const isSelected = selected.includes(opt.value);
        return (
          <motion.button
            key={opt.value}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            onClick={() => toggle(opt.value)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              isSelected
                ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                : "dark:hover:bg-gray-750 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            }`}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </div>
  );
}
