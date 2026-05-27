import React from "react";
import { Check, Shield, Zap, Anchor, Ship, Award } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";

export const PricingView = () => {
  const { user, profile } = useAuth();

  const handleUpgrade = async (tier: string) => {
    if (!user) return;
    try {
      // In a real application, upgrading to premium or VIP should be handled via a secure
      // backend payment endpoint that verifies payment and uses firebase-admin to perform
      // the update, since `subscriptionTier` and `points` are restricted fields.
      // Doing this via frontend will cause a permission denied error in production for non-admins.
      alert(`Upgrading to the ${tier.toUpperCase()} tier requires server-side payment processing. This functionality is disabled on the client.`);
    } catch (err) {
      console.error("Upgrade failed:", err);
    }
  };

  const plans = [
    {
      id: "free",
      name: "Resident Diver",
      price: "0",
      description: "The essentials for every diver.",
      icon: Anchor,
      features: [
        "Unlimited dives with up to 3 photos per log.",
        "Earn points for your first 5 logs/species daily.",
        "Join any event \u2013 create 1 event per week.",
        "Full access to all Weekly Challenges.",
        "Collect trophies up to Gold tier.",
        "Suggest unlimited sites (XP for the first 5).",
      ],
      color: "primary",
    },
    {
      id: "premium",
      name: "Triton",
      price: "12",
      description: "For the dedicated diver who wants more speed.",
      icon: Zap,
      features: [
        "Triton Badge + Blue Checkmark on profile.",
        "Up to 10 photos + 1 min. video per log.",
        "Earn points for every single log and species.",
        "2,500 Bonus Points upon joining.",
        "Create 1 event every day.",
        "Unlock Platinum tier trophies.",
        "Your map pins are marked as a Verified Contributor.",
      ],
      color: "secondary",
      featured: true,
    },
    {
      id: "vip",
      name: "Atlantian",
      price: "29",
      description: "The ultimate status in the diving world.",
      icon: Ship,
      features: [
        "Atlantian Badge + Gold Crown on profile.",
        "1.5x XP Multiplier on everything you do.",
        "Unlimited media uploads in Original Quality.",
        "5,000 Bonus Points upon joining.",
        "Your events stay at the top with a neon border.",
        "Create unlimited events.",
        "Exclusive access to Diamond tier.",
      ],
      color: "tertiary",
    }
  ];

  return (
    <div className="flex flex-col gap-10 p-6 max-w-6xl mx-auto">
      <section className="text-center">
        <h2 className="mb-4 text-5xl font-black italic tracking-tighter text-[#0b2240]">Choose your <span className="text-secondary">Depth</span></h2>
        <p className="mx-auto max-w-2xl text-lg font-medium text-[#475569] opacity-70">
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
                : "premium-glass border   shadow-xl"
            )}
          >
            {plan.featured && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-6 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-on-secondary shadow-lg">
                Most Popular
              </div>
            )}

            <div className={cn("mb-8 flex h-16 w-16 items-center justify-center rounded-2xl shadow-inner", 
              plan.id === 'free' ? "bg-[#0055ff]/20 text-[#0055ff]" : 
              plan.id === 'pro' ? "bg-secondary/20 text-secondary" : "bg-tertiary/20 text-tertiary")}>
              <plan.icon size={32} />
            </div>

            <h3 className="mb-2 text-2xl font-black italic tracking-tight text-[#0b2240]">{plan.name}</h3>
            <div className="mb-6 flex items-baseline gap-1">
              <span className="text-4xl font-black tracking-tighter text-[#0b2240]">${plan.price}</span>
              <span className="text-sm font-bold text-[#475569] uppercase tracking-widest"> / mo</span>
            </div>

            <p className="mb-8 text-sm font-medium leading-relaxed text-[#475569] line-clamp-2">
              {plan.description}
            </p>

            <ul className="mb-10 flex flex-col gap-4">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-semibold text-[#0b2240]">
                  <div className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full premium-glass text-secondary")}>
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
                  ? "premium-glass text-[#475569] cursor-default"
                  : plan.featured
                    ? "bg-secondary text-on-secondary shadow-xl shadow-secondary/20 hover:bg-secondary-container"
                    : "premium-glass text-[#0b2240] border  hover:premium-glass"
              )}
            >
              {profile?.subscriptionTier === plan.id ? "Current Plan" : "Select Plan"}
            </button>
          </motion.div>
        ))}
      </div>

      <section className="mt-10 rounded-[32px] premium-glass p-10 border  text-center">
        <div className="flex justify-center mb-6 text-tertiary">
          <Shield size={48} />
        </div>
        <h4 className="text-2xl font-black tracking-tighter text-[#0b2240] mb-2">Safety beneath the surface</h4>
        <p className="text-[#475569] font-medium">All our plans include SOS emergency contacts and global access to dive safety maps.</p>
      </section>
    </div>
  );
};
