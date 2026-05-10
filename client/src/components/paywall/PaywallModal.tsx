import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

interface PaywallModalProps {
  feature: string;
  onClose: () => void;
}

export function PaywallModal({ feature, onClose }: PaywallModalProps) {
  const [selectedTier, setSelectedTier] = useState("pro");

  const { mutate: checkout } = useMutation({
    mutationFn: async (tier: string) => {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
  });

  const tiers = [
    { name: "Pro", price: "$9.99/mo", value: "pro" },
    { name: "Educator", price: "$19.99/mo", value: "educator" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-bold">
              <Sparkles className="h-5 w-5 text-primary" />
              Upgrade Required
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="mb-6 text-muted-foreground">
            {feature} is a premium feature. Upgrade your plan to unlock it.
          </p>
          <div className="space-y-3">
            {tiers.map((t) => (
              <Button
                key={t.value}
                className="w-full"
                variant={selectedTier === t.value ? "default" : "outline"}
                onClick={() => {
                  setSelectedTier(t.value);
                  checkout(t.value);
                }}
              >
                {t.name} — {t.price}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
