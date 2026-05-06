import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    features: ["3 AI Tutor chats/day", "10 Tasks", "100MB Storage", "Basic grading"],
    limits: { aiTutor: 3, tasks: 10, storage: "100MB" },
  },
  {
    name: "Pro",
    price: "$9.99/mo",
    features: ["Unlimited AI Tutor", "Unlimited Tasks", "5GB Storage", "AI Grading"],
    popular: true,
  },
  {
    name: "Educator",
    price: "$19.99/mo",
    features: ["All Pro features", "Educator Portal", "LMS Integration", "10GB Storage"],
  },
  {
    name: "Institution",
    price: "Contact Us",
    features: ["All Educator features", "Multi-teacher", "Analytics", "SSO", "100GB+ Storage"],
  },
];

export default function PricingPage() {
  const { data: subData } = useQuery({
    queryKey: ["/api/billing/subscription"],
    queryFn: async () => {
      const res = await fetch("/api/billing/subscription");
      return res.json();
    },
  });
  const currentTier = subData?.data?.tier || "free";

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">Unlock the full potential of EduAI</p>
      </div>
      <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {TIERS.map((tier) => (
          <Card key={tier.name} className={tier.popular ? "border-primary shadow-lg" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {tier.name}
                {tier.popular && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">Popular</span>}
              </CardTitle>
              <p className="text-3xl font-bold">{tier.price}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    {f}
                  </li>
                ))}
              </ul>
              {tier.name !== "Institution" ? (
                <Button className="w-full mt-6" variant={tier.popular ? "default" : "outline"}>
                  {currentTier === tier.name.toLowerCase() ? "Current Plan" : "Upgrade"}
                </Button>
              ) : (
                <Button className="w-full mt-6" variant="outline">Contact Sales</Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
