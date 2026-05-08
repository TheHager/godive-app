import React from "react";
import { Check, Shield, Zap, Anchor, Ship, Award } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export const PricingView = () => {
  const { user, profile } = useAuth();

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { subscriptionTier: tier });
      alert(`Welcome to the ${tier.toUpperCase()} tier!`);
    } catch (err) {
      console.error("Upgrade failed:", err);
    }
  };

  const plans = [
    {
      id: "free",
      name: "Deep Sea Aspirant",
      price: "0",
      description: "Perfect for the holiday diver and beginner.",
      icon: Anchor,
      features: [
        "Basic dive log (up to 10)",
        "Participate in public feeds",
        "Standard map view",
        "Marine fauna identifier",
      ],
      color: "primary",
    },
    {
      id: "pro",
      name: "Technical Expert",
      price: "12",
      description: "For the dedicated diver who wants all the details.",
      icon: Zap,
      features: [
        "Unlimited logs",
        "Decompression analysis",
        "Heatmaps for rare species",
        "Equipment maintenance system",
        "Exclusive 'Pro' profile badge",
      ],
      color: "secondary",
      featured: true,
    },
    {
      id: "expedition",
      name: "Expedition Leader",
      price: "29",
      description: "Access to the world's most exclusive diving community.",
      icon: Ship,
      features: [
        "Everything from 'Technical Expert'",
        "Create private expeditions",
        "4K video upload to feed",
        "Direct contact with marine biologists",
        "Access to 'Wreck Master' events",
      ],
      color: "tertiary",
    }
  ];

  return (
    <div className="flex flex-col gap-10 p-6 max-w-6xl mx-auto">
      <section className="text-center">
        <h2 className="mb-4 text-5xl font-black italic tracking-tighter text-on-surface">Choose your <span className="text-secondary">Depth</span></h2>
        <p className="mx-auto max-w-2xl text-lg font-medium text-on-surface-variant opacity-70">
          Whether you dive for fun or are looking for the next big wreck, we have a plan that matches your passion.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ y: -8 }}
            className={cn(
              "relative flex flex-col rounded-[40px] p-8 transition-all duration-300",
              plan.featured 
                ? "bg-secondary/10 border-2 border-secondary/30 shadow-[0_20px_50px_rgba(76,214,251,0.1)] ring-1 ring-secondary/20" 
                : "bg-surface-container-high/40 border border-white/5 backdrop-blur-3xl shadow-xl"
            )}
          >
            {plan.featured && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-6 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-on-secondary shadow-lg">
                Most Popular
              </div>
            )}

            <div className={cn("mb-8 flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner", 
              plan.id === 'free' ? "bg-primary/20 text-primary" : 
              plan.id === 'pro' ? "bg-secondary/20 text-secondary" : "bg-tertiary/20 text-tertiary")}>
              <plan.icon size={32} />
            </div>

            <h3 className="mb-2 text-2xl font-black italic tracking-tight text-on-surface">{plan.name}</h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter text-on-surface">${plan.price}</span>
              <span className="text-sm font-bold text-on-surface-variant uppercase tracking-widest"> / mo</span>
            </div>

            <p className="mb-8 text-sm font-medium leading-relaxed text-on-surface-variant line-clamp-2">
              {plan.description}
            </p>

            <ul className="mb-10 flex flex-col gap-4">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-semibold text-on-surface">
                  <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-secondary")}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={profile?.subscriptionTier === plan.id}
              className={cn(
                "mt-auto w-full rounded-2xl py-4 font-black uppercase tracking-widest transition-all active:scale-95",
                profile?.subscriptionTier === plan.id
                  ? "bg-white/5 text-on-surface-variant cursor-default"
                  : plan.featured
                    ? "bg-secondary text-on-secondary shadow-xl shadow-secondary/20 hover:bg-secondary-container"
                    : "bg-white/5 text-on-surface border border-white/10 hover:bg-white/10"
              )}
            >
              {profile?.subscriptionTier === plan.id ? "Current Plan" : "Select Plan"}
            </button>
          </motion.div>
        ))}
      </div>

      <section className="mt-10 rounded-[32px] bg-surface-container-high/20 p-10 border border-white/5 text-center">
        <div className="flex justify-center mb-6 text-tertiary">
          <Shield size={48} />
        </div>
        <h4 className="text-2xl font-black tracking-tighter text-on-surface mb-2">Safety beneath the surface</h4>
        <p className="text-on-surface-variant font-medium">All our plans include SOS emergency contacts and global access to dive safety maps.</p>
      </section>
    </div>
  );
};
